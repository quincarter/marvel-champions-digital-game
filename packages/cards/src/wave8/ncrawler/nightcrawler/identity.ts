import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  moveCards,
  oncePerPhase,
  oncePerRound,
  oneCopyOf,
  query,
  shuffleDeck,
  spend,
  you,
  zone,
} from "../../../dsl/index.js";

/** "a copy of Bamf!": the upgrade by printed name (48006, three copies in his deck). */
const BAMF = query("upgrade", { name: "Bamf!" });

/**
 * Nightcrawler / Kurt Wagner (48001a/b): docs/phase7-wave8.md §7.4, §3.72. Bamf! (48006) itself is the support module's.
 *
 * Cards (1):
 * - 48001a Nightcrawler (hero_identity)
 *
 * **Rapid Teleportation (48001a)**, Action: spend 1 resource of any type (a resource cost of 1, `spend(1)`, paid like
 * any other) to return a copy of Bamf! from your discard pile to your hand; once per phase. Nothing is played, so no
 * play permission is involved.
 *
 * **Kurt Wagner (48001b)**, Action: search your deck (only) for a copy of Bamf! and add it to your hand; once per
 * round. A searched deck is shuffled afterward, found or not (RRG 1.8 "Search", p. 39). Both faces print a plain
 * "Action:", so each is `action`, not `heroAction` / `alterEgoAction`: the face that shows decides which is available.
 */
export const NIGHTCRAWLER_IDENTITY: AbilityRegistry = defineAbilities({
  "48001a.rapid-teleportation": action(
    { cost: spend(1), limit: oncePerPhase },
    chooseCards("copy", zone("discard", you, { filter: BAMF }), { min: 1, max: 1 }),
    moveCards(cards(chosen("copy")), "hand"),
  ),

  "48001b.kurt-wagner-action": action(
    { limit: oncePerRound },
    moveCards(oneCopyOf(zone("deck", you, { filter: BAMF })), "hand"),
    shuffleDeck(),
  ),
});
