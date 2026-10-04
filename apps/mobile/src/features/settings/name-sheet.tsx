import { useState } from 'react';

import { useUpdateName } from '@/api/hooks';
import { isApiError } from '@/api/types';
import { Col } from '@/components/layout';
import { Button, Input, Sheet, Text } from '@/components/ui';
import { nameProblem } from '@/lib/person-name';

type NameSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The name now, or null when the account has none yet. */
  current: string | null;
};

/** Settings › Account › Name: the name Today and the You tab greet the person by. */
export function NameSheet({ visible, onClose, current }: NameSheetProps) {
  const update = useUpdateName();
  const [draft, setDraft] = useState(current ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  // Each opening starts from the saved name.
  const [openedFor, setOpenedFor] = useState(visible);
  if (visible !== openedFor) {
    setOpenedFor(visible);
    if (visible) {
      setDraft(current ?? '');
      setProblem(null);
    }
  }

  const close = () => {
    onClose();
    update.reset();
  };

  /** Return passes the field's own text: fast typing can submit before state catches up. */
  const save = (typed: string = draft) => {
    if (update.isPending) return;
    const found = nameProblem(typed);
    if (found) {
      setProblem(found);
      return;
    }
    update.mutate(typed, { onSuccess: close });
  };

  const fieldError = problem ?? (isApiError(update.error, 'validation') ? update.error.message : null);
  const requestError =
    update.isError && !fieldError ? "We couldn't save your name. Check your connection, then try again." : null;

  return (
    <Sheet visible={visible} onClose={close} title="Your name" description="We'll use it to greet you.">
      <Input
        accessibilityLabel="Your name"
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setProblem(null);
          if (update.isError) update.reset();
        }}
        error={fieldError}
        autoComplete="given-name"
        textContentType="givenName"
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={(event) => save(event.nativeEvent.text)}
      />
      {requestError ? (
        <Text variant="bodySm" tone="danger" accessibilityRole="alert" style={{ paddingHorizontal: 4 }}>
          {requestError}
        </Text>
      ) : null}
      <Col gap={8}>
        <Button onPress={() => save()} loading={update.isPending} fullWidth>
          Save
        </Button>
        <Button variant="ghost" onPress={close} fullWidth>
          Cancel
        </Button>
      </Col>
    </Sheet>
  );
}
