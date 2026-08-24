/** File category, which determines the conversion engine and UI icon. */
export type Category = 'image' | 'audio' | 'document';

/** A format supported by the converter. */
export interface TargetFormat {
  /** Extension without a dot, such as 'png', used in the output file name. */
  format: string;
  /** Human-readable name for the UI. */
  label: string;
  mimeType: string;
  /** Lossy format, which enables the quality slider in the UI. */
  lossy?: boolean;
}

export interface ConversionInput {
  file: File;
  targetFormat: TargetFormat;
  /** 0.1-1.0, applied only to lossy formats. */
  quality: number;
  onProgress?: (percent: number) => void;
}

export interface ConversionOutput {
  blob: Blob;
  /** Final file name (base name plus the new extension). */
  fileName: string;
}

/**
 * Converter contract: implement this interface and add the module to
 * converters/index.ts; the UI will pick up new formats automatically.
 */
export interface Converter {
  id: string;
  label: string;
  category: Category;
  /** Accepted extensions without a dot, in lowercase. */
  sourceExtensions: string[];
  targetFormats: TargetFormat[];
  canConvert(file: File): boolean;
  convert(input: ConversionInput): Promise<ConversionOutput>;
}

export function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx + 1).toLowerCase();
}

export function baseName(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? fileName : fileName.slice(0, idx);
}
