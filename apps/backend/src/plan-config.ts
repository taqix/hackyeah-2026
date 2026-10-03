export const PLAN_GENERATION_CONFIG = Object.freeze({
  systemPromptFile: new URL('../prompts/plan-system.txt', import.meta.url),
  timeoutMs: 60_000,
  maxOutputTokens: 8192,
});
