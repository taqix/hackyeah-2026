import type { SportDefinition } from '@/api/types';
import { Button, ChipGroup, Skeleton, Tag, Text } from '@/components/ui';
import { Col } from '@/components/layout';

import { tagSports } from './sport-catalog';

const GROUP_LABEL = 'What would you like to try?';

export type SportTagsProps = {
  sports: SportDefinition[];
  selected: string[];
  onToggle: (id: string) => void;
};

/** The suggested sports as tags, plus every pick from search, selected. */
export function SportTags({ sports, selected, onToggle }: SportTagsProps) {
  return (
    <ChipGroup label={GROUP_LABEL}>
      {tagSports(sports, selected).map((item) => (
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

/** Tag-shaped placeholders while the catalog loads. */
export function SportTagsLoading() {
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
