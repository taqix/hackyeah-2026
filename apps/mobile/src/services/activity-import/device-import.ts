import * as DocumentPicker from 'expo-document-picker';

import { browserFile } from './browser-file';
import { createActivityImportService } from './service';

/** Web: the browser's file dialog gives a File, read in memory. Metro selects device-import.native.ts on iOS/Android. */
export const activityImport = createActivityImportService({
  async pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, base64: false });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.file) throw new Error('The browser did not provide the selected File.');
    return browserFile(asset.file, () => URL.revokeObjectURL(asset.uri));
  },
});
