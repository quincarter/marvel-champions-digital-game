import { css } from "lit";

export const McLobbyEpicStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    color: var(--mc-text-ink);
  }
  .scroller {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 2px 4px 6px 2px;
  }
  .hint {
    margin: 0;
    font-size: 13px;
    opacity: 0.85;
  }
  .organizer {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .note {
    margin: 0 4px;
    font-size: 12px;
    opacity: 0.75;
  }
  .limit {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
  }
  .tables {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
`;
