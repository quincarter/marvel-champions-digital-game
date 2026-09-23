/**
 * docs/phase7-wave3.md §3.44: an ally's consequential damage carries the results of the basic power it follows
 * (`attack.*` / `thwart.*`). Synthetic cards shaped like Martyr (`drax` 19012): "Response: After Martyr takes
 * consequential damage from performing an attack, if that attack defeated an enemy, give her a tough status card."
 *
 * Sources: RRG 1.8 "Consequential Damage" (p. 13): "Consequential damage is dealt to an ally after resolving abilities
 * that are triggered by the ally attacking or thwarting." The printed timing is kept: the response is to the
 * consequential damage itself, so the tough status card it gives arrives after that damage and cannot absorb it (RRG 1.8
 * "Tough", p. 44).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const MARTYR_RESPONSE = stubAbility("martyr.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "dealDamage", selfIs: "target", requireResults: { amount: 1, "attack.defeated": 1 } },
  },
  effects: [{ kind: "giveStatus", target: { kind: "self" }, status: "tough" }],
});
const MARTYR = stubAlly({ id: "martyr", cost: 0, atk: 2, thw: 1, hp: 3, abilities: [MARTYR_RESPONSE.ref] });
/** A witness counting which power each consequential damage it sees came from (forced, so always resolved). */
const witness = (power: "attack" | "thwart") =>
  stubAbility(`witness.${power}`, {
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "dealDamage", targetIs: { name: "martyr" }, requireResults: { [`${power}.made`]: 1 } },
    },
    effects: [
      { kind: "addCounters", target: { kind: "self" }, counterType: power, amount: { kind: "const", value: 1 } },
    ],
  });
const WITNESS_ATTACK = witness("attack");
const WITNESS_THWART = witness("thwart");
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_ATTACK.ref, WITNESS_THWART.ref] });
const WEAK = stubMinion({ id: "weak", atk: 0, sch: 0, hp: 2 });
const STURDY = stubMinion({ id: "sturdy", atk: 0, sch: 0, hp: 9 });
const PLOT = stubSideScheme({ id: "plot", startingThreat: 3 });

const deps: EngineDeps = depsOf(MARTYR_RESPONSE, WITNESS_ATTACK, WITNESS_THWART);
const CARDS = [MARTYR, WITNESS, WEAK, STURDY, PLOT];
const ENCOUNTER: readonly CardId[] = [WEAK.id, STURDY.id, PLOT.id];

interface Table {
  readonly state: GameState;
  readonly martyr: InstanceId;
  readonly weak: InstanceId;
  readonly sturdy: InstanceId;
  readonly plot: InstanceId;
  readonly witness: InstanceId;
}

function table(): Table {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: [MARTYR.id, WITNESS.id], encounter: ENCOUNTER });
  const witnessed = playerCardIntoPlay(base, WITNESS.id);
  const martyr = playerCardIntoPlay(witnessed.state, MARTYR.id);
  const weak = minionEngagedWith(martyr.state, WEAK.id);
  const sturdy = minionEngagedWith(weak.state, STURDY.id);
  const plot = encounterCardInVillainArea(sturdy.state, PLOT.id, 3);
  return {
    state: plot.state,
    martyr: martyr.id,
    weak: weak.id,
    sturdy: sturdy.id,
    plot: plot.id,
    witness: witnessed.id,
  };
}

const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};

const attack = (t: Table, target: InstanceId) =>
  runCommandsPicking(t.state, deps, acceptTriggers, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: t.martyr,
    targetInstanceId: target,
  });

/** The results the consequential damage's own response window saw. */
const consequentialResults = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.event.kind === "dealDamage" && e.event.consequential === true
      ? [e.event.results ?? {}]
      : [],
  );

describe("§3.44 consequential damage knows the attack it came from", () => {
  it("an attack that defeats an enemy: the damage is taken first, then the response gives tough", () => {
    const t = table();
    const { state, events, session } = attack(t, t.weak);
    expect(state.instances[t.weak] === undefined || !state.players[0]!.playArea.includes(t.weak)).toBe(true);
    // The consequential damage landed (the fresh tough status did not absorb it) and the tough status followed it.
    expect(mustInstance(state, t.martyr).damage).toBe(1);
    expect(mustInstance(state, t.martyr).statuses.tough).toBe(1);
    const [results] = consequentialResults(events);
    expect(results).toEqual(expect.objectContaining({ amount: 1, "attack.made": 1, "attack.defeated": 1 }));
    expect(mustInstance(state, t.witness).counters).toEqual({ attack: 1 });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an attack that defeats nothing: no tough status", () => {
    const t = table();
    const { state, events } = attack(t, t.sturdy);
    expect(mustInstance(state, t.martyr).damage).toBe(1);
    expect(mustInstance(state, t.martyr).statuses.tough).toBe(0);
    const [results] = consequentialResults(events);
    expect(results).toEqual(expect.objectContaining({ "attack.made": 1 }));
    expect(results?.["attack.defeated"] ?? 0).toBe(0);
  });

  it("a thwart's consequential damage carries the thwart's results, not an attack's", () => {
    const t = table();
    const { state, events } = runCommandsPicking(t.state, deps, acceptTriggers, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: t.martyr,
      schemeInstanceId: t.plot,
    });
    expect(mustInstance(state, t.martyr).statuses.tough).toBe(0);
    const [results] = consequentialResults(events);
    expect(results).toEqual(expect.objectContaining({ "thwart.made": 1 }));
    expect(Object.keys(results ?? {}).some((key) => key.startsWith("attack."))).toBe(false);
    expect(mustInstance(state, t.witness).counters).toEqual({ thwart: 1 });
  });

  it("a tough status already on her absorbs the consequential damage, so she did not take it: no response", () => {
    const t = table();
    const tough: Table = {
      ...t,
      state: {
        ...t.state,
        instances: {
          ...t.state.instances,
          [t.martyr]: {
            ...mustInstance(t.state, t.martyr),
            statuses: { ...mustInstance(t.state, t.martyr).statuses, tough: 1 },
          },
        },
      },
    };
    const { state } = attack(tough, tough.weak);
    expect(mustInstance(state, t.martyr).damage).toBe(0);
    expect(mustInstance(state, t.martyr).statuses.tough).toBe(0);
  });
});
