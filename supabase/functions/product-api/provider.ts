import { ApiError } from './errors.ts';
import type { PlanGenerator } from './ports.ts';

// index.ts uses this adapter until GEMINI_API_KEY and GEMINI_MODEL are both set.
// It never fabricates a saved plan; success examples are synthetic fixtures.
export const unavailableGenerator: PlanGenerator = {
  async generate() {
    throw new ApiError('AI_NOT_CONFIGURED', 501, 'The AI provider is not connected yet.');
  },
  async chat() {
    throw new ApiError('AI_NOT_CONFIGURED', 501, 'The AI provider is not connected yet.');
  },
};
