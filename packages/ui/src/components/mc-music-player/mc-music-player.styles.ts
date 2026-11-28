import { css } from "lit";
import { PopupPartStyles } from "../../shared/popup-parts.js";

export const McMusicPlayerStyles = css`
  ${PopupPartStyles}
  :host {
    display: block;
    position: absolute;
    inset: 0;
  }
  .outside {
    position: absolute;
    inset: 0;
  }
  .panel {
    position: absolute;
    left: var(--panel-x);
    top: var(--panel-y);
    width: var(--panel-w);
    height: var(--panel-h);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 14px 0;
    background: var(--mc-fill-paper);
    border: 3px solid var(--mc-line-ink);
    box-shadow: 6px 6px 0 color-mix(in srgb, var(--mc-fill-void) 28%, transparent);
  }
  :host([phone]) .panel {
    padding: 6px 16px 0;
    border: 0;
    box-shadow: none;
  }
  .caret {
    position: absolute;
    left: calc(var(--caret-x) - 10px);
    top: calc(var(--panel-y) - 8px);
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
    width: 36px;
    height: 36px;
    order: 3;
  }
  :host([phone]) .close {
    width: 92px;
    order: 0;
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
  mc-now-playing {
    flex: none;
  }
  mc-player-controls {
    flex: none;
  }
  mc-volume-slider {
    height: 40px;
  }
  mc-track-list {
    flex: 1;
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
