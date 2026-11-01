/**
 * docs/phase7-wave3.md §3.16: `RuleSpec attacksDealIndirectDamage`. Synthetic cards shaped like Starshark (Menagerie
 * Medley, `gmw` 16137): "[star] Starshark's attacks deal indirect damage."
 *
 * Sources: RRG 1.8 "Indirect Damage" (p. 24): "If an enemy's attack deals indirect damage, the indirect damage is dealt
 * during step four of the enemy activation … Only the defending character, or the attacked player's identity if the
 * attack was undefended, is considered to have been attacked".
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubVillain } from "./testing/fixtures.js";
import { ALLY, defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const STARSHARK_RULE = stubAbility("starshark.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }] },
  effects: [],
});
const STARSHARK = stubMinion({
  id: "starshark",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  abilities: [STARSHARK_RULE.ref],
});
const PLAIN_SHARK = stubMinion({ id: "plain-shark", atk: 3, sch: 1, hp: 7, boostIcons: 0 });
/** A villain printed with a dashed ATK never attacks (RRG 1.8 "Dash (Value)"), so only the minion's damage counts. */
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });

const deps: EngineDeps = depsOf(STARSHARK_RULE);

/** p1 in hero form with an ally in play and `shark` engaged. */
function start(shark: typeof STARSHARK): { state: GameState; ally: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [STARSHARK, PLAIN_SHARK, QUIET],
    deps,
    villain: QUIET,
    encounter: [STARSHARK.id, PLAIN_SHARK.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ally = playerCardIntoPlay(heroes, ALLY.id);
  const engaged = minionEngagedWith(ally.state, shark.id);
  return { state: engaged.state, ally: ally.id };
}

/** Plays the villain phase; indirect damage is assigned to the ally first, then the identity. */
function villainPhase(state: GameState, ally: InstanceId) {
  const prompts: number[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(current);
    prompts.push(choice.prompt.amount);
    const allyFirst = [...choice.options].sort((a, b) =>
      a.optionId.startsWith(`${ally}#`) === b.optionId.startsWith(`${ally}#`)
        ? 0
        : a.optionId.startsWith(`${ally}#`)
          ? -1
          : 1,
    );
    return allyFirst.slice(0, choice.minSelections).map((option) => option.optionId);
  };
  const { session, events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
  return { session, events, prompts };
}

const attacked = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "characterAttacked"
      ? [event.event.targetInstanceId]
      : [],
  );

describe("§3.16 an attack that deals indirect damage", () => {
  it("its damage is assigned by the attacked player, among characters they control", () => {
    const { state, ally } = start(STARSHARK);
    const { session, events, prompts } = villainPhase(state, ally);
    expect(prompts).toEqual([3]);
    // The ally (3 hit points) takes all 3, assigned there first by the picker, and is defeated.
    expect(mustPlayer(session.state, P1).discard).toContain(ally);
    const identity = mustPlayer(session.state, P1).identity.instanceId;
    expect(mustInstance(session.state, identity).damage).toBe(0);
    // Undefended: only the identity is attacked, though the ally took the damage.
    expect(attacked(events)).toEqual([identity]);
  });

  it("a minion without the rule deals its damage to the identity as usual", () => {
    const { state, ally } = start(PLAIN_SHARK);
    const { session, prompts } = villainPhase(state, ally);
    expect(prompts).toEqual([]);
    expect(mustInstance(session.state, mustPlayer(session.state, P1).identity.instanceId).damage).toBe(3);
  });

  it("replays to the same state", () => {
    const { state, ally } = start(STARSHARK);
    const { session } = villainPhase(state, ally);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

/**
 * RRG 1.8 "Indirect Damage" (p. 24): "Only the defending character, or the attacked player's identity if the attack was
 * undefended, is considered to have been attacked, even if other characters were assigned some or all of the indirect
 * damage." RRG 1.8 "Piercing" (p. 32): "An attack with the piercing keyword discards any tough status cards from the
 * attacked character before dealing damage." So an undefended piercing attack that deals indirect damage pierces the
 * identity only; an ally assigned the damage keeps its tough status card, which prevents the damage. Ruling January 24,
 * 2025 #64 agrees ("the chosen enemy is not affected by piercing": piercing affects the attacked character only).
 * (The engine passes the attacked character on the `dealIndirectDamage` effect; `executeDealIndirectDamage` gives its
 * share the attack's piercing and marks every other share `pierceExempt`, which `attackPierces` reads.)
 */
const SANDMAN = stubMinion({
  id: "sandman-ish",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  keywords: [{ name: "piercing" }],
  abilities: [STARSHARK_RULE.ref],
});

describe("undefended piercing attack that deals indirect damage (RRG 1.8 pp. 24, 32)", () => {
  it("an ally assigned the damage was not attacked: its tough status card is not pierced and prevents it", () => {
    const base = gameAtFirstTurn({ cards: [SANDMAN, QUIET], deps, villain: QUIET, encounter: [SANDMAN.id] });
    const heroes: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const ally = playerCardIntoPlay(heroes, ALLY.id);
    const toughAlly: GameState = {
      ...ally.state,
      instances: {
        ...ally.state.instances,
        [ally.id]: {
          ...mustInstance(ally.state, ally.id),
          statuses: { stunned: 0, confused: 0, tough: 1 },
        },
      },
    };
    const engaged = minionEngagedWith(toughAlly, SANDMAN.id);
    const allyId: InstanceId = ally.id;
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(current);
      return choice.options
        .filter((o) => o.optionId.startsWith(`${allyId}#`))
        .slice(0, choice.minSelections)
        .map((o) => o.optionId);
    };
    const { session } = driveSession(startSession(engaged.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    const after = session.state;
    // Tough absorbed all 3: the ally is undamaged and still in play.
    expect(mustPlayer(after, P1).discard).not.toContain(allyId);
    expect(mustInstance(after, allyId).damage).toBe(0);
  });

  it("the undefended identity was attacked: its tough status card is pierced and it takes the damage", () => {
    const base = gameAtFirstTurn({ cards: [SANDMAN, QUIET], deps, villain: QUIET, encounter: [SANDMAN.id] });
    const heroes: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const identityId = mustPlayer(heroes, P1).identity.instanceId;
    const toughHero: GameState = {
      ...heroes,
      instances: {
        ...heroes.instances,
        [identityId]: { ...mustInstance(heroes, identityId), statuses: { stunned: 0, confused: 0, tough: 1 } },
      },
    };
    const engaged = minionEngagedWith(toughHero, SANDMAN.id);
    const { session } = driveSession(
      startSession(engaged.state),
      deps,
      [{ type: "endTurn", playerId: P1 }],
      defaultPick,
    );
    const after = session.state;
    expect(mustInstance(after, identityId).statuses.tough).toBe(0);
    expect(mustInstance(after, identityId).damage).toBe(3);
  });
});

/** "When this enemy attacks, that attack gains piercing": piercing granted to the attack alone, not printed. */
const GRANT_PIERCING = stubAbility("granted-piercing.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [{ kind: "modifyAttack", keywords: ["piercing"] }],
});
const GRANTED = stubMinion({
  id: "granted-piercing",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  abilities: [STARSHARK_RULE.ref, GRANT_PIERCING.ref],
});
/**
 * "When a character defends against this enemy, deal 3 damage to the defending character." An interrupt: responses to
 * a defense wait for the attack to end (RRG 1.8 "Defend, Defense", p. 16).
 */
const SNIPE = stubAbility("sniper.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "defended" } },
  effects: [{ kind: "dealDamage", target: { kind: "defendingCharacter" }, amount: { kind: "const", value: 3 } }],
});
const SNIPER = stubMinion({
  id: "sniper",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  keywords: [{ name: "piercing" }],
  abilities: [STARSHARK_RULE.ref, SNIPE.ref],
});
/** Bombshell-shaped (`spdr` 31031), with piercing: "Divide damage from this enemy's attack … as evenly as possible." */
const DIVIDE_RULE = stubAbility("divider.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDividedEvenly", attacker: { self: true } }] },
  effects: [],
});
const PIERCING_DIVIDER = stubMinion({
  id: "piercing-divider",
  atk: 4,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  keywords: [{ name: "piercing" }],
  abilities: [DIVIDE_RULE.ref],
});
const pierceDeps: EngineDeps = depsOf(STARSHARK_RULE, GRANT_PIERCING, SNIPE, DIVIDE_RULE);

