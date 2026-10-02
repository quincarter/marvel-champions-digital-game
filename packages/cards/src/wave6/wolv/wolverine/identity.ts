import { trait } from "@mc/content";
import {
  chooseCardCost,
  chosen,
  defineAbilities,
  exhaustThis,
  heal,
  heroAction,
  on,
  playFromHandIgnoringCost,
  printedCostOf,
  putIntoPlayFromSetAside,
  query,
  response,
  self,
  setup,
  takeDamageCost,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const ATTACK = trait("ATTACK");

/**
 * Wolverine / Logan (35001a/b): docs/phase7-wave6.md §6.1, §3.74, §4.1 Q15 = B, Q25. The card data names both refs
 * `.…-constant` (`35001a.wolverine-constant`, `35001b.logan-constant`) although neither is a constant ability; the ids
 * are kept as the data has them so the pack's coverage resolves.
 *
 * - **Healing Factor (35001a, `wolverine-constant`)**: "Response: After the player phase begins, heal 2 damage." Wolverine
 *   heals 2 from his own identity card; optional like every response, and only live in hero form (a face's ability).
 * - **Snikt! (35001b, `logan-constant`)**: "Setup: Put Wolverine's Claws into play." This is Logan's erratum (RRG 1.8
 *   p. 68; the printed card says "Search your deck and discard pile for the Wolverine's Claws upgrade and put it into
 *   play"). Wolverine's Claws is permanent, so it was set aside before setup step 1 (p. 32) and is taken from there,
 *   attached to his identity (§3.74).
 * - **Wolverine's Claws (35002)**: "Hero Action: Exhaust Wolverine's Claws, choose an ATTACK event in your hand, and
 *   take damage equal to its printed cost → play that event, ignoring its resource cost. That attack gains piercing."
 *   (§3.42). The choice and the damage are the cost: the event is picked in the cost (`chooseCardCost`, only one that
 *   can be played ignoring its cost, RRG 1.8 "Cost", p. 13), the damage is its printed cost, taken (not dealt by a
 *   card, §3.41). The play records the Claws (`via`) for Lunging Strike's "If you exhausted Wolverine's Claws to play
 *   this card", and "that attack gains piercing" lasts only while that event resolves (`whileResolving`).
 */
export const WOLVERINE_IDENTITY = defineAbilities({
  "35001a.wolverine-constant": response(on.phaseBeginning("player"), heal(2, yourIdentity)),

  "35002.wolverines-claws-action": heroAction(
    {
      cost: [
        exhaustThis,
        chooseCardCost(
          "event",
          { zone: "hand", player: "you", query: query("event", { trait: ATTACK }) },
          { playableIgnoringCost: true },
        ),
        takeDamageCost(printedCostOf(chosen("event"))),
      ],
    },
    playFromHandIgnoringCost(you, {
      card: chosen("event"),
      via: self,
      whileResolving: [{ kind: "attackKeywords", keywords: ["piercing"], via: { inSlot: "event" } }],
    }),
  ),

  "35001b.logan-constant": setup(
    putIntoPlayFromSetAside("claws", query("upgrade", { name: "Wolverine's Claws" }), { attachTo: yourIdentity }),
  ),
});
