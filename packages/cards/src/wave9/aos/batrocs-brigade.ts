import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  adjustBoostCount,
  anyOfCards,
  attacksGainKeywords,
  boost,
  canPayResources,
  cancelRevealedCard,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  each,
  encounterCards,
  exists,
  gainsKeyword,
  gets,
  giveTough,
  heroInterrupt,
  ifThen,
  moveCards,
  on,
  option,
  printedCostOf,
  query,
  revealCard,
  rule,
  self,
  setVar,
  shuffleEncounterDeck,
  spend,
  spendResources,
  surge,
  topOfDeck,
  tuckCards,
  tuckedUnderRef,
  valueAtMost,
  varOf,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

const MERCENARY = trait("MERCENARY");
const ELITE = trait("ELITE");
const WEAPON = trait("WEAPON");
const MERCENARY_MINION = query("minion", { trait: MERCENARY });

/**
 * Modular encounter set `batrocs_brigade` (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md sections 3.1, 3.20, 3.33 and
 * 3.35). Surge, Vulnerable (the engine's keyword rule, section 3.1), boost icons, the unique icons and the side
 * scheme's starting threat are data.
 *
 * **Machete (50098)**: his attacks gain piercing. When Defeated: he is shuffled into the encounter deck. A Vulnerable
 * discard (a stun or a confuse) is not a defeat, so that ability does not resolve and he goes to the discard pile.
 *
 * **Rapido (50099)**: his attacks gain ranged and deal indirect damage. When Revealed and Boost: deal 1 damage to each
 * character you control (in a Boost, "you" is the player the activation is against).
 *
 * **Zaran (50100)**: When Revealed: tuck a Weapon upgrade you control under him (the player chooses among several),
 * otherwise the top card of your deck, faceup (RRG 1.8 "Tuck", p. 45). He gets +X ATK, X the printed cost of the card
 * tucked under him (read live; an event, a card with no cost or nothing tucked is 0).
 *
 * **Batroc's Brigade (50101)**: each minion gains toughness, so a minion revealed while this is in play enters play
 * with a tough status card; When Revealed gives each enemy in play one. Hero Interrupt: when you reveal a non-Elite
 * minion, spend 3 resources of any type to cancel its effects and discard it.
 *
 * **Soldiers of Fortune (50102)**: When Revealed: choose to spend 3 resources of any type (an option only a player who
 * can pay may choose, Q51 of docs/phase7-wave6.md) or to find a Mercenary minion and reveal it (the player picks among
 * the Mercenaries in play, the encounter deck and its discard pile; the deck is shuffled after); a Mercenary already in
 * play engages you instead, which is not entering play, so this card gains surge unless a minion entered play (the
 * minion count is read before and after). Boost: either spend 1 resource of any type or this card gains 3 boost icons.
 *
 * Cards (5):
 * - 50098 Machete (minion)
 * - 50099 Rapido (minion)
 * - 50100 Zaran (minion)
 * - 50101 Batroc's Brigade (side_scheme)
 * - 50102 Soldiers of Fortune (treachery)
 */
export const BATROCS_BRIGADE: AbilityRegistry = defineAbilities({
  "50098.machete-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "50098.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),

  "50099.rapido-constant": constant(
    attacksGainKeywords(["ranged"], { attacker: { self: true } }),
    rule({ kind: "attacksDealIndirectDamage", attacker: { self: true } }),
  ),
  "50099.when-revealed": whenRevealed(dealDamage(1, each(query("character", { controller: "you" })))),
  "50099.boost": boost(dealDamage(1, each(query("character", { controller: "you" })))),

  "50100.zaran-constant": constant(gets("atk", printedCostOf(tuckedUnderRef(self)), { self: true })),
  "50100.when-revealed": whenRevealed(
    ifThen(
      exists(query("upgrade", { controller: "you", trait: WEAPON })),
      [
        chooseTarget("weapon", query("upgrade", { controller: "you", trait: WEAPON })),
        tuckCards(cards(chosen("weapon")), self),
      ],
      tuckCards(topOfDeck(1, you), self),
    ),
  ),

  "50101.batrocs-brigade-constant": constant(gainsKeyword({ name: "toughness" }, query("minion"))),
  "50101.when-revealed": whenRevealed(giveTough(each(query("enemy")))),
  "50101.batrocs-brigade-interrupt": heroInterrupt(
    on.encounterCardRevealed(query("minion", { withoutTrait: ELITE })),
    { cost: spend(3) },
    cancelRevealedCard(),
  ),

  "50102.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Spend 3 resources of any type",
        { when: canPayResources({ generic: 3 }) },
        spendResources({ generic: 3 }, "paid"),
      ),
      option(
        "Find a Mercenary minion and reveal it",
        setVar("minionsBefore", countOf(query("minion"))),
        chooseCards(
          "mercenary",
          anyOfCards(cards(each(MERCENARY_MINION)), encounterCards(["deck", "discard"], MERCENARY_MINION)),
          {
            min: 1,
            max: 1,
          },
        ),
        revealCard(chosen("mercenary"), you),
        shuffleEncounterDeck(),
        ifThen(valueAtMost(countOf(query("minion")), varOf("minionsBefore")), surge()),
      ),
    ),
  ),
  "50102.boost": boost(
    chooseOne(
      option(
        "Spend 1 resource of any type",
        { when: canPayResources({ generic: 1 }) },
        spendResources({ generic: 1 }, "paid"),
      ),
      option("This card gains 3 boost icons", adjustBoostCount(3)),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BATROCS_BRIGADE_SKIPPED: Readonly<Record<string, string>> = {};
