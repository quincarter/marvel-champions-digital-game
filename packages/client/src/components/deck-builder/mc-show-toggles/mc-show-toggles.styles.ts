import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McShowTogglesStyles = [
  BuilderBaseStyles,
  css`
    .chips {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    mc-button {
      height: 44px;
      min-width: 0;
    }
    /* Inline (the desktop's pool column): a "show" word, two chips and the card count share one row. */
    :host([inline]) .row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    :host([inline]) .label {
      margin: 0;
      width: 48px;
      flex: none;
    }
    :host([inline]) .chips {
      display: flex;
    }
    :host([inline]) mc-button {
      width: 130px;
    }
    .count {
      margin-left: auto;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.5;
    }
  `,
];
