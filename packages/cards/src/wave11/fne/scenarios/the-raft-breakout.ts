import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  activationIs,
  addCounters,
  attachCard,
  attacksGainKeywords,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  countersOn,
  dealAsEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardEncounterUntil,
  eachPlayer,
  eitherCost,
  encounterCards,
  engage,
  eventPlayer,
  eventTarget,
  exhaustCardsCost,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsAbility,
  giveTough,
  heroAction,
  ifThen,
  inForm,
  modifyAttack,
  on,
  option,
  placeThreat,
  query,
  refMatches,
  removeThreat,
  resourceTypesOf,
  revealCard,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  thatPlayer,
  theMainScheme,
  theVillain,
  treatAsMinion,
  tuckCards,
  tuckedUnderRef,
  whenDefeated,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";

const PRISONER_MINION = query("minion", { trait: trait("PRISONER") });
const DECEIVED = trait("DECEIVED");
const ELITE = trait("ELITE");
const MASTER_KEY = query("attachment", { name: "Master Key" });
/** The When Defeated each minion gains from The Raft Breakout (60142b): on no card's own refs. */
const GRANTED_WHEN_DEFEATED = "60142b.granted-when-defeated";

/**
 * "Deal each of that activation's boost cards that is a [type] to yourself as a facedown encounter card": each boost
 * card is read in the window after it is resolved (its Boost ability and icons done) and before it is discarded
 * (`boostCardResolved`, as Loki the Rascal 55029a), and dealt in place of that discard. The enemy is the one the
 * ability is on (or hosted by), so `eventPlayer` is the player its activation is against ("you").
 */
const dealBoostCardsOfType = (type: "minion" | "treachery", activation: "attack" | "scheme") =>
  ifThen(
    activationIs(activation),
    ifThen(refMatches(eventTarget, query(type), { anywhere: true }), dealAsEncounterCard(eventTarget, eventPlayer)),
  );

/**
 * The Raft Breakout scenario (docs/phase7-wave11-scenarios.md section S7; MC60 p. 15, FAQ p. 26).
 *
 * **60142a/b The Raft Breakout**: Setup attaches Master Key (found in the encounter deck) to the villain, then each
 * player in turn discards cards from the encounter deck until a Prisoner minion is discarded and reveals it (the deck is
 * shuffled after the search, RRG 1.8 "Search", p. 39). 2 / 11 per hero threat, acceleration 1 per hero and "if this
 * stage is completed, the players lose" are data. Each minion gains a When Defeated that removes 1 threat from the
 * main scheme, 2 if the minion is Elite (`gainsAbility` to each minion, a granted When Defeated). A crisis icon does not
 * stop it on an encounter minion and does on an ally treated as a minion (owner Q209 open, built A; RRG 1.8 p. 14).
 * The campaign's "tough status card / facedown boost card on each Prisoner minion" line is campaign setup (MC60
 * p. 15), not this card's text.
 * **60143 Master Key**: Permanent is data. Forced Response: each boost card of the villain's scheme activation that is a
 * minion is dealt to the player schemed against, facedown, after its Boost ability has resolved and in place of its
 * discard (MC60 p. 15: "resolve any boost effects as normal and then deal each such minion ... instead of discarding
 * it").
 * **60144 Absorbing Man**: tucks the top card of the attacked player's deck under him; +1 ATK for each different
 * resource type (printed; wild is its own type) on the cards tucked under him, the new card counted.
 * **60145 Baron Zemo**: the constant treats each ally with threat on it as a Deceived minion (`treatAsMinion`: SCH
 * from base THW, a blank text box, no consequential damage; read live, so the allies are allies again when he leaves
 * play and keep their threat, FAQ MC60 p. 26). When Revealed: the first player (RRG 1.8 "First Player", p. 19) chooses
 * an ally without threat, 1 threat goes on it and it engages its controller. An ally Converted (60100) and Zemo both
 * claim is owner decision Q206 = A (docs/phase7-wave11-scenarios.md section S4.1).
 * **60146 Drang**: a barrage counter after each attack on the player, then indirect damage equal to his counters.
 * **60147 Mysterio**: as Master Key for the treachery boost cards of his attack on the player.
 * **60148 Proxima Midnight**: the attacked player chooses: 1 threat on the main scheme, or +2 ATK for this attack.
 * **60149 Rhino**: Toughness and Villainous are data; his attacks gain overkill; as a Boost he gives the activating
 * enemy a tough status card.
 * **60150 Imprisoned**: the holder's identity (not their allies) cannot thwart or attack, and cannot change to alter-ego form (which only
 * matters in hero form, as Bear Hug 60164). Hero Action: spend 3 resources of any type, or exhaust characters with a
 * combined THW of 3 or more (more than 2), to discard it. Boost: reveal it.
 *
 * Cards (9):
 * - 60142a The Raft Breakout (main_scheme)
 * - 60143 Master Key (attachment)
 * - 60144 Absorbing Man (minion)
 * - 60145 Baron Zemo (minion)
 * - 60146 Drang (minion)
 * - 60147 Mysterio (minion)
 * - 60148 Proxima Midnight (minion)
 * - 60149 Rhino (minion)
 * - 60150 Imprisoned (obligation)
 */
