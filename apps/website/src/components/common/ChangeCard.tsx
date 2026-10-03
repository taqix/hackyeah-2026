import { Button, Icon } from "../../design-system";
import type { RevisionSummary } from "../../domain";
import { Fine } from "./Fine";

/** One value as it was and as it is now. */
export interface ChangeDiff {
  icon?: string;
  from: string;
  to: string;
}

/** A day's row on a change card. */
export interface ChangeCardRow {
  day: string;
  date: string;
  title?: string;
  diffs: ChangeDiff[];
  note?: string;
}

/** An applied chat change, as the app's own chat shows it (mobile 8.3). */
export interface ChangeCardProps {
  time?: string;
  summary?: string;
  rows: ChangeCardRow[];
  /** What the change left alone, which is the promise the demo makes. */
  kept?: string;
  undone?: boolean;
  onUndo?: (() => void) | null;
  onSeePlan?: (() => void) | null;
  seeLabel?: string;
}

function UndoneCard() {
  return (
    <section className="s-change" aria-label="Change undone">
      <div className="s-chead">
        <div className="s-row" style={{ gap: 10 }}>
          <span className="s-rdisc is-neutral"><Icon name="undo-2" size={16} strokeWidth={2} /></span>
          <span className="s-sub" style={{ flex: 1 }}>Change undone</span>
        </div>
        <p className="s-bodysm">Back to how it was.</p>
      </div>
    </section>
  );
}

export function ChangeCard({
  time = "Just now",
  summary,
  rows,
  kept,
  undone,
  onUndo,
  onSeePlan,
  seeLabel = "See plan",
}: ChangeCardProps) {
  if (undone) return <UndoneCard />;
  return (
    <section className="s-change" aria-label="Plan updated">
      <div className="s-chead">
        <div className="s-row" style={{ gap: 10 }}>
          <span className="s-rdisc"><Icon name="check" size={16} strokeWidth={2} /></span>
          <span className="s-sub" style={{ flex: 1 }}>Plan updated</span>
          <span className="s-cap">{time}</span>
        </div>
        {summary ? <p className="s-bodysm">{summary}</p> : null}
      </div>
      {rows.map(row => (
        <div key={`${row.day}-${row.date}`} className="s-crow">
          <span className="s-cday"><b>{row.day}</b><span className="s-cap">{row.date}</span></span>
          <span className="s-col" style={{ flex: 1, minWidth: 0, gap: 6 }}>
            {row.title ? <span className="s-ctitle">{row.title}</span> : null}
            {row.diffs.map(diff => (
              <span key={`${diff.from}-${diff.to}`} className="s-diff">
                {diff.icon ? <Icon name={diff.icon} size={16} style={{ color: "var(--accent-text)" }} /> : null}
                <span className="s-sr">was </span>
                <s>{diff.from}</s>
                <Icon name="arrow-right" size={14} style={{ color: "var(--text-tertiary)" }} />
                <span className="s-sr">now </span>
                <strong>{diff.to}</strong>
              </span>
            ))}
            {row.note ? <span className="s-bodysm">{row.note}</span> : null}
          </span>
        </div>
      ))}
      <div className="s-cfoot">
        {kept ? <Fine icon="lock">{kept}</Fine> : null}
        {onUndo || onSeePlan ? (
          <div className="s-row" style={{ gap: 8 }}>
            {onUndo ? <Button size="sm" variant="secondary" icon="undo-2" onClick={onUndo}>Undo</Button> : null}
            <span className="s-fill" />
            {onSeePlan ? (
              <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={onSeePlan}>{seeLabel}</Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** A chat change summary as change-card rows: one day, one before-and-after. */
export function summaryRows(summary: RevisionSummary): ChangeCardRow[] {
  return summary.rows.map(row => ({ day: row.day, date: row.date, diffs: [{ from: row.from, to: row.to }] }));
}
