import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  attacksGainKeywords,
  boost,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  dealAsEncounterCard,
  dealDamage,
  defineAbilities,
  discard,
  exhaustYourHero,
  exists,
  forcedResponse,
  gets,
  heroAction,
  identityOf,
  isHero,
  moveCards,
  cards,
  on,
  playersWhere,
  query,
  refMatches,
  self,
  spend,
  thatPlayer,
  whenDefeated,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const HAND = trait("HAND");
const ANOTHER_HAND_MINION = exists(query("minion", { trait: HAND, self: false }));
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
 * Text is the MarvelCDB transcription (63028 to 63033).
 *
 * Cards (6):
 * - 63028 Conditioned by the Hand (obligation)
 * - 63029 Aka (minion)
 * - 63030 The Fist Fits in the Hand (side_scheme)
 * - 63031 Hand Katana (attachment)
 * - 63032 Hand Blademaster (minion)
 * - 63033 Hand Archer (minion)
 *
 * **63028**: "Give to the Elektra Natchios player" is engine data. The Forced Response is hero form only, and its
 * damage goes to a character other than her own identity (an ally of hers or another player's identity or ally),
 * chosen by the player the card was given to (RRG 1.8 "Obligation", p. 30: "That player must decide how to resolve the obligation").
 * The alter-ego action exhausts her identity to discard it (the card stays in play otherwise, like Internal Injury).
 *
 * **63029 Aka**: Quickstrike is data. When Defeated shuffles him into the encounter deck. Boost: dealt to the Elektra
 * Natchios player as a facedown encounter card, whoever is attacked (the Cottonmouth shape, 62029).
 *
 * **63030**: the hazard icon is data. **63031**: the host choice (highest base HP Hand minion, else the villain; every
 * tied minion is a candidate, the engine's `superlative` host convention) and +2 ATK are data. **63032**: one bonus
 * while another Hand minion is in play. **63033**: Quickstrike is data; its attacks gain ranged (a starred constant, no
 * longer a keyword).
 */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "63028.obligation": coveredByEngineRule(),
  "63028.conditioned-by-the-hand-forced-response": forcedResponse(
    on.phaseEnding("player"),
    { while: isHero(you) },
    chooseTarget("victim", query(["identity", "ally"], { excluding: yourIdentity })),
    dealDamage(3, chosen("victim")),
  ),
  "63028.conditioned-by-the-hand-action": alterEgoAction({ cost: exhaustYourHero }, discard(self)),

  "63029.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
  "63029.boost": boost(dealAsEncounterCard(self, ELEKTRA_PLAYER)),

  "63030.the-fist-fits-in-the-hand-constant": constant(
    gets("sch", 1, query("minion", { trait: HAND })),
    gets("atk", 1, query("minion", { trait: HAND })),
  ),

  "63031.hand-katana-action": heroAction({ cost: spend(2) }, discard(self)),

  "63032.hand-blademaster-constant": constant(
    gets("sch", 1, { self: true }, { while: ANOTHER_HAND_MINION }),
    gets("atk", 1, { self: true }, { while: ANOTHER_HAND_MINION }),
  ),
  "63032.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),

  "63033.hand-archer-constant": constant(attacksGainKeywords(["ranged"], { attacker: { self: true } })),
  "63033.when-defeated": whenDefeated(moveCards(cards(self), "encounterDeckShuffle")),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
