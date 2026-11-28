import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseRulesStyles = [
  PauseBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      color: var(--mc-text-ink);
    }
    .head {
      flex: none;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .title {
      margin: 0;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 20px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .rule {
      flex: 1;
      height: 2px;
      background: color-mix(in srgb, var(--mc-line-ink) 30%, transparent);
    }
    .filtered {
      font-size: var(--mc-small-9, 9px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      grid-auto-rows: min-content;
      align-content: start;
      gap: 12px;
      padding: 0 4px 4px 0;
    }
    .empty {
      margin: 0;
      font-size: var(--mc-small-10, 10px);
      line-height: 1.4;
      opacity: 0.5;
    }
    /* A short screen: the pane scrolls as a whole, so the grid shows every card. */
    @media (max-height: 520px) {
      .grid {
        overflow: visible;
        flex: none;
      }
    }
  `,
];
