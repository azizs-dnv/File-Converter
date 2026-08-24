import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { baseName, getExtension } from './types';
import type { ConversionInput, ConversionOutput, Converter, TargetFormat } from './types';

// The ffmpeg core is single-threaded, so it works without SharedArrayBuffer or special CORS headers.
// It is loaded from the CDN only during the first audio conversion and cached by the browser afterward.
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

const targetFormats: TargetFormat[] = [
  { format: 'mp3', label: 'MP3', mimeType: 'audio/mpeg', lossy: true },
  { format: 'wav', label: 'WAV', mimeType: 'audio/wav' },
  { format: 'ogg', label: 'OGG', mimeType: 'audio/ogg', lossy: true },
];

const sourceExtensions = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus', 'wma', 'aiff'];

export type EngineStatus = 'idle' | 'loading' | 'ready';

let ffmpeg: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let engineStatus: EngineStatus = 'idle';
const statusListeners = new Set<(status: EngineStatus) => void>();

function setStatus(next: EngineStatus) {
  engineStatus = next;
  statusListeners.forEach((listener) => listener(next));
}

export function getEngineStatus(): EngineStatus {
  return engineStatus;
}

/** Subscribe to engine status; the UI displays the ffmpeg loading state. */
export function onEngineStatus(listener: (status: EngineStatus) => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function loadEngine(): Promise<FFmpeg> {
  if (ffmpeg) return Promise.resolve(ffmpeg);
  if (loadPromise) return loadPromise;
  setStatus('loading');
  loadPromise = (async () => {
    const instance = new FFmpeg();
    const coreURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
    await instance.load({ coreURL, wasmURL });
    ffmpeg = instance;
    setStatus('ready');
    return instance;
  })().catch((err) => {
    loadPromise = null;
    setStatus('idle');
    throw err;
  });
  return loadPromise;
}

/** 0.1–1.0 → 64–320 kbps */
function bitrateFromQuality(q: number): string {
  const kbps = Math.min(320, Math.max(64, Math.round(64 + q * 256)));
  return `${kbps}k`;
}

/** 0.1-1.0 -> libvorbis quality scale 1-10. */
function vorbisQuality(q: number): string {
  return String(Math.min(10, Math.max(1, Math.round(q * 8))));
}

function buildArgs(input: string, output: string, target: TargetFormat, quality: number): string[] {
  switch (target.format) {
    case 'mp3':
      return ['-i', input, '-codec:a', 'libmp3lame', '-b:a', bitrateFromQuality(quality), output];
    case 'ogg':
      return ['-i', input, '-codec:a', 'libvorbis', '-q:a', vorbisQuality(quality), output];
    case 'wav':
      return ['-i', input, '-codec:a', 'pcm_s16le', output];
    default:
      return ['-i', input, output];
  }
}

async function convert({ file, targetFormat, quality, onProgress }: ConversionInput): Promise<ConversionOutput> {
  let engine: FFmpeg;
  try {
    onProgress?.(2);
    engine = await loadEngine();
  } catch {
    throw new Error('Could not load the ffmpeg engine (internet is required on the first run). Check your connection and try again.');
  }

  const inputName = `input.${getExtension(file.name) || 'bin'}`;
  const outputName = `output.${targetFormat.format}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    const clamped = Math.min(1, Math.max(0, progress));
    onProgress?.(Math.round(clamped * 100));
  };
  engine.on('progress', progressHandler);

  try {
    await engine.writeFile(inputName, await fetchFile(file));
    const exitCode = await engine.exec(buildArgs(inputName, outputName, targetFormat, quality));
    if (exitCode !== 0) {
      throw new Error(`ffmpeg exited with an error (code ${exitCode}). The file may be corrupted or the format may be unsupported.`);
    }
    const data = await engine.readFile(outputName);
    onProgress?.(100);
    // slice() copies bytes from WASM memory and returns Uint8Array<ArrayBuffer>, which Blob accepts.
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data.slice();
    const blob = new Blob([bytes], { type: targetFormat.mimeType });
    return { blob, fileName: `${baseName(file.name)}.${targetFormat.format}` };
  } finally {
    engine.off('progress', progressHandler);
    // Clean up the virtual file system.
    void engine.deleteFile(inputName).catch(() => undefined);
    void engine.deleteFile(outputName).catch(() => undefined);
  }
}

export const audioConverter: Converter = {
  id: 'audio',
  label: 'Audio',
  category: 'audio',
  sourceExtensions,
  targetFormats,
  canConvert: (file) => file.type.startsWith('audio/') || sourceExtensions.includes(getExtension(file.name)),
  convert,
};
