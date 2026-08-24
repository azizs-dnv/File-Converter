import { useCallback, useEffect, useRef, useState } from 'react';
import { DropZone } from './components/DropZone';
import { FileCard } from './components/FileCard';
import { converters, findConverter } from './converters';
import { canEncodeImage } from './converters/image';
import { getEngineStatus, onEngineStatus, type EngineStatus } from './converters/audio';
import { getExtension } from './converters/types';
import type { QueueItem } from './types';

let idCounter = 0;
const nextId = () => `item-${Date.now()}-${idCounter++}`;

function pickDefaultTarget(item: QueueItem): string {
  const sourceExt = getExtension(item.file.name);
  const different = item.converter.targetFormats.find((t) => t.format !== sourceExt);
  return (different ?? item.converter.targetFormats[0]).format;
}

const CATEGORY_ICON: Record<string, string> = {
  image: '🖼️',
  audio: '🎵',
  document: '📄',
};

export default function App() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [unsupportedFormats, setUnsupportedFormats] = useState<Set<string>>(new Set());
  const [engineStatus, setEngineStatus] = useState<EngineStatus>(getEngineStatus());

  // Keep a fresh queue snapshot for handlers that need the current status.
  const itemsRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => onEngineStatus(setEngineStatus), []);

  // Not every browser can encode AVIF, so check once at startup.
  useEffect(() => {
    void (async () => {
      if (!(await canEncodeImage('image/avif'))) {
        setUnsupportedFormats(new Set(['avif']));
      }
    })();
  }, []);

  // Revoke object URLs on unmount to avoid leaking memory.
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.result && URL.revokeObjectURL(i.result.url));
    },
    [],
  );

  const patchItem = useCallback((id: string, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const additions: QueueItem[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      const converter = findConverter(file);
      if (!converter) {
        rejected.push(file.name);
        continue;
      }
      additions.push({
        id: nextId(),
        file,
        converter,
        targetFormat: '',
        quality: 0.85,
        status: 'ready',
        progress: 0,
      });
    }
    setItems((prev) => [...prev, ...additions.map((a) => ({ ...a, targetFormat: pickDefaultTarget(a) }))]);
    if (rejected.length > 0) setRejectedFiles((prev) => [...prev, ...rejected]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.result) URL.revokeObjectURL(item.result.url);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const convertItem = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item || item.status === 'converting') return;
      const target = item.converter.targetFormats.find((t) => t.format === item.targetFormat);
      if (!target) return;

      if (item.result) URL.revokeObjectURL(item.result.url);
      patchItem(id, { status: 'converting', progress: 0, error: undefined, result: undefined, durationMs: undefined });

      const startedAt = performance.now();
      try {
        const output = await item.converter.convert({
          file: item.file,
          targetFormat: target,
          quality: item.quality,
          onProgress: (p) => patchItem(id, { progress: p }),
        });
        patchItem(id, {
          status: 'done',
          progress: 100,
          durationMs: performance.now() - startedAt,
          result: {
            url: URL.createObjectURL(output.blob),
            fileName: output.fileName,
            size: output.blob.size,
          },
        });
      } catch (e) {
        patchItem(id, { status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    },
    [patchItem],
  );

  const pendingCount = items.filter((i) => i.status === 'ready' || i.status === 'error').length;
  const doneItems = items.filter((i) => i.status === 'done' && i.result);

  // There is one ffmpeg instance, so convert the queue sequentially.
  const convertAll = useCallback(async () => {
    const ids = itemsRef.current
      .filter((i) => i.status === 'ready' || i.status === 'error')
      .map((i) => i.id);
    for (const id of ids) {
      await convertItem(id);
    }
  }, [convertItem]);

  const downloadAll = useCallback(() => {
    itemsRef.current
      .filter((i) => i.status === 'done' && i.result)
      .forEach((i, idx) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = i.result!.url;
          a.download = i.result!.fileName;
          a.click();
        }, idx * 300);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🔄 Local File Converter</h1>
            <p className="mt-1 text-slate-400">
              Convert images, audio, and documents right in your browser.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            🔒 Your files stay in your browser
          </div>
        </header>

        <DropZone onFiles={addFiles} />

        {rejectedFiles.length > 0 && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>
              Not added (unsupported format): <strong>{rejectedFiles.join(', ')}</strong>
            </span>
            <button onClick={() => setRejectedFiles([])} aria-label="Close" className="text-amber-300 hover:text-amber-100">
              ✕
            </button>
          </div>
        )}

        {items.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                Queue <span className="text-slate-500">({items.length})</span>
              </h2>
              <div className="flex gap-2">
                {pendingCount > 0 && (
                  <button
                    onClick={() => void convertAll()}
                    className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
                  >
                    Convert all ({pendingCount})
                  </button>
                )}
                {doneItems.length >= 2 && (
                  <button
                    onClick={downloadAll}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
                  >
                    ⬇ Download all ({doneItems.length})
                  </button>
                )}
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <FileCard
                  key={item.id}
                  item={item}
                  unsupportedFormats={unsupportedFormats}
                  engineStatus={engineStatus}
                  onTargetChange={(id, format) => patchItem(id, { targetFormat: format })}
                  onQualityChange={(id, quality) => patchItem(id, { quality })}
                  onConvert={(id) => void convertItem(id)}
                  onRemove={removeItem}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {converters.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="font-semibold">
                <span aria-hidden>{CATEGORY_ICON[c.category]} </span>
                {c.label}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Input: {c.sourceExtensions.join(', ')}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Output: {c.targetFormats.map((t) => t.label).join(', ')}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-relaxed text-emerald-200/80">
          🔒 <strong className="text-emerald-300">Privacy.</strong> All conversions run locally in your browser:
          files are not uploaded to, stored on, or sent to any server. The only network request is a one-time download
          of the ffmpeg audio engine (~31 MB) during the first audio conversion; after that, it is loaded from the
          browser cache.
        </footer>
      </div>
    </div>
  );
}
