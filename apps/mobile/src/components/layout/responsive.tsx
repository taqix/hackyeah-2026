import { Children, createContext, type ReactNode, use } from 'react';
import { Platform, type StyleProp, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

/**
 * The web panel's breakpoints. Below `medium` the web app keeps the phone
 * layout (floating tab bar, one column). From `medium` a sidebar replaces the
 * tab bar and screens may use columns; from `wide` the sidebar shows labels and
 * the coach can stay docked beside the page. Native apps are always `compact`,
 * so tablets keep the phone layout the design describes.
 */
export const BREAKPOINTS = { medium: 768, wide: 1200 } as const;

export type LayoutMode = 'compact' | 'medium' | 'wide';

/** Widest a desktop page's content grows before it centers; forms pass a narrower one. */
export const DESKTOP_CONTENT_MAX_WIDTH = 1160;
/** A desktop form's column: Content's `maxWidth` on a form, and where its BottomBar's buttons line up. */
export const DESKTOP_FORM_MAX_WIDTH = 720;
/** Page gutter beside desktop content (the phone gutter is `layout.gutter`, 20). */
export const DESKTOP_GUTTER = 32;

export type Layout = {
  mode: LayoutMode;
  /** Phone layout: one column, floating tab bar. Always true on native. */
  isCompact: boolean;
  isMedium: boolean;
  isWide: boolean;
  /** `medium` or `wide`: the sidebar shell and multi-column pages. */
  isDesktop: boolean;
  width: number;
  height: number;
};

export function layoutModeFor(width: number, platform: string = Platform.OS): LayoutMode {
  if (platform !== 'web') return 'compact';
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'compact';
}

const ScopeContext = createContext<LayoutMode | null>(null);

export type LayoutScopeProps = {
  /** The mode everything inside lays out in, whatever the window's width. */
  mode: LayoutMode;
  children: ReactNode;
};

/**
 * Lays its children out as if the window were in `mode`. The desktop web shows
 * some screens in a phone-sized frame (a dialog over the page); inside one,
 * `compact` keeps the screen's phone layout. `width` and `height` still report
 * the window.
 */
export function LayoutScope({ mode, children }: LayoutScopeProps) {
  return <ScopeContext value={mode}>{children}</ScopeContext>;
}

/** The current layout mode; re-renders when the window crosses a breakpoint. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const mode = use(ScopeContext) ?? layoutModeFor(width);
  return {
    mode,
    isCompact: mode === 'compact',
    isMedium: mode === 'medium',
    isWide: mode === 'wide',
    isDesktop: mode !== 'compact',
    width,
    height,
  };
}

export type ColumnsProps = {
  children: ReactNode;
  /** Relative widths of the columns, one per child (default: equal). */
  ratio?: readonly number[];
  /** Space between the columns, and between the stacked children on a phone. */
  gap?: number;
  /** The narrowest mode that shows columns; below it the children stack. `medium` by default. */
  from?: Exclude<LayoutMode, 'compact'>;
  /** Cross-axis alignment of the columns (default `flex-start`, so each keeps its own height). */
  align?: ViewStyle['alignItems'];
  style?: StyleProp<ViewStyle>;
};

/**
 * Side-by-side columns on the desktop web, a plain stack on phones. Each child
 * is one column; `null` children are skipped.
 */
export function Columns({ children, ratio, gap = 24, from = 'medium', align = 'flex-start', style }: ColumnsProps) {
  const { mode } = useLayout();
  const items = Children.toArray(children);
  const side = mode === 'wide' || (mode === 'medium' && from === 'medium');
  if (!side) return <View style={[{ gap }, style]}>{items}</View>;
  return (
    <View style={[{ flexDirection: 'row', alignItems: align, gap }, style]}>
      {items.map((child, index) => (
        <View key={index} style={{ flex: ratio?.[index] ?? 1, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export type GridProps = {
  children: ReactNode;
  /** A cell never gets narrower than this; the row wraps instead. 280 by default. */
  minItemWidth?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cards in rows that wrap: as many cells per row as fit `minItemWidth`, all
 * growing to share the row. One column on phones.
 */
export function Grid({ children, minItemWidth = 280, gap = 16, style }: GridProps) {
  const { isCompact } = useLayout();
  const items = Children.toArray(children);
  if (isCompact) return <View style={[{ gap }, style]}>{items}</View>;
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {items.map((child, index) => (
        <View key={index} style={{ flexGrow: 1, flexShrink: 1, flexBasis: minItemWidth, minWidth: 0 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export type PageHeaderProps = {
  title: string;
  /** Small line above the title ("Week 2 · Monday"). */
  kicker?: string;
  /** One line under the title. */
  subtitle?: string;
  /** Buttons on the right (they wrap under the title when there is no room). */
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * A desktop page's title row: kicker, display title, subtitle, and actions on
 * the right. Phones keep each screen's own TopBar and title instead.
 */
export function PageHeader({ title, kicker, subtitle, actions, style }: PageHeaderProps) {
  const { space } = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[4] },
        style,
      ]}>
      <View style={{ flexShrink: 1, minWidth: 240, gap: space[1] }}>
        {kicker ? (
          <Text variant="label" tone="tertiary">
            {kicker}
          </Text>
        ) : null}
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{actions}</View> : null}
    </View>
  );
}
