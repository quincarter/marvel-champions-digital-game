import { css } from "lit";

/**
 * The caption sits level with the top row of icons, which hang in the `top-end` slot at the right edge. The wordmark is
 * Bangers on two lines, sized by the column it stands in (`cqw` of the menu column, `cqh` of its height) and a smaller
 * 44px on a phone; a black rule closes the block.
 */
export const McTitleLogoStyles = css`
  :host {
    display: block;
    font-family: var(--mc-font-body);
    color: var(--title-text, var(--mc-text-ink));
    --logo-size: clamp(28px, min(72px, calc(100cqw / 7), 10cqh), 72px);
  }
  :host([mode="phone"]) {
    --logo-size: 44px;
  }
  .top {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px 8px;
    min-height: var(--icon-button-size, 44px);
  }
  .eyebrow {
    flex: 1 0 auto;
    color: var(--mc-text-red);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.6px;
    text-transform: uppercase;
    line-height: 1.2;
  }
  ::slotted(*) {
    margin-left: auto;
  }
  .mark {
    margin: 8px 0 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: var(--logo-size);
    line-height: 0.84;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .rule {
    height: 2px;
    margin-top: 12px;
    background: currentColor;
  }
`;
