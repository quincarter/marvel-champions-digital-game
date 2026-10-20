import { trait } from "@mc/content";
import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  allOf,
  canTakeStatus,
  boost,
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
  ifThen,
  handCountOf,
  option,
  placeThreat,
  query,
  setVar,
  stun,
  theMainScheme,
  valueAtLeast,
  varOf,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

// RRG 1.8 "Choose (Option)" (p. 12) and the February 28, 2026 Spell Blast ruling (owner decision 2026-10-20, reversing
// Q8): an encounter card's option is barred only when it needs a target and has no valid one, and a target is valid only
// if the ability can affect it (RRG 1.8 "Target", p. 42). So Avoid and Disarm need a card in hand to discard (Disarm
// with fewer than 2 discards what it can and skips its "then"), Disarm needs a character that can take a tough card or
// an enemy, and Trip is offered to an identity that already holds the status (the damage can still be dealt). None of
// the card's targets says "choose", so the first player selects (RRG 1.8 "First Player", p. 19).

/** "A character you control" a tough status card can be given to. */
const TOUGH_TARGET: TargetQuery = query("character", { controller: "you", ...canTakeStatus("tough") });
const YOUR_CHARACTER: TargetQuery = query("character", { controller: "you" });
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
        { when: allOf(handHas({}), exists(TOUGH_TARGET)) },
        setVar("handBefore", handCountOf(you)),
        discardAtRandom(2),
        // "Then" (RRG 1.8 p. 44): only if both cards were discarded. Read from the hand as it was, because the engine's
        // pre-"then" check does not see a discard that found fewer cards than it asked for.
        ifThen(valueAtLeast(varOf("handBefore"), 2), [
          chooseTarget("armed", TOUGH_TARGET, { chooser: firstPlayer }),
          giveTough(chosen("armed")),
        ]),
      ),
      option("Trip: deal 2 damage to your identity and confuse it", dealDamage(2, yourIdentity), confuse(yourIdentity)),
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
        setVar("matching", handCountOf(you, IDENTITY_SPECIFIC)),
        discardFromHand(1, you, { filter: IDENTITY_SPECIFIC }),
        // "Then": only if a card was discarded (see Blinding Powder's Disarm).
        ifThen(valueAtLeast(varOf("matching"), 1), [
          chooseTarget("foe", query("enemy"), { chooser: firstPlayer }),
          dealDamage(2, chosen("foe")),
        ]),
      ),
      option("Trip: deal 2 damage to your identity and stun it", dealDamage(2, yourIdentity), stun(yourIdentity)),
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
