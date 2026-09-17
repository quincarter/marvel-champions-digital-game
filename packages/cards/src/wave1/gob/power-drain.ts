import {
  ANY_RESOURCE,
  after,
  boost,
  boostIconsOn,
  cards,
  chosen,
  defineAbilities,
  discardFromHand,
  eachPlayer,
  forcedResponse,
  heal,
  ifThen,
  perHero,
  putIntoPlay,
  query,
  selectCards,
  surge,
  theVillain,
  varAtLeast,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { dealIndirectDamage, discardEncounterCards } from "./local.js";

/**
 * Power Drain modular set: Power Drain (02041, side scheme), Electro (02042, minion), Electromagnetic Pulse
 * (02043, treachery), Lightning Bolt (02044, treachery), Shock Therapy (02045, treachery).
 */
export const POWER_DRAIN = defineAbilities({
  // Power Drain — When Defeated: Discard 2 cards from the encounter deck. Each player must choose and discard 1
  // resource of any type from their hand for each boost icon discarded this way. `discardFromHand`'s `filter`
  // (wave B primitives batch, docs/phase7-wave1-scripting.md §6) now walks every player `eachPlayer` names, one
  // choice at a time in player order, so no `forEachPlayer` wrapper is needed here. "A resource of any type" is a
  // card with a printed resource icon of any of the four types RRG 1.8 "Resource" (p. 37) lists — `ANY_RESOURCE`
  // — not a card of the `resource` *type*: ruling, Jan 11, 2026 (3), "the discarded card must have a resource icon
  // printed in its bottom-left corner", the same reading Tombstone (02047) uses.
  "02041.when-defeated": whenDefeated(
    discardEncounterCards(2, { bind: "pd" }),
    discardFromHand(varOf("pd.boostIcons"), eachPlayer, { filter: ANY_RESOURCE }),
  ),

  // Electro — [star] Forced Response: After Electro attacks you, discard 1 card from the encounter deck. Take 1
  // indirect damage for each boost icon discarded this way (exactly 1 card, so no sum is needed).
  "02042.electro-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    discardEncounterCards(1, { bind: "el" }),
    dealIndirectDamage(boostIconsOn(chosen("el")), you),
  ),
  // [star] Boost: Discard 3 cards from the encounter deck.
  "02042.boost": boost(discardEncounterCards(3)),

  // Electromagnetic Pulse — When Revealed: Discard 7 cards from the encounter deck. If Electro was discarded this
  // way, put him into play engaged with you. If Electro was not discarded this way, this card gains surge.
  "02043.when-revealed": whenRevealed(
    discardEncounterCards(7, { bind: "emp" }),
    selectCards("empElectro", cards(chosen("emp"), query(["minion"], { name: "Electro" }))),
    ifThen(varAtLeast("empElectro.count"), putIntoPlay(chosen("empElectro"), you), surge()),
  ),
  "02043.boost": boost(discardEncounterCards(3)),

  // Lightning Bolt — When Revealed: Discard 2 cards from the encounter deck. Take 1 indirect damage for each boost
  // icon discarded this way. `discardEncounterCards`'s own `<bind>.boostIcons` (wave B primitives batch,
  // docs/phase7-wave1-scripting.md §6) sums icons across all 2 discarded cards, unlike `boostIconsOn`, which only
  // ever reads the first.
  "02044.when-revealed": whenRevealed(discardEncounterCards(2, { bind: "lb" }), dealIndirectDamage(varOf("lb.boostIcons"), you)),
  // [star] Boost: Discard 3 cards from the encounter deck (no icon-sum needed; scriptable on its own).
  "02044.boost": boost(discardEncounterCards(3)),

  // Shock Therapy — When Revealed: Discard 1[per_hero] cards from the encounter deck. The villain heals 1 damage
  // for each boost icon discarded this way.
  "02045.when-revealed": whenRevealed(discardEncounterCards(perHero(1), { bind: "st" }), heal(varOf("st.boostIcons"), theVillain)),
  // [star] Boost: Discard 3 cards from the encounter deck (same shape, scriptable on its own).
  "02045.boost": boost(discardEncounterCards(3)),
});

/**
 * `02044.when-revealed` (Lightning Bolt) and `02045.when-revealed` (Shock Therapy) were skips for the same gap —
 * `ValueSpec.boostIcons` only reads the *first* card a ref names (`packages/engine/src/select.ts`, `case
 * "boostIcons"`: `const [id] = resolveRef(...)`), with no sum over several bound cards — until the wave B
 * primitives batch landed `discardEncounterCards`'s own summed `<bind>.boostIcons` (docs/phase7-wave1-scripting.md
 * §6), scripted directly on the same `EffectSpec` case these two already (correctly) use rather than `moveCards`'s
 * version of the same bookkeeping (`moveCards` over an `encounterCards(["deck"], …, top: N)` selector snapshots the
 * top N once, up front, and so lacks the reshuffle-then-stop rule RRG 1.8 "Encounter Deck" (p. 17) requires for a
 * discard that empties the deck mid-effect — the exact behavior "Electro" (02042) and "Electromagnetic Pulse"
 * (02043) above depend on, so swapping onto `moveCards` for the sum would have been a real behavior change, not an
 * equivalent rephrasing). Both are scripted above now.
 *
 * **`02041.when-defeated` (Power Drain)** was the pack's last skip in this module until `discardFromHand`'s own
 * `filter` and its per-player walk (wave B primitives batch, docs/phase7-wave1-scripting.md §6) landed 2026-09-17;
 * scripted above.
 */
