import type { PictureSource, SegmentBarPart } from "@mc/ui";
import type { StatsFigureLine } from "../mc-stats-figures-tile/mc-stats-figures-tile.types.js";

/** One Overview tile, as the view model words it (the scene has translated and coloured it). */
export type StatsTileModel =
  | {
      readonly kind: "record";
      readonly id: string;
      readonly caption: string;
      readonly record: string;
      readonly rate: string;
      readonly fraction: number;
      readonly detail: string;
    }
  | {
      readonly kind: "split";
      readonly id: string;
      readonly label: string;
      readonly parts: readonly SegmentBarPart[];
      readonly detail: string;
    }
  | {
      readonly kind: "figures";
      readonly id: string;
      readonly label: string;
      readonly lines: readonly StatsFigureLine[];
    }
  | {
      readonly kind: "portrait";
      readonly id: string;
      /** The headline tile (the favorite hero): a banner, or standing tall on a wide screen. */
      readonly hero: boolean;
      readonly label: string;
      readonly name: string;
      readonly detail: string;
      readonly extra: string;
      readonly picture: PictureSource | null;
    }
  | {
      readonly kind: "small";
      readonly id: string;
      readonly label: string;
      readonly value: string;
      readonly detail: string;
    };

export interface McStatsOverviewProps {
  tiles: readonly StatsTileModel[];
}
