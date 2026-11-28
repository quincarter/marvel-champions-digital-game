import { css } from "lit";

export const McMusicPlayerStyles = css`
  :host {
    --popover-width: min(380px, calc(100% - 16px));
    display: block;
    position: absolute;
    inset: 0;
  }
  .outside {
    position: absolute;
    inset: 0;
  }
  /* A popover hangs from the music button: its right edge on the button's, kept 8px inside the screen, as tall as its
     songs need and no taller than the screen allows (the list scrolls). */
  .panel {
    position: absolute;
    top: calc(var(--anchor-bottom) + 8px);
    left: clamp(8px, calc(var(--anchor-right) - var(--popover-width)), calc(100% - 8px - var(--popover-width)));
    width: var(--popover-width);
    max-height: calc(100% - var(--anchor-bottom) - 16px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 14px 8px;
    background: var(--mc-fill-paper);
    border: 3px solid var(--mc-line-ink);
    box-shadow: 6px 6px 0 color-mix(in srgb, var(--mc-fill-void) 28%, transparent);
  }
  /* On a phone it fills the screen under the top bar. */
  :host([phone]) .panel {
    top: calc(var(--anchor-bottom) + 6px);
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: none;
    padding: 6px 16px 0;
    border: 0;
    box-shadow: none;
  }
  .caret {
    position: absolute;
    left: calc(var(--anchor-center) - 10px);
    top: calc(var(--anchor-bottom) + 0px);
    width: 20px;
    height: 11px;
    overflow: visible;
  }
  .caret polygon {
    fill: var(--mc-fill-paper);
  }
  .caret polyline {
    fill: none;
    stroke: var(--mc-line-ink);
    stroke-width: 3;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 0 0 44px;
  }
  .close {
    position: relative;
    width: 36px;
    height: 36px;
    order: 3;
    /* Room for a glyph hung to its left, so the earned count never runs under it. */
    margin-left: var(--close-room, 0);
  }
  :host([phone]) .close {
    width: 92px;
    order: 0;
  }
  .close mc-button {
    height: 100%;
    --mc-button-size: 12px;
  }
  .title {
    font-family: var(--mc-font-display);
    font-size: 20px;
    text-transform: uppercase;
  }
  .earned {
    margin-left: auto;
    font-size: var(--mc-small-9, 9px);
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.65;
  }
  mc-now-playing,
  mc-player-controls {
    flex: none;
  }
  mc-volume-slider {
    height: 40px;
  }
  mc-track-list {
    flex: 0 1 auto;
    min-height: 0;
  }
  :host([phone]) mc-track-list {
    flex: 1 1 0;
  }
  .foot {
    flex: 0 0 36px;
    display: flex;
    align-items: center;
    font-size: 11px;
    opacity: 0.5;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;
