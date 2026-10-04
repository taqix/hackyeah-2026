import { Button, Card, ExerciseRow, Icon, IconButton, ProgressRing } from "../../design-system";
import { coachTip, formatFullDate, SLOTS, weekdayName, type Session } from "../../domain";
import { ExerciseLine, Kicker } from "../common";

export interface OpenSessionProps {
  date: Date;
  session: Session;
  /** Only today's session can be ticked off live or marked done; others are read-only until their day. */
  isToday: boolean;
  ticked: boolean[];
  onToggleExercise(index: number): void;
  /** Switches the dialog to the "how did it feel?" form. */
  onAskHowItFelt(): void;
  onClose(): void;
}

/** A session not yet done: today's can be ticked off and marked done; a future one is read-only. */
export function OpenSession({ date, session, isToday, ticked, onToggleExercise, onAskHowItFelt, onClose }: OpenSessionProps) {
  const totalExercises = session.exercises.length;
  const tickedCount = ticked.filter(Boolean).length;

  return (
    <div className="s-dlg-in">
      <div className="s-dhead">
        {isToday ? <ProgressRing size={52} value={totalExercises ? tickedCount / totalExercises : 0} label={`${tickedCount}/${totalExercises}`} /> : null}
        <div className="s-dtitle">
          <Kicker>{formatFullDate(date)} · {SLOTS[session.slot].word} · {session.minutes} min</Kicker>
          <h2 id="s-dlg-h" className="s-h2">{session.title}</h2>
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <Card variant="sunken" padding={16}>
        <p className="s-note">
          <Icon name="feather" size={16} style={{ color: "var(--accent-text)", flex: "none" }} />
          <span>{coachTip(session.sport, session.slot)}</span>
        </p>
      </Card>
      <div className="s-col" style={{ gap: 4 }}>
        <h3 className="s-sect">The session</h3>
        <div>
          {isToday
            ? session.exercises.map((exercise, index) => (
                <ExerciseRow
                  key={index}
                  name={exercise.name}
                  detail={exercise.detail}
                  meta={exercise.meta}
                  done={!!ticked[index]}
                  divider={index < totalExercises - 1}
                  onToggle={() => onToggleExercise(index)}
                />
              ))
            : session.exercises.map((exercise, index) => <ExerciseLine key={index} exercise={exercise} />)}
        </div>
      </div>
      {isToday ? (
        <Button size="lg" fullWidth icon="check" onClick={onAskHowItFelt}>Mark done</Button>
      ) : (
        <div className="s-col" style={{ gap: 12 }}>
          <p className="s-cap">Planned for {weekdayName(date)}. You can mark it done on the day.</p>
          <Button variant="secondary" size="lg" fullWidth onClick={onClose}>Close</Button>
        </div>
      )}
    </div>
  );
}
