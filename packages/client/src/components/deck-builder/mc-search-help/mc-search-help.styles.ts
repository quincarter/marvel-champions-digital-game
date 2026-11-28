import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McSearchHelpStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    mc-dialog {
      --dialog-width: 720px;
    }
    h3 {
      margin: 14px 0 6px;
      font-family: var(--mc-font-display);
      font-weight: 400;
      font-size: 18px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    p {
      margin: 0 0 6px;
      font-size: 13px;
      line-height: 1.4;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      padding: 8px 8px 8px 10px;
      background: var(--mc-fill-parchment);
      border: 2px solid var(--mc-line-ink);
    }
    .words {
      flex: 1 1 auto;
      min-width: 0;
    }
    .query {
      font-family: var(--mc-font-mono);
      font-weight: 700;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .meaning {
      margin-top: 2px;
      font-size: 12px;
      opacity: 0.75;
      line-height: 1.35;
    }
    .row mc-button {
      flex: none;
      height: 44px;
      --mc-button-size: 11px;
    }
    .use {
      width: 64px;
    }
    .copy {
      width: 76px;
    }
    @media (max-width: 600px) {
      .use {
        width: 52px;
      }
      .copy {
        width: 66px;
      }
    }
    .back {
      height: 52px;
    }
  `,
];
