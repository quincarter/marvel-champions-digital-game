import { css } from "lit";
import { LearnResponsiveStyles } from "../../learn-responsive.styles.js";

export const HowToWinPageStyles = [
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
    .bar {
      flex: none;
      --mc-top-bar-height: 56px;
      --mc-top-bar-pad: 16px;
      --mc-top-bar-title-size: 18px;
    }
    :host([mode="wide"]) .bar {
      --mc-top-bar-pad: 24px;
    }
    /* The page's one scroller. A tip is placed over the page, so nothing between it and the page clips it. */
    .main {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      padding: 14px var(--pad) 0;
    }
    /* The actions stay in reach however far the cards scroll. */
    .foot {
      flex: none;
      width: 100%;
      max-width: calc(1200px + 2 * var(--pad));
      margin: 0 auto;
      padding: 14px var(--pad) var(--pad);
    }
    .column {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      min-height: 100%;
      padding-bottom: 0;
      max-width: 1200px;
      margin: 0 auto;
    }
    .column > * {
      flex: none;
    }
    :host([mode="wide"]) mc-win-cards {
      flex: 1 1 auto;
      min-height: 360px;
    }
  `,
  LearnResponsiveStyles,
];
