import { Disc, type IconName, Text } from '@/components/ui';
import { Body, Col, H1, Row } from '@/components/layout';

export type WizardHeadingProps = {
  icon: IconName;
  /** Where the step sits: "Time · 2 of 5". */
  kicker: string;
  title: string;
  body: string;
};

/** The top of a desktop wizard card: the step's icon and place, its title and one line under it. */
export function WizardHeading({ icon, kicker, title, body }: WizardHeadingProps) {
  return (
    <Col gap={14}>
      <Row gap={10}>
        <Disc icon={icon} size={32} />
        <Text variant="label" tone="tertiary">
          {kicker}
        </Text>
      </Row>
      <Col gap={10}>
        <H1>{title}</H1>
        <Body style={{ maxWidth: 560 }}>{body}</Body>
      </Col>
    </Col>
  );
}
