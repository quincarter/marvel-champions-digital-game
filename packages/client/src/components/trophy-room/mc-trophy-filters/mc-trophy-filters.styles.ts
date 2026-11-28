import { css } from "lit";

export const McTrophyFiltersStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar,
  .chips {
    display: flex;
    gap: 6px;
  }
  .bar mc-hint-button {
    height: 44px;
    --mc-button-size: 12px;
  }
  .toggle {
    flex: 1 1 0;
    min-width: 0;
  }
  .expand {
    flex: 0 0 min(160px, 40%);
  }
  .chips mc-chip {
    flex: 1 1 0;
    min-width: 0;
    --chip-height: 44px;
    --chip-size: 14px;
  }
`;
