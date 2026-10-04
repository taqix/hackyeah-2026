import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { PlanVersion } from '@/api/types';
import { Badge, Disc, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { useArrowKeys } from './use-arrow-keys';
import { VERSION_SOURCES, versionWhen } from './version-source';

/** Space around an entry's content; the rail's line runs through it to the next disc. */
const PAD = 14;
const DISC = 32;

function entryId(version: number): string {
  return `plan-version-${version}`;
}

type VersionTimelineProps = {
  /** Newest first. */
  versions: PlanVersion[];
  selected: number;
  onSelect: (version: number) => void;
};

/**
 * Every version of the plan as a timeline to pick from (desktop), newest
 * first: where it came from, when, and its summary. ↑ and ↓ move between
 * versions, Home and End to the newest and the first.
 */
export function VersionTimeline({ versions, selected, onSelect }: VersionTimelineProps) {
  const ref = useRef<View>(null);
  const order = versions.map((version) => version.version);
  useArrowKeys(ref, selected, {
    target: (key, from) => {
      const at = order.indexOf(from);
      const moves: Partial<Record<string, number>> = { ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: order.length - 1 };
      const to = moves[key];
      return to === undefined ? null : (order[Math.min(Math.max(to, 0), order.length - 1)] ?? null);
    },
    pick: (version) => {
      onSelect(version);
      return true;
    },
    idOf: entryId,
  });

  return (
    <View ref={ref} accessibilityRole="list" accessibilityLabel="Plan versions">
      {versions.map((version, i) => (
        <Entry
          key={version.version}
          version={version}
          selected={version.version === selected}
          first={i === 0}
          last={i === versions.length - 1}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

type EntryProps = {
  version: PlanVersion;
  selected: boolean;
  first: boolean;
  last: boolean;
  onSelect: (version: number) => void;
};

function Entry({ version, selected, first, last, onSelect }: EntryProps) {
  const { colors, radius, shadows } = useTheme();
  const source = VERSION_SOURCES[version.source];
  const rail = { backgroundColor: colors.borderSubtle };
  return (
    <PressableScale
      id={entryId(version.version)}
      onPress={() => onSelect(version.version)}
      // One tab stop for the list (the selected version); the arrow keys move from there.
      tabIndex={selected ? 0 : -1}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={[
        `Version ${version.version}`,
        version.active ? 'in use' : null,
        source.label,
        versionWhen(version),
        version.summary,
      ]
        .filter(Boolean)
        .join(', ')}
      aria-selected={selected}
      style={({ pressed, hovered }) => [
        styles.entry,
        { borderRadius: radius.md },
        selected
          ? { backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle, ...shadows[1] }
          : hovered || pressed
            ? { backgroundColor: colors.hoverWash }
            : null,
      ]}>
      {first ? null : <View style={[styles.lineAbove, rail]} />}
      {last ? null : <View style={[styles.lineBelow, rail]} />}
      <Disc
        icon={source.icon}
        size={DISC}
        tone={version.active ? 'accent' : 'quiet'}
        style={version.active ? { backgroundColor: colors.accentSoftStrong } : null}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="subheading">Version {version.version}</Text>
          {version.active ? <Badge tone="accent">In use</Badge> : null}
        </View>
        <Text variant="caption" tone="secondary" tabular>
          {source.label} · {versionWhen(version)}
        </Text>
        <Text variant="bodySm" tone={selected ? 'primary' : 'secondary'} numberOfLines={2}>
          {version.summary}
        </Text>
      </View>
    </PressableScale>
  );
}

const RAIL_X = PAD + DISC / 2 - 1;

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: PAD,
    // A border on every entry, so the selected one's does not shift its content.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  lineAbove: { position: 'absolute', left: RAIL_X, top: -1, height: PAD - 4, width: 2, borderRadius: 1 },
  lineBelow: { position: 'absolute', left: RAIL_X, top: PAD + DISC + 4, bottom: -1, width: 2, borderRadius: 1 },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
