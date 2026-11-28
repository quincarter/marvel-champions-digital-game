import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McBuilderActionsStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      gap: 8px;
    }
    mc-button {
      flex: 1 1 0;
      min-width: 0;
      height: 44px;
    }
    :host([on-dark]) mc-button {
      --mc-tint-fill: var(--mc-fill-ink);
      --mc-tint-ink: var(--mc-text-paper);
    }
  `,
];
