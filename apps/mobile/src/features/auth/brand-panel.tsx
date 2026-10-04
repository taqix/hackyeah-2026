import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { useLayout } from '@/components/layout';
import { Icon, type IconName, suggestionInk, Text } from '@/components/ui';
import { Fields } from '@/components/ui/suggestion-card';
import { useTheme } from '@/theme';

import { type RiseStyle, useRise } from './rise';

/*
 * Light-on-dark like the SuggestionCard hero it grows from: the panel is dark
 * in both themes, so its colours are fixed rather than semantic tokens.
 */
const GLASS = 'rgba(251,248,242,0.10)';
const GLASS_STRONG = 'rgba(251,248,242,0.16)';
const GLASS_EDGE = 'rgba(251,248,242,0.20)';
const INK_QUIET = 'rgba(251,248,242,0.72)';
const DONE = '#9DB38B';
/** Darkens the top for the wordmark and the bottom for the headline. */
const SCRIM = ['rgba(18,16,14,0.30)', 'rgba(18,16,14,0)', 'rgba(18,16,14,0.78)'] as const;

/*
 * Each auth screen has its own panel. The entrance plays once per page load,
 * and every panel's loops keep one phase from the page's start, so moving from
 * Welcome to the password step doesn't make the panel jump.
 */
const EPOCH = Date.now();
let entered = false;
/** A negative delay that puts an alternating loop of `period` ms where it would be had it run since the page loaded. */
const phase = (period: number) => `${-((Date.now() - EPOCH) % (period * 2))}ms`;

const DRIFT_MS = 22_000;
const FLOAT_MS = 5_600;

/** The colour fields drift slowly, so the panel feels alive without drawing the eye. */
const DRIFT = {
  from: { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1.1 }] },
  to: { transform: [{ translateX: -36 }, { translateY: 24 }, { scale: 1.18 }] },
};
const FLOAT = {
  from: { transform: [{ translateY: 0 }] },
  to: { transform: [{ translateY: -8 }] },
};

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'calendar-check', title: 'Fits your week', body: 'Sessions go where your calendar is free.' },
  { icon: 'message-circle', title: 'Change it by asking', body: 'Tell the coach what changed. The plan follows.' },
  { icon: 'sprout', title: 'Gentle from day one', body: 'Short sessions, with rest days between.' },
];

const PREVIEW: { day: string; title: string; when: string; done?: boolean; today?: boolean }[] = [
  { day: 'Mon', title: 'Brisk walk', when: '7:00 · 20 min', done: true },
  { day: 'Wed', title: 'Walk-run intervals', when: '7:00 · 20 min', today: true },
  { day: 'Fri', title: 'Easy walk', when: '18:00 · 20 min' },
];

/** A week of the plan as the app shows it, with a change the coach made: what Movo does, at a glance. */
function PlanPreview({ entrance }: { entrance: RiseStyle }) {
  const { fontFamily, radius } = useTheme();
  const reduced = useReducedMotion();
  const [floatDelay] = useState(() => phase(FLOAT_MS));
  return (
    <Animated.View style={[styles.previewSlot, entrance]}>
      <Animated.View
        style={[
          styles.preview,
          { borderRadius: radius.lg },
          reduced
            ? null
            : {
                animationName: FLOAT,
                animationDuration: FLOAT_MS,
                animationDelay: floatDelay,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
                animationTimingFunction: 'ease-in-out',
              },
        ]}>
        <View style={styles.previewHead}>
          <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 14, lineHeight: 18, color: suggestionInk.text }}>
            This week
          </Text>
          <Text style={{ fontFamily: fontFamily.bodyMedium, fontSize: 12, lineHeight: 16, color: INK_QUIET }}>
            3 sessions
          </Text>
        </View>
        {PREVIEW.map((item) => (
          <View
            key={item.day}
            style={[styles.previewRow, { borderRadius: radius.sm }, item.today ? { backgroundColor: GLASS_STRONG } : null]}>
            <Text style={[styles.previewDay, { fontFamily: fontFamily.bodySemibold, color: INK_QUIET }]}>{item.day}</Text>
            <View style={styles.previewText}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20, color: suggestionInk.text }}>
                {item.title}
              </Text>
              <Text style={{ fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 17, color: INK_QUIET }}>
                {item.when}
              </Text>
            </View>
            {item.done ? (
              <View style={[styles.previewMark, { backgroundColor: DONE }]}>
                <Icon name="check" size={14} strokeWidth={2.5} color="#1D1914" />
              </View>
            ) : (
              <View style={[styles.previewMark, { borderWidth: 1.5, borderColor: GLASS_EDGE }]} />
            )}
          </View>
        ))}
        <View style={[styles.previewNote, { borderRadius: radius.sm }]}>
          <Icon name="calendar-clock" size={16} color={suggestionInk.text} />
          <Text style={{ flex: 1, fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18, color: suggestionInk.body }}>
            Moved to Friday — you have meetings until 6.
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

type PointProps = (typeof POINTS)[number] & { stacked: boolean; entrance: RiseStyle };

