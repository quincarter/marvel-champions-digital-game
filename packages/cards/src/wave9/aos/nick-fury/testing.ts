import { cardId } from "@mc/content";
import { cardsInPlay, createGame, type EngineDeps, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { firstLegal, P1, settle } from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { WAVE9_CARDS } from "../../cards.js";
import { wave9StarterDeckSetup } from "../../setup.js";
import { NICK_FURY_EVENTS } from "./events.js";
import { NICK_FURY_IDENTITY } from "./identity.js";

/**
 * Shared helpers for the Nick Fury kit's tests: the precon `nick-fury-justice` against Core's Rhino, with every earlier
 * script plus the identity module. The kit's other modules are scripted one at a time, so only the identity abilities
 * are live here; a test that needs another card borrows one by hand.
 */
export const FURY_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, NICK_FURY_IDENTITY) };

/**
 * A game past setup (alter-ego form, hand of 6, Assault set up faceup by Suit Up) against Rhino. `swap` replaces the
 * first deck copy of a card (by code) with another, for a test that needs a card of a module not yet scripted: that
 * deck is not legal for the identity, so deck legality is not checked.
 */
export function furyGame(
  opts: { readonly seed?: number; readonly swap?: Readonly<Record<string, string>> } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const seat = wave9StarterDeckSetup("nick-fury-justice");
  const remaining = { ...opts.swap };
  const deck = seat.deck.map((id) => {
    const replacement = remaining[id as string];
    if (replacement === undefined) return id;
    delete remaining[id as string];
    return cardId(replacement);
  });
  const created = createGame({ ...base, requireLegalDecks: false, players: [{ ...seat, deck }] }, FURY_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", FURY_DEPS);
}

/** The same game with Nick Fury in hero form. */
export const furyHeroGame = (opts: Parameters<typeof furyGame>[0] = {}): GameState =>
  withForm(furyGame(opts), { heroForm: 0 });

/** The suit form upgrade (50035a) in play, if any. */
export const suitOf = (s: GameState): InstanceId | undefined =>
  cardsInPlay(s).find((id) => (s.instances[id]!.cardId as string) === "50035a");

/** `FURY_DEPS` plus the events module (50037 to 50039), for the event tests. */
export const FURY_EVENT_DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, NICK_FURY_IDENTITY, NICK_FURY_EVENTS),
};

/**
 * Nick Fury (P1, alter-ego form) and Core's Spider-Man precon (P2) against Rhino, for "choose a player" (Spray Fire).
 * Neither deck is checked for legality.
 */
export function furyDuoGame(seed = 1): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-iron-man-aggression" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const fury = wave9StarterDeckSetup("nick-fury-justice");
  const created = createGame({ ...base, requireLegalDecks: false, players: [fury, base.players[1]!] }, FURY_EVENT_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", FURY_EVENT_DEPS);
}

/**
 * Test surgery: a minion `code` (a Core minion) put straight into play engaged with `player` under the instance id
 * `slot`, with no reveal and no When Revealed (the same shape `../../../wave3/drax/support.ts` builds).
 */
export function engageMinion(state: GameState, code: string, slot: string, player: PlayerId = P1): GameState {
  const id = slot as InstanceId;
  const instance = {
    instanceId: id,
    cardId: code,
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as never;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: instance },
  };
}
