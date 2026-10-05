import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  chooseCards,
  chosen,
  coveredByEngineRule,
  defineAbilities,
  oncePerPhase,
  putIntoPlay,
  query,
  ready,
  response,
  setup,
  shuffleDeck,
  yourIdentity,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * "After Cable defeats a side scheme": a `schemeDefeated` whose source (the thwarting character, or the card whose
 * effect removed the last threat) is Cable or one of his extensions (RRG "You, Your", p. 49: an event he plays). It
 * lives in the pattern, not in an `ifThen`, so the response is not offered at all when somebody else defeats the
 * scheme. There is no DSL builder for "defeats a scheme" alone (`on.defeats` also hears characters), so the engine
 * pattern is written out.
 */
const CABLE_DEFEATS_A_SIDE_SCHEME: EventPattern = { on: "schemeDefeated", sourceIs: { extensionOf: you } };

/**
 * Cable / Nathan Summers (40001a/b): docs/phase7-wave7.md §7.1, §3.1, §3.2, §3.52.
 *
 * - **Cable (40001a), Response**: after Cable defeats a side scheme (player or encounter), ready him, once per phase.
 *   "Cable defeats" is `refMatches(eventSource, { extensionOf: you }, anywhere)` on `schemeDefeated`, the Valkyrie /
 *   Death-Glow shape: his basic thwart, Mind Scan, Askani'son and the like count, his allies and an encounter effect
 *   do not (the source is the thwarting character, or else the card whose effect removed the last threat). The ability
 *   is printed on the hero face, so it is only heard in hero form.
 * - **Nathan Summers (40001b), constant**: "You may include player side schemes from any aspect in your deck" is
 *   deckbuilding data (`IdentityDeckbuilding.offAspectAllowance`), no ability of its own.
 * - **Soldier X (40001b), Setup**: search the deck and discard pile for a player side scheme, put it into play,
 *   shuffle. The scheme enters play through the player side scheme limit like any other (§3.2).
 */
export const CABLE_IDENTITY: AbilityRegistry = defineAbilities({
  "40001a.cable-response": response(CABLE_DEFEATS_A_SIDE_SCHEME, { limit: oncePerPhase }, ready(yourIdentity)),

  "40001b.nathan-summers-constant": coveredByEngineRule(),

  "40001b.soldier-x": setup(
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("sideScheme") }), { min: 1, max: 1 }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
  ),
});
