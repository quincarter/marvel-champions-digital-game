/**
 * `RuleSpec attacksDividedEvenly` / `EffectSpec divideDamageEvenly`. Synthetic cards shaped like Bombshell (Iron
 * Spider's Sinister Syndicate, `spdr` 31031): "[star] Divide damage from Bombshell's attack among each character the
 * attacked player controls as evenly as possible."
 *
 * Sources: RRG 1.8 "Attack (Enemy Activation)" (pp. 8–9): step 4 reduces the damage by a hero defender's DEF, step 5
 * deals it (replaced here by the card, "The Golden Rules", p. 4), and a player other than the attacked player who
 * defends becomes the new target. RRG 1.8 "First Player" (p. 19): a choice an encounter card requires without naming
 * who makes it is the first player's.
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
import { gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const DIVIDE_RULE = stubAbility("divider.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDividedEvenly", attacker: { self: true } }] },
  effects: [],
});
const divider = (atk: number) =>
  stubMinion({ id: `divider-${atk}`, atk, sch: 1, hp: 7, boostIcons: 0, abilities: [DIVIDE_RULE.ref] });
const FIVE = divider(5);
const FOUR = divider(4);
const PLAIN = stubMinion({ id: "plain", atk: 5, sch: 1, hp: 7, boostIcons: 0 });
/** A villain printed with a dashed ATK never attacks (RRG 1.8 "Dash (Value)"), so only the minion's damage counts. */
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });

const deps: EngineDeps = depsOf(DIVIDE_RULE);

interface Table {
  readonly state: GameState;
  readonly identity: InstanceId;
  readonly ally: InstanceId | null;
}

/** p1 (and p2, with `players: 2`) in hero form, `minion` engaged with p1, and an ally for p1 unless `noAlly`. */
function start(
  minion: ReturnType<typeof stubMinion>,
  options: { noAlly?: boolean; players?: 1 | 2; tough?: boolean } = {},
): Table {
  const base = gameAtFirstTurn({
    cards: [FIVE, FOUR, PLAIN, QUIET],
    deps,
    villain: QUIET,
    encounter: [FIVE.id, FOUR.id, PLAIN.id],
    ...(options.players ? { players: options.players } : {}),
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  let ally: InstanceId | null = null;
  if (!options.noAlly) {
    const played = playerCardIntoPlay(state, ALLY.id);
    state = played.state;
    ally = played.id;
  }
  state = minionEngagedWith(state, minion.id).state;
  const identity = mustPlayer(state, P1).identity.instanceId;
  if (options.tough) {
    const hero = mustInstance(state, identity);
    state = {
      ...state,
      instances: { ...state.instances, [identity]: { ...hero, statuses: { ...hero.statuses, tough: 1 } } },
    };
  }
  return { state, identity, ally };
}

interface Prompt {
  readonly playerId: string;
  readonly authority: string;
  readonly amount: number;
  readonly each: number;
  readonly options: readonly string[];
}

/** Plays the players' turns out into the villain phase. `extra` takes the leftover points; `defender` defends (else none). */
function villainPhase(state: GameState, picks: { extra?: InstanceId; defender?: InstanceId; players?: number } = {}) {
  const prompts: Prompt[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "declareDefender" && picks.defender) {
      const defender = picks.defender;
      return choice.options.some((o) => o.optionId === defender) ? [defender] : ["decline"];
    }
    if (choice?.prompt.kind !== "divideEvenlyRemainder") return defaultPick(current);
    prompts.push({
      playerId: choice.playerId,
      authority: choice.authority,
      amount: choice.prompt.amount,
      each: choice.prompt.each,
      options: choice.options.map((o) => o.optionId),
    });
    const preferred = picks.extra ? [picks.extra] : [];
    const rest = choice.options.map((o) => o.optionId).filter((id) => !preferred.includes(id as InstanceId));
    return [...preferred, ...rest].slice(0, choice.minSelections);
  };
  const commands = [P1, P2].slice(0, picks.players ?? 1).map((playerId) => ({ type: "endTurn" as const, playerId }));
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  return { session, events, prompts };
}

const attacked = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "characterAttacked"
      ? [event.event.targetInstanceId]
      : [],
  );

/** Damage the minion's attack dealt, per character, in the order dealt. */
const dealtFromAttack = (events: readonly GameEvent[], by: InstanceId | null = null) =>
  events.flatMap((event) =>
    event.type === "damageDealt" && (by === null || event.sourceInstanceId === by)
      ? [[event.targetInstanceId, event.amount] as const]
      : [],
  );

