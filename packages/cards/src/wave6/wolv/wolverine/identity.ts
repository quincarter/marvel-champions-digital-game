import {
  defineAbilities,
  heal,
  on,
  putIntoPlayFromSetAside,
  query,
  response,
  setup,
  yourIdentity,
} from "../../../dsl/index.js";

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
 */
export const WOLVERINE_IDENTITY = defineAbilities({
  "35001a.wolverine-constant": response(on.phaseBeginning("player"), heal(2, yourIdentity)),

  "35001b.logan-constant": setup(
    putIntoPlayFromSetAside("claws", query("upgrade", { name: "Wolverine's Claws" }), { attachTo: yourIdentity }),
  ),
});
