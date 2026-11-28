import { css } from "lit";

export const McLessonRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .badge {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 1.5px solid var(--mc-line-ink);
    border-radius: 50%;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    font-family: var(--mc-font-display);
    font-size: 16px;
    line-height: 1;
  }
  .badge[data-done] {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .done {
    font-size: 13px;
    opacity: 0.75;
    white-space: nowrap;
  }
`;
