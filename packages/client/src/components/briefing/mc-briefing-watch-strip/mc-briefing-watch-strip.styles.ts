import { css } from "lit";

export const McBriefingWatchStripStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    background: var(--mc-fill-paper);
    padding: 0 8px;
  }
  .reason {
    margin: 0;
    padding: 6px 8px;
    font-weight: 800;
    font-size: 15px;
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
    color: var(--mc-text-red);
  }
`;
