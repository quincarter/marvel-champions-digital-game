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
  .tap {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .content {
    position: relative;
  }
`;
