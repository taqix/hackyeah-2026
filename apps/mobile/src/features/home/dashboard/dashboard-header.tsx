import { StyleSheet } from 'react-native';

import { PageHeader } from '@/components/layout';
import { Button } from '@/components/ui';

import { Appear } from './appear';
import { usePageWidth } from './dashboard-layout';
import { WeekSwitcher, type WeekSwitcherProps } from './week-switcher';

/** From this page width the actions sit beside the title; narrower, they move under it. */
const SIDE_BY_SIDE_MIN = 1080;

type DashboardHeaderProps = {
  /** "Sunday, 4 October · Week 3" */
  kicker: string;
  /** The greeting: "Good morning, Ana". */
  title: string;
  /** This week's summary. */
  subtitle?: string;
  /** The week control, once there is a plan to page through. */
  week: WeekSwitcherProps | null;
  onAskCoach: () => void;
};

/**
 * The page title row: today's date, the greeting and this week's summary, with
 * the week control and Ask your coach. It describes today, so paging the board
 * through other weeks leaves it as it is.
 */
export function DashboardHeader({ kicker, title, subtitle, week, onAskCoach }: DashboardHeaderProps) {
  const width = usePageWidth();
  return (
    <Appear>
      <PageHeader
        kicker={kicker}
        title={title}
        subtitle={subtitle}
        // Beside the title the summary wraps instead of pushing the actions to a line of their own.
        style={width >= SIDE_BY_SIDE_MIN ? styles.sideBySide : null}
        actions={
          <>
            {week ? <WeekSwitcher {...week} /> : null}
            <Button variant="inverse" icon="message-circle" onPress={onAskCoach}>
              Ask your coach
            </Button>
          </>
        }
      />
    </Appear>
  );
}

const styles = StyleSheet.create({
  sideBySide: { flexWrap: 'nowrap' },
});
