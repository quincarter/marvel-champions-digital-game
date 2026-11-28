import { css } from "lit";

export const McTrophyFamilyStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    min-width: 0;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 4px 0 2px;
  }
  /* The chevron says whether the family is open; the count says what is under it. */
  .chev {
    flex: none;
    width: 18px;
    font-size: 18px;
    line-height: 1;
    text-align: center;
  }
  mc-section-heading {
    flex: 1 1 0;
    min-width: 0;
  }
  :host([phone]) .row {
    min-height: 40px;
  }
`;
