/**
 * Where Game Over's buttons go: the rematch actions (one to three of them: "Play again", "New random scenario",
 * "Same seed, same hands") and "Back to title". Both stacks hang from the bottom of the screen, so a button is never
 * off it, and say how far the content above them reaches into them (`overflow`) so the scene can give that room back
 * (the phone shrinks its art window by that much; the wide screen shortens its buttons to the touch floor first).
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export interface GameOverActionsLayout {
  /** One rect per rematch action, in the actions' own order. */
  readonly actions: readonly Rect[];
  readonly back: Rect;
  /** Where the one-line status text ("Couldn't find this campaign run") sits: just above the buttons (tall) or under the table panel (wide). */
  readonly status: { readonly x: number; readonly y: number };
  /** How far the content above reaches below the first button's top; 0 when everything fits. */
  readonly overflow: number;
}

const WIDE_GAP = 10;
const WIDE_TIGHT_GAP = 6;

export interface WideActionsInput {
  readonly sideX: number;
  readonly sideWidth: number;
  /** The bottom of the table panel above the buttons. */
  readonly tableBottom: number;
  readonly bodyBottom: number;
  readonly actions: number;
}

/** Desktop and tablet landscape: a column down the right side, the table panel above it. */
export function wideActionsLayout(input: WideActionsInput): GameOverActionsLayout {
  const { sideX, sideWidth, tableBottom, bodyBottom, actions } = input;
  const room = bodyBottom - (tableBottom + 14);
  const roomy = hit.primary * actions + hit.target + WIDE_GAP * actions;
  // Primary-height buttons while they fit; the touch floor and a tighter gap when they do not.
  const tight = roomy > room;
  const height = tight ? hit.target : hit.primary;
  const gap = tight ? WIDE_TIGHT_GAP : WIDE_GAP;
  const stack = (height + gap) * actions + hit.target;
  const top = bodyBottom - stack;
  const rects: Rect[] = [];
  let y = top;
  for (let i = 0; i < actions; i++) {
    rects.push({ x: sideX, y, width: sideWidth, height });
    y += height + gap;
  }
  return {
    actions: rects,
    back: { x: sideX, y, width: sideWidth, height: hit.target },
    status: { x: sideX, y: tableBottom + 4 },
    overflow: Math.max(0, tableBottom + 14 - top),
  };
}

export interface TallActionsInput {
  readonly pad: number;
  readonly column: number;
  readonly width: number;
  readonly height: number;
  /** The bottom of the content above the buttons, plus the room its status line needs. */
  readonly top: number;
  readonly actions: number;
}

const TALL_GAP = 7;
const TALL_BOTTOM = 20;

/** Phone and portrait tablet: the primary action full width, every other one (and Back to title) two to a row beneath it. */
export function tallActionsLayout(input: TallActionsInput): GameOverActionsLayout {
  const { pad, column, height, top, actions } = input;
  const quiet = Math.max(0, actions - 1) + 1;
  const rows = Math.ceil(quiet / 2);
  const hasPrimary = actions > 0;
  const stackHeight = (hasPrimary ? hit.primary + 8 : 0) + rows * hit.target + (rows - 1) * TALL_GAP;
  const startY = height - TALL_BOTTOM - stackHeight;
  const half = (column - TALL_GAP) / 2;
  const cell = (index: number): Rect => ({
    x: pad + (index % 2) * (half + TALL_GAP),
    y: startY + (hasPrimary ? hit.primary + 8 : 0) + Math.floor(index / 2) * (hit.target + TALL_GAP),
    width: half,
    height: hit.target,
  });
  const rects: Rect[] = [];
  if (actions > 0) rects.push({ x: pad, y: startY, width: column, height: hit.primary });
  for (let i = 0; i < actions - 1; i++) rects.push(cell(i));
  return {
    actions: rects,
    back: cell(Math.max(0, actions - 1)),
    status: { x: pad, y: startY - 18 },
    overflow: Math.max(0, top - startY),
  };
}
