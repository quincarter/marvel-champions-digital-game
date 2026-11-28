import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPoolListStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    mc-windowed-list {
      flex: 1 1 auto;
      min-height: 0;
    }
    :host([view="list"]) mc-windowed-list {
      outline: 2px solid var(--mc-line-ink);
      outline-offset: -1px;
    }
    .empty {
      padding: 10px;
      font-size: 14px;
      opacity: 0.5;
    }
    mc-pool-cell {
      --caption-height: var(--caption, 46px);
    }
  `,
];
