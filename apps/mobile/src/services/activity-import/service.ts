import { activityFileFormat, MAX_ACTIVITY_FILE_BYTES, parseActivityFile } from './parser';
import { ActivityImportError, type ActivityImportService } from './types';

/** The driver owns the temporary copy; dispose must never delete the original. */
export interface PickedActivityFile {
  name: string;
  sizeBytes: number | null;
  readBytes(): Promise<Uint8Array>;
  dispose(): Promise<void>;
}

export interface ActivityFilePicker {
  /** null means cancelled. Selecting a document is the per-file access grant. */
  pick(): Promise<PickedActivityFile | null>;
}

export function createActivityImportService(picker: ActivityFilePicker): ActivityImportService {
  let busy = false;
  return {
    async pickAndImport() {
      if (busy) throw new ActivityImportError('busy', 'An activity import is already in progress.');
      busy = true;
      let file: PickedActivityFile | null = null;
      try {
        try {
          file = await picker.pick();
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
    },
  };
}
