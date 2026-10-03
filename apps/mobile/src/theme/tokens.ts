/**
 * Design tokens ported from design/system/tokens/*.css. The CSS files stay the
 * source of truth for values; keep both in sync when a token changes.
 * Components read semantic colors through useTheme(), never the base palette.
 */

export const palette = {
  paper0: '#FFFBF5',
  paper50: '#F8F2E8',
  paper100: '#F1E9DC',
  paper200: '#E6DCCC',
  paper300: '#D3C8B7',
  ink400: '#9A8F80',
  ink500: '#6F6557',
  ink600: '#5C5348',
  ink700: '#3F3830',
  ink800: '#2A251F',
  ink900: '#1D1914',
  night0: '#141210',
  night50: '#1B1815',
  night100: '#24201C',
  night200: '#2F2A25',
  night300: '#3D372F',
  blue50: '#EEF4FB',
  blue100: '#D8E6F6',
  blue200: '#B3CDEE',
  blue300: '#86AEE3',
  blue400: '#5B8FD6',
  blue500: '#3E74C4',
  blue600: '#2F5CA3',
  blue700: '#254A85',
  blue800: '#1C3966',
  blue900: '#132746',
  peach100: '#FCE6D6',
  peach300: '#F4B892',
  peach500: '#E08A5A',
  peach700: '#A9542B',
  sage300: '#B5BFA3',
  sage500: '#7F8C6A',
  sage700: '#56614A',
  moss300: '#9DB38B',
  moss500: '#5F7A4E',
  brick300: '#DD8C78',
  brick500: '#B4513C',
  slate300: '#A9A8C2',
  slate500: '#6B6A86',
} as const;

export type ColorScheme = 'light' | 'dark';

export type SemanticColors = {
  bgApp: string;
  surfaceCard: string;
  surfaceSunken: string;
  surfaceRaised: string;
  surfaceInverse: string;
  /** Coach messages in chat; sunken is darker than the page in dark mode. */
  surfaceBubble: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textOnAccent: string;
  accent: string;
  accentHover: string;
  accentPressed: string;
  accentSoft: string;
  accentSoftStrong: string;
  accentText: string;
  recovery: string;
  recoverySoft: string;
  success: string;
  successSoft: string;
  successText: string;
  danger: string;
  dangerSoft: string;
  dangerText: string;
  tintBlue: string;
  tintPeach: string;
  tintSage: string;
  warm: string;
  warmText: string;
  info: string;
  infoSoft: string;
  infoText: string;
  focusRing: string;
  overlay: string;
  /** Floating tab bar fill: 82% of the raised surface (CSS used backdrop blur). */
  barFill: string;
  /** Hairline on tinted hero cards: text-primary at 10%. */
  hairlineOnTint: string;
};

export const colors: Record<ColorScheme, SemanticColors> = {
  light: {
    bgApp: palette.paper50,
    surfaceCard: palette.paper0,
    surfaceSunken: palette.paper100,
    surfaceRaised: '#FFFFFF',
    surfaceInverse: palette.ink900,
    surfaceBubble: palette.paper100,
    borderSubtle: palette.paper200,
    borderStrong: palette.paper300,
    textPrimary: palette.ink900,
    textSecondary: palette.ink600,
    textTertiary: palette.ink500,
    textInverse: palette.paper50,
    textOnAccent: palette.paper0,
    accent: palette.blue500,
    accentHover: palette.blue600,
    accentPressed: palette.blue700,
    accentSoft: palette.blue50,
    accentSoftStrong: palette.blue100,
    accentText: palette.blue600,
    recovery: palette.sage500,
    recoverySoft: '#ECEEE5',
    success: palette.moss500,
    successSoft: '#E8EEE1',
    successText: '#4F6943',
    danger: palette.brick500,
    dangerSoft: '#F6E4DE',
    dangerText: '#A04634',
    tintBlue: '#E6EFFA',
    tintPeach: palette.peach100,
    tintSage: '#E9EEDF',
    warm: palette.peach500,
    warmText: palette.peach700,
    info: palette.slate500,
    infoSoft: '#E4E9EE',
    infoText: '#5B5A77',
    focusRing: 'rgba(91,143,214,0.45)',
    overlay: 'rgba(29,25,20,0.36)',
    barFill: 'rgba(255,255,255,0.82)',
    hairlineOnTint: 'rgba(29,25,20,0.10)',
  },
  dark: {
    bgApp: palette.night0,
    surfaceCard: palette.night50,
    surfaceSunken: '#100E0C',
    surfaceRaised: palette.night100,
    surfaceInverse: palette.paper50,
    surfaceBubble: palette.night100,
    borderSubtle: palette.night200,
    borderStrong: palette.night300,
    textPrimary: '#F3EDE3',
    textSecondary: '#B9AF9F',
    textTertiary: '#9C9182',
    textInverse: palette.ink900,
    textOnAccent: palette.ink900,
    accent: palette.blue300,
    accentHover: palette.blue200,
    accentPressed: palette.blue400,
    accentSoft: '#18202B',
    accentSoftStrong: '#1F2B3B',
    accentText: palette.blue200,
    recovery: palette.sage300,
    recoverySoft: '#22251E',
    success: palette.moss300,
    successSoft: '#1F261B',
    successText: palette.moss300,
    danger: palette.brick300,
    dangerSoft: '#2E1C17',
    dangerText: palette.brick300,
    tintBlue: '#1A2331',
    tintPeach: '#2E2119',
    tintSage: '#1F251B',
    warm: palette.peach300,
    warmText: palette.peach300,
    info: palette.slate300,
    infoSoft: '#1C2127',
    infoText: palette.slate300,
    focusRing: 'rgba(134,174,227,0.5)',
    overlay: 'rgba(0,0,0,0.55)',
    barFill: 'rgba(36,32,28,0.82)',
    hairlineOnTint: 'rgba(243,237,227,0.10)',
  },
};

