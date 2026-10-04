import { Button, IconButton, Radio } from "../../../design-system";
import { COMFORT_OPTIONS } from "../../../domain";
import { StepDots } from "../../common";

/** Onboarding 2: the first question, in the app. */
const APP_STEPS = 5;

export function MockAsk() {
  return (
    <>
      <div className="m-top">
        <IconButton icon="arrow-left" label="Back" />
        <span className="s-kicker">1 of {APP_STEPS}</span>
      </div>
      <div className="m-content" style={{ gap: 24 }}>
        <div className="s-row"><StepDots filled={1} total={APP_STEPS} /></div>
        <div className="s-col" style={{ gap: 8 }}>
          <div className="m-h1">How does starting feel?</div>
          <p className="s-body">No wrong answers. This sets how gentle your first week is.</p>
        </div>
        <div className="s-stack8">
          {COMFORT_OPTIONS.map((option, index) => (
            <Radio key={option.value} variant="card" label={option.label} description={option.description} checked={index === 0} />
          ))}
        </div>
      </div>
      <div className="m-bottom"><Button size="lg" fullWidth iconRight="arrow-right">Continue</Button></div>
    </>
  );
}
