import './url-polyfill';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { apiConfig } from './config';
import { ApiError } from './types';

let client: SupabaseClient | null = null;

/**
 * The one Supabase client, created on first use (never during the web static
 * render, which has no storage). The session lives in AsyncStorage and refreshes
 * itself; OAuth uses PKCE, and only the web build reads a session from its URL.
 * Auth listeners and the AppState refresh wiring live in `AuthSessionSync`.
 */
export function getSupabase(): SupabaseClient {
  if (!apiConfig.configured) {
    throw new ApiError('not_configured', "This build isn't connected to a server yet.");
  }
  client ??= createClient(apiConfig.supabaseUrl, apiConfig.publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  });
  return client;
}
