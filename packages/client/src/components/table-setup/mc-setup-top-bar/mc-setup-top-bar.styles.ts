import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupTopBarStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      align-items: center;
      gap: 16px;
      height: 64px;
      padding: 0 22px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    :host([mode="phone"]) {
      gap: 12px;
      padding: 0 12px;
    }
    .back {
      flex: none;
      min-width: 64px;
      --chip-height: 44px;
      --chip-size: 22px;
      --chip-fill: transparent;
      --chip-color: var(--mc-text-paper);
      --chip-line: var(--mc-text-paper);
    }
    :host([mode="phone"]) .back {
      width: 44px;
      min-width: 0;
    }
    .title {
      flex: 0 1 auto;
      min-width: 0;
      max-width: var(--max, none);
      transform: translateY(var(--drop, 0));
      font-family: var(--mc-font-display);
      letter-spacing: 2px;
      text-transform: uppercase;
      font-size: 28px;
      line-height: 1.1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host([mode="phone"]) .title {
      font-size: 22px;
    }
    .step {
      margin-left: auto;
      flex: none;
      opacity: 0.75;
    }
  `,
];
