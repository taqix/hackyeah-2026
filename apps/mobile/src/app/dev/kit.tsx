import { Redirect, Stack } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  BackButton,
  Body,
  BottomBar,
  Col,
  Content,
  H1,
  H2,
  Kicker,
  Row,
  Screen,
  Section,
  Steps,
  TopBar,
} from '@/components/layout';
import {
  Badge,
  type BadgeTone,
  Button,
  type ButtonVariant,
  Card,
  CheckList,
  ChipGroup,
  Disc,
  type DiscTone,
  Divider,
  ExerciseMedia,
  ExerciseRow,
  IconButton,
  Input,
  ListRow,
  ProgressRing,
  Question,
  Radio,
  RadioCard,
  RadioGroup,
  RangeSlider,
  type RangeValue,
  Segmented,
  Sheet,
  Skeleton,
  Slider,
  Spinner,
  SuggestionCard,
  suggestionInk,
  Tag,
  Text,
  TextLink,
} from '@/components/ui';
import { type Appearance, ThemeProvider, useAppearance, useTheme } from '@/theme';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'inverse'];
const BADGE_TONES: BadgeTone[] = ['neutral', 'accent', 'recovery', 'success', 'danger', 'info', 'warm'];
const DISC_TONES: DiscTone[] = ['accent', 'success', 'recovery', 'warm', 'info', 'danger', 'quiet'];
const PLACES = [
  { value: 'home', label: 'Home', icon: 'house' },
  { value: 'outdoors', label: 'Outdoors', icon: 'tree-pine' },
  { value: 'gym', label: 'Gym', icon: 'building-2' },
  { value: 'pool', label: 'Swimming pool', icon: 'waves' },
] as const;
const FEELINGS = [
  { value: 'easy', label: 'Easy', description: 'Could have kept going' },
  { value: 'right', label: 'Just right', description: 'Tired, but good' },
  { value: 'hard', label: 'Hard', description: 'Needed every walk break' },
];
const AVOID = [
  { value: 'jumping', label: 'Jumping' },
  { value: 'floor_exercises', label: 'Floor exercises' },
  { value: 'noisy_activities', label: 'Noisy activities' },
];
const WINDOW = { min: 7, max: 21, step: 1 };
const hourText = (h: number) => `${h}:00`;
const windowText = ([a, b]: RangeValue) =>
  a <= WINDOW.min && b >= WINDOW.max ? 'Any time' : `${hourText(a)}–${hourText(b)}`;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Col gap={12}>
      <Section>{title}</Section>
      {children}
    </Col>
  );
}

