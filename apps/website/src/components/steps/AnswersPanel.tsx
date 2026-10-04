/* The sticky "Your first week" panel beside the question, and the "So far: ..." recap
   line shown under the heading on tablet and phone. Both read the same answers, so they
   share the row-building logic below. */
import { Card, Icon } from "../../design-system";
import { capitalize, comfortOption, preferenceEchoes, timeAnswerLine, SPORTS, type Answers, type SportKey } from "../../domain";
import * as route from "../../routing";
import { WeekDots, type WeekPhase } from "../common";

export interface AnswersPanelProps {
  answers: Answers;
  /** null until the sport question has been reached. */
  sport: SportKey | null;
  visited: number;
  today: Date;
}

interface AnswerRow {
  name: string;
  step: number;
  icon: string;
  text: string | null;
  /** What this answer is used for, shown once it has a value. */
  usedFor: string;
  placeholder: string;
}

function answerRows(answers: Answers, sport: SportKey | null, visited: number): AnswerRow[] {
  const comfort = comfortOption(answers.comfort);
  const echoes = preferenceEchoes(answers);
  return [
    { name: "Starting point", step: 1, icon: comfort ? comfort.icon : "armchair", text: comfort ? comfort.panel : null, usedFor: "how gentle the first sessions are", placeholder: "How starting feels" },
    { name: "Places", step: 2, icon: "tree-pine", text: answers.places.length ? capitalize(echoes.join(" · ")) : null, usedFor: "which sport we suggest", placeholder: "Where you can move" },
    { name: "Time", step: 3, icon: "timer", text: visited >= 3 ? timeAnswerLine(answers) : null, usedFor: "session length, days and time of day", placeholder: "Time you can give" },
    { name: "Sport", step: 4, icon: sport ? SPORTS[sport].icon : "goal", text: visited >= 4 && sport ? SPORTS[sport].name : null, usedFor: "what the sessions are made of", placeholder: "Sport" },
  ];
}

/** The sticky "Your first week" summary beside the question, filled in as each step is answered. */
export function AnswersPanel({ answers, sport, visited, today }: AnswersPanelProps) {
  const phase: WeekPhase = visited >= 4 && sport ? "fill" : visited >= 3 ? "ring" : "neutral";
  const rows = answerRows(answers, sport, visited);
  return (
    <Card padding={24} style={{ position: "sticky", top: 88 }}>
      <aside className="s-col" style={{ gap: 18 }} aria-label="Your first week">
        <div className="s-col" style={{ gap: 4 }}>
          <h2 className="s-sect">Your first week</h2>
          <p className="s-cap">Takes shape as you answer.</p>
        </div>
        <WeekDots today={today} sessionsPerWeek={answers.sessionsPerWeek} sport={sport} phase={phase} />
        <div>
          {rows.map(row => (
            <div key={row.name} className="s-prow">
              <Icon name={row.icon} size={20} style={{ color: row.text ? "var(--accent-text)" : "var(--text-tertiary)" }} />
              <span className="s-ptext">
                <span className={"s-pans" + (row.text ? "" : " is-empty")}>{row.text || row.placeholder}</span>
                {row.text ? <span className="s-cap">Used for: {row.usedFor}</span> : null}
              </span>
              {row.text ? (
                <button type="button" className="s-textbtn" aria-label={`Edit ${row.name.toLowerCase()}`} onClick={() => route.navigate(route.stepPath(row.step))}>
                  Edit
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </aside>
    </Card>
  );
}

/** The "So far: ..." recap line. */
export function summaryLine(answers: Answers, sport: SportKey, visited: number): string {
  const comfort = comfortOption(answers.comfort);
  const parts: string[] = [];
  if (comfort) parts.push(capitalize(comfort.echo));
  parts.push(...preferenceEchoes(answers));
  if (visited >= 3) parts.push(timeAnswerLine(answers));
  if (visited >= 4 && sport) parts.push(SPORTS[sport].name);
  return parts.length ? `So far: ${parts.join(" · ")}` : "";
}
