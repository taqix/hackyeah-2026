import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { browserFile } from '../../src/services/activity-import/browser-file';
import { createActivityImportService } from '../../src/services/activity-import/service';

const gpx = readFileSync(new URL('./fixtures/run.gpx', import.meta.url));

test('a File from the browser picker is read in memory, parsed and its object URL released', async () => {
  let released = 0;
  const file = new File([gpx], 'run.gpx', { type: 'application/gpx+xml' });
  const service = createActivityImportService({
    async pick() {
      return browserFile(file, () => released++);
    },
  });
  const result = await service.pickAndImport();
  assert.equal(result.status, 'imported');
  if (result.status === 'imported') {
    assert.equal(result.data.source.fileName, 'run.gpx');
    assert.equal(result.data.source.sizeBytes, gpx.byteLength);
    assert.equal(result.data.activities[0].name, 'Bieg & spacer');
    assert.equal(result.data.activities[0].elapsedTimeSeconds, 180);
  }
  assert.equal(released, 1);
});

test('a dropped file goes through the same checks without opening the picker', async () => {
  let picks = 0;
  const service = createActivityImportService({
    async pick() {
      picks++;
      return null;
    },
  });
  const result = await service.importFile(browserFile(new File([gpx], 'RUN.GPX')));
  assert.equal(result.status, 'imported');
  await assert.rejects(service.importFile(browserFile(new File(['plain text'], 'notes.txt'))), {
    code: 'unsupported-format',
  });
  await assert.rejects(service.importFile(browserFile(new File([], 'empty.gpx'))), { code: 'invalid-file' });
  assert.equal(picks, 0);
});

test('a drop while another file is still being read is refused, then allowed again', async () => {
  let release!: () => void;
  const slow = browserFile(new File([gpx], 'slow.gpx'));
  const service = createActivityImportService({ pick: async () => null });
  const first = service.importFile({
    ...slow,
    readBytes: () => new Promise((resolve) => (release = () => void slow.readBytes().then(resolve))),
  });
  await assert.rejects(service.importFile(browserFile(new File([gpx], 'second.gpx'))), { code: 'busy' });
  release();
  assert.equal((await first).status, 'imported');
  assert.equal((await service.importFile(browserFile(new File([gpx], 'third.gpx')))).status, 'imported');
});

test('browsers without Blob.arrayBuffer read the same bytes through FileReader', async () => {
  const original = (globalThis as { FileReader?: unknown }).FileReader;
  class FakeReader {
    result: ArrayBuffer | null = null;
    error: Error | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readAsArrayBuffer(blob: { bytes: Uint8Array }) {
      this.result = blob.bytes.buffer.slice(blob.bytes.byteOffset, blob.bytes.byteOffset + blob.bytes.byteLength) as ArrayBuffer;
      queueMicrotask(() => this.onload?.());
    }
  }
  (globalThis as { FileReader?: unknown }).FileReader = FakeReader;
  try {
    const legacy = { name: 'legacy.gpx', size: gpx.byteLength, bytes: new Uint8Array(gpx) } as unknown as Blob & { name: string };
    const service = createActivityImportService({ pick: async () => browserFile(legacy) });
    const result = await service.pickAndImport();
    assert.equal(result.status, 'imported');
    if (result.status === 'imported') assert.equal(result.data.activities[0].name, 'Bieg & spacer');
  } finally {
    (globalThis as { FileReader?: unknown }).FileReader = original;
  }
});
