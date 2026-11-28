import { css } from "lit";

export const McScenarioShelvesStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }
  mc-scenario-random-row {
    flex: none;
  }
  mc-shelf-roster {
    flex: 1 1 0;
    min-height: 0;
    height: auto;
  }
`;
