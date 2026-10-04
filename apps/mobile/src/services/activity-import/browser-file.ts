import type { PickedActivityFile } from './types';

/** Blob.arrayBuffer where the browser has it, FileReader in older ones. */
function readBlob(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('The browser could not read the file.'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * A file the browser handed over, picked or dropped: read in memory through
 * the Blob API, so the web needs no file system. `release` frees anything the
 * picker made for it (an object URL); the person's file is never touched.
 */
export function browserFile(file: Blob & { name: string }, release?: () => void): PickedActivityFile {
  return {
    name: file.name,
    sizeBytes: file.size,
    readBytes: () => readBlob(file),
    async dispose() {
      release?.();
    },
  };
}
