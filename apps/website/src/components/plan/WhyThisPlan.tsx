import { Badge, Icon } from "../../design-system";
import { capitalize, planReasons, type Plan } from "../../domain";

export interface WhyThisPlanProps {
  plan: Plan;
}

/** "Why this plan": each parameter, the answer or chat change behind it, and what it did. */
export function WhyThisPlan({ plan }: WhyThisPlanProps) {
  return (
    <section className="s-col" style={{ gap: 8 }} aria-labelledby="s-why-h">
      <div className="s-col" style={{ gap: 4 }}>
        <h2 id="s-why-h" className="s-sect">Why this plan</h2>
        <p className="s-bodysm">Each part comes from something you told us.</p>
      </div>
      <ul className="s-whylist">
        {planReasons(plan).map(reason => (
          <li key={reason.key} className={reason.fromVersion ? "is-chat" : ""}>
            <span className="s-whyic"><Icon name={reason.icon} size={20} /></span>
            <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <span className="s-whyeffect">{capitalize(reason.effect)}</span>
              <span className="s-whycause">
                <Icon name={reason.fromVersion ? "message-circle" : "list-checks"} size={14} />
                <span>{reason.fromVersion ? "You asked in chat" : "Your answer"}<span aria-hidden="true"> · </span><span className="s-sr">: </span>{reason.cause}</span>
              </span>
            </span>
            {reason.fromVersion ? <Badge tone="accent">Changed</Badge> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
