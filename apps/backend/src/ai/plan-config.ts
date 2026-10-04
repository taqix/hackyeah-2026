export const PLAN_GENERATION_CONFIG = Object.freeze({
  systemPromptFile: new URL("./prompts/plan-system.txt", import.meta.url),
  timeoutMs: 60_000,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  maxOutputTokens: 8192,
  /** Includes the entire conversation and generated sport schema; never truncate. */
  maxRequestBytes: 2_000_000,
  safetySettings: Object.freeze([
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ]),
});
