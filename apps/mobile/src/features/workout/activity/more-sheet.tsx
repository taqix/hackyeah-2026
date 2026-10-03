import { useState } from 'react';

import { usePreferences, useSetSportExcluded } from '@/api/hooks';
import { Col, Row } from '@/components/layout';
import { Button, ListRow, Sheet, Text } from '@/components/ui';

/**
 * The session's More menu: switch its whole activity off (asks first) or back
 * on. Future plans leave a switched-off activity out; this session stays.
 */
export function MoreSheet({
  visible,
  onClose,
  title,
  sportId,
  sportLabel,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  sportId: string;
  /** Lower case, for sentences: "running". */
  sportLabel: string;
  onChanged: (excluded: boolean) => void;
}) {
  const prefs = usePreferences();
  const setExcluded = useSetSportExcluded();
  const [confirming, setConfirming] = useState(false);
  const excluded = prefs.data?.excluded_activity_types.includes(sportId) ?? false;

  const close = () => {
    setConfirming(false);
    setExcluded.reset();
    onClose();
  };

  const apply = (next: boolean) =>
    setExcluded.mutate(
      { sportId, excluded: next },
      {
        onSuccess: () => {
          setConfirming(false);
          onChanged(next);
          onClose();
        },
      },
    );

  const failure = setExcluded.isError ? (
    <Text variant="bodySm" tone="danger" accessibilityRole="alert">
      We couldn&apos;t change that. Try again.
    </Text>
  ) : null;

  if (confirming) {
    return (
      <Sheet
        visible={visible}
        onClose={close}
        title={`Switch off ${sportLabel}?`}
        description={`Future plans leave ${sportLabel} out. This session stays, and you can switch it back on in Your feedback.`}>
        <Col gap={12} style={{ paddingTop: 8 }}>
          {failure}
          <Row gap={12}>
            <Button variant="secondary" onPress={() => setConfirming(false)} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button onPress={() => apply(true)} loading={setExcluded.isPending} style={{ flex: 1 }}>
              Switch off
            </Button>
          </Row>
        </Col>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={close} title={title} showClose>
      <Col gap={8}>
        {excluded ? (
          <ListRow
            icon="rotate-ccw"
            discTone="quiet"
            title={`Switch ${sportLabel} back on`}
            detail="Future plans can include it again."
            onPress={() => apply(false)}
            chevron={false}
            disabled={setExcluded.isPending || prefs.isPending}
          />
        ) : (
          <ListRow
            icon="ban"
            discTone="quiet"
            title={`Switch off ${sportLabel}`}
            detail={`Future plans leave ${sportLabel} out.`}
            onPress={() => setConfirming(true)}
            chevron={false}
            disabled={prefs.isPending}
          />
        )}
        {failure}
      </Col>
    </Sheet>
  );
}
