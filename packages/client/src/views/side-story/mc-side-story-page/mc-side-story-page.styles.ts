import { css } from "lit";

/** The page: the reader frame on the ink ground, its bar as tall as the header's words need. */
export const McSideStoryPageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    --reader-bar: auto;
  }
  mc-reader {
    background: var(--mc-fill-ink);
  }
`;
