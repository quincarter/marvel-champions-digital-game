import { css } from "lit";
import { BuilderBaseStyles } from "../shared/builder-base.styles.js";

export const McIdentityPickerStyles = [
  BuilderBaseStyles,
  css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 0;
    }
    mc-search-field {
      flex: none;
      height: 44px;
      margin-bottom: 12px;
    }
    .grid {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      scrollbar-gutter: stable;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--tile-min, 170px), 1fr));
      gap: 12px;
      align-content: start;
    }
    .empty {
      opacity: 0.5;
      font-size: 14px;
    }
  `,
];
