import { css } from "lit";

/** An ink-framed card: the picture tile on ink, a parchment caption under it, a 2px ink frame over both. */
export const McPictureCardStyles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    background: var(--mc-fill-parchment);
    pointer-events: none;
  }
  :host([paper]) {
    background: var(--mc-fill-paper);
  }
  .art {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    background: var(--mc-fill-ink);
    overflow: hidden;
  }
  mc-picture-tile {
    position: absolute;
    inset: 0;
  }
  .initial {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mc-font-display);
    color: var(--mc-text-paper);
    opacity: 0.18;
    line-height: 1;
  }
  .chip {
    position: absolute;
    left: 8px;
    top: 8px;
    padding: 4px 6px;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    line-height: 1.2;
    white-space: nowrap;
    color: var(--mc-text-paper);
    background: var(--mc-fill-red);
  }
  .chip.locked {
    background: var(--mc-fill-ink);
    outline: 1px solid var(--mc-line-paper);
    outline-offset: -1px;
  }
  .caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 7px 8px 0;
    min-width: 0;
  }
  .title {
    font-weight: 800;
    font-size: 13px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mc-text-ink);
  }
  .title.display {
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 24px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .detail {
    margin-top: 7px;
    font-size: var(--mc-small-10);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--mc-text-ink);
    opacity: 0.75;
  }
  /* A two-line detail wraps and clips at two lines instead of one cut line. */
  .detail.two {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }
  .detail.alert {
    color: var(--mc-text-red);
    opacity: 1;
  }
  .stripe {
    position: absolute;
    left: 0;
    right: 0;
    height: 7px;
    display: flex;
  }
  .stripe span {
    flex: 1;
  }
  .words {
    position: absolute;
    left: 8px;
    right: 8px;
  }
  .line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .frame {
    position: absolute;
    inset: 0;
    box-shadow: inset 0 0 0 var(--mc-card-border, 2px) var(--mc-card-frame, var(--mc-line-ink));
    pointer-events: none;
  }
  .tap {
    position: absolute;
    inset: 0;
    cursor: pointer;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    user-select: none;
  }
`;
