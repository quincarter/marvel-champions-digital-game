import { css } from "lit";

export const McDecksSheetHeaderStyles = css`
  :host {
    display: block;
    min-width: 0;
    color: var(--mc-text-ink);
  }
  .title {
    margin: 0;
    font-family: var(--mc-font-display);
    font-size: 26px;
    font-weight: 400;
    line-height: 1.1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    margin: 4px 0 0;
    font-family: var(--mc-font-body);
    font-size: 13px;
    line-height: 1.3;
    opacity: 0.75;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;
