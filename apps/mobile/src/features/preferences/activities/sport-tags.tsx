import type { SportDefinition } from '@/api/types';
import { Button, ChipGroup, Skeleton, Tag, Text } from '@/components/ui';
import { Col, useLayout } from '@/components/layout';
import { ChoiceGrid, OptionCard, SPORT_FALLBACK_ICON, TileGrid } from '@/features/preferences/choices';

import { tagSports } from './sport-catalog';

const GROUP_LABEL = 'What would you like to try?';
/** The desktop's sport cards drop a column below this width. */
const CARD_MIN_WIDTH = 176;

export type SportTagsProps = {
  sports: SportDefinition[];
  selected: string[];
  onToggle: (id: string) => void;
};

/**
 * The suggested sports, plus every pick from search, selected: tags on a
 * phone, a grid of cards on the desktop web.
 */
export function SportTags({ sports, selected, onToggle }: SportTagsProps) {
  const { isDesktop } = useLayout();
  const items = tagSports(sports, selected);
  if (isDesktop) {
    return (
      <ChoiceGrid label={GROUP_LABEL} kind="checkbox" minItemWidth={CARD_MIN_WIDTH}>
        {items.map((item) => (
          <OptionCard
            key={item.id}
            kind="checkbox"
            layout="stacked"
            icon={item.icon ?? SPORT_FALLBACK_ICON}
            label={item.label}
            selected={selected.includes(item.id)}
            onPress={() => onToggle(item.id)}
          />
        ))}
      </ChoiceGrid>
    );
  }
  return (
    <ChipGroup label={GROUP_LABEL}>
      {items.map((item) => (
        <Tag
          key={item.id}
          label={item.label}
          icon={item.icon}
          selected={selected.includes(item.id)}
          onPress={() => onToggle(item.id)}
        />
      ))}
    </ChipGroup>
  );
}

const SKELETON_WIDTHS = [84, 176, 72, 76, 76, 184];

/** Tag-shaped (or, on the desktop web, card-shaped) placeholders while the catalog loads. */
export function SportTagsLoading() {
  const { isDesktop } = useLayout();
  if (isDesktop) {
    return (
      <TileGrid minItemWidth={CARD_MIN_WIDTH}>
        {SKELETON_WIDTHS.map((_, i) => (
          <Skeleton key={i} height={104} radius={18} />
        ))}
      </TileGrid>
    );
  }
  return (
    <ChipGroup label="Loading sports">
      {SKELETON_WIDTHS.map((width, i) => (
        <Skeleton key={i} width={width} height={40} radius={999} />
      ))}
    </ChipGroup>
  );
}

/** The catalog failed to load. */
export function SportTagsError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Col gap={10} accessibilityRole="alert">
      <Text variant="bodySm">{"We couldn't load the sports. Check your connection and try again."}</Text>
      <Button variant="secondary" size="sm" icon="refresh-cw" loading={retrying} onPress={onRetry} style={{ alignSelf: 'flex-start' }}>
        Try again
      </Button>
    </Col>
  );
}
