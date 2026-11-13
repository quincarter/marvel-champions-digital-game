/**
 * The SDK's checks run on a built-in pack (`@mc/cards`' `BuiltinPack`: the Core Set and the products moved so far), so
 * the content that ships with the game passes the same card, ability, DSL-feature, deck, encounter set and scenario
 * checks a store pack does. Built-in packs keep their MarvelCDB codes and stay compiled into the app, so what
 * `validatePack` checks about a store pack's `x.` codes, ids, files and pictures does not apply; `builtinPackProblems`
 * checks the product's own shape instead.
 */
import { builtinPackProblems, validateDefinition, type BuiltinPack } from "@mc/cards";
import {
  validateCard,
  validateEncounterSet,
  validateScenario,
  validateScenarioEncounterSets,
  validateStarterDeck,
  type AnyCard,
} from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "@mc/engine";
import { SUPPORTED_DSL_FEATURES, dslFeatures } from "./features.js";
import { abilityRefsOf, type PackIssue } from "./validate.js";

/** What a built-in pack is checked against. */
export interface BuiltinValidateOptions {
  /**
   * The built-in packs this one is played with, whose cards, sets and scripts it may name: Core for a wave 1 product,
   * whose scenarios use Core's Standard set. Nothing else counts, so a script missing from the pack is reported.
   */
  readonly requires?: readonly BuiltinPack[];
  /** The DSL features the build supports; this build's own by default. */
  readonly supportedFeatures?: readonly string[];
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The engine's deps for games of built-in packs alone: every pack's scripts, with no base registry under them (a
 * built-in pack is the base game). Two packs scripting one ability id is an error, as `gameDepsWithPacks` makes it.
 */
export function builtinGameDeps(packs: readonly BuiltinPack[]): EngineDeps {
  const abilities: Record<string, AbilityDefinition> = {};
  for (const pack of packs) {
    for (const [id, definition] of Object.entries(pack.abilities)) {
      if (Object.hasOwn(abilities, id)) throw new Error(`ability ${id} is scripted by two built-in packs`);
      abilities[id] = definition;
    }
  }
  return { abilities };
}

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
  const required = options.requires ?? [];
  const all = [pack, ...required];
  // Plain unions, never a throw: a clash with a required pack is reported, and the pack's own record wins.
  const scripts: Record<string, unknown> = {};
  const cards = new Map<string, AnyCard>();
  for (const other of required) {
    Object.assign(scripts, other.abilities);
    for (const card of other.cards) cards.set(card.id, card);
  }
  for (const id of Object.keys(pack.abilities)) {
    if (Object.hasOwn(scripts, id)) add(`abilities/${id}`, "is also scripted by a pack this one requires");
  }
  for (const card of pack.cards) {
    if (cards.has(card.id)) add(`cards/${card.id}`, "is also a card of a pack this one requires");
  }
  Object.assign(scripts, pack.abilities);
  for (const card of pack.cards) cards.set(card.id, card);
  const sets = all.flatMap((p) => p.encounterSets);
  const setIds = new Set(sets.map((set) => set.id as string));
  const supported = new Set(options.supportedFeatures ?? SUPPORTED_DSL_FEATURES);
  const cardOfType = (at: string, field: string, id: string, type: AnyCard["type"]): void => {
    const card = cards.get(id);
    if (!card) add(at, `${field} "${id}" is in neither this pack nor the packs it requires`);
    else if (card.type !== type) add(at, `${field} "${id}" is a ${card.type}, not a ${type}`);
  };

  for (const problem of builtinPackProblems(pack)) add("pack", problem);
  for (const card of pack.cards) {
    const at = `cards/${card.id}`;
    check(at, () => validateCard(card));
    for (const ref of abilityRefsOf(card)) {
      if (!Object.hasOwn(scripts, ref)) add(at, `ability "${ref}" is not scripted`, "unscripted-ability");
    }
    const cardSets = "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
    for (const setId of cardSets) {
      if (!setIds.has(setId)) add(at, `encounter set "${setId}" is in neither this pack nor the packs it requires`);
    }
    if (card.type === "hero_identity") {
      cardOfType(at, "obligationCardId", card.obligationCardId, "obligation");
      const nemesis = sets.find((set) => set.id === card.nemesisEncounterSetId);
      if (!nemesis)
        add(at, `nemesis set "${card.nemesisEncounterSetId}" is in neither this pack nor the packs it requires`);
      else if (nemesis.nemesisOfIdentityId !== card.id)
        add(at, `nemesis set "${card.nemesisEncounterSetId}" is not this identity's nemesis set`);
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

  for (const deck of pack.decks) {
    const at = `decks/${deck.id}`;
    check(at, () => validateStarterDeck(deck));
    cardOfType(at, "identity", deck.identityCardId, "hero_identity");
    for (const { cardId } of deck.cards) {
      if (!cards.has(cardId)) add(at, `card "${cardId}" is in neither this pack nor the packs it requires`);
    }
  }
  for (const set of pack.encounterSets) check(`encounterSets/${set.id}`, () => validateEncounterSet(set));
  for (const scenario of pack.scenarios) {
    const at = `scenarios/${scenario.id}`;
    check(at, () => validateScenario(scenario));
    check(at, () => validateScenarioEncounterSets(scenario, sets));
    cardOfType(at, "villainCardId", scenario.villainCardId, "villain");
    cardOfType(at, "mainSchemeCardId", scenario.mainSchemeCardId, "main_scheme");
  }
  return issues;
}
