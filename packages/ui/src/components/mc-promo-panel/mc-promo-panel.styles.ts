import { css } from "lit";

/** Borders, not shadows, and no red: the screen's New game keeps its one red. */
export const McPromoPanelStyles = css`
  :host {
    display: block;
    position: relative;
  }
  .ground {
    position: absolute;
    inset: 0;
    background: var(--mc-fill-paper);
  }
  .band {
    position: absolute;
    background: var(--mc-fill-ink);
  }
  .band svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .rule {
    position: absolute;
    height: 3px;
    background: var(--mc-fill-ink);
  }
  .title {
    position: absolute;
    display: flex;
    align-items: center;
    color: var(--mc-text-paper);
    font-family: var(--mc-font-display);
    letter-spacing: 1px;
    font-size: var(--size);
    line-height: 1.05;
    padding-top: 0.2em;
    white-space: pre;
  }
  .chip {
    position: absolute;
    display: flex;
    align-items: center;
    width: max-content;
    max-width: 100%;
    padding: 0 10px 0 22px;
    background: var(--mc-fill-paper);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    color: var(--mc-text-ink);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    white-space: nowrap;
  }
  .chip::before {
    content: "";
    position: absolute;
    left: 8px;
    top: 50%;
    width: 8px;
    height: 8px;
    margin-top: -4px;
    border-radius: 50%;
    background: var(--mc-fill-heal);
  }
  .pitch {
    position: absolute;
    overflow: hidden;
    color: var(--mc-text-ink);
    font-size: var(--size);
    font-weight: 400;
    line-height: 1.18;
  }
  :host([unavailable]) .pitch {
    opacity: 0.5;
  }
  .seats {
    position: absolute;
  }
  .frame {
    position: absolute;
    inset: 0;
    outline: 3px solid var(--mc-line-ink);
    outline-offset: -1.5px;
    pointer-events: none;
  }
`;
