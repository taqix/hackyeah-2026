import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SportDefinition } from '@/api/types';
import { Badge, Icon, IconButton, Input, PressableScale, Text } from '@/components/ui';
import { Col } from '@/components/layout';
import { useTheme } from '@/theme';

import { isPickable, PREVIEW_REASON, searchSports, sportLabel } from './sport-catalog';

export type SportSearchProps = {
  sports: SportDefinition[];
  selected: string[];
  onAdd: (id: string) => void;
};

type HitProps = {
  sport: SportDefinition;
  label: string;
  added: boolean;
  divider: boolean;
  onPress: () => void;
};

function Hit({ sport, label, added, divider, onPress }: HitProps) {
  const { colors, fontFamily } = useTheme();
  const pickable = isPickable(sport);
  const a11yLabel = !pickable ? `${label}, preview. ${PREVIEW_REASON}` : added ? `${label}, added` : `Add ${label}`;
  return (
    <PressableScale
      onPress={onPress}
      disabled={!pickable}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      aria-disabled={!pickable} aria-selected={added}
      style={({ pressed }) => [
        styles.hit,
        divider ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle } : null,
        { backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
      ]}>
      <View style={styles.hitText}>
        <Text tone={pickable ? 'primary' : 'secondary'} style={{ fontFamily: fontFamily.bodyMedium }}>
          {label}
        </Text>
        {pickable ? null : <Text variant="caption">{PREVIEW_REASON}</Text>}
      </View>
      {!pickable ? (
        <Badge>Preview</Badge>
      ) : added ? (
        <Text variant="caption">Added</Text>
      ) : (
        <Icon name="plus" size={18} color={colors.accentText} />
      )}
    </PressableScale>
  );
}

/**
 * Search the whole sport catalog (3.2). Matches anywhere in the name; a pick
 * joins the tags above and clears the field; Enter picks the first match that
 * can be planned. A name with no match says so and changes nothing.
 */
export function SportSearch({ sports, selected, onAdd }: SportSearchProps) {
  const { colors, radius, shadows } = useTheme();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const hits = searchSports(sports, query);

  const add = (sport: SportDefinition) => {
    if (!isPickable(sport)) return;
    if (!selected.includes(sport.id)) onAdd(sport.id);
    setQuery('');
  };

  const submit = () => {
    const first = hits.find(isPickable);
    if (first) add(first);
  };

  return (
    <Col gap={8}>
      <Input
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submit}
        placeholder="Search more sports, like football"
        accessibilityLabel="Search more sports"
        autoComplete="off"
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        submitBehavior="submit"
        prefix={<Icon name="search" size={18} color={colors.textTertiary} />}
        suffix={
          query ? (
            <IconButton
              icon="x"
              size="sm"
              accessibilityLabel="Clear search"
              color={colors.textSecondary}
              onPress={() => setQuery('')}
              style={styles.clear}
            />
          ) : null
        }
      />
      {!trimmed ? null : hits.length ? (
        <View
          accessibilityLabel="Sports"
          style={[
            styles.list,
            shadows[1],
            { backgroundColor: colors.surfaceCard, borderColor: colors.borderSubtle, borderRadius: radius.md },
          ]}>
          {hits.map((sport, i) => (
            <Hit
              key={sport.id}
              sport={sport}
              label={sportLabel(sport.id, sports)}
              added={selected.includes(sport.id)}
              divider={i > 0}
              onPress={() => add(sport)}
            />
          ))}
        </View>
      ) : (
        <Text variant="bodySm" accessibilityLiveRegion="polite">
          {`No sport called “${trimmed}” yet. Pick another, or leave it to us.`}
        </Text>
      )}
    </Col>
  );
}

const styles = StyleSheet.create({
  clear: { marginRight: -10 },
  list: { borderWidth: 1, paddingVertical: 4 },
  hit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  hitText: { flex: 1, minWidth: 0, gap: 2 },
});
