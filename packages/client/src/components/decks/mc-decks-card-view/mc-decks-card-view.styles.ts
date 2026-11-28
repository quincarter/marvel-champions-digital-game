import { css } from "lit";

export const McDecksCardViewStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .back,
  .inspect {
    flex: none;
    height: 44px;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .top {
    display: flex;
    gap: 10px;
  }
  .pic {
    flex: none;
    width: min(130px, 42%);
    aspect-ratio: 63 / 88;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .name {
    margin: 0;
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 20px;
    line-height: 1.1;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }
  .type {
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .block h4 {
    margin: 0 0 6px;
    color: var(--mc-text-caution);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 10px;
    margin: 0;
    font-size: 12px;
  }
  dt {
    opacity: 0.85;
  }
  dd {
    margin: 0;
    font-weight: 800;
    text-align: right;
  }
  .empty {
    margin: 0;
    font-size: 12px;
    opacity: 0.8;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    line-height: 1.5;
  }
`;
