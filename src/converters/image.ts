import { baseName, getExtension } from './types';
import type { ConversionInput, ConversionOutput, Converter, TargetFormat } from './types';

const targetFormats: TargetFormat[] = [
  { format: 'png', label: 'PNG', mimeType: 'image/png' },
  { format: 'jpg', label: 'JPG', mimeType: 'image/jpeg', lossy: true },
  { format: 'webp', label: 'WEBP', mimeType: 'image/webp', lossy: true },
  { format: 'avif', label: 'AVIF', mimeType: 'image/avif', lossy: true },
];

const sourceExtensions = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'heic', 'heif'];

const encodeSupportCache = new Map<string, Promise<boolean>>();

/**
 * Checks whether the browser can encode the given image/* type through canvas.
 * For unsupported types, canvas silently falls back to PNG, so we check the result.
 */
export function canEncodeImage(mimeType: string): Promise<boolean> {
  let check = encodeSupportCache.get(mimeType);
  if (!check) {
    check = new Promise<boolean>((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(false);
        ctx.fillStyle = '#123456';
        ctx.fillRect(0, 0, 1, 1);
        resolve(canvas.toDataURL(mimeType).startsWith(`data:${mimeType}`));
      } catch {
        resolve(false);
      }
    });
    encodeSupportCache.set(mimeType, check);
  }
  return check;
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Some browsers and formats can only be decoded through <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The browser could not decode this image (unsupported format).'));
      img.src = url;
    });
    return img;
  } finally {
    // After onload, the image is decoded and the URL can be revoked.
    URL.revokeObjectURL(url);
  }
}

async function convert({ file, targetFormat, quality, onProgress }: ConversionInput): Promise<ConversionOutput> {
  const supported = await canEncodeImage(targetFormat.mimeType);
  if (!supported) {
    throw new Error(
      `This browser cannot encode ${targetFormat.label}. Try WEBP for comparable compression and broad support.`,
    );
  }

  onProgress?.(5);
  const source = await decodeImage(file);
  onProgress?.(40);

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser');
  // JPEG has no transparency, so fill with white to prevent transparent areas from turning black.
  if (targetFormat.mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0);
  if ('close' in source) source.close();
  onProgress?.(70);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, targetFormat.mimeType, targetFormat.lossy ? quality : undefined),
  );
  onProgress?.(100);

  if (!blob) throw new Error('The browser returned an empty encoding result');
  return { blob, fileName: `${baseName(file.name)}.${targetFormat.format}` };
}

export const imageConverter: Converter = {
  id: 'image',
  label: 'Images',
  category: 'image',
  sourceExtensions,
  targetFormats,
  canConvert: (file) =>
    (file.type.startsWith('image/') && file.type !== 'image/svg+xml') ||
    sourceExtensions.includes(getExtension(file.name)),
  convert,
};
