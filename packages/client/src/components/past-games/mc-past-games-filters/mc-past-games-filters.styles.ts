import { css } from "lit";

export const McPastGamesFiltersStyles = css`
  :host {
    display: block;
  }
  mc-tab-rail {
    height: 44px;
  }
  /* LB / RB, pad only, under the strip's right end. */
  .hint {
    display: flex;
    justify-content: flex-end;
    height: 16px;
    margin-top: 4px;
  }
  .hint mc-glyph-hint {
    position: relative;
  }
`;
