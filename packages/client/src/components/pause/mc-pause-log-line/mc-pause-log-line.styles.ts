import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseLogLineStyles = [
  PauseBaseStyles,
  css`
    :host {
      color: var(--mc-text-ink);
      min-height: 44px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 2px 10px 2px 8px;
      outline: 1px solid color-mix(in srgb, var(--mc-line-ink) 50%, transparent);
      outline-offset: -1px;
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
    .undo {
      flex: none;
      font-size: 14px;
    }
  `,
];
