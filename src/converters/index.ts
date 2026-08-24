import { imageConverter } from './image';
import { audioConverter } from './audio';
import { documentConverter } from './document';
import type { Converter } from './types';

/** All registered converters. A new format means a new module plus one line here. */
export const converters: Converter[] = [imageConverter, audioConverter, documentConverter];

export function findConverter(file: File): Converter | undefined {
  return converters.find((c) => c.canConvert(file));
}

export type { Category, ConversionInput, ConversionOutput, Converter, TargetFormat } from './types';
