import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { logLine } from "./log-lines.js";
import { adjustTargetOf, adjustUnavailableReason, manualAdjustModel } from "./manual-adjust-model.js";
import { adjustedSuffixOf, pauseStatusOf } from "./pause-model.js";

let store: SessionStore;
let game: GameState;
let seat: PlayerId;

beforeAll(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "klaw",
    difficulty: "standard",
    players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
    seed: 5,
  });
  // Past setup's choices (mulligans), to the first player turn.
  for (let i = 0; i < 20 && store.state.game!.pendingChoice; i++) {
    const choice = store.state.game!.pendingChoice;
    await store.dispatch({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: [choice.options[0]!.optionId],
    });
  }
  game = store.state.game!;
  seat = store.state.perspectiveId!;
}, 30_000);

describe("manualAdjustModel", () => {
  test("groups the table, with the acting seat's hero first", () => {
    const model = manualAdjustModel(game, seat);
    expect(model.unavailable).toBeNull();
    const ids = model.groups.map((group) => group.id);
    expect(ids[0]).toBe("heroes");
    expect(ids).toContain("villain");
    expect(ids).toContain("mainScheme");
    expect(ids.some((id) => id.startsWith("hand:"))).toBe(true);
    const heroes = model.groups[0]!;
    expect(heroes.targets).toHaveLength(2);
    expect(heroes.targets[0]!.instanceId).toBe(game.players.find((p) => p.playerId === seat)!.identity.instanceId);
    expect(heroes.targets[0]!.name).toContain("(you)");
  });

  test("a hero offers damage, statuses, exhaust, draw and change form, all issued as the acting seat", () => {
    const hero = manualAdjustModel(game, seat).groups[0]!.targets[0]!;
    const kinds = hero.choices.map((c) => (c.command.type === "adjust" ? c.command.adjustment.kind : "?"));
    expect(kinds).toEqual(expect.arrayContaining(["damage", "status", "draw", "changeForm"]));
    expect(hero.choices.every((c) => c.command.type === "adjust" && c.command.playerId === seat)).toBe(true);
    // Nothing to heal yet, so no "-1 damage".
    expect(hero.choices.map((c) => c.label)).not.toContain("-1 damage");
  });

  test("the villain offers damage but no discard, the main scheme threat but no discard", () => {
    const model = manualAdjustModel(game, seat);
    const villain = model.groups.find((g) => g.id === "villain")!.targets[0]!;
    const scheme = model.groups.find((g) => g.id === "mainScheme")!.targets[0]!;
    expect(villain.choices.map((c) => c.label)).toContain("+1 damage");
    expect(villain.choices.map((c) => c.label)).not.toContain("Discard from play");
    expect(scheme.choices.map((c) => c.label)).toContain("+1 threat");
    expect(scheme.choices.map((c) => c.label)).not.toContain("Discard from play");
  });

  test("a card in hand offers only its discard", () => {
    const hand = manualAdjustModel(game, seat).groups.find((g) => g.id === `hand:${seat}`)!;
    expect(hand.targets.length).toBeGreaterThan(0);
    expect(hand.targets[0]!.choices.map((c) => c.label)).toEqual(["Discard from hand"]);
  });

  test("the engine takes what a pick sends, and the model then shows it", async () => {
    const villain = manualAdjustModel(game, seat).groups.find((g) => g.id === "villain")!.targets[0]!;
    const plus = villain.choices.find((c) => c.label === "+1 damage")!;
    expect(await store.dispatch(plus.command)).toBe(true);
    expect(store.state.adjusted).toBe(true);
    const after = manualAdjustModel(store.state.game!, seat);
    const again = adjustTargetOf(after, villain.id)!;
    expect(again.detail).toContain("1 damage");
    expect(again.choices.map((c) => c.label)).toContain("-1 damage");
  });

  test("it says why nothing can be adjusted over an open choice or a finished game", () => {
    expect(adjustUnavailableReason({ ...game, pendingChoice: {} as never }, seat)).toBe(
      "Finish the open choice first.",
    );
    expect(adjustUnavailableReason({ ...game, outcome: { result: "conceded" } as never }, seat)).toBe(
      "The game is over.",
    );
    expect(manualAdjustModel({ ...game, pendingChoice: {} as never }, seat).groups).toEqual([]);
  });
});

describe("the game log and the Pause status", () => {
  test("a manual adjustment reads as one", () => {
    const villain = manualAdjustModel(game, seat).groups.find((g) => g.id === "villain")!.targets[0]!;
    const text = logLine(
      {
        type: "manualAdjustment",
        playerId: seat,
        adjustment: { kind: "damage", instanceId: villain.instanceId, amount: 1 },
      },
      game,
      seat,
      POOL_DEPS,
    )?.text;
    expect(text).toBe(`Manual adjust: +1 damage on ${villain.name}.`);
    const draw = logLine(
      { type: "manualAdjustment", playerId: seat, adjustment: { kind: "draw", playerId: seat, count: 1 } },
      game,
      seat,
      POOL_DEPS,
    )?.text;
    expect(draw).toBe("Manual adjust: draw 1 card for you.");
  });

  test("an adjusted game says so on the Pause status line", () => {
    expect(adjustedSuffixOf(pauseStatusOf(game, seat, null, []))).toBe("");
    expect(adjustedSuffixOf(pauseStatusOf(game, seat, null, [], undefined, true))).toBe(
      " · Adjusted: not counted toward stats",
    );
  });
});
