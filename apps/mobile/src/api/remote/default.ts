/**
 * The remote adapter with its real dependencies: supabase-js (created on
 * first use), fetch, AsyncStorage, expo-crypto IDs, the calendar's free time,
 * the system browser for OAuth and app deep links. The only remote module that
 * imports React Native, Expo or supabase-js.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { newRequestId } from '@/lib/ids';
import { captureAvailability } from '@/services/calendar';

import type { ApiClient } from '../client';
import { apiConfig } from '../config';
import { getSupabase } from '../supabase';
import { createRemoteRuntime, type RemoteRuntime } from './client';
import type { AuthPort, RemoteDeps } from './deps';

/**
 * supabase.auth behind the AuthPort, resolved on every call so the client is
 * created lazily (the web static render has no storage). Also checks at
 * compile time that supabase-js still fits the port.
 */
export const supabaseAuth: AuthPort = {
  getSession: () => getSupabase().auth.getSession(),
  signInWithPassword: (credentials) => getSupabase().auth.signInWithPassword(credentials),
  signUp: (credentials) => getSupabase().auth.signUp(credentials),
  signInWithOAuth: (credentials) => getSupabase().auth.signInWithOAuth(credentials),
  exchangeCodeForSession: (authCode) => getSupabase().auth.exchangeCodeForSession(authCode),
  resetPasswordForEmail: (email, options) => getSupabase().auth.resetPasswordForEmail(email, options),
  updateUser: (attributes) => getSupabase().auth.updateUser(attributes),
  signOut: (options) => getSupabase().auth.signOut(options),
  refreshSession: () => getSupabase().auth.refreshSession(),
  onAuthStateChange: (callback) => getSupabase().auth.onAuthStateChange(callback),
  startAutoRefresh: () => getSupabase().auth.startAutoRefresh(),
  stopAutoRefresh: () => getSupabase().auth.stopAutoRefresh(),
};

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
    captureAvailability,
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    async openAuthSession(url, redirectUrl) {
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === 'success') return { type: 'success', url: result.url };
      return { type: result.type === 'cancel' ? 'cancel' : 'dismiss' };
    },
    redirectUrl: (path) => Linking.createURL(path),
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
