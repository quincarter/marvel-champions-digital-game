import { trait } from "@mc/content";
import {
  action,
  after,
  alterEgoAction,
  anAttackableEnemy,
  aScheme,
  attack,
  cards,
  chooseCards,
  chosen,
  constant,
  coveredByEngineRule,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discard,
  draw,
  encounterCards,
  eventSource,
  exhaustThis,
  forcedResponse,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  heroResponse,
  ifElse,
  ifThen,
  isAlterEgo,
  modifyStat,
  moveCards,
  not,
  oncePerPhase,
  oncePerRound,
  playedThisRound,
  playedThisTurn,
  preventDamage,
  putIntoPlay,
  query,
  refMatches,
  removeThreat,
  removeThreatFromAScheme,
  response,
  rule,
  self,
  selectCards,
  shuffleDeck,
  shuffleEncounterDeck,
  statOf,
  theMainScheme,
  theVillain,
  threatOn,
  thwart,
  thwartAScheme,
  valueEquals,
  when,
  you,
  yourIdentity,
  YOUR_HERO,
  zone,
} from "../../dsl/index.js";

const ATTACK = trait("ATTACK");
const THWART = trait("THWART");
const AN_ATTACK_OR_THWART_EVENT = query("event", { anyTrait: [ATTACK, THWART] });

/**
 * Gamora (18001a/b) and her hero kit (18002–18023, plus the further signature cards 18029–18032). Reprints in this
 * pack (18014 Uppercut, 18017 Combat Training, 18032 Enhanced Reflexes) are aliased automatically by
 * `../reprints.ts`, not scripted here — see docs/phase7-wave3-scripting.md.
 *
 * "Skilled Tactician" (18001b) is `IdentityDeckbuilding.offAspectAllowance` (docs/phase7-wave3.md §1.5), a
 * deckbuilding rule with no runtime effect of its own — `coveredByEngineRule()`.
 *
 * Two DSL/engine primitives promoted this pass, both from docs/phase7-wave3.md §3.26's own "unproven" wordings:
 * - `CardSelector.zone.bottommostOnly` (engine) / `zone(..., { bottommostOnly })` (DSL) — "return the bottommost
 *   attack or thwart event from your discard pile" (Conditioning Room, 18008), the mirror of the existing
 *   `topmostOnly`.
 * - `TargetQuery.unique` (engine) — "against a unique enemy" (Godslayer, 18018), the printed fact `unique.ts`'s
 *   `isUnique` already reads for the deckbuilding unique rule.
 * `Predicate refMatches`'s `anywhere` option (already in the engine, newly exposed by the DSL builder) reads
 * Gamora's own "look at the top card of your deck" (18001b) — a card still on top of the deck, not in play.
 */
