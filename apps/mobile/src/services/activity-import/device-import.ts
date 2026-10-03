import * as DocumentPicker from 'expo-document-picker';

import { createActivityImportService } from './service';

/** Web fallback; Metro selects device-import.native.ts on iOS/Android. */
export const activityImport = createActivityImportService({
  async pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, base64: false });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset?.file) throw new Error('The browser did not provide the selected File.');
    const file = asset.file;
    return {
      name: asset.name,
      sizeBytes: file.size,
      readBytes: async () => new Uint8Array(await file.arrayBuffer()),
      async dispose() { URL.revokeObjectURL(asset.uri); },
    };
  },
});
