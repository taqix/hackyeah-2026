import type { ReactNode, Ref } from 'react';
import { type LayoutChangeEvent, ScrollView as PageScroll, StyleSheet, View } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { Col, Content, Row, Screen, TopBar, useLayout } from '@/components/layout';
import { Card, Spinner, Text } from '@/components/ui';
import { useTheme } from '@/theme';

import { BrandPanel } from './brand-panel';
import { useRise } from './rise';

/** The form card's widest. */
const CARD_MAX_WIDTH = 440;

export type AuthFrameProps = {
  children: ReactNode;
  /** A back button: in the top bar on phones, at the top of the card on the desktop. */
  back?: ReactNode;
  /** Space between the children; 20 by default. */
  gap?: number;
  /** Phones: the scroll view, so a screen can keep a field clear of the keyboard. */
  scrollRef?: Ref<ScrollView>;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The sign-in screens' frame. Phones (and the web below 768 px) keep the
 * mobile screen: an optional top bar over the scrolling content. From the
 * desktop width the page splits: the brand panel on the left, the form in a
 * card on the right.
 */
export function AuthFrame({ children, back, gap = 20, scrollRef, onLayout }: AuthFrameProps) {
  const { isDesktop, isWide } = useLayout();
  const rise = useRise();

  if (!isDesktop) {
    return (
      <Screen>
        {back ? <TopBar left={back} /> : null}
        <Content ref={scrollRef} gap={gap} onLayout={onLayout}>
          {children}
        </Content>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.split}>
        <BrandPanel />
        <PageScroll
          style={styles.side}
          contentContainerStyle={[styles.sideContent, { padding: isWide ? 48 : 32 }]}
          keyboardShouldPersistTaps="handled">
          <Animated.View style={[styles.cardColumn, rise(1)]}>
            <Card padding={isWide ? 36 : 28} style={{ gap }}>
              {back ? <View style={styles.back}>{back}</View> : null}
              {children}
            </Card>
          </Animated.View>
        </PageScroll>
      </View>
    </Screen>
  );
}

/**
 * A calm wait on an Auth page (the guest being set up, a link being checked):
 * a spinner with what is happening, centred on phones and in the card on the
 * desktop.
 */
export function AuthWaiting({ title, detail }: { title: string; detail?: string }) {
  const { colors } = useTheme();
  const { isDesktop } = useLayout();
  const status = (
    <Row gap={14} accessibilityRole="progressbar" accessibilityLabel={title} aria-busy style={{ alignItems: 'flex-start' }}>
      <Spinner size={22} color={colors.accent} accessibilityLabel={null} style={{ marginTop: 2 }} />
      <Col gap={4} style={{ flex: 1 }}>
        <Text variant="subheading">{title}</Text>
        {detail ? <Text variant="bodySm">{detail}</Text> : null}
      </Col>
    </Row>
  );

  if (isDesktop) return <AuthFrame>{status}</AuthFrame>;
  return (
    <Screen>
      <View style={[styles.center, { backgroundColor: colors.bgApp }]}>
        <View style={styles.centerBox}>{status}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  side: { flex: 1 },
  sideContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  cardColumn: { width: '100%', maxWidth: CARD_MAX_WIDTH },
  back: { marginTop: -10, marginLeft: -10, marginBottom: -8, alignSelf: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerBox: { width: '100%', maxWidth: 360 },
});
