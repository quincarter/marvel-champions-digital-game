import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  alterEgoAction,
  anAttackableEnemy,
  attackAnEnemy,
  anEnemy,
  attack,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  cards,
  confuse,
  dealDamage,
  defineAbilities,
  discard,
  draw,
  each,
  exhaustCardsCost,
  exhaustThis,
  giveTough,
  heal,
  heroResponse,
  moveCards,
  ofClassification,
  option,
  query,
  self,
  special,
  statOf,
  stun,
  theVillain,
  thwartAScheme,
  varOf,
  yourIdentity,
  zone,
  you,
} from "../../../dsl/index.js";
import { RESOLVE_ONE_SPECIAL } from "./identity.js";

const WAKANDA = trait("Wakanda");

/**
 * Wave 9 scripting module `bp/black-panther/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Every upgrade's "You may discard this card to ..." is an effect, not a cost (the first sentence has already
 * resolved): a `chooseOne` whose first option discards the card and does the rest, with a decline option. The
 * Specials carry no "final step" bonus (unlike Core's four).
 *
 * Panther Claws: "deal 2 damage ... discard this card to deal 3 additional damage to that enemy. If you do, this
 * attack gains piercing" is one instance of 5 damage with piercing (docs/phase7-wave9.md section 3.36), so the choice
 * to discard comes before the attack is made: 5 with piercing, or 2.
 *
 * The Elephant's Trunk: "Exhaust The Elephant's Trunk and up to 2 other Wakanda allies and/or supports you control"
 * is one pick of 1 to 3 Wakanda allies and supports that always holds the Trunk (`includingThis`), not `exhaustThis`
 * plus a pick of others: RRG 1.8 FAQ p. 65 rules that exhausting only the Trunk pays, because it is itself a Wakanda
 * support and so meets the minimum of one (RRG 1.8 "Cost", p. 14). It draws 1 card per card exhausted, itself included.
 *
 * Cards (8):
 * - 51002 T'Challa (ally)
 * - 51007 The Elephant's Trunk (support)
 * - 51008 Queen Ramonda (support)
 * - 51009 Aja-Adanna (upgrade)
 * - 51010 Kimoyo Beads (upgrade)
 * - 51011 Panther Claws (upgrade)
 * - 51012 Spider Bites (upgrade)
 * - 51013 Vibranium Suit (upgrade)
 */
export const BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "51002.tchalla-response": heroResponse(after.basicPowerUsed("self"), ...RESOLVE_ONE_SPECIAL),

  "51007.the-elephants-trunk-action": alterEgoAction(
    {
      cost: exhaustCardsCost(query(["ally", "support"], { trait: WAKANDA }), {
        includingThis: true,
        max: 3,
        bind: "exhausted",
      }),
    },
    draw(varOf("exhausted")),
  ),

  "51008.queen-ramonda-action": alterEgoAction(
    { cost: exhaustThis },
    chooseTarget("alterEgo", query("alterEgo", { trait: WAKANDA })),
    heal(statOf(chosen("alterEgo"), "rec"), chosen("alterEgo")),
  ),

  "51009.aja-adanna-action": action(
    { cost: exhaustThis },
    chooseCards(
      "found",
      zone("discard", you, {
        filter: query(["ally", "event", "support", "upgrade", "resource"], ofClassification("identitySpecific")),
      }),
      { min: 1, max: 1 },
    ),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  "51010.kimoyo-beads-special": special(
    { label: "thwart" },
    thwartAScheme(1),
    chooseOne(
      option(
        "Discard Kimoyo Beads to confuse an enemy",
        discard(self),
        anEnemy("confused"),
        confuse(chosen("confused")),
      ),
      option("Do not discard Kimoyo Beads"),
    ),
  ),

  "51011.panther-claws-special": special(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    chooseOne(
      option(
        "Discard Panther Claws to deal 3 additional damage with piercing",
        discard(self),
        attack(5, chosen("enemy"), { keywords: ["piercing"] }),
      ),
      option("Do not discard Panther Claws: deal 2 damage", attack(2, chosen("enemy"))),
    ),
  ),

  "51012.spider-bites-special": special(
    choosePlayer(),
    dealDamage(1, theVillain),
    dealDamage(1, each(query("minion", { engagedWithPlayer: chosenPlayer() }))),
    chooseOne(
      option(
        "Discard Spider Bites to stun each of those enemies",
        discard(self),
        stun(theVillain),
        stun(each(query("minion", { engagedWithPlayer: chosenPlayer() }))),
      ),
      option("Do not discard Spider Bites"),
    ),
  ),

  "51013.vibranium-suit-special": special(
    { label: "attack" },
    ...attackAnEnemy(1, { moveDamageFrom: yourIdentity }),
    chooseOne(
      option("Discard Vibranium Suit to give your hero a tough status card", discard(self), giveTough(yourIdentity)),
      option("Do not discard Vibranium Suit"),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
