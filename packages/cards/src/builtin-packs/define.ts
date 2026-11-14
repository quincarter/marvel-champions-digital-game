/**
 * Built-in content defined the way a mod SDK pack is (docs/custom-content-packs.md §11.2): one product is one pack,
 * with a manifest, its cards, its encounter sets, scenarios and precons, and the abilities that script its cards. The
 * field names match the SDK's `PackInput` / `PackGameContent`, so the SDK's game helpers take a built-in pack as they
 * take an installed one.
 *
 * Unlike a store pack, a built-in pack is never JSON on disk and is never loaded at runtime: its data is the generated
 * `@mc/content` modules and its abilities are the `@mc/cards` modules, compiled into the app as they always were. Only
 * the way a product is put together changes, not what reaches the engine.
 */
import type { AnyCard, EncounterSet, Pack, PackKind, Scenario, StarterDeck } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { abilityRefIds } from "../ability-refs.js";

/** What a store pack's `pack.json` says about itself, for a product that ships with the game. */
export interface BuiltinPackManifest {
  /** The product's set code (`core`, `cap`, `gob`), which every card of the pack carries as its `setCode`. */
  readonly id: string;
  /** `core` for the Core Set; otherwise the store's pack kinds (a campaign box is `campaign`). */
  readonly kind: "core" | Exclude<PackKind, "art" | "house-rule">;
  readonly name: string;
  /** The product record from `@mc/content` (cycle, release date). */
  readonly product: Pack;
  /**
   * `"not-ready"` for a product whose cards are in the pool but which the game doesn't offer yet: its heroes are kept
   * out of hero select, the deck builder's identity list and precons, and a deck led by one of them can't be seated
   * (`NOT_READY_PACK_CODES`). Used while a new pack's cards are still being transcribed or scripted (Elektra and Iron
   * Fist, docs/phase7-elektra-iron-fist.md). Leave it out for a finished product; deleting it is what releases one.
   */
  readonly status?: "not-ready";
}

/** One built-in product, shaped like the SDK's `PackInput` minus the files a store pack carries. */
export interface BuiltinPack {
  readonly manifest: BuiltinPackManifest;
  readonly cards: readonly AnyCard[];
  /** The scripts for this product's own cards. A wave's reprint aliases are layered on by the wave, not held here. */
  readonly abilities: AbilityRegistry;
  readonly decks: readonly StarterDeck[];
  readonly scenarios: readonly Scenario[];
  readonly encounterSets: readonly EncounterSet[];
}

/**
 * Every ability ref a card carries, as `abilityRefIds` reads them, plus a separated identity's other sides (SP//dr's
 * support and upgrade faces, docs/phase7-wave5.md), which `abilityRefIds` leaves out.
 */
export function scriptRefsOf(card: AnyCard): string[] {
  const refs = abilityRefIds(card);
  if (card.type === "hero_identity" && card.separatedIdentity) {
    const { heroCardOtherSide, alterEgoCardOtherSide } = card.separatedIdentity;
    refs.push(...[...heroCardOtherSide.abilities, ...alterEgoCardOtherSide.abilities].map((ref) => ref.id));
  }
  return refs;
}

/** A card code without its face letter: `01001a` and `01001b` are one card. */
const numberOf = (code: string): string => code.replace(/[a-z]$/, "");

const SKIP_CHECKS = (import.meta as ImportMeta & { readonly env?: { readonly PROD?: boolean } }).env?.PROD === true;

/** The problems with a built-in pack's definition; empty when it holds together. */
export function builtinPackProblems(pack: BuiltinPack): readonly string[] {
  const { id, product } = pack.manifest;
  const problems: string[] = [];
  if (product.code !== id) problems.push(`manifest id ${id} is not its product's code ${product.code}`);
  if (pack.manifest.name !== product.name)
    problems.push(`manifest name "${pack.manifest.name}" is not its product's name "${product.name}"`);
  for (const card of pack.cards) {
    if (card.setCode !== id) problems.push(`card ${card.id} is from ${card.setCode}, not ${id}`);
  }
  for (const deck of pack.decks) {
    if (deck.packCode !== id) problems.push(`precon ${deck.id} is from ${deck.packCode}, not ${id}`);
  }
  for (const scenario of pack.scenarios) {
    if (scenario.packCode !== id) problems.push(`scenario ${scenario.id} is from ${scenario.packCode}, not ${id}`);
  }
  for (const set of pack.encounterSets) {
    if (!set.packCodes.some((code) => code === id)) problems.push(`encounter set ${set.id} is not in ${id}`);
  }
  // Every script belongs to one of this pack's cards: a script for another product's card goes in that product. A
  // card names most of its scripts; one a rule grants (`gainsAbility`) is named by no card record, so its card is the
  // one its `<card code>.<slug>` id names, as a store pack's ability ids are checked (either face of a card counts).
  const refs = new Set(pack.cards.flatMap(scriptRefsOf));
  const cardNumbers = new Set(pack.cards.map((card) => numberOf(card.id)));
  for (const card of pack.cards) {
    // A separated identity's alter-ego card is its own number (SP//dr's 31002b) with no card record of its own.
    if (card.type === "hero_identity" && card.separatedIdentity)
      cardNumbers.add(numberOf(card.separatedIdentity.alterEgoCardNumber));
  }
  for (const abilityId of Object.keys(pack.abilities)) {
    if (!refs.has(abilityId) && !cardNumbers.has(numberOf(abilityId.split(".")[0]!)))
      problems.push(`ability ${abilityId} is not on any ${id} card`);
  }
  return problems;
}

/**
 * Defines a built-in pack and checks that it holds together: the cards, precons, scenarios and encounter sets are the
 * product's own, and every ability scripts one of its cards. Like `defineAbilities`, it throws on a problem in dev and
 * tests and skips the walk in a production build.
 */
export function defineBuiltinPack(pack: BuiltinPack): BuiltinPack {
  if (SKIP_CHECKS) return pack;
  const problems = builtinPackProblems(pack);
  if (problems.length > 0) throw new Error(`built-in pack ${pack.manifest.id}:\n  ${problems.join("\n  ")}`);
  return pack;
}

/**
 * The entries of `registry` (a wave's reprint aliases) that script one of `cards`: the share of a wave-level alias
 * layer that belongs to one product's built-in pack. Each alias belongs to exactly one product, the one holding its
 * card.
 */
export function abilitiesForCards(registry: AbilityRegistry, cards: readonly AnyCard[]): AbilityRegistry {
  const refs = new Set(cards.flatMap(abilityRefIds));
  return Object.fromEntries(Object.entries(registry).filter(([id]) => refs.has(id)));
}

/** A pack's own scripts: its abilities less the wave's reprint `aliases`, which merge as one layer before them. */
export function ownScriptsOf(pack: BuiltinPack, aliases: AbilityRegistry): AbilityRegistry {
  return Object.fromEntries(Object.entries(pack.abilities).filter(([id]) => !Object.hasOwn(aliases, id)));
}
