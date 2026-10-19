import { trait } from "@mc/content";
import type { AbilityRegistry, TargetRef, ValueSpec } from "@mc/engine";
import {
  alterEgoAction,
  cards,
  chooseCards,
  chosen,
  constant,
  dealAsEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discardTopOfDeckCost,
  encounterCards,
  enemyActivates,
  enemyTeamChooses,
  gainsTrait,
  ifThen,
  isAlterEgo,
  isHero,
  moveCards,
  placeThreat,
  query,
  self,
  shuffleEncounterDeck,
  theMainScheme,
  topOfDeck,
  whenDefeated,
  whenRevealed,
  you,
  youHaveTrait,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

const HUNTED = trait("HUNTED");
/** "For each different card type discarded this way": the engine's `distinctCardTypes` over the milled cards. */
const distinctTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctCardTypes", cards: cardsRef });
/** "If you have the Hunted trait, [minion] activates against you. Otherwise, discard the top 2 cards of your deck." */
const huntedOrMill = () =>
  whenRevealed(
    ifThen(youHaveTrait(HUNTED), enemyActivates(self, { against: you }), moveCards(topOfDeck(2, you), "discard")),
  );

/**
 * Modular set `royal_guard` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 *
 * **Janus (57069), Amir (57070)**: When Revealed: a revealer with the Hunted trait (granted by Blood Debt) is attacked
 * or schemed against by the minion ("activates against you", read as the effect resolves, RRG 1.8 "Activation", p. 6);
 * otherwise they discard the top 2 cards of their deck (a shorter deck discards what it has, p. 33).
 *
 * **Atlanteans (57071)**: When Revealed: discard the top 3 cards, then by form: alter-ego, 1 threat on the main scheme
 * per different card type discarded; hero, 1 indirect damage to the revealer per different type (the revealer
 * divides it, RRG 1.8 "Indirect Damage").
 *
 * **Blood Debt (57072)**: an obligation, so its "you" is the player whose play area holds it (RRG 1.8 "Obligation",
 * p. 30). The constant gives that player the Hunted trait; the Alter-Ego Action pays 8 cards from the deck top and
 * discards the obligation to the encounter discard pile. It has no When Revealed of its own.
 *
 * **The Royal Guard (57073)**: Hinder 1[per_hero] is a data keyword. When Defeated: the enemy team (the first player in
 * a marked prompt) searches the encounter deck and discard pile for a copy of Blood Debt and deals it facedown to the
 * player who defeated the scheme (nobody, if no player did); the deck is shuffled afterwards (RRG 1.8 "Search", p. 39).
 * No copy found: nothing is dealt.
 *
 * Cards (5):
 * - 57069 Janus (minion)
 * - 57070 Amir (minion)
 * - 57071 Atlanteans (treachery)
 * - 57072 Blood Debt (obligation)
 * - 57073 The Royal Guard (side_scheme)
 */
export const SYNTHEZOID_MODULAR_ROYAL_GUARD: AbilityRegistry = defineAbilities({
  "57069.when-revealed": huntedOrMill(),
  "57070.when-revealed": huntedOrMill(),

  "57071.when-revealed": whenRevealed(
    moveCards(topOfDeck(3, you), "discard", "milled"),
    ifThen(isAlterEgo(), placeThreat(distinctTypesOf(chosen("milled")), theMainScheme)),
    ifThen(isHero(), dealIndirectDamage(you, distinctTypesOf(chosen("milled")))),
  ),

  "57072.blood-debt-constant": constant(gainsTrait(HUNTED, YOUR_IDENTITY)),
  "57072.blood-debt-action": alterEgoAction({ cost: discardTopOfDeckCost(8) }, moveCards(cards(self), "discard")),

  "57073.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], query("obligation", { name: "Blood Debt" })), {
      min: 1,
      max: 1,
      chooser: enemyTeamChooses,
    }),
    dealAsEncounterCard(chosen("found"), defeatingPlayer),
    shuffleEncounterDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_ROYAL_GUARD_SKIPPED: Readonly<Record<string, string>> = {};
