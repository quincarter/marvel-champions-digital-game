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
    --fill: var(--mc-fill-paper);
    --ink: var(--mc-text-ink);
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
  }
  /* Bangers labels: the back button, a call to action. */
  :host([display]) .label {
    font-family: var(--mc-font-display);
    font-weight: 400;
    letter-spacing: 2px;
  }

  :host([kind="secondary"]:hover:not([disabled])),
  :host([kind="secondary"][selected]) {
    --fill: var(--mc-fill-ink);
    --ink: var(--mc-text-paper);
  }

  :host([kind="quiet"]) {
    --stroke: 2px;
    --ink-alpha: 0.75;
  }
  :host([kind="quiet"]:hover:not([disabled])) {
    --fill: var(--mc-fill-parchment);
    --ink-alpha: 1;
  }

  :host([kind="primary"]) {
    --stroke: 3px;
    --fill: var(--mc-fill-red);
    --ink: var(--mc-text-paper);
    --line: var(--mc-line-red);
  }
  :host([kind="primary"]:hover:not([disabled])) {
    --fill: var(--mc-fill-red-deep);
    --line: var(--mc-line-red-deep);
  }

  :host([kind="onInk"]) {
    --fill: var(--mc-fill-ink);
    --ink: var(--mc-text-paper);
    --line: var(--mc-line-paper);
  }
  :host([kind="onInk"]:hover:not([disabled])),
  :host([kind="onInk"][selected]) {
    --fill: var(--mc-fill-red);
    --line: var(--mc-line-red);
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
  :host([kind="quiet"][disabled]) button {
    outline-style: dashed;
  }
  /* A switch that is on carries a second, paper frame inside its border (paintOnFrame in the client). */
  :host([framed]) button {
    box-shadow:
      inset 0 0 0 1.5px var(--fill),
      inset 0 0 0 4.5px var(--mc-line-paper);
  }
`;
