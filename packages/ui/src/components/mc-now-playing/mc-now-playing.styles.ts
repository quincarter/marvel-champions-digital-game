import { css } from "lit";

export const McNowPlayingStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 60px;
    padding: 0 14px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .note {
    font-family: var(--mc-font-display);
    font-size: 26px;
    width: 26px;
    text-align: center;
  }
  :host([idle]) .note {
    opacity: 0.4;
  }
  .text {
    min-width: 0;
  }
  .status {
    font-size: var(--mc-small-9, 9px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-fill-caution);
  }
  .title {
    font-size: 16px;
    font-weight: 800;
    line-height: 1.2;
  }
  .detail {
    font-size: 10px;
    opacity: 0.7;
  }
  .title,
  .detail {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
