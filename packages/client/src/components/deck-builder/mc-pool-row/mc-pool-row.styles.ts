import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McPoolRowStyles = [
  BuilderBaseStyles,
  css`
    :host {
      height: 100%;
      padding: 0 4px 6px;
    }
    .frame {
      display: flex;
      align-items: stretch;
      height: 100%;
      background: var(--mc-fill-card);
      border: 2px solid var(--mc-line-ink);
    }
    .face {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      gap: 10px;
      padding: 6px;
      cursor: pointer;
    }
    mc-card-art {
      flex: none;
      width: var(--thumb-width, 60px);
      height: 100%;
    }
    .words {
      flex: 1 1 auto;
      min-width: 0;
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
    .type,
    .note {
      margin-top: 2px;
      font-size: var(--mc-small-9, 9px);
      line-height: 1.25;
      opacity: 0.5;
      font-weight: 700;
      letter-spacing: 0.1em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .note {
      opacity: 0.6;
    }
    .rules {
      margin-top: 4px;
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }
    .rules.short {
      -webkit-line-clamp: 2;
    }
    mc-copy-buttons {
      flex: none;
      width: 146px;
      padding-right: 6px;
      --copy-justify: flex-end;
      --copy-gap: 0px;
      --copy-button: 40px;
    }
  `,
];
