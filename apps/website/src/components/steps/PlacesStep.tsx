import { Tag } from "../../design-system";
import { COMPANY, PLACES } from "../../domain";
import * as route from "../../routing";
import { AnswersPanel, summaryLine } from "./AnswersPanel";
import { StepShell } from "./StepShell";
import { TagGroup } from "./TagGroup";
import type { StepProps } from "./types";

/** Step 2: where and who with. */
export function PlacesStep({ step, answers, sport, visited, breakpoint, today, onTogglePlace, onToggleCompany }: StepProps) {
  const panel = <AnswersPanel answers={answers} sport={visited >= 4 ? sport : null} visited={visited} today={today} />;
  const summary = summaryLine(answers, sport, visited);

  return (
    <StepShell
      step={step}
      body="We use these to suggest a sport."
      cta={{ label: "Continue", disabled: !answers.places.length, onClick: () => route.navigate(route.stepPath(step + 1)) }}
      breakpoint={breakpoint}
      panel={panel}
      summary={summary}
    >
      <div className="s-col" style={{ gap: 28 }}>
        <TagGroup id="s-g-places" label="Where could you move?" caption="Pick at least one.">
          {PLACES.map(place => (
            <Tag
              key={place.key}
              icon={place.icon}
              selected={answers.places.includes(place.key)}
              onClick={() => onTogglePlace(place.key)}
              style={{ height: 44 }}
            >
              {place.label}
            </Tag>
          ))}
        </TagGroup>
        <TagGroup id="s-g-company" label="Who would you move with?" caption="Optional.">
          {COMPANY.map(company => (
            <Tag
              key={company.key}
              icon={company.icon}
              selected={answers.company.includes(company.key)}
              onClick={() => onToggleCompany(company.key)}
              style={{ height: 44 }}
            >
              {company.label}
            </Tag>
          ))}
        </TagGroup>
      </div>
    </StepShell>
  );
}
