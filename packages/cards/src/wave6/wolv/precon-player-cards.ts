import { trait } from "@mc/content";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";
import {
  addCounters,
  anAttackableEnemy,
  andThen,
  attack,
  cards,
  chooseTarget,
  chosen,
  confuse,
  dealDamage,
  defeat,
  defineAbilities,
  discard,
  discardDeckUntil,
  discardEncounterCards,
  eventTarget,
  exhaustThis,
  forcedResponse,
  heal,
  heroAction,
  alterEgoAction,
  ifThen,
  interrupt,
  moveCards,
  on,
  query,
  refMatches,
  removeCounter,
  response,
  damageAnEnemy,
  spend,
  takeDamageCost,
  teamUpCharacters,
  totalStatOf,
  varAtLeast,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "../mut_gen/shadowcat/support-upgrades-allies.js";

const ELITE = trait("ELITE");

/**
 * The Wolverine pack's aspect and basic cards no hero folder owns (`wolv` 35013-35015, 35017-35023, 35032, 35033;
 * docs/phase7-wave6.md §6.1, §3.44).
 *
 * - **Reprints, aliased**: Battle Fury 35015 (`06018`), Mean Swing 35019 (`06015`), Aggressive Energy 35020 (`32047`,
 *   "that event deals 1 additional damage", `modifyCardEffect`) and Colossus 35021 (`32048`).
 * - **Psylocke (35013)**: enters play with 2 psionic counters (the Hawkeye shape); her interrupt costs one and confuses
 *   and damages the attacked enemy before the attack resolves.
 * - **Sunfire (35014)**: "an attachment with the text Hero Action or Hero Response" reads `TargetQuery.abilityTiming`
 *   (wave 4 §3.33) over every attachment in play. "Attachment" is an encounter card type (RRG 1.8 "Attachment",
 *   p. 8): a player upgrade, Berserker Frenzy's Hero Response included, is not one. With no eligible attachment in
 *   play the response is not offered (a chosen target is required to resolve it).
 * - **Outta My Way! (35017)**: 5 damage instead of 3 against a guard or patrol enemy, read on the chosen enemy.
 * - **Weapon X (35022)**: "take 1 damage" is a cost; the deck is discarded until an identity-specific card of your own
 *   set turns up, which is then added to your hand (nothing found, nothing added).
 * - **Fastball Special (35023)**: X is the total ATK of Colossus and Wolverine (those in play), overkill and piercing.
 * - **Command Center (35032)**: heard when an ally's thwart defeats a side scheme (the schemeDefeated event's source).
 * - **Longshot (35033)**: after his attack on a non-ELITE minion, discards the top encounter card; a star icon in its
 *   boost area defeats the minion (`<bind>.starIcons`, RRG 1.8 "Boost, Boost Icon", p. 11).
 */
export const WOLV_PRECON_PLAYER_CARDS = defineAbilities({
  "35013.psylocke-constant": forcedResponse(on.entersPlay("self"), addCounters("psionic", 2)),
  "35013.psylocke-interrupt": interrupt(
    on.attacks("self"),
    { cost: removeCounter("psionic") },
    confuse(eventTarget),
    dealDamage(1, eventTarget),
  ),

  "35014.sunfire-response": response(
    on.youPlayThis(),
    { cost: spend({ energy: 1 }) },
    chooseTarget("attachment", query("attachment", { abilityTiming: ["heroAction", "heroResponse"] })),
    discard(chosen("attachment")),
  ),

  "35015.battle-fury-response": THOR_PACK_CARDS["06018.battle-fury-response"]!,

  "35017.outta-my-way-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    ifThen(
      refMatches(chosen("enemy"), {
        anyOf: [query("enemy", { withKeyword: "guard" }), query("enemy", { withKeyword: "patrol" })],
      }),
      attack(5, chosen("enemy")),
      attack(3, chosen("enemy")),
    ),
  ),

  "35018.precision-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(2, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), heal(2, yourIdentity)),
  ),

  "35019.mean-swing-interrupt": THOR_PACK_CARDS["06015.mean-swing-interrupt"]!,

  "35020.aggressive-energy-interrupt": SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32047.aggressive-energy-interrupt"]!,

  "35021.colossus-constant": SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32048.colossus-constant"]!,

  "35022.weapon-x-action": alterEgoAction(
    { cost: [exhaustThis, takeDamageCost(1)] },
    discardDeckUntil({ identitySetOf: you }, "found"),
    andThen(moveCards(cards(chosen("found")), "hand")),
  ),

  "35023.fastball-special-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(totalStatOf(teamUpCharacters(), "atk"), chosen("enemy"), { overkill: true, keywords: ["piercing"] }),
  ),

  "35032.command-center-response": response(
    { ...on.schemeDefeated(query("sideScheme")), sourceIs: query("ally") },
    { cost: exhaustThis },
    damageAnEnemy(2),
  ),

  "35033.longshot-response": response(
    on.attacks("self", { target: query("minion", { withoutTrait: ELITE }) }),
    discardEncounterCards(1, { bind: "d" }),
    ifThen(varAtLeast("d.starIcons"), defeat(eventTarget)),
  ),
});
