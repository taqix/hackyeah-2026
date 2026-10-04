import { StyleSheet } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Tooltip } from '@/components/ui/tooltip';
import { useTheme } from '@/theme';

import { useCoachDock } from './coach-dock';
import { SIDEBAR_ICON_CENTER, SIDEBAR_ROW } from './shell-metrics';
import { coachShortcutLabel } from './shortcuts';

const ICON = 20;

/**
 * "Ask your coach": the phone's dark round chat button, as the sidebar's main
 * action. It opens and closes the coach dock (also ⌘K / Ctrl+K) and turns to
 * the accent while the dock is open.
 */
export function CoachButton({ railed }: { railed: boolean }) {
  const { colors, fontFamily } = useTheme();
  const dock = useCoachDock();
  const shortcut = coachShortcutLabel();
  const ink = dock.open ? colors.textOnAccent : colors.textInverse;

  return (
    <Tooltip label={railed ? `Ask your coach · ${shortcut}` : ''} placement="right">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Ask your coach"
        accessibilityHint={dock.open ? 'Closes the coach panel' : 'Opens the coach beside the page'}
        aria-expanded={dock.open}
        onPress={dock.toggle}
        style={({ hovered }) => [
          styles.button,
          {
            backgroundColor: dock.open ? (hovered ? colors.accentHover : colors.accent) : colors.surfaceInverse,
            opacity: !dock.open && hovered ? 0.88 : 1,
          },
        ]}>
        <Icon name="message-circle" size={ICON} strokeWidth={2} color={ink} />
        {railed ? null : (
          <>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: ink, fontFamily: fontFamily.bodySemibold }]}>
              Ask your coach
            </Text>
            <Text variant="caption" style={[styles.shortcut, { color: ink }]}>
              {shortcut}
            </Text>
          </>
        )}
      </PressableScale>
    </Tooltip>
  );
}

const styles = StyleSheet.create({
  button: {
    height: SIDEBAR_ROW.height + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // The icon on the sidebar's icon column.
    paddingLeft: SIDEBAR_ICON_CENTER - ICON / 2,
    paddingRight: 14,
    borderRadius: 999,
  },
  label: { flex: 1, fontSize: 15, lineHeight: 18 },
  shortcut: { opacity: 0.62 },
});
