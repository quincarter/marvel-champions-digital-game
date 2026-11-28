
import { css } from "lit";
import { BriefingPressStyles } from "../shared/briefing.styles.js";

export const McBriefingCardThumbStyles = [
  BriefingPressStyles,
  css`
    :host {
      position: relative;
      flex: none;
      width: var(--thumb-width, auto);
      height: var(--thumb-height, auto);
      aspect-ratio: 1 / 1.42;
    }
    :host([shape="landscape"]) {
      aspect-ratio: 1.42 / 1;
    }
    :host([shape="square"]) {
      aspect-ratio: 1 / 1;
    }
    mc-picture-tile {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .badge {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 22px;
      height: 22px;
      padding: 4px;
      box-sizing: border-box;
      border-radius: 50%;
      background: color-mix(in srgb, var(--mc-fill-ink) 85%, transparent);
      color: var(--mc-text-paper);
      pointer-events: none;
    }
  `,
];
