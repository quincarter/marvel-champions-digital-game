import { css } from "lit";

export const McLobbyCompetitiveStyles = css`
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
  .detail {
    margin: 0;
    font-size: 13px;
    opacity: 0.85;
  }
  /* The start result: boxed and headed, never colour alone. */
  .result {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border: 3px solid var(--mc-line-ink);
    background: var(--mc-fill-parchment);
  }
  .result h3 {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 17px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .result p {
    margin: 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .teams {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .people {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .person {
    margin: 0 4px;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
`;
