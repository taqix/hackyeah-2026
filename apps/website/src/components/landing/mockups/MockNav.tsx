import { Icon } from "../../../design-system";

/** The app's tab bar with the chat button beside it (design/README.md › Chat placement). */
export function MockNav() {
  return (
    <>
      <div className="m-nav">
        <span className="m-tab is-on"><Icon name="sun" size={22} strokeWidth={2} />Today</span>
        <span className="m-tab"><Icon name="calendar" size={22} /></span>
        <span className="m-tab"><Icon name="user-round" size={22} /></span>
      </div>
      <span className="m-chat"><Icon name="message-circle" size={24} strokeWidth={2} /></span>
    </>
  );
}
