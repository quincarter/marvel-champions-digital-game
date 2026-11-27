import { css } from "lit";

/** The pack tile's look: a parchment ground, a 2px ink frame, a 5:7 picture at the left, then the text column. */
export const McListRowStyles = css`
  :host {
    display: block;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .row {
    position: relative;
    display: flex;
    gap: 10px;
    width: 100%;
    height: 100%;
    padding: 6px 8px 6px 6px;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
    overflow: hidden;
  }
  .art {
    flex: 0 0 auto;
    height: 100%;
    aspect-ratio: 5 / 7;
  }
  .text {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .heading {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 14px;
    line-height: 1.2;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mc-text-ink);
  }
  .meta,
  .summary {
    font-family: var(--mc-font-body);
    font-size: var(--mc-small-10, 10px);
    line-height: 1.25;
    color: var(--mc-text-ink);
  }
  .meta {
    margin-top: 4px;
    opacity: 0.6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .summary {
    margin-top: 3px;
    opacity: 0.9;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .footline {
    margin-top: auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .foot {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    opacity: 0.6;
    white-space: nowrap;
    color: var(--mc-text-ink);
  }
  .badge {
    flex: 0 1 auto;
    min-width: 0;
    padding: 4px 7px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mc-text-ink);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -2px;
  }
  .badge.solid {
    background: var(--mc-fill-red);
    color: var(--mc-text-paper);
    outline: none;
  }
`;
