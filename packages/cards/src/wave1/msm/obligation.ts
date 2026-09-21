import { trait } from "@mc/content";
import type { Predicate } from "@mc/engine";
import {
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  each,
  ifThen,
  moveCards,
  not,
  query,
  surge,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const PERSONA = trait("Persona");
/**
 * "If no support was discarded this way": the `discarded` slot is empty. `Predicate.refMatches` (engine `spec.ts`)
 * supports `anywhere` (needed here — by this point the card, if any, has already moved to the discard pile, so the
 * default in-play-only reading would always say "no match"), but `dsl/values.ts`'s `refMatches` builder doesn't
 * expose it, so this is composed as a raw predicate.
 */
const somethingIsBoundTo = (slot: string): Predicate => ({
  kind: "refMatches",
  ref: chosen(slot),
  query: query("support"),
  anywhere: true,
});

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
    effects: [
      chooseCards("discarded", cards(each(query("support", { controller: "you", trait: PERSONA }))), {
        min: 0,
        max: 1,
      }),
      moveCards(cards(chosen("discarded")), "discard"),
      ifThen(not(somethingIsBoundTo("discarded")), surge()),
    ],
  }),
});
