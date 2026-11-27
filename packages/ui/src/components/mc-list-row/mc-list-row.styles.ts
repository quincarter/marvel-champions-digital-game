import { css } from "lit";

/** A parchment row with a 2px ink outline and a round badge at the left; a picture row is 76px of absolute parts. */
export const McListRowStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px 0 8px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    color: var(--mc-text-ink);
    pointer-events: none;
  }
  :host(.closed) {
    outline-color: color-mix(in srgb, var(--mc-line-ink) 35%, transparent);
  }
  :host(.active) {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .badge {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100% - 16px);
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: 14px;
  }
  .badge.closed {
    background: color-mix(in srgb, var(--mc-fill-ink) 25%, transparent);
  }
  .title-words {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-self: stretch;
    padding: 5px 0 4px;
  }
  .title {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host(.closed) .title {
    opacity: 0.45;
  }
  .detail {
    font-size: var(--mc-small-10);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.75;
  }
  .detail.alert {
    color: var(--mc-text-red);
    opacity: 1;
  }

  :host([rich]) {
    display: block;
    position: relative;
    height: 76px;
    padding: 0;
    background: var(--mc-fill-paper);
    outline: none;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
  :host([rich]) .border {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 var(--mc-row-border, 2px) var(--mc-line-ink);
    pointer-events: none;
  }
  :host([rich]) mc-picture-tile {
    position: absolute;
    left: 10px;
    top: 10px;
    width: 56px;
    height: 56px;
  }
  :host([rich]) .words {
    position: absolute;
    left: 76px;
    right: 110px;
    top: 8px;
  }
  :host([rich]) .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([rich]) .tap {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 108px;
    cursor: pointer;
  }
  :host([rich]) .trailing {
    position: absolute;
    right: 10px;
    top: 16px;
    width: 92px;
    height: 44px;
  }
  ::slotted(*) {
    display: block;
    width: 100%;
    height: 100%;
  }
`;
