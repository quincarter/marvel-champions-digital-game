import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  aDifferentCard,
  addCounters,
  chooseCards,
  chooseOneBy,
  chooseTarget,
  chosen,
  defineAbilities,
  exists,
  forEachPlayerInChosenOrder,
  eachPlayer,
  moveCards,
  option,
  placeThreat,
  query,
  searchCollection,
  setup,
  shuffleDeck,
  theMainScheme,
  thatPlayer,
  zone,
} from "../../../dsl/index.js";

type EvidenceAspect = "protection" | "justice" | "aggression";
type EvidenceType = "ally" | "upgrade" | "support";

/** "A Board Member environment": the environment face only, the card the cost puts its counter on. */
const BOARD_MEMBER_ENVIRONMENTS = query("environment", { trait: trait("BOARD MEMBER") });

/**
 * The nine evidence cards, by card id: the aspect and the card type each one's Setup names (MC50 p. 6; docs/phase7-wave9.md
 * section 1.16 item 2). Means are allies, motives upgrades and opportunities supports; the aspects run Protection,
 * Justice, Aggression within each.
 */
export const EVIDENCE_SETUPS: Readonly<
  Record<string, { readonly aspect: EvidenceAspect; readonly type: EvidenceType }>
> = {
  "50185": { aspect: "protection", type: "ally" },
  "50186": { aspect: "justice", type: "ally" },
  "50187": { aspect: "aggression", type: "ally" },
  "50188": { aspect: "protection", type: "upgrade" },
  "50189": { aspect: "justice", type: "upgrade" },
  "50190": { aspect: "aggression", type: "upgrade" },
  "50191": { aspect: "protection", type: "support" },
  "50192": { aspect: "justice", type: "support" },
  "50193": { aspect: "aggression", type: "support" },
};

const article = (aspect: EvidenceAspect): string => (aspect === "aggression" ? "an" : "a");

/**
 * An evidence card's Setup (MC50 pp. 6 and 11 to 19; docs/phase7-wave9.md section 3.77), as the effects the campaign's
 * `evidenceSetup` instruction resolves after mulligans, once for each card in the log's `evidence` in the order gained:
 *
 * "Each player may add 1 secret counter to a Board Member environment to search their collection for a different
 * <Aspect> <type> and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck
 * for <a> <Aspect> <type> and add it to their hand. (Shuffle.)"
 *
 * Two sentences, each "each player": the first is offered to every player in player order, then the second. Each offer
 * is the player's to take or decline (a "may" with a cost). The first needs a Board Member environment in play to put
 * the counter on and is not offered without one; its counter can flip that environment (the card's own state check),
 * and a third flip ends the game before the search. A search may find nothing (RRG 1.8 "Search", p. 39), and the cost
 * stays paid. "A different" is a title not among the searching player's own cards (owner decision Q12 = A); a linked
 * card is left out of every collection search by the engine (ruling August 3, 2026 - Ruling 4).
 */
export const evidenceSetupEffects = (aspect: EvidenceAspect, type: EvidenceType): readonly EffectSpec[] => {
  const label = `${aspect[0]!.toUpperCase()}${aspect.slice(1)} ${type}`;
  const inDeck = query(type, { aspect });
  return [
    forEachPlayerInChosenOrder(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          `Add 1 secret counter to a Board Member environment to search your collection for a different ${label} and shuffle it into your deck`,
          { when: exists(BOARD_MEMBER_ENVIRONMENTS) },
          chooseTarget("board", BOARD_MEMBER_ENVIRONMENTS, { chooser: thatPlayer }),
          addCounters("secret", 1, chosen("board")),
          searchCollection({ categories: [type], aspects: [aspect], ...aDifferentCard }, "found", thatPlayer),
          moveCards({ kind: "ref", ref: chosen("found") }, "deckShuffle"),
        ),
        option("Do not add a secret counter"),
      ),
    ),
    forEachPlayerInChosenOrder(
      eachPlayer,
      chooseOneBy(
        thatPlayer,
        option(
          `Add 1 threat to the main scheme to search your deck for ${article(aspect)} ${label} and add it to your hand`,
          placeThreat(1, theMainScheme),
          chooseCards("fetched", zone("deck", thatPlayer, { filter: inDeck }), { min: 0, max: 1, chooser: thatPlayer }),
          moveCards({ kind: "ref", ref: chosen("fetched") }, "hand"),
          shuffleDeck(thatPlayer),
        ),
        option("Do not add a threat"),
      ),
    ),
  ];
};

/** The Setup effect list of one evidence card, by card id (`"50186"`). */
export const evidenceSetupOf = (id: string): readonly EffectSpec[] => {
  const named = EVIDENCE_SETUPS[id];
  if (!named) throw new Error(`${id} is not an evidence card of the Executive Board`);
  return evidenceSetupEffects(named.aspect, named.type);
};

/**
 * Executive Board Evidence (Agents of S.H.I.E.L.D.; docs/phase7-wave9.md section 3.77, module
 * `aos/campaign/executive-board-evidence`). Each of the nine cards prints one "Setup:" ability that applies in the
 * campaign only: a card is never in play, so the campaign's `evidenceSetup` instruction resolves `evidenceSetupOf(id)`,
 * and the registry entries `50185.setup` to `50193.setup` hold the same lists so the coverage guard counts them. In a
 * standalone Baron Zemo game the cards sit in hidden piles and are never in play: MC50 p. 18 says to ignore the text,
 * and the engine resolves a Setup ability only of the cards that are put in play (the tests pin that no offer is made).
 *
 * Cards (9):
 * - 50185 Medical Records (evidence)
 * - 50186 Wiretap (evidence)
 * - 50187 Security Scanner (evidence)
 * - 50188 Money (evidence)
 * - 50189 Blackmail (evidence)
 * - 50190 Ideology (evidence)
 * - 50191 Security Clearance (evidence)
 * - 50192 Travel (evidence)
 * - 50193 Authority (evidence)
 */
export const EXECUTIVE_BOARD_EVIDENCE: AbilityRegistry = defineAbilities(
  Object.fromEntries(Object.keys(EVIDENCE_SETUPS).map((id) => [`${id}.setup`, setup(...evidenceSetupOf(id))] as const)),
);

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXECUTIVE_BOARD_EVIDENCE_SKIPPED: Readonly<Record<string, string>> = {};
