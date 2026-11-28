import { css } from "lit";

/** Buttons 44px tall, 220px wide at most; a phone's share the row equally. */
export const McPackActionsStyles = css`
  :host {
    display: flex;
    gap: 10px;
    min-height: 44px;
  }
  mc-button {
    flex: 0 1 220px;
    height: 44px;
    min-width: 0;
  }
  :host([size="phone"]) mc-button {
    flex: 1 1 0;
  }
`;
