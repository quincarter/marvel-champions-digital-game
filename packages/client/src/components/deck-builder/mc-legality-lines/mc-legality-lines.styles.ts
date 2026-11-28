import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McLegalityLinesStyles = [
  BuilderBaseStyles,
  css`
    p {
      margin: 0 0 12px;
      font-size: var(--mc-small-12, 12px);
      line-height: 1.4;
    }
    .verdict {
      color: var(--mc-text-red-deep);
    }
    .verdict.ok {
      color: var(--mc-text-heal);
    }
    .frozen {
      color: var(--mc-text-red-deep);
    }
    .dirty,
    .status {
      margin-bottom: 8px;
      opacity: 0.75;
    }
    /* On the ink panel the problems and the frozen reason read in paper, the legal count in green. */
    :host([on-dark]) .verdict:not(.ok),
    :host([on-dark]) .frozen {
      color: var(--mc-text-paper);
    }
  `,
];
