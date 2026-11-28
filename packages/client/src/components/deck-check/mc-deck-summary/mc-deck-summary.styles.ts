import { css } from "lit";

export const McDeckSummaryStyles = css`
  :host {
    display: block;
  }
  .tiles {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }
  .rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
`;
