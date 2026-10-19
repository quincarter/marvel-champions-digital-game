import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  attachCard,
  boost,
  canAttachToCategory,
  chooseCards,
  chosen,
  confuse,
  countOf,
  defineAbilities,
  dealIndirectDamage,
  discard,
  each,
  encounterCards,
  firstPlayer,
  forcedResponse,
  giveTough,
  identityOf,
  ifThen,
  isAttached,
  not,
  on,
  product,
  perHero,
  query,
  refMatches,
  removeThreat,
  self,
  setVar,
  shuffleEncounterDeck,
  stun,
  sum,
  surge,
  theVillain,
  eventTarget,
  varOf,
  whenRevealed,
} from "../../../dsl/index.js";

const HOST_MINION = query("minion", { hostOfSelf: true });

/**
 * "Attach to the minion with the highest base hit points and give that minion a tough status card. Otherwise, this card
 * gains surge." (60195, 60196.) The host is data (`attachesTo` superlative over printed hit points); the reveal then
 * gives the tough card, or the card gains surge when it found no minion to attach to (as The Fittest, `aoa` 45109).
 * A copy that Beetle attaches by search gets no tough card: "The 'attach to' phrase on a card is not resolved if
 * another ability causes that card to attach to a specific game element" (RRG 1.8 "Attach To", p. 8). Scripted as
 * reveal text, so an effect cancelling When Revealed abilities would also cancel the tough card (no such case yet).
 */
const attachGivesTough = whenRevealed(
  ifThen(isAttached(self), giveTough(each(HOST_MINION))),
  ifThen(not(isAttached(self)), surge()),
);

/**
 * The Tombstone modular set (docs/phase7-wave11-scenarios.md section S6). Quickstrike is data.
 *
 * **60195 Cold as Ice** (+2 SCH is data): `attachGivesTough`. Forced Response: after the attached minion schemes, confuse
 * the first player's identity (RRG 1.8 "First Player", p. 19: the first player is named, not the player it is against)
 * and discard this card.
 * **60196 Hard as Marble** (+2 ATK is data): `attachGivesTough`. Forced Response: after the attached minion attacks, stun
 * the attacked character (the defender, ally or identity; one already defeated is left alone) and discard this card.
 * **60197 Beetle**: Villainous is data. When Revealed: search the encounter deck and discard pile for an attachment whose
 * "attach to" text allows a minion (`canAttachToCategory`, read from card data alone) and attach it to Beetle, the
 * revealing player choosing among the matches; the deck is shuffled after (RRG 1.8 "Search", p. 39). That attach is not a
 * reveal, so the attachment's own "give a tough status card" does not resolve.
 * **60198 Tombstone**: Boost: give the villain a tough status card.
 * **60199 Hit List**: Forced Response after the villain phase begins: deal 3 indirect damage to the first player, who
 * divides it among their characters (RRG 1.8 "Indirect Damage", p. 24). Removes 1[per hero] threat for each ally
 * defeated this way, read as the number of allies in play before minus after (the damage group reports no defeat count).
 *
 * Cards (5):
 * - 60195 Cold as Ice (attachment)
 * - 60196 Hard as Marble (attachment)
 * - 60197 Beetle (minion)
 * - 60198 Tombstone (minion)
 * - 60199 Hit List (side_scheme)
 */
export const FNE_MODULAR_TOMBSTONE: AbilityRegistry = defineAbilities({
  "60195.cold-as-ice-constant": attachGivesTough,
  "60195.cold-as-ice-forced-response": forcedResponse(
    after.enemySchemes("host"),
    confuse(identityOf(firstPlayer)),
    discard(self),
  ),

  "60196.hard-as-marble-constant": attachGivesTough,
  "60196.hard-as-marble-forced-response": forcedResponse(
    after.enemyAttacks("host"),
    ifThen(refMatches(eventTarget, query("character")), stun(eventTarget)),
    discard(self),
  ),

  "60197.when-revealed": whenRevealed(
    chooseCards("attachment", encounterCards(["deck", "discard"], query("attachment", canAttachToCategory("minion"))), {
      min: 1,
      max: 1,
    }),
    attachCard(chosen("attachment"), self),
    shuffleEncounterDeck(),
  ),

  "60198.boost": boost(giveTough(theVillain)),

  "60199.hit-list-forced-response": forcedResponse(
    on.phaseBeginning("villain"),
    setVar("before", countOf(query("ally"))),
    dealIndirectDamage(firstPlayer, 3),
    removeThreat(product(sum(varOf("before"), product(-1, countOf(query("ally")))), perHero(1)), self),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_TOMBSTONE_SKIPPED: Readonly<Record<string, string>> = {};
