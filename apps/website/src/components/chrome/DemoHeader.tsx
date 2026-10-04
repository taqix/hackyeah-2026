import { Badge, Button, IconButton } from "../../design-system";
import * as route from "../../routing";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import type { Theme } from "../../hooks/useTheme";
import { AppIcon } from "../common";
import { ThemeButton } from "./ThemeButton";

export interface DemoHeaderProps {
  onStartOver: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  breakpoint: Breakpoint;
}

/** The header inside the demo, which trades the nav for a way back to the start. */
export function DemoHeader({ onStartOver, theme, onToggleTheme, breakpoint }: DemoHeaderProps) {
  return (
    <header className="s-top is-line">
      <div className="s-wrap s-top-in">
        <a className="s-mark" href={route.LANDING} aria-label="Movo, back to overview"><AppIcon size={32} />Movo</a>
        <Badge tone="info" style={{ marginLeft: 4 }}>Demo</Badge>
        <span className="s-fill" />
        {breakpoint === "phone" ? (
          <IconButton icon="rotate-ccw" label="Start over" onClick={onStartOver} />
        ) : (
          <Button variant="ghost" size="md" icon="rotate-ccw" onClick={onStartOver}>Start over</Button>
        )}
        <ThemeButton theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
