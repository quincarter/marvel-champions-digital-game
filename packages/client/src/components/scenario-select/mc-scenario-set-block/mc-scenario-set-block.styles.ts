import { css } from "lit";

export const McScenarioSetBlockStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--mc-text-paper);
  }
  .heading {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .value {
    font-size: var(--mc-small-11);
    line-height: 1.45;
  }
`;
