import { css } from "lit";

export const McSideStoryActionsStyles = css`
  :host {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    height: 88px;
    padding: 0 16px;
    background: var(--mc-fill-ink);
  }
  :host([compact]) {
    height: 68px;
    padding: 0 12px;
  }
  .back {
    flex: none;
    width: 110px;
    height: 62px;
    --mc-button-size: 13px;
  }
  :host([compact]) .back {
    width: 64px;
    height: 52px;
  }
  .next {
    flex: 1 1 0;
    max-width: 425px;
    height: 62px;
    --mc-button-size: 22px;
  }
  :host([compact]) .next {
    max-width: none;
    height: 52px;
  }
`;
