import { describe, expect, test } from "vitest";
import { CORE_CARDS } from "@mc/content";
import { CORE_DEPS, coreScenario } from "@mc/cards";
import { activeVillain, applyCommand, cardOf, createGame, playerId, type GameState } from "@mc/engine";
import {
  advanceSetupWalkthroughLog,
  emptySetupWalkthroughLog,
  setupWalkthroughViewOf,
  staticSetupLines,
  type SetupWalkthroughLog,
} from "./setup-walkthrough.js";

const CARDS_BY_ID = new Map(CORE_CARDS.map((card) => [card.id as string, card]));

/** The active villain's card re-printed as a leader (the pool has no Civil War data yet). */
function asLeader(game: GameState): GameState {
  const card = cardOf(game, activeVillain(game).instanceId)!;
  return {
    ...game,
    cardPool: { ...game.cardPool, [card.id]: { ...card, printedType: "leader" } },
  } as unknown as GameState;
}

function fourSeatGame(): { state: GameState; log: SetupWalkthroughLog } {
  const config = coreScenario("rhino", {
    players: [
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-she-hulk-aggression" },
      { starterDeckId: "core-iron-man-aggression" },
      { starterDeckId: "core-black-panther-protection" },
    ],
    seed: 2026,
  });
  const result = createGame(config, CORE_DEPS);
  if (!result.ok) throw new Error(result.error.message);
  const log = advanceSetupWalkthroughLog(
    emptySetupWalkthroughLog(),
    result.events,
    result.state,
    result.state.pendingChoice?.playerId ?? null,
    CORE_DEPS,
  );
  return { state: result.state, log };
}

describe("setupWalkthroughViewOf: right after Deal it out (Rhino, 4 seats)", () => {
  const { state, log } = fourSeatGame();

  test("the placed chip says Villain, and Leader for a leader", () => {
    const label = (game: GameState) =>
      setupWalkthroughViewOf(game, log, CORE_DEPS, CARDS_BY_ID).checklist.find((item) => item.key === "placed")?.label;
    expect(label(state)).toBe("Villain & main scheme placed");
    expect(label(asLeader(state))).toBe("Leader & main scheme placed");
  });

  test("stops at the first seat's mulligan, not further", () => {
    expect(state.step).toEqual({
      phase: "setup",
      kind: "mulligan",
      remainingPlayerIds: [playerId("p1"), playerId("p2"), playerId("p3"), playerId("p4")],
    });
  });

  test("checklist: placed and starting threat are already done; mulligan is current; first player token is still ahead", () => {
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    const byKey = new Map(view.checklist.map((item) => [item.key, item]));
    expect(byKey.get("placed")?.state).toBe("done");
    expect(byKey.get("threat")?.state).toBe("done");
    expect(byKey.get("mulligan")?.state).toBe("current");
    expect(byKey.get("firstPlayer")?.state).toBe("pending");
  });

  test("a seat whose hand is not this device's to read has no faces, only its size (#887)", () => {
    const shown = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    expect(shown.seats.every((seat) => !seat.handHidden && seat.hand.length === seat.handSize)).toBe(true);
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID, (id) => id === playerId("p2"));
    for (const seat of view.seats) {
      const mine = seat.playerId === playerId("p2");
      expect(seat.handHidden).toBe(!mine);
      expect(seat.hand.length > 0).toBe(mine);
      expect(seat.handSize).toBe(shown.seats.find((s) => s.playerId === seat.playerId)!.handSize);
    }
  });

  test("all four seats are listed, in the engine's own order, none complete yet", () => {
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    expect(view.seats.map((seat) => seat.playerId)).toEqual([
      playerId("p1"),
      playerId("p2"),
      playerId("p3"),
      playerId("p4"),
    ]);
    expect(view.seats[0]!.state).toBe("deciding");
    expect(view.seats[0]!.statusLabel).toBe("Deciding");
    for (const seat of view.seats.slice(1)) {
      expect(seat.state).toBe("waiting");
      expect(seat.statusLabel).toBe("Still deciding");
      expect(seat.mulliganedCount).toBeNull();
    }
  });

  test("every seat's hand is visible (one human plays every seat) and matches its live hand size", () => {
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    for (const seat of view.seats) {
      expect(seat.hand).toHaveLength(seat.handSize);
      expect(seat.handSize).toBeGreaterThan(0);
    }
  });

  test("each seat's obligation is named from its own printed identity, never invented", () => {
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    const spiderMan = view.seats[0]!;
    expect(spiderMan.subtitle).toContain("obligation Eviction Notice shuffled in");
  });

  test("decidingPlayerId names exactly who the pending choice names", () => {
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    expect(view.decidingPlayerId).toBe(state.pendingChoice?.playerId);
  });

  test("not complete: still in the setup phase", () => {
    expect(setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID).complete).toBe(false);
  });
});

