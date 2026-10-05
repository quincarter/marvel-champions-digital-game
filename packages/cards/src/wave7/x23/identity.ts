import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  chooseCardCost,
  chosen,
  defineAbilities,
  draw,
  heroResponse,
  moveCards,
  cards,
  on,
  oncePerPhase,
  oncePerRound,
  putIntoPlayFromSetAside,
  query,
  ready,
  setup,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

/** "either the Honey Badger ally or the Sisterly Bond event": a title and a type each. */
const HONEY_BADGER_OR_SISTERLY_BOND = {
  anyOf: [query("ally", { name: "Honey Badger" }), query("event", { name: "Sisterly Bond" })],
} as const;

/**
 * X-23 / Laura Kinney (43001a/b): docs/phase7-wave7.md §7.3, §3.85. Stats and hand size are data (hero THW 2, ATK 1,
 * DEF 2, hand size 5, 10 hit points; alter-ego REC 6, hand size 6).
 *
 * - **Living Weapon (43001a)**, hero Response: after X-23 takes any amount of damage, ready X-23, once per phase.
 *   `taken: true` is "any amount": damage a tough status card or another effect wholly prevented is not taken (RRG
 *   "Damage", p. 14). Cost damage counts (X-23's Claws, Grim Resolve), in either phase. The identity is never
 *   discarded, so the "defeated before the response" case of §3.85 does not arise for her. Readying an identity that
 *   is already ready is still a legal trigger and uses the limit.
 * - **Shhnk! (43001b)**, Setup: her permanent X-23's Claws (43002) goes into play, attached to her identity as an
 *   upgrade play would attach it (RRG "Permanent", p. 32). It has no other module: its own Action is the upgrades
 *   module's.
 * - **Laura Kinney (43001b)**, Action: shuffle either Honey Badger or Sisterly Bond from your discard pile into your
 *   deck -> draw 1 card, once per round. The shuffle is the cost (the card is chosen while paying, so with neither in
 *   the discard pile the Action cannot be started and the limit is not used).
 */
export const X23_IDENTITY: AbilityRegistry = defineAbilities({
  "43001a.living-weapon": heroResponse(
    on.damage(YOUR_IDENTITY, { taken: true }),
    { limit: oncePerPhase },
    ready(yourIdentity),
  ),

  "43001b.shhnk": setup(
    putIntoPlayFromSetAside("claws", query("upgrade", { name: "X-23's Claws" }), { attachTo: yourIdentity }),
  ),

  "43001b.laura-kinney-action": alterEgoAction(
    {
      limit: oncePerRound,
      cost: chooseCardCost("card", { zone: "discard", player: "you", query: HONEY_BADGER_OR_SISTERLY_BOND }),
    },
    moveCards(cards(chosen("card")), "deckShuffle"),
    draw(1),
  ),
});
