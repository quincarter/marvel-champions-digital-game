import { css } from "lit";

/**
 * The Settings overlay's body on its ink panel, as the Phaser one drew it: a row title is a 12px label in capitals at
 * 75% paper, its detail 10px body text at 80% (55% when it says why the row can't be used), a section heading 19px
 * Bangers with a 3px rule after it. A cell is ink with a 2px paper border, or filled (paper or caution) when chosen.
 * Sizes at or under 12px grow on desktop (--mc-small-*), as Phaser's labels do.
 */
export const McSettingsBodyStyles = css`
  :host {
    display: block;
    height: 100%;
    color: var(--mc-text-paper);
  }
  .scroller {
    height: 100%;
  }
  .content {
    position: relative;
  }
  .heading,
  .row,
  .control {
    position: absolute;
  }
  .heading {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .heading h3 {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 19px;
    line-height: 1.15;
    letter-spacing: 2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
  }
  .heading .rule {
    flex: 1 1 0;
    height: 3px;
    margin-top: calc(19px * 1.15 / 2 - 1.5px);
    background: var(--mc-fill-paper);
  }
  .row p {
    margin: 0;
    position: absolute;
    left: 0;
  }
  .row[data-tappable] {
    cursor: pointer;
  }
  .title {
    top: 2px;
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
    opacity: 0.75;
    white-space: nowrap;
  }
  .detail {
    top: 20px;
    font-size: var(--mc-small-10, 10px);
    line-height: 1.1;
    opacity: 0.8;
  }
  .detail[data-dim] {
    opacity: 0.55;
  }

  .cell,
  .field {
    box-sizing: border-box;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .cell {
    background: var(--mc-fill-ink);
    border: 2px solid var(--mc-line-paper);
    color: var(--mc-text-paper);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .cell[data-selected][data-fill="paper"] {
    background: var(--mc-fill-paper);
    border-color: var(--mc-line-paper);
    color: var(--mc-text-ink);
  }
  .cell[data-selected][data-fill="caution"] {
    background: var(--mc-fill-caution);
    border-color: var(--mc-line-caution);
    color: var(--mc-text-ink-on-hue);
  }
  .cell .label {
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    padding: 0 4px;
  }
  /* A tile: its label and a detail under it, from the top left. */
  .cell[data-detail] {
    display: block;
    padding: 6px 6px 0 8px;
  }
  .cell[data-detail] .label {
    display: block;
    padding: 0;
    font-size: var(--mc-small-12, 12px);
    letter-spacing: 0;
    text-transform: none;
    line-height: 1.25;
  }
  .cell-detail {
    display: block;
    margin-top: 3px;
    font-size: var(--mc-small-9, 9px);
    line-height: 1.35;
    opacity: 0.7;
  }
  .cell[data-selected] .cell-detail {
    opacity: 0.85;
  }

  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: var(--mc-fill-paper);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    color: var(--mc-text-ink);
  }
  .field .value {
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .field .arrow {
    font-size: var(--mc-small-10, 10px);
    font-weight: 800;
  }
`;
