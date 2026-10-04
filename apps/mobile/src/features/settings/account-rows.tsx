import { useState } from 'react';

import { useAccount } from '@/api/hooks';
import { Col } from '@/components/layout';
import { ListRow, Skeleton } from '@/components/ui';

import { InlineError } from './inline-error';
import { NameSheet } from './name-sheet';
import { deviceTimeZone, timeZoneCity } from './time-zone';

/** Settings › Account: the email with how it signs in, the name we greet by (editable), and the phone's time zone. */
export function AccountRows() {
  const account = useAccount();
  const [editingName, setEditingName] = useState(false);

  if (account.isPending) {
    return (
      <Col gap={16} style={{ paddingVertical: 12 }} accessible accessibilityLabel="Loading your account">
        <Skeleton height={18} width="70%" />
        <Skeleton height={18} width="50%" />
      </Col>
    );
  }
  if (account.isError) {
    return (
      <InlineError
        message="We couldn't load your account. Check your connection, then try again."
        onRetry={() => void account.refetch()}
        retrying={account.isFetching}
      />
    );
  }

  const { user, timezone } = account.data;
  const zone = deviceTimeZone(timezone);
  return (
    <>
      <ListRow
        icon="mail"
        discSize={36}
        title={user.email}
        detail={user.provider === 'google' ? 'Signed in with Google' : 'Signed in with email'}
      />
      <ListRow
        icon="user-round"
        discSize={36}
        title="Name"
        detail={user.name ?? 'Not added yet'}
        accessibilityHint="Changes the name we greet you by"
        onPress={() => setEditingName(true)}
        divider
      />
      <ListRow icon="globe" discSize={36} title="Time zone" detail={`${timeZoneCity(zone)} · from your phone`} divider />
      <NameSheet visible={editingName} onClose={() => setEditingName(false)} current={user.name} />
    </>
  );
}
