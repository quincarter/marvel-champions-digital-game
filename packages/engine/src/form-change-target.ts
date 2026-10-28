/**
 * Where a "change form" instruction takes one player (`EffectSpec changeForm`), and whether it takes them anywhere
 * (`Predicate canChangeForm`). Shared by the effect, which makes the change, and the predicate, which gates an option
 * or an ability on the change being possible ("if able"; RRG 1.8 "Choose (Option)", p. 12).
 */
import type { EngineDeps } from "./abilities.js";
import type { PlayerId } from "./ids.js";
import { cardOf, getPlayer, heroFacesOf } from "./query.js";
import { cannotChangeForm } from "./rules.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

/** The parts of a `changeForm` effect that say where it goes. */
export type FormChangeAim = Pick<Extract<EffectSpec, { kind: "changeForm" }>, "to" | "heroForm">;

/**
 * Where a `changeForm` effect takes one player: a form and hero face, `null` for no change (already there, can't change,
 * or "your other hero form" with none to go to), or `"choose"` when the player must pick among several faces.
 */
export function changeFormTarget(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  effect: FormChangeAim,
): { readonly to: "hero" | "alterEgo"; readonly heroForm: number } | "choose" | null {
  const player = getPlayer(state, playerId);
  if (!player || player.eliminated || cannotChangeForm(state, deps, playerId)) return null;
  const card = cardOf(state, player.identity.instanceId);
  const faces = card?.type === "hero_identity" ? heroFacesOf(card) : [];
  const { form, heroFormIndex } = player.identity;
  const unchanged = (to: "hero" | "alterEgo", heroForm: number) =>
    form === to && (to === "alterEgo" || heroFormIndex === heroForm) ? null : { to, heroForm };
  if (effect.heroForm === "other") {
    if (form !== "hero" || faces.length !== 2) return null;
    return unchanged("hero", heroFormIndex === 0 ? 1 : 0);
  }
  if (effect.heroForm !== undefined) {
    // A title names one face (RRG 1.8 "Identity", p. 23): the printed title of a hero face, whichever face is showing.
    const wanted = effect.heroForm;
    const index = faces.findIndex((face) =>
      "named" in wanted ? face.faceName === wanted.named : face.traits.includes(wanted.withTrait),
    );
    return index < 0 ? null : unchanged("hero", index);
  }
  if (effect.to === "alterEgo") return unchanged("alterEgo", 0);
  if (form === "alterEgo") return faces.length > 1 ? "choose" : unchanged("hero", 0);
  // In hero form, "change to hero form" goes to another hero face when the identity has one, and changes nothing
  // otherwise: a Tiny Ant-Man told to change to hero form must change to Giant (FFG ruling June 17, 2025);
  // offered the change by Bodyslide, he may (FFG ruling June 8, 2023, #22). RRG 1.8 "Form, Change Form" (p. 21) is
  // silent on two hero faces. Engine interpretation: from a hero form with several other hero faces, the player
  // chooses which (the rulings name only two-faced Ant-Man).
  if (effect.to === "hero") {
    if (faces.length === 2) return unchanged("hero", heroFormIndex === 0 ? 1 : 0);
    return faces.length > 2 ? "choose" : null;
  }
  // A bare "change form" goes to the alter-ego face, unless the identity has another hero face to go to as well
  // (docs/phase7-wave7.md §3.62).
  return faces.length > 1 ? "choose" : unchanged("alterEgo", 0);
}
