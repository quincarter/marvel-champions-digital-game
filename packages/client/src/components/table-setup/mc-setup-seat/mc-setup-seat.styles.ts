import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupSeatStyles = [
  SetupBaseStyles,
  css`
    :host {
      container-type: inline-size;
      min-width: 0;
      position: relative;
    }
    .card {
      height: 100%;
      min-height: var(--seat-height, 60px);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 6px 6px 10px;
      background: var(--mc-fill-card);
      border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 60%, transparent);
    }
    :host([selected]) .card {
      border-color: var(--mc-line-ink);
    }
    /* Where the first player token rests: an empty ring on everyone else, the token itself on the first player. */
    .spot {
      flex: none;
      position: relative;
      width: 30px;
      height: 30px;
    }
    .spot::before {
      content: "";
      position: absolute;
      inset: 2px;
      border-radius: 50%;
      border: 1.5px solid color-mix(in srgb, var(--mc-line-ink) 60%, transparent);
    }
    :host([selected]) .spot::before {
      display: none;
    }
    ::slotted(mc-first-player-token) {
      position: absolute;
      inset: -5px;
      width: auto;
      height: auto;
    }
    .avatar {
      flex: none;
      width: 48px;
      height: 48px;
    }
    .avatar mc-picture-tile {
      display: block;
      width: 100%;
      height: 100%;
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    .text .name {
      --name-size: 14px;
    }
    .text .label {
      margin-top: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* The phone's chip: YOU / S2 over the hero's name, an ink fill when first player, the token on its top right corner. */
    :host([mode="phone"]) .card {
      min-height: 56px;
      justify-content: center;
      text-align: center;
      padding: 4px;
      border: 2.5px solid var(--mc-line-ink);
    }
    :host([mode="phone"][selected]) .card {
      background: var(--mc-fill-ink);
      color: var(--mc-text-paper);
    }
    :host([mode="phone"]) .spot {
      position: absolute;
      top: -10px;
      right: -8px;
      width: 34px;
      height: 34px;
      z-index: 1;
    }
    :host([mode="phone"]) .spot::before {
      display: none;
    }
    :host([mode="phone"]) .avatar {
      display: none;
      width: 44px;
      height: 44px;
    }
    @container (min-width: 160px) {
      :host([mode="phone"]) .avatar {
        display: block;
      }
    }
    :host([mode="phone"]) .text .name {
      --name-size: 15px;
    }
  `,
];
