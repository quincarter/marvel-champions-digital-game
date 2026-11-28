import { css } from "lit";
import { LearnResponsiveStyles } from "../../learn-responsive.styles.js";

export const HowToPlayPageStyles = [
  css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
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
      box-sizing: border-box;
    }
    mc-learn-header {
      flex: none;
    }
    /* The page's one scroller: the rows scroll with it, so no control sits over a scrolling region. */
    .main {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      padding: 28px var(--pad);
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .top {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 28px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 28px;
      min-width: 0;
    }
    :host([mode="wide"]) .top {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      column-gap: 24px;
      align-items: start;
    }
  `,
  LearnResponsiveStyles,
];
