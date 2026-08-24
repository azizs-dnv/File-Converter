import { marked } from 'marked';
import TurndownService from 'turndown';
import { jsPDF } from 'jspdf';
import { baseName, getExtension } from './types';
import type { ConversionInput, ConversionOutput, Converter, TargetFormat } from './types';

const targetFormats: TargetFormat[] = [
  { format: 'html', label: 'HTML', mimeType: 'text/html' },
  { format: 'pdf', label: 'PDF', mimeType: 'application/pdf' },
  { format: 'md', label: 'Markdown', mimeType: 'text/markdown' },
  { format: 'txt', label: 'TXT', mimeType: 'text/plain' },
];

const sourceExtensions = ['md', 'markdown', 'mdown', 'txt', 'html', 'htm'];

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c];
  });
}

function fullHtml(body: string, title: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 780px; margin: 0 auto; padding: 32px 24px; line-height: 1.6; color: #1a1a1a; }
  pre { background: #f4f4f5; padding: 12px 16px; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.9em; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #d4d4d8; padding: 6px 10px; }
  img { max-width: 100%; }
  blockquote { border-left: 4px solid #d4d4d8; margin-left: 0; padding-left: 16px; color: #52525b; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function markdownToHtml(md: string, title: string): string {
  const body = marked.parse(md, { async: false, gfm: true }) as string;
  return fullHtml(body, title);
}

function plainTextToHtml(text: string, title: string): string {
  const body = `<p>${escapeHtml(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
  return fullHtml(body, title);
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style').forEach((el) => el.remove());
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * PDF through jsPDF.html(): html2canvas rasterizes the DOM to a canvas (so
 * Cyrillic works without embedding fonts), and jsPDF splits it into A4 pages.
 */
async function htmlToPdf(html: string): Promise<Blob> {
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const fragment = bodyMatch ? bodyMatch[1] : html;

  // html2canvas requires the element to be in the DOM, so place it off-screen.
  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;';
  const content = document.createElement('div');
  content.style.cssText =
    'font-family:-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;padding:48px;';
  content.innerHTML = fragment;
  holder.appendChild(content);
  document.body.appendChild(holder);

  try {
    const doc = new jsPDF({ unit: 'px', format: 'a4', hotfixes: ['px_scaling'] });
    await doc.html(content, {
      x: 0,
      y: 0,
      width: 698,
      windowWidth: 794,
      margin: 0,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#ffffff' },
    });
    return doc.output('blob');
  } finally {
    holder.remove();
  }
}

type SourceKind = 'html' | 'markdown' | 'plain';

function sourceKind(file: File): SourceKind {
  const ext = getExtension(file.name);
  if (ext === 'html' || ext === 'htm' || file.type === 'text/html') return 'html';
  if (['md', 'markdown', 'mdown'].includes(ext) || file.type === 'text/markdown') return 'markdown';
  return 'plain';
}

async function convert({ file, targetFormat, onProgress }: ConversionInput): Promise<ConversionOutput> {
  const text = await file.text();
  onProgress?.(20);
  const kind = sourceKind(file);
  const title = baseName(file.name);

  // Convert every input to HTML, which makes the other output formats easy to produce.
  const toHtml = (): string => {
    if (kind === 'html') return text;
    if (kind === 'markdown') return markdownToHtml(text, title);
    return plainTextToHtml(text, title);
  };

  let blob: Blob;
  switch (targetFormat.format) {
    case 'html':
      blob = new Blob([kind === 'html' ? text : toHtml()], { type: 'text/html;charset=utf-8' });
      break;
    case 'pdf':
      blob = await htmlToPdf(toHtml());
      break;
    case 'md':
      blob = new Blob([kind === 'html' ? turndown.turndown(text) : text], { type: 'text/markdown;charset=utf-8' });
      break;
    case 'txt':
      blob = new Blob([kind === 'plain' ? text : htmlToText(toHtml())], { type: 'text/plain;charset=utf-8' });
      break;
    default:
      throw new Error(`Unknown target format: ${targetFormat.format}`);
  }

  onProgress?.(100);
  return { blob, fileName: `${title}.${targetFormat.format}` };
}

export const documentConverter: Converter = {
  id: 'document',
  label: 'Documents',
  category: 'document',
  sourceExtensions,
  targetFormats,
  canConvert: (file) =>
    sourceExtensions.includes(getExtension(file.name)) ||
    file.type === 'text/html' ||
    file.type === 'text/markdown' ||
    file.type === 'text/plain',
  convert,
};
