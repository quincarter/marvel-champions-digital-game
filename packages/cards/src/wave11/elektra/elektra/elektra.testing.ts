/**
 * Test support for Elektra's identity and Ninja deck modules: Elektra (63001a/b) seated against Core's Rhino with a
 * hand-built Aggression deck (the pack has no starter decklist yet), optionally beside Core Spider-Man, and staging
 * helpers. State surgery here only stages a situation, never the behavior under test.
 */
import { CORE_CARDS, ELEKTRA_CARDS, PLAYABLE_CARDS, cardId, type AnyCard, type HeroIdentityCard } from "@mc/content";
import {
  DECK_MIN_CARDS,
  activeEncounterDeck,
  activeEncounterDeckId,
  cardOfferedToDeck,
  copiesUpToLimit,
  createGame,
  isPermanentCard,
  requiredIdentitySet,
  separateDeckOf,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerSetup,
} from "@mc/engine";
import { CORE_ABILITIES } from "../../../core/index.js";
import { coreScenario } from "../../../core/setup.js";
import { P1, firstLegal, identityOf, patchInstance, settle, type Picker } from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { ELEKTRA_ELEKTRA_IDENTITY } from "./identity.js";
import { ELEKTRA_ELEKTRA_NINJA_DECK } from "./ninja-deck.js";

export const ELEKTRA_DEPS: EngineDeps = {
  abilities: { ...CORE_ABILITIES, ...ELEKTRA_ELEKTRA_IDENTITY, ...ELEKTRA_ELEKTRA_NINJA_DECK },
};
const POOL: readonly AnyCard[] = [...CORE_CARDS, ...ELEKTRA_CARDS];
const ELEKTRA = ELEKTRA_CARDS.find((c) => c.id === cardId("63001a")) as HeroIdentityCard;
export const NINJA = "Ninja";
export const NINJA_STARS = "63002";
export const NINJA_STRIKE = "63003";
export const NINJA_VANISH = "63004";
/** Core's "Advance" (01186): no boost icon and no Boost ability. */
export const ADVANCE = "01186";

/** Elektra's required set, then Core Aggression and basic cards up to the deck minimum. */
function elektraSeat(): PlayerSetup {
  const entries = requiredIdentitySet(ELEKTRA, POOL).map((e) => ({ ...e }));
  const byCode = new Map(POOL.map((c) => [c.id as string, c]));
  const counted = (id: unknown): boolean => !isPermanentCard(byCode.get(id as string)!);
  let total = entries.reduce((n, e) => n + (counted(e.cardId) ? e.quantity : 0), 0);
  const offered = (card: AnyCard): boolean =>
    card.type !== "hero_identity" &&
    !("aspect" in card && String(card.aspect).startsWith("hero:")) &&
    cardOfferedToDeck(card, ELEKTRA, ["aggression"]).offered;
  for (const card of CORE_CARDS.filter(offered)) {
    if (total >= DECK_MIN_CARDS) break;
    const copies = Math.min(copiesUpToLimit(entries, card.id as string, ELEKTRA, POOL), DECK_MIN_CARDS - total);
    if (copies > 0) {
      entries.push({ cardId: card.id, quantity: copies });
      total += copies;
    }
  }
  return {
    identityCardId: ELEKTRA.id,
    aspects: ["aggression"],
    deck: entries.flatMap((e) => Array.from({ length: e.quantity }, () => e.cardId)),
  };
}

/** Elektra (P1, alter-ego form) against Rhino, past setup; with `withSpiderMan`, Core Spider-Man as P2. */
export function elektraGame(opts: { readonly withSpiderMan?: boolean; readonly seed?: number } = {}): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const players = opts.withSpiderMan ? [elektraSeat(), ...base.players] : [elektraSeat()];
  const created = createGame({ ...base, cards: POOL, players }, ELEKTRA_DEPS);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", ELEKTRA_DEPS);
}

/** The same game with Elektra in hero form (surgery: no Ninja Training) and 4 threat on the main scheme (below its 1-player threshold after a villain phase). */
export const elektraHeroGame = (opts: { readonly withSpiderMan?: boolean } = {}): GameState => {
  const s = withForm(elektraGame(opts), { heroForm: 0 });
  return patchInstance(s, s.mainScheme.instanceId, { threat: 4 });
};

