import { css } from "lit";

export const McScenarioInspectHintStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    white-space: nowrap;
  }
  .text {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
