import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readApiConfig } from '../../src/api/config';

const env = (overrides: Partial<Parameters<typeof readApiConfig>[0]> = {}) => ({
  mode: undefined,
  supabaseUrl: 'https://abc.supabase.co/',
  publishableKey: 'sb_publishable_x',
  productApiUrl: undefined,
  ...overrides,
});

test('supabase mode is the default, and the product API URL follows the project URL', () => {
  const config = readApiConfig(env());
  assert.equal(config.mode, 'supabase');
  assert.equal(config.configured, true);
  assert.equal(config.supabaseUrl, 'https://abc.supabase.co');
  assert.equal(config.productApiUrl, 'https://abc.supabase.co/functions/v1/product-api');
  assert.equal(readApiConfig(env({ productApiUrl: 'http://10.0.0.2:54321/functions/v1/product-api/' })).productApiUrl, 'http://10.0.0.2:54321/functions/v1/product-api');
});

test('missing or unsafe values are listed, never silently replaced', () => {
  assert.deepEqual(readApiConfig(env({ supabaseUrl: undefined, publishableKey: ' ' })).missing, [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]);
  assert.deepEqual(readApiConfig(env({ publishableKey: 'sb_secret_abc' })).missing, ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
  const typo = readApiConfig(env({ mode: 'mokc' }));
  assert.equal(typo.configured, false);
  assert.deepEqual(typo.missing, ['EXPO_PUBLIC_API_MODE']);
  const mock = readApiConfig(env({ mode: ' Mock ', supabaseUrl: undefined, publishableKey: undefined }));
  assert.equal(mock.mode, 'mock');
  assert.equal(mock.configured, false, 'mock mode needs no Supabase values');
});
