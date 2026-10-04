import { z } from '../../../packages/contracts/src/product.ts';
import type { GoogleTokenResultDto } from '../../../packages/contracts/src/product.ts';
import { ApiError } from './errors.ts';
import type { GoogleTokenRefresher } from './ports.ts';

// Runtime-agnostic on purpose (like gemini.ts): no Deno globals, so the Supabase
// typecheck and the Node tests compile this file.
export interface GoogleOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  /** Receives status lines only, never a token or Google's answer. */
  log?: (message: string) => void;
  timeoutMs?: number;
}

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const notConfigured = () =>
  new ApiError('GOOGLE_NOT_CONFIGURED', 501, 'Google Calendar is not connected on the server yet.');
const reconnect = () =>
  new ApiError(
    'GOOGLE_RECONNECT_REQUIRED',
    409,
    'Google no longer accepts this connection. Reconnect Google Calendar.',
  );
const unavailable = () =>
  new ApiError('PROVIDER_UNAVAILABLE', 502, 'Google did not answer. Try again.', true);

const tokenAnswer = z.object({
  access_token: z.string().min(1).max(4096),
  expires_in: z.number().positive(),
});
const errorAnswer = z.object({ error: z.string() });

// index.ts uses this until GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are both set.
export const unavailableGoogle: GoogleTokenRefresher = {
  async refresh() {
    throw notConfigured();
  },
};

/**
 * Trades a Google refresh token for a new access token with the app's OAuth
 * client (the Web client Supabase Auth uses). The secret never leaves the
 * function. invalid_grant (revoked, expired or from another client) asks the
 * person to reconnect; a wrong client ID or secret reads as not configured.
 */
export function createGoogleTokenRefresher(
  config: GoogleOAuthConfig,
  fetcher: typeof fetch = fetch,
): GoogleTokenRefresher {
  const { clientId, clientSecret } = config;
  if (!clientId || !clientSecret) return unavailableGoogle;
  const log = config.log ?? ((message: string) => console.warn(message));
  const timeoutMs = config.timeoutMs ?? 10_000;
  return {
    async refresh(refreshToken: string): Promise<GoogleTokenResultDto> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetcher(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          }).toString(),
          signal: controller.signal,
        });
      } catch {
        log('google token refresh: no answer');
        throw unavailable();
      } finally {
        clearTimeout(timer);
      }
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (response.ok) {
        const parsed = tokenAnswer.safeParse(body);
        if (!parsed.success) {
          log(`google token refresh: unreadable answer (${response.status})`);
          throw unavailable();
        }
        return {
          access_token: parsed.data.access_token,
          expires_in: Math.max(1, Math.floor(parsed.data.expires_in)),
        };
      }
      const code = errorAnswer.safeParse(body).success ? (body as { error: string }).error : null;
      // Status and Google's error code only: never the token, the secret or the description.
      log(`google token refresh: ${response.status} ${code ?? 'no error code'}`);
      if (code === 'invalid_grant') throw reconnect();
      if (code === 'invalid_client' || code === 'unauthorized_client') throw notConfigured();
      throw unavailable();
    },
  };
}
