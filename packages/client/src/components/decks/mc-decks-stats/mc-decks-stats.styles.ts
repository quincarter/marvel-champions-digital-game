import { css } from "lit";

export const McDecksStatsStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
    color: var(--mc-text-paper);
  }
  .head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-bottom: 8px;
    border-bottom: 3px solid var(--mc-line-paper);
  }
  .title {
    margin: 0;
    font-family: var(--mc-font-display);
    font-style: italic;
    font-weight: 400;
    font-size: 26px;
    line-height: 1.1;
    text-transform: uppercase;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .meta {
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .tabs {
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    height: 28px;
  }
  .view {
    flex: 1;
    min-height: 0;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
  .block h3 {
    margin: 0 0 6px;
    font-weight: 800;
    font-size: var(--mc-small-11);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
  }
  .actions {
    display: flex;
    gap: 6px;
    height: 28px;
  }
  .actions .ctl {
    flex: 1;
  }
  .recently {
    margin: 0;
    padding-left: 9px;
    border-left: 3px solid var(--mc-line-paper);
    font-size: 13px;
    opacity: 0.85;
  }
  .foot {
    flex: none;
    display: flex;
    gap: 6px;
    height: 52px;
    padding-top: 10px;
    border-top: 3px solid var(--mc-line-paper);
    box-sizing: content-box;
  }
  .duplicate {
    flex: 0 0 38%;
  }
  .play {
    flex: 1;
  }
  .duplicate .ctl,
  .play .ctl {
    height: 100%;
  }
  .select {
    margin: 0;
    font-size: 14px;
    opacity: 0.85;
  }
  @media (pointer: coarse), (max-width: 1279px) {
    .tabs,
    .actions {
      height: 44px;
    }
  }
`;
