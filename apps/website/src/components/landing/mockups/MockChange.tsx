import { IconButton } from "../../../design-system";
import { Bubble, ChangeCard } from "../../common";
import { MOCK_CHANGE } from "./data";

/** Chat 8.3: a change the coach has applied, with Undo. */
export function MockChange() {
  return (
    <>
      <div className="m-top" style={{ minHeight: 52 }}>
        <IconButton icon="arrow-left" label="Back" />
        <span className="s-col" style={{ alignItems: "center", gap: 2 }}>
          <span className="s-sub">Coach</span>
          <span className="s-cap" style={{ color: "var(--text-secondary)" }}>Running · week 1</span>
        </span>
        <span style={{ width: 44 }} />
      </div>
      <div className="m-content" style={{ gap: 12 }}>
        <Bubble>
          Tell us what to change, or a workout you did. Your plan updates straight away, and you can always undo.
        </Bubble>
        <Bubble me>Can we keep everything to mornings this week, and make Friday shorter?</Bubble>
        <ChangeCard {...MOCK_CHANGE} onUndo={() => {}} onSeePlan={() => {}} seeLabel="See week" />
      </div>
      <div className="m-compose">
        <span className="s-cap" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Changes apply straight away. You can undo.
        </span>
        <div className="s-row" style={{ gap: 8 }}>
          <span className="m-input">Message your coach…</span>
          <IconButton icon="arrow-up" label="Send" variant="primary" disabled />
        </div>
      </div>
    </>
  );
}
