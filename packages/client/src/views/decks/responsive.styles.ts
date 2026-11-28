import { css } from "lit";

/** The responsive rules every Decks & Collection view spreads into its `static styles`: the page fills its region, text never shrinks below a legible size, motion stops for a reduced-motion setting. */
export const DecksResponsiveStyles = css`
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
