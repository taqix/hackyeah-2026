import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme';

import { TAB_BAR_HEIGHT, tabBarBottomOffset } from './bottom-clearance';
import { useOpenChat } from './open-chat';

type TabRoute = 'index' | 'calendar' | 'you';

const TAB_ITEMS: { route: TabRoute; label: string; icon: IconName }[] = [
  { route: 'index', label: 'Today', icon: 'sun' },
  { route: 'calendar', label: 'Calendar', icon: 'calendar' },
  { route: 'you', label: 'You', icon: 'user-round' },
];

/** `#RRGGBB` plus an alpha, for the prototype's color-mix(... transparent) fills. */
function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Android resizes the window for the keyboard, which would lift the bar over the input. */
function useAndroidKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Floating pill tab bar (prototype NavBar + ChatButton): Today · Calendar · You, the
 * active tab widened with its label, and the dark round chat button level with the bar.
 * Chat opens full screen over the current tab (design decision, develop 1e4c8e4).
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const keyboardVisible = useAndroidKeyboardVisible();
  const reducedMotion = useReducedMotion();
  const openChat = useOpenChat();

  if (keyboardVisible) return null;

  const focusedName = state.routes[state.index]?.name;
  const layoutTransition =
    reducedMotion || Platform.OS === 'web'
      ? undefined
      : LinearTransition.duration(theme.motion.durBase).easing(Easing.bezier(...theme.motion.easeOut));
  // Android has no backdrop to blur without wrapping every screen: use the solid raised surface.
  const blurred = Platform.OS !== 'android';

  const onTabPress = (name: TabRoute) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (focusedName !== name && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const onTabLongPress = (name: TabRoute) => {
    const route = state.routes.find((r) => r.name === name);
    if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: tabBarBottomOffset(insets.bottom),
          paddingLeft: theme.layout.gutter + insets.left,
          paddingRight: theme.layout.gutter + insets.right,
        },
      ]}>
      <View
        style={[
          styles.barShadow,
          theme.shadows[2],
          // Android draws elevation only under an opaque background.
          !blurred && { backgroundColor: colors.surfaceRaised },
        ]}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Main"
          style={[styles.bar, { borderColor: withAlpha(colors.borderSubtle, 0.8) }]}>
          {blurred ? (
            <>
              <BlurView
                intensity={40}
                tint={theme.scheme === 'dark' ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.barFill }]} />
            </>
          ) : null}
          {TAB_ITEMS.map((item) => {
            const active = item.route === focusedName;
            return (
              <Animated.View
                key={item.route}
                layout={layoutTransition}
                style={[styles.itemSlot, { flex: active ? 2 : 1 }]}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => onTabPress(item.route)}
                  onLongPress={() => onTabLongPress(item.route)}
                  style={({ pressed }) => [
                    styles.item,
                    active && {
                      backgroundColor: withAlpha(colors.textPrimary, 0.07),
                      borderColor: withAlpha(colors.textPrimary, 0.05),
                    },
                    pressed && { transform: [{ scale: theme.motion.pressScale }] },
                  ]}>
                  <Icon
                    name={item.icon}
                    size={22}
                    strokeWidth={active ? 2 : 1.75}
                    color={active ? colors.textPrimary : colors.textTertiary}
                  />
                  {active ? (
                    <Text
                      variant="label"
                      numberOfLines={1}
                      style={[styles.label, { fontFamily: theme.fontFamily.bodySemibold }]}>
                      {item.label}
                    </Text>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Chat"
        onPress={() => openChat()}
        style={({ pressed }) => [
          styles.chatButton,
          theme.shadows[2],
          { backgroundColor: colors.surfaceInverse },
          pressed && { transform: [{ scale: theme.motion.pressScale }] },
        ]}>
        <Icon name="message-circle" size={24} strokeWidth={2} color={colors.textInverse} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  barShadow: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 4,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    overflow: 'hidden',
  },
  itemSlot: {
    minWidth: 0,
    height: 52,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  label: {
    lineHeight: 16,
    flexShrink: 1,
  },
  chatButton: {
    width: TAB_BAR_HEIGHT,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
