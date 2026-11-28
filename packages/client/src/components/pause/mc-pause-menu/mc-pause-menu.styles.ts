import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseMenuStyles = [
  PauseBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: min-content;
      --mc-button-size: 18px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    /* Concede and the rest of the foot sit at the bottom when there is room, and follow the menu when there is not. */
    .foot {
      margin-top: auto;
      padding-top: 16px;
    }
    .item {
      position: relative;
      height: 48px;
    }
    .item.full {
      grid-column: 1 / -1;
    }
    mc-button {
      width: 100%;
      height: 100%;
    }
    /* The footer of the phone sheet: Resume over Save & quit and Concede side by side. */
    :host([mode="phone"]) .foot {
      margin-top: 0;
      padding-top: 0;
    }
    :host([mode="phone"]) .item {
      height: 44px;
    }
    :host([mode="phone"]) .item.primary {
      height: 52px;
    }
    :host([mode="phone"]) {
      --mc-button-size: 16px;
    }
    /* A short screen (a phone held sideways): smaller buttons, closer together, and the foot follows the menu. */
    @media (max-height: 480px) {
      :host {
        --mc-button-size: 15px;
      }
      .grid {
        gap: 6px;
      }
      .item {
        height: 38px;
      }
      :host([mode="wide"]) .item.full:not(.primary) {
        grid-column: auto;
      }
      :host([mode="wide"]) .foot .item.full {
        grid-column: 1 / -1;
      }
      .foot {
        padding-top: 6px;
      }
      :host([mode="phone"]) .grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      :host([mode="phone"]) .item,
      :host([mode="phone"]) .item.primary {
        height: 44px;
      }
      :host([mode="phone"]) .item.full {
        grid-column: auto;
      }
    }
  `,
];
