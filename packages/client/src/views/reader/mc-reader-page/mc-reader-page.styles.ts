import { css } from "lit";

/** The page: the shared reader frame over the whole screen; the bar is 60px, a phone's 52px. */
export const McReaderPageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    --reader-bar: 60px;
    --reader-side: 300px;
  }
  :host([phone]) {
    --reader-bar: 52px;
  }
  mc-empty-state {
    padding: 24px 16px;
  }
`;
