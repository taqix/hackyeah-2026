import { StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/theme';

import { SIDEBAR_ICON_CENTER, SIDEBAR_ROW } from './shell-metrics';

const ICON = 20;

export type NavItemProps = {
  label: string;
  icon: IconName;
  /** The page on screen belongs here; the sidebar's sliding pill sits behind it. */
  current: boolean;
  /** Icon only, with the label as a hover tooltip. */
  railed: boolean;
  onPress: () => void;
};

/**
 * A sidebar destination: icon and label, a wash on hover, the kit's focus ring.
 * The current one's pill is drawn by the sidebar, so it can slide between items.
 */
export function NavItem({ label, icon, current, railed, onPress }: NavItemProps) {
  const { colors, fontFamily } = useTheme();
  return (
    // Always wrapped, so folding to the rail never remounts the item (and drops its focus).
    <Tooltip label={railed ? label : ''} placement="right">
      <PressableScale
        accessibilityRole="tab"
        accessibilityLabel={label}
        aria-selected={current}
        onPress={onPress}
        scaleTo={0.98}
        style={({ hovered }) => [styles.item, hovered && !current ? { backgroundColor: colors.hoverWash } : null]}>
        {({ hovered }) => (
          <>
            <Icon
              name={icon}
              size={ICON}
              strokeWidth={current ? 2 : 1.75}
              color={current || hovered ? colors.textPrimary : colors.textTertiary}
            />
            {railed ? null : (
              <Text
                variant="label"
                numberOfLines={1}
                style={[
                  styles.label,
                  {
                    color: current || hovered ? colors.textPrimary : colors.textSecondary,
                    fontFamily: current ? fontFamily.bodySemibold : fontFamily.bodyMedium,
                  },
                ]}>
                {label}
              </Text>
            )}
          </>
        )}
      </PressableScale>
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  item: {
    height: SIDEBAR_ROW.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // The icon on the sidebar's icon column (inside the 1-point hairline); the label follows it.
    paddingLeft: SIDEBAR_ICON_CENTER - ICON / 2 - 1,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: { flexShrink: 1 },
});