describe("attacksDividedEvenly: an enemy attack divided among the attacked player's characters", () => {
  it("5 damage against an identity and one ally splits 3/2; the first player picks who takes the 3", () => {
    const { state, identity, ally } = start(FIVE);
    const { session, events, prompts } = villainPhase(state, { extra: identity });
    expect(prompts).toEqual([
      { playerId: P1, authority: "firstPlayerTargets", amount: 1, each: 2, options: [identity, ally] },
    ]);
    expect(mustInstance(session.state, identity).damage).toBe(3);
    expect(mustInstance(session.state, ally!).damage).toBe(2);
    // Undefended: only the identity is attacked, though the ally took part of the damage.
    expect(attacked(events)).toEqual([identity]);
  });

  it("the extra point can go to the ally instead, which is defeated by its 3", () => {
    const { state, identity, ally } = start(FIVE);
    const { session } = villainPhase(state, { extra: ally! });
    expect(mustInstance(session.state, identity).damage).toBe(2);
    expect(mustPlayer(session.state, P1).discard).toContain(ally);
  });

  it("damage that divides exactly asks nobody", () => {
    const { state, identity, ally } = start(FOUR);
    const { session, prompts } = villainPhase(state);
    expect(prompts).toEqual([]);
    expect(mustInstance(session.state, identity).damage).toBe(2);
    expect(mustInstance(session.state, ally!).damage).toBe(2);
  });

  it("with no ally, the identity takes all of it", () => {
    const { state, identity } = start(FIVE, { noAlly: true });
    const { session, prompts } = villainPhase(state);
    expect(prompts).toEqual([]);
    expect(mustInstance(session.state, identity).damage).toBe(5);
  });

  it("a hero defender's DEF reduces the attack first; the rest is still divided (5 - 2 DEF = 3, split 2/1)", () => {
    const { state, identity, ally } = start(FIVE);
    const { session, events, prompts } = villainPhase(state, { defender: identity, extra: ally! });
    expect(prompts.map((p) => [p.amount, p.each])).toEqual([[1, 1]]);
    expect(mustInstance(session.state, identity).damage).toBe(1);
    expect(mustInstance(session.state, ally!).damage).toBe(2);
    expect(attacked(events)).toEqual([identity]);
  });

  it("an ally defender takes only its share, not all of the damage (the card overrides step 5)", () => {
    const { state, identity, ally } = start(FIVE);
    const { session, events } = villainPhase(state, { defender: ally!, extra: identity });
    expect(mustInstance(session.state, identity).damage).toBe(3);
    expect(mustInstance(session.state, ally!).damage).toBe(2);
    expect(attacked(events)).toEqual([ally]);
  });

  it("a tough status card prevents only its own character's share", () => {
    const { state, identity, ally } = start(FIVE, { tough: true });
    const { session } = villainPhase(state, { extra: identity });
    expect(mustInstance(session.state, identity).damage).toBe(0);
    expect(mustInstance(session.state, identity).statuses.tough ?? 0).toBe(0);
    expect(mustInstance(session.state, ally!).damage).toBe(2);
  });

  it("another player's defender makes that player the target: the damage is divided among their characters", () => {
    const { state } = start(FIVE, { noAlly: true, players: 2 });
    const p1Identity = mustPlayer(state, P1).identity.instanceId;
    const p2Identity = mustPlayer(state, P2).identity.instanceId;
    const { session, prompts } = villainPhase(state, { defender: p2Identity, players: 2 });
    // p2's hero defends (DEF 2): 3 damage, p2 has no ally, so all of it to p2's hero; p1 takes none.
    expect(prompts).toEqual([]);
    expect(mustInstance(session.state, p2Identity).damage).toBe(3);
    expect(mustInstance(session.state, p1Identity).damage).toBe(0);
  });

  it("a minion without the rule deals its damage to the identity as usual", () => {
    const { state, identity, ally } = start(PLAIN);
    const { session, events, prompts } = villainPhase(state);
    expect(prompts).toEqual([]);
    expect(mustInstance(session.state, identity).damage).toBe(5);
    expect(mustInstance(session.state, ally!).damage).toBe(0);
    expect(dealtFromAttack(events).map(([id]) => id)).not.toContain(ally);
  });

  it("replays to the same state", () => {
    const { state, identity } = start(FIVE);
    const { session } = villainPhase(state, { extra: identity });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
