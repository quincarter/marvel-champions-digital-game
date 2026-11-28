import { css } from "lit";

export const McSeatCardStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .face {
    position: relative;
    box-sizing: border-box;
    display: flex;
    gap: 10px;
    align-items: stretch;
    height: 100%;
    min-height: 96px;
    padding: 8px;
    background: var(--mc-fill-card);
    color: var(--mc-text-ink);
    border: 1.5px solid var(--mc-line-ink);
  }
  .face[data-frame="activeFilled"] {
    border: 4px solid var(--mc-line-red);
    padding: 5px;
  }
  .face[data-frame="activeEmpty"] {
    border: 4px dashed var(--mc-line-red);
    padding: 5px;
  }
  .face[data-frame="empty"],
  .face[data-frame="locked"] {
    border: 2px dashed var(--mc-line-ink);
  }
  .face[data-frame="locked"] {
    opacity: 0.5;
  }
  .thumb {
    flex: none;
    width: 32%;
    max-width: 96px;
    aspect-ratio: 1;
    align-self: flex-start;
  }
  .words {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-red);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 30px;
  }
  .name {
    font-family: var(--mc-font-display);
    font-size: 18px;
    font-style: italic;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 30px;
  }
  .meta {
    margin-top: auto;
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0.75;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .empty {
    margin: auto 0;
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: 0.6;
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
  .clear {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 28px;
    height: 28px;
    appearance: none;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    color: var(--mc-text-ink);
    font: 700 16px var(--mc-font-body);
  }
  .press:focus-visible,
  .clear:focus-visible {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -3px;
  }
`;
