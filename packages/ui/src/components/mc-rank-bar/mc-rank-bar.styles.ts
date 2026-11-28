import { css } from "lit";

/**
 * The plate's measures are the Phaser badge's: 8px side padding, the first line 4 or 5px from the top, the title at 19,
 * the 6px bar at 36 (full) or 20 (one line), its caption just under it. An ink plate (red while announcing a rank-up)
 * with a paper edge; the bar is a paper outline with a Hero Red fill.
 */
export const McRankBarStyles = css`
  :host {
    display: block;
    position: relative;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .plate {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--mc-fill-ink) 90%, transparent);
    outline: 2px solid var(--mc-line-paper);
    outline-offset: -1px;
  }
  :host([up]) .plate {
    background: var(--mc-fill-red);
  }
  .line {
    position: absolute;
    left: 8px;
    right: 8px;
    color: var(--mc-text-paper);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }
  .label {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
  }
  .title {
    font-weight: 800;
    font-size: var(--mc-small-11, 11px);
    letter-spacing: 0;
  }
  .caption {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    opacity: 0.5;
  }
  .points {
    position: absolute;
    right: 8px;
    color: var(--mc-text-paper);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .bar {
    position: absolute;
    left: 8px;
    right: 8px;
    height: 6px;
    outline: 1px solid var(--mc-line-paper);
    outline-offset: -1px;
  }
  .fill {
    position: absolute;
    left: 1px;
    top: 1px;
    bottom: 1px;
    background: var(--mc-fill-red);
  }
`;
