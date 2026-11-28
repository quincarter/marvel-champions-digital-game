import { css } from "lit";

export const McTopBarStyles = css`
  :host {
    display: block;
    background: var(--mc-fill-ink);
    color: var(--mc-text-paper);
    --bar-height: var(--mc-top-bar-height, 60px);
    --title-size: var(--mc-top-bar-title-size, 28px);
    --pad: var(--mc-top-bar-pad, 22px);
    --gap: 14px;
  }
  :host([tone="paper"]) {
    background: none;
    color: var(--mc-text-ink);
  }
  :host([compact]) {
    --bar-height: var(--mc-top-bar-height, 52px);
    --title-size: var(--mc-top-bar-title-size, 22px);
    --pad: var(--mc-top-bar-pad, 12px);
    --gap: 12px;
  }
  /* A bar is as tall as its rows: one row beside Back, or two when the title drops under the dark mode tab. */
  .bar {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    align-items: center;
    column-gap: var(--gap);
    min-height: var(--bar-height);
    padding: 0 var(--pad);
  }
  :host([dropped]) .bar {
    align-content: flex-start;
    padding-top: 6px;
  }
  /* Holds the first row down to the tab's foot while the title is on the row under it. */
  .strut {
    flex: none;
    order: 0;
    width: 0;
    height: 0;
    margin-right: calc(var(--gap) * -1);
  }
  :host([dropped]) .strut {
    height: max(0px, calc(var(--mc-top-bar-first-row, 0px) - 6px));
  }
  .lead {
    order: 0;
    flex: none;
  }
  .back {
    width: auto;
    min-width: var(--mc-top-bar-back-min, 76px);
    height: 44px;
    --mc-button-size: 18px;
  }
  :host([compact]) .back {
    min-width: 44px;
  }
  .ctl {
    position: relative;
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
  .titles {
    order: 1;
    flex: none;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
  }
  .line {
    display: flex;
    align-items: center;
  }
  .title {
    flex: none;
    margin: 0;
    font-family: var(--mc-font-display);
    font-weight: 400;
    font-size: var(--title-size);
    letter-spacing: 1px;
    line-height: 1.05;
    text-transform: uppercase;
    white-space: nowrap;
    color: inherit;
  }
  :host([italic]) .title {
    font-style: italic;
  }
  /* The title on one line at its own size, out of the layout: what the rule measures. */
  .sizer {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
  }
  /* A zero-width marker after the title: the Cancel glyph hangs from it, so it follows the title's last letter. */
  .after {
    position: relative;
    flex: none;
    width: 0;
    height: 18px;
  }
  .after mc-glyph-hint {
    left: 14px;
  }
  .eyebrow {
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.2px;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .subtitle {
    font-size: var(--mc-small-11);
    line-height: 1.2;
    opacity: 0.7;
  }
  /* Dropped: the title is whole on its own row under the tab, and wraps rather than being cut or shrunk. */
  :host([dropped]) .titles {
    order: 9;
    flex: 1 0 100%;
    padding: 0 0 8px;
  }
  :host([dropped]) .line {
    display: block;
  }
  :host([dropped]) .title {
    white-space: normal;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  :host([dropped]) .after {
    display: none;
  }
  .right {
    order: 2;
    margin-left: auto;
    flex: none;
    font-weight: 800;
    font-size: var(--mc-small-9);
    letter-spacing: 1.1px;
    text-transform: uppercase;
    color: var(--mc-text-paper);
    opacity: 0.5;
    white-space: nowrap;
  }
  /* The slotted control sits at the right end; with a caption before it, the caption keeps its own place. */
  .end {
    order: 3;
    margin-left: auto;
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .right + .end {
    margin-left: 0;
  }
`;