function Gallery() {
  const { colors } = useTheme();
  const [appearance, setAppearance] = useAppearance();
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState<string[]>(['outdoors']);
  const [feeling, setFeeling] = useState('right');
  const [plain, setPlain] = useState('a');
  const [sessions, setSessions] = useState(3);
  const [minutes, setMinutes] = useState(20);
  const [timeWindow, setTimeWindow] = useState<RangeValue>([7, 11]);
  const [avoid, setAvoid] = useState<string[]>(['jumping']);
  const [days, setDays] = useState(3);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [ring, setRing] = useState(2 / 3);
  const [sheet, setSheet] = useState(false);
  const [bar, setBar] = useState(false);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const emailError = email.length > 0 && !email.includes('@') ? 'Enter an email like you@example.com.' : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <TopBar left={<BackButton />} title="UI kit" right={<IconButton icon="settings" accessibilityLabel="Settings" />} />
      <Content bottomInset={bar ? 'bottomBar' : 'safe'} gap={32}>
        <Block title="Appearance">
          <Segmented<Appearance>
            label="Appearance"
            value={appearance}
            onChange={setAppearance}
            options={[
              { value: 'system', label: 'Phone' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Block>

        <Block title="Type">
          <Col gap={6}>
            <Kicker>Today · 7:00 · 20 min</Kicker>
            <H1>Walk-run intervals</H1>
          </Col>
          <H2>Goblet squat</H2>
          <Body>No wrong answers. This sets how gentle your first week is.</Body>
          <Text variant="hero" tabular>
            42
          </Text>
          <Text variant="bodySm">Body small, secondary by default.</Text>
          <Text variant="caption">Caption, tertiary by default.</Text>
        </Block>

        <Block title="Buttons">
          {BUTTON_VARIANTS.map((variant) => (
            <Row key={variant} gap={8} style={{ flexWrap: 'wrap' }}>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} icon="calendar">
                Medium
              </Button>
              <Button variant={variant} size="lg" iconRight="arrow-right">
                Large
              </Button>
            </Row>
          ))}
          <Button fullWidth size="lg" iconRight="check" loading={loading} onPress={() => setLoading(true)}>
            {loading ? 'Saving' : 'Save (tap for loading)'}
          </Button>
          {loading ? (
            <Button variant="ghost" size="sm" onPress={() => setLoading(false)} style={{ alignSelf: 'flex-start' }}>
              Reset
            </Button>
          ) : null}
          <Row gap={12}>
            <Button variant="secondary" size="lg">
              Adjust
            </Button>
            <Button size="lg" fullWidth disabled iconRight="check">
              Disabled
            </Button>
          </Row>
          <Row gap={8}>
            <IconButton icon="arrow-left" accessibilityLabel="Back" />
            <IconButton icon="ellipsis" accessibilityLabel="More" variant="secondary" />
            <IconButton icon="plus" accessibilityLabel="Add" variant="primary" />
            <IconButton icon="x" accessibilityLabel="Close" size="sm" />
            <IconButton icon="trash-2" accessibilityLabel="Delete" disabled />
          </Row>
          <TextLink onPress={() => setSheet(true)}>See the chat</TextLink>
          <TextLink tone="quiet">Privacy policy</TextLink>
        </Block>

        <Block title="Badges and tags">
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {BADGE_TONES.map((tone, i) => (
              <Badge key={tone} tone={tone} dot={i % 2 === 0} icon={i === 1 ? 'check' : undefined}>
                {tone}
              </Badge>
            ))}
          </Row>
          <ChipGroup label="Where could you move?">
            {PLACES.map((p) => (
              <Tag
                key={p.value}
                label={p.label}
                icon={p.icon}
                selected={places.includes(p.value)}
                onPress={() => setPlaces((list) => toggle(list, p.value))}
              />
            ))}
            <Tag label="Disabled" disabled />
          </ChipGroup>
        </Block>

        <Block title="Cards">
          <Card>
            <Text variant="bodyStrong">Default card</Text>
            <Text variant="bodySm">Surface, hairline, shadow 1.</Text>
          </Card>
          <Card variant="sunken" padding={16}>
            <Text variant="bodySm">Sunken card for secondary info.</Text>
          </Card>
          <Card variant="accent">
            <Text variant="bodySm">Accent card.</Text>
          </Card>
          <Card variant="outline" onPress={() => setRing((v) => (v >= 1 ? 0 : Math.min(1, v + 1 / 3)))} accessibilityLabel="Advance ring">
            <Text variant="bodySm">Outline card, pressable (0.99). Advances the ring below.</Text>
          </Card>
        </Block>

        <Block title="Discs, loaders, divider">
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {DISC_TONES.map((tone) => (
              <Disc key={tone} tone={tone} icon="footprints" />
            ))}
            <Disc icon="loader-circle" size={32} spin />
            <Spinner />
          </Row>
          <Col gap={8}>
            <Skeleton width="74%" />
            <Skeleton width="52%" height={12} />
          </Col>
          <Divider />
          <Row gap={16}>
            <ProgressRing value={ring} size={64} label={`${Math.round(ring * 3)}/3`} accessibilityLabel={`${Math.round(ring * 3)} of 3 sessions done this week`} />
            <ExerciseMedia icon="wind" />
            <Steps step={2} total={5} style={{ flex: 1 }} />
          </Row>
        </Block>

        <Block title="List rows">
          <View>
            <ListRow icon="calendar-clock" label="Time" title="3 days a week · 20 min" detail="7:00–11:00" onPress={() => undefined} />
            <ListRow icon="shield-check" discTone="quiet" discSize={36} title="Data and privacy" detail="Connections and what our assistant sees" onPress={() => undefined} divider />
            <ListRow icon="globe" discTone="quiet" discSize={36} title="Time zone" detail="Warsaw · from your phone" divider />
            <ListRow icon="calendar" title="Calendar" detail="We only see when you're busy." divider right={<Button variant="secondary" size="sm">Connect</Button>} />
            <ListRow icon="moon" discTone="quiet" title="Appearance" value="Phone" onPress={() => undefined} divider />
          </View>
        </Block>

        <Block title="Inputs">
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            inputMode="email"
            autoComplete="email"
            textContentType="emailAddress"
            autoCapitalize="none"
            returnKeyType="next"
            error={emailError}
          />
          <Input label="Password" secure autoComplete="current-password" hint="At least 8 characters." />
          <Input label="Weight" inputMode="decimal" suffix="kg" defaultValue="8" />
          <Input
            label="Anything to note (optional)"
            placeholder="Shoes, weather, how your legs feel…"
            multiline
            hint="Our assistant reads notes when it plans your next weeks."
          />
          <Input label="Disabled" editable={false} value="ana@example.com" />
        </Block>

        <Block title="Choices">
          <Question>How did it feel?</Question>
          <RadioGroup label="How did it feel?">
            {FEELINGS.map((f) => (
              <RadioCard
                key={f.value}
                label={f.label}
                description={f.description}
                checked={feeling === f.value}
                onPress={() => setFeeling(f.value)}
              />
            ))}
            <RadioCard label="Too much" description="Had to stop early" disabled />
          </RadioGroup>
          <RadioGroup label="Plain radios" gap={0}>
            <Radio label="Option A" checked={plain === 'a'} onPress={() => setPlain('a')} />
            <Radio label="Option B" description="With a description" checked={plain === 'b'} onPress={() => setPlain('b')} />
          </RadioGroup>
          <Segmented
            label="Days a week"
            value={days}
            onChange={setDays}
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n), unit: n === 1 ? 'day' : 'days' }))}
          />
          <Col gap={4}>
            <Question>Is there anything you would rather avoid?</Question>
            <CheckList
              label="Is there anything you would rather avoid?"
              options={AVOID}
              values={avoid}
              onToggle={(v) => setAvoid((list) => toggle(list, v))}
            />
          </Col>
        </Block>

        <Block title="Sliders">
          <Question>How often would you like to make room for movement?</Question>
          <Slider
            label="Sessions a week"
            icon="calendar-days"
            range={{ min: 1, max: 7, step: 1 }}
            value={sessions}
            onChange={setSessions}
            format={(n) => `${n} ${n === 1 ? 'day' : 'days'} a week`}
          />
          <Slider
            label="Minutes a session"
            icon="timer"
            range={{ min: 5, max: 60, step: 5 }}
            value={minutes}
            onChange={setMinutes}
            format={(m) => `${m} min`}
            marks={[5, 10, 20, 30, 40, 50, 60]}
          />
          <Question optional hint="Drag both ends. The whole bar means any time.">
            When would you prefer to move?
          </Question>
          <RangeSlider
            label="Time of day"
            icon="clock"
            range={WINDOW}
            value={timeWindow}
            onChange={setTimeWindow}
            format={windowText}
            formatValue={hourText}
            marks={[7, 9, 11, 13, 15, 17, 19, 21]}
          />
        </Block>

        <Block title="Suggestion cards">
          <SuggestionCard
            tone="dusk"
            kicker="Coach tip"
            title="Talk-pace is the pace."
            body="Slow enough to say a sentence. Stopping early still counts."
          />
          <SuggestionCard
            tone="dawn"
            kicker="Today · 7:00"
            title="Walk-run intervals"
            body="Six one-minute runs with easy walks between."
            actionLabel="Start"
            actionIcon="play"
            onAction={() => setSheet(true)}
            secondaryLabel="Not today"
            onSecondary={() => setSheet(true)}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: suggestionInk.track, marginTop: 6 }}>
              <View style={{ width: '40%', height: 4, borderRadius: 2, backgroundColor: suggestionInk.text }} />
            </View>
          </SuggestionCard>
          <SuggestionCard tone="sage" size="lg" kicker="Welcome" title="Find a way to move you'll keep." onDismiss={() => undefined} />
        </Block>

        <Block title="Exercises">
          <View>
            <ExerciseRow media mediaIcon="footprints" name="Brisk walk" detail="4 min" meta="warm-up" />
            <ExerciseRow
              media
              mediaIcon="dumbbell"
              name="Goblet squat"
              detail="3 × 10 · 8 kg"
              done={done}
              onToggle={() => setDone((v) => !v)}
              onPress={() => undefined}
            />
            <ExerciseRow media mediaIcon="footprints" name="Slow walk" detail="4 min" meta="cool-down" divider={false} />
          </View>
        </Block>

        <Block title="Sheet and bottom bar">
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button variant="secondary" onPress={() => setSheet(true)}>
              Open sheet
            </Button>
            <Tag label="Bottom bar" selected={bar} onPress={() => setBar((v) => !v)} />
          </Row>
          <Text variant="caption" style={{ color: colors.textSecondary }}>
            The bottom bar floats over the scroll with a fade to the page colour.
          </Text>
        </Block>
      </Content>

      {bar ? (
        <BottomBar>
          <Button variant="secondary" size="lg">
            Adjust
          </Button>
          <Button size="lg" fullWidth iconRight="check">
            Log it
          </Button>
        </BottomBar>
      ) : null}

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Not today?"
        description="Pick what helps. The rest of your week stays as it is.">
        <View>
          <ListRow icon="calendar-clock" discTone="quiet" discSize={44} title="Move it" detail="To later today or another free day." onPress={() => setSheet(false)} />
          <ListRow icon="moon" discTone="quiet" discSize={44} title="Skip today" detail="Nothing to make up. Friday stays as planned." onPress={() => setSheet(false)} divider />
        </View>
        <TextLink onPress={() => setSheet(false)}>Something else? Ask in chat</TextLink>
      </Sheet>
    </Screen>
  );
}

/** Dev-only gallery of every kit component (route /dev/kit). */
export default function KitScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ThemeProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Gallery />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
