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
