/**
 * docs/phase7-wave6.md §3.39 and §4.1 Q23: "Ready an ally. That ally gets +2 THW and +2 ATK for its next basic thwart
 * or attack action this phase." (Psychic Kicker, `phoenix` 34034). `modifyStatUntil.until: { kind: "nextBasicPower" }`
 * waits on the ally's next basic attack or thwart (`LastingDuration nextBasicPower`), applies to that use only and
 * ends as it finishes: the first of the two ends both bonuses. It neither applies to nor is consumed by an "(attack)"
 * ability; a phase end with no such power ends it.
 *
 * Synthetic cards: the default ally (ATK 2, THW 1), a support with the bonus as an action, and a support whose
 * "(attack)" action has the ally attack the villain for its ATK.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { ALLY, defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const theAlly = { kind: "each", query: { categories: ["ally"] } } as const;
const theVillain = { kind: "named", name: "villain" } as const;
const nextBasic = { kind: "nextBasicPower", powers: ["attack", "thwart"] } as const;

/** "That ally gets +2 THW and +2 ATK for its next basic thwart or attack action this phase." */
const KICK = stubAbility(
  "kicker.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "modifyStatUntil", stat: "thw", amount: { kind: "const", value: 2 }, target: theAlly, until: nextBasic },
      { kind: "modifyStatUntil", stat: "atk", amount: { kind: "const", value: 2 }, target: theAlly, until: nextBasic },
    ],
  }),
);
/** "Action (attack): the ally attacks the villain for its ATK." */
const STRIKE = stubAbility(
  "striker.action",
  def({
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [
      {
        kind: "attack",
        target: theVillain,
        attacker: theAlly,
        amount: { kind: "stat", of: theAlly, stat: "atk" },
      },
    ],
  }),
);
const KICKER = stubSupport({ id: "kicker", cost: 0, abilities: [KICK.ref] });
const STRIKER = stubSupport({ id: "striker", cost: 0, abilities: [STRIKE.ref] });

const deps: EngineDeps = depsOf(KICK, STRIKE);

interface Setup {
  readonly state: GameState;
  readonly ally: InstanceId;
  readonly kicker: InstanceId;
  readonly striker: InstanceId;
}

function setup(): Setup {
  const base = gameAtFirstTurn({ cards: [KICKER, STRIKER], deps, deck: [KICKER.id, STRIKER.id] });
  const ally = playerCardIntoPlay(base, ALLY.id);
  const kicker = playerCardIntoPlay(ally.state, KICKER.id);
  const striker = playerCardIntoPlay(kicker.state, STRIKER.id);
  const state = striker.state;
  const main = state.mainScheme.instanceId;
  return {
    state: { ...state, instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 6 } } },
    ally: ally.id,
    kicker: kicker.id,
    striker: striker.id,
  };
}

const use = (card: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});
const attack = (s: Setup): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: s.ally,
  targetInstanceId: s.state.villains[0]!.instanceId,
});
const thwart = (s: Setup): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: s.ally,
  schemeInstanceId: s.state.mainScheme.instanceId,
});
const ready = (state: GameState, id: InstanceId): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), exhausted: false } },
});
const run = (state: GameState, commands: readonly Command[]) =>
  driveSession(startSession(state), deps, commands, defaultPick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const waiting = (state: GameState) => state.lastingEffects.filter((e) => e.duration.kind === "nextBasicPower");

describe("modifyStatUntil nextBasicPower — '+2 THW and +2 ATK for its next basic thwart or attack' (§3.39)", () => {
  it("waits without applying, then the next basic attack deals ATK 2 + 2 and ends both bonuses (§4.1 Q23)", () => {
    const s = setup();
    const kicked = run(s.state, [use(s.kicker, KICK)]).session.state;
    expect(waiting(kicked)).toHaveLength(2);
    expect(characterProfile(kicked, s.ally, deps)?.atk).toBe(2);
    expect(characterProfile(kicked, s.ally, deps)?.thw).toBe(1);
    const { session, events } = run(kicked, [attack(s)]);
    expect(villainDamage(session.state) - villainDamage(kicked)).toBe(4);
    expect(of(events, "lastingEffectRetimed")).toHaveLength(2);
    expect(session.state.lastingEffects).toEqual([]);
    // Readied, its next basic thwart has no bonus: THW 1.
    const { session: after } = run(ready(session.state, s.ally), [thwart(s)]);
    expect(mainThreat(session.state) - mainThreat(after.state)).toBe(1);
  });

  it("the next basic thwart removes THW 1 + 2, and its next basic attack is back to ATK 2", () => {
    const s = setup();
    const kicked = run(s.state, [use(s.kicker, KICK)]).session.state;
    const { session } = run(kicked, [thwart(s)]);
    expect(mainThreat(kicked) - mainThreat(session.state)).toBe(3);
    expect(session.state.lastingEffects).toEqual([]);
    const { session: after } = run(ready(session.state, s.ally), [attack(s)]);
    expect(villainDamage(after.state) - villainDamage(session.state)).toBe(2);
  });

  it("an '(attack)' ability by the ally neither gets the bonus nor consumes it", () => {
    const s = setup();
    const kicked = run(s.state, [use(s.kicker, KICK)]).session.state;
    const { session } = run(kicked, [use(s.striker, STRIKE)]);
    expect(villainDamage(session.state) - villainDamage(kicked)).toBe(2);
    expect(waiting(session.state)).toHaveLength(2);
    const { session: after } = run(session.state, [attack(s)]);
    expect(villainDamage(after.state) - villainDamage(session.state)).toBe(4);
  });

  it("ends at the end of the phase with no basic power made", () => {
    const s = setup();
    const kicked = run(s.state, [use(s.kicker, KICK)]).session.state;
    const { session, events } = run(kicked, [{ type: "endTurn", playerId: P1 }]);
    expect(waiting(session.state)).toEqual([]);
    expect(of(events, "lastingEffectEnded").filter((e) => e.reason === "expired").length).toBeGreaterThanOrEqual(2);
  });

  it("replays deep-equal", () => {
    const s = setup();
    const { session } = run(s.state, [use(s.kicker, KICK), use(s.striker, STRIKE), attack(s)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
