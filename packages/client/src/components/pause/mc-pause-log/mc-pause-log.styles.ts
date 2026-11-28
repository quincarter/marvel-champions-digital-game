import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseLogStyles = [
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
      margin-bottom: 8px;
    }
    .title {
      margin: 0;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 18px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .note {
      margin: 4px 0 0;
      font-size: var(--mc-small-9, 9px);
      line-height: 1.4;
      opacity: 0.75;
    }
    .frame {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
    }
    .lines {
      flex: 1;
      min-height: 0;
      padding: 10px 8px 6px 12px;
    }
    .line {
      display: flex;
      gap: 6px;
      padding: 3px 0;
    }
    .ref {
      flex: none;
      width: 40px;
      font-family: var(--mc-font-mono);
      font-size: var(--mc-small-9, 9px);
      opacity: 0.6;
    }
    .words {
      flex: 1;
      min-width: 0;
      font-size: var(--mc-small-10, 10px);
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .empty {
      margin: 0;
      font-size: var(--mc-small-10, 10px);
      opacity: 0.5;
    }
    .hint {
      flex: none;
      padding: 6px 12px 8px;
      font-size: var(--mc-small-9, 9px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.6;
      border-top: 1px solid color-mix(in srgb, var(--mc-line-ink) 25%, transparent);
    }
    /* A short screen: the pane scrolls as a whole, so the box keeps a readable height of its own. */
    @media (max-height: 520px) {
      :host {
        flex: none;
      }
      .frame {
        flex: none;
        height: 190px;
      }
    }
  `,
];
