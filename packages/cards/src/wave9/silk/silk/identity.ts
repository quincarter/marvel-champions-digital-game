import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  bindTargets,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  discardTuckedCost,
  draw,
  encounterCards,
  eventTarget,
  moveCards,
  on,
  oncePerRound,
  query,
  response,
  self,
  stateCheck,
  tuckCards,
  tuckedCount,
  tuckedUnder,
  tuckedUnderRef,
  valueAtLeast,
} from "../../../dsl/index.js";

/**
 * "If there are more than 4 tucked cards here, discard all but 4 of those cards." (both faces; docs/phase7-wave9.md
 * section 3.39). A state check, so it holds the moment a fifth card lands, whoever tucked it (Silk Sense, Smooth as
 * Silk, a player side scheme). The controller chooses
 * the 4 that stay (the check is edge-triggered, so it resolves once however many cards are over) and every other
 * tucked card goes. A tucked encounter
 * card goes to the encounter discard pile, a player card to its owner's (RRG 1.8 "Tuck", p. 45). The discard is the
 * identity card's own (owner question 7, default A: it counts as "a player card effect" for Hunting the Spider-Bride).
 */
const TUCK_CAP = () =>
  stateCheck(
    valueAtLeast(tuckedCount(), 5),
    chooseCards("kept", tuckedUnder(self), { min: 4, max: 4 }),
    moveCards(cards(tuckedUnderRef(self), { excluding: chosen("kept") }), "discard"),
  );

/**
 * Wave 9 scripting module `silk/silk/identity` (docs/phase7-wave9.md section 8.4, 3.39, 3.40).
 *
 * Cards (1):
 * - 52001a Silk (hero_identity) / 52001b Cindy Moon
 *
 * **52001a.silk-sense** (hero form only, printed on the hero face): "Response: After you defeat a minion or side
 * scheme, or resolve a treachery card, tuck that card under here from the encounter discard pile." An optional
 * response with three triggers ("you defeat": the defeating player, so an ally's defeat is the ally's controller's;
 * "resolve": a treachery this player revealed, not a boost card). The card is bound when the event happens and tucked
 * only if it is in the encounter discard pile when the response resolves: a minion with Victory X sits in the victory
 * display, and a treachery that attached or was shuffled away is elsewhere, so nothing is tucked for them.
 *
 * **52001b.cindy-moon-action** (alter-ego face): "Action: Discard a card tucked here → draw 2 cards. (Limit once per
 * round.)" The discard is the cost (RRG 1.8 "Cost", p. 13): with nothing tucked the action cannot be initiated, with
 * several the player chooses which, and it goes to its owner's discard pile (an encounter card to the encounter
 * discard pile). It makes the same move as an effect's discard of a tucked card (owner question 7, default A).
 */
export const SILK_IDENTITY: AbilityRegistry = defineAbilities({
  "52001a.silk-constant": TUCK_CAP(),
  "52001a.silk-sense": response(
    after.either(
      on.defeated(query("minion"), { byYou: true }),
      { ...on.schemeDefeated(query("sideScheme")), playerIs: "controller" },
      on.youResolveTreachery(),
    ),
    bindTargets("tuck", eventTarget),
    tuckCards(encounterCards(["discard"], { inSlot: "tuck" }), self),
  ),
  "52001b.cindy-moon-constant": TUCK_CAP(),
  "52001b.cindy-moon-action": action({ cost: discardTuckedCost(), limit: oncePerRound }, draw(2)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const SILK_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
