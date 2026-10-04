import { IconButton } from "../../design-system";
import type { Theme } from "../../hooks/useTheme";

export function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <IconButton
      icon={dark ? "sun" : "moon"}
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={onToggle}
    />
  );
}
