import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McSwitchRowStyles = [
  PressBaseStyles,
  css`
    :host {
      color: var(--mc-text-paper);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 56px;
      padding: 6px 0;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .title {
      font-size: var(--mc-small-12, 12px);
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.75;
    }
    .detail {
      font-size: var(--mc-small-10, 10px);
      line-height: 1.3;
      opacity: 0.8;
    }
    .switch {
      flex: none;
      width: 84px;
      height: 36px;
      display: grid;
      place-items: center;
      background: var(--mc-fill-paper);
      color: var(--mc-text-ink);
      outline: 2px solid var(--mc-line-paper);
      outline-offset: -1px;
      font-size: var(--mc-small-9, 9px);
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }
    /* On: the ink fill with a paper frame inside the border, and the word ON. */
    :host([on]) .switch {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      outline-width: 2.5px;
      box-shadow:
        inset 0 0 0 3px var(--mc-fill-ink),
        inset 0 0 0 4.5px var(--mc-line-paper);
    }
    :host([unavailable]) {
      cursor: default;
    }
    :host([unavailable]) .text {
      opacity: 0.55;
    }
    :host([unavailable]) .switch {
      background: transparent;
      color: var(--mc-text-paper);
      outline-style: dashed;
      opacity: 0.55;
    }
  `,
];
