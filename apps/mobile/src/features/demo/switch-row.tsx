import { Platform, Switch } from 'react-native';

import { type IconName, ListRow } from '@/components/ui';
import { useTheme } from '@/theme';

type SwitchRowProps = {
  icon: IconName;
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
};

/** A list row with a themed on/off switch at the right. */
export function SwitchRow({ icon, title, detail, value, onValueChange, divider }: SwitchRowProps) {
  const { colors } = useTheme();
  return (
    <ListRow
      icon={icon}
      discTone="quiet"
      discSize={36}
      title={title}
      detail={detail}
      divider={divider}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.borderStrong, true: colors.accent }}
          thumbColor={Platform.OS === 'android' ? colors.surfaceRaised : undefined}
          ios_backgroundColor={colors.borderStrong}
          accessibilityLabel={title}
          accessibilityHint={detail}
        />
      }
    />
  );
}
