import { css } from "lit";

export const McPackCardStyles = css`
  :host {
    display: block;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .picture {
    position: relative;
    aspect-ratio: 5 / 7;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .quantity {
    position: absolute;
    top: 0;
    right: 0;
    padding: 2px 5px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 1.2px;
    line-height: 1.2;
  }
  .name,
  .type {
    margin-top: 3px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .name {
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    line-height: 1.2;
  }
  .type {
    margin-top: 0;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
`;
