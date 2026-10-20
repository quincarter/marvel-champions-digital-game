import { trait } from "@mc/content";
import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  allOf,
  andThen,
  boost,
  canTakeStatus,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  countOf,
  dealDamage,
  defineAbilities,
  discardAtRandom,
  discardFromHand,
  each,
  exists,
  firstPlayer,
  giveTough,
  handCountOf,
  option,
  placeThreat,
  query,
  stun,
  theMainScheme,
  valueAtLeast,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

// A chosen option is carried out in full or is not offered (docs/phase7-wave7.md section 4.1 Q8 = A), so each option
// carries the check for what it needs. None of the card's targets says "choose", so the first player selects
// (RRG 1.8 "First Player", p. 19).

/** "A character you control" a tough status card can be given to. */
const TOUGH_TARGET: TargetQuery = query("character", { controller: "you", ...canTakeStatus("tough") });
const YOUR_CHARACTER: TargetQuery = query("character", { controller: "you" });
const identityCan = (status: "confused" | "stunned"): TargetQuery =>
  query("identity", { controller: "you", ...canTakeStatus(status) });
const handHas = (filter: TargetQuery, n = 1) => valueAtLeast(handCountOf(you, filter), n);
const THWART_EVENT = query("event", { trait: trait("THWART") });
const DEFENSE_EVENT = query("event", { trait: trait("DEFENSE") });
const IDENTITY_SPECIFIC: TargetQuery = { classification: "identitySpecific" };

/**
 * Deadly Contraptions (Shadowland, MC65 pp. 12-13; docs/phase7-shadowland.md section 6 M3). The TRAP! cards are
 * revealed from the trap deck (see the Shadow Labyrinth module); a TRAP! card's discard routing is the engine's.
 *
 * **Blinding Powder (65050)**, **Caltrops (65051)**: When Revealed: choose Avoid, Disarm or Trip. Disarm's second
 * part is a "then" (RRG 1.8 "'Then'", p. 44).
 *
 * **Hall of Punishment (65048)**, **Path of a Thousand Cuts (65049)**: the boosts only. The Forced Interrupts on
 * "choose the Trip / Avoid effect", Nervous Jitters and Iron Monk need an engine trigger for an option choice, see
 * the skip reasons.
 *
 * Cards (65046 and 65047, and the two side schemes' Forced Interrupts, wait in the skip list):
 * - 65046 Nervous Jitters (skipped)
 * - 65047 Iron Monk (skipped)
 * - 65048 Hall of Punishment (side_scheme) boost
 * - 65049 Path of a Thousand Cuts (side_scheme) boost
 * - 65050 Blinding Powder (treachery)
 * - 65051 Caltrops (treachery)
 */
export const SHADOWLAND_DEADLY_CONTRAPTIONS: AbilityRegistry = defineAbilities({
  "65048.boost": boost(placeThreat(countOf(YOUR_CHARACTER), theMainScheme)),
  "65049.boost": boost(dealDamage(1, each(YOUR_CHARACTER))),

  "65050.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard a Thwart event from your hand",
        { when: handHas(THWART_EVENT) },
        discardFromHand(1, you, { filter: THWART_EVENT }),
      ),
      option(
        "Disarm: discard 2 cards at random from your hand, then give a character you control a tough status card",
        { when: allOf(handHas({}, 2), exists(TOUGH_TARGET)) },
        discardAtRandom(2),
        andThen(chooseTarget("armed", TOUGH_TARGET, { chooser: firstPlayer }), giveTough(chosen("armed"))),
      ),
      option(
        "Trip: deal 2 damage to your identity and confuse it",
        { when: exists(identityCan("confused")) },
        dealDamage(2, yourIdentity),
        confuse(yourIdentity),
      ),
    ),
  ),

  "65051.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard a Defense event from your hand",
        { when: handHas(DEFENSE_EVENT) },
        discardFromHand(1, you, { filter: DEFENSE_EVENT }),
      ),
      option(
        "Disarm: discard 1 identity-specific card from your hand, then deal 2 damage to an enemy",
        { when: allOf(handHas(IDENTITY_SPECIFIC), exists(query("enemy"))) },
        discardFromHand(1, you, { filter: IDENTITY_SPECIFIC }),
        andThen(chooseTarget("foe", query("enemy"), { chooser: firstPlayer }), dealDamage(2, chosen("foe"))),
      ),
      option(
        "Trip: deal 2 damage to your identity and stun it",
        { when: exists(identityCan("stunned")) },
        dealDamage(2, yourIdentity),
        stun(yourIdentity),
      ),
    ),
  ),
});

const NEEDS_CHOICE_TRIGGER =
  "Needs an engine trigger for 'when you choose the X effect of a Trap! card': chooseOne logs optionChosen but opens no interrupt window, and the DSL has no pattern for it";

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED: Readonly<Record<string, string>> = {
  "65046.nervous-jitters-forced-interrupt": NEEDS_CHOICE_TRIGGER,
  "65047.iron-monk-constant":
    "Needs an engine rule making one option of a chooseOne unavailable ('cannot choose the Avoid effect') while this minion is engaged with the player",
  "65048.hall-of-punishment-forced-interrupt": NEEDS_CHOICE_TRIGGER,
  "65049.path-of-a-thousand-cuts-forced-interrupt": NEEDS_CHOICE_TRIGGER,
};
