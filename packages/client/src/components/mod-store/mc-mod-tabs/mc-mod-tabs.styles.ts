import { css } from "lit";

export const McModTabsStyles = css`
  :host {
    display: flex;
    gap: 8px;
    container-type: inline-size;
  }
  mc-tab-rail {
    flex: 1;
    min-width: 0;
    --mc-tab-height: 44px;
  }
  mc-search-toggle {
    flex: none;
  }
  /* Six tabs on a narrow row would cut their words short: there they take two rows of three. */
  @container (max-width: 540px) {
    mc-tab-rail {
      --mc-tab-basis: 33.33%;
    }
  }
`;
