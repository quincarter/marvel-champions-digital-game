import { createGame, type Command, type EngineDeps, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { firstLegal, P1, settle, type Picker } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE9_CARDS } from "../cards.js";
import { BP_DEPS, bpSeat } from "./testing.js";

/**
 * Test helpers of `bp/aspect-basic`. Every earlier script and this pack's own are loaded (`BP_DEPS`).
 */
export const DEPS: EngineDeps = BP_DEPS;

/**
 * The Shuri precon (P1) with Core's Black Panther / T'Challa starter deck as P2, past setup (both in alter-ego form):
 * the two identities Heart of the Panther's Team-Up names ("Black Panther/T'Challa and Black Panther/Shuri").
 */
export function tchallaGame(seed = 1): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const tchalla = coreScenario("rhino", {
    players: [{ starterDeckId: "core-black-panther-protection" }],
    seed,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame({ ...base, requireLegalDecks: false, players: [bpSeat(), tchalla] }, BP_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", BP_DEPS);
}

/** A Core minion `code` engaged with `player` (no reveal), under the instance id `slot`. */
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

/**
 * Settled run of `commands` with a scripted player: a trigger whose id ends with an entry of `accept` is taken (every
 * other optional thing declined), target / card / player prompts take the first `target` they offer, option prompts the
 * entry of `option` (a label prefix, else the last option), defenders are declined. Records each prompt kind's options.
 */
export interface ScriptOpts {
  readonly deps?: EngineDeps;
  readonly accept?: readonly string[];
  /** At most this many accepted triggers (default: every offer that matches `accept` is taken). */
  readonly times?: number;
  readonly target?: readonly (InstanceId | string)[];
  readonly option?: readonly string[];
  readonly defender?: InstanceId;
}
export function scripted(state: GameState, commands: readonly Command[], opts: ScriptOpts = {}) {
  const offers: Record<string, string[]> = {};
  const mins: Record<string, number> = {};
  const maxes: Record<string, number> = {};
  const kinds: string[] = [];
  const history: { kind: string; ids: string[]; player: PlayerId }[] = [];
  let options = 0;
  let triggers = 0;
  const pick: Picker = (s) => {
    const open = s.pendingChoice!;
    const ids = open.options.map((o) => o.optionId as string);
    kinds.push(open.prompt.kind);
    history.push({ kind: open.prompt.kind, ids, player: open.playerId as PlayerId });
    offers[open.prompt.kind] = ids;
    mins[open.prompt.kind] = open.minSelections;
    maxes[open.prompt.kind] = open.maxSelections;
    if (open.prompt.kind === "chooseTriggers") {
      const hit = ids.find((o) => (opts.accept ?? []).some((a) => o.endsWith(a)));
      if (hit && triggers < (opts.times ?? Infinity)) {
        triggers++;
        return [hit];
      }
      return firstLegal(s);
    }
    if (open.prompt.kind === "declareDefender") {
      return opts.defender && ids.includes(opts.defender) ? [opts.defender] : ["decline"];
    }
    if (["chooseTarget", "chooseCards", "choosePlayer"].includes(open.prompt.kind)) {
      const hits = (opts.target ?? []).filter((t) => ids.includes(t as string));
      if (hits.length > 0) return hits.slice(0, open.maxSelections) as string[];
    }
    if (open.prompt.kind === "chooseOption") {
      const want = opts.option?.[options++];
      const hit = want ? open.options.find((o) => o.label.startsWith(want)) : undefined;
      return [hit ? (hit.optionId as string) : ids[ids.length - 1]!];
    }
    return firstLegal(s);
  };
  const result = driveEventsPicking(opts.deps ?? DEPS, state, pick, ...commands);
  return { ...result, offers, mins, maxes, kinds, history, taken: () => triggers };
}
