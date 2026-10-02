/**
 * Log lines for wave 6's new events (docs/phase7-wave6.md): healBlocked, damageCapped, boostWithheld,
 * activationBlocked, consequentialDamageModified, mainSchemeStagesShuffled (never reveals its order),
 * mainSchemeStageToVictoryDisplay, and attackResolved.damageTo / schemeResolved.removesThreat.
 */

import { activeVillain } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { eventRefs } from "./card-history.js";
import { logLine } from "./log-lines.js";
import { cardName } from "./names.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
}, 30_000);

const text = (event: GameEvent): string => {
  const beat = logLine(event, state, me, POOL_DEPS);
  expect(beat).not.toBeNull();
  return beat!.text;
};

describe("wave 6 log lines", () => {
  const villain = (): ReturnType<typeof activeVillain>["instanceId"] => activeVillain(state).instanceId;

  test("healBlocked names the target and, when known, the healing card", () => {
    const target = villain();
    const source = state.mainScheme.instanceId;
    expect(text({ type: "healBlocked", targetInstanceId: target, sourceInstanceId: null, amount: 2 })).toBe(
      `${cardName(state, target)} can't be healed.`,
    );
    expect(text({ type: "healBlocked", targetInstanceId: target, sourceInstanceId: source, amount: 2 })).toContain(
      `by ${cardName(state, source)}`,
    );
  });

  test("damageCapped says how much was not taken", () => {
    expect(text({ type: "damageCapped", targetInstanceId: villain(), amount: 3 })).toContain("3 not taken");
  });

  test("damageDoubled says what the damage became (§3.68)", () => {
    const line = text({ type: "damageDoubled", targetInstanceId: villain(), from: 3, to: 6, doubledBy: [villain()] });
    expect(line).toContain("3 becomes 6");
  });

  test("boostWithheld names the enemy and the activation", () => {
    const line = text({ type: "boostWithheld", enemyInstanceId: villain(), activation: "scheme" });
    expect(line).toContain(cardName(state, villain()));
    expect(line).toContain("scheme");
  });

  test("activationBlocked says the enemy can't attack or scheme", () => {
    expect(
      text({ type: "activationBlocked", enemyInstanceId: villain(), activation: "attack", playerId: me }),
    ).toContain("can't attack");
    expect(
      text({ type: "activationBlocked", enemyInstanceId: villain(), activation: "scheme", playerId: me }),
    ).toContain("can't scheme");
  });

  test("consequentialDamageModified gives both amounts", () => {
    const line = text({ type: "consequentialDamageModified", instanceId: villain(), from: 2, to: 0 });
    expect(line).toContain("from 2 to 0");
  });

  test("mainSchemeStagesShuffled never reveals the order", () => {
    const line = text({
      type: "mainSchemeStagesShuffled",
      schemeInstanceId: state.mainScheme.instanceId,
      order: [2, 0, 1],
    });
    expect(line).toBe("The main scheme stages are shuffled.");
    expect(line).not.toMatch(/[0-9]/);
  });

  test("mainSchemeStageToVictoryDisplay names the scheme and 1-based stage, and the history ties it to the scheme", () => {
    const event: GameEvent = {
      type: "mainSchemeStageToVictoryDisplay",
      schemeInstanceId: state.mainScheme.instanceId,
      stageIndex: 1,
      instanceId: villain(),
    };
    expect(text(event)).toContain("stage 2");
    expect(eventRefs(event)).toEqual([state.mainScheme.instanceId]);
  });

  test("attackResolved with damageTo says who took it instead", () => {
    const attacker = villain();
    const redirect = state.mainScheme.instanceId;
    const line = text({
      type: "attackResolved",
      enemyInstanceId: attacker,
      targetInstanceId: attacker,
      baseAtk: 3,
      boostIcons: 0,
      defenseReduction: 0,
      damageDealt: 3,
      damageTo: redirect,
    });
    expect(line).toContain(`hit ${cardName(state, redirect)} for 3 instead of`);
  });

  test("schemeResolved with removesThreat says threat was removed, not placed", () => {
    const line = text({
      type: "schemeResolved",
      enemyInstanceId: villain(),
      schemeInstanceId: state.mainScheme.instanceId,
      baseSch: 2,
      boostIcons: 1,
      threatBonus: 0,
      threatPlaced: 0,
      removesThreat: true,
    });
    expect(line).toContain("removed 3 threat");
  });
});
