import { css } from "lit";

/**
 * The responsive rules the Title page spreads into its `static styles`: the page reads its own height (a size container)
 * for the spacing tiers of the old layout, text never shrinks below a legible size and motion follows the system setting.
 */
export const TitleResponsiveStyles = css`
  :host {
    --pad: 40px;
    --gap: 18px;
    box-sizing: border-box;
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  @container page (max-height: 819px) {
    :host,
    .page {
      --pad: 24px;
    }
  }
  @container page (max-height: 699px) {
    .page {
      --pad: 12px;
      --gap: 8px;
      --notice-height: 32px;
    }
  }
  @container page (max-height: 599px) {
    .page {
      --gap: 4px;
      --notice-height: 26px;
    }
  }
  :host([mode="phone"]) .page {
    --pad: 16px;
    --gap: 12px;
  }
  @container page (max-height: 760px) {
    :host([mode="phone"]) .page {
      --gap: 6px;
      --row-height-tall: 44px;
    }
  }
  @container page (max-height: 640px) {
    :host([mode="phone"]) .page {
      --gap: 3px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
