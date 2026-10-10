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
import { firstLegal, moveToHand, P1, patchInstance, playerOf, settle } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { SILK_ASPECT_BASIC } from "./aspect-basic.js";

/** Every earlier script and this module only: the tests do not depend on the pack's other modules. */
export const ASPECT_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, SILK_ASPECT_BASIC) };

/**
 * A game past setup (alter-ego form, hand of 6) for the Silk Protection precon, which holds every card of this module's
 * first half, against Core's Rhino. `second` adds a Core Spider-Man seat. `swap` replaces the first deck copy of a card.
 */
export function aspectGame(
  opts: { readonly seed?: number; readonly second?: boolean; readonly swap?: Readonly<Record<string, string>> } = {},
): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const printed = wave9StarterDeckSetup("silk-protection");
  const remaining = { ...opts.swap };
  const seat: PlayerSetup = {
    ...printed,
    deck: printed.deck.map((id) => {
      const replacement = remaining[id as string];
      if (replacement === undefined) return id;
      delete remaining[id as string];
      return cardId(replacement);
    }),
  };
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: opts.seed ?? 1,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame(
    { ...base, players: opts.second ? [seat, second] : [seat], requireLegalDecks: false },
    ASPECT_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", ASPECT_DEPS);
}

/** The same game with Silk in hero form. */
export const aspectHero = (opts: Parameters<typeof aspectGame>[0] = {}): GameState =>
  withForm(aspectGame(opts), { heroForm: 0 });

/**
 * Staging surgery: the first copy of `code` of `player` put into their play area, faceup and ready, holding `counters`
 * (`attach`: an upgrade attached to their identity instead).
 */
export function placed(
  state: GameState,
  code: string,
  counters: Readonly<Record<string, number>> = {},
  player: PlayerId = P1,
  attach = false,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const s = given.state;
  const out: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  if (!attach) {
    return { id, state: patchInstance(out, id, { faceup: true, controllerId: player, counters: { ...counters } }) };
  }
  // An upgrade, as a played one is: attached to the player's identity, in no play area list of its own.
  const host = playerOf(out, player).identity.instanceId;
  const detached: GameState = {
    ...out,
    players: out.players.map((p) =>
      p.playerId === player ? { ...p, playArea: p.playArea.filter((i) => i !== id) } : p,
    ),
  };
  const hosted = patchInstance(detached, host, { attachments: [...detached.instances[host]!.attachments, id] });
  return {
    id,
    state: patchInstance(hosted, id, {
      faceup: true,
      controllerId: player,
      attachedTo: host,
      counters: { ...counters },
    }),
  };
}

/** A minion of Core engaged with `player` (no reveal), under the instance id `slot`. */
export function engaged(state: GameState, code: string, slot: string, player: PlayerId = P1): GameState {
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
