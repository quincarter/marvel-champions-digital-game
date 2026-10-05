import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  activatingEnemy,
  addCounters,
  addVillain,
  adjustBoostCount,
  advanceMainScheme,
  boost,
  cannotLeavePlay,
  canPayResources,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  coveredByEngineRule,
  dealDamage,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyActivates,
  enemyAttack,
  enemyAttacksYouCost,
  eventTarget,
  excludedFromAllyLimit,
  exhaustCardsCost,
  exists,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsKeywordX,
  giveTough,
  heroAction,
  host,
  ifThen,
  mainSchemeAdvancedBy,
  modifyAttack,
  moveCards,
  named,
  not,
  on,
  option,
  perHero,
  placeThreat,
  product,
  putIntoPlay,
  query,
  refMatches,
  retargetAttack,
  selectCards,
  self,
  setup,
  sharesTitleWith,
  shuffleEncounterDeck,
  spendResources,
  stateCheck,
  surge,
  theMainScheme,
  theVillain,
  thatPlayer,
  tuckCards,
  tuckedCount,
  valueAtLeast,
  valueEquals,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * The Morlock Siege scenario's own set (40077-40089: main scheme, Morlock, Hide!, Routed and the encounter cards).
 * 40090-40093 are Military Grade's. The seven Marauders are `marauders.ts`.
 *
 * "Villains under Routed" is `tuckedCount(named("Routed"), villain)`: a defeated villain is tucked under Routed, out of
 * play (RRG 1.8 "Tuck", p. 45), so "cards under here are not in play" on the standard face is an engine rule.
 */
const MORLOCK = trait("MORLOCK");
const MORLOCK_ALLIES = query("ally", { trait: MORLOCK });
const YOUR_MORLOCKS = query("ally", { trait: MORLOCK, controller: "you" });
/** A character that a tough status card can still be given to (an ally already holding one is not a valid target). */
const MORLOCK_TO_TOUGHEN = query("ally", { trait: MORLOCK, canTakeStatus: "tough" });
const THE_VILLAIN = query("villain");
const ROUTED = named("Routed");
const VILLAINS_UNDER_ROUTED = tuckedCount(ROUTED, THE_VILLAIN);
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });

/** "Give 1 MORLOCK ally a tough status card": the player resolving it chooses; nothing is asked with no valid ally. */
const toughenAMorlock = () => [chooseTarget("morlock", MORLOCK_TO_TOUGHEN), giveTough(chosen("morlock"))];

/** "Each player puts 1 set-aside Morlock ally into play under their control." */
const putMorlockIntoPlay = (controller: typeof thatPlayer) => [
  selectCards("morlock", encounterSetAside(query("ally", { name: "Morlock" }), { random: 1 })),
  putIntoPlay(chosen("morlock"), controller),
];

/**
 * 40081a/b Forced Response: After the villain is defeated, put it under here. Discard each minion that shares a title
 * with the top villain of the villain deck (that villain is in play). The villain activates against each player in
 * player order. The win at 3 villains under Routed is the main scheme's state check, which ends the game between
 * the tuck and the next villain (RRG 1.8 "Villain Defeat", p. 47: the next villain's tokens, statuses and attachments
 * are new; MC40 p. 9).
 */
const routedForcedResponse = () =>
  forcedResponse(
    on.defeated(THE_VILLAIN),
    tuckCards(cards(eventTarget), self),
    selectCards("next", encounterSetAside(THE_VILLAIN, { random: 1 })),
    addVillain(chosen("next"), { reveal: true }),
    discard(each(query("minion", sharesTitleWith(theVillain)))),
    forEachPlayer(eachPlayer, enemyActivates(theVillain, { against: thatPlayer })),
  );

/** "If there are 3 villains under Routed, the players win the game." */
const winAtThree = () => stateCheck(valueAtLeast(VILLAINS_UNDER_ROUTED, 3), endGame("win"));
/** "[…] there are no Morlock allies in play, the players lose the game." */
const noMorlocksLoses = () => stateCheck(not(exists(MORLOCK_ALLIES)), endGame("loss"));

