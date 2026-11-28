import { css } from "lit";
import { PauseBaseStyles } from "../shared/pause-base.styles.js";

export const McPauseConfirmStyles = [
  PauseBaseStyles,
  css`
    :host {
      position: absolute;
      inset: 0;
      z-index: 5;
      pointer-events: none;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 16px;
      background: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent);
      pointer-events: auto;
    }
    .dialog {
      width: min(420px, 100%);
      max-height: 100%;
      overflow-y: auto;
      padding: 20px;
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
      border: 4px solid var(--mc-line-paper);
      border-top-color: var(--mc-line-red);
      --mc-button-size: 18px;
    }
    .sentence {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 700;
      line-height: 1.4;
    }
    .buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    mc-button {
      height: 48px;
    }
    @media (max-width: 380px), (max-height: 480px) {
      .dialog {
        padding: 14px;
      }
      .sentence {
        margin-bottom: 10px;
        font-size: 14px;
      }
      mc-button {
        height: 44px;
      }
    }
  `,
];
