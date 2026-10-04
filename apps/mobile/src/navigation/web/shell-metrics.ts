/** The desktop web shell's geometry, shared by the sidebar, the coach dock and the shortcuts. */

/** Sidebar slot widths: labels on wide screens, an icon rail on medium ones (or beside an open dock when room is short). */
export const SIDEBAR_WIDTH = { wide: 248, rail: 84 } as const;

/** Air between the window's edges and the floating sidebar and dock cards. */
export const SHELL_INSET = 12;

/** Inner padding of the sidebar card (inside its hairline border). */
export const SIDEBAR_PADDING = 10;

/**
 * Where every sidebar icon, the mark and the avatar centre, from the start of
 * the card's content: the middle of the rail. Each row pads its icon onto this
 * column, so folding to the rail only hides the labels while the card narrows
 * around icons that stay put.
 */
export const SIDEBAR_ICON_CENTER = (SIDEBAR_WIDTH.rail - SHELL_INSET) / 2 - 1 - SIDEBAR_PADDING;

/** Sidebar rows: nav items, the coach button and the account card share the height and the gap. */
export const SIDEBAR_ROW = { height: 44, gap: 4 } as const;

/** The coach dock beside the page on wide screens; people can drag it wider or narrower. */
export const DOCK_WIDTH = { min: 340, initial: 400, max: 560 } as const;

/** The coach drawer over the page on medium screens. */
export const DRAWER_WIDTH = 420;

/** The narrowest the page gets beside an open dock before the sidebar folds to its rail. */
export const MAIN_MIN_BESIDE_DOCK = 720;

/** The narrowest the page ever gets while the dock is dragged wider. */
export const MAIN_MIN = 560;
