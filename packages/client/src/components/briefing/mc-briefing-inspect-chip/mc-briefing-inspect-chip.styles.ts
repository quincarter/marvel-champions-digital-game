import { css } from "lit";
import { BriefingPressStyles } from "../shared/briefing.styles.js";

export const McBriefingInspectChipStyles = [
  BriefingPressStyles,
  css`
    :host {
      min-height: 44px;
      min-width: 0;
    }
    .chip {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 100%;
      min-height: 44px;
      padding: 0 10px;
      border: 2px solid color-mix(in srgb, var(--mc-line-ink) 55%, transparent);
      font-weight: 800;
      font-size: var(--mc-small-11);
      letter-spacing: 1.2px;
      text-transform: uppercase;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host(:hover) .chip {
      background: color-mix(in srgb, var(--mc-fill-ink) 8%, transparent);
    }
  `,
];
