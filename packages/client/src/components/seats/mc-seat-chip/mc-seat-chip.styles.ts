import { css } from "lit";

export const McSeatChipStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .face {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 2px;
    height: 100%;
    min-height: 64px;
    padding: 7px;
    background: var(--mc-fill-card);
    color: var(--mc-text-ink);
    border: 1.5px solid var(--mc-line-ink);
  }
  .face[data-frame="activeFilled"] {
    border: 3px solid var(--mc-line-red);
    padding: 5.5px;
  }
  .face[data-frame="activeEmpty"] {
    border: 3px dashed var(--mc-line-red);
    padding: 5.5px;
  }
  .face[data-frame="empty"],
  .face[data-frame="locked"] {
    border: 2px dashed var(--mc-line-ink);
  }
  .face[data-frame="locked"] {
    opacity: 0.5;
  }
  .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--mc-text-red);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .name {
    font-family: var(--mc-font-display);
    font-size: 17px;
    font-style: italic;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta,
  .empty {
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 0.8px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.75;
  }
  .face[data-frame="activeEmpty"] .empty {
    color: var(--mc-text-red);
    opacity: 1;
  }
  .face[data-frame="locked"] .empty {
    opacity: 0.5;
  }
  .press {
    position: absolute;
    inset: 0;
    appearance: none;
    background: none;
    border: 0;
    margin: 0;
    padding: 0;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .press:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
`;
