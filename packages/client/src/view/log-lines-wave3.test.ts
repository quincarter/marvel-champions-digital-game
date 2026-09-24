/**
 * Log lines for wave 3's new events (docs/phase7-wave3.md §5's own list for `game-client-engineer`): surgeGranted,
 * villainFlipped.hitPointsReset, controllerChanged, playCostReduced, interruptsPreempted, discardRedirected (a
 * cardMoved to a scenario area), playerDeckReset, enemyAttackedEnemy, and the `threatRemovalBlocked` "patrol"
 * reason (§3.5).
 *
 * Synthetic events against a real, already-played Core game — `log-lines.test.ts`'s own pattern (`logLine` is
 * exported exactly so a new event shape can be pinned this way without reaching for the one scenario that actually
 * prints it).
 */

import { activeVillain } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let state: GameState;
let me: PlayerId;
let opponent: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-black-panther-protection" }],
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
  opponent = state.players.find((p) => p.playerId !== me)!.playerId;
}, 30_000);

describe("wave 3 log lines", () => {
  test("surgeGranted names the card that gained the keyword", () => {
    const villain = activeVillain(state).instanceId;
    const beat = logLine({ type: "surgeGranted", instanceId: villain, playerId: me }, state, me, POOL_DEPS);
    expect(beat).not.toBeNull();
    expect(beat!.text.toLowerCase()).toContain("surge");
  });

  test("villainFlipped says the dial reset, only when hitPointsReset is set", () => {
    const villain = activeVillain(state).instanceId;
    const reset = logLine(
      { type: "villainFlipped", instanceId: villain, from: "A", to: "B", hitPointsReset: true },
      state,
      me,
      POOL_DEPS,
    );
    const kept = logLine({ type: "villainFlipped", instanceId: villain, from: "A", to: "B" }, state, me, POOL_DEPS);
    expect(reset!.text).toContain("hit points reset");
    expect(kept!.text).not.toContain("hit points reset");
  });

  test("controllerChanged names the new controller", () => {
    const villain = activeVillain(state).instanceId;
    const beat = logLine(
      { type: "controllerChanged", instanceId: villain, from: null, to: opponent, reason: "firstPlayer" },
      state,
      me,
      POOL_DEPS,
    );
    expect(beat!.text.toLowerCase()).toContain("first player");
  });

  test("playCostReduced names both the reducing ability's card and the card it reduced", () => {
    const identity = state.players.find((p) => p.playerId === me)!.identity.instanceId;
    const villain = activeVillain(state).instanceId;
    const beat = logLine(
      {
        type: "playCostReduced",
        cardInstanceId: villain,
        instanceId: identity,
        abilityId: "17001a.what-could-go-wrong" as never,
        amount: 3,
      },
      state,
      me,
      POOL_DEPS,
    );
    expect(beat!.text).toContain("3");
  });

  test("interruptsPreempted names Toughness's own priority", () => {
    const beat = logLine(
      { type: "interruptsPreempted", event: { kind: "dealDamage" } as never, reason: "tough" },
      state,
      me,
      POOL_DEPS,
    );
    expect(beat!.text.toLowerCase()).toContain("toughness");
  });

  test("a cardMoved to a scenario area is not silent, unlike an ordinary move", () => {
    const villain = activeVillain(state).instanceId;
    const toScenarioArea = logLine(
      {
        type: "cardMoved",
        instanceId: villain,
        cardId: "16074" as never,
        from: { kind: "villainArea" } as never,
        to: { kind: "scenarioArea", name: "The Collection" },
      },
      state,
      me,
      POOL_DEPS,
    );
    const ordinary = logLine(
      {
        type: "cardMoved",
        instanceId: villain,
        cardId: "16074" as never,
        from: { kind: "villainArea" } as never,
        to: { kind: "discard", playerId: me } as never,
      },
      state,
      me,
      POOL_DEPS,
    );
    expect(toScenarioArea).not.toBeNull();
    expect(toScenarioArea!.text).toContain("The Collection");
    expect(ordinary).toBeNull();
  });

  test("playerDeckReset reads as your own deck vs. another seat's", () => {
    const mine = logLine({ type: "playerDeckReset", playerId: me }, state, me, POOL_DEPS);
    const theirs = logLine({ type: "playerDeckReset", playerId: opponent }, state, me, POOL_DEPS);
    expect(mine!.text.startsWith("Your deck")).toBe(true);
    expect(theirs!.text.startsWith("Your deck")).toBe(false);
    expect(theirs!.text).toContain("deck is shuffled");
  });

  test("enemyAttackedEnemy names both enemies, and says why when skipped", () => {
    const villain = activeVillain(state).instanceId;
    const hit = logLine(
      { type: "enemyAttackedEnemy", attackerInstanceId: villain, targetInstanceId: villain, damageDealt: 2 },
      state,
      me,
      POOL_DEPS,
    );
    const skipped = logLine(
      {
        type: "enemyAttackedEnemy",
        attackerInstanceId: villain,
        targetInstanceId: villain,
        damageDealt: 0,
        skipped: "leftPlay",
      },
      state,
      me,
      POOL_DEPS,
    );
    expect(hit!.text).toContain("2");
    expect(skipped!.text.toLowerCase()).toContain("left play");
  });

  test("threatRemovalBlocked names Patrol, not just 'a rule'", () => {
    const scheme = state.mainScheme.instanceId;
    const patrol = logLine(
      { type: "threatRemovalBlocked", schemeInstanceId: scheme, reason: "patrol" },
      state,
      me,
      POOL_DEPS,
    );
    const crisis = logLine(
      { type: "threatRemovalBlocked", schemeInstanceId: scheme, reason: "crisis" },
      state,
      me,
      POOL_DEPS,
    );
    expect(patrol!.text).toContain("Patrol");
    expect(crisis!.text).toContain("Crisis");
  });
});
