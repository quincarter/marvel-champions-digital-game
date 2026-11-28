import { css } from "lit";

/** The page: the shared reader frame over the whole screen. */
export const McReaderPageStyles = css`
  :host {
    display: block;
    width: 100%;
    height: 100%;
    --reader-side: 300px;
  }
  mc-empty-state {
    padding: 24px 16px;
  }
`;
