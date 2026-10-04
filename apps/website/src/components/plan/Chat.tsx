import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, IconButton, Tag } from "../../design-system";
import type { Chip, Plan, RevisionSummary } from "../../domain";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import { prefersReducedMotion, usePrefersReducedMotion } from "../../hooks/useMediaQuery";
import type { ChatItem } from "../../demo/types";
import { ChatMessage } from "./ChatMessage";

export interface ChatProps {
  plan: Plan;
  chat: ChatItem[];
  busy: boolean;
  /** Pre-ranked suggestion chips, computed from the plan and the last session's feeling. */
  chips: Chip[];
  onSend(text: string): void;
  onUndo(version: number): void;
  onStartOver(): void;
  breakpoint: Breakpoint;
  /** Called from a result message's "See plan" action, to bring the changed day into view. */
  onSeePlan(summary: RevisionSummary): void;
  /** Set when the chat renders inside the mobile sheet, which adds a close button. */
  onClose?(): void;
  inDialog?: boolean;
}

/** The chat panel: the log of messages, the suggestion chips, and the compose box. */
export function Chat({ plan, chat, busy, chips, onSend, onUndo, onStartOver, breakpoint, onSeePlan, onClose, inDialog }: ChatProps) {
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const narrow = breakpoint !== "desktop";

  /* New messages never jump the view to the end. If the first new one is out of sight,
     bring its top into view and let the reader scroll on from there. */
  useEffect(() => {
    const log = logRef.current;
    const firstFreshElement = log?.querySelector<HTMLElement>("[data-fresh]");
    if (!log || !firstFreshElement) return;
    const freshRect = firstFreshElement.getBoundingClientRect();
    const visibleBounds = inDialog ? log.getBoundingClientRect() : { top: 64, bottom: window.innerHeight };
    if (freshRect.top >= visibleBounds.top && freshRect.top <= visibleBounds.bottom - 48) return;
    firstFreshElement.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [chat.length]);

  function sendCurrentText() {
    const trimmedText = text.trim();
    if (!trimmedText || busy) return;
    setText("");
    onSend(trimmedText);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendCurrentText();
  }

  return (
    <div className="s-chat">
      <div className="s-chathead">
        <Icon name="message-circle" size={20} style={{ color: "var(--accent-text)" }} />
        <div className="s-col" style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <h2 id="s-chat-h" className="s-sub">Change your plan</h2>
          <span className="s-cap">Changes apply straight away</span>
        </div>
        {inDialog ? <IconButton icon="x" label="Close" onClick={onClose} /> : null}
      </div>
      <div className="s-log" role="log" aria-live="polite" aria-labelledby="s-chat-h" ref={logRef} tabIndex={0}>
        {chat.map((item, index) => {
          const isFirstFreshItem = item.fresh && !chat.slice(0, index).some(candidate => candidate.fresh);
          const itemClassName = `s-logitem${item.fresh && !reducedMotion ? " s-new" : ""}`;
          const isLatestResult =
            item.kind === "result" && !item.undone && plan.active === item.summary.version && plan.versions.length === item.summary.version;
          const showSeePlanAction = item.kind === "result" && narrow && !item.undone;
          return (
            <div key={item.id} className={itemClassName} data-fresh={isFirstFreshItem ? "" : undefined}>
              <ChatMessage
                item={item}
                isLatestResult={isLatestResult}
                showSeePlanAction={showSeePlanAction}
                onUndo={onUndo}
                onSeePlan={onSeePlan}
                onStartOver={onStartOver}
              />
            </div>
          );
        })}
      </div>
      {!busy ? (
        <div className="s-chips">
          <div className="s-tags" role="group" aria-label="Suggestions">
            {chips.map(chip => (
              <Tag
                key={chip.id}
                onClick={() => onSend(chip.text)}
                style={{ height: 44, ...(chip.accent ? { border: "1px solid var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : null) }}
              >
                {chip.label}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}
      <form className="s-compose" onSubmit={handleSubmit}>
        <input
          className="s-input"
          aria-label="Ask for a change"
          placeholder="Ask for a change…"
          maxLength={140}
          value={text}
          disabled={busy}
          onChange={event => setText(event.target.value)}
        />
        <IconButton variant="primary" icon="arrow-up" label="Send" disabled={!text.trim() || busy} onClick={() => sendCurrentText()} />
      </form>
    </div>
  );
}
