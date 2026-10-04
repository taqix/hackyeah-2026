import { type Href, useRouter } from 'expo-router';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme';

type BackLinkProps = {
  /** The parent page's name ("You", "Settings"). */
  label: string;
  /** The parent page. */
  href: Href;
};

/**
 * A nested desktop page's way up, above its title: an arrow and the parent
 * page's name. It returns to that page in the history when it is there, and
 * opens it in place of this one otherwise (a page opened from a link).
 */
export function BackLink({ label, href }: BackLinkProps) {
  const router = useRouter();
  const { colors, radius } = useTheme();
  return (
    <PressableScale
      onPress={() => router.dismissTo(href)}
      accessibilityRole="link"
      accessibilityLabel={`Back to ${label}`}
      style={({ hovered }) => ({
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingLeft: 8,
        paddingRight: 12,
        marginLeft: -8,
        borderRadius: radius.pill,
        backgroundColor: hovered ? colors.hoverWash : 'transparent',
      })}>
      {({ hovered }) => (
        <>
          <Icon name="arrow-left" size={16} color={hovered ? colors.textPrimary : colors.textSecondary} />
          <Text variant="label" tone={hovered ? 'primary' : 'secondary'}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}
