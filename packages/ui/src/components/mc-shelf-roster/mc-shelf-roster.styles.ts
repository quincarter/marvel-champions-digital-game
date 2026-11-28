import { css } from "lit";
import { SCROLL_GUTTER } from "../mc-sheet/McSheet.js";

/** A shelf header's height: one touch target. */
export const HEAD = 44;

export const McShelfRosterStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .scroller {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
  }
  /* A fluid roster (card width 0): the box sizes everything, in CSS. The tile is up to 300px wide and as tall as the box
     leaves after a shelf header, its gaps and the next shelf's lip, between 220px and 440px. */
  :host([fluid]) {
    container-type: size;
  }
  :host([fluid]) .scroller {
    right: 0;
  }
  :host([fluid]) .content {
    width: calc(100% - ${SCROLL_GUTTER}px);
  }
  :host([fluid]) mc-picture-card {
    width: min(300px, calc(100cqw - 40px));
    height: clamp(220px, calc(100cqh - ${HEAD + 34}px), 440px);
  }
  .shelf {
    padding-bottom: 20px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: ${HEAD}px;
  }
  .title {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .title mc-picture-tile {
    flex: none;
    width: 34px;
    height: 34px;
  }
  .title mc-section-header {
    flex: 1;
    min-width: 0;
    height: 100%;
  }
  .tap {
    position: absolute;
    inset: 0;
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .all {
    appearance: none;
    background: none;
    border: 0;
    margin: 0;
    font-family: var(--mc-font-body);
    flex: none;
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 6px;
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-red);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .head[data-clipped] .chevrons,
  .head[data-clipped] .all {
    visibility: hidden;
  }
  .chevrons {
    display: none;
    flex: none;
    gap: 4px;
  }
  /* Real buttons: a keyboard reaches them and Enter or Space presses them. */
  .chevrons button {
    appearance: none;
    width: 44px;
    height: 44px;
    padding: 0;
    margin: 0;
    font: 800 24px var(--mc-font-body);
    line-height: 1;
    color: var(--mc-text-ink);
    background: var(--mc-fill-paper);
    border: 2.5px solid var(--mc-line-ink);
    border-radius: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  @media (hover: hover) {
    .chevrons button:hover {
      color: var(--mc-text-paper);
      background: var(--mc-fill-ink);
    }
  }
  .tap:focus-visible,
  .all:focus-visible,
  .chevrons button:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
  @media (pointer: fine) {
    .chevrons {
      display: flex;
    }
  }
  .chevrons.hinted {
    display: flex;
  }
  .chevrons .hint {
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  mc-picture-card[data-dim] {
    opacity: 0.5;
  }
  .row {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    padding: 4px 4px 4px 0;
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .row mc-picture-card,
  .grid mc-picture-card {
    flex: none;
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    padding: 4px 0 20px;
  }
`;
