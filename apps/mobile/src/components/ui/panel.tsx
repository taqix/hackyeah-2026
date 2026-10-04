import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useLayout } from '@/components/layout/responsive';

import { Card, type CardVariant } from './card';
import { Disc, type DiscTone } from './disc';
import type { IconName } from './icon';
import { Text } from './text';

export type PanelProps = {
  title: string;
  /** One quiet line under the title. */
  caption?: string;
  /** A small tinted disc before the title. */
  icon?: IconName;
  iconTone?: DiscTone;
  /** Controls at the head's right: a TextLink, a small Button, IconButtons. */
  actions?: ReactNode;
  children?: ReactNode;
  /** The card's surface: default, or sunken for secondary information. */
  variant?: CardVariant;
  /** Inner padding: 24 on the desktop web, the card's 20 on phones. */
  padding?: number;
  /** Space between the head and the body, and between body children; 16 by default. */
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/** A titled card section for desktop dashboards: icon, title, caption and actions over the body. */
export function Panel({
  title,
  caption,
  icon,
  iconTone = 'accent',
  actions,
  children,
  variant = 'default',
  padding,
  gap = 16,
  style,
}: PanelProps) {
  const { isDesktop } = useLayout();
  return (
    <Card variant={variant} padding={padding ?? (isDesktop ? 24 : 20)} style={[{ gap }, style]}>
      <View style={styles.head}>
        {icon ? <Disc icon={icon} tone={iconTone} size={36} /> : null}
        <View style={styles.headText}>
          <Text variant="section" accessibilityRole="header">
            {title}
          </Text>
          {caption ? <Text variant="bodySm" tone="tertiary">{caption}</Text> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
});
