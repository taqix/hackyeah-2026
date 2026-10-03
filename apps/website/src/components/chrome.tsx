import { useState, useEffect } from "react";
import { Icon, Button, IconButton, Badge } from "../design-system";
import { go } from "../lib";
import { AppIcon } from "./shared";
import type { Breakpoint } from "../types";

/* ============ landing ============ */
function SiteHeaderLanding({ hasPlan, theme, onTheme }: { hasPlan: boolean; theme: string; onTheme: () => void }) {
  const [line, setLine] = useState(false);
  useEffect(() => {
    const f = () => setLine(window.scrollY > 8);
    f(); addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  const anchorClick = h => e => { if (location.hash === h) { e.preventDefault(); window.dispatchEvent(new HashChangeEvent("hashchange")); } };
  return (
    <header className={"s-top" + (line ? " is-line" : "")}>
      <div className="s-wrap s-top-in">
        <a className="s-mark" href="#/"><AppIcon size={32} />Movo</a>
        <span className="s-fill"></span>
        <nav className="s-navlinks" aria-label="Sections">
          <a className="s-navlink" href="#/how" onClick={anchorClick("#/how")}>How it works</a>
          <a className="s-navlink" href="#/features" onClick={anchorClick("#/features")}>What's inside</a>
        </nav>
        <ThemeButton theme={theme} onTheme={onTheme} />
        <Button variant="inverse" size="md" iconRight="arrow-right" onClick={() => go(hasPlan ? "#/try/plan" : "#/try/1")}>{hasPlan ? "Your plan" : "Try it"}</Button>
      </div>
    </header>
  );
}
function ThemeButton({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  return <IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onTheme} />;
}

function SiteFooter({ onTop }: { onTop: () => void }) {
  return (
    <footer className="s-footer">
      <div className="s-wrap s-footer-in">
        <div className="s-col" style={{ gap: 4 }}>
          <p className="s-row" style={{ gap: 8 }}><AppIcon size={24} /><span><b className="s-footmark">Movo</b> · Everyone starts somewhere.</span></p>
          <p>General wellbeing only. Not medical advice.</p>
        </div>
        <button type="button" className="s-textbtn" onClick={onTop}><Icon name="arrow-up" size={16} />Back to top</button>
      </div>
    </footer>
  );
}

/* ============ demo chrome ============ */
function DemoHeader({ onStartOver, theme, onTheme, bp }: { onStartOver: () => void; theme: string; onTheme: () => void; bp: Breakpoint }) {
  return (
    <header className="s-top is-line">
      <div className="s-wrap s-top-in">
        <a className="s-mark" href="#/" aria-label="Movo, back to overview"><AppIcon size={32} />Movo</a>
        <Badge tone="info" style={{ marginLeft: 4 }}>Demo</Badge>
        <span className="s-fill"></span>
        {bp === "phone"
          ? <IconButton icon="rotate-ccw" label="Start over" onClick={onStartOver} />
          : <Button variant="ghost" size="md" icon="rotate-ccw" onClick={onStartOver}>Start over</Button>}
        <ThemeButton theme={theme} onTheme={onTheme} />
      </div>
    </header>
  );
}

export { SiteHeaderLanding, ThemeButton, SiteFooter, DemoHeader };
