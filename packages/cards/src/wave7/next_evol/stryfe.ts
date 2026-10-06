import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  advanceMainScheme,
  alterEgoAction,
  attachCard,
  attachInstruction,
  attackedPlayer,
  boost,
  characterDidThisPhase,
  chooseCardType,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  costModifier,
  cards,
  dealAsEncounterCard,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  discardFromHand,
  draw,
  drawUpTo,
  each,
  eachPlayer,
  enemyActivates,
  entersPlayExhausted,
  eventResult,
  exhaustCardsCost,
  exhaustYourHero,
  flipCard,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  gets,
  handCountOf,
  handSizeOf,
  heroAction,
  host,
  ifThen,
  inPlay,
  moveCards,
  mostCommonHandTypeCount,
  named,
  not,
  notOfChosenCardType,
  ofChosenCardType,
  on,
  placeThreat,
  query,
  refMatches,
  response,
  revealCard,
  revealSetAside,
  rule,
  self,
  setup,
  spend,
  takeDamage,
  thatPlayer,
  theMainScheme,
  uncancellable,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  zone,
  allOf,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * The Stryfe scenario's own set (40163-40179: the three villain stages, Uncontrollable Power / Left to Your Fate,
 * Stryfe's Grasp / Living Bomb and the encounter cards). Hope Summers and Captive Hope are `hope-summers.ts`.
 *
 * "X is the number of cards of the most common type in [a] hand" is `mostCommonHandTypeCount` (MC40 p. 18; owner
 * answer Q18). Stryfe's ATK reads the attacked player's hand while he attacks, so it follows the hand up to the point
 * his damage is dealt (MC40 p. 21).
 */
const PSIONIC = trait("PSIONIC");
const THE_VILLAIN = query("villain");
const YOUR_UPGRADES_AND_SUPPORTS = query(["upgrade", "support"], { controlledBy: you });
const HOPE_SUMMERS = { name: "Hope Summers" } as const;
/** "While Stryfe is attacking you, he gets +X ATK, where X is the number of cards of the most common type in your hand." */
const stryfeAttack = () => constant(gets("atk", mostCommonHandTypeCount(attackedPlayer(self)), { self: true }));

/**
 * Stryfe's Grasp 1 (a): "After Stryfe is defeated or the last threat is removed from this scheme" is one printed ability
 * with two triggering conditions, each a whole pattern of its own (`on.either`, `EventPattern.anyOf`): a defeat of the
 * villain, or a removal from this scheme that left no threat (`lastThreatRemoved`, set by the engine on the removal).
 * A removal that leaves threat on it is not heard at all.
 */
const GRASP_TRIGGER = on.either(on.defeated(THE_VILLAIN), on.lastThreatRemoved("self"));

