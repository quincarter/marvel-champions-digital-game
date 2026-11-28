import { css } from "lit";

export const McRulesVillainPhaseStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 0;
  }
  .scroller {
    flex: 1 1 0;
    min-height: 0;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
    padding: 2px 8px 6px 0;
  }
  .citation {
    flex: none;
    height: 24px;
    display: flex;
    align-items: center;
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
