import { useState, useEffect, type KeyboardEvent } from "react";
import type { Breakpoint } from "./types";

/* ============ hooks and small helpers ============ */
function useMQ(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q), h = () => setM(mq.matches);
    mq.addEventListener("change", h); h();
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}
function useBP(): Breakpoint {
  const desk = useMQ("(min-width: 1024px)"), tab = useMQ("(min-width: 768px)");
  return desk ? "desktop" : tab ? "tablet" : "phone";
}
const useReduced = () => useMQ("(prefers-reduced-motion: reduce)");
const reducedNow = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const go = (h: string) => { location.hash = h; };
const setInert = (el: HTMLElement | null) => { if (el) el.setAttribute("inert", ""); };

function parseRoute(hash: string): { view: string; key: string; anchor?: string; step?: number } {
  const p = (hash || "").replace(/^#/, "");
  if (p === "/how") return { view: "landing", anchor: "how", key: p };
  if (p === "/features") return { view: "landing", anchor: "features", key: p };
  const m = p.match(/^\/try\/([1-4])$/);
  if (m) return { view: "step", step: +m[1], key: p };
  if (p === "/try/planning") return { view: "planning", key: p };
  if (p === "/try/plan") return { view: "plan", key: p };
  if (p === "/try/sample") return { view: "sample", key: p };
  return { view: "landing", key: "/" };
}
/* Arrow keys move focus and selection between [role=radio] items in a group, wrapping. */
function radioArrows(e: KeyboardEvent<HTMLElement>) {
  const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
  if (!(e.key in keys)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const nx = items[(i + keys[e.key] + items.length) % items.length];
  nx.focus(); nx.click();
}

export { useMQ, useBP, useReduced, reducedNow, go, setInert, parseRoute, radioArrows };
