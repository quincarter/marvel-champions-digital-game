import { CORE_STARTER_DECKS, type AnyCard, type CardId, type CoreAspect } from "@mc/content";
import {
  createGame,
  type EngineDeps,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { firstLegal, moveToHand, P1, settle, type Picker } from "./harness.js";
import { playFromHand } from "./staging.js";

/**
 * "Cards in another hero's deck" (`docs/custom-deck-testing.md`, `docs/wave-definition-of-done.md` §4b): every new
 * aspect or basic card played through the engine from a Core hero's deck, so an ability script that quietly
 * assumes its own precon hero (rather than reading `you`/`self` generically) is caught here rather than only
 * inside its own precon's own tests. One Core precon per aspect already covers all four (`packages/content/src/
 * data/core/starterDecks.ts`): Spider-Man (Justice), Captain Marvel (Leadership), She-Hulk (Aggression), Black
 * Panther (Protection) — a basic card is legal in any of them, so Spider-Man is this module's own default.
 *
 * SHARED FILE, wave-agnostic (parallel to `./staging.ts`): every wave's own cross-hero suite imports this, never
 * edits it. It only knows how to build a *legal* deck (`validateDeck`'s own rules, checked by `createGame`'s
 * `requireLegalDecks`); it deliberately has no card-specific knowledge; each caller supplies the ability registry
 * (`deps`), the card pool the card belongs to, and a `buildScenario` callback that seats the built deck at whatever
 * scenario the caller wants (`wave5Scenario("rhino", { seed, players })`, mirroring every wave's own `startWaveNGame`).
 */

/** The one Core starter deck per aspect (`packages/content/src/data/core/starterDecks.ts`) — each already the
 * matching aspect's own real precon, so seating a card here needs no aspect-swapping surgery in the common case. */
export const CORE_HERO_FOR_ASPECT: Readonly<Record<CoreAspect, string>> = {
  justice: "core-spider-man-justice",
  leadership: "core-captain-marvel-leadership",
  aggression: "core-she-hulk-aggression",
  protection: "core-black-panther-protection",
  basic: "core-spider-man-justice",
  pool: "core-spider-man-justice",
};

/**
 * `coreHeroId`'s own real precon deck (identity, its own signature cards, its own aspect's cards — every field
 * `validateDeck` checks is already correct, since this is the same decklist `wave5Scenario`'s own `starterDeckId`
 * branch seats) plus every legal copy of `cardCode` added on top.
 *
 * If `cardCode`'s own aspect differs from `coreHeroId`'s (a caller-chosen override, not the matching-aspect
 * default), the deck's chosen aspect is swapped to the card's own and every one of the precon's own aspect cards
 * that no longer matches is dropped (a player deck customizes with exactly one aspect plus basic, RRG 1.8 Appendix
 * I) — the identity's own signature cards (aspect `hero:<id>`) are never dropped, since they aren't aspect cards
 * at all. This module does not backfill the dropped count with filler: if that drops the deck under the 40-card
 * minimum, building throws rather than seat something `validateDeck` would refuse anyway (no wave 5 card needs an
 * aspect override, so this path is unexercised by this wave's own cross-hero suite).
 */
export function buildCrossHeroDeck(cards: readonly AnyCard[], coreHeroId: string, cardCode: string): PlayerSetup {
  const starter = CORE_STARTER_DECKS.find((deck) => deck.id === coreHeroId);
  if (!starter) throw new Error(`no Core starter deck ${coreHeroId}`);
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  const target = byId.get(cardCode);
  if (!target) throw new Error(`unknown card ${cardCode}`);
  const targetAspect = "aspect" in target ? target.aspect : "basic";
  const isCoreAspect = (a: string): a is CoreAspect =>
    a === "justice" || a === "leadership" || a === "aggression" || a === "protection";
  const aspects: readonly CoreAspect[] =
    !isCoreAspect(targetAspect) || starter.aspects.includes(targetAspect) ? starter.aspects : [targetAspect];
  const legalAspects = new Set<string>([...aspects, "basic"]);
  // RRG 1.8 Appendix I: "No more than three copies (**by title**) of each non-unique card" — a reprint under a
  // different card id (Surveillance Team, `27045`/`01064`, `precon-player-cards.ts`'s own docblock) shares its
  // title with any copy the Core precon already carries. Rather than risk exceeding that cap (or, worse, adding 0
  // net copies and never actually seating `cardCode` itself), any of the precon's own entries sharing the target's
  // title are dropped in favor of `cardCode`'s own copies below — the deck still runs the same title at the same
  // count, just under the id this test actually needs in hand.
  const keptEntries = starter.cards.filter((entry) => {
    const card = byId.get(entry.cardId as string);
    if (!card || !("aspect" in card)) return true;
    if ("name" in card && "name" in target && card.name === target.name) return false;
    return card.aspect.startsWith("hero:") || legalAspects.has(card.aspect);
  });
  const quantity = Math.min(
    "deckLimit" in target ? target.deckLimit : 1,
    "quantityInSet" in target ? target.quantityInSet : 1,
  );
  const deck: CardId[] = [
    ...keptEntries.flatMap((entry) => Array.from({ length: entry.quantity }, () => entry.cardId as CardId)),
    ...Array.from({ length: quantity }, () => cardCode as CardId),
  ];
  if (deck.length < 40) {
    throw new Error(
      `${cardCode} in ${coreHeroId}'s deck (aspect override to ${targetAspect}) drops below the 40-card minimum — not supported by this helper`,
    );
  }
  return { identityCardId: starter.identityCardId as CardId, aspects, deck };
}

export interface CrossHeroGame {
  readonly deps: EngineDeps;
  readonly cards: readonly AnyCard[];
  /** Seats the deck built for this card at whatever scenario the caller wants — `(players) =>
   * wave5Scenario("rhino", { seed, players })`, the same shape every wave's own `startWaveNGame` already wires. */
  readonly buildScenario: (players: readonly PlayerSetup[]) => GameSetupConfig;
}

export interface PlayFromAnotherHeroOptions {
  /** Overrides `CORE_HERO_FOR_ASPECT`'s own matching-aspect default. */
  readonly coreHero?: string;
  /** State surgery applied after the card reaches hand but before it's played — a target in play, a trait on the
   * hero, a Team-Up partner, staged threat/damage, and so on ("Cards get an optional `setup` callback"). */
  readonly setup?: (state: GameState, cardInstanceId: InstanceId) => GameState;
  /** Resolves whatever the play triggers (an optional Response's own target, a `payForCard` cost) — default
   * declines everything optional, the same `firstLegal` every other harness entry point defaults to. */
  readonly pick?: Picker;
  /** The number of *other* hand cards paid as this card's own generic resource cost. Default: its own printed
   * `cost` (0 for a card with none). */
  readonly cost?: number;
}

export interface PlayFromAnotherHeroResult {
  readonly state: GameState;
  readonly cardInstanceId: InstanceId;
}

/**
 * Builds a legal custom deck for `cardCode` (`buildCrossHeroDeck`), seats it against the scenario `game.buildScenario`
 * builds, puts `cardCode` in hand, and plays it through the engine — "played from a Core hero's deck" (`docs/
 * custom-deck-testing.md`'s own "Cards in another hero's deck" row). Returns the resulting state (and the played
 * card's own instance id) so a test can assert its printed effect.
 *
 * Every step is a real engine call (`createGame`, `playCard`), not state surgery, other than `options.setup` (a
 * caller-supplied precondition, e.g. another card already in play) and the deck-build itself (which only ever
 * assembles decklist data, never touches `GameState`). A card a Core hero cannot legally *play at all* (a
 * `playOnlyIf`/`requiresIdentityTrait` gate its own printed text names — "an identity" or "a trait" the Core hero
 * doesn't have) is not run through this helper at all; assert refusal directly instead (`applyCommand`'s own
 * `ok: false`, or `legalActions` omitting the `playCard` action — `../wave5/sm/ghost-spider/support-upgrades-
 * allies.test.ts`'s own `27017.spider-man-constant` test is the precedent).
 */
export function playFromAnotherHerosDeck(
  cardCode: string,
  game: CrossHeroGame,
  options: PlayFromAnotherHeroOptions = {},
): PlayFromAnotherHeroResult {
  const byId = new Map(game.cards.map((card) => [card.id as string, card]));
  const target = byId.get(cardCode);
  if (!target) throw new Error(`unknown card ${cardCode}`);
  const targetAspect = "aspect" in target ? target.aspect : "basic";
  const defaultHero =
    targetAspect === "justice" ||
    targetAspect === "leadership" ||
    targetAspect === "aggression" ||
    targetAspect === "protection"
      ? CORE_HERO_FOR_ASPECT[targetAspect]
      : CORE_HERO_FOR_ASPECT.basic;
  const coreHeroId = options.coreHero ?? defaultHero;
  const setup = buildCrossHeroDeck(game.cards, coreHeroId, cardCode);
  const config = game.buildScenario([setup]);
  const created = createGame(config, game.deps);
  if (!created.ok) {
    throw new Error(
      `cross-hero setup for ${cardCode} (${coreHeroId}) failed: ${created.error.code}: ${created.error.message}`,
    );
  }
  const opening = settle(created.state, firstLegal, (s) => s.step.phase === "player", game.deps);
  const { state: staged, ids } = moveToHand(opening, P1, cardCode);
  const cardInstanceId = ids[0]!;
  const ready = options.setup ? options.setup(staged, cardInstanceId) : staged;
  const cost = options.cost ?? ("cost" in target ? target.cost : 0);
  const played = playFromHand(game.deps, ready, cardCode, cost, options.pick ?? firstLegal);
  return { state: played.state, cardInstanceId: played.id };
}
