import { type ReactNode, type Ref, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

export type ThreadScrollHandle = {
  /** Stick to the newest message again (after sending). */
  follow: () => void;
};

export type ThreadScrollProps = {
  /** Changes whenever a message is added or its state changes: the thread follows it to the end. */
  contentKey: string;
  gutter: number;
  children: ReactNode;
  ref?: Ref<ThreadScrollHandle>;
};

const NEAR_END = 48;

function nearEnd({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
  const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
  return contentOffset.y + layoutMeasurement.height >= contentSize.height - NEAR_END;
}

/**
 * The conversation's scroller. It keeps the newest message just above the
 * message box: new messages and a shrinking viewport (keyboard) scroll to the
 * end, unless the person has scrolled up to read. Instant under reduced motion.
 */
export function ThreadScroll({ contentKey, gutter, children, ref }: ThreadScrollProps) {
  const scrollRef = useRef<ScrollView>(null);
  const following = useRef(true);
  const scrolledOnce = useRef(false);
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

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      onContentSizeChange={toEnd}
      onLayout={toEnd}
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