describe("setupWalkthroughViewOf: before the scenario is set up (a campaign's rejoin or sit out question)", () => {
  const { state, log } = fourSeatGame();
  const before: GameState = { ...state, step: { phase: "setup", kind: "scenarioSetup" } };

  test("nothing reads as placed yet: the villain and threat chips are not ticked, no later step is done", () => {
    const view = setupWalkthroughViewOf(before, log, CORE_DEPS, CARDS_BY_ID);
    const byKey = new Map(view.checklist.map((item) => [item.key, item]));
    expect(byKey.get("placed")?.state).toBe("current");
    expect(byKey.get("threat")?.state).toBe("pending");
    expect(byKey.get("threat")?.label).toBe("Starting threat");
    expect(byKey.get("revealed")?.state).toBe("pending");
    expect(byKey.get("mulligan")?.state).toBe("pending");
    expect(byKey.get("firstPlayer")?.state).toBe("pending");
    expect(view.stepLabel).toMatch(/^Step 1 of 5/);
  });

  test("the setup log states no villain, threat or hands that are not there yet", () => {
    const lines = staticSetupLines(before, CORE_DEPS, CARDS_BY_ID, 7).map((line) => line.text);
    expect(lines).toEqual(["Seed 7 · waiting on a decision before the table is set up"]);
  });
});

describe("setupWalkthroughViewOf: after the first seat keeps its hand", () => {
  test("the first seat reads 'kept N', the second becomes the decider", () => {
    const { state, log } = fourSeatGame();
    const choiceId = state.pendingChoice!.choiceId;
    const result = applyCommand(
      state,
      { type: "resolveChoice", playerId: playerId("p1"), choiceId, selectedOptionIds: [] },
      CORE_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    const nextLog = advanceSetupWalkthroughLog(
      log,
      result.events,
      result.state,
      result.state.pendingChoice?.playerId ?? null,
      CORE_DEPS,
    );
    const view = setupWalkthroughViewOf(result.state, nextLog, CORE_DEPS, CARDS_BY_ID);

    const first = view.seats[0]!;
    expect(first.state).toBe("kept");
    expect(first.mulliganedCount).toBe(0);
    expect(first.statusLabel).toBe(`Kept ${first.handSize} · ready`);

    expect(view.decidingPlayerId).toBe(playerId("p2"));
    expect(view.seats[1]!.state).toBe("deciding");
  });
});

describe("setupWalkthroughViewOf: after the first seat mulligans some cards", () => {
  test("the seat reads 'mulliganed N · redrawing', with the real discard count", () => {
    const { state, log } = fourSeatGame();
    const choice = state.pendingChoice!;
    const toDiscard = choice.options.slice(0, 2).map((option) => option.optionId);
    const result = applyCommand(
      state,
      { type: "resolveChoice", playerId: playerId("p1"), choiceId: choice.choiceId, selectedOptionIds: toDiscard },
      CORE_DEPS,
    );
    if (!result.ok) throw new Error(result.error.message);
    const nextLog = advanceSetupWalkthroughLog(
      log,
      result.events,
      result.state,
      result.state.pendingChoice?.playerId ?? null,
      CORE_DEPS,
    );
    const view = setupWalkthroughViewOf(result.state, nextLog, CORE_DEPS, CARDS_BY_ID);

    const first = view.seats[0]!;
    expect(first.state).toBe("mulliganed");
    expect(first.mulliganedCount).toBe(2);
    expect(first.statusLabel).toBe("Mulliganed 2 · redrawing");
    // The hand is back up to its original size — mulligan discards, then draws back up (RRG 1.8 Appendix II step 15).
    expect(first.handSize).toBe(6);
  });
});

describe("setupWalkthroughViewOf: revealed setup cards", () => {
  test("null when nothing was revealed at setup (Rhino has no setup reveal)", () => {
    const { state, log } = fourSeatGame();
    expect(setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID).revealedCard).toBeNull();
    expect(log.revealedInstanceIds).toHaveLength(0);
  });
});

