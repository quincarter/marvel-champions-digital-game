/** The play area's drawn order (#768): the sort on its own, then the board model with the setting on a real game. */

import { describe, expect, test } from "vitest";
import { cardOf, type GameState, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel } from "./board-model.js";
import { sortPlayArea, type PlayAreaSortKey } from "./play-area-order.js";

const card = (id: string, type: string | undefined, cost: number | null, name: string) => ({
  id,
  key: { type, cost, name } satisfies PlayAreaSortKey,
});
const SAMPLE = [
  card("a", "upgrade", 1, "Zeta"),
  card("b", "ally", 3, "alpha"),
  card("c", "support", null, "Mid"),
  card("d", "ally", 1, "Beta"),
  card("e", "resource", 0, "Other"),
  card("f", "support", 1, "Gamma"),
];
const ids = (order: Parameters<typeof sortPlayArea>[1]): string =>
  sortPlayArea(SAMPLE, order, (item) => item.key)
    .map((item) => item.id)
    .join("");

describe("sortPlayArea", () => {
  test("as played returns the list as given", () => {
    expect(ids("played")).toBe("abcdef");
  });

  test("by type: allies, supports, upgrades, then every other type, each group as played", () => {
    expect(ids("type")).toBe("bdcfae");
  });

  test("by cost: cheapest first, a card with no cost last, ties as played", () => {
    // cost 0 (e), cost 1 (a, d, f in play order), cost 3 (b), none (c)
    expect(ids("cost")).toBe("eadfbc");
  });

  test("by name: the name shown, case and accents ignored, ties as played", () => {
    expect(ids("name")).toBe("bdfcea");
  });

  test("never changes the list it is given", () => {
    const before = SAMPLE.map((item) => item.id).join("");
    ids("name");
    expect(SAMPLE.map((item) => item.id).join("")).toBe(before);
  });

  test("equal names keep the order they entered play", () => {
    const twins = [card("1", "ally", 1, "Twin"), card("2", "ally", 1, "twin"), card("3", "ally", 1, "Twin")];
    expect(sortPlayArea(twins, "name", (item) => item.key).map((item) => item.id)).toEqual(["1", "2", "3"]);
  });
});

async function gameWithCardsInPlay(): Promise<{ state: GameState; played: readonly InstanceId[] }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  const game = store.state.game!;
  const player = game.players[0]!;
  // Put every ally, support and upgrade the hero owns into play, in a deliberately jumbled order.
  const played = [...player.hand, ...player.deck]
    .filter((id) => ["ally", "support", "upgrade"].includes(cardOf(game, id)?.type ?? ""))
    .reverse();
  const state: GameState = {
    ...game,
    players: game.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            hand: p.hand.filter((id) => !played.includes(id)),
            deck: p.deck.filter((id) => !played.includes(id)),
            playArea: [...p.playArea, ...played],
          }
        : p,
    ),
  };
  return { state, played };
}

describe("boardModel play area order (#768)", () => {
  const drawn = (state: GameState, order: Parameters<typeof boardModel>[4]): string[] =>
    boardModel(state, state.players[0]!.playerId, POOL_DEPS, null, order).myPlayArea.map((panel) => panel.instanceId);

  test("as played is the default and follows the engine's list", async () => {
    const { state, played } = await gameWithCardsInPlay();
    expect(played.length).toBeGreaterThan(3);
    expect(boardModel(state, state.players[0]!.playerId, POOL_DEPS).myPlayArea.map((p) => p.instanceId)).toEqual(
      drawn(state, "played"),
    );
    expect(drawn(state, "played")).toEqual(played.filter((id) => drawn(state, "played").includes(id)));
  });

  test("by type groups allies, supports, upgrades; by cost and by name sort; the engine's order is untouched", async () => {
    const { state } = await gameWithCardsInPlay();
    const before = [...state.players[0]!.playArea];
    const typeOf = (id: string): string => cardOf(state, id as InstanceId)?.type ?? "";
    const costOf = (id: string): number => {
      const c = cardOf(state, id as InstanceId);
      return c && "cost" in c && typeof c.cost === "number" ? c.cost : Number.POSITIVE_INFINITY;
    };

    const byType = drawn(state, "type").map(typeOf);
    expect(
      [...byType].sort((a, b) => ["ally", "support", "upgrade"].indexOf(a) - ["ally", "support", "upgrade"].indexOf(b)),
    ).toEqual(byType);
    const byCost = drawn(state, "cost").map(costOf);
    expect([...byCost].sort((a, b) => a - b)).toEqual(byCost);
    const names = boardModel(state, state.players[0]!.playerId, POOL_DEPS, null, "name").myPlayArea.map((p) => p.name);
    expect([...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))).toEqual(
      names,
    );
    // Same cards in every order.
    expect([...drawn(state, "cost")].sort()).toEqual([...drawn(state, "played")].sort());
    expect(state.players[0]!.playArea).toEqual(before);
  });
});
