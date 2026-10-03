/* The props every question-step component receives. This is also the public contract
   for <StepView>, re-exported from the barrel as `StepViewProps`. */
import type { Answers, CompanyKey, PlaceKey, RankedSport, SportKey } from "../../domain";
import type { Breakpoint } from "../../hooks/useMediaQuery";

export interface StepProps {
  step: number;
  answers: Answers;
  ranked: RankedSport[];
  sport: SportKey; // the effective sport (pick, or best fit)
  visited: number;
  hasPlan: boolean;
  breakpoint: Breakpoint;
  today: Date;
  onAnswer(patch: Partial<Answers>): void;
  onTogglePlace(key: PlaceKey): void;
  onToggleCompany(key: CompanyKey): void;
  onPickSport(sport: SportKey): void;
  onChoose(): void;
}
