import { css } from "lit";

/**
 * The client's widget state matrix (`ui/theme.ts`'s `skin`): rest, hover, selected and unavailable for each kind.
 * Phaser strokes a control's border centered on its edge; an outline offset by half its width does the same.
 * "Dim, don't hide": an unavailable control stays in place at 40% ink, dashed when quiet.
 */
export const McButtonStyles = css`
  :host {
    display: block;
    --stroke: 2.5px;
    /* A screen may tint a resting button (an aspect chip in its printed frame color); chosen and hover look as ever. */
    --fill: var(--mc-tint-fill, var(--mc-fill-paper));
    --ink: var(--mc-tint-ink, var(--mc-text-ink));
    --line: var(--mc-line-ink);
    --ink-alpha: 1;
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0 6px;
    background: var(--fill);
    outline: var(--stroke) solid var(--line);
    outline-offset: calc(var(--stroke) / -2);
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .label {
    color: var(--ink);
    opacity: var(--ink-alpha);
    font-family: var(--mc-font-body);
    font-weight: 800;
    font-size: var(--mc-button-size, var(--mc-small-9, 9px));
    letter-spacing: 1.2px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* A glyph beside the word slides it over (the sheet sets the shift; it eases like the glyph does). */
    transform: translateX(var(--mc-label-shift, 0px));
    transition: transform var(--mc-label-ms, 180ms) cubic-bezier(0.5, 1, 0.89, 1);
  }
  :host([still]) .label {
    transition: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .label {
      transition: none;
    }
  }
  /* Bangers labels: the back button, a call to action. */
  :host([display]) .label {
    font-family: var(--mc-font-display);
    font-weight: 400;
    letter-spacing: 2px;
  }

  /* A row title (the client's rowTitle type): its own case, no tracking. */
  :host([plain]) .label {
    text-transform: none;
    letter-spacing: 0;
  }

  /* A label that wraps onto a second line (a built game's name on the Continue row). */
  :host([wrap]) .label {
    white-space: normal;
    text-align: center;
    line-height: 1.2;
    text-overflow: clip;
  }
  /*
   * A row button (a call to action with a second line, the Saga's and the Cover's): the title at the left over the
   * subtitle, a chevron at the right. The text takes the button's own ink, so it follows hover and unavailable.
   */
  :host([row]) button {
    justify-content: flex-start;
    gap: 8px;
    padding: 0 14px 0 16px;
  }
  .text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1 1 auto;
    min-width: 0;
  }
  :host([row]) .label {
    margin-left: 0;
    transform: none;
    max-width: 100%;
  }
  .sub {
    color: var(--ink);
    opacity: calc(var(--ink-alpha) * 0.75);
    font-family: var(--mc-font-body);
    font-weight: 700;
    font-size: 12px;
    line-height: 1.4;
    margin-top: 2px;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :host([subtitle-label]) .sub {
    font-weight: 800;
    font-size: var(--mc-small-9, 9px);
    letter-spacing: 1px;
    text-transform: uppercase;
    opacity: calc(var(--ink-alpha) * 0.5);
  }
  .chevron {
    flex: 0 0 auto;
    color: var(--ink);
    opacity: var(--ink-alpha);
    font-family: var(--mc-font-display);
    font-size: 20px;
    line-height: 1;
  }
  /* Room kept clear at the left edge (an icon beside the label): the label centres in what is left. */
  .label {
    margin-left: var(--mc-label-inset, 0px);
  }

  :host([kind="secondary"][selected]) {
    --fill: var(--mc-fill-ink);
    --ink: var(--mc-text-paper);
  }

  :host([kind="quiet"]) {
    --stroke: 2px;
    --ink-alpha: 0.75;
  }

  :host([kind="primary"]) {
    --stroke: 3px;
    --fill: var(--mc-fill-red);
    --ink: var(--mc-text-paper);
    --line: var(--mc-line-red);
  }

  :host([kind="onInk"]) {
    --fill: var(--mc-fill-ink);
    --ink: var(--mc-text-paper);
    --line: var(--mc-line-paper);
  }
  :host([kind="onInk"][selected]) {
    --fill: var(--mc-fill-red);
    --line: var(--mc-line-red);
  }

  /* A tab cell in a recessed rail: parchment at rest, the active tab an ink fill (never an underline). */
  :host([kind="rail"]) {
    --stroke: 2px;
    --fill: var(--mc-fill-parchment);
    --ink-alpha: 0.6;
  }
  :host([kind="rail"][selected]) {
    --fill: var(--mc-fill-ink);
    --ink: var(--mc-text-paper);
    --ink-alpha: 1;
  }

  /* A chip: as wide as its word, with room each side. */
  :host([hug]) button {
    padding: 0 14px;
  }
  :host([hug]) .label {
    overflow: visible;
    text-overflow: clip;
  }

  :host([disabled]) {
    --ink-alpha: 0.4;
  }
  :host([disabled]) button {
    cursor: default;
  }
  :host([kind="primary"][disabled]) {
    --fill: var(--mc-fill-paper);
    --ink: var(--mc-text-ink);
    --line: var(--mc-line-ink);
  }
  :host([kind="onInk"][disabled]) {
    --fill: var(--mc-fill-ink);
    --line: var(--mc-line-paper);
  }
  :host([kind="quiet"][disabled]) button,
  :host([kind="rail"][disabled]) button {
    outline-style: dashed;
  }
  /* A switch that is on carries a second, paper frame inside its border (paintOnFrame in the client). */
  :host([framed]) button {
    box-shadow:
      inset 0 0 0 1.5px var(--fill),
      inset 0 0 0 4.5px var(--mc-line-paper);
  }

  /* Hover only where there is one: on a phone a tapped button would keep its hover look after the tap. */
  @media (hover: hover) {
    :host([kind="secondary"]:hover:not([disabled])) {
      --fill: var(--mc-fill-ink);
      --ink: var(--mc-text-paper);
    }
    :host([kind="quiet"]:hover:not([disabled])) {
      --fill: var(--mc-fill-parchment);
      --ink-alpha: 1;
    }
    :host([kind="primary"]:hover:not([disabled])) {
      --fill: var(--mc-fill-red-deep);
      --line: var(--mc-line-red-deep);
    }
    :host([kind="onInk"]:hover:not([disabled])) {
      --fill: var(--mc-fill-red);
      --line: var(--mc-line-red);
    }
  }
`;
