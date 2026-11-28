import { css } from "lit";

export const McRulesCardListStyles = css`
  :host {
    display: block;
    min-height: 0;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
  }
  .scroller {
    height: 100%;
    padding: 8px 8px 8px 4px;
  }
  .label {
    margin: 4px 4px 6px;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.65;
  }
  mc-empty-state {
    padding: 12px;
  }
`;
