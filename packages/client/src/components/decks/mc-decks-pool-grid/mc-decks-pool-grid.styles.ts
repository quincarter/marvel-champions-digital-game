import { css } from "lit";

export const McDecksPoolGridStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .space {
    position: relative;
    overflow: hidden;
  }
  .window {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    gap: 12px;
  }
`;
