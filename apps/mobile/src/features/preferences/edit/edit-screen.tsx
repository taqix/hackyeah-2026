import { useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { usePreferences, useSavePreferences } from '@/api/hooks';
import type { PreferenceSection, Preferences } from '@/api/types';
import { Button, Card, Icon, Spinner, Text } from '@/components/ui';
import { BackButton, BottomBar, Col, Content, H1, Row, Screen, TopBar } from '@/components/layout';
import { useBottomBarInset } from '@/features/onboarding/review/bottom-bar-inset';
import { STEP_BODIES } from '@/features/preferences/steps';
import { SECTION_META } from '@/lib/preference-options';
import { draftToPreferences, type OnboardingDraft, stepIsComplete } from '@/state/onboarding-draft';
import { useTheme } from '@/theme';

import { draftFromPreferences, patchDraft } from './edit-draft';

/** Room for the caption above Save, and for the failure line when a save fails. */
const CAPTION_LINE = 28;
const FAILURE_LINE = 52;

function Centered({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 20 }}>
      {children}
    </View>
  );
}

/** Chrome for the states before the form: back arrow and a centred message. */
function EditState({ children }: { children: ReactNode }) {
  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Centered>{children}</Centered>
    </Screen>
  );
}

/**
 * 9.4 Edit: one onboarding step in edit chrome. Same questions and rules, a back
 * arrow instead of steps, and Save instead of Continue.
 */
export function EditAnswersScreen({ section }: { section: PreferenceSection | null }) {
  const router = useRouter();
  const preferences = usePreferences();

  if (!section) {
    return (
      <EditState>
        <Text variant="heading" align="center">
          We couldn&apos;t find that question
        </Text>
        <Button variant="secondary" onPress={() => router.replace('/you')}>
          Back to You
        </Button>
      </EditState>
    );
  }
  if (preferences.isPending) {
    return (
      <EditState>
        <Spinner accessibilityLabel="Loading your answers" />
      </EditState>
    );
  }
  if (preferences.isError) {
    return (
      <EditState>
        <View accessibilityRole="alert" style={{ gap: 8 }}>
          <Text variant="heading" align="center">
            We couldn&apos;t load your answers
          </Text>
          <Text variant="bodySm" align="center">
            Check your connection, then try again.
          </Text>
        </View>
        <Button variant="secondary" icon="refresh-cw" onPress={() => void preferences.refetch()}>
          Try again
        </Button>
      </EditState>
    );
  }
  if (!preferences.data) {
    return (
      <EditState>
        <Text variant="heading" align="center">
          No answers yet
        </Text>
        <Button onPress={() => router.replace('/onboarding/starting')}>Answer the questions</Button>
      </EditState>
    );
  }
  return <EditForm key={section} section={section} saved={preferences.data} />;
}

function EditForm({ section, saved }: { section: PreferenceSection; saved: Preferences }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<OnboardingDraft>(() => draftFromPreferences(saved));
  const save = useSavePreferences();
  const StepBody = STEP_BODIES[section];
  const complete = stepIsComplete(section, draft);
  const inset = useBottomBarInset(CAPTION_LINE + (save.isError ? FAILURE_LINE : 0));

  const update = (patch: Partial<OnboardingDraft>) => setDraft((current) => patchDraft(current, patch));
  const onSave = () =>
    save.mutate(draftToPreferences(draft, saved), {
      onSuccess: () => {
        if (router.canGoBack()) router.back();
        else router.replace('/you');
      },
    });

  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <Content bottomInset={inset}>
        <H1>{SECTION_META[section].label}</H1>
        <StepBody draft={draft} update={update} mode="edit" />
        {section === 'time' ? (
          <Card variant="sunken" padding={16}>
            <Row gap={12} style={{ alignItems: 'flex-start' }}>
              <Icon name="calendar-clock" size={18} color={colors.textSecondary} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                We plan around what&apos;s in your calendar and keep to your time of day when we can.
              </Text>
            </Row>
          </Card>
        ) : null}
      </Content>
      <BottomBar>
        <Col gap={10} style={{ flex: 1 }}>
          {save.isError ? (
            <Text variant="bodySm" tone="danger" align="center" accessibilityRole="alert">
              We couldn&apos;t save your answers. Check your connection, then try again.
            </Text>
          ) : (
            <Text variant="caption" align="center">
              Upcoming sessions follow your answers. Done ones stay.
            </Text>
          )}
          <Button size="lg" fullWidth disabled={!complete} loading={save.isPending} onPress={onSave}>
            {save.isError ? 'Try again' : 'Save'}
          </Button>
        </Col>
      </BottomBar>
    </Screen>
  );
}
