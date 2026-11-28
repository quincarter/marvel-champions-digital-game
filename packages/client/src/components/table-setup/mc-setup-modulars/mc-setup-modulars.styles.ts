import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupModularsStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    mc-section-heading mc-chip {
      flex: none;
      width: 90px;
      --chip-height: 30px;
      --chip-size: 13px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--tile-min, 280px), 1fr));
      gap: 8px;
    }
    .grid > .group-label {
      grid-column: 1 / -1;
      margin-top: 6px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .required {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      padding: 8px 10px;
      min-height: 58px;
    }
    .required .name {
      --name-size: 15px;
    }
    .required .label {
      margin-top: 4px;
    }
    .info {
      background: var(--mc-fill-card);
      border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 70%, transparent);
      padding: 8px 10px;
      min-height: 58px;
    }
    .info .name {
      --name-size: 15px;
    }
    .info .label {
      margin-top: 4px;
    }
    .group-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 0 4px;
    }
    .group-row .label {
      opacity: 1;
      font-size: var(--mc-small-11, 11px);
    }
    mc-setup-set-tile {
      --tile-height: 66px;
    }
    :host([mode="phone"]) mc-setup-set-tile {
      --tile-height: 64px;
    }
    .hood {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .hood-tile .name {
      --name-size: 15px;
    }
    .hood-tile .label {
      margin-top: 4px;
    }
  `,
];
