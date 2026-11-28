import { css } from "lit";
import { PauseResponsiveStyles } from "../responsive.styles.js";

/**
 * The sheet is centred in the page (the scrim is the scene's). Wide: the ink panel and the pane side by side, in the
 * design's 1055 by 710 at most. Phone: one ink sheet that fills the screen. On a short screen (a phone held sideways,
 * about 860 by 360) the margins and paddings tighten, the ink column scrolls, and the pane scrolls as a whole so its
 * sections keep their own readable heights.
 */
export const McPausePageStyles = [
  PauseResponsiveStyles,
  css`
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
      color: var(--mc-text-paper);
      --margin: 24px;
    }
    .stage {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: var(--margin);
    }
    .sheet {
      min-height: 0;
      min-width: 0;
    }
    .search {
      flex: none;
      height: 44px;
    }
    .body {
      min-height: 0;
    }

    /* Wide. */
    :host([mode="wide"]) .sheet {
      display: grid;
      grid-template-columns: minmax(260px, 305px) minmax(0, 1fr);
      gap: 16px;
      width: min(1055px, 100%);
      height: min(710px, 100%);
    }
    .left {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      padding: 24px;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
      background-color: var(--mc-fill-ink);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-paper) 8%, transparent) 1px,
        transparent 1.5px
      );
      background-size: 8px 8px;
      border: 4px solid var(--mc-line-paper);
      box-shadow: 8px 8px 0 color-mix(in srgb, var(--mc-fill-ink) 50%, transparent);
    }
    .left mc-pause-header {
      flex: none;
    }
    .left mc-pause-menu {
      flex: 1 0 auto;
    }
    .right {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 0;
      padding: 24px;
      overflow: hidden;
      background-color: var(--mc-fill-paper);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-ink) 10%, transparent) 1px,
        transparent 1.5px
      );
      background-size: 6px 6px;
      color: var(--mc-text-ink);
      border: 4px solid var(--mc-line-ink);
      box-shadow: 8px 8px 0 color-mix(in srgb, var(--mc-fill-ink) 50%, transparent);
    }
    /* Searching: the pane turns ink, the ground the results are drawn for. */
    .right.ink {
      background-color: var(--mc-fill-ink);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-paper) 8%, transparent) 1px,
        transparent 1.5px
      );
      color: var(--mc-text-paper);
      border-color: var(--mc-line-paper);
    }
    :host([mode="wide"]) .body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    :host([mode="wide"]) .body.scroller {
      display: block;
    }
    .rules {
      flex: 0 1 auto;
      max-height: 60%;
    }
    .log {
      flex: 1 1 0;
      min-height: 120px;
    }

    /* Phone: one ink sheet. */
    :host([mode="phone"]) {
      --margin: 8px;
    }
    :host([mode="phone"]) .sheet {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(100%, 640px);
      height: 100%;
      padding: 12px 14px;
      background-color: var(--mc-fill-ink);
      background-image: radial-gradient(
        circle,
        color-mix(in srgb, var(--mc-line-paper) 8%, transparent) 1px,
        transparent 1.5px
      );
      background-size: 8px 8px;
      border: 4px solid var(--mc-line-paper);
    }
    :host([mode="phone"]) .body {
      flex: 1;
    }
    :host([mode="phone"]) .log {
      height: 260px;
      color: var(--mc-text-ink);
    }
    :host([mode="phone"]) .sheet > mc-pause-header,
    :host([mode="phone"]) .sheet > mc-pause-menu {
      flex: none;
    }

    /* A short screen (a phone held sideways): tighter, the ink column scrolls, the pane scrolls as a whole. */
    @media (max-height: 520px) {
      :host {
        --margin: 8px;
      }
      :host([mode="wide"]) .sheet {
        gap: 10px;
      }
      .left {
        gap: 8px;
        padding: 10px 12px;
        border-width: 3px;
      }
      .right {
        gap: 8px;
        padding: 12px;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        border-width: 3px;
      }
      :host([mode="wide"]) .body,
      :host([mode="wide"]) .body.scroller {
        flex: none;
        overflow: visible;
      }
      .rules {
        flex: none;
        max-height: none;
      }
      .log {
        flex: none;
      }
      :host([mode="phone"]) .sheet {
        gap: 6px;
        padding: 8px 10px;
        border-width: 3px;
      }
    }
  `,
];
