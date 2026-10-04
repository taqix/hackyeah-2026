import { StyleSheet, View } from 'react-native';

import type { SportDefinition, SportMetric } from '@/api/types';

import { MetricField } from './metric-field';
import { type FieldValue, type FormErrors, type FormValues, isCompact } from './metric-form';

/** Numbers and text two to a row (a grid once there are 2+ metrics); yes/no and chips full width. */
function fieldRows(metrics: SportMetric[]): SportMetric[][] {
  const rows: SportMetric[][] = [];
  for (const m of metrics) {
    const last = rows[rows.length - 1];
    if (metrics.length > 1 && isCompact(m) && last?.length === 1 && isCompact(last[0])) last.push(m);
    else rows.push([m]);
  }
  return rows;
}

export type MetricFieldsProps = {
  sport: SportDefinition;
  metrics: SportMetric[];
  values: FormValues;
  errors: FormErrors;
  onChange: (key: string, value: FieldValue) => void;
  /** Enter in a typed field, on the desktop web. */
  onSubmit?: () => void;
};

/** One field per catalog metric of the sport, laid out in rows. */
export function MetricFields({ sport, metrics, values, errors, onChange, onSubmit }: MetricFieldsProps) {
  return (
    <View accessibilityLabel={sport.name} style={styles.fields}>
      {fieldRows(metrics).map((row) => (
        <View key={row.map((m) => m.key).join('+')} style={styles.row}>
          {row.map((m) => (
            <View key={m.key} style={styles.cell}>
              <MetricField
                metric={m}
                value={values[m.key] ?? null}
                error={errors[m.key]}
                onChange={(value) => onChange(m.key, value)}
                onSubmit={onSubmit}
              />
            </View>
          ))}
          {row.length === 1 && metrics.length > 1 && isCompact(row[0]) ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cell: { flex: 1, minWidth: 0 },
});
