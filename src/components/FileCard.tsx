import type { EngineStatus } from '../converters/audio';
import type { QueueItem } from '../types';
import { formatBytes } from '../lib/format';

const CATEGORY_ICON: Record<string, string> = {
  image: '🖼️',
  audio: '🎵',
  document: '📄',
};

interface Props {
  item: QueueItem;
  unsupportedFormats: Set<string>;
  engineStatus: EngineStatus;
  onTargetChange: (id: string, format: string) => void;
  onQualityChange: (id: string, quality: number) => void;
  onConvert: (id: string) => void;
  onRemove: (id: string) => void;
}

export function FileCard({
  item,
  unsupportedFormats,
  engineStatus,
  onTargetChange,
  onQualityChange,
  onConvert,
  onRemove,
}: Props) {
  const selectedTarget = item.converter.targetFormats.find((t) => t.format === item.targetFormat);
  const converting = item.status === 'converting';

  const sizeDelta =
    item.result != null && item.file.size > 0
      ? Math.round(((item.result.size - item.file.size) / item.file.size) * 100)
      : null;

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {CATEGORY_ICON[item.converter.category] ?? '📄'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-xs text-slate-400">
            {formatBytes(item.file.size)} · {item.converter.label}
          </p>
        </div>

        <select
          value={item.targetFormat}
          disabled={converting}
          onChange={(e) => onTargetChange(item.id, e.target.value)}
          aria-label="Target format"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none disabled:opacity-50"
        >
          {item.converter.targetFormats.map((t) => {
            const unsupported = unsupportedFormats.has(t.format);
            return (
              <option key={t.format} value={t.format} disabled={unsupported}>
                {t.label}
                {unsupported ? ' - not supported by this browser' : ''}
              </option>
            );
          })}
        </select>

        {selectedTarget?.lossy && (
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Quality {Math.round(item.quality * 100)}%
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={item.quality}
              disabled={converting}
              onChange={(e) => onQualityChange(item.id, Number(e.target.value))}
              className="w-24 accent-indigo-400"
            />
          </label>
        )}

        <button
          onClick={() => onConvert(item.id)}
          disabled={converting}
          className="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {converting ? 'Converting...' : item.status === 'done' ? 'Convert again' : 'Convert'}
        </button>

        <button
          onClick={() => onRemove(item.id)}
          disabled={converting}
          aria-label="Remove from queue"
          className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
        >
          ✕
        </button>
      </div>

      {converting && (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${item.progress}%` }}
            />
          </div>
          {item.converter.category === 'audio' && engineStatus === 'loading' && (
            <p className="mt-2 text-xs text-amber-300">
              First run: downloading the ffmpeg engine (~31 MB; future runs use the browser cache)...
            </p>
          )}
        </div>
      )}

      {item.status === 'done' && item.result && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-slate-800/60 px-3 py-2.5 text-sm">
          <span className="text-slate-300">
            {formatBytes(item.file.size)} → <strong className="text-slate-100">{formatBytes(item.result.size)}</strong>
          </span>
          {sizeDelta != null && (
            <span className={sizeDelta <= 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {sizeDelta <= 0 ? '−' : '+'}
              {Math.abs(sizeDelta)}%
            </span>
          )}
          {item.durationMs != null && (
            <span className="text-slate-500">{(item.durationMs / 1000).toFixed(1)} s</span>
          )}
          <a
            href={item.result.url}
            download={item.result.fileName}
            className="ml-auto rounded-lg bg-emerald-500/90 px-3 py-1.5 font-medium text-white hover:bg-emerald-400"
          >
            ⬇ Download {item.result.fileName}
          </a>
        </div>
      )}

      {item.status === 'error' && item.error && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {item.error}
        </p>
      )}
    </li>
  );
}
