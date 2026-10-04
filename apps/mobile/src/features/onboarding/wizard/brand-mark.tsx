import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MovoMark } from '@/navigation/web/movo-mark';

/** The mark and name at the top of the rail, sized and placed like the app sidebar's. */
export function BrandMark() {
  return (
    <View accessible accessibilityLabel="Movo" style={styles.brand}>
      <MovoMark size={32} />
      <Text variant="heading" numberOfLines={1}>
        Movo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
