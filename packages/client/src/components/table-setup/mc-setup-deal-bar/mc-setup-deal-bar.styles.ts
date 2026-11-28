import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupDealBarStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      color: var(--mc-text-paper);
    }
    .status {
      font-size: 13px;
      line-height: 1.3;
    }
    .line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .deal {
      --chip-height: 56px;
      --chip-size: 28px;
      --chip-fill: var(--mc-fill-red);
      --chip-color: var(--mc-text-paper);
      --chip-line: var(--mc-fill-red);
    }
    /* The pinned footer of the compact page: ink, the summary line, then Deal with a paper outline round it. */
    :host([mode="phone"]) {
      background: var(--mc-fill-ink);
      padding: 8px 16px 14px;
      gap: 6px;
    }
    :host([mode="phone"]) .deal {
      --chip-line: var(--mc-fill-red);
      outline: 1.5px solid var(--mc-text-paper);
      outline-offset: 1.5px;
      margin: 3px;
    }
  `,
];
