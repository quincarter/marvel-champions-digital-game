/**
 * docs/phase7-wave5.md §4.1 Q65: an attack records the damage each character took from it (`damageTakenKey`), read by
 * `Predicate eventDamageTakenAtLeast`. Synthetic cards shaped like Sandman's Sand Blast / Sand Wave (`sm` 27061–27063):
 * "When Sandman attacks you, that attack deals indirect damage [gains overkill]. If your identity takes any amount of
 * damage from that attack, …".
 *
 * Sources: RRG 1.8 "Indirect Damage" (p. 24): the attacked player assigns indirect damage among the characters they
 * control. RRG 1.8 "Overkill" (p. 31): excess damage from an attack against a defeated character is dealt to that
 * character's controller's identity. RRG 1.8 "Tough" (p. 44) and "Prevent" (p. 35): prevented damage is not taken.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { damageTakenKey } from "./trigger-events.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubVillain } from "./testing/fixtures.js";
import { ALLY, defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** "If your identity takes any amount of damage from that attack, place 1 hit counter on this card." */
const sandBlast = (attackChange: AbilityDefinition["effects"][number]): AbilityDefinition => ({
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [
    attackChange,
    {
      kind: "atEndOfAttack",
      effects: [
        {
          kind: "if",
          condition: {
            kind: "eventDamageTakenAtLeast",
            of: { kind: "each", query: { categories: ["identity"], controller: "you" } },
            amount: 1,
          },
          then: [
            { kind: "addCounters", target: { kind: "self" }, counterType: "hit", amount: { kind: "const", value: 1 } },
          ],
        },
      ],
    },
  ],
});

const INDIRECT_BLAST = stubAbility(
  "indirect-blast",
  sandBlast({
    kind: "applyRuleUntil",
    rule: { kind: "attacksDealIndirectDamage", attacker: { self: true } },
    until: "endOfAttack",
  }),
);
const OVERKILL_WAVE = stubAbility("overkill-wave", sandBlast({ kind: "modifyAttack", keywords: ["overkill"] }));

const INDIRECT_SANDY = stubMinion({
  id: "indirect-sandy",
  atk: 3,
  sch: 1,
  hp: 9,
  boostIcons: 0,
  abilities: [INDIRECT_BLAST.ref],
});
const OVERKILL_SANDY = stubMinion({
  id: "overkill-sandy",
  atk: 5,
  sch: 1,
  hp: 9,
  boostIcons: 0,
  abilities: [OVERKILL_WAVE.ref],
});
/** A villain printed with a dashed ATK never attacks (RRG 1.8 "Dash (Value)"), so only the minion's attack counts. */
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });

const deps: EngineDeps = depsOf(INDIRECT_BLAST, OVERKILL_WAVE);

interface Table {
  readonly state: GameState;
  readonly ally: InstanceId;
  readonly identity: InstanceId;
  readonly minion: InstanceId;
}

