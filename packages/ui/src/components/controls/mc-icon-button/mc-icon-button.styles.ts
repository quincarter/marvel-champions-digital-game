import { css } from "lit";
import { PressBaseStyles } from "../../../shared/press/press.styles.js";

/** The chrome button of the table's top bar: ink with a paper rim; paper with an ink picture while hovered or lit. */
export const McIconButtonStyles = [
  PressBaseStyles,
  css`
    :host {
      position: relative;
      display: block;
      width: var(--icon-button-width, var(--icon-button-size, 44px));
      height: var(--icon-button-size, 44px);
      --ib-fill: var(--mc-fill-ink);
      --ib-ink: var(--mc-text-paper);
    }
    .box {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 0 4px;
      background: var(--ib-fill);
      color: var(--ib-ink);
      outline: 2px solid var(--mc-line-paper);
      outline-offset: -2px;
    }
    svg {
      flex: none;
      width: var(--icon-size, 20px);
      height: var(--icon-size, 20px);
      overflow: visible;
    }
    .label {
      flex: none;
      font-weight: 800;
      font-size: var(--mc-small-11, 11px);
      letter-spacing: 1.2px;
      line-height: 1;
    }
    :host([lit]) {
      --ib-fill: var(--mc-fill-paper);
      --ib-ink: var(--mc-text-ink);
    }
    @media (hover: hover) {
      :host(:hover) {
        --ib-fill: var(--mc-fill-paper);
        --ib-ink: var(--mc-text-ink);
      }
    }
    .badge {
      position: absolute;
      right: -6px;
      top: -6px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 9px;
      background: var(--mc-fill-red);
      outline: 2px solid var(--mc-line-paper);
      outline-offset: -1px;
      color: var(--mc-text-paper);
      font-weight: 800;
      font-size: 11px;
      line-height: 1;
      z-index: 3;
    }
    mc-glyph {
      position: absolute;
      left: 50%;
      top: calc(100% + 6px);
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 6;
    }
  `,
];
