import { Card, Icon, SuggestionCard } from "../../design-system";
import { activeVersion, dayLabel, feelingPhrase, sessionAt, SLOTS, SPORTS, type Plan } from "../../domain";

export interface DayCardProps {
  plan: Plan;
  /** The day currently selected on the plan strip. */
  selectedOffset: number;
  /** Opens the session dialog for the selected day. */
  onOpen(offset: number): void;
}

/** The selected day's card: a rest day, a done session, or a planned one. */
export function DayCard({ plan, selectedOffset, onOpen }: DayCardProps) {
  const version = activeVersion(plan);
  const session = sessionAt(version, selectedOffset);
  const label = dayLabel(plan, selectedOffset);

  if (!session) {
    return (
      <Card variant="sunken" padding={20}>
        <div className="s-restcard">
          <Icon name="leaf" size={20} style={{ color: "var(--recovery)", marginTop: 2 }} />
          <div className="s-col" style={{ gap: 4 }}>
            <h2 className="s-sub">Rest day</h2>
            <p className="s-bodysm">Nothing planned. A walk to the shop still counts.</p>
          </div>
        </div>
      </Card>
    );
  }

  if (session.done) {
    return (
      <SuggestionCard
        tone={SPORTS[session.sport].tone}
        kicker={`${label} · done · ${feelingPhrase(session)}`}
        title={`${session.title}.`}
        body="Saved. It stays like this, whatever you change next."
        actionLabel="View"
        onAction={() => onOpen(selectedOffset)}
      />
    );
  }

  return (
    <SuggestionCard
      tone={SPORTS[session.sport].tone}
      kicker={`${label} · ${SLOTS[session.slot].word} · ${session.minutes} min`}
      title={`${session.title}.`}
      body={session.reason}
      actionLabel="Open"
      onAction={() => onOpen(selectedOffset)}
    />
  );
}
