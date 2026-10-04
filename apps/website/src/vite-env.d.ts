/// <reference types="vite/client" />

/* The build-time settings the site reads, from the environment or apps/website/.env.local.
   Strict, so a misspelt name is a type error rather than undefined. */
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  /** Where the app's web build is served; see src/appLinks.ts. */
  readonly VITE_APP_URL?: string;
}
