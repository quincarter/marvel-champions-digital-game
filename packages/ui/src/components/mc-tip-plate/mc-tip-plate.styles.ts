import { css } from "lit";

/**
 * The plate fills the screen (a fixed host: inside a transformed ancestor it fills that ancestor, which is the panel) and
 * holds a backdrop that takes the dismissing tap, and the plate itself, placed by `tipPlacement`.
 */
export const McTipPlateStyles = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: block;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: transparent;
    -webkit-tap-highlight-color: transparent;
  }
  .plate {
    position: absolute;
    box-sizing: border-box;
    padding: 10px 10px 13px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    border-bottom: 3px solid var(--mc-fill-caution, #f5c518);
    outline: 2px solid var(--mc-fill-ink);
    font-family: var(--mc-font-body);
  }
  .arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
  }
  .plate[data-above="false"] .arrow {
    top: -7px;
    border-bottom: 7px solid var(--mc-fill-ink);
  }
  .plate[data-above="true"] .arrow {
    bottom: -10px;
    border-top: 7px solid var(--mc-fill-ink);
  }
  .heading {
    margin: 0 0 6px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .tagline,
  .body {
    margin: 0 0 6px;
    font-size: 12px;
    line-height: 1.35;
  }
  .tagline {
    opacity: 0.8;
  }
  .link {
    all: unset;
    display: block;
    box-sizing: border-box;
    width: calc(100% + 20px);
    margin: 2px -10px -13px;
    padding: 10px 10px 13px;
    font-weight: 800;
    font-size: 10px;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-caution, #f5c518);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .link.off {
    color: var(--mc-text-paper);
    opacity: 0.4;
    cursor: default;
  }
`;
