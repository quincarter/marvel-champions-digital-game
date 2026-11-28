import { css } from "lit";
import { StatsTileStyles } from "../shared/stats-tile.styles.js";

export const McStatsSplitTileStyles = [
  StatsTileStyles,
  css`
    mc-segment-bar {
      margin: 4px 0;
    }
  `,
];
