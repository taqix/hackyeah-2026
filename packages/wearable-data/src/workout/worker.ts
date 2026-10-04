import { parentPort, workerData } from 'node:worker_threads';
import { extractSummary } from './extract.js';
import { ExtractionError } from './types.js';

try {
  parentPort?.postMessage({ result: extractSummary(workerData.bytes, workerData.config) });
} catch (error) {
  // Never expose raw XML, GPS/device data, SDK errors or parser stack traces.
  parentPort?.postMessage({
    error:
      error instanceof ExtractionError
        ? { code: error.code, message: error.message }
        : { code: 'invalid_file', message: 'File could not be summarized.' },
  });
}
