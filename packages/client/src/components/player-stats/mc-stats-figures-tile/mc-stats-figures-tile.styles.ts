import { css } from "lit";
import { StatsTileStyles } from "../shared/stats-tile.styles.js";

export const McStatsFiguresTileStyles = [
  StatsTileStyles,
  css`
    dl {
      margin: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 12px;
      font-weight: 800;
      font-size: 15px;
    }
    dt {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    dd {
      margin: 0;
      text-align: right;
    }
    @container (max-width: 520px) {
      dl {
        font-size: 13px;
        gap: 4px 8px;
      }
    }
  `,
];
