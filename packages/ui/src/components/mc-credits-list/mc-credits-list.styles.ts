import { css } from "lit";

/**
 * The Phaser list's sizes and spacing: notice 13px, title 15px, body 12px and small 11px (the two small ones grow on
 * desktop, `--mc-small-*`), lines about 1.38 apart, boxes 6px apart.
 */
export const McCreditsListStyles = css`
  :host {
    display: block;
    height: 100%;
  }
  .scroller {
    height: 100%;
  }
  .rows {
    margin-right: 8px;
  }
  .notice {
    margin: 3px 0;
    padding: 8px 12px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-size: 13px;
    line-height: 1.38;
    white-space: pre-line;
  }
  .section {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    height: 46px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--mc-line-ink);
    margin-bottom: 4px;
  }
  .section h2 {
    margin: 0;
    font-size: 24px;
    line-height: 1;
    letter-spacing: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([phone]) .section h2 {
    font-size: 20px;
  }
  .section .count {
    font-size: 13px;
    font-weight: 800;
    opacity: 0.75;
  }
  .entry {
    margin: 3px 0;
    padding: 5px 10px 7px;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
    overflow-wrap: anywhere;
  }
  .entry p {
    margin: 0;
    line-height: 1.38;
  }
  .entry .title {
    font-size: 15px;
    font-weight: 800;
  }
  .entry .body {
    font-size: var(--mc-small-12, 12px);
    opacity: 0.95;
  }
  .entry .small {
    font-size: var(--mc-small-11, 11px);
    opacity: 0.75;
  }
`;
