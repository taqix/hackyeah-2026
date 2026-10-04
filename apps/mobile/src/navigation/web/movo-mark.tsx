import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/*
 * The app icon (design/icons.html, "Monitor", as apps/website draws it): a
 * heartbeat whose beat is the M, with the o as a bright dot at its tip. The hex
 * values mirror the icon's export, which does not change between light and dark.
 */
const INK = '#1D1914';
const BEAT = '#86AEE3';
const PAPER = '#FFFBF5';

/** Movo's mark: the app icon as a rounded square. Decorative; label the thing around it. */
export function MovoMark({ size = 32 }: { size?: number }) {
  const gradientId = `movo-beat-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Rect width={120} height={120} rx={27} fill={INK} />
      <Defs>
        <LinearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={8} x2={92} y1={0} y2={0}>
          <Stop offset={0} stopColor={BEAT} stopOpacity={0} />
          <Stop offset={0.55} stopColor={BEAT} />
        </LinearGradient>
      </Defs>
      <Path
        d="M8 70H24L36 38L54 76L72 38L84 70H92"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={102} cy={70} r={16} fill={PAPER} opacity={0.22} />
      <Circle cx={102} cy={70} r={8.5} fill={PAPER} />
    </Svg>
  );
}
