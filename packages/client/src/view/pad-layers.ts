/**
 * The LT and RT hold layers (`docs/controller-support.md` decision 9): hold a trigger and the face buttons and
 * bumpers change meaning.
 *
 *  - Hold LT: A Attack, X Thwart, Y Recover, B Change form, LB Undo, RB End turn.
 *  - Hold RT: A / X / Y / B are the first four abilities usable right now on your cards in play, in table order;
 *    LB / RB page when there are more.
 *
 * Positions are the standard layout's (Xbox letters: 0 bottom, 1 right, 2 left, 3 top); PlayStation and Switch use the
 * same positions. A press arrives as a standard-layout index after the Nintendo swap (`view/pad-family.ts#physicalIndexOf`),
 * so `layerActionOf` takes that meaning index and `layerSheet` draws the glyph of the button that carries it.
 *
 * Pure data: the Board decides what is available and calls `layerSheet` to draw the sheet by the action bar.
 */

import { padGlyphSpec, type PadGlyphSpec } from "./input-glyph-model.js";
import {
  ABILITIES_PER_PAGE,
  LAYER_BUTTONS,
  LAYER_TRIGGER_INDEX,
  abilitySlotOf,
  type LayerActionId,
  type PadLayer,
} from "./pad-layer-bindings.js";
import type { PadFamily } from "./pad-family.js";

export {
  abilitySlotOf,
  layerActionOf,
  layerBindingOf,
  type LayerActionId,
  type PadLayer,
} from "./pad-layer-bindings.js";

const ACTION_LABELS: Readonly<Record<LayerActionId, string>> = {
  attack: "Attack",
  thwart: "Thwart",
  recover: "Recover",
  changeForm: "Change form",
  undo: "Undo",
  endTurn: "End turn",
  ability1: "Ability 1",
  ability2: "Ability 2",
  ability3: "Ability 3",
  ability4: "Ability 4",
  pagePrevious: "Previous abilities",
  pageNext: "More abilities",
};

/** What the Board knows right now, for the sheet. Anything left out reads as available. */
export interface LayerAvailability {
  /** The LT layer's actions the Board says are legal right now (`attack`, `undo`, …). Missing = enabled. */
  readonly enabled?: Partial<Record<LayerActionId, boolean>>;
  /** Names of the abilities usable right now on your cards in play, in table order. */
  readonly abilities?: readonly string[];
  /** Which page of four abilities is showing (0-based). */
  readonly abilityPage?: number;
}

export interface LayerRow {
  readonly action: LayerActionId;
  /** The button that does it, as this pad prints it. Null for a position the family has no glyph for. */
  readonly glyph: PadGlyphSpec | null;
  readonly label: string;
  readonly enabled: boolean;
}

export interface LayerSheet {
  readonly layer: PadLayer;
  /** The trigger to hold, as this pad prints it. */
  readonly trigger: PadGlyphSpec | null;
  readonly rows: readonly LayerRow[];
}

/** The ability names on `page`, padded with nothing: fewer than four on the last page. */
export function abilityPageOf(abilities: readonly string[], page: number): readonly string[] {
  return abilities.slice(page * ABILITIES_PER_PAGE, (page + 1) * ABILITIES_PER_PAGE);
}

/** The number of pages of abilities (at least one). */
export function abilityPageCount(abilities: readonly string[]): number {
  return Math.max(1, Math.ceil(abilities.length / ABILITIES_PER_PAGE));
}

export function layerSheet(
  layer: PadLayer,
  family: PadFamily,
  swap: boolean,
  availability: LayerAvailability = {},
): LayerSheet {
  const abilities = availability.abilities ?? [];
  const page = Math.min(Math.max(0, availability.abilityPage ?? 0), abilityPageCount(abilities) - 1);
  const rows = LAYER_BUTTONS[layer].map(([index, action]): LayerRow => {
    const glyph = padGlyphSpec(index, family, swap);
    if (layer === "lt") {
      return { action, glyph, label: ACTION_LABELS[action], enabled: availability.enabled?.[action] ?? true };
    }
    const slot = abilitySlotOf(action);
    if (slot !== null) {
      const name = abilityPageOf(abilities, page)[slot];
      return {
        action,
        glyph,
        // A legend (no ability list) just names the slot.
        label:
          name ?? (availability.abilities === undefined ? ACTION_LABELS[action] : `${ACTION_LABELS[action]} (none)`),
        // Without an ability list the sheet is a legend (the Controls screen): every slot reads as available.
        enabled: availability.abilities === undefined ? true : name !== undefined,
      };
    }
    const more = action === "pageNext" ? (page + 1) * ABILITIES_PER_PAGE < abilities.length : page > 0;
    return {
      action,
      glyph,
      label: ACTION_LABELS[action],
      enabled: availability.abilities === undefined ? true : more,
    };
  });
  return { layer, trigger: padGlyphSpec(LAYER_TRIGGER_INDEX[layer], family, false), rows };
}
