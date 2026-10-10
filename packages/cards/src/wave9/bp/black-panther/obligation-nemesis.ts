import { BP_CARDS } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  anyOfCards,
  atMost,
  boost,
  constant,
  costModifier,
  dealDamage,
  defineAbilities,
  discard,
  each,
  encounterCards,
  encounterSetAside,
  find,
  forcedInterrupt,
  forcedResponse,
  giveBoostCard,
  ifThen,
  isStunned,
  moveThreat,
  on,
  putIntoPlay,
  query,
  chosen,
  removeCountersFrom,
  self,
  selectCards,
  setAside,
  shuffleEncounterDeck,
  stun,
  takeDamage,
  theMainScheme,
  when,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

/** The exact printed name of a Black Panther card, read from its data so no script repeats the string. */
const nameOf = (code: string): string => {
  const card = BP_CARDS.find((c) => (c.id as string) === code);
  if (!card) throw new Error(`no bp card ${code}`);
  return card.name;
};
const MUSIC = nameOf("51034");
const MANIPULATED_MUSIC = nameOf("51033");

/** "Find [a card named X]": the encounter deck and discard pile and the set-aside areas, at most one card. */
const findNamed = (slot: string, type: "minion" | "sideScheme", name: string) =>
  selectCards(
    slot,
    atMost(
      1,
      anyOfCards(
        encounterCards(["deck", "discard"], query(type, { name })),
        setAside(you, query(type, { name })),
        encounterSetAside(query(type, { name })),
      ),
    ),
  );

/**
 * Black Panther's (Shuri) obligation and nemesis set (51031 to 51035), docs/phase7-wave9.md section 7, 3.52.
 *
 * Cards (5):
 * - 51031 T'Challa's Shadow (obligation)
 * - 51032 Klaw (minion)
 * - 51033 Manipulated M.U.S.I.C. (side_scheme)
 * - 51034 M.U.S.I.C. (minion)
 * - 51035 The Scream (treachery)
 *
 * **T'Challa's Shadow (51031)**: "Give to the Shuri player", Uses (4 doubt counters) and Victory 0 are data (the
 * obligation enters its holder's play area when revealed and stays there). Each card its holder plays costs 1 more; its
 * Forced Response removes 1 doubt counter after the holder (their identity, not an ally) thwarts, attacks or defends.
 * Nothing printed happens at 0 counters, and nothing here invents it.
 *
 * **Klaw (51032)**: Forced Interrupt, when he attacks, `giveBoostCard` to himself: an extra facedown boost card for
 * that activation (his normal one is dealt as for any villainous minion).
 *
 * **Manipulated M.U.S.I.C. (51033) / M.U.S.I.C. (51034)**: each finds the other (encounter deck and discard pile,
 * set-aside areas) and puts it into play, not reveals it, so neither's When Revealed loops. M.U.S.I.C. enters engaged
 * with the revealing player. The searched encounter deck is shuffled after (RRG 1.8 "Search", p. 39).
 *
 * **The Scream (51035)**: When Revealed: each character the revealing player controls that is already stunned takes
 * 1 damage, and then every one is stunned (the two are simultaneous in the text, so already-stunned is read first).
 * Boost: the attacked player, if already stunned, takes 1 damage, and is stunned.
 */
export const BLACK_PANTHER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "51031.tchallas-shadow-constant": constant(costModifier({ delta: 1, appliesTo: { controller: "you" } })),
  "51031.tchallas-shadow-forced-response": forcedResponse(
    on.either(on.thwarts(YOUR_IDENTITY), on.youAttackOrDefend()),
    removeCountersFrom(self, "doubt", 1),
  ),

  "51032.klaw-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), giveBoostCard(self, 1)),

  "51033.when-revealed": whenRevealed(
    findNamed("music", "minion", MUSIC),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("music"), you),
  ),
  "51033.when-defeated": whenDefeated(discard(find(query("minion", { name: MUSIC })))),

  "51034.when-revealed": whenRevealed(
    findNamed("manipulated", "sideScheme", MANIPULATED_MUSIC),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("manipulated"), you),
  ),
  "51034.when-defeated": whenDefeated(
    moveThreat(find(query("sideScheme", { name: MANIPULATED_MUSIC })), theMainScheme),
  ),

  "51035.when-revealed": whenRevealed(
    dealDamage(1, each(query("character", { controller: "you", hasStatus: "stunned" }))),
    stun(each(query("character", { controller: "you" }))),
  ),
  "51035.boost": boost(ifThen(isStunned(yourIdentity), takeDamage(1)), stun(yourIdentity)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