export const ninjaDeck = (s: GameState): readonly InstanceId[] => separateDeckOf(s, P1, NINJA).deck;

/** A copy of `code` still in the Ninja deck. */
export const ninjaCard = (s: GameState, code: string): InstanceId => {
  const id = ninjaDeck(s).find((i) => s.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} left in the Ninja deck`);
  return id;
};

/**
 * Moves a Ninja card out of the Ninja deck as if it had been shuffled into the encounter deck (the scenario's, no
 * owner) and puts it at `at` of the encounter deck (0 = top).
 */
export function ninjaIntoEncounterDeck(s: GameState, code: string, at = 0): { state: GameState; id: InstanceId } {
  const id = ninjaCard(s, code);
  const deckId = activeEncounterDeckId(s);
  const piles = activeEncounterDeck(s);
  const deck = [...piles.deck];
  deck.splice(at, 0, id);
  const state: GameState = {
    ...patchInstance(s, id, {
      ownerId: null,
      controllerId: null,
      faceup: false,
      home: { kind: "encounterDeck", deckId },
    }),
    players: s.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              [NINJA]: { ...p.separateDecks[NINJA]!, deck: p.separateDecks[NINJA]!.deck.filter((i) => i !== id) },
            },
          }
        : p,
    ),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...piles, deck } },
  };
  return { state, id };
}

/** Elektra holding a Ninja card for her next basic power (as its When Revealed leaves it). */
export function holdingNinja(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const staged = ninjaIntoEncounterDeck(s, code);
  const deckId = activeEncounterDeckId(staged.state);
  const piles = activeEncounterDeck(staged.state);
  const elektra = identityOf(staged.state);
  const moved: GameState = {
    ...patchInstance(staged.state, staged.id, { heldForBasicPowers: true }),
    encounterDecks: {
      ...staged.state.encounterDecks,
      [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== staged.id) },
    },
  };
  const host = moved.instances[elektra]!;
  return {
    id: staged.id,
    state: {
      ...moved,
      instances: { ...moved.instances, [elektra]: { ...host, boostCards: [...host.boostCards, staged.id] } },
    },
  };
}

/** Age of Apocalypse's Ruler of Limbo (45055), a side scheme printing one amplify icon. */
const RULER_OF_LIMBO = "45055";

/**
 * One amplify icon in play: Ruler of Limbo in the villain area with 2 threat (a Core side scheme's instance re-carded,
 * as `qa-2026-11-14-amplify-basic-power.test.ts` stages it, and the card added to the game's pool).
 */
export function withAmplifyIcon(s: GameState): GameState {
  const placed = encounterCardInVillainArea(s, "01107", 2);
  const ruler = PLAYABLE_CARDS.find((c) => c.id === cardId(RULER_OF_LIMBO))!;
  const state = patchInstance(placed.state, placed.id, { cardId: cardId(RULER_OF_LIMBO) });
  return { ...state, cardPool: { ...state.cardPool, [ruler.id]: ruler } };
}

/** A picker that takes `firstLegal` except where `decide` answers. */
export const picking =
  (decide: (s: GameState) => readonly string[] | undefined): Picker =>
  (s) =>
    decide(s) ?? firstLegal(s);

/** In a `chooseTriggers` prompt, the option for `abilityId` (if offered), else nothing chosen ("pass"). */
export const triggerOption = (s: GameState, abilityId: string): readonly string[] | undefined => {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind !== "chooseTriggers") return undefined;
  const option = choice.options.find((o) => o.ref.kind === "ability" && (o.ref.abilityId as string) === abilityId);
  return option ? [option.optionId] : undefined;
};

/** A Ninja card already in the encounter family, dealt facedown to `player` to be revealed in the villain phase. */
export function ninjaDealtTo(s: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const staged = ninjaIntoEncounterDeck(s, code);
  const deckId = activeEncounterDeckId(staged.state);
  const piles = activeEncounterDeck(staged.state);
  return {
    id: staged.id,
    state: {
      ...staged.state,
      encounterDecks: {
        ...staged.state.encounterDecks,
        [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== staged.id) },
      },
      players: staged.state.players.map((p) =>
        p.playerId === player ? { ...p, dealtEncounter: [...p.dealtEncounter, staged.id] } : p,
      ),
    },
  };
}
