import type { Answers, ComfortValue } from "../../domain";
import type { Breakpoint } from "../../hooks/useMediaQuery";
import { ClosingBand } from "./ClosingBand";
import { FeaturesSection } from "./FeaturesSection";
import { Hero } from "./Hero";
import { HowSection } from "./HowSection";

export interface LandingProps {
  answers: Answers;
  onAnswer: (comfort: ComfortValue) => void;
  breakpoint: Breakpoint;
}

export function Landing({ answers, onAnswer, breakpoint }: LandingProps) {
  return (
    <div className="s-wrap">
      <Hero comfort={answers.comfort} onAnswer={onAnswer} breakpoint={breakpoint} />
      <HowSection breakpoint={breakpoint} />
      <FeaturesSection />
      <ClosingBand />
    </div>
  );
}
