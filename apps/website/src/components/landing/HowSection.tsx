import { Icon } from "../../design-system";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import { Kicker, PhoneFrame } from "../common";
import { BEATS, type Beat } from "./content";
import { MockPlan } from "./mockups";

/** How far the mockups are scaled down to fit each layout. */
const PHONE_SCALE: Record<Breakpoint, number> = { phone: 0.62, tablet: 0.46, desktop: 0.62 };

function BeatCopy({ beat }: { beat: Beat }) {
  return (
    <>
      <Kicker>{beat.kicker}</Kicker>
      <h3 className="s-h3">{beat.title}</h3>
      <p className="s-bodysm">{beat.body}</p>
    </>
  );
}

/** On a phone the beats read as a list, with one mockup under them. */
function BeatList() {
  return (
    <>
      <ol className="s-beatlist">
        {BEATS.map(beat => (
          <li key={beat.kicker}>
            <span className="s-disc44"><Icon name={beat.icon} size={20} /></span>
            <span className="s-col" style={{ gap: 4 }}><BeatCopy beat={beat} /></span>
          </li>
        ))}
      </ol>
      <div className="s-beat">
        <PhoneFrame scale={PHONE_SCALE.phone}><MockPlan /></PhoneFrame>
      </div>
    </>
  );
}

/** Wider than a phone, each beat shows its own screen. */
function BeatFigures({ scale }: { scale: number }) {
  return (
    <div className="s-beats">
      {BEATS.map(beat => {
        const Mockup = beat.mockup;
        return (
          <figure key={beat.kicker} className="s-beat">
            <PhoneFrame scale={scale}><Mockup /></PhoneFrame>
            <figcaption><BeatCopy beat={beat} /></figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function HowSection({ breakpoint }: { breakpoint: Breakpoint }) {
  return (
    <section id="how" className="s-section" aria-labelledby="s-how-h">
      <div className="s-sechead">
        <Kicker>How it works</Kicker>
        <h2 id="s-how-h" className="s-h2" tabIndex={-1}>Ask, plan, change.</h2>
        <p className="s-body">From a few questions to a week that fits, in about a minute.</p>
      </div>
      {breakpoint === "phone" ? <BeatList /> : <BeatFigures scale={PHONE_SCALE[breakpoint]} />}
    </section>
  );
}
