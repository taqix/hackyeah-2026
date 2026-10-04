import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { createActivityImportService } from './service';

export const activityImport = createActivityImportService({
  async pick() {
    // FIT MIME types differ by provider. Validate the extension and contents after selection.
    // The native document picker grants access; no storage, health or location permission is needed.
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) throw new Error('The document picker returned no file.');
    const file = new File(asset.uri);
    return {
      name: asset.name,
      get sizeBytes() { return file.size ?? asset.size ?? null; },
      readBytes: async () => new Uint8Array(await file.arrayBuffer()),
      async dispose() {
        // With copyToCacheDirectory this is the app-owned copy, never the user's document.
        if (file.exists) file.delete();
      },
    };
  },
});
