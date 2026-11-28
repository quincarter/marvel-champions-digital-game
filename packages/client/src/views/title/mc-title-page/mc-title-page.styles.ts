import { css } from "lit";
import { TitleResponsiveStyles } from "./responsive.styles.js";

export const TitlePageStyles = [
  css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      container: page / size;
      font-family: var(--mc-font-body);
      color: var(--mc-text-ink);
      -webkit-font-smoothing: antialiased;
    }
    /* The page: the notice strip, then the body. Under it, Phaser draws the ink ground and the picture; the art column
       and the phone page are transparent so they show through. */
    .page {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: 100%;
      height: 100%;
      --title-text: var(--mc-text-ink);
      --notice-height: 40px;
    }
    .body {
      display: grid;
      grid-template-columns: minmax(0, 45%) 4px minmax(0, 1fr);
      min-height: 0;
    }
    :host([placement="side"]) .body {
      grid-template-columns: minmax(0, 1fr) 4px calc(848px + 2 * var(--pad));
    }
    :host([mode="phone"]) .body {
      display: block;
    }
    .art {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--pad);
      padding: var(--pad);
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      --title-text: var(--mc-text-paper);
    }
    .art > .banner {
      width: min(100%, 520px);
    }
    .art > .games {
      width: min(100%, 520px);
      flex: 0 1 auto;
      min-height: 0;
    }
    .art > .spacer {
      flex: 1 1 0;
      min-height: 0;
    }
    .art > .promo {
      width: min(100%, 440px);
      flex: none;
    }
    .art > .rank {
      width: min(100%, 300px);
      flex: none;
    }
    .divider {
      background: var(--mc-fill-red);
    }
    .menu {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      min-width: 0;
      min-height: 0;
      padding: var(--pad) var(--pad) 0;
      background-color: var(--mc-fill-paper);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-fill-ink) 10%, transparent) 1px,
        transparent 1.2px
      );
      background-size: 6px 6px;
      container: menu / size;
    }
    :host([mode="phone"]) .menu {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: none;
      --title-text: var(--mc-text-paper);
      color: var(--mc-text-paper);
    }
    .banner {
      margin-bottom: var(--gap);
    }
    :host([mode="phone"]) .page {
      --title-text: var(--mc-text-paper);
    }
    .head {
      width: min(100%, 520px);
      margin: 0 auto;
    }
    :host([placement="side"]) .head {
      width: min(100%, 848px);
    }
    /* The one scroller: a window too short for every row scrolls everything under the logo rule, the footer included. */
    .scroll {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
      overflow-x: clip;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      padding-top: var(--gap);
      padding-bottom: var(--pad);
    }
    :host([mode="phone"]) .scroll {
      flex: 1;
    }
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 520px);
      grid-template-rows: auto auto 1fr;
      justify-content: center;
      column-gap: 28px;
      row-gap: var(--gap);
      flex: 1 0 auto;
      width: 100%;
    }
    :host([placement="side"]) .cols {
      grid-template-columns: minmax(0, 520px) 300px;
    }
    .cols > mc-title-menu {
      --menu-gap: var(--gap);
      --row-height-tall: 52px;
    }
    :host([mode="phone"]) .cols > mc-title-menu {
      --row-height-tall: inherit;
    }
    .cols > .promo {
      grid-column: 2;
      grid-row: 1 / 3;
      align-self: start;
      max-height: 440px;
      height: 100%;
    }
    .cols > .rank {
      align-self: end;
    }
    .cols > .foot {
      align-self: end;
      grid-column: 1;
    }
    .cols > .status {
      grid-column: 1;
    }
    .problem {
      position: absolute;
      left: 50%;
      top: 8px;
      transform: translateX(-50%);
      max-width: calc(100% - 16px);
      pointer-events: none;
      z-index: 10;
    }
  `,
  TitleResponsiveStyles,
];
