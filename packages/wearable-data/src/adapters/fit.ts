import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import {
  identifierSchema,
  instantSchema,
  sourceEventSchema,
  type SourceEventV1,
} from '@hackyeah/contracts/wearables';
import { parse, WearableError } from '../errors.js';

export const fitImportSchema = z.strictObject({
  connection_id: identifierSchema,
  connection_generation: z.number().int().positive(),
  provider: z.enum(['garmin', 'coros']),
  import_id: identifierSchema.max(100),
  observed_at: instantSchema,
});
export type FitImport = z.infer<typeof fitImportSchema>;

/** Summary-only manual import. No raw files, routes, sensor series or account identities are retained. */
export async function importActivityFit(
  bytes: Uint8Array,
  input: FitImport,
): Promise<SourceEventV1[]> {
  const context = parse(fitImportSchema, input);
  if (bytes.byteLength > 10 * 1024 * 1024) throw new WearableError('too_large');
  if (bytes.byteLength < 14) throw new WearableError('invalid_file');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fit-worker.js', import.meta.url), {
      workerData: { bytes: Uint8Array.from(bytes), context },
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new WearableError('invalid_file'));
    }, 10000);
    const finish = () => {
      clearTimeout(timer);
      void worker.terminate();
    };
    worker.once('message', (message: unknown) => {
      finish();
      const parsed = z.array(sourceEventSchema).min(1).max(100).safeParse(message);
      if (parsed.success) resolve(parsed.data);
      else reject(new WearableError('invalid_file'));
    });
    worker.once('error', () => {
      finish();
      reject(new WearableError('invalid_file'));
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(new WearableError('invalid_file'));
    });
  });
}
