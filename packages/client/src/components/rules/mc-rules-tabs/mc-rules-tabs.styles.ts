import { css } from "lit";

export const McRulesTabsStyles = css`
  :host {
    display: block;
  }
  mc-tab-rail {
    display: flex;
    height: 44px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
`;
