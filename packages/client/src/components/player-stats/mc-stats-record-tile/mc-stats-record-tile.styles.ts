import { css } from "lit";
import { StatsTileStyles } from "../shared/stats-tile.styles.js";

export const McStatsRecordTileStyles = [
  StatsTileStyles,
  css`
    :host {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      justify-content: space-between;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .record {
      font-size: clamp(40px, 5.2cqw, 58px);
      letter-spacing: 1px;
      white-space: nowrap;
    }
    .track {
      height: 12px;
      border: 2px solid var(--mc-text-paper);
      padding: 1px;
    }
    .fill {
      height: 100%;
      min-width: 2px;
      background: var(--mc-fill-red);
    }
  `,
];
