import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McGamesPanelStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: block;
    }
    .reading {
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.5;
    }
    .headline {
      margin-bottom: 8px;
      font-size: var(--mc-small-12, 12px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    :host([on-dark]) .headline {
      color: var(--mc-fill-caution);
    }
    /* The insight reads on paper whatever the panel it sits in. */
    .insight {
      margin-bottom: 10px;
      padding: 6px 8px;
      background: var(--mc-fill-paper);
      color: var(--mc-text-ink);
      font-size: var(--mc-small-12, 12px);
      line-height: 1.4;
    }
    .note {
      font-size: var(--mc-small-11, 11px);
      line-height: 1.4;
      opacity: 0.75;
      margin-bottom: 8px;
    }
  `,
];
