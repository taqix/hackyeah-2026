/**
 * The remote adapter with its real dependencies: supabase-js (created on
 * first use), fetch, AsyncStorage, the secure store, expo-crypto IDs, the
 * calendar's free time (Google Calendar first when connected), the system
 * browser for OAuth and app deep links. The only remote module that imports
 * React Native, Expo or supabase-js.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { newRequestId } from '@/lib/ids';
import { captureAvailability } from '@/services/calendar';

import type { ApiClient } from '../client';
import { apiConfig } from '../config';
import { getSupabase } from '../supabase';
import { createRemoteRuntime, type RemoteRuntime } from './client';
import type { AuthPort, KeyValueStorage, RemoteDeps } from './deps';
import { webAppUrl } from './redirect-url';

/**
 * supabase.auth behind the AuthPort, resolved on every call so the client is
 * created lazily (the web static render has no storage). Also checks at
 * compile time that supabase-js still fits the port.
 */
export const supabaseAuth: AuthPort = {
  getSession: () => getSupabase().auth.getSession(),
  signInWithPassword: (credentials) => getSupabase().auth.signInWithPassword(credentials),
  signUp: (credentials) => getSupabase().auth.signUp(credentials),
  signInAnonymously: (credentials) => getSupabase().auth.signInAnonymously(credentials),
  signInWithOAuth: (credentials) => getSupabase().auth.signInWithOAuth(credentials),
  linkIdentity: (credentials) => getSupabase().auth.linkIdentity(credentials),
  getUserIdentities: () => getSupabase().auth.getUserIdentities(),
  setSession: (tokens) => getSupabase().auth.setSession(tokens),
  exchangeCodeForSession: (authCode) => getSupabase().auth.exchangeCodeForSession(authCode),
  resetPasswordForEmail: (email, options) => getSupabase().auth.resetPasswordForEmail(email, options),
  updateUser: (attributes, options) => getSupabase().auth.updateUser(attributes, options),
  signOut: (options) => getSupabase().auth.signOut(options),
  refreshSession: () => getSupabase().auth.refreshSession(),
  onAuthStateChange: (callback) => getSupabase().auth.onAuthStateChange(callback),
  startAutoRefresh: () => getSupabase().auth.startAutoRefresh(),
  stopAutoRefresh: () => getSupabase().auth.stopAutoRefresh(),
};

/**
 * The Google tokens' home: the iOS keychain or Android keystore through
 * expo-secure-store. Web has no secure store, so there they fall back to
 * AsyncStorage (localStorage), where supabase-js keeps its own session too.
 */
const secureStorage: KeyValueStorage =
  Platform.OS === 'web'
    ? AsyncStorage
    : {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
      };

/**
 * Where Auth links return (Google, the confirmation and reset emails): an app
 * deep link, or on the web this page's address under the router's base URL
 * (`experiments.baseUrl`). Expo Router applies the base URL outside
 * development only, because the dev server serves the app at the root.
 */
function redirectUrl(path: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Linking.createURL(path);
  const baseUrl = process.env.NODE_ENV === 'development' ? '' : (process.env.EXPO_BASE_URL ?? '');
  return webAppUrl(window.location.origin, path, baseUrl);
}

/** Google Calendar's free/busy for planning when connected; any problem reading the setting means "not now". */
async function googleFreeTime() {
  try {
    return await getRemoteRuntime().googleCalendar.freeTimeSource();
  } catch {
    return null;
  }
}

function defaultDeps(): RemoteDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    productApiUrl: apiConfig.productApiUrl,
    supabaseUrl: apiConfig.supabaseUrl,
    publishableKey: apiConfig.publishableKey,
    auth: supabaseAuth,
    storage: AsyncStorage,
    now: () => new Date(),
    newId: newRequestId,
    captureAvailability: async (options) => captureAvailability(options, { google: await googleFreeTime() }),
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    async openAuthSession(url, redirectUrl) {
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === 'success') return { type: 'success', url: result.url };
      return { type: result.type === 'cancel' ? 'cancel' : 'dismiss' };
    },
    redirectUrl,
    secureStorage,
    googleFetch: (url, init) => fetch(url, init),
  };
}

let runtime: RemoteRuntime | null = null;

/** The app's one remote runtime: its client, and the data cache and drafts behind it. */
export function getRemoteRuntime(): RemoteRuntime {
  runtime ??= createRemoteRuntime(defaultDeps());
  return runtime;
}

export function createDefaultRemoteApiClient(): ApiClient {
  return getRemoteRuntime().client;
}
