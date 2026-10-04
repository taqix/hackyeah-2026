import { type ReactNode, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { type Theme, useTheme } from '@/theme';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export type TooltipProps = {
  /** The words to show: usually the control's accessibility label. */
  label: string;
  /** Side of the control; 'top' by default. It flips when the window has no room there. */
  placement?: TooltipPlacement;
  /** The control it names: one pressable. */
  children: ReactNode;
};

/** How long a mouse rests on the control before the label shows. */
const SHOW_DELAY = 450;
const GAP = 8;
/** Closest the label comes to the window's edge. */
const EDGE = 8;

type Box = { left: number; top: number; width: number; height: number };

const FLIP: Record<TooltipPlacement, TooltipPlacement> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function fits(side: TooltipPlacement, anchor: DOMRect, tip: Box) {
  switch (side) {
    case 'top':
      return anchor.top - GAP - tip.height >= EDGE;
    case 'bottom':
      return anchor.bottom + GAP + tip.height <= window.innerHeight - EDGE;
    case 'left':
      return anchor.left - GAP - tip.width >= EDGE;
    case 'right':
      return anchor.right + GAP + tip.width <= window.innerWidth - EDGE;
  }
}

/** Where the label goes: beside the control on the asked side (or the opposite one), kept inside the window. */
function place(anchor: DOMRect, tip: Box, placement: TooltipPlacement) {
  const side = fits(placement, anchor, tip) || !fits(FLIP[placement], anchor, tip) ? placement : FLIP[placement];
  const across = side === 'top' || side === 'bottom';
  const left = across
    ? anchor.left + anchor.width / 2 - tip.width / 2
    : side === 'left'
      ? anchor.left - GAP - tip.width
      : anchor.right + GAP;
  const top = !across
    ? anchor.top + anchor.height / 2 - tip.height / 2
    : side === 'top'
      ? anchor.top - GAP - tip.height
      : anchor.bottom + GAP;
  const clamp = (value: number, size: number, room: number) => Math.min(Math.max(value, EDGE), room - EDGE - size);
  return { side, left: clamp(left, tip.width, window.innerWidth), top: clamp(top, tip.height, window.innerHeight) };
}

/** The label: inverse surface, caption type, drawn straight into the page. */
function createLabel(label: string, { colors, fontFamily, radius, shadows, motion }: Theme, animate: boolean) {
  const tip = document.createElement('div');
  tip.textContent = label;
  tip.setAttribute('aria-hidden', 'true');
  Object.assign(tip.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    zIndex: '10000',
    pointerEvents: 'none',
    width: 'max-content',
    maxWidth: '260px',
    padding: '6px 10px',
    borderRadius: `${radius.xs}px`,
    background: colors.surfaceInverse,
    color: colors.textInverse,
    font: `12px/16px "${fontFamily.bodyMedium}", system-ui, sans-serif`,
    boxShadow: shadows[2].boxShadow,
    opacity: '0',
    transition: animate
      ? `opacity ${motion.durFast}ms cubic-bezier(${motion.easeOut.join(',')}), transform ${motion.durFast}ms cubic-bezier(${motion.easeOut.join(',')})`
      : 'none',
  });
  return tip;
}

const NUDGE: Record<TooltipPlacement, string> = {
  top: 'translateY(3px)',
  bottom: 'translateY(-3px)',
  left: 'translateX(3px)',
  right: 'translateX(-3px)',
};

/**
 * Hover label for an icon-only control on the web (system README ›
 * Iconography: icon-only buttons carry "aria + tooltip"). It shows after a
 * short rest of the mouse, or at once on keyboard focus, and hides on leave,
 * press, scroll or Escape. It is drawn in a fixed layer on the page, so no
 * scroll view or card clips it, and hidden from screen readers, which already
 * read the control's label. The wrapper has no box of its own, so the layout
 * is the control's alone. iOS and Android: tooltip.native.tsx (no label).
 */
export function Tooltip({ label, placement = 'top', children }: TooltipProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const anchor = useRef<View>(null);

  useEffect(() => {
    const node: unknown = anchor.current;
    if (typeof HTMLElement === 'undefined' || !(node instanceof HTMLElement) || !label) return undefined;
    let tip: HTMLDivElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const show = () => {
      clearTimeout(timer);
      if (tip) return;
      // The wrapper is display: contents, so the control is what has a size.
      const target = node.firstElementChild ?? node;
      const next = createLabel(label, theme, !reduced);
      document.body.appendChild(next);
      const spot = place(target.getBoundingClientRect(), next.getBoundingClientRect(), placement);
      next.style.left = `${spot.left}px`;
      next.style.top = `${spot.top}px`;
      next.style.transform = reduced ? 'none' : NUDGE[spot.side];
      tip = next;
      requestAnimationFrame(() => {
        next.style.opacity = '1';
        next.style.transform = 'none';
      });
    };
    const hide = () => {
      clearTimeout(timer);
      tip?.remove();
      tip = null;
    };
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      clearTimeout(timer);
      timer = setTimeout(show, SHOW_DELAY);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) show();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    node.addEventListener('pointerenter', onEnter);
    node.addEventListener('pointerleave', hide);
    node.addEventListener('pointerdown', hide);
    node.addEventListener('focusin', onFocusIn);
    node.addEventListener('focusout', hide);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', hide, true);
    return () => {
      hide();
      node.removeEventListener('pointerenter', onEnter);
      node.removeEventListener('pointerleave', hide);
      node.removeEventListener('pointerdown', hide);
      node.removeEventListener('focusin', onFocusIn);
      node.removeEventListener('focusout', hide);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', hide, true);
    };
  }, [label, placement, theme, reduced]);

  return (
    <View ref={anchor} style={{ display: 'contents' }}>
      {children}
    </View>
  );
}
