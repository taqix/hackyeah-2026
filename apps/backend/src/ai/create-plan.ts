import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import {
  buildGeminiOutputSchema,
  parsePlanInput,
  parsePlanOutput,
  PlanValidationError,
  type PlanInput,
  type PlanOutput,
} from "@hackyeah/contracts/plan";
import { PLAN_GENERATION_CONFIG } from "./plan-config.js";

export const PROMPT_INJECTION_REFUSAL_MESSAGE =
  "I cannot fulfill this request. I can only help you schedule and adjust your beginner movement plan.";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /\b(?:reveal|show|dump|print)\s+(?:the\s+)?system\s+prompt\b/i,
  /\b(?:developer\s+mode|dan\s+mode|jailbreak)\b/i,
];

function isPromptInjection(text: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export class PlanGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PlanGenerationError";
  }
}

function fail(code: string, message: string): never {
  throw new PlanGenerationError(code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
export async function generatePlan(
  value: unknown,
  {
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL,
    fetchImpl = globalThis.fetch,
    now = Date.now(),
    reviewContent,
  }: PlanOptions = {},
): Promise<PlanOutput> {
  let serialized;
  try {
    serialized = JSON.stringify(value, (_key, value) => {
      if (
        value === undefined ||
        typeof value === "function" ||
        typeof value === "symbol" ||
        (typeof value === "number" && !Number.isFinite(value))
      )
        throw new Error("Not JSON");
      return value;
    });
  } catch {
    fail(
      "INVALID_INPUT",
      "The planning request must contain serializable JSON values.",
    );
  }
  if (!serialized || serialized === "null")
    fail(
      "INVALID_INPUT",
      "The planning request must contain serializable JSON.",
    );
  if (Buffer.byteLength(serialized) > PLAN_GENERATION_CONFIG.maxRequestBytes)
    fail(
      "INPUT_TOO_LARGE",
      "The complete planning context exceeds the request size limit. Conversation was not truncated.",
    );
  const preferences = parsePlanInput(value);
  if (!Number.isFinite(new Date(now).getTime()))
    fail("CONFIGURATION", "now must be a valid timestamp.");
  if (preferences.mode === "create" && !preferences.available_slots.length)
    return { events: [], message: null };
  if (
    preferences.mode === "modify" &&
    typeof preferences.user_prompt === "string" &&
    isPromptInjection(preferences.user_prompt)
  )
    return { events: [], message: PROMPT_INJECTION_REFUSAL_MESSAGE };
  if (typeof apiKey !== "string" || !apiKey.trim())
    fail("CONFIGURATION", "Set GEMINI_API_KEY on the server.");
  if (typeof model !== "string" || !/^[a-zA-Z0-9._-]+$/.test(model))
    fail(
      "CONFIGURATION",
      "Set GEMINI_MODEL to a model ID from AI Studio (without models/).",
    );
  let systemPrompt;
  try {
    systemPrompt = await readFile(
      PLAN_GENERATION_CONFIG.systemPromptFile,
      "utf8",
    );
  } catch {
    fail("CONFIGURATION", "Cannot read the bundled planning system prompt.");
  }
  if (!systemPrompt.trim())
    fail("CONFIGURATION", "The system prompt file must not be empty.");

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text: `${systemPrompt}\nCurrent time: ${new Date(now).toISOString()}. Do not repeat onboarding.`,
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Process this validated ${preferences.mode} workout planning request. The conversation contains all preceding messages; user_prompt is the newest message:\n${serialized}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: buildGeminiOutputSchema(preferences),
      maxOutputTokens: PLAN_GENERATION_CONFIG.maxOutputTokens,
      candidateCount: 1,
    },
    safetySettings: PLAN_GENERATION_CONFIG.safetySettings,
  });
  if (Buffer.byteLength(requestBody) > PLAN_GENERATION_CONFIG.maxRequestBytes)
    fail(
      "INPUT_TOO_LARGE",
      "The complete planning context and sport schema exceed the request size limit. Conversation was not truncated.",
    );

  let response;
  let payload: unknown;
  const deadline = performance.now() + PLAN_GENERATION_CONFIG.timeoutMs;
  const signal = AbortSignal.timeout(PLAN_GENERATION_CONFIG.timeoutMs);
  try {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          signal,
          body: requestBody,
        },
      );
      const retryable = [408, 429, 500, 502, 503, 504].includes(
        response.status,
      );
      if (!retryable || attempt >= PLAN_GENERATION_CONFIG.maxRetries) break;
      // Release the failed response without logging potentially private content.
      await response.body?.cancel();
      const backoff = PLAN_GENERATION_CONFIG.retryBaseDelayMs * 2 ** attempt;
      const retryAfter = response.headers.get("retry-after");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const requestedDelay = Number.isFinite(seconds)
        ? Math.max(0, seconds * 1000)
        : Math.max(0, Date.parse(retryAfter ?? "") - Date.now()) || 0;
      // Jitter spreads concurrent retries after a shared provider failure.
      const waitMs = Math.max(
        backoff * (0.5 + Math.random() * 0.5),
        requestedDelay,
      );
      // A retry cannot fit; reject before a large delay can overflow Node's timer.
      if (waitMs >= deadline - performance.now())
        throw new DOMException(
          "Retry exceeds generation deadline",
          "TimeoutError",
        );
      await delay(waitMs, undefined, { signal });
    }
    if (response.ok) payload = await response.json();
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError"))
    )
      fail("TIMEOUT", "Plan generation timed out. Try again.");
    if (error instanceof SyntaxError)
      fail("INVALID_RESPONSE", "Gemini returned an invalid response.");
    fail(
      "NETWORK",
      "Could not reach Gemini. Check the connection and try again.",
    );
  }
  // Do not expose provider response bodies: they may contain submitted preferences.
  if (!response.ok) {
    if ([401, 403].includes(response.status))
      fail(
        "AUTHENTICATION",
        "Gemini rejected the API key or project permissions.",
      );
    if (response.status === 402)
      fail(
        "BILLING",
        "Gemini requires billing or available credits. Check the project billing in Google AI Studio.",
      );
    if (response.status === 429)
      fail(
        "RATE_LIMIT",
        "Gemini quota or rate limit reached. Try again later.",
      );
    fail(
      "PROVIDER",
      `Gemini request failed (HTTP ${response.status}). Check the model and project configuration.`,
    );
  }
  const envelope = isRecord(payload) ? payload : undefined;
  if (
    isRecord(envelope?.promptFeedback) &&
    envelope.promptFeedback.blockReason
  ) {
    if (preferences.mode === "modify")
      return { events: [], message: PROMPT_INJECTION_REFUSAL_MESSAGE };
    fail("BLOCKED", "Gemini blocked this plan request.");
  }
  const candidate = Array.isArray(envelope?.candidates)
    ? envelope.candidates[0]
    : undefined;
  if (!isRecord(candidate))
    fail("INVALID_RESPONSE", "Gemini did not return a plan.");
  if (candidate.finishReason === "SAFETY") {
    if (preferences.mode === "modify")
      return { events: [], message: PROMPT_INJECTION_REFUSAL_MESSAGE };
    fail("BLOCKED", "Gemini blocked this plan content due to safety policy.");
  }
  if (candidate.finishReason !== "STOP")
    fail(
      "INCOMPLETE",
      "Gemini did not complete the plan. Try again or simplify the preferences.",
    );
  const parts = isRecord(candidate.content)
    ? candidate.content.parts
    : undefined;
  if (!Array.isArray(parts))
    fail("INVALID_RESPONSE", "Gemini returned no plan content.");
  const text = parts
    .filter(
      (part): part is Record<string, unknown> =>
        isRecord(part) && !part.thought && typeof part.text === "string",
    )
    .map((part) => part.text)
    .join("");
  let plan;
  try {
    plan = JSON.parse(text);
  } catch {
    fail("INVALID_RESPONSE", "Gemini returned invalid plan JSON.");
  }
  let validated;
  try {
    validated = parsePlanOutput(plan, preferences, now);
  } catch (error) {
    if (
      preferences.mode === "modify" &&
      error instanceof PlanValidationError &&
      (error.message.includes("must not contain URLs or web links") ||
        error.message.includes("must not contain HTML tags") ||
        error.message.includes("must not contain markdown links"))
    ) {
      return { events: [], message: PROMPT_INJECTION_REFUSAL_MESSAGE };
    }
    throw error;
  }
  if (reviewContent) await reviewContent(validated, preferences);
  return validated;
}

/** Compatibility entry point; both modes use generatePlan. */
export const createPlan = generatePlan;
