import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McGamesAgainstStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }
    .step {
      display: flex;
      gap: 12px;
    }
    .step mc-button {
      height: 44px;
    }
    .step .prev {
      flex: none;
      width: 44px;
    }
    .step .against {
      flex: 1 1 auto;
      min-width: 0;
    }
    .sources {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .sources mc-button,
    .share mc-button {
      height: 44px;
    }
    .note {
      font-size: var(--mc-small-11, 11px);
      line-height: 1.4;
      opacity: 0.75;
    }
    .share .line {
      margin-top: 6px;
      font-size: var(--mc-small-11, 11px);
      line-height: 1.4;
      opacity: 0.75;
    }
  `,
];
