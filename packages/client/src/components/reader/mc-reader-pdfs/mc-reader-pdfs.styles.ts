import { css } from "lit";

export const McReaderPdfsStyles = css`
  :host {
    display: flex;
    gap: 8px;
    min-width: 0;
  }
  mc-button {
    flex: 1 1 0;
    min-width: 0;
    max-width: 220px;
    height: 36px;
    --mc-button-size: 12px;
  }
`;
