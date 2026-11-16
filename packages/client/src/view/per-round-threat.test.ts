/** "+N per round" on a main scheme (issue #765): the engine's step-one threat, and sources that add up to it. */

import { describe, expect, test } from "vitest";
import { stepOneThreatOf, type GameState, type InstanceId } from "@mc/engine";
import { cardId } from "@mc/content";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { perRoundHoverLine, perRoundLabel, perRoundThreatOf } from "./per-round-threat.js";

async function rhinoGame(): Promise<{ state: GameState; store: SessionStore }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  return { state: store.state.game!, store };
}

const sumOf = (sources: readonly string[]): number =>
  sources.reduce((total, line) => total + Number(/\+(\d+)$/.exec(line)?.[1] ?? 0), 0);

describe("perRoundThreatOf (#765)", () => {
  test("matches the engine's step one, and its sources add up to the total", async () => {
    const { state } = await rhinoGame();
    const id = state.mainScheme.instanceId;
    const perRound = perRoundThreatOf(state, POOL_DEPS, id)!;
    expect(perRound.total).toBe(stepOneThreatOf(state, POOL_DEPS, id)!.total);
    expect(perRound.total).toBeGreaterThan(0);
    expect(sumOf(perRound.sources)).toBe(perRound.total);
  });

  test("counts acceleration tokens, and the main scheme's subtitle says it", async () => {
    const { state, store } = await rhinoGame();
    const id = state.mainScheme.instanceId;
    const before = perRoundThreatOf(state, POOL_DEPS, id)!.total;
    const withTokens: GameState = { ...state, mainScheme: { ...state.mainScheme, accelerationTokens: 2 } };
    const perRound = perRoundThreatOf(withTokens, POOL_DEPS, id)!;
    expect(perRound.total).toBe(before + 2);
    expect(perRound.sources).toContain("2 acceleration tokens +2");
    expect(perRoundHoverLine(perRound).startsWith(`+${before + 2} per round: `)).toBe(true);
    const model = boardModel(withTokens, store.state.perspectiveId!, POOL_DEPS);
    expect(model.mainScheme.subtitle).toContain(`+${before + 2} per round`);
  });

  test("a side scheme gains none", async () => {
    const { state } = await rhinoGame();
    const villain = state.villains[0]!.instanceId;
    expect(perRoundThreatOf(state, POOL_DEPS, villain)).toBeNull();
  });

  test("with separate game areas, names only the icon cards in this scheme's own area", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "kang",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 3,
    });
    const game = store.state.game!;
    const central = game.instances[game.mainScheme.instanceId]!;
    const pool = Object.fromEntries(
      POOL_CARDS.filter((card) => card.id === cardId("01109") || card.id === cardId("01127")).map((c) => [c.id, c]),
    );
    const id = (name: string) => name as InstanceId;
    const instance = (name: string, code: string) => ({
      ...central,
      instanceId: id(name),
      cardId: cardId(code),
      threat: 3,
      attachments: [],
    });
    const area = (
      areaId: string,
      scheme: string,
      sideScheme: string,
      playerIds: GameState["players"][number]["playerId"][],
    ) => ({
      areaId: areaId as GameState["gameAreas"][number]["areaId"],
      playerIds,
      mainScheme: { ...game.mainScheme, instanceId: id(scheme) },
      villainIds: [],
      activeVillainId: null,
      sideSchemeIds: [id(sideScheme)],
      formerSchemeIds: [],
    });
    const state: GameState = {
      ...game,
      cardPool: { ...game.cardPool, ...pool },
      villainArea: [...game.villainArea, id("bomb-scare"), id("immortal-klaw")],
      instances: {
        ...game.instances,
        [id("scheme-a")]: { ...central, instanceId: id("scheme-a") },
        [id("scheme-b")]: { ...central, instanceId: id("scheme-b") },
        // Bomb Scare (01109) in area A, The "Immortal" Klaw (01127) in area B: one acceleration icon each.
        [id("bomb-scare")]: instance("bomb-scare", "01109"),
        [id("immortal-klaw")]: instance("immortal-klaw", "01127"),
      },
      gameAreas: [
        area(
          "a",
          "scheme-a",
          "bomb-scare",
          game.players.map((p) => p.playerId),
        ),
        area("b", "scheme-b", "immortal-klaw", []),
      ],
    };
    const inA = perRoundThreatOf(state, POOL_DEPS, id("scheme-a"))!;
    const inB = perRoundThreatOf(state, POOL_DEPS, id("scheme-b"))!;
    expect(inA.sources).toContain("Bomb Scare +1");
    expect(inA.sources.join(" ")).not.toContain("Klaw");
    expect(inB.sources).toContain('The "Immortal" Klaw +1');
    expect(inB.sources.join(" ")).not.toContain("Bomb Scare");
  });

  test('a negative total reads with a minus sign, never "+-1"', () => {
    expect(perRoundLabel({ total: -1, sources: ["Stage −2", "1 acceleration token +1"] })).toBe("−1 per round");
    expect(perRoundLabel({ total: 0, sources: [] })).toBe("+0 per round");
    expect(perRoundHoverLine({ total: -1, sources: ["Stage −2"] })).toBe("−1 per round: Stage −2");
  });
});
