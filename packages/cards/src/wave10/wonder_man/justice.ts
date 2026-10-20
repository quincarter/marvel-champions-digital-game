import type { AbilityRegistry } from "@mc/engine";
import {
  YOUR_HERO,
  YOUR_IDENTITY,
  addCounters,
  after,
  canRemoveThreatFrom,
  canTakeStatus,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  damageOn,
  dealDamage,
  defineAbilities,
  discardEncounterCards,
  each,
  encounterCards,
  forcedInterrupt,
  forcedResponse,
  gets,
  giveStatus,
  heal,
  healCost,
  heroAction,
  ifThen,
  instead,
  interrupt,
  not,
  on,
  placeThreat,
  query,
  removeCounter,
  resolveWhenRevealedOf,
  response,
  revealCard,
  scaled,
  selectCards,
  self,
  shuffleEncounterDeck,
  sum,
  theMainScheme,
  thwart,
  varAtLeast,
  varOf,
  when,
} from "../../dsl/index.js";

/**
 * Wave 10 scripting module `wonder_man/justice` (docs/phase7-wave10-hero-packs.md H8.4).
 *
 * Cards (7):
 * - 58012 Firebird (ally)
 * - 58013 Hawkeye (ally)
 * - 58014 Scarlet Witch (ally)
 * - 58015 Sentry (ally)
 * - 58016 Battlefield Benevolence (event)
 * - 58018 Everywhere All at Once (event)
 * - 58021 Heroic Conditioning (upgrade)
 *
 * **58012 Firebird.** The constant "If you overpaid for Firebird, put 1 rebirth counter on her" is a forced interrupt
 * to entering play reading the play's `overpaid.total` (the shape of Ant-Man 12011; RRG 1.8 "Cost", p. 13: resources
 * generated beyond the cost are overpaid). A Firebird put into play by another card was not played, so nothing was
 * overpaid and she gets no counter. The Interrupt is optional (no "Forced"): "When Firebird would be defeated by
 * consequential damage, remove 1 rebirth counter from her -> heal all damage from her instead" replaces the defeat
 * (RRG 1.8 "'Would'", p. 48) and only a defeat by her own consequential damage (RRG 1.8 "Consequential Damage",
 * p. 13) counts. Her damage from an enemy attack, or any other source, is not covered.
 *
 * **58013 Hawkeye.** "enters play with 4 arrow counters" is the shape of Core's Hawkeye (not the Uses keyword). The
 * Response follows any ally's basic thwart, Hawkeye's own included, and costs one arrow counter: 2 damage to a minion
 * you choose, whoever it is engaged with.
 *
 * **58014 Scarlet Witch.** After she is played (not when put into play) the top card of the encounter deck is discarded;
 * a treachery's "When Revealed" abilities resolve, its incite and surge included (FFG ruling, September 22, 2026:
 * surge is a type of When Revealed ability; owner decision 2026-10-20, revising docs/phase7-wave4.md §4 Q23), as for
 * Mighty Avengers 56076. Any other card type only stays discarded.
 *
 * **58015 Sentry.** Searches the encounter deck (not its discard pile) for a side scheme, you pick which, and reveals
 * it, then shuffles. When the deck holds none, 6 threat go on the main scheme. RRG 1.8 "Search", p. 39.
 *
 * **58016 Battlefield Benevolence.** "Hero Action: Heal 2 damage from an enemy -> confuse that enemy." Printed with no
 * label. The heal is the cost (`healCost`, H3.17): an enemy with at least 2 damage, not already confused, is the
 * only valid choice, and the heal is paid before the status. RRG 1.8 "Cost", p. 14.
 *
 * **58018 Everywhere All at Once.** Cost X (the player names it); "Hero Action (thwart): Choose X schemes. Remove 2
 * threat from each chosen scheme (3 threat instead if you overpaid for this card)." X chosen schemes, each thwarted for
 * 2, or 3 with any resource overpaid (`overpaid.total`), as one thwart of `2 + min(1, overpaid)`. Play restriction
 * (Aerial identity) is card data. The choice is of a variable count, which the engine's initiation check does not
 * judge (a required choice needs a fixed count), so the action is gated by `while: canRemoveThreatFrom(a scheme holding
 * threat)`: RRG 1.8 "Choose (Game Element)" (p. 12) and "Target" (p. 42), an ability with no valid target cannot be
 * initiated, so with no threat on any scheme it cannot be played, at any X. X is at least 1 (`minX: 1`): at X = 0 the
 * card would choose no scheme and remove no threat, so it cannot be played that way, and the engine refuses the play
 * with "X must be at least 1" (the owner's answer 52B, 2026-10-13, docs/phase7-wave10.md §4.0). The owner's reading
 * of the rules above; no FFG ruling names the card.
 *
 * **58021 Heroic Conditioning.** "You get +3 hit points and your hero gets +1 THW." Played under any player's control;
 * "you" is the controller and "your hero" is that player's identity in hero form. Max 1 per player is card data.
 *
 * No ruling in marvel-champions-rulings-post-rrg-1-7.md (December 17, 2025 to August 13, 2026) names these cards.
 * January 17, 2026 - Ruling 4 (1) (a wild resource may be named as any type, also when overpaying) is read by the
 * engine's overpayment, which these cards use.
 */
