import { trait } from "@mc/content";
import type { Command, EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import {
  after,
  chooseTarget,
  chosen,
  dealDamage,
  query,
  resolveSpecialsOf,
  response,
  special,
  theVillain,
  you,
} from "../../dsl/index.js";
import { firstLegal, P1, type Picker } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { BP_DEPS } from "./testing.js";

/**
 * Test helpers of `bp/aspect-basic`. Every earlier script and this pack's own are loaded (`BP_DEPS`); the second half of
 * the module is not scripted yet, so Ayo's Special (51023, the other Dora Milaje ally Aneka resolves) is a test stand-in
 * that deals 1 damage to the villain, defined only in `AYO_DEPS`.
 */
export const DEPS: EngineDeps = BP_DEPS;

/** `DEPS` with a stand-in for Ayo's printed Special (the real one is in the second half of the module). */
export const AYO_DEPS: EngineDeps = {
  abilities: {
    ...BP_DEPS.abilities,
    "51023.ayo-special": special(dealDamage(1, theVillain)),
  },
};

/**
 * `AYO_DEPS` with a stand-in for Ayo's printed Response too (the real one is in the second half of the module): the same
 * shape as Aneka's, so Aneka's own Special can be resolved by another Dora Milaje ally.
 */
export const AYO_RESPONSE_DEPS: EngineDeps = {
  abilities: {
    ...AYO_DEPS.abilities,
    "51023.ayo-response": response(
      after.basicPowerUsed("self"),
      chooseTarget("ally", query("ally", { trait: trait("DORA MILAJE"), not: { self: true } })),
      resolveSpecialsOf(chosen("ally"), you),
    ),
  },
};

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
  readonly target?: readonly (InstanceId | string)[];
  readonly option?: readonly string[];
  readonly defender?: InstanceId;
}
export function scripted(state: GameState, commands: readonly Command[], opts: ScriptOpts = {}) {
  const offers: Record<string, string[]> = {};
  const mins: Record<string, number> = {};
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
    if (open.prompt.kind === "chooseTriggers") {
      const hit = ids.find((o) => (opts.accept ?? []).some((a) => o.endsWith(a)));
      if (hit) {
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
  return { ...result, offers, mins, kinds, history, taken: () => triggers };
}
