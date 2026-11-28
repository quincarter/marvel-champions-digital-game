import { css } from "lit";

export const McUnlocksListStyles = css`
  :host {
    display: block;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .scroller {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 14px;
  }
  .section {
    margin: 14px 0 4px;
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .wave {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 2px 12px;
    padding: 12px 0 6px;
    border-bottom: 1px solid color-mix(in srgb, var(--mc-line-paper) 25%, transparent);
  }
  .wave-title {
    font-family: var(--mc-font-display);
    font-size: 18px;
    letter-spacing: 0.04em;
  }
  .wave-status {
    font-size: var(--mc-small-10, 10px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .wave[data-open] .wave-status {
    opacity: 1;
  }
  mc-switch-row {
    display: block;
    padding-left: 12px;
  }
`;
