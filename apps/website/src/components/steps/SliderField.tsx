import type { CSSProperties } from "react";
import { Icon } from "../../design-system";
import type { Range } from "../../domain";

export interface SliderFieldProps {
  id: string;
  label: string;
  icon: string;
  range: Range;
  value: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  /** Labels under the low and high ends of the track. */
  ends: [string, string];
}

/* Labelled range input with the current value spelled out; keyboard and screen readers
   get the native slider. */
export function SliderField({ id, label, icon, range, value, onChange, format, ends }: SliderFieldProps) {
  const percent = ((value - range.min) / (range.max - range.min)) * 100;
  return (
    <div className="s-group">
      <div className="s-grouphead"><h2 id={id} className="s-sect">{label}</h2></div>
      <div className="s-slider">
        <div className="s-sliderval" aria-hidden="true"><Icon name={icon} size={18} />{format(value)}</div>
        <input
          type="range"
          className="s-range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          aria-labelledby={id}
          aria-valuetext={format(value)}
          style={{ "--pct": `${percent}%` } as CSSProperties}
          onChange={event => onChange(Number(event.target.value))}
        />
        <div className="s-sliderends" aria-hidden="true"><span>{ends[0]}</span><span>{ends[1]}</span></div>
      </div>
    </div>
  );
}
