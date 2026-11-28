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
  .ctl {
    position: relative;
    min-width: 0;
    height: 100%;
    flex: 1;
  }
  .ctl mc-button {
    height: 100%;
    --mc-button-size: 12px;
  }
  :host([slider]) .pause .ctl {
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
