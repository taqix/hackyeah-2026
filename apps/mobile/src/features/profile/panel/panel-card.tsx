import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Card, type CardVariant, Text } from '@/components/ui';

type PanelCardProps = {
  children: ReactNode;
  title?: string;
  /** Small line under the title (who wrote it, since when). */
  caption?: string;
  /** At the right of the title: a link or a small button. */
  action?: ReactNode;
  /** Space between the title and the body. */
  gap?: number;
  padding?: number;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
};

/** A desktop dashboard card: a section title with an optional action, then its body. */
export function PanelCard({
  children,
  title,
  caption,
  action,
  gap = 12,
  padding = 24,
  variant = 'default',
  style,
}: PanelCardProps) {
  return (
    <Card variant={variant} padding={padding} style={style}>
      <View style={{ gap }}>
        {title || action ? (
          <View style={styles.head}>
            <View style={styles.titles}>
              {title ? (
                <Text variant="section" accessibilityRole="header">
                  {title}
                </Text>
              ) : null}
              {caption ? <Text variant="caption">{caption}</Text> : null}
            </View>
            {action}
          </View>
        ) : null}
        {children}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 32 },
  titles: { flex: 1, minWidth: 0, gap: 2 },
});