function Point({ icon, title, body, stacked, entrance }: PointProps) {
  const { fontFamily } = useTheme();
  return (
    <Animated.View style={[stacked ? styles.pointRow : styles.pointColumn, entrance]}>
      <View style={styles.pointDisc}>
        <Icon name={icon} size={18} color={suggestionInk.text} />
      </View>
      <View style={stacked ? styles.pointText : styles.pointTextColumn}>
        <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20, color: suggestionInk.text }}>
          {title}
        </Text>
        <Text style={{ fontFamily: fontFamily.bodyRegular, fontSize: 13, lineHeight: 18, color: INK_QUIET }}>{body}</Text>
      </View>
    </Animated.View>
  );
}

/**
 * The desktop sign-in screens' left half: the Welcome hero's dawn colour
 * fields, slowly drifting, with the headline, what Movo does in three points
 * and, when there is room, a glimpse of a planned week. Decorative apart from
 * the headline; the form beside it is the page's purpose.
 */
export function BrandPanel() {
  const { radius, fontFamily } = useTheme();
  const { isWide, width, height } = useLayout();
  const reduced = useReducedMotion();
  const rise = useRise();
  const [firstShow] = useState(() => !entered);
  const [driftDelay] = useState(() => phase(DRIFT_MS));
  const enter = (step: number) => (firstShow ? rise(step) : null);
  const showPreview = isWide && height >= 760;

  useEffect(() => {
    entered = true;
  }, []);
  const headline = isWide ? 56 : 40;

  return (
    <View
      style={[
        styles.panel,
        { borderRadius: radius.xl },
        isWide ? { flex: 1.15 } : { width: Math.max(320, Math.round(width * 0.42)) },
      ]}>
      <Animated.View
        aria-hidden
        style={[
          styles.fields,
          reduced
            ? null
            : {
                animationName: DRIFT,
                animationDuration: DRIFT_MS,
                animationDelay: driftDelay,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
                animationTimingFunction: 'ease-in-out',
              },
        ]}>
        <Fields tone="dawn" />
      </Animated.View>
      <LinearGradient colors={SCRIM} locations={[0, 0.42, 1]} style={[StyleSheet.absoluteFill, styles.passThrough]} />

      <View style={[styles.content, { padding: isWide ? 48 : 36 }]}>
        <Animated.View style={enter(0)}>
          <Text
            style={{
              fontFamily: fontFamily.displaySemibold,
              fontSize: 24,
              lineHeight: 28,
              letterSpacing: -0.6,
              color: suggestionInk.text,
            }}>
            Movo
          </Text>
        </Animated.View>

        <View style={styles.middle} aria-hidden>
          {showPreview ? <PlanPreview entrance={enter(3)} /> : null}
        </View>

        <View style={styles.story}>
          <Animated.View style={[styles.kicker, enter(1)]}>
            <Text style={{ fontFamily: fontFamily.bodySemibold, fontSize: 12, lineHeight: 14, color: suggestionInk.text }}>
              Welcome
            </Text>
          </Animated.View>
          <Animated.View style={enter(2)}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontFamily.displayBold,
                fontSize: headline,
                lineHeight: Math.round(headline * 1.04),
                letterSpacing: -0.03 * headline,
                color: suggestionInk.text,
                maxWidth: 560,
              }}>
              Find a way to move you&apos;ll keep.
            </Text>
          </Animated.View>
          <Animated.View style={enter(3)}>
            <Text
              style={{ fontFamily: fontFamily.bodyRegular, fontSize: 17, lineHeight: 25, color: suggestionInk.body, maxWidth: 460 }}>
              A few questions, then a gentle first week. Everyone starts somewhere.
            </Text>
          </Animated.View>
          <View style={[styles.points, isWide ? styles.pointsRow : null]}>
            {POINTS.map((point, index) => (
              <Point key={point.title} {...point} stacked={!isWide} entrance={enter(index + 4)} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    margin: 16,
    marginRight: 0,
    overflow: 'hidden',
    // The dawn fields' base, until the art paints.
    backgroundColor: '#2A3550',
  },
  fields: {
    position: 'absolute',
    top: '-12%',
    right: '-12%',
    bottom: '-12%',
    left: '-12%',
  },
  passThrough: { pointerEvents: 'none' },
  content: { flex: 1, gap: 24 },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'flex-end' },
  story: { gap: 16 },
  kicker: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(251,248,242,0.18)',
  },
  points: { gap: 14, marginTop: 12 },
  pointsRow: { flexDirection: 'row', gap: 20 },
  /** Wide: three points side by side. */
  pointColumn: { flex: 1, gap: 10 },
  /** Medium: one point per row. */
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pointDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_STRONG,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  pointText: { flex: 1, gap: 1 },
  pointTextColumn: { gap: 2 },
  previewSlot: { width: '100%', maxWidth: 360, marginRight: 8 },
  preview: {
    padding: 16,
    gap: 6,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    boxShadow: '0 24px 48px -16px rgba(0,0,0,0.45)',
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8 },
  previewDay: { width: 32, fontSize: 12, lineHeight: 16 },
  previewText: { flex: 1, minWidth: 0 },
  previewMark: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(18,16,14,0.28)',
  },
});
