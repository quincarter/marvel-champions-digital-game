/**
 * Where a threat meter's parts go for each `ThreatMeterStyle` (`ui/widgets.ts` `paintThreatMeter` draws them). Pure
 * geometry, so the four styles can be checked without a scene.
 *
 * - "box": the bar fills `meter`, and the count sits on a parchment box across its middle, 2px in from top and bottom.
 * - "tall": the bar grows {@link TALL_METER_GROWTH}px upward (never downward, so it keeps clear of the panel's bottom
 *   edge) and the box keeps the old bar's height, so a strip of the fill shows above and below it.
 * - "beside": the count moves into its own box at the right end of `meter`, and the bar takes the rest, uncovered.
 * - "outline": the bar fills `meter` and the count is drawn straight on it, with no box.
 */
import type { ThreatMeterStyle } from "../settings.js";
import type { Rect } from "./layout.js";

/** How much taller the "tall" style's bar is than the meter rect it was given. */
export const TALL_METER_GROWTH = 6;
/** The gap between the bar and the count's own box in the "beside" style. */
export const BESIDE_GAP = 6;

export interface ThreatMeterLayout {
  /** The bar: its parchment ground, its fill and its outline. */
  readonly bar: Rect;
  /** The count's box (a chip across the bar, or its own box beside it); null when the count has no box. */
  readonly countBox: Rect | null;
  /** Where the count is centered. */
  readonly countCenter: { readonly x: number; readonly y: number };
  /** The widest the count may be drawn. */
  readonly countMaxWidth: number;
  /** The count's box is a chip over the bar ("box", "tall"), sized to the text, rather than a fixed box beside it. */
  readonly chip: boolean;
}

/** The count's own box width in the "beside" style: about a third of the meter, never under 54px. */
export function besideBoxWidth(meterWidth: number): number {
  return Math.min(Math.max(54, Math.round(meterWidth * 0.3)), Math.round(meterWidth / 2));
}

/**
 * The meter's parts for `style`. A chip's width depends on the drawn text, so `chipWidth` (the text's width plus its
 * padding) is passed in once the count has been fitted; before that, pass 0 and read only `bar` and `countMaxWidth`.
 */
export function threatMeterLayout(meter: Rect, style: ThreatMeterStyle, chipWidth = 0): ThreatMeterLayout {
  if (style === "beside") {
    const boxWidth = besideBoxWidth(meter.width);
    const countBox = { x: meter.x + meter.width - boxWidth, y: meter.y, width: boxWidth, height: meter.height };
    return {
      bar: { ...meter, width: Math.max(0, meter.width - boxWidth - BESIDE_GAP) },
      countBox,
      countCenter: { x: countBox.x + boxWidth / 2, y: meter.y + meter.height / 2 - 1 },
      countMaxWidth: boxWidth - 6,
      chip: false,
    };
  }
  const bar =
    style === "tall"
      ? { ...meter, y: meter.y - TALL_METER_GROWTH, height: meter.height + TALL_METER_GROWTH }
      : { ...meter };
  const countCenter = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 - 1 };
  if (style === "outline") {
    return { bar, countBox: null, countCenter, countMaxWidth: bar.width - 12, chip: false };
  }
  // The chip is as tall as the plain meter less 2px each side, whichever style, so "tall" leaves 5px of bar showing
  // above and below it.
  const inset = (bar.height - (meter.height - 4)) / 2;
  const width = Math.min(bar.width - 4, chipWidth);
  return {
    bar,
    countBox: { x: bar.x + (bar.width - width) / 2, y: bar.y + inset, width, height: bar.height - inset * 2 },
    countCenter,
    countMaxWidth: bar.width - 12,
    chip: true,
  };
}