/** "When Revealed: Place 1[per_hero] additional threat here for each villain under Routed." */
const placeThreatPerRouted = () => whenRevealed(placeThreat(product(perHero(1), VILLAINS_UNDER_ROUTED), self));

export const MORLOCK_SIEGE: AbilityRegistry = defineAbilities({
  // Knock, Knock 1A — Setup: Put the Routed environment into play. (Hide! and each Morlock are set aside, and the villain
  // deck is the scenario builder's: `randomStartingVillain` and the set-aside Marauders.)
  "40077a.setup": setup(
    selectCards("routed", encounterCards(["deck"], { name: "Routed" })),
    putIntoPlay(chosen("routed"), firstPlayer),
    shuffleEncounterDeck(),
  ),
  // 1B — Forced Response: After resolving step one of the villain phase, place 1 knock counter here. If there are at
  // least 3 knock counters here, advance to stage 2A.
  "40077b.knock-knock-forced-response": forcedResponse(
    on.villainStepResolved(),
    addCounters("knock", 1, self),
    ifThen(valueAtLeast(countersOn(self, "knock"), 3), advanceMainScheme()),
  ),
  "40077b.knock-knock-constant": winAtThree(),

  // Mutant Massacre 2A — When Revealed: Each player puts 1 set-aside Morlock ally into play under their control (2
  // instead if this is a single-player game). Shuffle the Hide! treachery into the encounter deck. If the previous stage
  // was advanced by knock counters, give each Morlock ally a tough status card.
  "40078a.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, putMorlockIntoPlay(thatPlayer)),
    ifThen(valueEquals(perHero(1), 1), putMorlockIntoPlay(firstPlayer)),
    moveCards(encounterSetAside(query("treachery", { name: "Hide!" })), "encounterDeckShuffle"),
    ifThen(mainSchemeAdvancedBy("cardEffect", self), giveTough(each(MORLOCK_ALLIES))),
  ),
  // 2B — Action: Exhaust a MORLOCK ally → shuffle Hide! from the encounter discard pile into the encounter deck. The
  // cost is paid with an ally the acting player controls (RRG 1.8 "Cost", p. 13).
  "40078b.mutant-massacre-action": action(
    { cost: exhaustCardsCost(query("ally", { trait: MORLOCK, exhausted: false })) },
    moveCards(encounterCards(["discard"], { name: "Hide!" }), "encounterDeckShuffle"),
  ),
  "40078b.mutant-massacre-constant": winAtThree(),
  // "If this stage is completed" is `MainSchemeStage.completionLoses` in the card data.
  "40078b.mutant-massacre-constant-2": noMorlocksLoses(),

  // Morlock (40079) — Victory -1 (data). Does not count against your ally limit (the limit's own forced discard can
  // still discard it: owner ruling 2026-10-05). Card abilities cannot remove this ally from play; damage from any source
  // still defeats it (docs/phase7-wave7.md §4.1 Q7 = A).
  "40079.morlock-constant": constant(
    excludedFromAllyLimit({ self: true }),
    cannotLeavePlay({ self: true }, { by: "cardAbilities" }),
  ),
  // Forced Interrupt: When an enemy attacks you, it attacks a Morlock you control instead. Whoever the attack was aimed
  // at, including another ally you control (Q6 = A, RRG 1.8 p. 10, Q5 = A); you choose among your Morlocks.
  "40079.morlock-forced-interrupt": forcedInterrupt(
    on.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
    chooseTarget("morlock", YOUR_MORLOCKS),
    retargetAttack(chosen("morlock")),
  ),

  // Hide! (40080) — Surge (data). When Revealed: Give 1 MORLOCK ally a tough status card.
  "40080.when-revealed": whenRevealed(toughenAMorlock()),
  // [star] Boost: Give 1 MORLOCK ally a tough status card. Give the villain 1 additional boost card for this activation.
  // Only when the villain is the one activating: ruling, February 28, 2026 (6), as `mansion-attack.ts` applies it.
  "40080.boost": boost(
    toughenAMorlock(),
    ifThen(refMatches(activatingEnemy, THE_VILLAIN), modifyAttack({ extraBoostCards: 1 })),
  ),

  // Routed (40081a standard / 40081b expert; modeOnly in data). Cards under here are not in play: an engine rule.
  "40081a.routed-constant": coveredByEngineRule(),
  "40081a.routed-forced-response": routedForcedResponse(),
  // Expert: The villain gains retaliate 1 for each card under here.
  "40081b.routed-constant": constant(gainsKeywordX("retaliate", tuckedCount(self), THE_VILLAIN)),
  "40081b.routed-forced-response": routedForcedResponse(),

  // Bolstered by Wrath (40082) — Attach to the villain (+1 ATK, +1 SCH are data).
  // [star] Boost: This card gets +X boost icons, where X is the number of villains under Routed.
  "40082.boost": boost(adjustBoostCount(VILLAINS_UNDER_ROUTED)),

  // Pushed to the Limit (40083) — While exactly 1 villain is under Routed, the attached villain gains steady; exactly 2,
  // stalwart.
  "40083.pushed-to-the-limit-constant": constant(
    gainsKeyword({ name: "steady" }, ATTACHED_VILLAIN, { while: valueEquals(VILLAINS_UNDER_ROUTED, 1) }),
  ),
  "40083.pushed-to-the-limit-constant-2": constant(
    gainsKeyword({ name: "stalwart" }, ATTACHED_VILLAIN, { while: valueEquals(VILLAINS_UNDER_ROUTED, 2) }),
  ),
  // Hero Action: Attached villain attacks you → discard this card. Not offered while it could not attack (Q13 = B).
  "40083.pushed-to-the-limit-action": heroAction({ cost: enemyAttacksYouCost(host) }, discard(self)),

  // The four side schemes (40084 By Any Means, 40085 In the Midst of Chaos, 40086 Maraudin' Ain't Easy, 40087 Territorial
  // Control; icons, amplify and assault are data).
  "40084.when-revealed": placeThreatPerRouted(),
  "40085.when-revealed": placeThreatPerRouted(),
  "40086.when-revealed": placeThreatPerRouted(),
  "40087.when-revealed": placeThreatPerRouted(),

  // Back in Action (40088) — When Revealed: Give the villain a tough status card. Place threat on the main scheme equal to
  // the number of villains under Routed.
  "40088.when-revealed": whenRevealed(giveTough(theVillain), placeThreat(VILLAINS_UNDER_ROUTED, theMainScheme)),
  // [star] Boost: If you control a Morlock ally, choose to either deal 1 damage to it or spend 1 resource of any type.
  // An option is offered only if it can be carried out in full (Q8 = A).
  "40088.boost": boost(
    ifThen(
      exists(YOUR_MORLOCKS),
      chooseOne(
        option(
          "Deal 1 damage to a Morlock ally you control",
          chooseTarget("morlock", YOUR_MORLOCKS),
          dealDamage(1, chosen("morlock")),
        ),
        option(
          "Spend 1 resource of any type",
          { when: canPayResources({ generic: 1 }) },
          spendResources({ generic: 1 }, "spent"),
        ),
      ),
    ),
  ),

  // Seek the Weak (40089) — When Revealed (Alter-Ego): This card gains surge. (Hero): The villain attacks you; with at
  // least 1 villain under Routed that attack gains overkill. [star] Boost: If this activation is an attack, it gains
  // overkill (a boost during a scheme activation reads nothing).
  "40089.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "40089.when-revealed-hero": whenRevealedHero(
    ifThen(
      valueAtLeast(VILLAINS_UNDER_ROUTED, 1),
      enemyAttack(theVillain, { against: you, keywords: ["overkill"] }),
      enemyAttack(theVillain, { against: you }),
    ),
  ),
  "40089.boost": boost(modifyAttack({ overkill: true })),
});
