import type { AspectSegmentModel } from "../mc-aspect-segment/mc-aspect-segment.types.js";

export interface McDeckCompositionProps {
  /** The small heading over the segments ("Aspect"). */
  heading: string;
  segments: readonly AspectSegmentModel[];
  /** The aspect whose tip is open, if any. */
  openTip: string | null;
}
