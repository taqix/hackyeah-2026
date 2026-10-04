import { useState } from 'react';

import { Sheet, Text } from '@/components/ui';
import { useTheme } from '@/theme';

type Doc = 'terms' | 'privacy';

// Placeholder copy until the published documents exist (see the auth report's needs).
const DOCS: Record<Doc, { title: string; body: string }> = {
  terms: {
    title: 'Terms',
    body: 'The full terms will be here before Movo launches.',
  },
  privacy: {
    title: 'Privacy policy',
    body:
      'The full privacy policy will be here before Movo launches. Our assistant sees your answers and free times, ' +
      'your sessions with how they felt and your notes. Never your name, email or steps.',
  },
};

/**
 * Legal caption (prototype Legal): centred, secondary, with the terms and privacy
 * policy as inline links. `lead` is the words before "you agree to the".
 */
export function Legal({ lead }: { lead: string }) {
  const { fontFamily } = useTheme();
  const [open, setOpen] = useState<Doc | null>(null);
  const [shown, setShown] = useState<Doc>('terms');
  const doc = DOCS[shown];

  const show = (next: Doc) => {
    setShown(next);
    setOpen(next);
  };
  const link = { fontFamily: fontFamily.bodySemibold, textDecorationLine: 'underline' } as const;

  return (
    <>
      <Text variant="caption" tone="secondary" align="center">
        {lead} you agree to the{' '}
        <Text variant="caption" tone="secondary" accessibilityRole="link" onPress={() => show('terms')} style={link}>
          terms
        </Text>{' '}
        and{' '}
        <Text variant="caption" tone="secondary" accessibilityRole="link" onPress={() => show('privacy')} style={link}>
          privacy policy
        </Text>
        .
      </Text>
      <Sheet visible={open !== null} onClose={() => setOpen(null)} title={doc.title} showClose>
        <Text variant="body" tone="secondary">
          {doc.body}
        </Text>
      </Sheet>
    </>
  );
}
