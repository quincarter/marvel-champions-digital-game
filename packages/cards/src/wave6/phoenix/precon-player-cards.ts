import { trait } from "@mc/content";
import { amount, defineAbilities, eventTarget, interrupt, on, query } from "../../dsl/index.js";

const THWART = trait("THWART");

/**
 * The Phoenix pack's aspect and basic cards no hero folder owns (`phoenix` 34020; docs/phase7-wave6.md).
 *
 * - **Passion for Justice (34020)**: Aggressive Energy's threat-removal twin. `modifyCardEffect` on the event being
 *   paid for, `threatRemoved` +1 (the Shrink shape), offered only for a THWART event.
 */
export const PHOENIX_PRECON_PLAYER_CARDS = defineAbilities({
  // "Interrupt", not "Hero Interrupt": a THWART event played in alter-ego form is paid for with it too.
  "34020.passion-for-justice-interrupt": interrupt(on.youSpendThis({ toPlay: query("event", { trait: THWART }) }), {
    kind: "modifyCardEffect",
    card: eventTarget,
    threatRemoved: amount(1),
  }),
});
