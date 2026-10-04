import { Worker } from 'node:worker_threads';
import { z } from 'zod';
import {
  workoutFileSummarySchema,
  type WorkoutFileSummary,
} from '@hackyeah/contracts/workout-file';
import { configuration } from './extract.js';
import { ExtractionError, type Config } from './types.js';

export {
  DEFAULT_CONFIG,
  ExtractionError,
  type Config as WorkoutExtractionConfig,
} from './types.js';
export type { WorkoutFileSummary, WorkoutFileMetric } from '@hackyeah/contracts/workout-file';

/** No connections or storage required. Only summaries cross the isolated worker boundary. */
export async function extractWorkoutSummary(
  bytes: Uint8Array,
  overrides: Partial<Config> = {},
): Promise<WorkoutFileSummary> {
  const config = configuration(overrides);
  if (!(bytes instanceof Uint8Array))
    throw new ExtractionError('invalid_input', 'Input must be a byte array.');
  if (!bytes.byteLength) throw new ExtractionError('empty_file', 'Input file is empty.');
  if (bytes.byteLength > config.maxFileBytes)
    throw new ExtractionError('file_size_limit', 'Input exceeds configured size limit.');
  const replySchema = z.union([
    z.strictObject({ result: workoutFileSummarySchema }),
    z.strictObject({ error: z.strictObject({ code: z.string(), message: z.string() }) }),
  ]);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
      workerData: { bytes: Uint8Array.from(bytes), config },
      resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new ExtractionError('parse_timeout', 'File parsing exceeded ten seconds.'));
    }, 10_000);
    worker.once('message', (message: unknown) => {
      if (settled) return;
      finish();
      const parsed = replySchema.safeParse(message);
      if (!parsed.success)
        reject(new ExtractionError('invalid_file', 'File could not be summarized.'));
      else if ('error' in parsed.data)
        reject(new ExtractionError(parsed.data.error.code, parsed.data.error.message));
      else resolve(parsed.data.result);
    });
    worker.once('error', () => {
      if (settled) return;
      finish();
      reject(new ExtractionError('invalid_file', 'File parser failed or exceeded memory limits.'));
    });
    worker.once('exit', () => {
      if (settled) return;
      finish();
      reject(new ExtractionError('invalid_file', 'File parser exited without a result.'));
    });
  });
}
