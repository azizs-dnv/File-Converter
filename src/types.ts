import type { Converter } from './converters/types';

export type ItemStatus = 'ready' | 'converting' | 'done' | 'error';

export interface ConversionResult {
  /** Object URL for downloading; revoked on removal or reconversion. */
  url: string;
  fileName: string;
  size: number;
}

export interface QueueItem {
  id: string;
  file: File;
  converter: Converter;
  /** Selected target format (an id from converter.targetFormats). */
  targetFormat: string;
  quality: number;
  status: ItemStatus;
  progress: number;
  error?: string;
  durationMs?: number;
  result?: ConversionResult;
}
