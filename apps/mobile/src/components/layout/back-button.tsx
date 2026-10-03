import { useRouter } from 'expo-router';

import { IconButton } from '@/components/ui/icon-button';

export type BackButtonProps = {
  /** Replaces the default router.back(). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The arrow-left IconButton labelled "Back". Without history it goes to the app root. */
export function BackButton({ onPress, accessibilityLabel = 'Back' }: BackButtonProps) {
  const router = useRouter();
  return (
    <IconButton
      icon="arrow-left"
      accessibilityLabel={accessibilityLabel}
      onPress={
        onPress ??
        (() => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        })
      }
    />
  );
}
