/**
 * What the key and button glyphs show right now, and how they open and close (`docs/controller-support.md`).
 *
 * Pure: `glyphsForShortcut` turns a shortcut id plus the input state and settings into drawable specs, and the
 * openness functions turn the mouse-moving state into a 0..1 animation value. `ui/input-glyph.ts` draws the specs.
 */

import type { Settings } from "../settings.js";
import { gamepadButtonFor } from "./gamepad.js";
import { glyphSetOf, type InputModeState } from "./input-mode.js";
import { shortcutCaps, shortcutOf, type KeyboardHand, type ShortcutId } from "./input-shortcuts.js";
import {
  LAYER_BUTTONS,
  LAYER_TRIGGER_INDEX,
  layerBindingOf,
  type LayerActionId,
  type PadLayer,
} from "./pad-layer-bindings.js";
import {
  faceColorOf,
  padGlyphOf,
  physicalIndexOf,
  resolvePadFamily,
  usesNintendoSwap,
  type GlyphShape,
  type PadFamily,
} from "./pad-family.js";

/** The PlayStation face symbols the fonts lack: drawn as shapes. */
export type FaceSymbol = "cross" | "circle" | "square" | "triangle";

export interface PadGlyphSpec {
  readonly kind: "pad";
  readonly label: string;
  readonly shape: GlyphShape;
  readonly symbol: FaceSymbol | null;
  readonly name: string;
  /** Xbox face letters only: the letter's color, drawn on an ink disc. */
  readonly color?: number;
}

export interface KeyGlyphSpec {
  readonly kind: "key";
  readonly label: string;
  readonly name: string;
}

export type GlyphSpec = PadGlyphSpec | KeyGlyphSpec;

export type GlyphSettings = Pick<Settings, "padGlyphFamily" | "nintendoLayout" | "inputGlyphs"> & {
  /** Which hand the keyboard glyphs show; the left when left out. */
  readonly keyboardHand?: KeyboardHand;
};

/** Shortcuts the pad does under a hold layer: drawn as the trigger plus the button ("LT" "A"). */
const LAYERED: Readonly<Partial<Record<ShortcutId, LayerActionId>>> = {
  attack: "attack",
  thwart: "thwart",
  recover: "recover",
  changeForm: "changeForm",
  undo: "undo",
  endTurn: "endTurn",
  ability1: "ability1",
  ability2: "ability2",
  ability3: "ability3",
  ability4: "ability4",
};

const SYMBOLS: Readonly<Record<string, FaceSymbol>> = { "✕": "cross", "○": "circle", "□": "square", "△": "triangle" };

/** The glyph of one standard-layout button as the player sees it on this pad (swap applied). */
export function padGlyphSpec(meaningIndex: number, family: PadFamily, swap: boolean): PadGlyphSpec | null {
  // The swap is its own inverse: the intent's bound index maps to the button that carries it.
  const glyph = padGlyphOf(family, physicalIndexOf(meaningIndex, swap));
  if (!glyph) return null;
  const symbol = glyph.shape === "face" ? (SYMBOLS[glyph.label] ?? null) : null;
  const color = glyph.shape === "face" ? faceColorOf(family, physicalIndexOf(meaningIndex, swap)) : null;
  return {
    kind: "pad",
    label: glyph.label,
    shape: glyph.shape,
    symbol,
    name: glyph.name,
    ...(color === null ? {} : { color }),
  };
}

/** The family and Nintendo swap this pad is drawn with (decision 2). */
function padLook(state: InputModeState, settings: GlyphSettings): { family: PadFamily; swap: boolean } {
  const family = resolvePadFamily(settings.padGlyphFamily, state.pad);
  return { family, swap: usesNintendoSwap(family, settings.nintendoLayout, state.pad) };
}

/** The trigger that opens a layer, as this pad prints it: the glyph that sits at rest by the action bar or play area. */
export function layerTriggerGlyph(
  layer: PadLayer,
  state: InputModeState,
  settings: GlyphSettings,
): PadGlyphSpec | null {
  const { family } = padLook(state, settings);
  return padGlyphSpec(LAYER_TRIGGER_INDEX[layer], family, false);
}