export const WONDER_MAN_JUSTICE: AbilityRegistry = defineAbilities({
  "58012.firebird-constant": forcedInterrupt(
    on.entersPlay("self"),
    ifThen(varAtLeast("overpaid.total"), addCounters("rebirth", 1, self)),
  ),
  "58012.firebird-interrupt": interrupt(
    when.defeated("self", { consequential: true }),
    { would: true, cost: removeCounter("rebirth") },
    instead(heal(damageOn(self), self)),
  ),

  "58013.hawkeye-constant": forcedResponse(after.entersPlay("self"), addCounters("arrow", 4)),
  "58013.hawkeye-response": response(
    after.thwarts(query("ally"), { basic: true }),
    { cost: removeCounter("arrow") },
    chooseTarget("minion", query("minion")),
    dealDamage(2, chosen("minion")),
  ),

  "58014.scarlet-witch-forced-response": forcedResponse(
    after.youPlayThis(),
    discardEncounterCards(1, { bind: "discarded" }),
    selectCards("treachery", cards(chosen("discarded"), query("treachery"))),
    ifThen(varAtLeast("treachery.count"), resolveWhenRevealedOf(chosen("treachery"))),
  ),

  "58015.sentry-forced-response": forcedResponse(
    after.entersPlay("self"),
    chooseCards("pick", encounterCards(["deck"], query("sideScheme")), { min: 1, max: 1 }),
    selectCards("found", cards(chosen("pick"))),
    revealCard(chosen("found")),
    shuffleEncounterDeck(),
    ifThen(not(varAtLeast("found.count")), placeThreat(6, theMainScheme)),
  ),

  "58016.battlefield-benevolence-action": heroAction(
    { cost: healCost({ ...query("enemy"), ...canTakeStatus("confused") }, 2) },
    giveStatus(chosen("healed"), "confused"),
  ),

  "58018.everywhere-all-at-once-action": heroAction(
    { label: "thwart", minX: 1, while: canRemoveThreatFrom(each(query("scheme", { hasThreat: true }))) },
    chooseTarget("schemes", query("scheme"), { count: varOf("x") }),
    thwart(sum(2, scaled(varOf("overpaid.total"), { times: 1, max: 1 })), chosen("schemes")),
  ),

  "58021.heroic-conditioning-constant": constant(gets("hp", 3, YOUR_IDENTITY), gets("thw", 1, YOUR_HERO)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const WONDER_MAN_JUSTICE_SKIPPED: Readonly<Record<string, string>> = {};
