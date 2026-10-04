import { Icon } from "../../design-system";
import { setInert } from "../../a11y";
import type { ReactNode } from "react";

/* A phone-shaped frame for the landing page's mockups, drawn at the app's size and scaled.
   The contents are a picture of the app, so the whole frame is hidden from assistive tech. */
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const PHONE_RADIUS = 48;

export function PhoneFrame({ scale, children }: { scale: number; children?: ReactNode }) {
  return (
    <div
      className="s-phone"
      aria-hidden="true"
      ref={setInert}
      style={{ width: PHONE_WIDTH * scale, height: PHONE_HEIGHT * scale, borderRadius: PHONE_RADIUS * scale }}
    >
      <div className="s-phone-in" style={{ transform: `scale(${scale})` }}>
        <div className="s-phone-status">
          <span>9:41</span>
          <span className="s-row" style={{ gap: 6 }}>
            <Icon name="signal" size={16} strokeWidth={2} />
            <Icon name="wifi" size={16} strokeWidth={2} />
            <Icon name="battery-full" size={20} />
          </span>
        </div>
        <div className="s-phone-body">{children}</div>
      </div>
    </div>
  );
}
