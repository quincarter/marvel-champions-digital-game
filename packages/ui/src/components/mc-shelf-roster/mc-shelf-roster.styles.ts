import { css } from "lit";

/** The pack-shelf roster: a column of shelves on the paper ground, each a header over a row that scrolls sideways. */
export const McShelfRosterStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .scroller {
    position: absolute;
    inset: 0;
  }
  .shelf {
    /* A shelf below the fold is not laid out or painted until it nears the view. */
    content-visibility: auto;
    contain-intrinsic-size: auto var(--shelf-height, 300px);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-right: 4px;
  }
  .head .bar {
    flex: 1;
    min-width: 0;
    position: relative;
    height: 100%;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .head mc-section-header {
    pointer-events: none;
    display: block;
    height: 100%;
  }
  .link {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-width: 44px;
    padding: 0 6px;
    font-weight: 800;
    font-size: var(--mc-small-10);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-red);
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .rowbox {
    position: relative;
  }
  .row {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 0 var(--mc-chevron, 36px);
    scroll-padding: 0 var(--mc-chevron, 36px);
  }
  .row::-webkit-scrollbar {
    display: none;
  }
  .cell {
    position: relative;
    flex: 0 0 auto;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .cell mc-picture-card {
    width: 100%;
    height: 100%;
  }
  .cell[data-dim] mc-picture-card {
    opacity: 0.5;
  }
  .chev {
    position: absolute;
    top: 50%;
    width: var(--mc-chevron, 36px);
    height: 56px;
    margin-top: -28px;
    display: none;
    align-items: center;
    justify-content: center;
    font: 800 16px var(--mc-font-body);
    color: var(--mc-text-paper);
    background: var(--mc-fill-ink);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .chev.prev {
    left: 0;
  }
  .chev.next {
    right: 0;
  }
  .shelf[data-prev] .chev.prev,
  .shelf[data-next] .chev.next {
    display: flex;
  }
  .hint {
    position: absolute;
    top: calc(50% - 28px - 6px - var(--hint-height, 18px));
    width: var(--mc-chevron, 36px);
    display: none;
    justify-content: center;
    pointer-events: none;
  }
  .hint.prev {
    left: 0;
  }
  .hint.next {
    right: 0;
  }
  .shelf[data-prev] .hint.prev,
  .shelf[data-next] .hint.next {
    display: flex;
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .empty mc-button {
    width: 160px;
    height: 44px;
  }
`;
