/* The shared layout every question step renders itself inside of: progress dots, heading,
   the step's own body, a back/continue action row (or a bottom bar on a phone), and the
   summary panel beside it on desktop. */
import type { ReactNode } from "react";
import { Button, IconButton } from "../../design-system";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import * as route from "../../routing";
import { Kicker, StepDots } from "../common";
import { STEP_TITLES } from "./content";

/** Shared by every step, so a radiogroup or a slider can label itself against the heading. */
export const STEP_HEADING_ID = "s-h1";

function StepFooter() {
  return <p className="s-cap">You're trying Movo as a guest. No account needed.</p>;
}

export interface StepShellCallToAction {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  /** null suppresses the default right arrow glyph. */
  iconRight?: null;
}

export interface StepShellProps {
  step: number;
  body: ReactNode;
  /** Step 4's recap reads better at the smaller body size. */
  bodySmall?: boolean;
  children?: ReactNode;
  cta: StepShellCallToAction;
  ctaNote?: string | null;
  ctaNoteAbove?: string | null;
  breakpoint: Breakpoint;
  panel: ReactNode;
  summary?: string;
}

export function StepShell({ step, body, bodySmall, children, cta, ctaNote, ctaNoteAbove, breakpoint, panel, summary }: StepShellProps) {
  const back = () => route.navigate(step === route.FIRST_STEP ? route.LANDING : route.stepPath(step - 1));
  const phone = breakpoint === "phone";
  const ctaButton = (
    <Button size="lg" iconRight={cta.iconRight === null ? undefined : "arrow-right"} disabled={cta.disabled} onClick={cta.onClick} fullWidth={phone}>
      {cta.label}
    </Button>
  );
  return (
    <div className="s-wrap">
      <div className="s-shell">
        <div className="s-stepcol s-enter" key={step}>
          <div className="s-progress">
            {phone
              ? <IconButton icon="arrow-left" label="Back" onClick={back} style={{ marginLeft: -10 }} />
              : <Kicker style={{ flex: "none" }}>{step} of {route.LAST_STEP}</Kicker>}
            <StepDots filled={step} />
            {phone ? <Kicker style={{ flex: "none" }}>{step} of {route.LAST_STEP}</Kicker> : null}
          </div>
          <div className="s-stephead">
            <h1 id={STEP_HEADING_ID} className="s-h1" tabIndex={-1} data-page-title="">{STEP_TITLES[step]}</h1>
            <p className={bodySmall ? "s-bodysm" : "s-body"}>{body}</p>
            {breakpoint !== "desktop" && summary ? <p className="s-cap">{summary}</p> : null}
          </div>
          {children}
          {!phone ? (
            <div className="s-col" style={{ gap: 10 }}>
              {ctaNoteAbove ? <p className="s-cap">{ctaNoteAbove}</p> : null}
              <div className="s-actions">
                <Button variant="secondary" size="lg" icon="arrow-left" onClick={back}>Back</Button>
                {ctaButton}
                {ctaNote ? <span className="s-cap">{ctaNote}</span> : null}
              </div>
            </div>
          ) : null}
          <StepFooter />
        </div>
        {breakpoint === "desktop" ? <div style={{ alignSelf: "stretch" }}>{panel}</div> : null}
      </div>
      {phone ? (
        <div className="s-bottombar">
          <div>
            {ctaNoteAbove || ctaNote ? <p className="s-cap">{ctaNoteAbove || ctaNote}</p> : null}
            {ctaButton}
          </div>
        </div>
      ) : null}
    </div>
  );
}
