import { css } from "lit";

export const McScenarioActionsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .customize {
    flex: none;
    height: 44px;
  }
  .next {
    flex: none;
    height: 52px;
    --mc-button-size: 22px;
  }
  .caption {
    margin: 0;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    line-height: 1.3;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .caption.lock {
    opacity: 1;
  }
  :host([ground="ink"]) .caption {
    color: var(--mc-text-paper);
  }
`;
