import { type Href, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Disc, type IconName, PressableScale, Text } from '@/components/ui';
import { useOpenChat } from '@/navigation/open-chat';
import { useTheme } from '@/theme';

type Link = { icon: IconName; title: string; detail: string; href?: Href; chat?: true };

const LINKS: Link[] = [
  { icon: 'settings', title: 'Settings', detail: 'Appearance and account', href: '/settings' },
  { icon: 'shield-check', title: 'Data and privacy', detail: 'What our assistant sees', href: '/settings/privacy' },
  { icon: 'history', title: 'Plan history', detail: 'Every version of your plan', href: '/plan-history' },
  { icon: 'message-circle', title: 'Ask your coach', detail: 'Change your plan in chat', chat: true },
];

/** You (desktop): the places people reach from here, as small tiles in two columns. */
export function QuickLinks() {
  const router = useRouter();
  const openChat = useOpenChat();
  return (
    <View style={styles.wrap}>
      <Text variant="section" accessibilityRole="header">
        Shortcuts
      </Text>
      <View style={styles.grid}>
        {LINKS.map((link) => (
          <Tile
            key={link.title}
            link={link}
            onPress={() => (link.chat ? openChat() : link.href ? router.push(link.href) : undefined)}
          />
        ))}
      </View>
    </View>
  );
}

function Tile({ link, onPress }: { link: Link; onPress: () => void }) {
  const { colors, radius, shadows, motion } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={motion.pressScaleCard}
      lift={2}
      accessibilityRole={link.chat ? 'button' : 'link'}
      accessibilityLabel={link.title}
      accessibilityHint={link.detail}
      style={({ hovered }) => [
        styles.tile,
        hovered ? shadows[2] : shadows[1],
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceCard,
          borderColor: hovered ? colors.borderStrong : colors.borderSubtle,
        },
      ]}>
      <Disc icon={link.icon} tone={link.chat ? 'accent' : 'quiet'} size={36} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {link.title}
        </Text>
        <Text variant="caption" numberOfLines={2}>
          {link.detail}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 0,
    gap: 12,
    padding: 16,
    borderWidth: 1,
  },
  text: { gap: 2 },
});
