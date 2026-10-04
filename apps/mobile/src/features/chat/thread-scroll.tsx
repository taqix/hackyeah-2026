import { type ReactNode, type Ref, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Platform, ScrollView, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export type ThreadScrollHandle = {
  /** Stick to the newest message again (after sending). */
  follow: () => void;
};

export type ThreadScrollProps = {
  /** Changes whenever a message is added or its state changes: the thread follows it to the end. */
  contentKey: string;
  gutter: number;
  /** Desktop page: the thread's widest, centred in the scroller. */
  maxWidth?: number;
  /** Desktop: show the scrollbar. Phones scroll without one. */
  scrollbar?: boolean;
  children: ReactNode;
  ref?: Ref<ThreadScrollHandle>;
};

const NEAR_END = 48;
const ON_WEB = Platform.OS === 'web';

function nearEnd({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
  return contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
}

/**
 * The conversation's scroller. It keeps the newest message just above the
 * message box: new messages and a shrinking viewport (keyboard) scroll to the
 * end, unless the person has scrolled up to read. Instant under reduced motion.
 */
export function ThreadScroll({ contentKey, gutter, maxWidth, scrollbar = false, children, ref }: ThreadScrollProps) {
  const scrollRef = useRef<ScrollView>(null);
  const following = useRef(true);
  const scrolledOnce = useRef(false);
  const lastY = useRef(0);
  const reduced = useReducedMotion();

  useImperativeHandle(ref, () => ({
    follow: () => {
      following.current = true;
    },
  }));

  // A new message pulls the thread back to the end before it lays out.
  useLayoutEffect(() => {
    following.current = true;
  }, [contentKey]);

  const toEnd = () => {
    if (!following.current) return;
    scrollRef.current?.scrollToEnd({ animated: scrolledOnce.current && !reduced });
    scrolledOnce.current = true;
  };

  // The web has no drag events: scrolling up stops following, reaching the end
  // again resumes it. Scrolling to the end ourselves only ever moves down.
  const onWebScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (nearEnd(event)) following.current = true;
    else if (y < lastY.current) following.current = false;
    lastY.current = y;
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: gutter },
        maxWidth ? { width: '100%', maxWidth: maxWidth + 2 * gutter, alignSelf: 'center' } : null,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={scrollbar}
      onContentSizeChange={toEnd}
      onLayout={toEnd}
      onScroll={ON_WEB ? onWebScroll : undefined}
      scrollEventThrottle={ON_WEB ? 32 : undefined}
      onScrollBeginDrag={() => {
        following.current = false;
      }}
      onScrollEndDrag={(event) => {
        following.current = nearEnd(event);
      }}
      onMomentumScrollEnd={(event) => {
        following.current = nearEnd(event);
      }}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: 8, paddingBottom: 20, gap: 12 },
});
