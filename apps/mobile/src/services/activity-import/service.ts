import { activityFileFormat, MAX_ACTIVITY_FILE_BYTES, parseActivityFile } from './parser';
import { ActivityImportError, type ActivityImportResult, type ActivityImportService, type PickedActivityFile } from './types';

export type { PickedActivityFile } from './types';

export interface ActivityFilePicker {
  /** null means cancelled. Selecting a document is the per-file access grant. */
  pick(): Promise<PickedActivityFile | null>;
}

export function createActivityImportService(picker: ActivityFilePicker): ActivityImportService {
  let busy = false;

  /** One import at a time, whether the file came from the picker or was handed over. */
  async function importFrom(select: () => Promise<PickedActivityFile | null>): Promise<ActivityImportResult> {
    if (busy) throw new ActivityImportError('busy', 'An activity import is already in progress.');
    busy = true;
    let file: PickedActivityFile | null = null;
    try {
      try {
        file = await select();
      } catch (error) {
        throw new ActivityImportError('picker-failed', 'The document picker could not open the file.', { cause: error });
      }
      if (!file) return { status: 'cancelled' };
      activityFileFormat(file.name);
      let bytes: Uint8Array;
      try {
        const size = file.sizeBytes;
        if (size !== null && size > MAX_ACTIVITY_FILE_BYTES) {
          throw new ActivityImportError('file-too-large', 'Activity files must be at most 10 MiB.');
        }
        bytes = await file.readBytes();
      } catch (error) {
        if (error instanceof ActivityImportError) throw error;
        throw new ActivityImportError('read-failed', 'The selected file is unreadable. Try selecting it again.', { cause: error });
      }
      return { status: 'imported', data: parseActivityFile({ fileName: file.name, bytes }) };
    } finally {
      try {
        await file?.dispose();
      } catch {
        // Cache cleanup must not hide a parse/read failure or a successful import.
        // The OS may also evict this temporary copy.
      } finally {
        busy = false;
      }
    }
  }

  return {
    pickAndImport: () => importFrom(() => picker.pick()),
    importFile: (file) => importFrom(async () => file),
  };
}
