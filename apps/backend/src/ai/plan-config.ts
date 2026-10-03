export const PLAN_GENERATION_CONFIG = Object.freeze({
  systemPromptFile: new URL("./prompts/plan-system.txt", import.meta.url),
  timeoutMs: 60_000,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  maxOutputTokens: 8192,
  /** Includes the entire conversation and generated sport schema; never truncate. */
  maxRequestBytes: 2_000_000,
});
