import { trait } from "@mc/content";
import { amount, defineAbilities, eventTarget, heroInterrupt, on, query } from "../../dsl/index.js";

const THWART = trait("THWART");

/**
 * The Phoenix pack's aspect and basic cards no hero folder owns (`phoenix` 34020; docs/phase7-wave6.md).
 *
 * - **Passion for Justice (34020)**: Aggressive Energy's threat-removal twin. `modifyCardEffect` on the event being
 *   paid for, `threatRemoved` +1 (the Shrink shape), offered only for a THWART event.
 */
export const PHOENIX_PRECON_PLAYER_CARDS = defineAbilities({
  "34020.passion-for-justice-interrupt": heroInterrupt(on.youSpendThis({ toPlay: query("event", { trait: THWART }) }), {
    kind: "modifyCardEffect",
    card: eventTarget,
    threatRemoved: amount(1),
  }),
});
