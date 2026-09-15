import { after, boost, boostIconsOn, cards, chosen, defineAbilities, forcedResponse, ifThen, putIntoPlay, query, selectCards, surge, varAtLeast, whenRevealed, you } from "../../dsl/index.js";
import { dealIndirectDamage, discardEncounterCards } from "./local.js";

/**
 * Power Drain modular set: Power Drain (02041, side scheme), Electro (02042, minion), Electromagnetic Pulse
 * (02043, treachery), Lightning Bolt (02044, treachery), Shock Therapy (02045, treachery).
 */
export const POWER_DRAIN = defineAbilities({
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

  // Lightning Bolt — [star] Boost: Discard 3 cards from the encounter deck (no icon-sum needed; scriptable on its own).
  "02044.boost": boost(discardEncounterCards(3)),

  // Shock Therapy — [star] Boost: Discard 3 cards from the encounter deck (same shape, scriptable on its own).
  "02045.boost": boost(discardEncounterCards(3)),
});

/**
 * Recorded skips — all three share the same gap: `ValueSpec.boostIcons` only reads the *first* card a ref names
 * (`packages/engine/src/select.ts`, `case "boostIcons"`: `const [id] = resolveRef(...)`), with no sum over several
 * bound cards. Each of these needs "N indirect damage / 1 resource discarded / N damage healed for each boost icon
 * discarded this way" across *more than one* discarded card:
 * - `02041.when-defeated` (Power Drain): discards 2 cards, one resource discard per boost icon among both.
 * - `02044.when-revealed` (Lightning Bolt): discards 2 cards, indirect damage per boost icon among both.
 * - `02045.when-revealed` (Shock Therapy): discards 1[per_hero] cards (>1 with 2+ heroes), heals per boost icon.
 */
export const POWER_DRAIN_SKIPPED = ["02041.when-defeated", "02044.when-revealed", "02045.when-revealed"] as const;
