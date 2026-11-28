import { css } from "lit";

export const McLobbySeatsStyles = css`
  :host {
    display: block;
    min-height: 0;
    height: 100%;
    color: var(--mc-text-ink);
  }
  .panel {
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    background: var(--mc-fill-parchment);
    border: 2px solid var(--mc-line-ink);
  }
  .title {
    margin: 0 0 6px 2px;
    font-family: var(--mc-font-display);
    font-size: 18px;
    font-weight: 400;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 2px 6px 4px 0;
  }
  .hint,
  .none,
  .note {
    margin: 0;
    font-family: var(--mc-font-body);
    font-size: 13px;
    opacity: 0.85;
  }
  .note {
    font-weight: 800;
    opacity: 1;
  }
  .none {
    font-size: 14px;
  }
`;
