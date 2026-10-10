import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, moveToHand, P1, patchInstance, playerOf, settle } from "../../testing/harness.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { AOS_ASPECT_BASIC } from "./aspect-basic.js";
import { MARIA_HILL_IDENTITY } from "./maria-hill/identity.js";

/** Every earlier script, Maria Hill's identity (her ally trait grant, Reassignment) and this module. */
export const ASPECT_DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE8_ABILITIES, MARIA_HILL_IDENTITY, AOS_ASPECT_BASIC),
};

/**
 * A game past setup against Rhino for a starter deck (default Maria Hill, whose precon holds every card of this module's
 * first half). `swap` replaces the first deck copy of a card (by code), so a game of a non-S.H.I.E.L.D. identity
 * (`core-spider-man-justice`) can carry a card of this module; such a deck is not legal, so legality is not checked.
 */
export function aspectGame(
  opts: {
    readonly deck?: string;
    readonly seed?: number;
    readonly swap?: Readonly<Record<string, string>>;
    readonly players?: number;
  } = {},
): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const printed = wave9StarterDeckSetup(opts.deck ?? "maria-hill-leadership");
  const remaining = { ...opts.swap };
  const seat = {
    ...printed,
    deck: printed.deck.map((id) => {
      const replacement = remaining[id as string];
      if (replacement === undefined) return id;
      delete remaining[id as string];
      return cardId(replacement);
    }),
  };
  const players = opts.players === 2 ? [seat, wave9StarterDeckSetup("core-spider-man-justice")] : [seat];
  const created = createGame({ ...base, players, requireLegalDecks: false }, ASPECT_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", ASPECT_DEPS);
}

/**
 * Staging surgery: the first copy of `code` (from hand, deck or discard) of `player` put straight into their play area,
 * faceup and ready, holding `counters`. Returns the new instance.
 */
export function placed(
  state: GameState,
  code: string,
  counters: Readonly<Record<string, number>> = {},
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  // A permanent card (the suit form upgrade) is set aside at setup, not in the deck.
  const aside = playerOf(state, player).setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  const given = aside ? { state, ids: [aside] } : moveToHand(state, player, code);
  const id = given.ids[0]!;
  const s = given.state;
  const out: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== id),
            setAside: p.setAside.filter((i) => i !== id),
            playArea: [...p.playArea, id],
          }
        : p,
    ),
  };
  return { id, state: patchInstance(out, id, { faceup: true, controllerId: player, counters: { ...counters } }) };
}

/** A Core minion engaged with `player` (no reveal), under the instance id `slot`. */
export function engaged(
  state: GameState,
  code: string,
  slot: string,
  player: PlayerId = P1,
  statuses: { stunned: number; confused: number; tough: number } = { stunned: 0, confused: 0, tough: 0 },
): GameState {
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
    statuses,
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