/** p1 in hero form with an ally in play and `minion` engaged; `tough` puts a tough status card on those characters. */
function pierceTable(
  minion: ReturnType<typeof stubMinion>,
  tough: { identity?: boolean; ally?: boolean },
): { state: GameState; identity: InstanceId; ally: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SANDMAN, GRANTED, SNIPER, PIERCING_DIVIDER, QUIET],
    deps: pierceDeps,
    villain: QUIET,
    encounter: [minion.id],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const played = playerCardIntoPlay(heroes, ALLY.id);
  const identity = mustPlayer(played.state, P1).identity.instanceId;
  const withTough = (state: GameState, id: InstanceId): GameState => {
    const card = mustInstance(state, id);
    return { ...state, instances: { ...state.instances, [id]: { ...card, statuses: { ...card.statuses, tough: 1 } } } };
  };
  let state = played.state;
  if (tough.identity) state = withTough(state, identity);
  if (tough.ally) state = withTough(state, played.id);
  return { state: minionEngagedWith(state, minion.id).state, identity, ally: played.id };
}

/**
 * Plays p1's turn out into the villain phase: `defender` defends (else none), indirect damage is assigned by `split`
 * (points per character), and divided damage's leftover points go to `split`'s characters first.
 */
function pierceVillainPhase(
  state: GameState,
  picks: { defender?: InstanceId; split?: Readonly<Record<string, number>> },
) {
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return picks.defender ? [picks.defender] : ["decline"];
    if (choice?.prompt.kind === "assignIndirectDamage" && picks.split) {
      const split = picks.split;
      return Object.entries(split).flatMap(([id, points]) =>
        choice.options
          .filter((o) => o.optionId.startsWith(`${id}#`))
          .slice(0, points)
          .map((o) => o.optionId),
      );
    }
    return defaultPick(current);
  };
  return driveSession(startSession(state), pierceDeps, [{ type: "endTurn", playerId: P1 }], pick);
}

