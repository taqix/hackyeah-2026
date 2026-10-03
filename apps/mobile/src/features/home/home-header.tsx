import { Col, H1, Kicker } from '@/components/layout';
import { greeting } from '@/lib/dates';

type HomeHeaderProps = {
  kicker: string;
  /** First name, or null: the greeting then stands alone. */
  name: string | null;
  now: Date;
};

/** Greeting by time of day, with the date above. The chat button sits beside the tab bar, so no actions here. */
export function HomeHeader({ kicker, name, now }: HomeHeaderProps) {
  const hello = greeting(now);
  return (
    <Col gap={4}>
      <Kicker tabular>{kicker}</Kicker>
      <H1>{name ? `${hello}, ${name}` : hello}</H1>
    </Col>
  );
}
