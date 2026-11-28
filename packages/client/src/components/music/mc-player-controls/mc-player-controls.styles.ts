import { css } from "lit";

export const McPlayerControlsStyles = css`
  :host {
    display: block;
  }
  .row {
    display: flex;
    gap: 8px;
    height: 40px;
  }
  .row + .row {
    margin-top: 8px;
  }
  mc-popup-button {
    flex: 1;
  }
  :host([slider]) .pause mc-popup-button {
    flex: 0 0 104px;
  }
  slot {
    display: none;
  }
  :host([slider]) slot {
    display: block;
    flex: 1;
    min-width: 0;
  }
`;
