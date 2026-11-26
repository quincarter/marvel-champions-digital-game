import { css } from "lit";

/** Every part is placed absolutely at its rect; text keeps Phaser's single-line default unless it wraps. */
export const McSheetStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  .part {
    position: absolute;
    box-sizing: border-box;
  }
  .text {
    line-height: 1.2;
    pointer-events: none;
  }
  /* A search match: a band behind the letters and a heavier line under them, never color alone. */
  .text mark {
    background: color-mix(in srgb, var(--mc-fill-caution) 35%, transparent);
    color: inherit;
    box-shadow: 0 2px 0 var(--mc-fill-caution);
  }
  .tap {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  /* A scrolling region keeps its parts inside its rect and scrolls the rest, vertically only. */
  .scroller {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .content {
    position: relative;
  }
`;
