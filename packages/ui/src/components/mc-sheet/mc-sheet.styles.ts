import { css } from "lit";

/** Every part is placed absolutely at its rect; text keeps Phaser's single-line default unless it wraps. */
export const McSheetStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
  }
  /* A pop-up slides its box (every part after its scrim) by --mc-popup-slide, set by the client as it enters, leaves or is dragged. */
  :host([popup]) > :not(:first-child) {
    transform: translateY(var(--mc-popup-slide, 0px));
  }
  .part {
    position: absolute;
    box-sizing: border-box;
  }
  .text {
    line-height: 1.2;
    pointer-events: none;
  }
  /* A search match: a band behind the letters and a heavier line under them, never color alone. */
  .text mark {
    background: color-mix(in srgb, var(--mc-fill-caution) 35%, transparent);
    color: inherit;
    box-shadow: 0 2px 0 var(--mc-fill-caution);
  }
  .tap {
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    /* A press-and-hold inspects (a card): no text selection or touch callout over it. */
    -webkit-touch-callout: none;
    user-select: none;
  }
  /* A picture fitted whole inside its box, centered: a card scan is the whole card, never cropped. */
  .image {
    overflow: hidden;
    pointer-events: none;
  }
  .image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    user-select: none;
  }
  .image .missing {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.5;
  }
  /* A scrolling region keeps its parts inside its rect and scrolls the rest, vertically only. */
  .scroller {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .content {
    position: relative;
  }
  /* A stepped slider: the track takes sideways drags itself and leaves the page's vertical scroll to the browser. */
  .slider-track {
    touch-action: pan-y;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .slider-bar,
  .slider-fill {
    position: absolute;
    height: 6px;
  }
  .slider-bar {
    opacity: 0.22;
  }
  .slider-fill {
    background: var(--mc-fill-red, #c8102e);
  }
  .slider-knob {
    position: absolute;
    width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--mc-fill-paper, #f2ede0);
    border: 2px solid var(--mc-line-ink, #14110e);
  }
  .slider-label {
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: var(--mc-text-paper, #f2ede0);
  }
`;
