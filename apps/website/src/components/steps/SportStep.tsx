import type { KeyboardEvent } from "react";
import { Badge, Icon, SuggestionCard } from "../../design-system";
import { answersRecap, suggestionSummary, SPORTS } from "../../domain";
import { arrowStep, wrapIndex } from "../../a11y";
import { AnswersPanel, summaryLine } from "./AnswersPanel";
import { StepShell } from "./StepShell";
import type { StepProps } from "./types";

function focusSportButton(key: string): void {
  requestAnimationFrame(() => {
    document.getElementById(`s-sport-${key}`)?.focus();
  });
}

/** Step 4: pick the suggested sport, or another one from the ranked list. */
export function SportStep({ step, answers, ranked, sport, visited, hasPlan, breakpoint, today, onPickSport, onChoose }: StepProps) {
  const panel = <AnswersPanel answers={answers} sport={visited >= 4 ? sport : null} visited={visited} today={today} />;
  const summary = summaryLine(answers, sport, visited);
  const selected = ranked.find(candidate => candidate.key === sport) ?? ranked[0];
  const selectedSport = SPORTS[selected.key];
  const isBestFit = ranked[0].key === selected.key;

  /* Arrow keys move both the selection and focus between the sport radios, wrapping. */
  const handleSportKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = arrowStep(event.key);
    if (direction === null) return;
    event.preventDefault();
    const index = ranked.findIndex(candidate => candidate.key === selected.key);
    const next = ranked[wrapIndex(index, direction, ranked.length)];
    onPickSport(next.key);
    focusSportButton(next.key);
  };

  return (
    <StepShell
      step={step}
      bodySmall
      body={answersRecap(answers)}
      ctaNoteAbove={hasPlan ? "Choosing again makes a new first plan." : null}
      cta={{ label: `Choose ${selectedSport.name.toLowerCase()}`, onClick: onChoose }}
      breakpoint={breakpoint}
      panel={panel}
      summary={summary}
    >
      <div key={selected.key} className="s-xfade">
        <SuggestionCard
          size="md"
          tone={selectedSport.tone}
          kicker={`${isBestFit ? "Best fit · " : "Your pick · "}${selectedSport.name}`}
          title={selectedSport.tagline}
          body={suggestionSummary(selected, answers)}
        />
      </div>
      <div role="radiogroup" aria-label="Choose a sport" className="s-sports" onKeyDown={handleSportKeys}>
        {ranked.map((rankedSport, index) => {
          const sportInfo = SPORTS[rankedSport.key];
          const isChecked = rankedSport.key === selected.key;
          return (
            <button
              key={rankedSport.key}
              id={`s-sport-${rankedSport.key}`}
              type="button"
              role="radio"
              aria-checked={isChecked}
              tabIndex={isChecked ? 0 : -1}
              className="s-sport"
              onClick={() => onPickSport(rankedSport.key)}
            >
              <span className="s-disc44"><Icon name={sportInfo.icon} size={20} /></span>
              <span className="s-sportmain">
                <span className="s-sportname">
                  {sportInfo.name}
                  {index === 0 ? <Badge tone="accent">Best fit</Badge> : null}
                  {rankedSport.matches.map(tag => <Badge key={tag.key}>{tag.badge}</Badge>)}
                </span>
                <span className="s-bodysm">{rankedSport.reason}</span>
              </span>
              <span className="s-radioind" aria-hidden="true"><span></span></span>
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
