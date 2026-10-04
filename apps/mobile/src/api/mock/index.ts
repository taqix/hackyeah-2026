/**
 * The in-memory mock backend: seeded catalog, the demo persona, a mock planner
 * and coach, latency and demo failure switches. Screens never import this;
 * they use `@/api/hooks` (the Demo controls screen uses `@/api/mock/demo`).
 */
export { createMockApiClient } from './client';
export { demo, useDemoSettings, type DemoSettings } from './demo';
export { DEMO_EMAIL, DEMO_PASSWORD } from './seed';
export { WRONG_PASSWORD } from './backend';
