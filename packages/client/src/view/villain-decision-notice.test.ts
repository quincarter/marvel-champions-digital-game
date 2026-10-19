import { describe, expect, test } from "vitest";
import type { ChoiceId, GameState, PendingChoice, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { choosesActiveVillain } from "./choice-source.js";
import { decisionNoticeOf, soleAnswerOf } from "./villain-decision-notice.js";

/** Plays turns (answering every other decision with its minimum) until `want` finds a pending choice. */
async function playUntil(
  scenarioId: string,
  want: (choice: PendingChoice, game: GameState) => boolean,
  rounds = 8,
): Promise<{ readonly game: GameState; readonly choice: PendingChoice } | null> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId,
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 7,
  });
  for (let i = 0; i < rounds * 12; i++) {
    const game = store.state.game!;
    const legal = store.state.legal;
    if (!legal || game.outcome) return null;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      if (want(choice, game)) return { game, choice };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) return null;
      await store.dispatch(end.example);
    } else return null;
  }
  return null;
}

// The random modular sets decide which other first-player picks come up first (Wrecking Crew's Dead Meat, say), so the
// pick wanted is the one a card asks for the active villain, not any first-player target pick.
const pickingVillain = (choice: PendingChoice, game: GameState): boolean =>
  choice.prompt.kind === "chooseTarget" &&
  choice.authority === "firstPlayerTargets" &&
  choosesActiveVillain(game, choice, POOL_DEPS);

describe("the decision notice", () => {
  test("a Breakout pick says it chooses the new active villain and lists the candidates", async () => {
    const found = await playUntil("breakout", pickingVillain);
    expect(found).not.toBeNull();
    const { game, choice } = found!;
    expect(choosesActiveVillain(game, choice, POOL_DEPS)).toBe(true);
    const notice = decisionNoticeOf(game, choice, choice.playerId, POOL_DEPS);
    expect(notice).toContain("As first player, you pick the target");
    expect(notice).toMatch(/choose the new active villain/i);
    for (const option of choice.options) expect(notice).toContain(option.label);
  }, 60_000);

  test("a pick with one candidate is answered with it; one with several is not", async () => {
    const one = await playUntil("breakout", (c, g) => pickingVillain(c, g) && c.options.length === 1);
    if (one) expect(soleAnswerOf(one.game, one.choice, POOL_DEPS)).toBe(one.choice.options[0]!.optionId);
    const many = await playUntil("breakout", (c, g) => pickingVillain(c, g) && c.options.length > 1);
    expect(many).not.toBeNull();
    expect(soleAnswerOf(many!.game, many!.choice, POOL_DEPS)).toBeNull();
  }, 90_000);

  test("only the active-villain pick answers itself: any other one-candidate pick is left to the players", async () => {
    const found = await playUntil("breakout", pickingVillain);
    expect(found).not.toBeNull();
    const { game, choice } = found!;
    const lone = { ...choice, options: [choice.options[0]!], authority: "firstPlayerTargets" } as PendingChoice;
    expect(soleAnswerOf(game, lone, POOL_DEPS)).toBe(choice.options[0]!.optionId);
    expect(soleAnswerOf(game, { ...lone, authority: "player" }, POOL_DEPS)).toBeNull();
    expect(soleAnswerOf(game, { ...lone, minSelections: 0 }, POOL_DEPS)).toBeNull();
    // A pick no card asks for the active villain (Zemo's counters on the one bare environment) is not answered.
    const other = { ...lone, prompt: { ...lone.prompt, slot: "not-the-villain-slot" } } as PendingChoice;
    expect(soleAnswerOf(game, other, POOL_DEPS)).toBeNull();
  }, 60_000);
});

describe("the notice for an ordering", () => {
  test("lists the things to order as bullets, not as an order already chosen", async () => {
    const found = await playUntil("breakout", () => true);
    expect(found).not.toBeNull();
    const choice = {
      choiceId: "c1" as ChoiceId,
      playerId: "p1",
      prompt: { kind: "orderTriggers", event: { kind: "x" }, timing: "interrupt" },
      minSelections: 2,
      maxSelections: 2,
      options: [
        { optionId: "a", label: "Piledriver", ref: { kind: "card", instanceId: "i1" } },
        { optionId: "b", label: "Bulldozer", ref: { kind: "card", instanceId: "i2" } },
      ],
      frameId: null,
      ordered: true,
      soleDecider: false,
      authority: "firstPlayerOrders",
    } as unknown as PendingChoice;
    const lines = decisionNoticeOf(found!.game, choice, "p1" as PlayerId, POOL_DEPS).split("\n");
    expect(lines[0]).toBe("As first player, you order these effects");
    expect(lines.slice(-2)).toEqual(["• Piledriver", "• Bulldozer"]);
  });
});
