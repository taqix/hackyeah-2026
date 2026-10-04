import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import type { PreferenceSection } from '@/api/types';
import { Button, Icon, type IconName, PressableScale, Text } from '@/components/ui';
import { PREFERENCE_SECTIONS, SECTION_META } from '@/lib/preference-options';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme';

/**
 * You › Edit answers (desktop web): a menu of the onboarding steps, each opening
 * its question (9.4). Arrow keys move through it; Escape or a click outside closes it.
 */
export function EditAnswersMenu() {
  const router = useRouter();
  const { colors, radius, shadows } = useTheme();
  const [open, setOpen] = useState(false);
  const anchor = useRef<View>(null);

  useEffect(() => {
    if (!open || Platform.OS !== 'web') return undefined;
    // React Native Web hands back the DOM node for a view ref.
    const root = anchor.current as unknown as HTMLElement | null;
    const items = () => Array.from(root?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const trigger = () => root?.querySelector<HTMLElement>('button, [role="button"]');
    items()[0]?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger()?.focus();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (section: PreferenceSection) => {
    setOpen(false);
    router.push(routes.profileEdit(section));
  };

  return (
    <View ref={anchor} style={styles.anchor}>
      <Button
        variant="secondary"
        icon="pencil"
        iconRight={open ? 'chevron-up' : 'chevron-down'}
        onPress={() => setOpen((value) => !value)}
        accessibilityHint="Lists the questions behind your plan">
        Edit answers
      </Button>
      {open ? (
        <View
          role="menu"
          aria-label="Edit answers"
          style={[
            styles.menu,
            shadows[3],
            { backgroundColor: colors.surfaceRaised, borderColor: colors.borderSubtle, borderRadius: radius.md },
          ]}>
          {PREFERENCE_SECTIONS.map((section) => (
            <MenuItem
              key={section}
              icon={SECTION_META[section].icon}
              label={SECTION_META[section].label}
              onPress={() => choose(section)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MenuItem({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors, radius } = useTheme();
  return (
    <PressableScale
      role="menuitem"
      onPress={onPress}
      focusRing="inset"
      accessibilityLabel={label}
      style={({ hovered }) => [
        styles.item,
        { borderRadius: radius.sm, backgroundColor: hovered ? colors.hoverWash : 'transparent' },
      ]}>
      {({ hovered }) => (
        <>
          <Icon name={icon} size={18} color={hovered ? colors.textPrimary : colors.textSecondary} />
          <Text variant="bodyStrong" style={styles.label}>
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Above the cards that follow the header, so the open menu covers them.
  anchor: { zIndex: 20 },
  menu: {
    position: 'absolute',
    top: 56,
    right: 0,
    width: 260,
    padding: 6,
    borderWidth: 1,
    gap: 2,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12 },
  label: { flex: 1, minWidth: 0 },
});
