import { cardId } from "@mc/content";
import {
  createGame,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerSetup,
} from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, identityOf, moveToHand, P1, patchInstance, settle } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { WINTER_ABILITIES } from "./index.js";

/**
 * Shared helpers for the Winter Soldier pack's tests (every module under `winter/`): the printed precon
 * `winter-aggression` (40 cards) against Core's Rhino, with every earlier script plus this pack's own. The pack's modules
 * are scripted one at a time, so a test that needs a card of a module not yet scripted borrows a Core card instead
 * (`wsSeat`'s `swap`): that deck is not legal for the identity, so the game is created with deck legality unchecked.
 */
export const WS_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, WINTER_ABILITIES) };

/** The printed precon as a seat, optionally with named cards swapped in for others (the first copy of each; deck stays 40). */
export function wsSeat(swap: Readonly<Record<string, string>> = {}): PlayerSetup {
  const seat = wave9StarterDeckSetup("winter-aggression");
  const remaining = { ...swap };
  const deck = seat.deck.map((id) => {
    const replacement = remaining[id as string];
    if (replacement === undefined) return id;
    delete remaining[id as string];
    return cardId(replacement);
  });
  return { ...seat, deck };
}

/** A game past setup (alter-ego form, hand of 6) for the Winter Soldier precon (and optionally a Core second seat) against Rhino. */
export function wsGame(
  opts: {
    readonly swap?: Readonly<Record<string, string>>;
    readonly seed?: number;
    readonly twoPlayers?: boolean;
  } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: opts.twoPlayers ? [wsSeat(opts.swap), second] : [wsSeat(opts.swap)],
    },
    WS_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WS_DEPS);
}

/** The same game with Winter Soldier in hero form. */
export const wsHeroGame = (opts: Parameters<typeof wsGame>[0] = {}): GameState =>
  withForm(wsGame(opts), { heroForm: 0 });

/**
 * Test surgery: a minion `code` (a Core minion) put straight into play engaged with `player` under the instance id
 * `slot`, with no reveal and no When Revealed (the same shape `../aos/nick-fury/testing.ts` builds).
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

/**
 * Staging surgery: the first copy of `code` (from hand, deck or discard) put straight into P1's play area, faceup and
 * ready, holding `counters`; with `attach`, attached to P1's identity as an upgrade. Returns the new instance.
 */
export function stagedInPlay(
  state: GameState,
  code: string,
  opts: { readonly attach?: boolean; readonly counters?: Readonly<Record<string, number>> } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const s = given.state;
  const host = identityOf(s);
  const base: GameState = {
    ...s,
    players: s.players.map((p) => {
      if (p.playerId !== P1) return p;
      const hand = p.hand.filter((i) => i !== id);
      return opts.attach ? { ...p, hand } : { ...p, hand, playArea: [...p.playArea, id] };
    }),
  };
  const placed = patchInstance(base, id, {
    faceup: true,
    controllerId: P1,
    counters: { ...opts.counters },
    ...(opts.attach ? { attachedTo: host } : {}),
  });
  return {
    id,
    state: opts.attach
      ? patchInstance(placed, host, { attachments: [...placed.instances[host]!.attachments, id] })
      : placed,
  };
}
