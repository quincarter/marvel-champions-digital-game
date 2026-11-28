import { css } from "lit";

/** Paper on the ink panel: a 1px frame and 40% ink for the stage not in play, a 2px frame at full strength for the one that is. */
export const McScenarioStageStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    min-height: 44px;
    border: 1px solid var(--mc-line-paper);
    color: var(--mc-text-paper);
    opacity: 0.4;
  }
  :host([current]) {
    border-width: 2px;
    opacity: 1;
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 15px;
    letter-spacing: 1px;
    line-height: 1;
    text-transform: uppercase;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .stats {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
