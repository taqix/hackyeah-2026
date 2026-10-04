/** How far through the questions you are. Decorative: the step is also written out in words. */
export function StepDots({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="s-bar" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => <span key={index} className={index < filled ? "on" : ""} />)}
    </div>
  );
}
