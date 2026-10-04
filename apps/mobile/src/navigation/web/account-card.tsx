import { StyleSheet, View } from 'react-native';

import { useSession } from '@/api/hooks';
import { isGuest, type User } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/theme';

import { activeNavFill } from '../nav-colors';
import { SIDEBAR_ICON_CENTER } from './shell-metrics';

const AVATAR = 36;

/** The name the account goes by here: its own, "Guest" for a guest, else its email. */
function displayName(user: User): string {
  return user.name?.trim() || (isGuest(user) ? 'Guest' : user.email);
}

function Avatar({ user }: { user: User | null }) {
  const { colors, fontFamily } = useTheme();
  if (!user || isGuest(user)) {
    return (
      <View style={[styles.avatar, { backgroundColor: colors.surfaceSunken }]}>
        {user ? <Icon name="user-round" size={18} color={colors.textSecondary} /> : null}
      </View>
    );
  }
  return (
    <View style={[styles.avatar, { backgroundColor: colors.accentSoftStrong }]}>
      <Text style={[styles.initial, { color: colors.accentText, fontFamily: fontFamily.bodySemibold }]}>
        {Array.from(displayName(user))[0]?.toUpperCase() ?? ''}
      </Text>
    </View>
  );
}

export type AccountCardProps = {
  railed: boolean;
  /** Settings is on screen. */
  current: boolean;
  onPress: () => void;
};

/**
 * The sidebar's foot: who is signed in (a Guest badge for a web guest) and the
 * way to Settings, where the account, appearance and sign-out live.
 */
export function AccountCard({ railed, current, onPress }: AccountCardProps) {
  const { colors } = useTheme();
  const session = useSession();
  const user = session.data?.user ?? null;
  const guest = isGuest(user);
  const name = user ? displayName(user) : '';
  const label = user ? `Settings. Signed in as ${guest ? 'a guest' : name}` : 'Settings';

  return (
    <Tooltip label={railed ? (user ? `Settings · ${name}` : 'Settings') : ''} placement="right">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        scaleTo={0.99}
        style={({ hovered }) => [
          styles.card,
          current ? activeNavFill(colors) : hovered ? { backgroundColor: colors.hoverWash } : null,
        ]}>
        {({ hovered }) => (
          <>
            <Avatar user={user} />
            {railed ? null : (
              <>
                <View style={styles.who}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </Text>
                  {guest ? (
                    <Badge tone="warm">Guest</Badge>
                  ) : user && user.name?.trim() ? (
                    <Text variant="caption" numberOfLines={1}>
                      {user.email}
                    </Text>
                  ) : null}
                </View>
                <Icon
                  name="settings"
                  size={18}
                  color={hovered || current ? colors.textPrimary : colors.textTertiary}
                />
              </>
            )}
          </>
        )}
      </PressableScale>
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // The avatar on the sidebar's icon column (inside the 1-point hairline).
    paddingLeft: SIDEBAR_ICON_CENTER - AVATAR / 2 - 1,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontSize: 15, lineHeight: 18 },
  who: { flex: 1, minWidth: 0, gap: 3 },
});
