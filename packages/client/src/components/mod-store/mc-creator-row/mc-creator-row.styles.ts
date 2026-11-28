import { css } from "lit";

export const McCreatorRowStyles = css`
  :host {
    display: block;
    position: relative;
    height: 56px;
    padding: 6px 12px 0 20px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
    cursor: pointer;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }
  .bar {
    position: absolute;
    left: 2px;
    top: 2px;
    bottom: 2px;
    width: 6px;
    background: var(--mc-fill-red);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mc-font-display);
    font-size: 24px;
    line-height: 1;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .count {
    flex: none;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  .line {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.2;
    opacity: 0.9;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    overflow: hidden;
  }
  :host([size="phone"]) {
    height: 72px;
  }
  :host([size="phone"]) .name {
    font-size: 20px;
  }
  :host([size="phone"]) .line {
    font-size: 11px;
    -webkit-line-clamp: 2;
  }
`;
