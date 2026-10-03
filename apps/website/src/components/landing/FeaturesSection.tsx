import { Icon } from "../../design-system";
import { Kicker } from "../common";
import { FEATURES } from "./content";

export function FeaturesSection() {
  return (
    <section id="features" className="s-section" aria-labelledby="s-feat-h">
      <div className="s-sechead">
        <Kicker>What's inside</Kicker>
        <h2 id="s-feat-h" className="s-h2" tabIndex={-1}>Gentle by default.</h2>
        <p className="s-body">
          Short sessions, rest days between, and no streaks or scores. Sessions get moved, not failed.
        </p>
      </div>
      <ul className="s-features">
        {FEATURES.map(feature => (
          <li key={feature.title}>
            <span className="s-disc44"><Icon name={feature.icon} size={20} /></span>
            <h3 className="s-sub">{feature.title}</h3>
            <p className="s-bodysm">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