export const STRYFE: AbilityRegistry = defineAbilities({
  // Stryfe I / II / III (40163-40165).
  "40163.stryfe-constant": stryfeAttack(),
  "40164.stryfe-constant": stryfeAttack(),
  // II — When Revealed: Each player discards cards from the top of the encounter deck until a PSIONIC attachment is
  // discarded and reveals that card (in player order; the deck resets if it runs out, as any discard-until does).
  "40164.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      discardEncounterUntil(query("attachment", { trait: PSIONIC }), "found"),
      revealCard(chosen("found"), thatPlayer),
    ),
  ),
  "40165.stryfe-constant": stryfeAttack(),
  // III — Forced Response: After you attack Stryfe, take X damage (your hero attacks, an ally's attack is not "you").
  "40165.stryfe-forced-response": forcedResponse(
    { ...on.attacks(query("identity"), { target: THE_VILLAIN }), playerIs: "controller" as const },
    takeDamage(mostCommonHandTypeCount()),
  ),

  // Uncontrollable Power 1A — Setup: Put Hope Summers into play under the first player's control (her own Setup keyword,
  // Appendix II step 11, so not repeated here). Reveal Stryfe's Grasp (set aside by the scenario builder).
  "40166a.setup": setup(...revealSetAside({ name: "Stryfe's Grasp" })),
  // 1B — [star] Forced Response: After resolving step one of the villain phase, each player places X threat here, X the
  // number of cards of the most common type in their hand. Each player may discard 1 card from their hand before
  // calculating X (in player order, each placing before the next player's discard). "If this stage is completed, the
  // players lose the game" is data (`completionLoses`).
  "40166b.uncontrollable-power-forced-response": forcedResponse(
    on.villainStepResolved(),
    forEachPlayer(
      eachPlayer,
      chooseCards("pitch", zone("hand", thatPlayer), { min: 0, max: 1, chooser: thatPlayer }),
      moveCards(cards(chosen("pitch")), "discard"),
      placeThreat(mostCommonHandTypeCount(thatPlayer), self),
    ),
  ),

  // Left to Your Fate 2B — Stryfe gains stalwart.
  "40167b.left-to-your-fate-constant": constant(gainsKeyword({ name: "stalwart" }, THE_VILLAIN)),
  // Each identity gets +2 hand size. Increase the resource cost to play each player card by 1 (after the printed cost's
  // own modifiers, as any increase).
  "40167b.left-to-your-fate-constant-2": constant(
    gets("handSize", 2, query("identity")),
    costModifier({ delta: 1, appliesTo: query(["ally", "event", "support", "upgrade"]) }),
  ),

  // Stryfe's Grasp (40168a) — Permanent, hinder and crisis are data. Hope Summers can attack only Stryfe and can thwart
  // only this scheme (both end with the flip: Living Bomb does not print them).
  "40168a.stryfes-grasp-constant": constant(
    rule({
      kind: "cannotAttack",
      attacker: HOPE_SUMMERS,
      target: query("enemy", { not: { name: "Stryfe" } }),
    }),
    rule({ kind: "cannotThwart", thwarter: HOPE_SUMMERS, schemes: { not: { self: true } } }),
  ),
  // Forced Response: After Stryfe is defeated or the last threat is removed from this scheme, flip this card and reveal
  // Living Bomb. Place any threat here on Living Bomb. (A flip keeps the threat on the card and the reveal adds Living
  // Bomb's 3 on top, owner answer Q19 = A, so the threat carries over with no separate move.)
  "40168a.stryfes-grasp-forced-response": forcedResponse(GRASP_TRIGGER, flipCard(self, { reveal: true })),
  // Living Bomb (40168b) — Victory 1 is data. Stryfe cannot be defeated; when Living Bomb leaves play at 0 hit points
  // Stryfe is defeated at once (Q21 = A, engine).
  "40168b.living-bomb-constant": constant(rule({ kind: "cannotBeDefeated", target: THE_VILLAIN })),
  // When Revealed: Advance the main scheme to stage 2A. This effect cannot be canceled. An advance, not a completion.
  "40168b.when-revealed": uncancellable(whenRevealed(advanceMainScheme({ to: { stageNumber: 2 } }))),

  // Mental Transferal (40169) — If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your
  // identity. It is attach text, resolved at the reveal's attach step (RRG "Reveal", p. 38) and not cancelable.
  "40169.mental-transferal-constant": attachInstruction(
    ifThen(inPlay("Stryfe's Grasp"), attachCard(self, named("Hope Summers")), attachCard(self, yourIdentity)),
  ),
  // Forced Response: After Stryfe takes any amount of damage, attached character takes an equal amount of damage.
  // Discard this card.
  "40169.mental-transferal-forced-response": forcedResponse(
    on.damage(THE_VILLAIN, { taken: true }),
    dealDamage(eventResult("amount"), host),
    discard(self),
  ),

  // Mind Alteration (40170) — Attach to your identity (data). Forced Response: After you play an event or upgrade, take 1
  // damage. Response: After you recover, spend a [mental] resource -> discard this card.
  "40170.mind-alteration-forced-response": forcedResponse(on.youPlayedCard(query(["event", "upgrade"])), takeDamage(1)),
  "40170.mind-alteration-response": response(
    { ...on.basicPowerUsed(query("identity")), playerIs: "controller" as const, eventIs: { power: "recover" } },
    { cost: spend({ mental: 1 }) },
    discard(self),
  ),

  // Mind Trap (40171) — Your allies, upgrades, and supports enter play exhausted. Alter-Ego Action: Exhaust 3 cards you
  // control -> discard this card.
  "40171.mind-trap-constant": constant(
    entersPlayExhausted(query(["ally", "upgrade", "support"], { controlledBy: controllerOf(host) })),
  ),
  "40171.mind-trap-action": alterEgoAction(
    {
      cost: exhaustCardsCost(query(["character", "upgrade", "support"], { controlledBy: you, exhausted: false }), {
        min: 3,
        max: 3,
        slot: "exhausted",
      }),
    },
    discard(self),
  ),

  // Psionic Amnesia (40172) — Increase the resource cost of each ally and support you play by 2. Response: After you play
  // an ally or support, exhaust your identity -> discard this card.
  "40172.psionic-amnesia-constant": constant(
    costModifier({ delta: 2, appliesTo: query(["ally", "support"], { controlledBy: controllerOf(host) }) }),
  ),
  "40172.psionic-amnesia-response": response(
    on.youPlayedCard(query(["ally", "support"])),
    { cost: exhaustYourHero },
    discard(self),
  ),

  // Psychic Inertia (40173) — THW -1 and ATK -1 are data. Hero Action: If your hero attacked and thwarted this phase ->
  // discard this card (Q23 = A: any attack and any thwart by your hero, basic or labeled).
  "40173.psychic-inertia-action": heroAction(
    {
      while: allOf(
        characterDidThisPhase(query("identity", { controlledBy: you }), "attack"),
        characterDidThisPhase(query("identity", { controlledBy: you }), "thwart"),
      ),
    },
    discard(self),
  ),

  // Zero (40174) — Guard, Patrol and Toughness are data. When Defeated: If the player who defeated Zero does not have at
  // least 3 cards of the same type in their hand, shuffle Zero into the encounter deck (Q22 = A: also when nobody did).
  "40174.when-defeated": whenDefeated(
    ifThen(
      not(valueAtLeast(mostCommonHandTypeCount(defeatingPlayer), 3)),
      moveCards(cards(self), "encounterDeckShuffle"),
    ),
  ),

  // Cerebral Erasure (40175) — Acceleration (data). When Revealed: Return an upgrade or support you control to its
  // owner's hand. When Defeated: the player who defeated this scheme does the same with theirs.
  "40175.when-revealed": whenRevealed(
    chooseTarget("returned", YOUR_UPGRADES_AND_SUPPORTS),
    moveCards(cards(chosen("returned")), "hand"),
  ),
  "40175.when-defeated": whenDefeated(
    chooseTarget("returned", query(["upgrade", "support"], { controlledBy: defeatingPlayer }), {
      chooser: defeatingPlayer,
    }),
    moveCards(cards(chosen("returned")), "hand"),
  ),

  // Telepathic Camouflage (40176) — Hazard (data). When Revealed: Each player places X threat here, X the number of
  // cards of the most common type in their hand.
  "40176.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, placeThreat(mostCommonHandTypeCount(thatPlayer), self)),
  ),

  // Psionic Surge (40177) — When Revealed: Discard the top X cards of the encounter deck, X the number of cards of the
  // most common type in your hand. Deal each PSIONIC card discarded this way to yourself as a facedown encounter card.
  "40177.when-revealed": whenRevealed(
    discardEncounterCards(mostCommonHandTypeCount(), {
      forEachDiscarded: {
        slot: "discarded",
        effects: [
          ifThen(
            refMatches(chosen("discarded"), { trait: PSIONIC }, { anywhere: true }),
            dealAsEncounterCard(chosen("discarded")),
          ),
        ],
      },
    }),
  ),

  // Psychic Override (40178) — When Revealed: Choose a card type (any type that exists, Jan 26, 2026 - Ruling 4 (4)),
  // then discard each card from your hand that is not of that type. Draw up to your hand size. Place 1 threat on the
  // main scheme for each card of the chosen type in your hand.
  "40178.when-revealed": whenRevealed(
    chooseCardType("type"),
    moveCards(zone("hand", you, { filter: notOfChosenCardType("type") }), "discard"),
    drawUpTo(handSizeOf(you)),
    placeThreat(handCountOf(you, ofChosenCardType("type")), theMainScheme),
  ),
  // [star] Boost: Discard 1 card from your hand. Then, draw 1 card.
  "40178.boost": boost(discardFromHand(1), draw(1)),

  // Telekinetic Wave (40179) — When Revealed: Return an upgrade or support you control to your hand. Stryfe activates
  // against you. [star] Boost: If you have at least 3 cards in your hand that share a type, place 3 threat on the main
  // scheme.
  "40179.when-revealed": whenRevealed(
    chooseTarget("returned", YOUR_UPGRADES_AND_SUPPORTS),
    moveCards(cards(chosen("returned")), "hand"),
    enemyActivates(each(THE_VILLAIN), { against: you }),
  ),
  "40179.boost": boost(ifThen(valueAtLeast(mostCommonHandTypeCount(), 3), placeThreat(3, theMainScheme))),
});
