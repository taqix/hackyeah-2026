import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

import { useBottomClearance } from './bottom-clearance';

export type PlaceholderLink =
  | { label: string; href: Href; replace?: boolean }
  | { label: string; onPress: () => void };

type PlaceholderScreenProps = {
  title: string;
  /** Design screen id, for example `5` or `9.4`. */
  screenId: string;
  links?: PlaceholderLink[];
  /** Tab screens leave room for the floating tab bar. */
  tab?: boolean;
};

/**
 * Stand-in for a route until its screen lands, so the app is clickable end to end.
 * Phase-2 screens replace the route files that render this.
 */
export function PlaceholderScreen({ title, screenId, links = [], tab = false }: PlaceholderScreenProps) {
  const theme = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomClearance = useBottomClearance();
  const params = useLocalSearchParams();
  const paramText = Object.entries(params)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' · ');

  const all: PlaceholderLink[] = router.canGoBack()
    ? [{ label: 'Back', onPress: () => router.back() }, ...links]
    : links;

  const follow = (link: PlaceholderLink) => {
    if ('onPress' in link) link.onPress();
    else if (link.replace) router.replace(link.href);
    else router.push(link.href);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.bgApp }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 24,
          paddingBottom: tab ? bottomClearance : insets.bottom + 24,
          paddingHorizontal: theme.layout.gutter,
        },
      ]}>
      <View style={styles.header}>
        <Text variant="caption">Screen {screenId} · placeholder</Text>
        <Text variant="h1" accessibilityRole="header">
          {title}
        </Text>
        {paramText ? <Text variant="bodySm">{paramText}</Text> : null}
      </View>
      <View style={styles.links}>
        {all.map((link) => (
          <Pressable
            key={link.label}
            accessibilityRole="link"
            onPress={() => follow(link)}
            style={({ pressed }) => [
              styles.link,
              { backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceCard, borderColor: colors.borderSubtle },
            ]}>
            <Text variant="bodyStrong" tone="accent">
              {link.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  links: {
    gap: 8,
  },
  link: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
