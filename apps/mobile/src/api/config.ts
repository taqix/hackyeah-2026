/**
 * Build-time backend configuration. Expo inlines only static
 * `process.env.EXPO_PUBLIC_*` references, so each variable is read by name
 * here and nowhere else. Copy `apps/mobile/.env.example` to `.env` to set them.
 */

export type ApiMode = 'supabase' | 'mock';

export interface ApiConfig {
  /** `supabase` (default): the real product API. `mock`: the offline demo backend. */
  mode: ApiMode;
  /** `https://<ref>.supabase.co`, without a trailing slash. Empty when missing. */
  supabaseUrl: string;
  /** The publishable (or legacy anon) key. Never a secret or service-role key. */
  publishableKey: string;
  /** The product API base URL, without a trailing slash. */
  productApiUrl: string;
  /** True when every variable the Supabase mode needs is set and valid. */
  configured: boolean;
  /** Names of variables that are missing or invalid, for the setup screen. */
  missing: string[];
}

const trimSlash = (value: string) => value.replace(/\/+$/, '');
const isHttpUrl = (value: string) => /^https?:\/\/[^\s/]+/i.test(value);

export function readApiConfig(env: {
  mode: string | undefined;
  supabaseUrl: string | undefined;
  publishableKey: string | undefined;
  productApiUrl: string | undefined;
}): ApiConfig {
  const missing: string[] = [];
  const rawMode = env.mode?.trim().toLowerCase() ?? '';
  if (rawMode !== '' && rawMode !== 'mock' && rawMode !== 'supabase') missing.push('EXPO_PUBLIC_API_MODE');
  const mode: ApiMode = rawMode === 'mock' ? 'mock' : 'supabase';

  const supabaseUrl = trimSlash(env.supabaseUrl?.trim() ?? '');
  if (!isHttpUrl(supabaseUrl)) missing.push('EXPO_PUBLIC_SUPABASE_URL');

  const publishableKey = env.publishableKey?.trim() ?? '';
  // A secret key must never ship in an app; treat it as missing rather than use it.
  if (!publishableKey || publishableKey.startsWith('sb_secret_')) missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

  const customApiUrl = trimSlash(env.productApiUrl?.trim() ?? '');
  if (customApiUrl && !isHttpUrl(customApiUrl)) missing.push('EXPO_PUBLIC_PRODUCT_API_URL');
  const productApiUrl = customApiUrl || (supabaseUrl ? `${supabaseUrl}/functions/v1/product-api` : '');

  return { mode, supabaseUrl, publishableKey, productApiUrl, configured: missing.length === 0, missing };
}

export const apiConfig: ApiConfig = readApiConfig({
  mode: process.env.EXPO_PUBLIC_API_MODE,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  productApiUrl: process.env.EXPO_PUBLIC_PRODUCT_API_URL,
});

/** The offline demo backend is in use (Demo controls and time travel exist only then). */
export const isMockMode = apiConfig.mode === 'mock';