/** The button that does `action` under its layer, as this pad prints it (the glyph that moves onto a control). */
export function layerButtonGlyph(
  action: LayerActionId,
  state: InputModeState,
  settings: GlyphSettings,
): PadGlyphSpec | null {
  const binding = layerBindingOf(action);
  if (binding === null) return null;
  const { family, swap } = padLook(state, settings);
  return padGlyphSpec(binding.index, family, swap);
}

/** The `LAYER_BUTTONS` entry for a layer's slot (0-3) of abilities: which action id the Nth card ability is. */
export function abilityActionOfSlot(slot: number): LayerActionId | null {
  return LAYER_BUTTONS.rt.filter(([, action]) => action.startsWith("ability"))[slot]?.[1] ?? null;
}

/**
 * The glyphs for a shortcut right now, or null when none should be drawn (touch, setting off, no pad button).
 *
 * `layer` is the pad's hold layer (`view/pad-layers.ts`), null at rest. At rest a pad draws the base hints and none of
 * the layered actions (the triggers' own glyphs mark where the layers are); while a trigger is held the base hints
 * step aside and the layer's own buttons show alone, on whatever they now press. The keyboard ignores layers.
 */
export function glyphsForShortcut(
  id: ShortcutId,
  state: InputModeState,
  settings: GlyphSettings,
  layer: PadLayer | null = null,
): readonly GlyphSpec[] | null {
  const set = glyphSetOf(state, settings.inputGlyphs);
  if (set === null) return null;
  const shortcut = shortcutOf(id);
  if (set === "keyboard") {
    const caps = shortcutCaps(id, settings.keyboardHand ?? "left");
    return caps.map((key): GlyphSpec => ({ kind: "key", label: key, name: `${key} key` }));
  }
  const layered = LAYERED[id];
  if (layered !== undefined) {
    if (layer === null) return null;
    const binding = layerBindingOf(layered);
    if (binding === null || binding.layer !== layer) return null;
    const button = layerButtonGlyph(layered, state, settings);
    return button ? [button] : null;
  }
  // Under a held trigger every base hint steps aside.
  if (layer !== null) return null;
  if (id === "log") {
    // The log is a hold of View (a tap is the recap): "Hold" then the button.
    const view = padGlyphSpec(gamepadButtonFor("view") ?? 8, padLook(state, settings).family, false);
    return view ? [{ kind: "key", label: "Hold", name: "Hold" }, view] : null;
  }
  if (shortcut.padIntent === null) return null;
  const index = gamepadButtonFor(shortcut.padIntent);
  if (index === null) return null;
  const family = resolvePadFamily(settings.padGlyphFamily, state.pad);
  const spec = padGlyphSpec(index, family, usesNintendoSwap(family, settings.nintendoLayout, state.pad));
  return spec ? [spec] : null;
}

export const COLLAPSE_MS = 140;
export const EXPAND_MS = 180;

/** Openness 0 (a 6px tab) to 1 (full glyph) `elapsedMs` after the target changed, from `from`. Instant when reduced. */
export function glyphOpenness(expanded: boolean, elapsedMs: number, reducedMotion: boolean, from?: number): number {
  const to = expanded ? 1 : 0;
  if (reducedMotion) return to;
  const start = from ?? 1 - to;
  const t = Math.min(1, Math.max(0, elapsedMs / (expanded ? EXPAND_MS : COLLAPSE_MS)));
  const eased = 1 - (1 - t) * (1 - t);
  return start + (to - start) * eased;
}

/** Tracks the openness across retargets so a glyph reversing mid-animation starts from where it is. */
export class OpennessAnimator {
  private expanded = true;
  private from = 1;
  private since = 0;

  /** Sets the target at time `now`; a no-op when it is unchanged. */
  retarget(expanded: boolean, now: number, reducedMotion: boolean): void {
    if (expanded === this.expanded) return;
    this.from = this.value(now, reducedMotion);
    this.expanded = expanded;
    this.since = now;
  }

  value(now: number, reducedMotion: boolean): number {
    return glyphOpenness(this.expanded, now - this.since, reducedMotion, this.from);
  }

  /** True while the value is still moving, so a scene knows to keep redrawing. */
  animating(now: number, reducedMotion: boolean): boolean {
    return this.value(now, reducedMotion) !== (this.expanded ? 1 : 0);
  }
}
