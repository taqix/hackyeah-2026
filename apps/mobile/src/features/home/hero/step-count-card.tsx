import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

import { Button, Icon, Spinner, Text } from '@/components/ui';
import { useStepCounter } from '@/hooks/use-step-counter';
import { formatTime } from '@/lib/dates';
import { useTheme } from '@/theme';

import { formatCount } from './copy';

type Kind = 'count' | 'reading' | 'ask' | 'denied' | 'unavailable' | 'error';

/**
 * Today's steps from the phone (useStepCounter, docs/features/system-step-counter.md).
 * Without access it asks quietly; it never shows a made-up zero.
 */
export function StepCountCard() {
  const { colors, radius, fontFamily } = useTheme();
  const { steps, status, updatedAt, message, source, refresh, requestPermission, openSettings } = useStepCounter();
  // permission-required covers both "not asked yet" and "said no": after Turn on
  // still leaves it off, the system won't ask again, so Settings is the way.
  const [askedHere, setAskedHere] = useState(false);
  const [busy, setBusy] = useState(false);

  const kind: Kind =
    steps !== null
      ? 'count'
      : status === 'permission-required'
        ? askedHere
          ? 'denied'
          : 'ask'
        : status === 'unavailable'
          ? 'unavailable'
          : status === 'error'
            ? 'error'
            : 'reading';

  const what = source === 'health-connect' ? 'Health Connect' : 'motion';
  const caption = {
    count: updatedAt ? `From your phone · updated ${formatTime(updatedAt)}` : 'From your phone',
    reading: 'Checking your phone.',
    ask: `Allow ${what} access to see them here.`,
    denied: `${capitalizeFirst(what)} access is off. You can turn it on in Settings.`,
    unavailable: message ?? "Step counts aren't available on this phone.",
    error: message ? `Couldn't read them: ${message}` : "Couldn't read them from your phone.",
  }[kind];

  useAnnounceChange(kind, kind === 'count' ? `${formatCount(steps ?? 0)} steps today` : `Steps today. ${caption}`);

  const run = (action: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await action();
    } catch {
      // openSettings can fail on devices without a settings target; the card stays as it is.
    } finally {
      setBusy(false);
    }
  };

  const action =
    kind === 'ask' ? (
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        onPress={run(async () => {
          setAskedHere(true);
          await requestPermission();
        })}
        style={styles.button}>
        Turn on
      </Button>
    ) : kind === 'denied' ? (
      <Button variant="secondary" size="sm" onPress={run(openSettings)} style={styles.button}>
        Open Settings
      </Button>
    ) : kind === 'error' ? (
      <Button variant="secondary" size="sm" loading={busy} onPress={run(refresh)} style={styles.button}>
        Try again
      </Button>
    ) : kind === 'reading' ? (
      <Spinner size={18} color={colors.textTertiary} accessibilityLabel={null} />
    ) : null;

  return (
    <View style={[styles.card, { borderRadius: radius.md, backgroundColor: colors.surfaceSunken }]}>
      <View style={[styles.disc, { backgroundColor: colors.surfaceCard }]}>
        <Icon name="footprints" size={20} color={colors.textSecondary} />
      </View>
      <View
        style={styles.text}
        accessible
        accessibilityRole={kind === 'error' ? 'alert' : 'text'}
        aria-live="polite">
        {kind === 'count' && steps !== null ? (
          <Text variant="body" tone="secondary">
            <Text
              tabular
              style={{ fontFamily: fontFamily.displaySemibold, fontSize: 18, lineHeight: 22, letterSpacing: -0.27, color: colors.textPrimary }}>
              {formatCount(steps)}
            </Text>
            {' steps today'}
          </Text>
        ) : (
          <Text variant="bodyStrong" style={styles.title}>
            Steps today
          </Text>
        )}
        <Text variant="caption" tone="secondary">
          {caption}
        </Text>
      </View>
      {action}
    </View>
  );
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** iOS has no live regions: announce when the card changes what it says (not every refresh). */
function useAnnounceChange(kind: Kind, text: string) {
  const previous = useRef(kind);
  useEffect(() => {
    if (previous.current === kind) return;
    previous.current = kind;
    if (Platform.OS === 'ios' && kind !== 'reading') AccessibilityInfo.announceForAccessibility(text);
  }, [kind, text]);
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 21 },
  button: { height: 44 },
});
