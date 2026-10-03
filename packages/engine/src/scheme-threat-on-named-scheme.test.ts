/**
 * docs/phase7-wave6.md §3.37: "[star] When Dark Phoenix schemes, place that threat on Consume the World, if able"
 * (Dark Phoenix, 34029). `RuleSpec schemeThreatDestination.scheme` as a `TargetRef` (`named`): the scheme activation's
 * threat, boost icons included, goes on that side scheme while it is in play, else on the main scheme. Synthetic
 * cards; the villain's SCH is 2 and each boost card (the default treachery) has 1 boost icon.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

/** "When this villain schemes, place that threat on Consume, if able." */
const ON_CONSUME = stubAbility(
  "phoenix.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "schemeThreatDestination", enemy: { self: true }, scheme: { kind: "named", name: "consume" } }],
    },
    effects: [],
  }),
);
/** "Action: the villain schemes." */
const SCHEME_ABILITY = stubAbility(
  "scheme.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "enemyScheme", enemies: { kind: "named", name: "phoenix" } }] }),
);
const PHOENIX = stubVillain({
  id: "phoenix",
  stages: [{ hp: flat(30), atk: 1, sch: 2, abilities: [ON_CONSUME.ref] }],
});
const CONSUME = stubSideScheme({ id: "consume", startingThreat: 0 });
const SCHEMER = stubSupport({ id: "schemer", cost: 0, abilities: [SCHEME_ABILITY.ref] });

const deps: EngineDeps = depsOf(ON_CONSUME, SCHEME_ABILITY);

interface Setup {
  readonly state: GameState;
  readonly schemer: InstanceId;
  readonly consume: InstanceId | null;
}

function setup(options: { readonly consumeInPlay: boolean }): Setup {
  const state = gameAtFirstTurn({
    cards: [CONSUME, SCHEMER],
    deps,
    villain: PHOENIX,
    encounter: [CONSUME.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [SCHEMER.id],
  });
  const schemer = playerCardIntoPlay(state, SCHEMER.id);
  if (!options.consumeInPlay) return { state: schemer.state, schemer: schemer.id, consume: null };
  const placed = encounterCardInVillainArea(schemer.state, CONSUME.id, 1);
  return { state: placed.state, schemer: schemer.id, consume: placed.id };
}

const use = (id: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: id,
  abilityId: SCHEME_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const run = (s: Setup, commands: readonly Command[]) =>
  driveSession(startSession(s.state), deps, commands, defaultPick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;

describe("schemeThreatDestination to a named scheme — 'place that threat on Consume the World, if able' (§3.37)", () => {
  it("places the activation's threat (SCH 2 + 1 boost icon) on the named side scheme, not the main scheme", () => {
    const s = setup({ consumeInPlay: true });
    const before = mainThreat(s.state);
    const { session, events } = run(s, [use(s.schemer)]);
    expect(mustInstance(session.state, s.consume!).threat).toBe(1 + 3);
    expect(mainThreat(session.state)).toBe(before);
    expect(of(events, "schemeResolved")).toEqual([
      expect.objectContaining({ schemeInstanceId: s.consume, baseSch: 2, boostIcons: 1, threatPlaced: 3 }),
    ]);
  });

  it("with the named scheme not in play ('if able'), on the main scheme", () => {
    const s = setup({ consumeInPlay: false });
    const before = mainThreat(s.state);
    const { session, events } = run(s, [use(s.schemer)]);
    expect(mainThreat(session.state)).toBe(before + 3);
    expect(of(events, "schemeResolved")).toEqual([
      expect.objectContaining({ schemeInstanceId: s.state.mainScheme.instanceId, threatPlaced: 3 }),
    ]);
  });

  it("replays deep-equal", () => {
    const s = setup({ consumeInPlay: true });
    const { session } = run(s, [use(s.schemer), use(s.schemer)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
