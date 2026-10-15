/** Multi-villain QA: main scheme names, a mid-sentence "You", status words where there are no chips. */
import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { beatTextWithStatus, logLine, lowerMidSentenceYou } from "./log-lines.js";
import { cardName } from "./names.js";

let state: GameState;
let me: PlayerId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 3,
  });
  state = store.state.game!;
  me = store.state.perspectiveId!;
}, 30_000);

describe("main scheme names", () => {
  test("a main scheme is named for the stage it is at, not the card's stage-1 name", () => {
    const id = state.mainScheme.instanceId;
    const card = state.cardPool[state.mainScheme.cardId]!;
    if (card.type !== "main_scheme") throw new Error("not a main scheme");
    const second = card.stages[1];
    const stages = card.stages.map((stage, index) => (index === 1 ? { ...stage, name: "Stage Two Title" } : stage));
    const game: GameState = {
      ...state,
      cardPool: { ...state.cardPool, [card.id]: { ...card, stages: [stages[0]!, ...stages.slice(1)] } },
      mainScheme: { ...state.mainScheme, stageIndex: 1 },
    };
    if (!second) throw new Error("fixture needs a second stage");
    expect(cardName(game, id)).toBe("Stage Two Title");
    expect(
      logLine({ type: "threatPlaced", schemeInstanceId: id, amount: 2 } as never, game, me, POOL_DEPS)?.text,
    ).toContain("Stage Two Title");
  });
});

describe("a capital You", () => {
  test("is lowercased mid-sentence and kept at a sentence start", () => {
    expect(lowerMidSentenceYou("Wrecker schemes against You.")).toBe("Wrecker schemes against you.");
    expect(lowerMidSentenceYou("You draw a card. Then You discard.")).toBe("You draw a card. Then you discard.");
    expect(lowerMidSentenceYou("Boost: You take 2.")).toBe("Boost: You take 2.");
  });

  test("an enemy activation against the viewer reads lowercase", () => {
    const enemy = state.activeVillainId;
    const line = logLine(
      { type: "enemyActivated", enemyInstanceId: enemy, activation: "scheme", playerId: me } as never,
      state,
      me,
      POOL_DEPS,
    );
    expect(line?.text).toMatch(/schemes against you\.$/);
  });
});

describe("status words", () => {
  test("a status line without chips ends in its status word", () => {
    const line = logLine(
      { type: "statusGiven", instanceId: state.activeVillainId, status: "stunned" } as never,
      state,
      me,
      POOL_DEPS,
    )!;
    expect(line.text.endsWith(" is")).toBe(true);
    expect(beatTextWithStatus(line)).toMatch(/ is stunned\.$/);
  });
});
