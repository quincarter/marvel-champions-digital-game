import { trait } from "@mc/content";
import { chooseTarget, chosen, defineAbilities, discard, exists, ifThen, query, surge } from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const PERSONA = trait("Persona");
const PERSONA_SUPPORT_YOU_CONTROL = query("support", { controller: "you", trait: PERSONA });

/**
 * Home by Dawn (05025), Ms. Marvel's obligation. Reuses Core's `obligation()` helper (`../../core/obligations.js`)
 * — the same "give to the alter-ego player / you may flip / choose" shape every wave 1 obligation shares
 * (docs/phase7-wave1-scripting.md §1).
 */
export const MSM_OBLIGATION = defineAbilities({
  // • Exhaust Kamala Khan → remove Home by Dawn from the game. (Shared `obligation()` shape.)
  // • Discard 1 Persona support you control. If no support was discarded this way, this card gains surge. Discard
  //   this obligation. (`obligation()` appends the final "discard this obligation" sentence itself.)
  "05025.obligation": obligation("Kamala Khan", {
    label: "Discard 1 Persona support you control",
    // "Discard 1 Persona support" is not optional: with one in play it goes; only with none does the card surge.
    effects: [
      ifThen(
        exists(PERSONA_SUPPORT_YOU_CONTROL),
        // RRG 1.8 "Obligation" p.30 / "Ability" p.4: the obligation's player decides how to resolve it (specific over "First Player" p.19).
        [chooseTarget("discarded", PERSONA_SUPPORT_YOU_CONTROL), discard(chosen("discarded"))],
        surge(),
      ),
    ],
  }),
});
