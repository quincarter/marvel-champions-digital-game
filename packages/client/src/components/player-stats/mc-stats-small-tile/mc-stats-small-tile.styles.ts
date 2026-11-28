import { css } from "lit";
import { StatsTileStyles } from "../shared/stats-tile.styles.js";

export const McStatsSmallTileStyles = [
  StatsTileStyles,
  css`
    .value {
      font-size: 24px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .body {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    @container (max-width: 520px) {
      .value {
        font-size: 20px;
      }
    }
  `,
];
