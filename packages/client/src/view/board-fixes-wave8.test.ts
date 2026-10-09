/**
 * Board and log fixes from the wave 8 full QA (docs/phase7-wave8-full-qa.md, Pieces 13 and 14): the setup log's status
 * word and its reveal-versus-deal line, "did not defend" naming the seat, the `attackResumed` line, who a minion is
 * engaged with, identical trigger options told apart, and a main scheme's Setup panel showing its A side.
 */

import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { abilityFaceOf, boardModel, engagedNameOf } from "./board-model.js";
import { appendEvents, emptyLog, logLine, plainLogLine, type LogLine } from "./log-lines.js";
import { triggerOrdinal } from "./trigger-caption.js";

async function started(config: SessionConfig): Promise<{ store: SessionStore; events: readonly GameEvent[] }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(config);
  return { store, events: store.state.lastEvents };
}

const HORSEMEN: SessionConfig = {
  scenarioId: "four-horsemen",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 3,
};

describe("setup log", () => {
  test("a reveal during setup is not logged as a deal, and the reveal's own line is", async () => {
    const { store, events } = await started(HORSEMEN);
    const game = store.state.game!;
    const me = store.state.perspectiveId!;
    const log = appendEvents(emptyLog(), events, game, me, POOL_DEPS);
    const texts = log.lines.map((line) => line.text);
    expect(texts.some((text) => /dealt a facedown encounter card/.test(text))).toBe(false);
    expect(texts.some((text) => /revealed/.test(text))).toBe(true);
  });

  test("a real deal (villain phase step 3) still reads as one", async () => {
    const { store } = await started(HORSEMEN);
    const game = store.state.game!;
    const me = store.state.perspectiveId!;
    const moved = {
      type: "cardMoved",
      instanceId: game.players[0]!.hand[0]!,
      cardId: "x",
      from: { kind: "encounterDeck", deckId: "e1" },
      to: { kind: "dealtEncounter", playerId: me },
    } as unknown as GameEvent;
    const burst = { events: [moved, { type: "stepChanged" } as unknown as GameEvent], at: 0 };
    expect(logLine(moved, game, me, POOL_DEPS, false, undefined, burst)?.text).toBe(
      "You are dealt a facedown encounter card.",
    );
  });

  test("plainLogLine says the status a chip would have drawn", () => {
    const line: LogLine = {
      id: "a",
      ref: "R1.1",
      round: 1,
      text: "Unus is",
      tags: [{ status: "stunned", spent: false }],
      voice: "player",
    };
    expect(plainLogLine(line)).toMatchObject({ text: "Unus is stunned.", tags: [] });
    expect(plainLogLine({ ...line, text: "Unus took 0 damage.", tags: [{ status: "tough", spent: true }] }).text).toBe(
      "Unus took 0 damage.",
    );
  });
});

describe("log lines", () => {
  test("attackResumed reads as the attack taking its target and amount", async () => {
    const { store } = await started(HORSEMEN);
    const game = store.state.game!;
    const [attacker, target] = Object.keys(game.instances) as InstanceId[];
    const event = {
      type: "attackResumed",
      attackFrameId: "f1",
      abilityFrameId: "f2",
      attackerInstanceId: attacker,
      targetInstanceId: target,
      amount: 3,
      overkill: false,
      keywords: ["piercing"],
    } as unknown as GameEvent;
    expect(logLine(event, game, null, POOL_DEPS)?.text).toMatch(/ attacks .* for 3 \(piercing\)\.$/);
  });

  test("did not defend names the seat once there are two, and 'You' when solo", async () => {
    const solo = await started(HORSEMEN);
    const g1 = solo.store.state.game!;
    const p1 = g1.players[0]!.playerId;
    const event = { type: "defenseDeclined", attackInstanceId: "i1", playerId: p1 } as unknown as GameEvent;
    expect(logLine(event, g1, p1, POOL_DEPS)?.text).toBe("You did not defend.");

    const two = await started({
      ...HORSEMEN,
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    });
    const g2 = two.store.state.game!;
    const second = g2.players[1]!.playerId;
    const text = logLine({ ...event, playerId: second } as GameEvent, g2, g2.players[0]!.playerId, POOL_DEPS)?.text;
    expect(text).toMatch(/did not defend\.$/);
    expect(text).not.toMatch(/^You/);
  });
});

describe("engagedNameOf", () => {
  test("null in a solo game, the hero's name with two seats, ", async () => {
    const solo = (await started(HORSEMEN)).store.state.game as GameState;
    expect(engagedNameOf(solo, solo.players[0]!.playerId)).toBeNull();

    const two = (
      await started({
        ...HORSEMEN,
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      })
    ).store.state.game as GameState;
    expect(engagedNameOf(two, two.players[1]!.playerId)).toBe("She-Hulk");
    expect(engagedNameOf(two, null)).toBeNull();
  });
});

describe("triggerOrdinal", () => {
  const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
  test("numbers identical options and leaves a lone one alone", () => {
    const options = [
      { optionId: "a@0", ref: { id: 1 } },
      { optionId: "a@1", ref: { id: 1 } },
      { optionId: "b", ref: { id: 2 } },
    ];
    expect(triggerOrdinal(options, "a@1", same)).toBe(" 2 of 2");
    expect(triggerOrdinal(options, "b", same)).toBe("");
  });
});

describe("abilityFaceOf for a main scheme's Setup", () => {
  test("a main scheme's A-side ability is shown on its A side", async () => {
    const { store } = await started({
      scenarioId: "en-sabah-nur",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 3,
    });
    const game = store.state.game!;
    const scheme = game.mainScheme.instanceId;
    const face = abilityFaceOf(game, scheme, "45147a.setup" as never);
    expect(face).toMatchObject({ kind: "mainSchemeStage", side: "A" });
    expect(abilityFaceOf(game, scheme, null)).not.toMatchObject({ side: "A" });
  });
});

void (null as unknown as PlayerId);

describe("facedown encounter cards dealt to the players", () => {
  test("the board counts them, as a number and never a card, and counts none when none are out", async () => {
    const { store } = await started(HORSEMEN);
    const game = store.state.game!;
    const me = store.state.perspectiveId!;
    expect(boardModel(game, me, POOL_DEPS).dealtFacedown).toBe(0);
    const dealt = {
      ...game,
      players: game.players.map((player, index) =>
        index === 0 ? { ...player, dealtEncounter: [game.mainScheme.instanceId] } : player,
      ),
    };
    expect(boardModel(dealt, me, POOL_DEPS).dealtFacedown).toBe(1);
  });
});
