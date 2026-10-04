/**
 * docs/phase7-wave6.md §3.35: "Interrupt (thwart): When the villain schemes, this activation removes threat instead of
 * placing it" (Psychic Manipulation, `phoenix` 34017). `modifyAttack.removesThreat`, from an interrupt to the
 * `enemyScheme` in progress, turns its place-threat step into a removal of the same total (SCH + boost icons) from the
 * scheme it would have gone on. The removal is the player card's (§4.1 Q17), so with a crisis icon in play nothing is
 * placed and nothing is removed. Synthetic cards; the villain's SCH is 2 and each boost card has 1 boost icon.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;

/** "Forced Interrupt: When the villain schemes, this activation removes threat instead of placing it." */
const MANIPULATE = stubAbility(
  "manipulate.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
    effects: [{ kind: "modifyAttack", removesThreat: true }],
  }),
);
/** "Action: the villain schemes." */
const SCHEME_ABILITY = stubAbility(
  "scheme.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "enemyScheme", enemies: theVillain }] }),
);
const MANIPULATOR = stubSupport({ id: "manipulator", cost: 0, abilities: [MANIPULATE.ref] });
const SCHEMER = stubSupport({ id: "schemer", cost: 0, abilities: [SCHEME_ABILITY.ref] });
const ONE_ICON = stubTreachery({ id: "one-icon", boostIcons: 1 });

const deps: EngineDeps = depsOf(MANIPULATE, SCHEME_ABILITY);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: SCHEME_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly schemer: InstanceId;
}

/** Main scheme at 10 threat (a crisis icon on it with `crisis`); the manipulator in play unless `manipulate` is false. */
function setup(options: { readonly crisis?: boolean; readonly manipulate?: boolean } = {}): Setup {
  const inPlay = [SCHEMER, ...(options.manipulate === false ? [] : [MANIPULATOR])];
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 2 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [
        {
          startingThreat: flat(10),
          targetThreat: flat(40),
          acceleration: flat(0),
          ...(options.crisis ? { icons: ["crisis"] as const } : {}),
        },
      ],
    }),
    extraCards: [ONE_ICON, SCHEMER, MANIPULATOR],
    deck: [...inPlay.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(ONE_ICON.id, 20),
    deps,
  });
  const given = giveCards(state, p1, ...inPlay.map((c) => c.id));
  const ids = given.ids as readonly InstanceId[];
  const ready = runWith(deps, given.state, ...ids.map(play));
  return { state: ready, schemer: ids[0]! };
}

const run = (s: Setup, commands: readonly Command[]) =>
  driveSession(startSession(s.state), deps, commands, defaultPick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const threatOf = (state: GameState) => state.instances[state.mainScheme.instanceId]!.threat;

describe("modifyAttack removesThreat — 'this activation removes threat instead of placing it' (§3.35)", () => {
  it("without it, the scheme places SCH 2 + 1 boost icon", () => {
    const s = setup({ manipulate: false });
    const before = threatOf(s.state);
    const { session } = run(s, [use(s.schemer)]);
    expect(threatOf(session.state)).toBe(before + 3);
  });

  it("removes the activation's total (boost included) from the main scheme instead, with no threat placed", () => {
    const s = setup();
    const before = threatOf(s.state);
    const { session, events } = run(s, [use(s.schemer)]);
    expect(threatOf(session.state)).toBe(before - 3);
    expect(of(events, "schemeResolved")).toEqual([
      expect.objectContaining({ baseSch: 2, boostIcons: 1, threatPlaced: 0, removesThreat: true }),
    ]);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(of(events, "threatRemoved")).toEqual([
      expect.objectContaining({ schemeInstanceId: s.state.mainScheme.instanceId, amount: 3 }),
    ]);
  });

  it("with a crisis icon in play (§4.1 Q17): nothing is placed and nothing is removed", () => {
    const s = setup({ crisis: true });
    const before = threatOf(s.state);
    const { session, events } = run(s, [use(s.schemer)]);
    expect(threatOf(session.state)).toBe(before);
    expect(of(events, "threatPlaced")).toEqual([]);
    expect(of(events, "threatRemoved")).toEqual([]);
    expect(of(events, "threatRemovalBlocked")).toEqual([
      { type: "threatRemovalBlocked", schemeInstanceId: s.state.mainScheme.instanceId, reason: "crisis" },
    ]);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const { session } = run(s, [use(s.schemer), use(s.schemer)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
