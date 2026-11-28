import { css } from "lit";

/**
 * Parts are placed absolutely at the screen's own coordinates. The menu and the footer sit in a scroller that, when the
 * window is too short for them, is the box under the logo's rule; otherwise it is the whole panel and doesn't scroll.
 */
export const McTitlePanelStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .part {
    position: absolute;
  }
  .viewport {
    position: absolute;
    overflow-x: clip;
    overflow-y: hidden;
    overscroll-behavior: contain;
  }
  .viewport.scrolls {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    outline: none;
  }
  .viewport.scrolls::-webkit-scrollbar {
    width: var(--mc-scrollbar-width, 6px);
  }
  .viewport.scrolls::-webkit-scrollbar-track {
    background: color-mix(in srgb, var(--mc-fill-ink) 12%, transparent);
  }
  .viewport.scrolls::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--mc-fill-ink) 60%, transparent);
  }
  :host([ground="ink"]) .viewport.scrolls::-webkit-scrollbar-track {
    background: color-mix(in srgb, var(--mc-fill-paper) 12%, transparent);
  }
  :host([ground="ink"]) .viewport.scrolls::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--mc-fill-paper) 60%, transparent);
  }
  .sizer {
    position: relative;
    width: 100%;
  }
  .shift {
    position: absolute;
  }
  .status {
    color: var(--mc-text-ink);
    font-size: 11px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
  :host([ground="ink"]) .status {
    color: var(--mc-text-paper);
  }
  .problem {
    position: absolute;
    left: 50%;
    top: 8px;
    transform: translateX(-50%);
    padding: 6px 10px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-caution);
    font-size: 11px;
    line-height: 1.45;
    max-width: calc(100% - 16px);
    text-align: center;
    pointer-events: none;
    z-index: 10;
  }
  mc-glyph {
    position: absolute;
    pointer-events: none;
    z-index: 6;
  }
`;
