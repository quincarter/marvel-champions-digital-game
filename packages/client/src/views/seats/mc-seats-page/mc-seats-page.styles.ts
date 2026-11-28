import { css } from "lit";
import { SeatsResponsiveStyles } from "../responsive.styles.js";

/**
 * Wide: the header across the top, the main column and the ink side column (the detail panel, the two ways on at its foot)
 * under it. Narrow: one column, the roster taking every pixel the seats, the filters and the sticky ink footer leave.
 * The detail and footer sit in the side column's grid cells so the ink panel runs full height, with the footer last.
 */
export const McSeatsPageStyles = [
  SeatsResponsiveStyles,
  css`
    :host {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: "header" "main" "footer";
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
    }
    .header {
      grid-area: header;
    }
    .main {
      grid-area: main;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      min-height: 0;
      padding: 16px 16px 0;
    }
    .table,
    .notice,
    .filters {
      flex: none;
    }
    .roster {
      flex: 1;
      min-height: 0;
    }
    .detail {
      display: none;
    }
    .footer {
      grid-area: footer;
      box-sizing: border-box;
      padding: 12px 16px;
      background: var(--mc-fill-ink);
    }
    .decks {
      position: absolute;
      inset: 0;
      z-index: 5;
    }
    :host([wide]) {
      grid-template-columns: minmax(0, 1fr) 300px;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: "header header" "main detail" "main footer";
    }
    :host([wide]) .main {
      padding: 24px 24px 0;
      gap: 8px;
    }
    :host([wide]) .detail {
      grid-area: detail;
      display: block;
      margin: 24px 24px 0 0;
    }
    :host([wide]) .footer {
      margin: 0 24px 24px 0;
      padding: 16px;
    }
  `,
];
