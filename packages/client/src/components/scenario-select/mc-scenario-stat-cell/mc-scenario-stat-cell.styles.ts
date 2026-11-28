import { css } from "lit";

export const McScenarioStatCellStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    padding: 8px 12px;
  }
  .label {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    line-height: 1.2;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .value {
    flex: 1 1 0;
    min-height: 0;
    overflow: hidden;
    font-family: var(--mc-font-display);
    font-size: 16px;
    letter-spacing: 1px;
    line-height: 1.1;
    text-transform: uppercase;
  }
`;
