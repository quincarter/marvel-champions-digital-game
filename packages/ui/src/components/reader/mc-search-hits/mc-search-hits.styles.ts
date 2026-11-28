import { css } from "lit";

export const McSearchHitsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    padding: 12px 8px 0 12px;
  }
  mc-search-field {
    flex: none;
    height: 36px;
  }
  mc-toc {
    flex: 1 1 0;
    min-height: 0;
    margin: 0 -4px 0 -8px;
  }
`;
