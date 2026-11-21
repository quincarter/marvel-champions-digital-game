/**
 * Shared scaffolding for the competitive card audit tests (docs/competitive-card-audit.md): a real two-team game on the
 * engine's competitive fixture (`packages/engine/src/testing/team.ts`), where team one (registration, p1) faces leader
 * one and team two (resistance, p2) faces leader two. So for p1 "the enemy leader" is leader one and "your leader" is
 * leader two; for p2 the other way round. The leaders are stubs (the fixture builds no real leader cards), so a card
 * that needs a leader's own attachment (Energy Channel) gets the real attachment put on the stub by state surgery.
 *
 * Sources: MC56 pp. 14, 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); owner decisions of
 * 2026-11-20 (docs/competitive-mode-plan.md section 1.10).
 */

import { cardId, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { firstLegal, playerOf, type Picker } from "../../../../testing/harness.js";
import { driveEventsPicking } from "../../../../testing/staging.js";
import { WAVE10_CARDS } from "../../../cards.js";
import { WAVE10_DEPS } from "../../../testing.js";

const ENGINE_TESTING = new URL("../../../../../../engine/src/testing/", import.meta.url).href;
interface Fixture {
  readonly competitiveGame: (options?: {
    readonly sizes?: readonly [number, number];
    readonly deps?: EngineDeps;
    readonly extraCards?: readonly AnyCard[];
    readonly encounterDecks?: readonly [readonly CardId[], readonly CardId[]];
    readonly deck?: readonly CardId[];
  }) => GameState;
}
interface Fixtures {
  readonly stubTreachery: (spec: { id: string; boostIcons?: number }) => AnyCard;
  readonly stubResource: (spec: { id: string; icons: number; produces?: Record<string, number> }) => AnyCard;
  readonly stubAttachment: (spec: {
    id: string;
    name?: string;
    attachesTo?: unknown;
    abilities?: readonly { id: string }[];
  }) => AnyCard;
}
interface Scenario {
  readonly DEFAULT_DECK: readonly CardId[];
  readonly newGame: (options?: {
    readonly players?: number;
    readonly deps?: EngineDeps;
    readonly extraCards?: readonly AnyCard[];
    readonly encounterDeck?: readonly CardId[];
    readonly deck?: readonly CardId[];
  }) => GameState;
}
const team = (await import(/* @vite-ignore */ `${ENGINE_TESTING}team.ts`)) as Fixture;
const fixtures = (await import(/* @vite-ignore */ `${ENGINE_TESTING}fixtures.ts`)) as Fixtures;
const scenario = (await import(/* @vite-ignore */ `${ENGINE_TESTING}scenario.ts`)) as Scenario;

export const P1 = "p1" as PlayerId;
export const P2 = "p2" as PlayerId;
export const DEFAULT_DECK = scenario.DEFAULT_DECK;
export const stubAttachment = fixtures.stubAttachment;

/** A boost filler with `icons` boost icons. */
export const boost = (id: string, icons: number): AnyCard => fixtures.stubTreachery({ id, boostIcons: icons });
/** A typed one-icon resource, for "if you spent a [mental] resource". */
export const typedResource = (id: string, type: string): AnyCard =>
  fixtures.stubResource({ id, icons: 0, produces: { [type]: 1 } });

/** A resource producing one of each basic type: pays for any cost with any type requirement ("spend a [mental] resource"). */
export const everyTypeResource = (id: string): AnyCard =>
  fixtures.stubResource({ id, icons: 0, produces: { energy: 1, mental: 1, physical: 1 } });

export const realCards = (...codes: readonly string[]): readonly AnyCard[] =>
  codes.map((code) => {
    const found = WAVE10_CARDS.find((card) => (card.id as string) === code);
    if (!found) throw new Error(`no card ${code}`);
    return found;
  });

export interface GameOptions {
  readonly sizes?: readonly [number, number];
  readonly extraCards?: readonly AnyCard[];
  readonly abilities?: Readonly<Record<string, AbilityDefinition>>;
  /** Encounter deck tops (code list), team one's then team two's; padded with `filler`. */
  readonly deckOne?: readonly string[];
  readonly deckTwo?: readonly string[];
  readonly filler: AnyCard;
  /** Extra codes added to every seat's deck. */
  readonly seatCards?: readonly string[];
}

export function depsWith(abilities: Readonly<Record<string, AbilityDefinition>> = {}): EngineDeps {
  return { ...WAVE10_DEPS, abilities: { ...WAVE10_DEPS.abilities, ...abilities } };
}

/** A two-team game with every seat in hero form and the listed encounter-deck tops in order. */
export function twoTeamGame(options: GameOptions): { state: GameState; deps: EngineDeps } {
  const deps = depsWith(options.abilities);
  const fill = (cards: readonly string[]): CardId[] =>
    [...cards, ...Array.from({ length: 12 }, () => options.filler.id as string)].map((code) => cardId(code));
  const state = team.competitiveGame({
    ...(options.sizes ? { sizes: options.sizes } : {}),
    deps,
    extraCards: [options.filler, ...(options.extraCards ?? [])],
    encounterDecks: [fill(options.deckOne ?? []), fill(options.deckTwo ?? [])],
    deck: [...DEFAULT_DECK, ...(options.seatCards ?? []).map((code) => cardId(code))],
  });
  const ordered = (deckId: string, codes: readonly string[]) => {
    const piles = state.encounterDecks[deckId]!;
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code) && !ids.includes(i));
      if (id) ids.push(id);
    }
    return { ...piles, deck: [...ids, ...piles.deck.filter((i) => !ids.includes(i))] };
  };
  const [one, two] = state.villains;
  const arranged = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [one!.encounterDeckId]: ordered(one!.encounterDeckId, options.deckOne ?? []),
      [two!.encounterDeckId]: ordered(two!.encounterDeckId, options.deckTwo ?? []),
    },
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  } as GameState;
  return { state: arranged, deps };
}

