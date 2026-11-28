import { css } from "lit";
import { CardFrameStyles, PressBaseStyles } from "../../../shared/press/press.styles.js";

export const McOptionCardStyles = [
  PressBaseStyles,
  CardFrameStyles,
  css`
    :host {
      container-type: inline-size;
    }
    .frame {
      padding: 8px 10px;
      display: flex;
      gap: 10px;
      align-items: center;
      min-height: 60px;
    }
    :host([compact]) .frame {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
    }
    .names {
      flex: 0 0 var(--names, 170px);
      max-width: 40%;
      min-width: 0;
    }
    :host([compact]) .names {
      flex: none;
      max-width: none;
    }
    .name {
      --name-size: 18px;
    }
    .off .name,
    .off .value {
      opacity: 0.6;
    }
    .controls {
      flex: 1;
      display: flex;
      gap: 6px;
      justify-content: flex-end;
      align-items: center;
      min-width: 0;
    }
    :host([compact]) .controls {
      justify-content: flex-start;
    }
    .controls mc-chip {
      flex: 1 1 0;
      max-width: 84px;
    }
    :host([compact]) .controls mc-chip {
      max-width: 120px;
    }
    .step mc-chip {
      flex: 0 0 48px;
    }
    .value {
      font-family: var(--mc-font-display);
      letter-spacing: 2px;
      font-size: 20px;
      min-width: 56px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wide-value .value {
      flex: 1;
    }
    .groups {
      display: grid;
      grid-template-columns: repeat(var(--per-row, 4), minmax(0, 1fr));
      gap: 6px 12px;
      flex: 1;
    }
    .group .label {
      margin-bottom: 2px;
    }
    .pair {
      display: flex;
      gap: 4px;
    }
    .pair mc-chip {
      flex: 1;
    }
    mc-press-card {
      display: block;
    }
    /* Narrower than this the name sits over its controls, as the compact attribute forces. */
    @container (max-width: 300px) {
      .frame {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .names {
        flex: none;
        max-width: none;
      }
      .controls {
        justify-content: flex-start;
      }
      .controls mc-chip {
        max-width: 120px;
      }
      .groups {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
];
