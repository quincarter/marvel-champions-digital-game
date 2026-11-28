import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McIdentityRowStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 52px;
      padding: 4px;
      max-width: 460px;
      background: var(--mc-fill-card);
      outline: 2px solid var(--mc-line-ink);
      outline-offset: -1px;
    }
    :host([layout="phone"]) {
      max-width: none;
    }
    mc-card-art {
      flex: none;
      height: 100%;
      aspect-ratio: 1.5;
    }
    .words {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      padding: 2px 0;
    }
    .words .label {
      margin: 0;
    }
    .name {
      font-family: var(--mc-font-display);
      letter-spacing: 2px;
      text-transform: uppercase;
      font-size: 16px;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cue {
      flex: none;
      margin-right: 8px;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
  `,
];
