import { Text, type TextProps } from '@/components/ui/text';

type Props = Omit<TextProps, 'variant'>;

/** Screen title (prototype H1: 36 px display bold). */
export function H1(props: Props) {
  return <Text variant="title" accessibilityRole="header" {...props} />;
}

/** Smaller screen title (workout H2: 28 px display bold). */
export function H2(props: Props) {
  return <Text variant="h1" accessibilityRole="header" {...props} />;
}

/** Small line above a title ("Today · 7:00 · 20 min"). */
export function Kicker(props: Props) {
  return <Text variant="label" tone="tertiary" {...props} />;
}

/** Secondary reading text under a title. */
export function Body(props: Props) {
  return <Text variant="body" tone="secondary" {...props} />;
}

/** Section heading inside a screen. */
export function Section(props: Props) {
  return <Text variant="section" accessibilityRole="header" {...props} />;
}
