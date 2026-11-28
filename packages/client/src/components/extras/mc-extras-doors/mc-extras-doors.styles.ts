import { css } from "lit";

export const McExtrasDoorsStyles = css`
  :host {
    display: flex;
    gap: 8px;
  }
  mc-button {
    flex: 1 1 0;
    min-width: 0;
    height: 44px;
    --mc-button-size: 12px;
  }
  :host(:not([stacked])) mc-button {
    flex: none;
    width: 150px;
  }
`;
