import { css } from "lit";

export const McVolumeSliderStyles = css`
  :host {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 100%;
    --share: 0;
    --knob: 9px;
  }
  mc-button {
    flex: 0 0 36px;
    height: 100%;
    --mc-button-size: 12px;
  }
  .track {
    position: relative;
    flex: 1;
    height: 100%;
    min-width: 0;
    cursor: pointer;
    user-select: none;
    touch-action: pan-y;
    -webkit-tap-highlight-color: transparent;
  }
  .bar,
  .fill {
    position: absolute;
    top: calc(50% - 3px);
    left: var(--knob);
    height: 6px;
  }
  .bar {
    right: var(--knob);
    background: var(--mc-fill-ink);
    opacity: 0.22;
  }
  .fill {
    width: calc((100% - var(--knob) * 2) * var(--share));
    background: var(--mc-fill-red, #c8102e);
  }
  .knob {
    position: absolute;
    top: calc(50% - var(--knob));
    left: calc((100% - var(--knob) * 2) * var(--share));
    width: calc(var(--knob) * 2);
    height: calc(var(--knob) * 2);
    border-radius: 50%;
    background: var(--mc-fill-paper);
    border: 2px solid var(--mc-line-ink);
  }
  .label {
    flex: 0 0 50px;
    text-align: right;
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }
  /* A settings row (with a heading): the words over a line of preview and slider. */
  :host([heading]) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    height: auto;
    color: var(--mc-text-paper);
  }
  :host([dimmed]) {
    opacity: 0.5;
  }
  .words {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .heading {
    font-size: var(--mc-small-12, 12px);
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .detail {
    font-size: var(--mc-small-10, 10px);
    line-height: 1.3;
    opacity: 0.8;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
  }
  .control {
    display: flex;
    flex: 1 1 220px;
    align-items: center;
    gap: 10px;
    height: 44px;
    min-width: 0;
  }
`;
