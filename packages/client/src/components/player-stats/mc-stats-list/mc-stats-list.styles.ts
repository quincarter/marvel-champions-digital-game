import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsListStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      min-height: 0;
      min-width: 0;
      container-type: inline-size;
    }
    /* The list scrolls natively; each tab keeps its own place. */
    .scroller {
      height: 100%;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding: 0 8px 12px 0;
      outline: none;
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent)
        color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
    }
    .blocks {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    mc-section-heading {
      margin-top: 8px;
    }
    .strip {
      display: flex;
      flex-wrap: wrap;
      gap: 14px 12px;
      padding-bottom: 6px;
    }
    .strip.tiles {
      gap: 8px;
    }
    mc-stats-card {
      --card-width: 118px;
    }
    mc-stats-matchup-tile {
      --tile-width: 112px;
    }
    @container (max-width: 520px) {
      mc-stats-card {
        --card-width: 100px;
      }
      mc-stats-matchup-tile {
        --tile-width: 82px;
      }
    }
  `,
];