/** 4 px base. Screen gutter 20, card padding 20, stack gap 12, section gap 24–32. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const layout = {
  gutter: 20,
  gapStack: 12,
  gapSection: 32,
  /** Minimum touch target; give smaller controls hitSlop to reach it. */
  hitMin: 44,
  /** Space the floating tab bar covers at the bottom of a tab screen (bar + margin). */
  tabBarClearance: 112,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999,
  control: 18,
  card: 24,
  sheet: 32,
} as const;

/**
 * Font family names as registered with expo-font in the root layout. Native
 * platforms pick a weight by family name, so every weight is its own family.
 */
export const fontFamily = {
  displaySemibold: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayRegular: 'BricolageGrotesque_400Regular',
  bodyRegular: 'HankenGrotesk_400Regular',
  bodyItalic: 'HankenGrotesk_400Regular_Italic',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemibold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
} as const;

export const fontSize = {
  '2xs': 11,
  xs: 12,
  sm: 14,
  base: 16,
  md: 18,
  lg: 22,
  xl: 28,
  '2xl': 36,
  '3xl': 48,
  hero: 64,
} as const;

export type TypeRole = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

const tracking = (size: number, em: number) => Math.round(size * em * 100) / 100;

/** Semantic type roles from typography.css (--type-*). Line heights are in points. */
export const type = {
  hero: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.hero,
    lineHeight: Math.round(fontSize.hero * 1.08),
    letterSpacing: tracking(fontSize.hero, -0.035),
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['2xl'],
    lineHeight: Math.round(fontSize['2xl'] * 1.08),
    letterSpacing: tracking(fontSize['2xl'], -0.025),
  },
  /** Screen H1 in the prototype (700 28px display). */
  h1: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.xl,
    lineHeight: Math.round(fontSize.xl * 1.08),
    letterSpacing: tracking(fontSize.xl, -0.025),
  },
  heading: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.lg,
    lineHeight: Math.round(fontSize.lg * 1.25),
    letterSpacing: tracking(fontSize.lg, -0.015),
  },
  subheading: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: fontSize.md,
    lineHeight: Math.round(fontSize.md * 1.25),
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.base,
    lineHeight: Math.round(fontSize.base * 1.45),
  },
  /** 600 15px/1.3 body, the prototype's STRONG row titles. */
  bodyStrong: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 15,
    lineHeight: Math.round(15 * 1.3),
  },
  bodySm: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.sm,
    lineHeight: Math.round(fontSize.sm * 1.45),
  },
  section: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.md,
    lineHeight: Math.round(fontSize.md * 1.25),
    letterSpacing: tracking(fontSize.md, -0.015),
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    lineHeight: Math.round(fontSize.sm * 1.2),
  },
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: Math.round(fontSize.xs * 1.35),
  },
  /** Tabular numbers: times, weights, durations. Pair with fontVariant: ['tabular-nums']. */
  numeric: {
    fontFamily: fontFamily.displaySemibold,
    fontSize: fontSize.base,
    lineHeight: Math.round(fontSize.base * 1.2),
    letterSpacing: tracking(fontSize.base, -0.015),
  },
} as const satisfies Record<string, TypeRole>;

export type TypeVariant = keyof typeof type;

export type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

/** Brown-tinted, low opacity, three steps. Dark mode drops to a faint ring (use a border). */
export const shadows: Record<ColorScheme, Record<1 | 2 | 3, Shadow>> = {
  light: {
    1: { shadowColor: '#3C2A14', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
    2: { shadowColor: '#3C2A14', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
    3: { shadowColor: '#3C2A14', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 8 },
  },
  dark: {
    1: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
    2: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 4 },
    3: { shadowColor: '#000000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.7, shadowRadius: 32, elevation: 10 },
  },
};

/** Motion from effects.css. Use with Reanimated Easing.bezier(...). */
export const motion = {
  easeOut: [0.22, 0.8, 0.3, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
  easeSpring: [0.34, 1.4, 0.64, 1] as const,
  durFast: 120,
  durBase: 200,
  durSlow: 320,
  durCalm: 600,
  pressScale: 0.97,
  pressScaleCard: 0.99,
} as const;
