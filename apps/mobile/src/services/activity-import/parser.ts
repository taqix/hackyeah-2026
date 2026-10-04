import { parseFit } from './fit';
import { parseGpx } from './gpx';
import { ActivityImportError, type ActivityFileFormat, type ActivityImport } from './types';

export const MAX_ACTIVITY_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ACTIVITY_SAMPLES = 100_000;

export function activityFileFormat(fileName: string): ActivityFileFormat {
  const extension = fileName.trim().match(/\.(fit|gpx)$/i)?.[1].toLowerCase();
  if (extension !== 'fit' && extension !== 'gpx') {
    throw new ActivityImportError('unsupported-format', 'Choose a .fit or .gpx file.');
  }
  return extension;
}

/** Pure parser. No device access, network calls, persistence or Expo imports. */
export function parseActivityFile(input: { fileName: string; bytes: Uint8Array }): ActivityImport {
  const { fileName, bytes } = input;
  const format = activityFileFormat(fileName);
  if (bytes.byteLength > MAX_ACTIVITY_FILE_BYTES) {
    throw new ActivityImportError('file-too-large', 'Activity files must be at most 10 MiB.');
  }
  if (bytes.byteLength === 0) throw new ActivityImportError('invalid-file', 'The activity file is empty.');
  try {
    const activities = format === 'fit'
      ? parseFit(bytes, MAX_ACTIVITY_SAMPLES)
      : parseGpx(new TextDecoder('utf-8', { fatal: true }).decode(bytes), MAX_ACTIVITY_SAMPLES);
    if (!activities.length) {
      throw new ActivityImportError('no-activities', 'The file contains no activity samples, sessions or routes.');
    }
    return { source: { fileName, format, sizeBytes: bytes.byteLength }, activities };
  } catch (error) {
    if (error instanceof ActivityImportError) throw error;
    throw new ActivityImportError('invalid-file', `The ${format.toUpperCase()} file could not be parsed.`, { cause: error });
  }
}