describe("staticSetupLines (fidelity pass, 2026-09-18): the setup log's own prefix, built from state facts, not fabricated events", () => {
  test("names the seed, the villain's stage and HP, the main scheme's starting threat, the obligation count and every seat's opening hand size", () => {
    const { state, log } = fourSeatGame();
    const lines = staticSetupLines(state, CORE_DEPS, CARDS_BY_ID, log.seed);
    const texts = lines.map((line) => line.text);
    expect(texts.some((text) => text.startsWith("Seed ") && text.includes("encounter deck shuffled"))).toBe(true);
    expect(texts.some((text) => /^Rhino placed at stage 1 — \d+ HP$/.test(text))).toBe(true);
    expect(texts.some((text) => text.endsWith("starting threat"))).toBe(true);
    expect(texts.some((text) => text === "4 obligations shuffled into the encounter deck")).toBe(true);
    expect(texts.some((text) => /^Opening hands dealt: \d+ \/ \d+ \/ \d+ \/ \d+$/.test(text))).toBe(true);
  });

  test("the seed line is omitted when no seed has been seen yet (never happens in practice, but must not crash or invent one)", () => {
    const { state } = fourSeatGame();
    const lines = staticSetupLines(state, CORE_DEPS, CARDS_BY_ID, null);
    expect(lines.some((line) => line.text.startsWith("Seed "))).toBe(false);
  });

  test("advanceSetupWalkthroughLog captures the real gameCreated event's seed, once, and keeps it across later calls", () => {
    const { state, log } = fourSeatGame();
    expect(log.seed).not.toBeNull();
    const again = advanceSetupWalkthroughLog(log, [], state, null, CORE_DEPS);
    expect(again.seed).toBe(log.seed);
  });

  test("setupWalkthroughViewOf's setupLog leads with the static facts, then any real events folded in since", () => {
    const { state, log } = fourSeatGame();
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    const staticCount = staticSetupLines(state, CORE_DEPS, CARDS_BY_ID, log.seed).length;
    expect(view.setupLog.slice(0, staticCount).map((line) => line.text)).toEqual(
      staticSetupLines(state, CORE_DEPS, CARDS_BY_ID, log.seed).map((line) => line.text),
    );
    // Rhino has no setup-time reveal, so nothing else has happened yet: the static prefix is the whole log.
    expect(view.setupLog).toHaveLength(staticCount);
  });

  test("the header's step caption names the current step in words, not just its number", () => {
    const { state, log } = fourSeatGame();
    const view = setupWalkthroughViewOf(state, log, CORE_DEPS, CARDS_BY_ID);
    expect(view.stepLabel).toBe("Step 4 of 5 · opening hands — mulligan");
  });
});

describe("advanceSetupWalkthroughLog", () => {
  test("folds events without losing round/beat threading across multiple calls (matches view/log-lines.ts's own accumulator)", () => {
    const { state, log } = fourSeatGame();
    const again = advanceSetupWalkthroughLog(log, [], state, null, CORE_DEPS);
    expect(again.log.lines).toEqual(log.log.lines);
    expect(again.revealedInstanceIds).toEqual(log.revealedInstanceIds);
    expect(again.mulliganedCounts).toEqual(log.mulliganedCounts);
  });
});