/**
 * The control for the area scoping: a cooperative game of `players` seats sharing one game area (no teams), every seat
 * in hero form, with an encounter deck of `encounter` cards (one code, repeated) after the listed tops.
 */
export function cooperativeGame(options: GameOptions & { readonly players: number }): {
  state: GameState;
  deps: EngineDeps;
} {
  const deps = depsWith(options.abilities);
  const state = scenario.newGame({
    players: options.players,
    deps,
    extraCards: [options.filler, ...(options.extraCards ?? [])],
    encounterDeck: [...(options.deckOne ?? []), ...Array.from({ length: 12 }, () => options.filler.id as string)].map(
      (code) => cardId(code),
    ),
    deck: [...DEFAULT_DECK, ...(options.seatCards ?? []).map((code) => cardId(code))],
  });
  return {
    state: {
      ...state,
      players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    } as GameState,
    deps,
  };
}

export const leadersOf = (state: GameState) => {
  const [one, two] = state.villains;
  return { one: one!.instanceId, two: two!.instanceId, deckOne: one!.encounterDeckId, deckTwo: two!.encounterDeckId };
};
/** The main scheme of each team's area: team one's, then team two's. */
export const schemesOf = (state: GameState) => {
  const all = [state.mainScheme, ...(state.extraMainSchemes ?? [])];
  const of = (area: (typeof state.gameAreas)[number]) =>
    (area.mainScheme ?? all.find((scheme) => scheme.gameAreaId === area.areaId))!.instanceId;
  return { one: of(state.gameAreas[0]!), two: of(state.gameAreas[1]!) };
};

/** Moves a card with this code (not in `taken`) from the seat's hand, deck or discard into their hand (surgery). */
export function give(
  state: GameState,
  player: PlayerId,
  code: string,
  taken: readonly InstanceId[] = [],
): { state: GameState; id: InstanceId } {
  const seat = playerOf(state, player);
  const id = [...seat.hand, ...seat.deck, ...seat.discard].find(
    (i) => state.instances[i]!.cardId === cardId(code) && !taken.includes(i),
  );
  if (!id) throw new Error(`no ${code} for ${player}`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: [...p.hand.filter((i) => i !== id), id],
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
            }
          : p,
      ),
    },
  };
}

/** Moves a card with this code from the seat's hand, deck or discard into their play area (surgery). */
export function intoPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = give(state, player, code);
  return {
    id: given.id,
    state: {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: p.hand.filter((i) => i !== given.id), playArea: [...p.playArea, given.id] }
          : p,
      ),
      instances: {
        ...given.state.instances,
        [given.id]: { ...given.state.instances[given.id]!, controllerId: player, faceup: true },
      },
    },
  };
}

/** Takes the card with this code out of encounter deck `deckId` and attaches it to `host` (surgery). */
export function attachFromDeck(
  state: GameState,
  deckId: string,
  code: string,
  host: InstanceId,
  counters: Record<string, number> = {},
): { state: GameState; id: InstanceId } {
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((i) => state.instances[i]!.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in ${deckId}`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((i) => i !== id) } },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: host, faceup: true, counters },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

export function patch(state: GameState, id: InstanceId, changes: Record<string, unknown>): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, ...changes } } } as GameState;
}

/** Accepts every optional trigger offered, pays a spend with everything offered, otherwise the first legal option. */
export const acceptAll: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind === "chooseTriggers" || choice.prompt.kind === "spendResources")
    return choice.options.map((o) => o.optionId as string);
  return firstLegal(s);
};

export const play = (
  player: PlayerId,
  id: InstanceId,
  paidWith: readonly InstanceId[] = [],
  attachTo: InstanceId | null = null,
) =>
  ({
    type: "playCard",
    playerId: player,
    cardInstanceId: id,
    payment: paidWith.map((i) => ({ fromHand: i })),
    attachToInstanceId: attachTo,
  }) as never;

export const run = (deps: EngineDeps, state: GameState, pick: Picker, ...commands: unknown[]) =>
  driveEventsPicking(deps, state, pick, ...(commands as never[]));

export const endTurn = (player: PlayerId) => ({ type: "endTurn", playerId: player }) as never;

export const boostsDealtTo = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "boostCardDealt" && e.enemyInstanceId === enemy);

export const resolved = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && (e.abilityId as string) === abilityId).length;
