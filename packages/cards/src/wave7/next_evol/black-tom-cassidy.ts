import type { AbilityRegistry, RuleSpec } from "@mc/engine";
import {
  boost,
  chosen,
  constant,
  defineAbilities,
  each,
  encounterCards,
  enemyAttack,
  eventTarget,
  forcedResponse,
  gainsKeyword,
  ifThen,
  made,
  not,
  after,
  oneCopyOf,
  otherPlayers,
  putIntoPlay,
  query,
  searchAndReveal,
  selectCards,
  shuffleEncounterDeck,
  stun,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";

/**
 * The Black Tom Cassidy modular set (40132-40135): Black Tom, four copies of Creeping Willow, Making Green and A Sound
 * Thrashing. Villainous, guard, quickstrike and hinder are card data.
 */
const WILLOW = "Creeping Willow";
const WILLOWS = query("minion", { name: WILLOW });

export const BLACK_TOM_CASSIDY: AbilityRegistry = defineAbilities({
  // Black Tom Cassidy — cannot take damage while Creeping Willow is in play (any copy, any player's).
  "40132.black-tom-cassidy-constant": constant({
    rules: [
      {
        kind: "cannotTakeDamage",
        target: query("minion", { self: true }),
        while: { kind: "exists", query: WILLOWS },
      } as RuleSpec,
    ],
  }),
  // When Revealed: Search the encounter deck and discard pile for 1 copy of Creeping Willow and put it into play engaged
  // with you. (Shuffle.) One copy (they are identical); the deck is shuffled whether or not one was found.
  "40132.when-revealed": whenRevealed(
    selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], WILLOWS))),
    putIntoPlay(chosen("found"), you),
    shuffleEncounterDeck(),
  ),

  // Creeping Willow — [star] Forced Response: After Creeping Willow attacks and damages a character, stun that
  // character: the character the attack targeted (the defender when an ally defended).
  "40133.creeping-willow-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    stun(eventTarget),
  ),
  // [star] Boost: You are stunned.
  "40133.boost": boost(stun(yourIdentity)),

  // Making Green — Hinder 2[per_hero] (data). Each copy of Creeping Willow gains surge (also while it is being revealed:
  // wave 6 §3.65).
  "40134.making-green-constant": constant(gainsKeyword({ name: "surge" }, WILLOWS)),

  // A Sound Thrashing — When Revealed: Each copy of Creeping Willow attacks the player it is engaged with (even if that
  // player is in alter-ego form). If you were not attacked this way, search the encounter deck and discard pile for a
  // copy of Creeping Willow and reveal it. (Shuffle.) The Willows engaged with you attack first, then the others'; "you
  // were not attacked" reads only your own Willows' attacks (a stunned one discards its stun instead and makes none).
  "40135.when-revealed": whenRevealed(
    enemyAttack(each(query("minion", { name: WILLOW, engagedWithPlayer: you })), { bind: "mine" }),
    enemyAttack(each(query("minion", { name: WILLOW, engagedWithPlayer: otherPlayers() })), { bind: "others" }),
    ifThen(not(made("mine")), searchAndReveal(WILLOW)),
  ),
});
