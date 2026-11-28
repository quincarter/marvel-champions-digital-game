import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupSeatingStyles = [
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
    .seats {
      display: grid;
      grid-template-columns: repeat(var(--seats, 2), minmax(0, 1fr));
      gap: 10px;
    }
    :host([mode="phone"]) .seats {
      gap: 6px;
    }
    mc-setup-seat {
      --seat-height: 60px;
    }
    .random {
      --chip-height: 56px;
      --chip-size: 12px;
      --chip-border: dashed;
      --chip-fill: transparent;
      --chip-line: var(--mc-line-ink);
    }
    .note {
      font-size: 13px;
      line-height: 1.3;
    }
  `,
];
