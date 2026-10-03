import { StyleSheet, View } from 'react-native';

import { Col } from '@/components/layout';
import { Input, Segmented, Tag, Text } from '@/components/ui';
import type { SportMetric } from '@/api/types';

import { type FieldValue, fieldLabel } from './metric-form';

export type MetricFieldProps = {
  metric: SportMetric;
  value: FieldValue;
  error?: string;
  onChange: (value: FieldValue) => void;
};

const YES_NO = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
] as const;

/** Under a yes/no or chip field, announced like the Input's own error. */
function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <Text variant="caption" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
      {error}
    </Text>
  );
}

/**
 * One catalog metric as a field: numbers get the keypad (decimal when the
 * schema allows fractions), a boolean is yes/no, a string enum is chips, any
 * other string a text field.
 */
export function MetricField({ metric, value, error, onChange }: MetricFieldProps) {
  const s = metric.value_schema;
  const label = fieldLabel(metric);

  if (s.type === 'boolean') {
    return (
      <Col gap={8}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <Segmented<boolean>
          label={label}
          options={YES_NO}
          value={typeof value === 'boolean' ? value : null}
          onChange={(next) => onChange(!metric.required && next === value ? null : next)}
        />
        <FieldError error={error} />
      </Col>
    );
  }

  if (s.type === 'string' && s.enum) {
    return (
      <Col gap={8}>
        <Text variant="label" tone="secondary">
          {label}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
          {s.enum.map((option) => (
            <Tag
              key={option}
              label={option}
              selected={value === option}
              // Tapping the chosen chip again clears an optional answer.
              onPress={() => onChange(value === option && !metric.required ? null : option)}
            />
          ))}
        </View>
        <FieldError error={error} />
      </Col>
    );
  }

  const numeric = s.type === 'number' || s.type === 'integer';
  return (
    <Input
      label={label}
      value={typeof value === 'string' ? value : ''}
      onChangeText={onChange}
      placeholder={metric.required ? undefined : '–'}
      suffix={metric.unit}
      error={error}
      inputMode={numeric ? (s.type === 'integer' ? 'numeric' : 'decimal') : 'text'}
      keyboardType={numeric ? (s.type === 'integer' ? 'number-pad' : 'decimal-pad') : 'default'}
      returnKeyType="done"
      maxLength={s.type === 'string' ? s.maxLength : 8}
    />
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
