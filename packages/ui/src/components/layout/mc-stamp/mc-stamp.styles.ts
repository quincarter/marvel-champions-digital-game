import { css } from "lit";

export const McStampStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    height: var(--stamp-height, 20px);
    padding: 0 var(--stamp-pad, 8px);
    box-sizing: border-box;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--stamp-size, var(--mc-small-9, 9px));
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 1px solid var(--mc-line-ink);
  }
  :host([tone="heal"]) {
    background: var(--mc-fill-heal);
    color: var(--mc-text-ink-on-hue);
    border-color: transparent;
  }
  :host([tone="red"]) {
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    border-color: transparent;
  }
  :host([tone="caution"]) {
    background: var(--mc-fill-caution);
    color: var(--mc-text-ink-on-hue);
    border-color: transparent;
  }
  :host([tone="ink"]) {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    border-color: transparent;
  }
`;
