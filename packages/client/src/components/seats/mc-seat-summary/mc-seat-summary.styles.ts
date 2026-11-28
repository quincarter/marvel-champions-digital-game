import { css } from "lit";

export const McSeatSummaryStyles = css`
  :host {
    display: block;
    min-width: 0;
    color: var(--mc-text-ink);
  }
  button {
    appearance: none;
    margin: 0;
    cursor: pointer;
    font-family: var(--mc-font-body);
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: 2px;
  }
  .toggle {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    text-align: left;
    background: none;
    color: inherit;
    border: 1.5px solid var(--mc-line-ink);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hint {
    margin: 0;
    padding: 8px 0;
    font-family: var(--mc-font-body);
    font-size: 14px;
    opacity: 0.75;
  }
  .block {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding-top: 6px;
  }
  .lines {
    flex: 1;
    min-width: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }
  .lines li {
    line-height: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lines .soft {
    opacity: 0.75;
  }
  .clear {
    flex: none;
    width: 104px;
    min-height: 44px;
    padding: 0 8px;
    background: none;
    color: inherit;
    border: 1.5px solid var(--mc-line-ink);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .clear[aria-disabled="true"] {
    opacity: 0.5;
    border-style: dashed;
  }
`;
