import { css } from "lit";
import { StatsBaseStyles } from "../shared/stats-base.styles.js";

/**
 * The heat and stamp grids: a CSS grid in a native scroll container, the headers sticky at the top and the left so a cell
 * is always read back to its two names. A swipe or the wheel pans it; the row and column names stay put.
 */
export const McStatsMatchupGridStyles = [
  StatsBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 0;
      --cell: 40px;
      --rowh: 190px;
      --colh: 150px;
      container-type: inline-size;
    }
    :host([kind="stamps"]) {
      --cell: 68px;
      --colh: 112px;
    }
    :host([mode="phone"]) {
      --cell: 36px;
      --rowh: 108px;
      --colh: 100px;
    }
    :host([mode="phone"][kind="stamps"]) {
      --cell: 56px;
      --rowh: 78px;
      --colh: 84px;
    }
    @media (max-height: 820px) {
      :host(:not([mode="phone"])) {
        --colh: 110px;
      }
      :host(:not([mode="phone"])[kind="stamps"]) {
        --colh: 96px;
      }
    }
    .scroller {
      flex: 1;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: contain;
      scroll-padding-left: var(--rowh);
      scroll-padding-top: var(--colh);
      background: var(--mc-fill-paper);
      scrollbar-width: thin;
      scrollbar-color: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent)
        color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
      outline: none;
    }
    .grid {
      display: grid;
      width: max-content;
      grid-template-columns: var(--rowh) repeat(var(--columns), var(--cell));
      grid-template-rows: var(--colh) repeat(var(--rows), var(--cell));
    }
    .corner,
    mc-stats-matchup-head[axis="column"],
    mc-stats-matchup-head[axis="row"] {
      position: sticky;
      z-index: 2;
    }
    .corner {
      top: 0;
      left: 0;
      z-index: 3;
      background: var(--mc-fill-paper);
    }
    mc-stats-matchup-head[axis="column"] {
      top: 0;
    }
    mc-stats-matchup-head[axis="row"] {
      left: 0;
    }
    .cell {
      position: relative;
      display: grid;
      place-items: center;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    /* Heat: a square of the tier's colour with a gap round it; played, an outline; neither, parchment. */
    :host([kind="heat"]) .cell::before {
      content: "";
      position: absolute;
      inset: 1px;
      background: var(--mc-fill-parchment);
    }
    :host([kind="heat"]) .cell[data-look="played"]::before {
      background: none;
      border: 2px solid var(--mc-line-ink);
    }
    :host([kind="heat"]) .cell[data-tier]::before {
      background: var(--tier);
    }
    /* Stamps: a disc with an ink ring and a hard shadow for a win, a bare ring for played, a small dot for neither. */
    :host([kind="stamps"]) .cell::before {
      content: "";
      position: absolute;
      width: 18%;
      height: 18%;
      border-radius: 50%;
      background: var(--mc-fill-parchment);
    }
    :host([kind="stamps"]) .cell[data-look="played"]::before {
      width: 72%;
      height: 72%;
      background: none;
      border: 3px solid var(--mc-line-ink);
    }
    :host([kind="stamps"]) .cell[data-tier]::before {
      width: 72%;
      height: 72%;
      background: var(--tier);
      border: 2.5px solid var(--mc-line-ink);
      box-shadow: 2px 2px 0 var(--mc-line-ink);
    }
    .word {
      position: relative;
      color: var(--ink, var(--mc-text-ink));
    }
    /* The cursor: a heavy ink frame with a thin paper one inside it. */
    .cell[data-cursor] {
      box-shadow:
        inset 0 0 0 3px var(--mc-line-ink),
        inset 0 0 0 4px var(--mc-fill-paper);
      z-index: 1;
    }
    .readout {
      flex: none;
      min-height: 42px;
      padding: 2px 2px 0;
    }
    .title {
      font-weight: 800;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail {
      font-size: 12px;
      opacity: 0.85;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
];
