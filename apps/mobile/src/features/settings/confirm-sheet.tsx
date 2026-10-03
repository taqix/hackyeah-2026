import { Col } from '@/components/layout';
import { Button, Sheet, Text } from '@/components/ui';

type ConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** The confirm action is running: its button spins and Cancel stays available. */
  busy?: boolean;
  /** Shown above the buttons when the action failed. */
  error?: string | null;
};

/** "Asks first": a sheet with the consequence, one confirm button and Cancel. */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  error,
}: ConfirmSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} description={description}>
      {error ? (
        <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: 4 }}>
          {error}
        </Text>
      ) : null}
      <Col gap={8}>
        <Button onPress={onConfirm} loading={busy} fullWidth>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onPress={onClose} fullWidth>
          Cancel
        </Button>
      </Col>
    </Sheet>
  );
}
