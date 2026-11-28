import { css } from "lit";

/**
 * The pack look: a parchment ground, a 2px ink frame, a 5:7 picture at the left, then the text column. The deck look:
 * a card ground with a heavier frame inset in the row, the picture and its stamps at the left, display type for the title.
 */
export const McMediaRowStyles = css`
  :host {
    display: block;
    position: relative;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  :host([look="deck"]) {
    cursor: default;
    pointer-events: none;
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
    position: relative;
    flex: 0 0 auto;
    height: 100%;
    aspect-ratio: 5 / 7;
  }
  .art mc-picture-tile {
    position: absolute;
    inset: 0;
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

  /* The deck look. */
  .group {
    position: absolute;
    left: 4px;
    top: 2px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }
  .row.deck {
    display: block;
    position: absolute;
    left: 4px;
    right: 4px;
    bottom: 4px;
    width: auto;
    height: auto;
    padding: 0;
    gap: 0;
    background: var(--mc-fill-card);
    outline: 2.5px solid var(--mc-line-ink);
    outline-offset: -1.25px;
    color: var(--mc-text-ink);
    overflow: visible;
    container-type: size;
  }
  .row.deck.selected {
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    outline-width: 3px;
  }
  .row.deck.alert {
    outline: 3px solid var(--mc-line-red);
    outline-offset: -1.5px;
  }
  .row.deck.dim .art,
  .row.deck.dim .heading {
    opacity: 0.55;
  }
  .row.deck .art {
    position: absolute;
    left: 6px;
    top: 6px;
    bottom: 6px;
    height: auto;
    aspect-ratio: auto;
    overflow: hidden;
    background: var(--mc-fill-parchment);
  }
  .stamps {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-wrap: wrap;
  }
  .stamp {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 2px 4px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    /* Tight, so a long aspect word (LEADERSHIP, PROTECTION) fits a narrow picture whole. */
    letter-spacing: 0.3px;
    text-transform: uppercase;
    line-height: 1.1;
    white-space: nowrap;
  }
  .row.deck .text {
    position: absolute;
    top: 8px;
    bottom: 6px;
    right: 10px;
    left: calc(6px + var(--mc-art-width, 0px) + 10px);
    overflow: hidden;
  }
  .row.deck .heading {
    margin-top: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 18px;
    letter-spacing: 0.6px;
    line-height: 1.05;
    text-transform: uppercase;
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    color: inherit;
  }
  .row.deck.alert .heading {
    color: var(--mc-text-red);
  }
  .row.deck .meta {
    margin-top: 3px;
    font-size: var(--mc-small-11);
    font-weight: 600;
    line-height: 1.25;
    color: inherit;
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
  .row.deck .text.has-foot .meta {
    -webkit-line-clamp: 1;
  }
  /* A short row (a phone's list) has no room for a two line title above the meta and the footer line. */
  @container (max-height: 78px) {
    .row.deck .text.has-foot .heading {
      -webkit-line-clamp: 1;
    }
  }
  .row.deck.selected .meta {
    opacity: 0.75;
  }
  .row.deck .foot {
    font-size: var(--mc-small-10);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    overflow: hidden;
    text-overflow: ellipsis;
    color: inherit;
  }
  .row.deck .badge.corner {
    position: absolute;
    right: 14px;
    bottom: 10px;
    padding: 2px 4px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-size: var(--mc-small-10);
    letter-spacing: 1px;
    outline: none;
  }
`;
