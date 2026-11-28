import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupEncounterStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .panels {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .panel {
      background: var(--mc-fill-card);
      border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 45%, transparent);
      color: var(--mc-text-ink);
      padding: 8px 10px 10px;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    :host([mode="phone"]) .panel {
      border: 2.5px solid var(--mc-line-ink);
      padding: 10px 12px;
    }
    .nemesis {
      background: var(--mc-fill-parchment);
    }
    .title {
      margin-bottom: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 14px;
      line-height: 1.3;
    }
    .row-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count {
      font-weight: 700;
    }
    .row.red {
      color: var(--mc-text-red);
    }
    hr {
      width: 100%;
      height: 1px;
      border: 0;
      margin: 6px 0;
      background: color-mix(in srgb, var(--mc-line-ink) 45%, transparent);
    }
    .sentence {
      font-size: 14px;
      line-height: 1.3;
    }
    .quiet {
      opacity: 0.7;
    }
    .foot {
      margin-top: auto;
      padding-top: 8px;
    }
  `,
];
