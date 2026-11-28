import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

export const McStatsMatchupHeadStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      min-width: 0;
      min-height: 0;
      background: var(--mc-fill-paper);
      font-size: 13px;
      line-height: 1.2;
      overflow: hidden;
    }
    :host([cursor]) {
      background: var(--mc-fill-parchment);
    }
    .name {
      min-width: 0;
    }
    /* Heat grid. A row's name reads across, ending against the cells; a column's stands on end, reading up. */
    :host([axis="row"][kind="heat"]) {
      align-items: center;
      justify-content: flex-end;
      padding: 0 8px 0 4px;
      text-align: right;
    }
    :host([axis="column"][kind="heat"]) {
      align-items: flex-start;
      justify-content: center;
      padding: 4px 0;
    }
    :host([axis="column"][kind="heat"]) .name {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      max-height: 100%;
    }
    /* Stamp grid. A row leads with its picture; a column's picture stands over its name. */
    :host([axis="row"][kind="stamps"]) {
      align-items: center;
      gap: 6px;
      padding: 4px 6px 4px 2px;
      font-size: 11px;
    }
    :host([axis="column"][kind="stamps"]) {
      flex-direction: column;
      align-items: stretch;
      gap: 3px;
      padding: 2px 3px;
      font-size: 11px;
      text-align: center;
    }
    mc-picture-tile {
      flex: none;
    }
    :host([axis="row"][kind="stamps"]) mc-picture-tile {
      align-self: stretch;
      width: 52px;
    }
    :host([axis="column"][kind="stamps"]) mc-picture-tile {
      flex: 1 1 0;
      min-height: 30px;
    }
    :host([axis="column"][kind="stamps"]) .name {
      flex: none;
      min-height: 26px;
    }
    @container (max-width: 520px) {
      :host([axis="row"][kind="stamps"]) {
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 2px 4px;
      }
      :host([axis="row"][kind="stamps"]) mc-picture-tile {
        width: auto;
        flex: none;
        height: 24px;
      }
    }
  `,
];