export const GAMORA_KIT = defineAbilities({
  // Finesse — Response: After you play an attack event, remove 1 threat from a scheme. (Limit once per phase.)
  "18001a.finesse": heroResponse(
    after.youPlayedCard(query("event", { trait: ATTACK })),
    { limit: oncePerPhase },
    ...removeThreatFromAScheme(1),
  ),
  // Precision — Response: After you play a thwart event, deal 1 damage to an enemy. (Limit once per phase.)
  "18001a.precision": heroResponse(
    after.youPlayedCard(query("event", { trait: THWART })),
    { limit: oncePerPhase },
    ...damageAnEnemy(1),
  ),

  // Skilled Tactician — deckbuilding only (data, `IdentityDeckbuilding.offAspectAllowance`).
  "18001b.gamora-constant": coveredByEngineRule(),
  // Gamora — Action: Look at the top card of your deck. If that card is an attack or thwart event, draw it.
  // (Limit once per round.) `selectCards` "looks" at the card without moving it; `refMatches`'s `anywhere` reads it
  // back where it still is (the top of the deck, not in play).
  "18001b.gamora-action": action(
    { limit: oncePerRound },
    selectCards("top", zone("deck", you, { top: 1 })),
    ifThen(refMatches(chosen("top"), AN_ATTACK_OR_THWART_EVENT, { anywhere: true }), draw(1)),
  ),

  // Nebula (ally) — Response: After Nebula enters play, search your deck for an attack or thwart event and add it
  // to your hand. Shuffle your deck.
  "18002.nebula-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone("deck", you, { filter: AN_ATTACK_OR_THWART_EVENT }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Acrobatic Move — Hero Action (attack): Deal 2 damage to an enemy.
  "18003.acrobatic-move-action": heroAction({ label: "attack" }, ...damageAnEnemy(2)),

  // Crosscounter — Hero Interrupt (attack/defense/thwart): When you would take any amount of damage, prevent 3 of
  // that damage. Deal 1 damage to an enemy. Remove 1 threat from a scheme.
  "18004.crosscounter-constant": heroInterrupt(
    when.damage(YOUR_HERO),
    preventDamage(3),
    ...damageAnEnemy(1),
    ...removeThreatFromAScheme(1),
  ),

  // Set the Pace — Hero Action (thwart): Remove 1 threat from a scheme.
  "18005.set-the-pace-action": heroAction({ label: "thwart" }, ...thwartAScheme(1)),

  // Decisive Blow — Hero Action (attack): Deal 4 damage to an enemy (7 damage instead if you have played a
  // [Thwart] event this turn). docs/phase7-wave3.md §3.24.
  "18006.decisive-blow-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(ifElse(playedThisTurn(query("event", { trait: THWART })), 7, 4), chosen("enemy")),
  ),

  // Forward Momentum — Hero Action (thwart): Remove 3 threat from a scheme (5 threat instead if you have played an
  // [Attack] event this turn).
  "18007.forward-momentum-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(ifElse(playedThisTurn(query("event", { trait: ATTACK })), 5, 3), chosen("scheme")),
  ),

  // Conditioning Room — Alter-Ego Action: Exhaust Conditioning Room → return the bottommost attack or thwart event
  // from your discard pile to your hand. Heal 1 damage from Gamora.
  "18008.conditioning-room-action": alterEgoAction(
    { cost: exhaustThis },
    moveCards(zone("discard", you, { filter: AN_ATTACK_OR_THWART_EVENT, bottommostOnly: true }), "hand"),
    heal(1, yourIdentity),
  ),

  // Keen Instincts — Resource: Exhaust Keen Instincts → generate a [wild] resource for an attack or thwart event.
  "18009.keen-instincts-resource": heroResource(
    { wild: 1 },
    { cost: exhaustThis, generatesFor: AN_ATTACK_OR_THWART_EVENT },
  ),

  // Gamora's Sword — Restricted (data). Response: After you play an attack event, deal 1 damage to an enemy.
  "18010.gamoras-sword-response": response(after.youPlayedCard(query("event", { trait: ATTACK })), ...damageAnEnemy(1)),

  // Angela — Forced Response: After Angela enters play under your control, search the top 10 cards of the
  // encounter deck for a minion and put it into play engaged with you. Shuffle the encounter deck. If a minion was
  // not put into play this way, discard Angela.
  "18011.angela-forced-response": forcedResponse(
    after.entersPlay("self"),
    chooseCards("found", encounterCards(["deck"], query("minion"), 10), { min: 0, max: 1 }),
    putIntoPlay(chosen("found"), you),
    shuffleEncounterDeck(),
    ifThen(not(refMatches(chosen("found"), query("minion"))), discard(self)),
  ),

  // Clobber — Hero Action (attack): Deal 3 damage to an enemy. If this is the first card you have played this
  // round, return this card to your hand. docs/phase7-wave3.md §3.11.
  "18012.clobber-action": heroAction(
    { label: "attack" },
    ...damageAnEnemy(3),
    ifThen(playedThisRound(1), moveCards(cards(self), "hand")),
  ),

  // Plan of Attack — Action: Search the top 4 cards of your deck (top 7 instead if you are in alter-ego form) for
  // an attack event and add that card to your hand. Shuffle your deck.
  "18013.plan-of-attack-action": action(
    chooseCards(
      "found",
      zone("deck", you, { top: ifElse(isAlterEgo(), 7, 4), filter: query("event", { trait: ATTACK }) }),
      { min: 0, max: 1 },
    ),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Uppercut (18014) reprints Core/wave 1's own Uppercut verbatim — aliased by `../reprints.ts`, not scripted here.

  // First Hit — Hero Action (attack): Deal 2 damage to the villain.
  "18015.first-hit-action": heroAction({ label: "attack" }, dealDamage(2, theVillain)),
  // First Hit — Hero Interrupt (attack): When a minion initiates an attack, deal 2 damage to that minion.
  "18015.first-hit-interrupt": heroInterrupt(when.enemyAttacks(query("minion")), dealDamage(2, eventSource)),

  // Impede — Hero Action (thwart): Remove 3 threat from the main scheme. If this is the first card you have played
  // this round, return this card to your hand.
  "18016.impede-action": heroAction(
    { label: "thwart" },
    removeThreat(3, theMainScheme),
    ifThen(playedThisRound(1), moveCards(cards(self), "hand")),
  ),

  // Combat Training (18017) reprints Core/wave 1's own Combat Training verbatim — aliased by `../reprints.ts`.

  // Godslayer — Restricted (data). Hero Interrupt: When your hero makes a basic attack against a unique enemy,
  // exhaust Godslayer → your hero gets +2 ATK for that attack. docs/phase7-wave3.md §3.26 (`TargetQuery.unique`).
  "18018.godslayer-interrupt": heroInterrupt(
    when.attacks(YOUR_HERO, { basic: true, target: query("enemy", { unique: true }) }),
    { cost: exhaustThis },
    modifyStat("atk", 2, yourIdentity, "endOfAttack"),
  ),

  // Drax (ally) — Play only if your identity has the guardian trait (data, `playRestrictions`). Drax cannot attack
  // minions: `RuleSpec cannotAttack`'s new `attacker` field (docs/phase7-wave3.md §3.26) scopes the restriction to
  // Drax himself, not to whichever player controls him — a different ally or that player's own hero still can.
  "18019.drax-constant": constant(rule({ kind: "cannotAttack", target: query("minion"), attacker: { self: true } })),

  // Hit and Run — Hero Action (attack/thwart): Deal 2 damage to an enemy. Remove 2 threat from a scheme.
  "18020.hit-and-run-constant": heroAction(
    { label: ["attack", "thwart"] },
    ...damageAnEnemy(2),
    ...removeThreatFromAScheme(2),
  ),

  // Pivotal Moment — Hero Action (attack): Deal 2 damage to the villain (5 damage instead if there is no threat on
  // the main scheme).
  "18029.pivotal-moment-action": heroAction(
    { label: "attack" },
    attack(ifElse(valueEquals(threatOn(theMainScheme), 0), 5, 2), theVillain),
  ),

  // Comms Implant — Attach to a guardian ally (data, `attachesTo`). Max 1 per ally (data). Attached ally gets +1
  // THW and +1 hit point.
  "18030.comms-implant-constant": constant(gets("thw", 1, { hostOfSelf: true }), gets("hp", 1, { hostOfSelf: true })),

  // True Grit — Response (thwart): After your hero defends against an enemy attack, remove threat from a scheme
  // equal to your hero's THW.
  "18031.true-grit-response": response(
    after.defends(YOUR_HERO),
    { label: "thwart" },
    aScheme(),
    thwart(statOf(yourIdentity, "thw"), chosen("scheme")),
  ),
});
