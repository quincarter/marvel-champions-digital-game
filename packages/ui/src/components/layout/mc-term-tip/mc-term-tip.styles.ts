import { css } from "lit";

/**
 * The host is a zero-size box at the corner of the text that holds it; the plate is placed from it in absolute pixels,
 * over everything else on the page (z-index), with no backdrop.
 */
export const McTermTipStyles = css`
  :host {
    position: absolute;
    left: 0;
    top: 0;
    width: 0;
    height: 0;
    z-index: 2000;
    display: block;
    font-family: var(--mc-font-body);
  }
  .plate {
    position: absolute;
    box-sizing: border-box;
    padding: 10px 12px 13px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    border-bottom: 3px solid var(--mc-fill-caution, #f5c518);
    outline: 2px solid var(--mc-fill-ink);
    text-align: left;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
  }
  .arrow {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
  }
  .plate[data-above="false"] .arrow {
    top: -8px;
    border-bottom: 8px solid var(--mc-fill-ink);
  }
  .plate[data-above="true"] .arrow {
    bottom: -11px;
    border-top: 8px solid var(--mc-fill-ink);
  }
  .heading {
    margin: 0 0 6px;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .body {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.4;
    opacity: 0.85;
  }
  .link {
    all: unset;
    display: block;
    box-sizing: border-box;
    width: calc(100% + 24px);
    margin: 0 -12px -13px;
    padding: 10px 12px 13px;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-10, 10px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-caution, #f5c518);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
`;
