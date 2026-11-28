import { css } from "lit";

export const McChatComposeStyles = css`
  :host {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .field {
    flex: 1;
    min-width: 0;
    height: var(--mc-primary-height, 52px);
  }
  .send {
    flex: none;
    width: 96px;
    height: var(--mc-primary-height, 52px);
  }
  @media (max-width: 600px) {
    .send {
      width: 84px;
    }
  }
`;
