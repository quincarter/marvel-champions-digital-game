import { css } from "lit";

/**
 * Your stats' responsive rules, in one place: the outer gutter (24px, 16px on a phone). Everything finer is each element's
 * own container query on the width it is given: the Overview's columns, the shelves' pips, a strip's card width.
 */
export const StatsResponsiveStyles = css`
  :host {
    --gutter: 24px;
  }
  :host([mode="phone"]) {
    --gutter: 16px;
  }
`;
