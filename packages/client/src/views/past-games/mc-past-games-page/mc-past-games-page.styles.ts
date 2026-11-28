import { css } from "lit";
import { PastGamesResponsiveStyles } from "../responsive.styles.js";

/**
 * The ink bar across the top over a paper body with a faint halftone. The body holds one column at most 1220px wide: the
 * tabs, the export and search row, then the list (and, wide, the details panel beside it). A phone's details are a popup
 * the page stands over everything.
 */
export const McPastGamesPageStyles = [
  PastGamesResponsiveStyles,
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
      height: 60px;
    }
    :host([phone]) .bar {
      height: 52px;
    }
    .body {
      flex: 1 1 0;
      min-height: 0;
      padding: 12px var(--gutter) var(--gutter);
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      max-width: 1220px;
      height: 100%;
      margin: 0 auto;
    }
    .content > * {
      flex: none;
    }
    .main {
      display: flex;
      justify-content: center;
      gap: 16px;
      flex: 1 1 0;
      min-height: 0;
      margin-top: 4px;
    }
    .list {
      flex: 1 1 0;
      min-width: 0;
    }
    :host([side]) .list {
      flex: 0 1 760px;
    }
    .details {
      flex: 0 0 clamp(320px, 42%, 440px);
      min-width: 0;
    }
  `,
];
