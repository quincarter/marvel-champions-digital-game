import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, Predicate } from "@mc/engine";
import {
  atEndOfAttack,
  boostIconsOn,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  damageThisCardCost,
  dealDamage,
  defeat,
  defineAbilities,
  discardEncounterUntil,
  divide,
  draw,
  each,
  encounterCards,
  eventDealt,
  eventSource,
  exhaustEachCost,
  exhaustThis,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  host,
  giveTough,
  ifThen,
  interrupt,
  modifyStat,
  not,
  on,
  putIntoPlay,
  query,
  removeThreat,
  response,
  self,
  statOf,
  stun,
  sum,
  tuckCards,
  tuckedUnderRef,
  valueAtLeast,
  varOf,
  whenDefeated,
  YOUR_HERO,
  yourIdentity,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const X_MEN = trait("X-MEN");
const X_FORCE = trait("X-FORCE");
const ELITE = trait("ELITE");

/** "during the villain phase": any step of it. */
const IN_VILLAIN_PHASE: Predicate = { kind: "gameStep", phase: "villain" };

/** The existing script of a card this one reprints, found by its ability id (docs/phase7-wave8.md §3.81). */
function reprintOf(id: string): AbilityDefinition {
  const definition = WAVE7_ABILITIES[id];
  if (!definition) throw new Error(`reprint source ${id} is not scripted`);
  return definition;
}

/** "Exhaust an [X-FORCE] character and an [X-MEN] character →" (Alliance): one card per slot, never one for both (Q40 = A). */
const XFORCE_AND_XMEN = exhaustEachCost({
  xforce: query(["identity", "ally"], { trait: X_FORCE }),
  xmen: query(["identity", "ally"], { trait: X_MEN }),
});

/**
 * Nightcrawler pack aspect and basic player cards, docs/phase7-wave8.md §7.4, §3.74, §3.81.
 *
 * Cards (16):
 * - 48012 Rogue (ally)
 * - 48013 Northstar (ally)
 * - 48014 Change of Fortune (upgrade)
 * - 48015 Under Control (upgrade)
 * - 48016 "Come Get Me, Bub!" (event)
 * - 48017 Powerful Punch (event)
 * - 48018 Riposte (event)
 * - 48019 The Power of Protection (resource)
 * - 48020 Astonishing X-Men (player_side_scheme)
 * - 48021 Gambit (ally)
 * - 48022 Moira MacTaggert (support)
 * - 48023 Energy (resource)
 * - 48024 Genius (resource)
 * - 48025 Strength (resource)
 * - 48031 Combine Forces (event)
 * - 48032 Gunboat Diplomacy (event)
 *
 * **Reprints, one script under two ids**: Powerful Punch 48017 is `mut_gen` 32014's, The Power of Protection 48019 is
 * Core 01079's and Moira MacTaggert 48022 is `rogue` 38018's (raw `duplicate_of_code`, aliased as wave 7 aliased its
 * own). Energy, Genius and Strength print no ability.
 *
 * **Rogue (48012) is not registered.** Her cost is "Deal 1 damage to another friendly character", a character of any
 * player's that she picks, and dealing is paid even if prevented (RRG 1.8 "Cost", p. 14). `dealDamageCost` damages
 * only cards a cost pick bound, `damageCardsCost` takes only the payer's own characters and refuses one a tough
 * status card would protect, and no cost picks a character without doing something else to it. Scripting the damage
 * as the first effect instead would be an approximation. Docs/phase7-wave8.md §3.74 test 6 to 10 wait on that pick.
 *
 * **Gambit (48021)** reads the boost icons printed on the card tucked under him as the base of both powers (a star is
 * no icon, an amplify icon in play adds none because the card is never turned faceup as a boost card). The Response is
 * a choice among the top three encounter cards; the two not chosen stay where they are, in order. With no card
 * under him X is 0.
 *
 * **Change of Fortune (48014)**: "you" is the identity (RRG 1.8 "You, Your", p. 49), so the defeat must come from the
 * identity or a card of the controller that is not an ally: an ally's attack does not count. It is read in any step of
 * the villain phase.
 *
 * **Come Get Me, Bub! (48016)**: the discard and the putting into play are the cost (the arrow), so heal and tough
 * follow only if a minion entered play. The minion is not revealed: no When Revealed, no surge.
 *
 * **Northstar (48013)** answers any boost card turned faceup during any enemy's attack. As with Attacrobatics (FAQ,
 * RRG 1.8 p. 59) a card with no icons to cancel is no reason to take the damage, so it is not offered then.
 */
export const NCRAWLER_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "48013.northstar-interrupt": interrupt(
    { on: "boostCardTurnedFaceup", activation: "attack", eventAtLeast: { boostIcons: 1 } },
    { cost: damageThisCardCost(1) },
    { kind: "cancelBoostIcons" },
  ),

  "48014.change-of-fortune-response": response(
    { ...on.defeated(query("enemy"), { byYou: true }), sourceIs: { not: query("ally") } },
    { cost: exhaustThis, while: IN_VILLAIN_PHASE },
    draw(2),
  ),

  "48015.under-control-response": response(
    {
      ...on.defends(query("hero"), { takingNoDamage: true }),
      sourceIs: query("minion", { hostOfSelf: true }),
    },
    dealDamage(4, host),
  ),

  "48016.come-get-me-bub-action": heroAction(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), undefined, { bind: "entered" }),
    ifThen(valueAtLeast(varOf("entered.count"), 1), [heal(3, yourIdentity), giveTough(yourIdentity)]),
  ),

  "48017.powerful-punch-constant": reprintOf("32014.powerful-punch-constant"),

  "48018.riposte-interrupt": heroInterrupt(
    on.defends(YOUR_HERO),
    { label: "defense" },
    modifyStat("def", 2, yourIdentity, "endOfAttack"),
    atEndOfAttack(ifThen(not(eventDealt("damage")), dealDamage(3, eventSource))),
  ),

  "48019.the-power-of-protection-constant": reprintOf("01079.the-power-of-protection-constant"),

  "48020.astonishing-x-men-response": response(
    on.defends(query(["hero", "ally"], { trait: X_MEN }), { takingNoDamage: true }),
    removeThreat(1, self),
  ),
  "48020.when-defeated": whenDefeated(stun(each(query("enemy"))), confuse(each(query("enemy")))),

  "48021.gambit-constant": constant(
    gets("thw", boostIconsOn(tuckedUnderRef(self)), { self: true }, { setBase: true }),
    gets("atk", boostIconsOn(tuckedUnderRef(self)), { self: true }, { setBase: true }),
  ),
  "48021.gambit-response": response(
    on.entersPlay("self"),
    chooseCards("tucked", encounterCards(["deck"], undefined, 3), { min: 1, max: 1 }),
    tuckCards(cards(chosen("tucked")), self),
  ),

  "48022.moira-mactaggert-response": reprintOf("38018.moira-mactaggert-response"),

  "48031.combine-forces-action": heroAction(
    { cost: XFORCE_AND_XMEN },
    chooseTarget("minion", query("minion", { withoutTrait: ELITE })),
    defeat(chosen("minion")),
  ),

  "48032.gunboat-diplomacy-constant": heroAction(
    { label: ["attack", "thwart"], cost: XFORCE_AND_XMEN },
    divide("threat", sum(statOf(chosen("xforce"), "thw"), statOf(chosen("xmen"), "thw")), query("scheme")),
    divide("damage", sum(statOf(chosen("xforce"), "thw"), statOf(chosen("xmen"), "thw")), query("enemy")),
  ),
});
