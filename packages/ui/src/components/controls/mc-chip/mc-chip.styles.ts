import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McChipStyles = [
  PressBaseStyles,
  css`
    :host {
      min-width: 0;
      min-height: var(--chip-height, 44px);
    }
    .box {
      height: 100%;
      min-height: inherit;
      display: grid;
      place-items: center;
      padding: 0 4px;
      background: var(--chip-fill, var(--mc-fill-card));
      color: var(--chip-color, inherit);
      border: 2px var(--chip-border, solid) var(--chip-line, var(--mc-line-ink));
      font-family: var(--mc-font-display);
      text-transform: uppercase;
      font-size: var(--chip-size, 20px);
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([selected]) .box {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    :host([disabled]) .box {
      opacity: 0.5;
      border-color: color-mix(in srgb, var(--mc-line-ink) 40%, transparent);
    }
    :host([link]) {
      min-height: 0;
    }
    :host([link]) .box {
      border: 0;
      background: none;
      font-family: var(--mc-font-body);
      font-size: var(--mc-small-10, 10px);
      font-weight: 700;
      letter-spacing: 0.14em;
      padding: 2px 0;
      place-items: start;
    }
  `,
];
