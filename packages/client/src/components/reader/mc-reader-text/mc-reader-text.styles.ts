import { css } from "lit";

export const McReaderTextStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .tools {
    flex: none;
    display: flex;
    justify-content: flex-end;
    padding: 10px 28px 8px;
  }
  :host(:not([wide])) .tools {
    justify-content: flex-start;
    padding: 8px 16px;
  }
  .contents {
    width: 150px;
    height: 36px;
    --mc-button-size: 12px;
  }
  mc-reader-pdfs {
    width: min(100%, 440px);
  }
  mc-article {
    flex: 1 1 0;
    min-height: 0;
  }
`;
