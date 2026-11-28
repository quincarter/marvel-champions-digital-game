import { css } from "lit";

export const McTrackRowStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 46px;
    padding: 0 10px 0 7px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  :host([playing]) {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .disc {
    flex: 0 0 38px;
    height: 38px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mc-fill-red, #c8102e);
    color: var(--mc-text-paper);
    font-size: 12px;
  }
  :host([playing]) .disc {
    font-size: 15px;
  }
  .text {
    min-width: 0;
    flex: 1;
  }
  .title {
    font-size: 13px;
    font-weight: 800;
    line-height: 1.25;
  }
  .where {
    font-size: 10px;
    opacity: 0.7;
  }
  .title,
  .where {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
