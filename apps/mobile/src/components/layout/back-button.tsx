import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';

import { useLayout } from './responsive';

export type BackButtonProps = {
  /** Replaces the default router.back(). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * The arrow-left IconButton labelled "Back"; on the desktop web a small ghost
 * button that also shows its label. Without history it goes to the app root.
 */
export function BackButton({ onPress, accessibilityLabel = 'Back' }: BackButtonProps) {
  const router = useRouter();
  const { isDesktop } = useLayout();
  const press =
    onPress ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    });

  if (isDesktop) {
    return (
      <Button variant="ghost" size="sm" icon="arrow-left" accessibilityLabel={accessibilityLabel} onPress={press}>
        {accessibilityLabel}
      </Button>
    );
  }
  return <IconButton icon="arrow-left" accessibilityLabel={accessibilityLabel} onPress={press} />;
}
