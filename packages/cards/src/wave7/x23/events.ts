import type { AbilityRegistry } from "@mc/engine";
import {
  applyRuleUntil,
  cancelWhenRevealed,
  constant,
  defineAbilities,
  divide,
  eventTarget,
  giveTough,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  inPlay,
  modifyBasicPower,
  modifyStat,
  on,
  playOnlyIf,
  query,
  refMatches,
  setVar,
  statOf,
  stun,
  valueAtLeast,
  varOf,
  victoryDisplayCount,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";
import { ANT_PACK_CARDS } from "../../wave2/ant/pack-cards.js";

/** "Play only if there is a side scheme in the victory display" (Mission Planning 40017 is the precedent). */
const SIDE_SCHEME_IN_VICTORY_DISPLAY = playOnlyIf(valueAtLeast(victoryDisplayCount(query("sideScheme")), 1));

/**
 * X-23 events (43004-43007) and the pack's other events (43016, 43017, 43038, 43040): docs/phase7-wave7.md §7.3.
 *
 * - **Animal Instinct (43004)**: Hero Interrupt to her basic thwart; +X THW for this thwart, X her ATK (read as the
 *   bonus is added, so it includes ATK modifiers already in play).
 * - **Claw Mastery (43005)**: Max 1 per round is data. +2 ATK until the end of the round, and a lasting rule that her
 *   attacks gain overkill while Honey Badger is in play (the condition is read at each attack, not when the event is
 *   played).
 * - **Regenerative Longevity (43006)**: the divided heal over her identity and Honey Badger.
 * - **Sisterly Bond (43007)**: NOT SCRIPTED. "Add X-23's matching power to Honey Badger's power for this use" needs
 *   the amount to follow whether the basic power being used is a thwart or an attack, and the DSL has no value or
 *   predicate that reads the power on the `basicPowerUsing` event (`modifyBasicPower` reads it, an amount cannot).
 *   Two `modifyStat` ... `nextBasic` would leave the unused one waiting for a later power. See coverage.test.ts.
 * - **Critical Hit (43016), Predictable Ploy (43038), Anticipated Attack (43040)**: the play restriction is the
 *   `*-constant` ref; the Hero Interrupt or Response is the other. Anticipated Attack's text has no "against you":
 *   any enemy's attack lets her give her hero a tough status card.
 * - **Moment of Triumph (43017)**: a verbatim reprint of 12030, aliased.
 */
export const X23_EVENTS: AbilityRegistry = defineAbilities({
  "43004.animal-instinct-interrupt": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY, { power: "thwart" }),
    // X is read once, now: a live `statOf` inside the lasting bonus would read the stat it modifies (a stack overflow).
    setVar("x", statOf(yourIdentity, "atk")),
    modifyBasicPower(varOf("x")),
  ),

  "43005.claw-mastery-action": heroAction(
    modifyStat("atk", 2, yourIdentity, "endOfRound"),
    applyRuleUntil(
      {
        kind: "attackKeywords",
        keywords: ["overkill"],
        attacker: YOUR_IDENTITY,
        while: inPlay("Honey Badger"),
      },
      "endOfRound",
    ),
  ),

  "43006.regenerative-longevity-action": heroAction(
    divide("heal", 4, {
      anyOf: [YOUR_IDENTITY, query("ally", { name: "Honey Badger" })],
    }),
  ),

  "43016.critical-hit-constant": constant(SIDE_SCHEME_IN_VICTORY_DISPLAY),
  "43016.critical-hit-response": heroResponse(
    on.attacks(YOUR_IDENTITY),
    // An attack that defeated its target leaves nothing to stun.
    ifThen(refMatches(eventTarget, query("enemy")), stun(eventTarget)),
  ),

  "43017.moment-of-triumph-response": ANT_PACK_CARDS["12030.moment-of-triumph-response"]!,

  "43038.predictable-ploy-constant": constant(SIDE_SCHEME_IN_VICTORY_DISPLAY),
  "43038.predictable-ploy-interrupt": heroInterrupt(on.encounterCardRevealed(query("treachery")), cancelWhenRevealed()),

  "43040.anticipated-attack-constant": constant(SIDE_SCHEME_IN_VICTORY_DISPLAY),
  "43040.anticipated-attack-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { label: "defense" },
    giveTough(yourIdentity),
  ),
});
