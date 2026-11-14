import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  boost,
  chooseTarget,
  chosen,
  constant,
  countOf,
  coveredByEngineRule,
  dealAsEncounterCard,
  dealDamage,
  defineAbilities,
  discard,
  exhaustYourHero,
  forcedResponse,
  gets,
  identityOf,
  isHero,
  moveCards,
  cards,
  on,
  playersWhere,
  query,
  refMatches,
  self,
  thatPlayer,
  whenDefeated,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const HAND = trait("HAND");
/**
 * "The Elektra Natchios player": the player whose identity is Elektra in either face (the hero face is titled Elektra,
 * the alter-ego Elektra Natchios; RRG 1.8 "Obligation", p. 30). `query("identity", { name })` reads the face that is
 * up, so both names are matched (the Magik shape, wave8/aoa/magik/obligation-nemesis.ts).
 */
const ELEKTRA_PLAYER = playersWhere(
  refMatches(
    identityOf(thatPlayer),
    query("identity", {
      anyOf: [query("identity", { name: "Elektra" }), query("identity", { name: "Elektra Natchios" })],
    }),
  ),
);

/**
 * Wave 11 scripting module `elektra/elektra/obligation-nemesis` (docs/phase7-elektra-iron-fist.md).
 *
 * **PROVISIONAL**: the text of all five cards is the recorded text from the gameplay video and the unofficial fan
 * preview (spec section 3), with placeholder codes; the nemesis set's other cards and copy counts are unknown (the
 * Blademaster may be two copies). Scripted as recorded; recheck against the printed cards when they are available.
 *
 * Cards (5):
 * - 63040 Conditioned by the Hand (obligation)
 * - 63041 Aka (minion)
 * - 63042 The Fist Fits in the Hand (side_scheme)
 * - 63044 Hand Blademaster (minion)
 * - 63045 Hand Archer (minion)
 *
 * **63040**: "Give to the Elektra Natchios player" is engine data. The Forced Response is hero form only, and its
 * damage goes to a character other than her own identity (an ally of hers or another player's identity or ally),
 * chosen by the player the card was given to (RRG 1.8 "Obligation", p. 30: "That player must decide how to resolve the obligation").
 * The alter-ego action exhausts her identity to discard it (the card stays in play otherwise, like Internal Injury).
 *
 * **63041 Aka**: Quickstrike is data. When Defeated shuffles him into the encounter deck. Boost: dealt to the Elektra
 * Natchios player as a facedown encounter card, whoever is attacked (the Cottonmouth shape, 62029).
 *
 * **63042**: the crisis icon is data. **63044**: counts only other Hand minions. **63045**: Quickstrike and Ranged are data.
 */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "63040.obligation": coveredByEngineRule(),
  "63040.conditioned-by-the-hand-forced-response": forcedResponse(
    on.phaseEnding("player"),
    { while: isHero(you) },
    chooseTarget("victim", query(["identity", "ally"], { excluding: yourIdentity })),
    dealDamage(3, chosen("victim")),
  ),
  "63040.conditioned-by-the-hand-action": alterEgoAction({ cost: exhaustYourHero }, discard(self)),

  "63041.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
  "63041.boost": boost(dealAsEncounterCard(self, ELEKTRA_PLAYER)),

  "63042.the-fist-fits-in-the-hand-constant": constant(
    gets("sch", 1, query("minion", { trait: HAND })),
    gets("atk", 1, query("minion", { trait: HAND })),
  ),

  "63044.hand-blademaster-constant": constant(
    gets("sch", countOf(query("minion", { trait: HAND, self: false })), { self: true }),
    gets("atk", countOf(query("minion", { trait: HAND, self: false })), { self: true }),
  ),
  "63044.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),

  "63045.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
