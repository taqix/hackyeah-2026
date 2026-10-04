import { GUEST_ENTRY, SIGN_IN } from "../../appLinks";
import { Button, Card, Icon } from "../../design-system";
import { COMFORT_OPTIONS, ONBOARDING_QUESTIONS } from "../../domain";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import { Kicker, StepDots } from "../common";
import { NOTICES } from "./content";

/** The app's first question, shown on the landing page so trying it starts with one tap:
    every answer opens the app as a guest. */
function QuestionCard({ breakpoint }: { breakpoint: Breakpoint }) {
  return (
    <Card padding={breakpoint === "phone" ? 20 : 28}>
      <div className="s-qcard">
        <div className="s-row" style={{ gap: 14 }}>
          <Kicker style={{ flex: "none" }}>Start here · 1 of {ONBOARDING_QUESTIONS}</Kicker>
          <StepDots filled={1} total={ONBOARDING_QUESTIONS} />
        </div>
        <div className="s-col" style={{ gap: 8 }}>
          <h2 className="s-h3">How does starting feel?</h2>
          <p className="s-bodysm">No wrong answers. This sets how gentle your first week is.</p>
        </div>
        <div className="s-answers">
          {COMFORT_OPTIONS.map(option => (
            <a
              key={option.value}
              className="s-answer"
              href={GUEST_ENTRY}
              aria-label={`${option.label}, ${option.description}. Opens the app as a guest.`}
            >
              <span className="s-disc44"><Icon name={option.icon} size={20} /></span>
              <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <span className="s-alabel">{option.label}</span>
                <span className="s-adesc">{option.description}</span>
              </span>
              <span className="s-arrow"><Icon name="arrow-right" size={18} /></span>
            </a>
          ))}
        </div>
        <p className="s-cap">Pick one to start as a guest.</p>
      </div>
    </Card>
  );
}

export function Hero({ breakpoint }: { breakpoint: Breakpoint }) {
  return (
    <section className="s-hero" aria-labelledby="s-h1">
      <div className="s-hero-intro">
        <Kicker>Sport for beginners</Kicker>
        <h1 id="s-h1" tabIndex={-1} data-page-title="">Everyone starts somewhere.</h1>
        <p className="s-lede">
          For adults who want to move more and aren't sure where to start. Answer a few calm questions,
          get a gentle first week, then change it just by asking.
        </p>
        <div className="s-ctas">
          <Button size="lg" iconRight="arrow-right" href={GUEST_ENTRY}>Try it as a guest</Button>
          <Button size="lg" variant="secondary" icon="log-in" href={SIGN_IN}>Sign in</Button>
        </div>
        <p className="s-capline">
          <Icon name="info" size={16} />No account needed. As a guest, your plan stays in this browser.
        </p>
      </div>
      <div className="s-hero-card">
        <QuestionCard breakpoint={breakpoint} />
      </div>
      <div className="s-hero-notice s-notice">
        <h2 className="s-label" style={{ fontFamily: "var(--font-body)", letterSpacing: 0 }}>Worth noticing</h2>
        <ul>
          {NOTICES.map(notice => (
            <li key={notice.icon}>
              <Icon name={notice.icon} size={16} style={{ color: "var(--accent-text)" }} />
              {notice.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
