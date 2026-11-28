import { css } from "lit";

export const McReaderNavStyles = css`
  :host {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    flex: none;
    height: 56px;
    padding: 8px 28px;
    background: var(--mc-fill-ink);
  }
  :host(:not([wide])) {
    padding: 8px 16px;
  }
  mc-button {
    width: min(180px, calc(50% - 6px));
    height: 100%;
    --mc-button-size: 12px;
  }
`;
