import { css } from "lit";

export const McCivilFootStyles = css`
  :host {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: flex-end;
  }
  mc-hint-button {
    height: 48px;
    min-width: 140px;
    --mc-button-size: 14px;
  }
  mc-hint-button[kind="primary"] {
    flex: 1 1 220px;
    max-width: 320px;
  }
`;
