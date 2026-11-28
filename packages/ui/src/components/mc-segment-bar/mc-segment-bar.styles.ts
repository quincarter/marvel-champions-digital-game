import { css } from "lit";

export const McSegmentBarStyles = css`
  :host {
    display: block;
    height: var(--bar-height, 12px);
  }
  .bar {
    display: flex;
    height: 100%;
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
    overflow: hidden;
  }
  .part {
    flex: 0 0 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: 0 6px;
    background: var(--part-color);
    color: var(--part-ink, var(--mc-text-ink));
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
  }
  /* A paper edge between parts, so two dark parts side by side still read as two. */
  .part + .part {
    border-left: 2px solid var(--mc-fill-paper);
  }
`;
