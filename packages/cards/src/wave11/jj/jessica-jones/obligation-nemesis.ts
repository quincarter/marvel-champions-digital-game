import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  after,
  alterEgoAction,
  canPlayFromHand,
  canTakeStatus,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  defineAbilities,
  discardFromHandCost,
  each,
  eventTarget,
  exhaustThis,
  exists,
  forcedAction,
  forcedResponse,
  formChangeCost,
  gets,
  highestStatAmong,
  moveCards,
  option,
  placeThreat,
  playFromHandReducingCost,
  query,
  removeCounter,
  self,
  theMainScheme,
  whenRevealed,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `jj/jessica-jones/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 61030 Work-Life Balance (obligation)
 * - 61031 Purple Man (minion)
 * - 61032 Indomitable Will (side_scheme)
 * - 61033a Suggestion (obligation)
 * - 61033b Suggestion (obligation)
 * - 61033c Suggestion (obligation)
 *
 * **61030**: the extra cost to change forms is a `formChangeCost` (either way, at any time). The Alter-Ego Action's two
 * "→" options are offered only while their cost can be paid (an ally you control; room for a confused card on your
 * identity), and the cost steps come first in each option. **61031**: SCH and ATK are bases that read the other
 * characters (HT5, H3.10; excluding himself is an engine reading). **61032**: Hinder 3 per player is data.
 * **61033a-c**: Uses is data; the card data gives its paragraph a `-constant` ref, which the coverage guard needs
 * registered, so each is an empty `constant()` (no behavior is invented). The play option is gated by `canPlayFromHand`
 * (RRG 1.8 pp. 12, 24): offered only while a card with that printed icon can be played and paid for.
 */
const PHEROMONE = "pheromone";
const SUGGESTION = query("obligation", { name: "Suggestion" });

/** One Suggestion's Forced Action; `icon` is the printed resource icon of the cards it lets the player play. */
const suggestion = (icon: "energy" | "mental" | "physical") =>
  forcedAction(
    { cost: [exhaustThis, removeCounter(PHEROMONE, 1)] },
    chooseOne(
      option(
        `Play a card with a printed [${icon}] resource icon`,
        { when: canPlayFromHand({ printedResource: icon }) },
        playFromHandReducingCost(0, you, { filter: { printedResource: icon }, mustPay: true }),
      ),
      option("Add 2 threat to the main scheme", placeThreat(2, theMainScheme)),
    ),
  );

export const JJ_JESSICA_JONES_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "61030.work-life-balance-constant": constant(formChangeCost(you, discardFromHandCost(1, 1))),
  "61030.work-life-balance-action": alterEgoAction(
    chooseOne(
      option(
        "Remove an ally you control from the game",
        { when: exists(query("ally", { controller: "you" })) },
        chooseTarget("ally", query("ally", { controller: "you" })),
        moveCards(cards(chosen("ally")), "removedFromGame"),
        moveCards(cards(self), "removedFromGame"),
      ),
      option(
        "Confuse your identity",
        { when: exists(query("identity", { controller: "you", ...canTakeStatus("confused") })) },
        confuse(yourIdentity),
        moveCards(cards(self), "discard"),
      ),
    ),
  ),

  "61031.purple-man-constant": constant(
    gets("sch", highestStatAmong(["sch", "thw"]), { self: true }, { setBase: true }),
    gets("atk", highestStatAmong(["atk"]), { self: true }, { setBase: true }),
  ),

  "61032.when-revealed": whenRevealed(addCounters(PHEROMONE, 2, each(SUGGESTION))),
  "61032.indomitable-will-forced-response": forcedResponse(
    after.entersPlay(SUGGESTION),
    addCounters(PHEROMONE, 2, eventTarget),
  ),

  "61033a.suggestion-constant": constant(),
  "61033a.suggestion-forced-action": suggestion("energy"),
  "61033b.suggestion-constant": constant(),
  "61033b.suggestion-forced-action": suggestion("mental"),
  "61033c.suggestion-constant": constant(),
  "61033c.suggestion-forced-action": suggestion("physical"),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
