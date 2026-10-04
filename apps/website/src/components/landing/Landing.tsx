import type { Breakpoint } from "../../hooks/useMediaQuery";
import { ClosingBand } from "./ClosingBand";
import { FeaturesSection } from "./FeaturesSection";
import { Hero } from "./Hero";
import { HowSection } from "./HowSection";

export interface LandingProps {
  breakpoint: Breakpoint;
}

export function Landing({ breakpoint }: LandingProps) {
  return (
    <div className="s-wrap">
      <Hero breakpoint={breakpoint} />
      <HowSection breakpoint={breakpoint} />
      <FeaturesSection />
      <ClosingBand />
    </div>
  );
}
