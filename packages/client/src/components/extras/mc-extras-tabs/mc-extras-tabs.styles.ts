import { css } from "lit";

export const McExtrasTabsStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  mc-tab-rail {
    display: flex;
    height: 44px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .hint {
    display: flex;
    justify-content: flex-end;
    padding-top: 4px;
    min-height: 22px;
  }
`;
