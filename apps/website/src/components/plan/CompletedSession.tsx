import { Button, Card, IconButton } from "../../design-system";
import { capitalize, feelingOption, formatFullDate, type DoneRecord, type Session } from "../../domain";
import { ExerciseLine, Kicker } from "../common";

export interface CompletedSessionProps {
  date: Date;
  session: Session;
  /** The caller has already checked `session.done` is set; passed separately so this stays non-null here. */
  done: DoneRecord;
  onClose(): void;
}

/** A session that is already done: its log, as it was left, plus how it felt. */
export function CompletedSession({ date, session, done, onClose }: CompletedSessionProps) {
  const anyTicked = done.ticked.some(Boolean);
  return (
    <div className="s-dlg-in">
      <div className="s-dhead">
        <div className="s-dtitle">
          <Kicker>{formatFullDate(date)} · done · {session.minutes} min</Kicker>
          <h2 id="s-dlg-h" className="s-h2">{session.title}</h2>
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <Card variant="sunken" padding={0}>
        <div className="s-loglist">
          {session.exercises.map((exercise, index) => (
            <ExerciseLine key={index} exercise={exercise} check={!anyTicked || done.ticked[index] ? "done" : "open"} />
          ))}
        </div>
      </Card>
      <div className="s-col" style={{ gap: 6 }}>
        <span className="s-sub">{capitalize(feelingOption(done.feeling).phrase)}</span>
        {done.note ? <p className="s-bodysm">{done.note}</p> : null}
      </div>
      <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Close</Button>
    </div>
  );
}
