import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McDeckListStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    .controls mc-button {
      flex: 1 1 0;
      height: 44px;
      min-width: 0;
    }
    .groups {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-gutter: stable;
    }
    /* In the narrow Deck tab the whole tab scrolls: the list flows. */
    :host([flow]) .groups {
      flex: none;
      overflow: visible;
    }
    .group + .group {
      margin-top: 4px;
    }
    .head {
      margin: 8px 0 2px;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      opacity: 0.5;
    }
  `,
];
