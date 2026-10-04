import { useEffect, useState, type MouseEvent } from "react";
import { Button } from "../../design-system";
import * as route from "../../routing";
import { AppIcon } from "../common";
import { ThemeButton } from "./ThemeButton";
import type { Theme } from "../../hooks/useTheme";

/** How far down the page the header grows its hairline. */
const HAIRLINE_AT = 8;

function useScrolledPast(offset: number): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const sync = () => setPast(window.scrollY > offset);
    sync();
    addEventListener("scroll", sync, { passive: true });
    return () => removeEventListener("scroll", sync);
  }, [offset]);
  return past;
}

/** Clicking the section you are already on should scroll to it again, which only
    happens if the route is re-announced, because the hash itself does not change. */
function sameSectionAgain(hash: string) {
  return (event: MouseEvent) => {
    if (location.hash !== hash) return;
    event.preventDefault();
    route.renavigate();
  };
}

export interface SiteHeaderProps {
  hasPlan: boolean;
  theme: Theme;
  onToggleTheme: () => void;
}

/** The landing page's header. */
export function SiteHeader({ hasPlan, theme, onToggleTheme }: SiteHeaderProps) {
  const scrolled = useScrolledPast(HAIRLINE_AT);
  return (
    <header className={`s-top${scrolled ? " is-line" : ""}`}>
      <div className="s-wrap s-top-in">
        <a className="s-mark" href={route.LANDING}><AppIcon size={32} />Movo</a>
        <span className="s-fill" />
        <nav className="s-navlinks" aria-label="Sections">
          <a className="s-navlink" href={route.HOW_IT_WORKS} onClick={sameSectionAgain(route.HOW_IT_WORKS)}>How it works</a>
          <a className="s-navlink" href={route.WHATS_INSIDE} onClick={sameSectionAgain(route.WHATS_INSIDE)}>What's inside</a>
        </nav>
        <ThemeButton theme={theme} onToggle={onToggleTheme} />
        <Button
          variant="inverse"
          size="md"
          iconRight="arrow-right"
          onClick={() => route.navigate(hasPlan ? route.PLAN : route.stepPath(route.FIRST_STEP))}
        >
          {hasPlan ? "Your plan" : "Try it"}
        </Button>
      </div>
    </header>
  );
}
