import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Input, Radio } from "../../design-system";
import { FEELINGS, feelingDescription, weekdayName, type FeelingKey, type Session, type SessionFeedback } from "../../domain";
import { handleRadioArrows } from "../../a11y";
import { Kicker } from "../common";

export interface FeedbackFormProps {
  /** The completed session's day, for the heading's date. */
  date: Date;
  session: Session;
  /** Which exercises were ticked off before "Mark done" was pressed. */
  ticked: boolean[];
  onSave(feedback: SessionFeedback): void;
  onClose(): void;
}

/** The "how did it feel?" form shown right after a session is marked done. */
export function FeedbackForm({ date, session, ticked, onSave, onClose }: FeedbackFormProps) {
  const [feeling, setFeeling] = useState<FeelingKey | null>(null);
  const [note, setNote] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  /* This form only ever mounts once the dialog switches to asking how it felt, so
     focusing on mount is the same as focusing when that switch happens. */
  useEffect(() => { headingRef.current?.focus(); }, []);

  const totalExercises = session.exercises.length;
  const tickedCount = ticked.filter(Boolean).length;
  const stoppedEarly = tickedCount > 0 && tickedCount < totalExercises;

  return (
    <div className="s-dlg-in">
      <div className="s-dhead">
        <div className="s-dtitle">
          <Kicker>{weekdayName(date)} done · {session.minutes} min</Kicker>
          <h2 id="s-dlg-h" ref={headingRef} tabIndex={-1} className="s-h2">
            {stoppedEarly ? "Stopping early still counts." : "Nice and steady."}
          </h2>
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </div>
      <div className="s-col" style={{ gap: 12 }}>
        <h3 className="s-sect" id="s-feel-h">How did it feel?</h3>
        <div role="radiogroup" aria-labelledby="s-feel-h" className="s-stack8" onKeyDown={handleRadioArrows}>
          {FEELINGS.map(option => (
            <Radio
              key={option.key}
              variant="card"
              label={option.label}
              description={feelingDescription(option, session.sport)}
              checked={feeling === option.key}
              onChange={() => setFeeling(option.key)}
            />
          ))}
        </div>
      </div>
      <Input label="Anything to note (optional)" placeholder="Shoes, weather, how your legs feel…" value={note} onChange={setNote} />
      <Button
        size="lg"
        fullWidth
        icon="check"
        disabled={!feeling}
        onClick={() => feeling && onSave({ feeling, note: note.trim(), ticked })}
      >
        Save
      </Button>
    </div>
  );
}
