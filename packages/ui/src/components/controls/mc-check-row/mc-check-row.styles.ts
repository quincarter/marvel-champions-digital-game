import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McCheckRowStyles = [
  PressBaseStyles,
  css`
    :host {
      min-height: 60px;
    }
    .row {
      height: 100%;
      min-height: 60px;
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 0 10px 0 11px;
      background: var(--mc-fill-card);
      border: 2.5px solid var(--mc-line-ink);
    }
    :host([locked]) .row {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    .box {
      flex: none;
      width: 24px;
      height: 24px;
      border: 2px solid currentColor;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 700;
    }
    :host([checked]) .box {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      border-color: var(--mc-line-ink);
    }
    :host([locked]) .box {
      background: var(--mc-fill-red);
      border-color: var(--mc-text-paper);
      color: var(--mc-text-paper);
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .name {
      --name-size: 13px;
    }
    .text .label {
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .text .label:empty {
      display: none;
    }
    :host([onink]) .row {
      background: transparent;
      border: 0;
      color: var(--mc-text-paper);
    }
    :host([onink]) .box,
    :host([onink][checked]) .box {
      background: transparent;
      border-color: var(--mc-text-paper);
      color: var(--mc-text-paper);
    }
    :host([locked]) .label {
      opacity: 0.8;
    }
  `,
];
