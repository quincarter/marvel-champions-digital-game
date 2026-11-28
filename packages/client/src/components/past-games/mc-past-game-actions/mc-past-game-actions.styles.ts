import { css } from "lit";

export const McPastGameActionsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .watch {
    height: 52px;
    --mc-button-size: 16px;
  }
  .rest {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .rest mc-button {
    height: 44px;
    --mc-button-size: 13px;
  }
`;
