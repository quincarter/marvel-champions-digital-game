import { css } from "lit";

/** The phone's caption is smaller and shorter; the wide one has room for a bigger lead-in and words. */
export const McModBetaCaptionStyles = css`
  :host {
    display: block;
    padding: 0 4px 4px 0;
  }
  .box {
    display: flex;
    align-items: stretch;
    gap: 20px;
    padding: 12px;
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
    /* The hard offset shadow of a comic caption. */
    box-shadow: 4px 4px 0 var(--mc-fill-ink);
  }
  .heading {
    flex: none;
    align-self: center;
    font-family: var(--mc-font-display);
    font-size: 20px;
    letter-spacing: 1px;
    line-height: 0.9;
    text-transform: uppercase;
  }
  .rule {
    flex: none;
    width: 2px;
    background: var(--mc-fill-ink);
  }
  .body {
    flex: 1;
    min-width: 0;
    font-size: var(--mc-small-12, 14px);
    line-height: 1.25;
  }
  :host([size="phone"]) .box {
    padding: 8px;
    gap: 12px;
  }
  :host([size="phone"]) .heading {
    font-size: 16px;
  }
  :host([size="phone"]) .body {
    font-size: 12px;
  }
`;
