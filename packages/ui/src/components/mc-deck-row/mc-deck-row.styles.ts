import { css } from "lit";

export const McDeckRowStyles = css`
  :host {
    display: block;
    min-width: 0;
  }
  .listing {
    position: relative;
    height: var(--mc-deck-row-height, 84px);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .listing mc-media-row {
    position: absolute;
    inset: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 98px;
    padding: 10px;
    background: var(--mc-fill-parchment);
    color: var(--mc-text-ink);
    border: 2px solid var(--mc-line-ink);
  }
  .thumb {
    flex: none;
    align-self: stretch;
    width: 56px;
    min-height: 56px;
  }
  .words {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .name {
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: 15px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stamps {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .stamp {
    padding: 2px 5px;
    background: var(--stamp-fill);
    color: var(--stamp-ink);
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 1.2;
    white-space: nowrap;
    box-shadow: inset 0 0 0 1px var(--mc-line-ink);
  }
  .source,
  .verdict {
    font-weight: 700;
    font-size: var(--mc-small-11);
    letter-spacing: 1px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .source {
    opacity: 0.75;
  }
  .verdict[data-status="ok"] {
    color: var(--mc-text-heal);
  }
  .verdict[data-status="blocked"] {
    color: var(--mc-text-red);
  }
  .act {
    flex: none;
    width: 96px;
    height: 44px;
  }
  @media (max-width: 600px) {
    .act {
      width: 76px;
    }
  }
`;
