import { css } from "lit";

export const McDecksGamesStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    color: var(--mc-text-paper);
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
  .open {
    flex: none;
    height: 44px;
  }
  .reading {
    margin: 0;
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.7;
  }
  .headline {
    margin: 0;
    color: var(--mc-text-caution);
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  .insight {
    margin: 0;
    padding: 8px;
    background: var(--mc-fill-paper);
    color: var(--mc-text-ink);
    font-size: 13px;
    line-height: 1.35;
  }
  .section h3 {
    margin: 0 0 8px;
    padding-bottom: 2px;
    border-bottom: 2px solid var(--mc-line-paper);
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 17px;
    text-transform: uppercase;
  }
  .section ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .entry {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .thumb {
    flex: none;
    width: 52px;
    height: 72px;
  }
  .words {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding-top: 4px;
    font-size: 12px;
    line-height: 1.3;
  }
  .name {
    font-weight: 800;
  }
  .detail {
    opacity: 0.85;
  }
  .against {
    flex: none;
    height: 44px;
  }
  .note {
    margin: 0;
    font-size: 13px;
    line-height: 1.35;
    opacity: 0.8;
  }
`;
