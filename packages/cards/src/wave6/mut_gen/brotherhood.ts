import { trait } from "@mc/content";
import {
  after,
  attachCard,
  boost,
  chooseTarget,
  chosen,
  constant,
  cards,
  dealIndirectDamage,
  defineAbilities,
  discardAtRandom,
  discardEncounterUntil,
  each,
  encounterCards,
  exhaust,
  eventTarget,
  gainsKeyword,
  gets,
  giveTough,
  ifThen,
  isAttached,
  moveCards,
  oneCopyOf,
  query,
  refMatches,
  revealCard,
  selectCards,
  self,
  shuffleEncounterDeck,
  stun,
  surge,
  totalPrintedResources,
  valueEquals,
  varOf,
  whenRevealed,
  zone,
  you,
  forcedResponse,
} from "../../dsl/index.js";

const BROTHERHOOD_OF_MUTANTS = trait("BROTHERHOOD OF MUTANTS");
const BROTHERHOOD_MINION = query("minion", { trait: BROTHERHOOD_OF_MUTANTS });
const HOST_MINION = query("minion", { hostOfSelf: true });
const ANY_MINION = query("minion");

/**
 * The Brotherhood modular encounter set (`brotherhood`, `mut_gen` 32073-32079, MC32 p. 7 / p. 15, docs/phase7-wave6.md
 * §2.2): the four Brotherhood of Mutants minions (Avalanche, Blob, Pyro, Toad), Homo Superior, Mutant Terrorists and The
 * Brotherhood side scheme. The same four characters are also villains in Mansion Attack (32121-32124, scripted with that
 * scenario); Hinder, Guard and the keywords printed on the cards are data.
 *
 * Every Forced Response here reads "after X attacks you / damages a character": `after.enemyAttacks("self", ...)` with
 * `againstYou` for "attacks you" (the attacked player is the one the effect's "you" is, Sinister Assault's Hobgoblin) and
 * `damages` plus a check on `eventTarget` for "a character you control" (Kraven's shape: the trigger pattern would
 * resolve "you" against an uncontrolled card).
 *
 * **Mutant Terrorists**: "If it did not enter play this way" is the search finding no copy of The Brotherhood
 * (`selectCards.count` 0); the encounter deck is shuffled before the discard-until step, as printed.
 */
export const BROTHERHOOD_ABILITIES = defineAbilities({
  // Avalanche (32073) — Forced Response: After Avalanche attacks you, exhaust a character you control.
  "32073.avalanche-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    chooseTarget("char", query("character", { controller: "you" })),
    exhaust(chosen("char")),
  ),
  // [star] Boost: Exhaust a character you control.
  "32073.boost": boost(chooseTarget("char", query("character", { controller: "you" })), exhaust(chosen("char"))),

  // Blob (32074, Guard is data) — Forced Response: After Blob attacks and damages a character, stun that character.
  "32074.blob-forced-response": forcedResponse(after.enemyAttacks("self", { damages: true }), stun(eventTarget)),

  // Pyro (32075) — Forced Response: After Pyro attacks you, discard the top 2 cards of your deck. Take 1 indirect damage
  // for each printed resource icon discarded this way.
  "32075.pyro-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    selectCards("milled", zone("deck", you, { top: 2 })),
    moveCards(cards(chosen("milled")), "discard"),
    dealIndirectDamage(you, totalPrintedResources(chosen("milled"))),
  ),

  // Toad (32076) — Forced Response: After Toad attacks and damages a character you control, discard 1 random card from
  // your hand.
  "32076.toad-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(refMatches(eventTarget, query("character", { controller: "you" })), discardAtRandom(1)),
  ),
  // [star] Boost: Discard 1 random card from your hand.
  "32076.boost": boost(discardAtRandom(1)),

  // Homo Superior (32077, attaches to a minion: data) — Attach to a minion and give it a tough status card. Otherwise,
  // this card gains surge.
  "32077.homo-superior-constant": whenRevealed(ifThen(isAttached(self), giveTough(each(HOST_MINION)), surge())),
  // Attached minion gets +5 hit points.
  "32077.homo-superior-constant-2": constant(gets("hp", 5, HOST_MINION)),
  // [star] Boost: Attach this card to a minion and give it a tough status card.
  "32077.boost": boost(chooseTarget("host", ANY_MINION), attachCard(self, chosen("host")), giveTough(chosen("host"))),

  // Mutant Terrorists (32078) — When Revealed: Search the encounter deck and discard pile for The Brotherhood side
  // scheme and reveal it. (Shuffle.) If it did not enter play this way, discard cards from the top of the encounter deck
  // until a Brotherhood of Mutants minion is discarded and reveal it.
  "32078.when-revealed": whenRevealed(
    selectCards("scheme", oneCopyOf(encounterCards(["deck", "discard"], { name: "The Brotherhood" }))),
    revealCard(chosen("scheme")),
    shuffleEncounterDeck(),
    ifThen(valueEquals(varOf("scheme.count"), 0), [
      discardEncounterUntil(BROTHERHOOD_MINION, "minion"),
      revealCard(chosen("minion")),
    ]),
  ),

  // The Brotherhood (32079, Hinder 2[per_hero] is data) — Each Brotherhood of Mutants minion gains quickstrike.
  "32079.the-brotherhood-constant": constant(gainsKeyword({ name: "quickstrike" }, BROTHERHOOD_MINION)),
});
