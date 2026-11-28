import type { BarChartBar } from "@mc/ui";

export interface McCostCurveProps {
  /** The title ("Cost curve", "RESOURCE CURVE"). */
  heading: string;
  /** "avg 2.4"; empty shows none. */
  average: string;
  bars: readonly BarChartBar[];
  /** A card of its own (the narrow Curve tab) rather than a section of the rail. */
  framed: boolean;
}
