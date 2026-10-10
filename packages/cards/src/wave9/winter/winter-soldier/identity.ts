import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  after,
  chooseCards,
  chosen,
  defineAbilities,
  putIntoPlay,
  query,
  removeThreatFromAScheme,
  response,
  shuffleDeck,
  spend,
  YOUR_IDENTITY,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/identity` (docs/phase7-wave9.md section 8.4).
 *
 * Cards (1):
 * - 54001a Winter Soldier (hero_identity) / 54001b Bucky Barnes (alter ego)
 *
 * **54001a.lethal-protector** (hero face): "Response: After you attack and defeat an enemy, remove 2 threat from a
 * scheme." An optional response to the identity's own attack, basic or an attack event (`attacks` with `defeats`, the
 * shape Chase Them Down 28011 uses), and only when the attack defeated its target. The 2 threat is removed, not
 * thwarted (the text does not say "thwart", so "after you thwart" does not answer it), from any scheme the player picks.
 * An ally's attack does not trigger it ("you" is the identity, RRG 1.8 "You, Your", p. 49).
 *
 * **54001b.cybernetically-enhanced** (alter-ego face): "Action: Spend 1 resource of any type -> search your deck and
 * discard pile for Cybernetic Arm and put it into play. (Shuffle.)" No limit. The resource is the cost (RRG 1.8
 * "Cost", p. 13), so the action cannot be taken with no resource to spend. The search is compulsory when the card is
 * there (no "may", owner ruling): Cybernetic Arm is unique (deck limit 1), so at most one card matches; it enters play
 * as an upgrade on his identity (not a play, so its cost is not paid). The deck is shuffled afterwards either way
 * (RRG 1.8 "Search", p. 39), also when nothing is found (the Arm already in play, or lost from the game).
 */
export const WINTER_SOLDIER_IDENTITY: AbilityRegistry = defineAbilities({
  "54001a.lethal-protector": response(after.attacks(YOUR_IDENTITY, { defeats: true }), ...removeThreatFromAScheme(2)),

  "54001b.cybernetically-enhanced": alterEgoAction(
    { cost: spend(1) },
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("upgrade", { name: "Cybernetic Arm" }) }), {
      min: 1,
      max: 1,
    }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const WINTER_SOLDIER_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
