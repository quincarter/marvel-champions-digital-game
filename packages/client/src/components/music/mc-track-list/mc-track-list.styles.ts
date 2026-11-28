import { css } from "lit";

export const McTrackListStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 auto;
    min-height: 0;
    padding-right: 10px;
  }
  mc-track-row {
    flex: none;
  }
  .empty {
    margin: 8px 0 0;
    font-size: 13px;
    opacity: 0.7;
  }
`;
