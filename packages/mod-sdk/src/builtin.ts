/**
 * The SDK's checks run on a built-in pack (`@mc/cards`' `BuiltinPack`: the Core Set and the products moved so far), so
 * the content that ships with the game passes the same card, ability, DSL-feature, deck, encounter set and scenario
 * checks a store pack does. Built-in packs keep their MarvelCDB codes and stay compiled into the app, so what
 * `validatePack` checks about a store pack's `x.` codes, ids, files and pictures does not apply; `builtinPackProblems`
 * checks the product's own shape instead.
 */
import { PLAYABLE_DEPS, builtinPackProblems, validateDefinition, type BuiltinPack } from "@mc/cards";
import { PLAYABLE_CARDS, validateCard, validateEncounterSet, validateScenario, validateStarterDeck } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { SUPPORTED_DSL_FEATURES, dslFeatures } from "./features.js";
import { abilityRefsOf, type PackIssue } from "./validate.js";

/**
 * What a built-in pack is checked against; both default to this build's own. The defaults already hold every built-in
 * pack's scripts and features, so the unscripted and DSL-feature checks only bite when a caller passes its own.
 */
export interface BuiltinValidateOptions {
  /** The scripts a card's ability may come from besides the pack's own (a wave's reprint aliases, Core's scripts). */
  readonly baseAbilities?: AbilityRegistry;
  readonly supportedFeatures?: readonly string[];
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Checks a built-in pack. Unscripted card abilities are reported in the `"unscripted-ability"` category. */
export function validateBuiltinPack(pack: BuiltinPack, options: BuiltinValidateOptions = {}): readonly PackIssue[] {
  const issues: PackIssue[] = [];
  const add = (path: string, message: string, category?: PackIssue["category"]): void =>
    void issues.push(category ? { path, message, category } : { path, message });
  const check = (path: string, run: () => { readonly errors: readonly string[] }): void => {
    try {
      for (const message of run().errors) add(path, message);
    } catch (error) {
      add(path, `could not be checked: ${errorText(error)}`);
    }
  };
  const baseAbilities = options.baseAbilities ?? PLAYABLE_DEPS.abilities;
  const supported = new Set(options.supportedFeatures ?? SUPPORTED_DSL_FEATURES);

  for (const problem of builtinPackProblems(pack)) add("pack", problem);
  for (const card of pack.cards) {
    check(`cards/${card.id}`, () => validateCard(card));
    for (const ref of abilityRefsOf(card)) {
      if (!Object.hasOwn(pack.abilities, ref) && !Object.hasOwn(baseAbilities, ref))
        add(`cards/${card.id}`, `ability "${ref}" is not scripted`, "unscripted-ability");
    }
  }
  for (const [id, definition] of Object.entries(pack.abilities)) {
    try {
      for (const problem of validateDefinition(definition)) add(`abilities/${id}`, problem);
    } catch (error) {
      add(`abilities/${id}`, `could not be checked: ${errorText(error)}`);
    }
  }
  for (const feature of dslFeatures(pack.abilities)) {
    if (!supported.has(feature)) add("abilities", `uses DSL feature "${feature}", which this game version lacks`);
  }

  const known = new Set<string>([...PLAYABLE_CARDS, ...pack.cards].map((card) => card.id));
  for (const deck of pack.decks) {
    check(`decks/${deck.id}`, () => validateStarterDeck(deck));
    for (const id of [deck.identityCardId, ...deck.cards.map((entry) => entry.cardId)]) {
      if (!known.has(id)) add(`decks/${deck.id}`, `card "${id}" is in neither the pack nor the base game`);
    }
  }
  for (const set of pack.encounterSets) check(`encounterSets/${set.id}`, () => validateEncounterSet(set));
  for (const scenario of pack.scenarios) check(`scenarios/${scenario.id}`, () => validateScenario(scenario));
  return issues;
}
