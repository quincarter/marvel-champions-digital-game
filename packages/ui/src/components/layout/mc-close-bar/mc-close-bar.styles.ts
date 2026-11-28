import { css } from "lit";

export const McCloseBarStyles = css`
  :host {
    display: block;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--bar-height, 56px);
    padding: 0 var(--bar-pad, 16px);
  }
  .ctl {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
  }
  .close {
    --chip-height: 44px;
    --chip-size: 30px;
    --chip-fill: transparent;
    --chip-line: transparent;
    --chip-color: var(--mc-text-paper);
    width: 44px;
    height: 44px;
  }
  .title {
    flex: 0 1 auto;
    min-width: 0;
    margin: 0;
    padding: var(--drop, 0) 0.2em 0 0;
    max-width: var(--max, none);
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: var(--title-size, 22px);
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* A zero-width marker after the title: the glyph hangs from it, so it follows the title's last letter. */
  .after {
    position: relative;
    flex: none;
    width: 0;
    height: 18px;
  }
  .after mc-glyph-hint {
    left: 14px;
  }
  .end {
    margin-left: auto;
    flex: none;
    display: flex;
    align-items: center;
  }
`;
