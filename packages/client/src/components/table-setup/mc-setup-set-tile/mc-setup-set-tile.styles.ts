import { css } from "lit";
import { SetupBaseStyles } from "../shared/setup-base.styles.js";

export const McSetupSetTileStyles = [
  SetupBaseStyles,
  css`
    :host {
      display: block;
      position: relative;
      min-height: var(--tile-height, 66px);
    }
    mc-press-card,
    mc-check-row {
      height: 100%;
    }
    .copy {
      padding-left: var(--pic-room, 40px);
      min-height: 40px;
      padding-bottom: 14px;
    }
    .copy .name {
      --name-size: 15px;
    }
    .copy .label {
      margin-top: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .pic {
      position: absolute;
      left: 6px;
      top: 5px;
      bottom: 5px;
      aspect-ratio: 5 / 7;
      pointer-events: none;
      z-index: 1;
    }
    .pic mc-picture-tile {
      display: block;
      width: 100%;
      height: 100%;
    }
    .over {
      left: 0;
      top: 0;
      bottom: 0;
      width: calc(var(--pic-room, 40px) + 4px);
    }
    .tab {
      position: absolute;
      z-index: 1;
      right: 4px;
      bottom: 4px;
      padding: 2px 4px;
    }
    :host([mode="phone"]) .pic {
      left: auto;
      right: 22px;
      top: 4px;
      bottom: 20px;
    }
    :host([mode="phone"]) .over {
      left: auto;
      right: 0;
      width: 76px;
      top: 0;
      bottom: 0;
    }
    :host([mode="phone"]) .tab {
      right: 8px;
      bottom: 3px;
      padding: 0;
    }
    .dimmed .pic {
      opacity: 0.6;
    }
  `,
];
