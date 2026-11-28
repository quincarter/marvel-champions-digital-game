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
`;
