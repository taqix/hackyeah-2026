import { Children, createContext, type ReactNode, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Columns, DESKTOP_CONTENT_MAX_WIDTH, DESKTOP_GUTTER, Grid, useLayout } from '@/components/layout';
import { webStyle } from '@/components/ui/web-style';
import { SIDEBAR_WIDTH } from '@/navigation/web/shell-metrics';

/** Below this the side column would squeeze the board, so its cards move under the week. */
const SPLIT_MIN_WIDTH = 880;
const SIDE_MIN = 280;
const SIDE_MAX = 360;
const GAP = 24;

const STICKY = webStyle({ position: 'sticky', top: 24 });

const PageWidthContext = createContext<number>(0);
const MainWidthContext = createContext<number>(0);

/** The dashboard's whole width, for the header's own arrangement. */
export function usePageWidth(): number {
  return useContext(PageWidthContext);
}

/** The main column's width, for content that changes shape with it (the week board). */
export function useMainColumnWidth(): number {
  return useContext(MainWidthContext);
}

type DashboardLayoutProps = {
  header: ReactNode;
  /** Notes about the plan (Plan updated): top of the side column, or above the hero in one column. */
  notes?: ReactNode;
  /** The hero slot: the selected day, or a plan state. */
  focus: ReactNode;
  /** Keeps a plan state's card to a readable width instead of the whole page. */
  focusMaxWidth?: number;
  /** The week board, under the hero. */
  board?: ReactNode;
  /** Side column cards, in order; null ones are left out. */
  side?: ReactNode;
};

/**
 * The dashboard's frame. Wide enough, the hero and the board share the main
 * column and the side cards sit beside them, staying in view while the page
 * scrolls; narrower (the medium sidebar, or the coach docked beside the page),
 * one column with the side cards in a grid under the week. Decided by the
 * page's own width as measured, so a docked coach counts too; until the first
 * measure, from the window less the sidebar.
 */
export function DashboardLayout({ header, notes, focus, focusMaxWidth, board, side }: DashboardLayoutProps) {
  const { width: windowWidth, isWide } = useLayout();
  const [measured, setMeasured] = useState<number | null>(null);
  const sidebar = isWide ? SIDEBAR_WIDTH.wide : SIDEBAR_WIDTH.rail;
  const width = measured ?? Math.min(DESKTOP_CONTENT_MAX_WIDTH, windowWidth - sidebar - DESKTOP_GUTTER * 2);
  const notesList = Children.toArray(notes);
  const cards = Children.toArray(side);
  const split = cards.length > 0 && width >= SPLIT_MIN_WIDTH;
  const sideWidth = Math.round(Math.min(SIDE_MAX, Math.max(SIDE_MIN, width * 0.3)));
  const mainWidth = split ? width - GAP - sideWidth : width;
  const focusSlot = focusMaxWidth ? <View style={{ maxWidth: focusMaxWidth }}>{focus}</View> : focus;

  return (
    <View onLayout={(event) => setMeasured(event.nativeEvent.layout.width)} style={styles.page}>
      <PageWidthContext.Provider value={width}>{header}</PageWidthContext.Provider>
      <MainWidthContext.Provider value={mainWidth}>
        {split ? (
          <Columns ratio={[mainWidth, sideWidth]} gap={GAP} align="stretch">
            <View style={styles.main}>
              {focusSlot}
              {board}
            </View>
            <View style={[styles.side, STICKY]}>
              {notesList}
              {cards}
            </View>
          </Columns>
        ) : (
          <View style={styles.main}>
            {notesList.length ? <View style={styles.side}>{notesList}</View> : null}
            {focusSlot}
            {board}
            {cards.length ? (
              <Grid minItemWidth={300} gap={16}>
                {cards}
              </Grid>
            ) : null}
          </View>
        )}
      </MainWidthContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28 },
  main: { gap: 28 },
  side: { gap: 16 },
});
