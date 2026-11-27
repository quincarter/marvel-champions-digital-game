import { css } from "lit";

/**
 * The Phaser panel's measures (scenes/board/log.ts): a 50px header (title Bangers 26, a 150x38 close at the right,
 * 16px in), lines 16px from the left with a 3px voice rule 8px left of the text, 12px apart, a ref in mono over each
 * line (the line's own type is the emphasis weight at line height 1.35), a 24px chip row (18px chips) under a line that
 * has statuses, and an ink "newer" chip 34px high under the list (the list gets shorter while it shows), 4px in from the panel's edges.
 */
export const McGameLogStyles = css`
  :host {
    display: block;
    position: relative;
    height: 100%;
    background: var(--mc-fill-parchment);
    outline: 2px solid var(--mc-line-ink);
    outline-offset: -1px;
    --ref: 13px;
    --body: 18px;
  }
  .frame {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding-bottom: 4px;
  }
  header {
    position: relative;
    flex: none;
    height: 50px;
  }
  header h2 {
    position: absolute;
    left: 16px;
    right: 176px;
    top: 0;
    bottom: 0;
    margin: 0;
    display: flex;
    align-items: center;
    font-size: 26px;
    line-height: 0.9;
    letter-spacing: 2px;
    white-space: nowrap;
    overflow: hidden;
  }
  header h2 span {
    display: block;
    white-space: nowrap;
  }
  mc-button.close {
    position: absolute;
    right: 16px;
    top: 6px;
    width: 150px;
    height: 38px;
  }
  /* The close is 38px tall: a transparent 44px press area over it (the 50px header leaves room), same width and place. */
  .close-hit {
    position: absolute;
    right: 16px;
    top: 3px;
    width: 150px;
    height: 44px;
    cursor: pointer;
    z-index: 1;
  }
  mc-glyph {
    position: absolute;
  }
  .scroller {
    position: relative;
    flex: 1;
    min-height: 0;
    padding: 0 22px 0 8px;
  }
  .line {
    position: relative;
    margin: 0 0 12px;
    padding-left: 8px;
    content-visibility: auto;
    contain-intrinsic-block-size: auto 76px;
  }
  .line::before {
    content: "";
    position: absolute;
    left: 0;
    top: 1px;
    bottom: 0;
    width: 3px;
    background: color-mix(in srgb, var(--mc-fill-ink) 50%, transparent);
  }
  .line[data-voice="villain"]::before,
  .line[data-voice="loss"]::before {
    background: var(--mc-fill-red);
  }
  .line[data-voice="scenario"]::before {
    background: var(--mc-fill-caution);
  }
  .line[data-voice="win"]::before {
    background: var(--mc-fill-heal);
  }
  .ref {
    height: calc(var(--ref) + 7px);
    font-family: var(--mc-font-mono);
    font-size: var(--ref);
    font-weight: 400;
    line-height: 1.4;
    opacity: 0.75;
  }
  .text {
    margin: 0;
    font-size: var(--body);
    font-weight: 700;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0 4px;
    padding: 3px 0;
  }
  .tag {
    position: relative;
    height: 18px;
    padding: 0 5px;
    font-size: var(--mc-small-11, 11px);
    font-weight: 800;
    letter-spacing: 1.2px;
    line-height: 18px;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--mc-text-ink-on-hue);
    background: var(--mc-fill-stunned);
  }
  .tag[data-status="confused"] {
    color: var(--mc-text-paper);
    background: var(--mc-fill-confused);
  }
  .tag[data-status="tough"] {
    background: var(--mc-fill-tough);
  }
  .tag[data-spent] {
    color: color-mix(in srgb, var(--mc-text-ink-on-hue) 75%, transparent);
    background: color-mix(in srgb, var(--mc-fill-stunned) 45%, transparent);
  }
  .tag[data-spent][data-status="confused"] {
    color: color-mix(in srgb, var(--mc-text-paper) 75%, transparent);
    background: color-mix(in srgb, var(--mc-fill-confused) 45%, transparent);
  }
  .tag[data-spent][data-status="tough"] {
    background: color-mix(in srgb, var(--mc-fill-tough) 45%, transparent);
  }
  .tag[data-spent]::after {
    content: "";
    position: absolute;
    left: 2px;
    right: 2px;
    top: 50%;
    height: 1.5px;
    margin-top: -0.75px;
    background: var(--mc-line-ink-on-hue);
  }
  .empty {
    margin: 0;
    padding: 0 22px 0 16px;
    font-size: var(--body);
    font-weight: 700;
    line-height: 1.35;
    opacity: 0.75;
  }
  .newer {
    flex: none;
    margin: 4px 4px 0;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    /* A native button, drawn as the chip was. */
    appearance: none;
    border: 0;
    border-radius: 0;
    font-family: inherit;
    box-sizing: border-box;
  }
  .newer:focus-visible {
    outline: 3px solid var(--mc-line-paper);
    outline-offset: -5px;
  }
`;
