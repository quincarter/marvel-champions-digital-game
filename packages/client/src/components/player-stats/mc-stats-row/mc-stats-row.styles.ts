import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsRowStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: block;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
      outline: none;
    }
    :host([linked]) {
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host([highlight]) {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    .row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 10px;
      padding: 5px 12px 5px 6px;
      min-height: 58px;
    }
    :host(:not([has-card])) .row {
      grid-template-columns: minmax(0, 1fr);
      padding-left: 12px;
    }
    .thumb {
      align-self: stretch;
      aspect-ratio: 63 / 88;
      min-height: 46px;
    }
    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      column-gap: 12px;
      row-gap: 2px;
      min-width: 0;
      padding-top: 3px;
    }
    .label {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value {
      max-width: 14em;
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
      text-align: right;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .detail {
      grid-column: 1 / -1;
      font-size: 12px;
      line-height: 1.3;
      opacity: 0.75;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
    }
    :host([highlight]) .detail {
      opacity: 0.85;
    }
    .loss {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      margin-top: 4px;
    }
    .loss mc-segment-bar {
      flex: 0 0 min(30%, 220px);
      min-width: 120px;
    }
    .legend {
      flex: 1 1 160px;
      min-width: 0;
      font-size: 12px;
      opacity: 0.85;
    }
    .link {
      grid-column: 1 / -1;
      justify-self: end;
      font-size: 12px;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  `,
];
