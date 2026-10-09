import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  after,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  each,
  enemyActivates,
  exhaust,
  exists,
  find,
  forcedResponse,
  gets,
  giveTough,
  ifThen,
  modifyAttack,
  named,
  not,
  query,
  refMatches,
  remainingHpOf,
  revealCard,
  statOf,
  superlative,
  surge,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../dsl/index.js";

const AERIAL = trait("AERIAL");
const MOONSTONE = "Moonstone";
const ALLY_OR_SUPPORT_YOU_CONTROL = query(["ally", "support"], { controller: "you" });

/**
 * Modular encounter set `gravitational_pull` (Agents of S.H.I.E.L.D., a Thunderbolt set; docs/phase7-wave9.md section
 * 3.35). Villainous and Victory 1 are data keywords.
 *
 * **Moonstone (50139)**: Forced Response after she activates (an attack or a scheme, from the villain phase or from a
 * card): she gets a tough status card.
 *
 * **Rule the Skies (50140)**: the constant is +1 ATK to every Aerial character (heroes and allies included). The Boost
 * is `modifyAttack({ extraBoostCards: 1 })`, "for this activation" (the validator refuses `giveBoostCard` inside a
 * Boost); it applies to a scheme activation as well as an attack, and only when the activating enemy is Aerial.
 *
 * **Gravitational Pull (50141)**: `revealCard(find(Moonstone))` reveals her from the encounter deck or discard pile and
 * engages the revealing player when she is already in play. She then activates against the revealing player (an attack
 * on a hero, a scheme against an alter-ego); when she did not activate (not found, or she cannot activate), this card
 * gains surge. The Boost exhausts a character the player (the one the activation is against) controls.
 *
 * **Psychological Manipulation (50142)**: Alter-Ego: discard a chosen ally or support the player controls, otherwise
 * surge. Hero: X damage, X the revealing player's hero's current ATK, to the friendly character (any player's identity
 * or ally) with the fewest remaining hit points; a tie is the revealing player's pick.
 *
 * Cards (4):
 * - 50139 Moonstone (minion)
 * - 50140 Rule the Skies (side_scheme)
 * - 50141 Gravitational Pull (treachery)
 * - 50142 Psychological Manipulation (treachery)
 */
export const GRAVITATIONAL_PULL: AbilityRegistry = defineAbilities({
  "50139.moonstone-forced-response": forcedResponse(after.enemyActivates("self"), giveTough(named(MOONSTONE))),

  "50140.rule-the-skies-constant": constant(gets("atk", 1, query("character", { trait: AERIAL }))),
  "50140.boost": boost(ifThen(refMatches(activatingEnemy, { trait: AERIAL }), modifyAttack({ extraBoostCards: 1 }))),

  "50141.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: MOONSTONE })), you),
    enemyActivates(named(MOONSTONE), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "50141.boost": boost(
    chooseTarget("character", query("character", { controller: "you" })),
    exhaust(chosen("character")),
  ),

  "50142.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(
      exists(ALLY_OR_SUPPORT_YOU_CONTROL),
      [chooseTarget("card", ALLY_OR_SUPPORT_YOU_CONTROL), discard(chosen("card"))],
      surge(),
    ),
  ),
  "50142.when-revealed-hero": whenRevealedHero(
    bindTargets("fewest", superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate")))),
    chooseTarget("target", { inSlot: "fewest" }),
    dealDamage(statOf(yourIdentity, "atk"), chosen("target")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GRAVITATIONAL_PULL_SKIPPED: Readonly<Record<string, string>> = {};
