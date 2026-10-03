import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { MAX_ACTIVITY_FILE_BYTES } from '../../src/services/activity-import/parser';
import { createActivityImportService, type PickedActivityFile } from '../../src/services/activity-import/service';

const bytes = readFileSync(new URL('./fixtures/run.gpx', import.meta.url));

function selected(overrides: Partial<PickedActivityFile> = {}) {
  let reads = 0;
  let disposals = 0;
  const file: PickedActivityFile = {
    name: 'run.gpx', sizeBytes: bytes.length,
    async readBytes() { reads++; return bytes; },
    async dispose() { disposals++; },
    ...overrides,
  };
  return { file, reads: () => reads, disposals: () => disposals };
}

test('picker access, read, parse and cleanup return normalized activities', async () => {
  const fake = selected();
  const service = createActivityImportService({ async pick() { return fake.file; } });
  const result = await service.pickAndImport();
  assert.equal(result.status, 'imported');
  if (result.status === 'imported') assert.equal(result.data.activities[0].name, 'Bieg & spacer');
  assert.equal(fake.reads(), 1);
  assert.equal(fake.disposals(), 1);
});

test('cancel is a normal outcome and another selection is allowed', async () => {
  const service = createActivityImportService({ async pick() { return null; } });
  assert.deepEqual(await service.pickAndImport(), { status: 'cancelled' });
  assert.deepEqual(await service.pickAndImport(), { status: 'cancelled' });
});

test('invalid extension and oversized metadata are rejected before reading, with cleanup', async () => {
  for (const [overrides, code] of [
    [{ name: 'archive.zip' }, 'unsupported-format'],
    [{ sizeBytes: MAX_ACTIVITY_FILE_BYTES + 1 }, 'file-too-large'],
  ] as const) {
    const fake = selected(overrides);
    const service = createActivityImportService({ async pick() { return fake.file; } });
    await assert.rejects(service.pickAndImport(), { code });
    assert.equal(fake.reads(), 0);
    assert.equal(fake.disposals(), 1);
  }
});

test('unknown or incorrect size metadata cannot bypass the byte limit', async () => {
  for (const sizeBytes of [null, 1]) {
    const fake = selected({ sizeBytes, async readBytes() { return new Uint8Array(MAX_ACTIVITY_FILE_BYTES + 1); } });
    const service = createActivityImportService({ async pick() { return fake.file; } });
    await assert.rejects(service.pickAndImport(), { code: 'file-too-large' });
    assert.equal(fake.disposals(), 1);
  }
});

test('picker failure releases the busy guard and allows retry', async () => {
  let attempts = 0;
  const service = createActivityImportService({ async pick() {
    if (++attempts === 1) throw new Error('provider unavailable');
    return null;
  } });
  await assert.rejects(service.pickAndImport(), { code: 'picker-failed' });
  assert.deepEqual(await service.pickAndImport(), { status: 'cancelled' });
});

test('lost file access and corrupt contents are typed errors and always clean up', async () => {
  for (const [readBytes, code] of [
    [async () => { throw new Error('permission denied'); }, 'read-failed'],
    [async () => new Uint8Array(), 'invalid-file'],
  ] as const) {
    const fake = selected({ readBytes });
    const service = createActivityImportService({ async pick() { return fake.file; } });
    await assert.rejects(service.pickAndImport(), { code });
    assert.equal(fake.disposals(), 1);
  }
});

test('concurrent calls cannot open two pickers', async () => {
  let release!: (file: null) => void;
  const service = createActivityImportService({ pick: () => new Promise((resolve) => { release = resolve; }) });
  const first = service.pickAndImport();
  await assert.rejects(service.pickAndImport(), { code: 'busy' });
  release(null);
  assert.deepEqual(await first, { status: 'cancelled' });
});

test('failed file metadata access is a read error and still cleans up', async () => {
  const fake = selected();
  Object.defineProperty(fake.file, 'sizeBytes', { get() { throw new Error('file access lost'); } });
  const service = createActivityImportService({ async pick() { return fake.file; } });
  await assert.rejects(service.pickAndImport(), { code: 'read-failed' });
  assert.equal(fake.disposals(), 1);
});

test('cleanup failure preserves the result or original parse error and permits retries', async () => {
  const fake = selected({ async dispose() { throw new Error('cache removed by OS'); } });
  const service = createActivityImportService({ async pick() { return fake.file; } });
  assert.equal((await service.pickAndImport()).status, 'imported');
  fake.file.readBytes = async () => new Uint8Array();
  await assert.rejects(service.pickAndImport(), { code: 'invalid-file' });
});