/** p1 in hero form with a 3-HP ally in play and `minion` engaged; `tough` gives the identity a tough status card. */
function start(minion: typeof INDIRECT_SANDY, tough = false): Table {
  const base = gameAtFirstTurn({
    cards: [INDIRECT_SANDY, OVERKILL_SANDY, QUIET],
    deps,
    villain: QUIET,
    encounter: [INDIRECT_SANDY.id, OVERKILL_SANDY.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ally = playerCardIntoPlay(heroes, ALLY.id);
  const engaged = minionEngagedWith(ally.state, minion.id);
  const identity = mustPlayer(engaged.state, P1).identity.instanceId;
  const state: GameState = tough
    ? {
        ...engaged.state,
        instances: {
          ...engaged.state.instances,
          [identity]: {
            ...mustInstance(engaged.state, identity),
            statuses: { ...mustInstance(engaged.state, identity).statuses, tough: 1 },
          },
        },
      }
    : engaged.state;
  return { state, ally: ally.id, identity, minion: engaged.id };
}

/**
 * Plays the villain phase. `toIdentity`: how many points of indirect damage the player assigns to the identity (the
 * rest to the ally). `defender`: the character declared as defender, if any.
 */
function villainPhase(table: Table, options: { toIdentity?: number; defender?: InstanceId }) {
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "declareDefender" && options.defender) return [options.defender];
    if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(current);
    const toIdentity = options.toIdentity ?? 0;
    const ofIdentity = choice.options.filter((o) => o.optionId.startsWith(`${table.identity}#`)).slice(0, toIdentity);
    const ofAlly = choice.options.filter((o) => o.optionId.startsWith(`${table.ally}#`));
    return [...ofIdentity, ...ofAlly].slice(0, choice.minSelections).map((o) => o.optionId);
  };
  return driveSession(startSession(table.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
}

const hits = (state: GameState, minion: InstanceId): number => mustInstance(state, minion).counters["hit"] ?? 0;

/** The finished minion attack's results, as its resolved log line recorded them. */
const attackResults = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "enemyAttack"
      ? [event.event.results ?? {}]
      : [],
  );

describe("§4.1 Q65 an attack records each character's damage taken", () => {
  it("indirect damage all on the identity: the identity took damage from that attack", () => {
    const table = start(INDIRECT_SANDY);
    const { session, events } = villainPhase(table, { toIdentity: 3 });
    expect(mustInstance(session.state, table.identity).damage).toBe(3);
    expect(hits(session.state, table.minion)).toBe(1);
    const [results] = attackResults(events);
    expect(results?.[damageTakenKey(table.identity)]).toBe(3);
    expect(results?.[damageTakenKey(table.ally)]).toBeUndefined();
  });

  it("indirect damage all on an ally: the identity took none, though it was the attacked character", () => {
    const table = start(INDIRECT_SANDY);
    const { session, events } = villainPhase(table, { toIdentity: 0 });
    expect(mustPlayer(session.state, P1).discard).toContain(table.ally);
    expect(mustInstance(session.state, table.identity).damage).toBe(0);
    expect(hits(session.state, table.minion)).toBe(0);
    const [results] = attackResults(events);
    expect(results?.["damage"]).toBe(3);
    expect(results?.[damageTakenKey(table.identity)]).toBeUndefined();
    expect(results?.[damageTakenKey(table.ally)]).toBe(3);
  });

  it("indirect damage split between the identity and an ally: the identity took damage", () => {
    const table = start(INDIRECT_SANDY);
    const { session, events } = villainPhase(table, { toIdentity: 1 });
    expect(mustInstance(session.state, table.identity).damage).toBe(1);
    expect(mustInstance(session.state, table.ally).damage).toBe(2);
    expect(hits(session.state, table.minion)).toBe(1);
    const [results] = attackResults(events);
    expect(results?.[damageTakenKey(table.identity)]).toBe(1);
    expect(results?.[damageTakenKey(table.ally)]).toBe(2);
  });

  it("indirect damage on the identity prevented by its tough status card is not taken", () => {
    const table = start(INDIRECT_SANDY, true);
    const { session, events } = villainPhase(table, { toIdentity: 3 });
    expect(mustInstance(session.state, table.identity).damage).toBe(0);
    expect(mustInstance(session.state, table.identity).statuses.tough).toBe(0);
    expect(hits(session.state, table.minion)).toBe(0);
    const [results] = attackResults(events);
    expect(results?.[damageTakenKey(table.identity)]).toBeUndefined();
  });

  it("overkill spill onto the identity after a defending ally is defeated is damage the identity took", () => {
    const table = start(OVERKILL_SANDY);
    const { session, events } = villainPhase(table, { defender: table.ally });
    // ATK 5 into the 3-HP defending ally: it is defeated and 2 excess spills to the identity.
    expect(mustPlayer(session.state, P1).discard).toContain(table.ally);
    expect(mustInstance(session.state, table.identity).damage).toBe(2);
    expect(hits(session.state, table.minion)).toBe(1);
    const [results] = attackResults(events);
    // The ally takes all 5 ("any damage on that ally beyond its hit points" is dealt on, RRG p. 31; the FAQ calls it the
    // excess damage "taken" by the ally), and the identity takes the 2 spilled.
    expect(results?.[damageTakenKey(table.ally)]).toBe(5);
    expect(results?.[damageTakenKey(table.identity)]).toBe(2);
  });

  it("an overkill attack a defending ally survives: the identity took none", () => {
    const table = start(OVERKILL_SANDY);
    const tough = {
      ...table,
      state: {
        ...table.state,
        instances: {
          ...table.state.instances,
          [table.ally]: {
            ...mustInstance(table.state, table.ally),
            statuses: { ...mustInstance(table.state, table.ally).statuses, tough: 1 },
          },
        },
      },
    };
    const { session } = villainPhase(tough, { defender: tough.ally });
    // The ally's tough status card prevents all 5: nothing is taken, so nothing spills.
    expect(mustPlayer(session.state, P1).playArea).toContain(tough.ally);
    expect(mustInstance(session.state, tough.identity).damage).toBe(0);
    expect(hits(session.state, tough.minion)).toBe(0);
  });

  it("replays to the same state", () => {
    for (const [minion, options] of [
      [INDIRECT_SANDY, { toIdentity: 1 }],
      [OVERKILL_SANDY, { defender: "ally" }],
    ] as const) {
      const table = start(minion);
      const { session } = villainPhase(table, "defender" in options ? { defender: table.ally } : options);
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    }
  });
});
