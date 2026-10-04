import { Platform } from 'react-native';

import { useSession } from '@/api/hooks';
import { RowNote, useGoogleCalendarConnect } from '@/features/google-calendar';
import { dropStashedDraft, stashDraftForRedirect } from '@/state/onboarding-draft';

import { useCalendarAccess } from './calendar-access';
import { CalendarRow, GoogleCalendarRow } from './calendar-row';

/**
 * Review's calendar step: the phone's calendar and, where Google sign-in is
 * on, Google Calendar. Someone who signed in with Google sees Google Calendar
 * first. Both are optional; Build plan uses whichever is connected (Google's
 * free/busy first), else the preferred times.
 */
export function ReviewCalendarRows() {
  const phone = useCalendarAccess();
  const google = useGoogleCalendarConnect('review');
  const signedInWithGoogle = useSession().data?.user.provider === 'google';

  const connectGoogle = async () => {
    // The web page goes to Google and loads again: keep the answers for the page that comes back.
    const web = Platform.OS === 'web';
    if (web) stashDraftForRedirect();
    const outcome = await google.connect();
    if (web && outcome !== 'redirecting') dropStashedDraft();
  };

  const phoneRow = (
    <CalendarRow
      access={phone.access}
      canAskAgain={phone.canAskAgain}
      requesting={phone.requesting}
      onConnect={() => void phone.connect()}
      onOpenSettings={phone.openSettings}
      label={google.available ? 'Phone calendar' : 'Calendar'}
    />
  );
  if (!google.available) return phoneRow;

  const googleRow = (
    <GoogleCalendarRow google={google} suggested={signedInWithGoogle} onConnect={() => void connectGoogle()} />
  );
  return (
    <>
      {signedInWithGoogle ? googleRow : phoneRow}
      {signedInWithGoogle ? phoneRow : googleRow}
      {google.note ? <RowNote>{google.note}</RowNote> : null}
    </>
  );
}
