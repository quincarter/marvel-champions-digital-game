import type { AbilityRegistry } from "@mc/engine";
import { agile, constant, costModifier, action } from "./abilities.js";
import { blankTextBoxForPlayers } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eachPlayer, lastPlayedThisRound, query, self, you } from "./values.js";

/**
 * DSL shapes the engine supports that no base card uses yet, so the mod SDK's feature walk over the base registry
 * (`dslFeatures(PLAYABLE_DEPS.abilities)`, `SUPPORTED_DSL_FEATURES`) would not find them, and a custom-content pack that
 * uses them would be refused by a client that can run it (docs/custom-content-packs.md §6, §11.2). One small example
 * definition per primitive, built with the same builders a pack script uses; the SDK walks these with the base
 * registry. Never registered with the engine: no card id here is a real card, and nothing plays them.
 *
 * Add an entry with each engine primitive that lands for custom content before any base card uses it; it can go once a
 * base card does.
 */
export const ENGINE_ONLY_DSL_EXAMPLES: AbilityRegistry = {
  // Agile X: "reduce damage taken from undefended villain and villainous attacks by X" (`reduceDamageTaken`'s
  // `onlyUndefended` and `onlyAttacker`).
  "engine-only.agile": constant(agile(1, { categories: ["hero"], controller: "you" })),
  // "If the last card you played this round was a [title] event, reduce the cost to play this card by 1"
  // (`Predicate lastPlayedThisRound`).
  "engine-only.last-played": constant(
    costModifier({
      delta: -1,
      appliesTo: { self: true },
      activeIn: "hand",
      while: lastPlayedThisRound(query("event", { identitySetOf: you })),
    }),
  ),
  // "Each player who discarded … may treat this card's printed text box as if it were blank" (`blankTextBox`'s
  // `forPlayers`).
  "engine-only.per-player-blank": action(blankTextBoxForPlayers(self, eachPlayer, "endOfPhase")),
};

/** Every example is a valid definition (checked by the DSL's own validator, as `defineAbilities` would). */
export const engineOnlyDslProblems = (): readonly string[] =>
  Object.entries(ENGINE_ONLY_DSL_EXAMPLES).flatMap(([id, definition]) =>
    validateDefinition(definition).map((problem) => `${id}: ${problem}`),
  );