export const FNE_SCENARIOS_THE_RAFT_BREAKOUT: AbilityRegistry = defineAbilities({
  "60142a.setup": setup(
    selectCards("key", encounterCards(["deck"], MASTER_KEY)),
    attachCard(chosen("key"), theVillain),
    forEachPlayer(
      eachPlayer,
      discardEncounterUntil(PRISONER_MINION, "prisoner"),
      revealCard(chosen("prisoner"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // "Each minion gains: 'When Defeated: ...'": a gained ability, not printed on the minion (RRG 1.8 "'Gains'", p. 21),
  // so an effect that ignores When Defeated abilities stops it and a minion whose text box is blank still has it.
  // Crisis (owner Q209 open, built A): the gained ability is on the minion, so the removal's source is the minion.
  // On an encounter minion a crisis icon does not stop it ("Abilities on encounter cards are not affected", RRG 1.8
  // "Crisis Icon", p. 14); on an ally Baron Zemo treats as a minion, a player card, it does ("'Gains'", p. 21). The
  // engine's crisis check reads the source card (`threatRemovalBlocked`), so no `ignoreCrisis` here.
  "60142b.the-raft-breakout-constant": constant(gainsAbility(GRANTED_WHEN_DEFEATED, { to: query("minion") })),
  [GRANTED_WHEN_DEFEATED]: whenDefeated(
    ifThen(refMatches(self, { trait: ELITE }), removeThreat(2, theMainScheme), removeThreat(1, theMainScheme)),
  ),

  "60143.master-key-forced-response": forcedResponse(
    on.boostCardResolved("host"),
    dealBoostCardsOfType("minion", "scheme"),
  ),

  "60144.absorbing-man-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    tuckCards(zone("deck", you, { top: 1 }), self),
    modifyAttack({ atkBonus: resourceTypesOf(tuckedUnderRef(self)) }),
  ),

  "60145.baron-zemo-constant": constant(
    treatAsMinion(query("ally", { hasThreat: true }), [DECEIVED], { schFromThw: "base" }),
  ),
  "60145.when-revealed": whenRevealed(
    chooseTarget("ally", query("ally", { hasThreat: false }), { chooser: firstPlayer }),
    placeThreat(1, chosen("ally")),
    engage(chosen("ally"), controllerOf(chosen("ally"))),
  ),

  "60146.drang-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    addCounters("barrage", 1),
    dealIndirectDamage(you, countersOn(self, "barrage")),
  ),

  "60147.mysterio-forced-response": forcedResponse(
    on.boostCardResolved("self"),
    dealBoostCardsOfType("treachery", "attack"),
  ),

  "60148.proxima-midnight-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    chooseOne(
      option("Place 1 threat on the main scheme", placeThreat(1, theMainScheme)),
      option("Proxima Midnight gets +2 ATK for this attack", modifyAttack({ atkBonus: 2 })),
    ),
  ),

  "60149.rhino-constant": constant(attacksGainKeywords(["overkill"], { attacker: { self: true } })),
  "60149.boost": boost(giveTough(activatingEnemy)),

  // One sentence, so every "you" is the holder's identity (RRG 1.8 "You, Your", p. 49): their allies still thwart and
  // attack. The thwarter-scoped form, as Wrapped in Metal (docs/phase7-wave6.md §3.77).
  "60150.obligation": constant(
    rule({ kind: "cannotThwart", thwarter: query("identity", { controller: "you" }) }),
    rule({ kind: "cannotAttack", target: query("enemy"), attacker: query("identity", { controller: "you" }) }),
    rule({ kind: "cannotChangeForm", player: you, while: inForm("hero") }),
  ),
  "60150.imprisoned-action": heroAction(
    {
      cost: eitherCost(
        spend(3),
        exhaustCardsCost(query(["identity", "ally"]), { max: "any", combined: { stat: "thw", moreThan: 2 } }),
      ),
    },
    discard(self),
  ),
  "60150.boost": boost(revealCard(self, you)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_SCENARIOS_THE_RAFT_BREAKOUT_SKIPPED: Readonly<Record<string, string>> = {};
