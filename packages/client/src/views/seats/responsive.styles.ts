import { css } from "lit";

/** The responsive rules every Take your seats view spreads into its `static styles`: the page fills its region, text never shrinks below a legible size. */
export const SeatsResponsiveStyles = css`
  :host {
    box-sizing: border-box;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
