import { css } from "lit";

export const McGlyphHintStyles = css`
  :host {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 3;
    pointer-events: none;
  }
  :host([place="left"]) {
    left: auto;
    right: calc(100% + 6px);
  }
`;
