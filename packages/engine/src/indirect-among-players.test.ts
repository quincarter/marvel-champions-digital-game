/**
 * docs/phase7-wave3.md §3.38: "assign N indirect damage among players" is `dealIndirectDamage { to: "group" }`, already
 * in the engine and untested until now. Synthetic cards shaped like Museum Ship (`gmw` 16085b): "Forced Interrupt: When
 * the villain phase begins, choose one: exhaust the Milano → assign 2[per_hero] indirect damage among players; or
 * assign 3[per_hero] indirect damage among players."
 *
 * Sources: RRG 1.8 "Indirect Damage" (p. 24): "Indirect damage dealt to a group of players (or among players) can be
 * divided as the group chooses among friendly characters in play"; "First Player" (p. 19): a choice an encounter
 * card leaves open with no player named is the first player's.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const perHero = (perPlayer: number) => ({ kind: "perPlayer", base: 0, perPlayer }) as const;
const MILANO_QUERY = { categories: ["support" as const], name: "Milano" };

const SHIP_ABILITY = stubAbility(
  "ship.forced-interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
    effects: [
      {
        kind: "chooseOne",
        chooser: { kind: "firstPlayer" },
        options: [
          {
            label: "Exhaust the Milano → assign 2[per_hero] indirect damage among players",
            condition: { kind: "exists", query: { ...MILANO_QUERY, exhausted: false } },
            effects: [
              { kind: "exhaust", target: { kind: "each", query: MILANO_QUERY } },
              { kind: "dealIndirectDamage", to: "group", amount: perHero(2) },
            ],
          },
          {
            label: "Assign 3[per_hero] indirect damage among players",
            effects: [{ kind: "dealIndirectDamage", to: "group", amount: perHero(3) }],
          },
        ],
      },
    ],
  }),
);
const SHIP = stubEnvironment({ id: "ship", abilities: [SHIP_ABILITY.ref] });
const MILANO = { ...stubSupport({ id: "milano", cost: 0 }), name: "Milano" };
const QUIET = stubMainScheme({
  id: "quiet",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});
const deps = depsOf(SHIP_ABILITY);

function start(): { state: GameState; milano: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SHIP, MILANO, QUIET],
    deps,
    players: 2,
    mainScheme: QUIET,
    encounter: [SHIP.id, ...copiesOf(TREACHERY.id, 30)],
    deck: [MILANO.id],
  });
  const ship = encounterCardInVillainArea(base, SHIP.id);
  const milano = playerCardIntoPlay(ship.state, MILANO.id, P1);
  return { state: milano.state, milano: milano.id };
}

/** Records the ship's prompts; takes `option`, then puts all the indirect damage on p2's identity. */
function picking(option: "0" | "1", seen: PendingChoice[]) {
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseOption") {
      seen.push(choice);
      return [option];
    }
    if (choice.prompt.kind === "assignIndirectDamage") {
      seen.push(choice);
      const p2 = mustPlayer(state, P2).identity.instanceId;
      return choice.options
        .filter((o) => o.optionId.startsWith(`${p2}#`))
        .slice(0, choice.minSelections)
        .map((o) => o.optionId);
    }
    return defaultPick(state);
  };
}
const endTurns = [
  { type: "endTurn", playerId: P1 },
  { type: "endTurn", playerId: P2 },
] as const;
const shipDamageTo = (events: readonly GameEvent[], state: GameState): number =>
  events
    .filter(
      (e): e is Extract<GameEvent, { type: "damageDealt" }> =>
        e.type === "damageDealt" && e.targetInstanceId === mustPlayer(state, P2).identity.instanceId,
    )
    .filter((e) => state.instances[e.sourceInstanceId ?? ""]?.cardId === SHIP.id)
    .reduce((sum, e) => sum + e.amount, 0);

describe("§3.38 'assign N indirect damage among players' (Museum Ship)", () => {
  it("the first player chooses, then divides the group's damage among every friendly character, any player's", () => {
    const { state, milano } = start();
    const seen: PendingChoice[] = [];
    const { session, events } = driveSession(startSession(state), deps, endTurns, picking("0", seen));
    const [option, assign] = seen;
    expect(option?.playerId).toBe(state.firstPlayerId);
    expect(assign?.playerId).toBe(state.firstPlayerId);
    // Both players' identities are among the characters the group may choose.
    for (const player of [P1, P2]) {
      const identity = mustPlayer(state, player).identity.instanceId;
      expect(assign?.options.some((o) => o.optionId.startsWith(`${identity}#`))).toBe(true);
    }
    expect(mustInstance(session.state, milano).exhausted).toBe(true);
    expect(shipDamageTo(events, session.state)).toBe(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the other option assigns 3[per_hero] and leaves the Milano ready", () => {
    const { state, milano } = start();
    const seen: PendingChoice[] = [];
    const { session, events } = driveSession(startSession(state), deps, endTurns, picking("1", seen));
    expect(mustInstance(session.state, milano).exhausted).toBe(false);
    expect(shipDamageTo(events, session.state)).toBe(6);
  });
});
