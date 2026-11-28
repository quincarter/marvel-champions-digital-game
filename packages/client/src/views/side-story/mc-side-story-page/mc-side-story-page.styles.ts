import { css } from "lit";

/** The page: the reader frame on the ink ground, its bar as tall as the header's words need. */
export const McSideStoryPageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }
  mc-reader {
    background: var(--mc-fill-ink);
  }
  .close {
    width: 96px;
    height: 30px;
    --mc-button-size: 11px;
  }
  :host([compact]) .close {
    width: 78px;
  }
`;
