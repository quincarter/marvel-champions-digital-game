import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsMatchupShelfStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
      cursor: pointer;
      outline: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    .shelf {
      display: grid;
      grid-template-columns: 64px minmax(0, 1fr);
      gap: 8px 10px;
      align-items: center;
      padding: 6px 10px 6px 6px;
      min-height: 80px;
    }
    .thumb {
      width: 64px;
      height: 64px;
      grid-row: span 2;
    }
    .who {
      min-width: 0;
    }
    .name {
      font-family: var(--mc-font-display);
      font-size: 18px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .summary {
      font-size: 12px;
      opacity: 0.85;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .long {
      display: none;
    }
    .detail {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }
    .bars {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 6px;
    }
    .pips {
      display: none;
      flex-wrap: wrap;
      gap: 3px;
    }
    .pip {
      width: 12px;
      height: 12px;
      flex: none;
    }
    .pip[data-kind="tier"] {
      background: var(--pip);
    }
    .pip[data-kind="unplayed"] {
      background: var(--mc-fill-paper);
    }
    .pip[data-kind="played"] {
      border: 2px solid var(--mc-line-ink);
    }
    .badge {
      display: none;
      flex: none;
      min-width: 92px;
      padding: 8px 6px;
      text-align: center;
      background: var(--badge);
      color: var(--badge-ink);
      border: 2px solid var(--mc-line-ink);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    @container (min-width: 640px) {
      .shelf {
        grid-template-columns: 64px 230px minmax(0, 1fr);
      }
      .thumb {
        grid-row: auto;
      }
      .long {
        display: block;
      }
      .short {
        display: none;
      }
      .pips {
        display: flex;
      }
      .badge {
        display: block;
      }
    }
  `,
];
