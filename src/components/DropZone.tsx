import { useRef, useState } from 'react';
import type { DragEvent } from 'react';

const ACCEPT = 'image/*,audio/*,.md,.markdown,.txt,.html,.htm';

interface Props {
  onFiles: (files: File[]) => void;
}

export function DropZone({ onFiles }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dragleave also fires when entering child elements, so check relatedTarget.
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload files"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={handleDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
        dragActive
          ? 'border-indigo-400 bg-indigo-500/10'
          : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-900'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      <div className="text-4xl" aria-hidden>
        📥
      </div>
      <div>
        <p className="text-lg font-semibold">Drop files here</p>
        <p className="mt-1 text-sm text-slate-400">or click to choose files manually</p>
      </div>
      <p className="max-w-md text-xs leading-relaxed text-slate-500">
        Images: PNG, JPG, WEBP, AVIF, GIF, BMP · Audio: MP3, WAV, OGG, M4A, FLAC... · Documents: MD, HTML, TXT
      </p>
    </div>
  );
}
