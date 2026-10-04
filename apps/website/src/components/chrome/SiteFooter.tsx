import { Icon } from "../../design-system";
import { AppIcon } from "../common";

export function SiteFooter({ onBackToTop }: { onBackToTop: () => void }) {
  return (
    <footer className="s-footer">
      <div className="s-wrap s-footer-in">
        <div className="s-col" style={{ gap: 4 }}>
          <p className="s-row" style={{ gap: 8 }}>
            <AppIcon size={24} />
            <span><b className="s-footmark">Movo</b> · Everyone starts somewhere.</span>
          </p>
          <p>General wellbeing only. Not medical advice.</p>
        </div>
        <button type="button" className="s-textbtn" onClick={onBackToTop}>
          <Icon name="arrow-up" size={16} />Back to top
        </button>
      </div>
    </footer>
  );
}
