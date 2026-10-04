import { trait } from "@mc/content";
import type { AbilityRegistry, Predicate } from "@mc/engine";
import {
  boost,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  defineAbilities,
  discard,
  each,
  encounterCards,
  engage,
  enemyActivates,
  exists,
  host,
  ifThen,
  isAttached,
  moveCards,
  oneCopyOf,
  query,
  revealCard,
  rule,
  selectCards,
  self,
  shuffleEncounterDeck,
  surge,
  treatAttachedAllyAsMinion,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const CONTROLLED = trait("CONTROLLED");
const POSSESSED = "Possessed";
const CONTROLLED_MINION = query("minion", { trait: CONTROLLED });
const controlledMinionInPlay: Predicate = exists(CONTROLLED_MINION);

/**
 * The Shadow King modular set (`shadow_king`, `storm` 36036-36039; docs/phase7-wave6.md §2, §3.58): The Shadow King
 * (minion), Ruler of the Astral Plane (side scheme), Possessed x2 (attachment) and Astral Attack (treachery).
 *
 * - A CONTROLLED minion is an ally an attached Possessed treats as a minion (Beguiled's shape, `treatHostAsMinion`);
 *   no card in this set makes any other kind of CONTROLLED minion.
 * - **Possessed** (erratum, RRG 1.8 p. 68): "Attached ally engages its controller" is the Beguiled model; the host is
 *   `attachesTo` data (lowest THW without Possessed), and no host means the card gains surge.
 * - **Astral Attack**: every CONTROLLED minion in play activates, engaged with the player or not.
 */
export const SHADOW_KING_ABILITIES: AbilityRegistry = defineAbilities({
  // The Shadow King — While a Controlled minion is in play, he cannot take damage.
  "36036.the-shadow-king-constant": constant(
    rule({
      kind: "cannotTakeDamage",
      target: query("minion", { name: "The Shadow King" }),
      while: controlledMinionInPlay,
    }),
  ),
  // When Revealed: search the encounter deck and discard pile for a copy of Possessed and reveal it. (Shuffle.)
  "36036.when-revealed": whenRevealed(
    selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], query("attachment", { name: POSSESSED })))),
    revealCard(chosen("found"), you),
    shuffleEncounterDeck(),
  ),

  // Ruler of the Astral Plane — Acceleration (data). When Defeated: discard 1 copy of Possessed from play.
  "36037.when-defeated": whenDefeated(
    chooseTarget("possessed", query("attachment", { name: POSSESSED })),
    discard(chosen("possessed")),
  ),
  // [star] Boost: if you are engaged with a Controlled minion, reveal this card.
  "36037.boost": boost(
    ifThen(exists(query("minion", { trait: CONTROLLED, engagedWith: "you" })), revealCard(self, you)),
  ),

  // Possessed — Treat attached ally as a Controlled minion with a blank text box (SCH = printed THW, no consequential
  // damage). When Revealed: attached ally engages its controller; with no host, this card gains surge.
  "36038.possessed-constant": constant(treatAttachedAllyAsMinion([CONTROLLED])),
  "36038.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  // Astral Attack — each Controlled minion activates against you; none in play: surge.
  "36039.when-revealed": whenRevealed(
    ifThen(controlledMinionInPlay, enemyActivates(each(CONTROLLED_MINION), { against: you }), surge()),
  ),
  // [star] Boost: shuffle each Shadow King card from the discard pile into the encounter deck.
  "36039.boost": boost(
    moveCards(
      encounterCards(["discard"], query(["minion", "sideScheme", "attachment", "treachery"], { encounterSetOf: self })),
      "encounterDeckShuffle",
    ),
  ),
});
