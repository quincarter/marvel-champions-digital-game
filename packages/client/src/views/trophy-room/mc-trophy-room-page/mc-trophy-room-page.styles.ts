import { css } from "lit";
import { TrophyRoomResponsiveStyles } from "../responsive.styles.js";

/**
 * The ink bar across the top over a paper body with a faint halftone. The body is one column: the rank header, the filters
 * bar, then the list taking every pixel that is left and scrolling natively. The achievement's sheet covers the whole page.
 */
export const McTrophyRoomPageStyles = [
  TrophyRoomResponsiveStyles,
  css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--mc-fill-paper);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-ink) 14%, transparent) 1px,
        transparent 1.5px
      );
      background-size: 18px 18px;
      color: var(--mc-text-ink);
      --gutter: 24px;
    }
    :host([phone]) {
      --gutter: 16px;
    }
    .bar {
      flex: none;
    }
    .stats {
      width: 150px;
      height: 44px;
      --mc-button-size: 14px;
    }
    :host([phone]) .stats {
      width: 92px;
    }
    .body {
      flex: 1 1 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
      padding: 12px var(--gutter) var(--gutter);
    }
    .body > * {
      flex: none;
    }
    .body > .list {
      flex: 1 1 0;
      min-height: 60px;
    }
  `,
];