/** The characters whose tough status cards piercing discarded, in order. */
const pierced = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "statusRemoved" && event.status === "tough" && event.reason === "piercing" ? [event.instanceId] : [],
  );

describe("piercing on an attack whose damage is split among characters (RRG 1.8 pp. 24, 32; ruling Jan 24, 2025 #64)", () => {
  it("a defended indirect attack pierces the defending ally only; the identity's tough card prevents its share", () => {
    const { state, identity, ally } = pierceTable(SANDMAN, { identity: true, ally: true });
    const { session, events } = pierceVillainPhase(state, { defender: ally, split: { [ally]: 2, [identity]: 1 } });
    expect(pierced(events)).toEqual([ally]);
    expect(mustInstance(session.state, ally).damage).toBe(2);
    expect(mustInstance(session.state, identity).damage).toBe(0);
    expect(mustInstance(session.state, identity).statuses.tough).toBe(0);
  });

  it("a defending ally that leaves play before the damage makes the identity the attacked character: it is pierced", () => {
    const { state, identity, ally } = pierceTable(SNIPER, { identity: true });
    const { session, events } = pierceVillainPhase(state, { defender: ally });
    expect(mustPlayer(session.state, P1).discard).toContain(ally);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "defenderLeftPlay", defenderInstanceId: ally, targetInstanceId: identity }),
    );
    expect(pierced(events)).toEqual([identity]);
    expect(mustInstance(session.state, identity).damage).toBe(3);
  });

  it("piercing granted to this attack alone reaches the attacked identity's share, and no one else's", () => {
    const { state, identity, ally } = pierceTable(GRANTED, { identity: true, ally: true });
    const { session, events } = pierceVillainPhase(state, { split: { [identity]: 2, [ally]: 1 } });
    expect(pierced(events)).toEqual([identity]);
    expect(mustInstance(session.state, identity).damage).toBe(2);
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(mustInstance(session.state, ally).statuses.tough).toBe(0);
  });

  it("a divided piercing attack pierces the attacked identity only, even with the attacker's printed piercing", () => {
    const { state, identity, ally } = pierceTable(PIERCING_DIVIDER, { identity: true, ally: true });
    const { session, events } = pierceVillainPhase(state, {});
    expect(pierced(events)).toEqual([identity]);
    // 4 damage split 2/2: the identity's tough card is pierced, the ally's prevents its share.
    expect(mustInstance(session.state, identity).damage).toBe(2);
    expect(mustInstance(session.state, ally).damage).toBe(0);
    expect(mustInstance(session.state, ally).statuses.tough).toBe(0);
  });
});
