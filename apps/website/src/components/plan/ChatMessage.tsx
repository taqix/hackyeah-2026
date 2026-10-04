import { Button, Card, Icon } from "../../design-system";
import type { RevisionSummary } from "../../domain";
import { Bubble, ChangeCard, Fine, summaryRows } from "../common";
import type { ChatItem } from "../../demo/types";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery";

export interface ChatMessageProps {
  item: ChatItem;
  /** True for a "result" message that is still the plan's current, un-undone version. */
  isLatestResult: boolean;
  /** Narrow layouts show "See plan" since the chat isn't already sitting beside the plan. */
  showSeePlanAction: boolean;
  onUndo(version: number): void;
  onSeePlan(summary: RevisionSummary): void;
  onStartOver(): void;
}

/** One chat item, as whichever shape its kind calls for. */
export function ChatMessage({ item, isLatestResult, showSeePlanAction, onUndo, onSeePlan, onStartOver }: ChatMessageProps) {
  const reducedMotion = usePrefersReducedMotion();

  switch (item.kind) {
    case "user":
      return <Bubble me>{item.text}</Bubble>;

    case "coach":
      return <Bubble>{item.text}</Bubble>;

    case "checking":
      return (
        <div className="s-checking">
          <span className={reducedMotion ? "" : "s-spin"} style={{ display: "flex", color: "var(--accent-text)" }}>
            <Icon name="loader-circle" size={18} />
          </span>
          Checking the change…
        </div>
      );

    case "refusal":
      return (
        <>
          <Bubble>{item.text}</Bubble>
          <Fine icon="lock">Plan unchanged</Fine>
        </>
      );

    case "result":
      return (
        <ChangeCard
          rows={summaryRows(item.summary)}
          kept={item.summary.foot}
          undone={item.undone}
          onUndo={isLatestResult ? () => onUndo(item.summary.version) : null}
          onSeePlan={showSeePlanAction ? () => onSeePlan(item.summary) : null}
        />
      );

    case "closing":
      return (
        <Card variant="accent" padding={20}>
          <div className="s-col" style={{ gap: 10 }}>
            <h3 className="s-h3">That's the journey.</h3>
            <p className="s-bodysm">
              Answers, a sport, a first week, and {item.kept ? "a change that kept what you'd done" : "a change applied straight away"}.
              Keep asking, or start again with different answers.
            </p>
            <div className="s-row" style={{ gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              <Button variant="secondary" icon="rotate-ccw" onClick={onStartOver}>Start over</Button>
            </div>
          </div>
        </Card>
      );

    default: {
      const exhaustiveCheck: never = item;
      return exhaustiveCheck;
    }
  }
}
