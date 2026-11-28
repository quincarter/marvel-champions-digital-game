import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsTabsStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: stretch;
    }
    .hint {
      grid-column: 1 / -1;
      position: relative;
      height: 14px;
      margin-bottom: -6px;
    }
    /* The rail swipes sideways where its tabs do not fit; on a wide screen it fills the row. */
    .scroll {
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
    }
    .scroll::-webkit-scrollbar {
      display: none;
    }
    mc-tab-rail {
      min-width: calc(var(--tab-count, 1) * 112px);
      height: 44px;
    }
    :host([mode="phone"]) mc-tab-rail {
      min-width: calc(var(--tab-count, 1) * 104px);
    }
    .toggle {
      position: relative;
      width: 124px;
    }
    mc-chip {
      --chip-height: 44px;
      --chip-size: 16px;
      --chip-pad: 8px;
      --chip-on-fill: var(--mc-fill-red);
      --chip-on-color: var(--mc-text-paper);
    }
  `,
];
