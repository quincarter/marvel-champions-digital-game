import { css } from "lit";

export const McDeckActionsStyles = css`
  :host {
    display: flex;
    gap: 8px;
    flex-direction: column;
  }
  :host([layout="row"]) {
    flex-direction: row;
  }
  mc-button {
    height: 52px;
  }
  .edit {
    flex: none;
  }
  :host([layout="row"]) .edit {
    width: 130px;
  }
  :host([layout="row"]) .start {
    flex: 1;
  }
`;
