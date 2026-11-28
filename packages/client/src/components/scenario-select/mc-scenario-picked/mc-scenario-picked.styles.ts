import { css } from "lit";

export const McScenarioPickedStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  /* The wide side column: content scrolls natively inside the ink panel. */
  .body,
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 1 0;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .sheet {
    padding: 12px;
    border-top: 1px solid color-mix(in srgb, var(--mc-line-paper) 40%, transparent);
  }
  .heading {
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    letter-spacing: 1px;
    line-height: 0.9;
    text-transform: uppercase;
  }
  h2.heading {
    margin-bottom: 4px;
  }
  .note {
    margin: 0;
    font-size: var(--mc-small-9);
    line-height: 1.3;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .stages {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  hr {
    width: 100%;
    height: 1px;
    margin: 8px 0 4px;
    border: 0;
    background: var(--mc-fill-paper);
    opacity: 0.4;
  }
  /* The narrow bar: a touch target the whole width, the heading and what is inside it, and the disclosure arrow. */
  .bar {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
    height: 44px;
    padding: 0 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .bar:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
  .bar.empty {
    cursor: default;
  }
  .summary,
  .hint {
    flex: 1 1 0;
    min-width: 0;
    margin-left: auto;
    overflow: hidden;
    text-align: right;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .heading + .arrow {
    margin-left: auto;
  }
  .arrow {
    font-family: var(--mc-font-display);
    font-size: 18px;
  }
`;
