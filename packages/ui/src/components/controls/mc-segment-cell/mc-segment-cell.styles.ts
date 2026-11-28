import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McSegmentCellStyles = [
  PressBaseStyles,
  css`
    :host {
      min-width: 0;
      min-height: 44px;
    }
    .cell {
      height: 100%;
      min-height: inherit;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 3px;
      padding: 4px 8px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      outline: 2px solid var(--mc-line-paper);
      outline-offset: -1px;
    }
    .label {
      max-width: 100%;
      text-align: center;
      overflow-wrap: anywhere;
      line-height: 1.2;
      font-size: var(--mc-small-10, 10px);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .detail {
      font-size: var(--mc-small-9, 9px);
      line-height: 1.25;
      opacity: 0.7;
      text-align: left;
    }
    :host([look="tile"]) .cell {
      align-items: flex-start;
      padding: 8px 10px;
    }
    :host([look="tile"]) .label {
      font-size: var(--mc-small-12, 12px);
      letter-spacing: 0;
      text-transform: none;
    }
    :host([selected]) .cell {
      background: var(--mc-fill-caution);
      color: var(--mc-text-ink-on-hue);
      outline-color: var(--mc-fill-caution);
    }
    :host([selected]) .detail {
      opacity: 0.85;
    }
    :host([selected]) .label::before {
      content: "✓ ";
    }
  `,
];
