import {
  andThen,
  chosen,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  exists,
  giveTough,
  ifThen,
  printedCostOf,
  query,
  revealCard,
  spend,
  superlative,
  surge,
  whenRevealed,
} from "../../dsl/index.js";
import { heroAction } from "../../dsl/abilities.js";
import { obligation } from "../../core/obligations.js";

/**
 * Crisis on Halfworld (16053), Rocket Raccoon's obligation, and his nemesis set: Vendetta (16054, data only — an
 * amplify side scheme, no ability ref), Blackjack O'Hare (16055, data only — his nemesis minion, no ability ref),
 * Blackjack's Bazooka (16056), Planetary Invasion ×2 (16057).
 */
export const ROCKET_OBLIGATION_NEMESIS = defineAbilities({
  // Crisis on Halfworld — Give to the Rocket Raccoon player. You may flip to alter-ego form. Choose:
  // • Exhaust your alter-ego → remove Crisis on Halfworld from the game.
  // • Discard the highest cost upgrade you control. If no upgrade was discarded this way, this card gains surge.
  //   Discard this obligation. Same "highest cost" shape as Oversized Hands (`twc` 07042).
  "16053.obligation": obligation("Rocket Raccoon", {
    label: "Discard the highest cost upgrade you control. If no upgrade was discarded this way, this card gains surge",
    effects: [
      ifThen(
        exists(query("upgrade", { controller: "you" })),
        discard(
          superlative("highest", each(query("upgrade", { controller: "you" })), printedCostOf(chosen("candidate")), {
            ties: "first",
          }),
        ),
        surge(),
      ),
    ],
  }),

  // Blackjack's Bazooka — Attach to Blackjack O'Hare, if able. If you cannot, attach to the villain (data,
  // `AttachmentHost.ifAble`). Hero Action: Spend [mental][mental][mental] resources → Discard this card.
  "16056.blackjacks-bazooka-action": heroAction({ cost: spend({ mental: 3 }) }, discard({ kind: "self" })),

  // Planetary Invasion — When Revealed: Discard cards from the top of the encounter deck until you discard a
  // minion. Reveal that minion, then give it a tough status card.
  "16057.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion"), "found"),
    // No minion found (the discard itself is "fulfilled", RRG 1.8 "Encounter Deck", p. 17) leaves "Reveal that minion"
    // with nothing to reveal (`revealFoundNothing`), and a reveal whose effects are cancelled is not resolved
    // (`revealCancelled`): either skips the "then" (RRG 1.8 "'Then'", p. 44).
    revealCard(chosen("found")),
    andThen(giveTough(chosen("found"))),
  ),
});
