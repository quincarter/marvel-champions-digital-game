import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import { action, agile, constant, costModifier, forcedInterrupt, heroInterrupt, on, tagged } from "./abilities.js";
import {
  blankTextBoxForPlayers,
  cancelIt,
  dealDamage,
  draw,
  giveBasicPowerBoostCard,
  loseKeywordUntil,
  loseTraitUntil,
  replaceNextVillainPhaseWithPlayerPhase,
  resolveOneTagged,
  resolveTagged,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  eachPlayer,
  hasTaggedAbility,
  lastPlayedThisRound,
  query,
  self,
  taggedAbilitiesOn,
  theVillain,
  you,
  YOUR_IDENTITY,
} from "./values.js";

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
  // "When [your hero] uses a basic power, you may give him a boost card" (`giveBasicPowerBoostCard`).
  "engine-only.basic-power-boost": heroInterrupt(on.basicPowerUsing(YOUR_IDENTITY), giveBasicPowerBoostCard()),
  // A tagged ability with no trigger ("speech bubbles"; `AbilityTriggerSpec special.tag`): "Draw 1 card now".
  "engine-only.tagged": tagged("pinkBubble", draw(1)),
  // "Resolve whatever is written in a PINK BUBBLE in play" (`resolveSpecials` `tag` and `pick: "one"`).
  "engine-only.resolve-one-tagged": action(resolveOneTagged("pinkBubble")),
  // "Remove this card from the game → resolve all the PINK BUBBLES in play", its own included (`of` with `cards`).
  "engine-only.resolve-all-tagged": action(resolveTagged("pinkBubble", { of: self, bind: "bubbles" })),
  // "Deal X damage, where X equals the PINK BUBBLES you control" (`ValueSpec taggedAbilities`).
  "engine-only.tagged-count": action(dealDamage(taggedAbilitiesOn("pinkBubble", { controller: "you" }), theVillain)),
  // "Increase the cost of each card with a PINK BUBBLE you play by 2" (`TargetQuery hasTaggedAbility`).
  "engine-only.has-tagged": constant(
    costModifier({ delta: 2, appliesTo: query("upgrade", { controller: "you", ...hasTaggedAbility("pinkBubble") }) }),
  ),
  // "When the villain phase would begin, instead … start another player phase" (`replaceNextVillainPhaseWithPlayerPhase`).
  "engine-only.extra-player-phase": forcedInterrupt(
    on.phaseBeginning("villain"),
    cancelIt(),
    replaceNextVillainPhaseWithPlayerPhase(),
  ),
  // "Ignore one keyword or trait on one card until the end of the round" (`grantKeywordUntil` / `grantTraitUntil`'s
  // `loses`).
  "engine-only.lose-keyword": action(loseKeywordUntil({ name: "guard" }, theVillain, "endOfRound")),
  "engine-only.lose-trait": action(loseTraitUntil(trait("ELITE"), theVillain, "endOfRound")),
};

/** Every example is a valid definition (checked by the DSL's own validator, as `defineAbilities` would). */
export const engineOnlyDslProblems = (): readonly string[] =>
  Object.entries(ENGINE_ONLY_DSL_EXAMPLES).flatMap(([id, definition]) =>
    validateDefinition(definition).map((problem) => `${id}: ${problem}`),
  );
