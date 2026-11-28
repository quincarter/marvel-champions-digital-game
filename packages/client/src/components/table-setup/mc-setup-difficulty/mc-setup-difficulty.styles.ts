import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupDifficultyStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(var(--slots, 3), minmax(0, 1fr));
      gap: 12px;
    }
    .cards mc-press-card {
      min-height: 76px;
    }
    .cards .name {
      --name-size: 18px;
    }
    .cards .meta {
      margin-top: 4px;
    }
    .strip {
      display: flex;
      gap: 2px;
    }
    .strip mc-chip {
      flex: 1;
      --chip-size: 17px;
    }
    .sets {
      background: var(--mc-fill-card);
      border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 70%, transparent);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .sets.active {
      border: 4px solid var(--mc-fill-red);
    }
    .setrow {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .setrow .who {
      flex: 0 0 96px;
      min-width: 0;
    }
    .setrow .name {
      --name-size: 16px;
    }
    .chips {
      flex: 1;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
    }
    .chips mc-chip {
      flex: 1 1 0;
      max-width: 80px;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
    }
    .opts > .span2 {
      grid-column: 1 / -1;
    }
    :host([mode="phone"]) .opts {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .tdmeta {
      margin-top: 4px;
    }
  `,
];
