import { css } from "lit";

/** An ink-framed tile: the picture on ink, a parchment caption under it, a 2px ink frame over both. */
export const McPictureTileStyles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    background: var(--mc-fill-parchment);
    pointer-events: none;
  }
  .art {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    background: var(--mc-fill-ink);
    overflow: hidden;
  }
  .art img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .art img.dim {
    filter: grayscale(1);
    opacity: 0.3;
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
  .detail.alert {
    color: var(--mc-text-red);
    opacity: 1;
  }
  .frame {
    position: absolute;
    inset: 0;
    border: 2px solid var(--mc-line-ink);
  }
`;
