import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPoolCellStyles = [
  BuilderBaseStyles,
  css`
    :host {
      height: 100%;
      min-width: 0;
      padding: 2px 4px 4px;
    }
    .frame {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--mc-fill-card);
      border: 2px solid var(--mc-line-ink);
    }
    :host([framed]) .frame {
      border: 4px solid var(--mc-fill-red);
    }
    .face {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }
    .art {
      position: relative;
      flex: 1 1 auto;
      min-height: 0;
      padding: 3px;
    }
    mc-card-art {
      width: 100%;
      height: 100%;
    }
    .cost {
      position: absolute;
      top: 3px;
      left: 3px;
      min-width: 18px;
      padding: 0 6px;
      line-height: 18px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
    }
    .caption {
      flex: none;
      height: var(--caption-height, 46px);
      padding: 2px 6px 0;
      overflow: hidden;
    }
    .title {
      font-family: var(--mc-font-display);
      letter-spacing: 1px;
      text-transform: uppercase;
      font-size: var(--mc-small-11, 11px);
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line {
      margin-top: 2px;
      font-size: var(--mc-small-9, 9px);
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      opacity: 0.5;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .line.strong {
      opacity: 0.6;
    }
    mc-copy-buttons {
      flex: none;
      padding: 4px;
      --copy-button: min(44px, 30%);
    }
  `,
];
