/**
 * Which button does what under each hold layer (`docs/controller-support.md` decision 9). Data only, so the glyph model
 * and `view/pad-layers.ts` can both read it without importing each other.
 */

export type PadLayer = "lt" | "rt";

export type LayerActionId =
  | "attack"
  | "thwart"
  | "recover"
  | "changeForm"
  | "undo"
  | "endTurn"
  | "ability1"
  | "ability2"
  | "ability3"
  | "ability4"
  | "pagePrevious"
  | "pageNext";

/** The standard-layout index of each trigger, for the glyph that says which one to hold. */
export const LAYER_TRIGGER_INDEX: Readonly<Record<PadLayer, number>> = { lt: 6, rt: 7 };

/** Abilities shown per page: the four face buttons. */
export const ABILITIES_PER_PAGE = 4;

/** Face and bumper positions a layer binds, in the order the sheet lists them. */
export const LAYER_BUTTONS: Readonly<Record<PadLayer, readonly (readonly [number, LayerActionId])[]>> = {
  lt: [
    [0, "attack"],
    [2, "thwart"],
    [3, "recover"],
    [1, "changeForm"],
    [4, "undo"],
    [5, "endTurn"],
  ],
  rt: [
    [0, "ability1"],
    [2, "ability2"],
    [3, "ability3"],
    [1, "ability4"],
    [4, "pagePrevious"],
    [5, "pageNext"],
  ],
};

/** The action a button means while `layer` is held, from the press's standard-layout index (after the swap). */
export function layerActionOf(layer: PadLayer, meaningIndex: number): LayerActionId | null {
  return LAYER_BUTTONS[layer].find(([index]) => index === meaningIndex)?.[1] ?? null;
}

/** The ability's slot (0-3) an action is, or null when it is not an ability action. */
export function abilitySlotOf(action: LayerActionId): number | null {
  const slot = (["ability1", "ability2", "ability3", "ability4"] as const).indexOf(action as "ability1");
  return slot < 0 ? null : slot;
}

/** The layer and standard-layout index that do an action, or null for an action no layer has. */
export function layerBindingOf(action: LayerActionId): { readonly layer: PadLayer; readonly index: number } | null {
  for (const layer of ["lt", "rt"] as const) {
    const found = LAYER_BUTTONS[layer].find(([, id]) => id === action);
    if (found) return { layer, index: found[0] };
  }
  return null;
}

/**
 * A button held to pick a target outright (`view/pick-assign.ts`): the two triggers (the hold layers) and the two bumpers.
 * A bumper held this way does not also jump zones: its tap fires on release, and only when no face button was pressed
 * under it (`scenes/board/input.ts`).
 */
export type PickModifier = "rt" | "lt" | "rb" | "lb";

/** The bumpers a pick may hold. */
export type PickBumper = "rb" | "lb";

/** The standard-layout index of each pick modifier (LB 4, RB 5, LT 6, RT 7). */
export const PICK_MODIFIER_INDEX: Readonly<Record<PickModifier, number>> = { lb: 4, rb: 5, lt: 6, rt: 7 };

/** The bumper a standard-layout index is, or null. */
export function pickBumperOf(meaningIndex: number): PickBumper | null {
  return meaningIndex === 4 ? "lb" : meaningIndex === 5 ? "rb" : null;
}
