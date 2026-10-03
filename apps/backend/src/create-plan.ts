import { readFile } from 'node:fs/promises';

import {
  geminiOutputSchema,
  parsePlanInput,
  parsePlanOutput,
  type PlanInput,
  type PlanOutput,
} from '@hackyeah/contracts/plan';
import { PLAN_GENERATION_CONFIG } from './plan-config.js';

export class PlanGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlanGenerationError';
  }
}

function fail(code: string, message: string): never {
  throw new PlanGenerationError(code, message);
}

export interface PlanOptions {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  /** Application-specific activity/equipment/swimming review before persistence. */
  reviewContent?: (plan: PlanOutput, input: PlanInput) => Promise<void>;
}

/** Server-side provider adapter. Does not save or replace an active plan. */
export async function createPlan(
  value: unknown,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL,
    fetchImpl = globalThis.fetch,
    now = Date.now(),
    reviewContent,
  }: PlanOptions = {},
): Promise<PlanOutput> {
  const preferences = parsePlanInput(value);
  if (!Number.isFinite(new Date(now).getTime()))
    fail('CONFIGURATION', 'now must be a valid timestamp.');
  if (!preferences.available_slots.length) return { events: [] };
  let serialized;
  try {
    serialized = JSON.stringify(preferences, (_key, value) => {
      if (
        value === undefined ||
        typeof value === 'function' ||
        typeof value === 'symbol' ||
        (typeof value === 'number' && !Number.isFinite(value))
      )
        throw new Error('Not JSON');
      return value;
    });
  } catch {
    fail('INVALID_PREFERENCES', 'Preferences must contain serializable JSON values.');
  }
  if (!serialized || serialized === 'null' || Buffer.byteLength(serialized) > 64_000) {
    fail('INVALID_PREFERENCES', 'Preferences must be JSON and at most 64 KB.');
  }
  if (typeof apiKey !== 'string' || !apiKey.trim())
    fail('CONFIGURATION', 'Set GEMINI_API_KEY on the server.');
  if (typeof model !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(model))
    fail('CONFIGURATION', 'Set GEMINI_MODEL to a model ID from AI Studio (without models/).');
  let systemPrompt;
  try {
    systemPrompt = await readFile(PLAN_GENERATION_CONFIG.systemPromptFile, 'utf8');
  } catch {
    fail('CONFIGURATION', 'Cannot read the bundled planning system prompt.');
  }
  if (!systemPrompt.trim()) fail('CONFIGURATION', 'The system prompt file must not be empty.');

  let response;
  let payload:
    | {
        promptFeedback?: { blockReason?: string };
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
      }
    | undefined;
  const signal = AbortSignal.timeout(PLAN_GENERATION_CONFIG.timeoutMs);
  try {
    response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `${systemPrompt}\nCurrent time: ${new Date(now).toISOString()}. Do not repeat onboarding.`,
              },
            ],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: `Create a movement plan from this validated input:\n${serialized}` }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: geminiOutputSchema,
            maxOutputTokens: PLAN_GENERATION_CONFIG.maxOutputTokens,
            candidateCount: 1,
          },
        }),
      },
    );
    if (response.ok) payload = await response.json();
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    )
      fail('TIMEOUT', 'Plan generation timed out. Try again.');
    if (error instanceof SyntaxError)
      fail('INVALID_RESPONSE', 'Gemini returned an invalid response.');
    fail('NETWORK', 'Could not reach Gemini. Check the connection and try again.');
  }
  // Do not expose provider response bodies: they may contain submitted preferences.
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      fail('AUTHENTICATION', 'Gemini rejected the API key or project permissions.');
    if (response.status === 402)
      fail(
        'BILLING',
        'Gemini requires billing or available credits. Check the project billing in Google AI Studio.',
      );
    if (response.status === 429)
      fail('RATE_LIMIT', 'Gemini quota or rate limit reached. Try again later.');
    fail(
      'PROVIDER',
      `Gemini request failed (HTTP ${response.status}). Check the model and project configuration.`,
    );
  }
  if (payload?.promptFeedback?.blockReason) fail('BLOCKED', 'Gemini blocked this plan request.');
  const candidate = payload?.candidates?.[0];
  if (!candidate) fail('INVALID_RESPONSE', 'Gemini did not return a plan.');
  if (candidate.finishReason !== 'STOP')
    fail('INCOMPLETE', 'Gemini did not complete the plan. Try again or simplify the preferences.');
  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) fail('INVALID_RESPONSE', 'Gemini returned no plan content.');
  const text = parts
    .filter((part) => part && !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    fail('INVALID_RESPONSE', 'Gemini returned invalid plan JSON.');
  }
  const validated = parsePlanOutput(plan, preferences, now);
  if (reviewContent) await reviewContent(validated, preferences);
  return validated;
}
