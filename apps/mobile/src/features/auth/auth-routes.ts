import type { Href } from 'expo-router';

import { isApiError } from '@/api/types';

/** 1.1 asks for an existing account's password, 1.2 picks one for a new account. */
export type AuthMode = 'sign-in' | 'sign-up';

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const looksLikeEmail = (email: string) => EMAIL.test(normalizeEmail(email));

export const EMAIL_FORMAT_ERROR = 'Enter an email address like name@example.com.';

export const passwordRoute = (email: string, mode: AuthMode): Href => ({
  pathname: '/password',
  params: { email, mode },
});

export const parseAuthMode = (value: string | string[] | undefined): AuthMode =>
  value === 'sign-up' ? 'sign-up' : 'sign-in';

/** Copy for a request that failed for a reason other than the answers (offline, server). */
export function requestErrorMessage(error: unknown): string {
  if (isApiError(error, 'offline')) return "You're offline. Check your connection and try again.";
  if (isApiError(error, 'timeout')) return 'That took too long to answer. Try again.';
  return 'Something went wrong on our side. Try again.';
}
