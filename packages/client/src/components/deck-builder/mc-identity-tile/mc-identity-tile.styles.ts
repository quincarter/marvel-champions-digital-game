import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McIdentityTileStyles = [
  BuilderBaseStyles,
  css`
    :host {
      background: var(--mc-fill-card);
      outline: 2px solid var(--mc-line-ink);
      outline-offset: -1px;
    }
    .art {
      aspect-ratio: 1.5;
      padding: 3px 3px 0;
    }
    mc-card-art {
      width: 100%;
      height: 100%;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 6px;
      text-align: center;
      border-top: 2px solid var(--mc-line-ink);
      font-family: var(--mc-font-display);
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-size: 15px;
      line-height: 1.05;
      overflow: hidden;
    }
  `,
];
