import type { ControlGlyph } from "@mc/ui";

/** The progress strip at the bar's right end: how many lessons, how many are behind the player or this one. */
export interface LearnHeaderTicks {
  readonly count: number;
  readonly filled: number;
  /** "Lesson 1 of 5", already translated. */
  readonly label: string;
}

/** The properties of `mc-learn-header`. */
export interface LearnHeaderProps {
  readonly heading: string;
  readonly closeLabel: string;
  readonly glyph: ControlGlyph | undefined;
  readonly ticks: LearnHeaderTicks | null;
  readonly drop: number;
  readonly max: number;
  readonly barHeight: number;
  readonly pad: number;
  readonly titleSize: number;
}
