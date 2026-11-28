import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupSummaryStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: var(--mc-text-paper);
    }
    :host([mode="phone"]) {
      color: var(--mc-text-ink);
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 6px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }
    .row .label {
      flex: none;
    }
    .row .value {
      min-width: 0;
      text-align: right;
      font-weight: 700;
      font-size: 14px;
    }
    hr {
      width: 100%;
      border: 0;
      height: 1px;
      margin: 0;
      background: color-mix(in srgb, var(--mc-text-paper) 45%, transparent);
    }
    .seed {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .seed mc-text-field {
      flex: 1;
      min-width: 0;
      height: 44px;
    }
    .seed mc-chip {
      flex: none;
      width: 90px;
      --chip-size: 13px;
      --chip-fill: var(--mc-fill-ink);
      --chip-color: var(--mc-text-paper);
      --chip-line: var(--mc-text-paper);
    }
    .help {
      font-size: 13px;
      line-height: 1.3;
      opacity: 0.8;
    }
    .villain {
      flex: 1 1 200px;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .villain mc-picture-tile {
      flex: 1;
      min-height: 0;
      display: block;
    }
    .villain .pic {
      flex: 1;
      min-height: 0;
      display: flex;
    }
    .villain .pic mc-picture-tile {
      width: 100%;
    }
    /* The phone's seed row: a parchment card with the name, a caption, the field and Reroll. */
    .seedcard {
      background: var(--mc-fill-parchment);
      border: 2.5px solid var(--mc-line-ink);
      padding: 8px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .seedcard .name {
      --name-size: 15px;
    }
    .seedcard .seed mc-chip {
      --chip-line: var(--mc-line-ink);
    }
    :host([mode="phone"]) .seedcard {
      margin-top: 0;
    }
    mc-check-row[onink] {
      min-height: 44px;
    }
  `,
];
