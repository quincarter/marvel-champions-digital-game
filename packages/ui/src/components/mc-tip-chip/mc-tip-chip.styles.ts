import { css } from "lit";

/** The chip and its "i" side by side at one height (`--mc-chip-height`, a 44px touch target by default). */
export const McTipChipStyles = css`
  :host {
    display: inline-flex;
    flex: 0 0 auto;
    max-width: 100%;
    height: var(--mc-chip-height, 44px);
  }
  .main {
    display: block;
    flex: 1 1 auto;
    min-width: 0;
  }
  .info {
    display: block;
    flex: 0 0 var(--mc-chip-info-width, 44px);
    width: var(--mc-chip-info-width, 44px);
  }
`;
