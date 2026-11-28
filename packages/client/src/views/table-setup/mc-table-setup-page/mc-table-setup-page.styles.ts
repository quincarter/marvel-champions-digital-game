import { css } from "lit";
import { ResponsiveStyles } from "./responsive.styles.js";

export const TableSetupPageStyles = [
  css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      font-family: var(--mc-font-body);
      color: var(--mc-text-ink);
      background-color: var(--mc-fill-paper);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
        transparent 1.2px
      );
      background-size: 6px 6px;
      -webkit-font-smoothing: antialiased;
    }
    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }
    /* The page's one scroller: the sections' own rows scroll with it, so no control sits over a scrolling region. */
    .main {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
    }
    .main > * {
      flex: none;
    }
    :host([mode="phone"]) {
      background-image: none;
    }
  `,
  ResponsiveStyles,
];
