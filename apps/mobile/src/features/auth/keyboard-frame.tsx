import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

/** Keeps the field and its button above the keyboard on iOS; Android resizes the window itself. */
export function KeyboardFrame({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
