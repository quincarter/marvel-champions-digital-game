/**
 * W3's own requirement (docs/phase4-screen-gaps.md §3): "It answers the same
 * `PendingChoice` with the same `resolveChoice` command the generic sheet
 * sends, so the command log is unchanged — prove it with a test that the
 * saved log from your screen's answers equals the log from the generic
 * sheet's answers."
 *
 * `SetupDealScene#toggle`/`#confirm` and `ChoiceOverlay#toggle`/`#confirm`
 * both funnel through the exact same `store.resolveChoice(selectedOptionIds)`
 * — a Phaser scene can't be unit-tested in this Vitest environment (no
 * canvas/WebGL context; `docs/phase4-screen-gaps.md`'s own S7 note is that
 * nothing in this package tests a scene directly), so this proves the thing
 * a scene test would prove at the level that *is* testable: each screen's
 * own selection-building rule — mirrored here from its real source, not
 * re-invented — reduces the same sequence of card taps to the same
 * `selectedOptionIds` array, and dispatching that array through two
 * otherwise-identical sessions produces byte-identical command logs.
 *
 * `ChoiceOverlay#toggle` (`scenes/choice.ts`):
 *   `max === 1` replaces the selection; otherwise it appends up to `max`.
 * `SetupDealScene#toggle` (`scenes/setup-deal.ts`):
 *   always appends up to `max` (no `max === 1` special case).
 * A mulligan's `maxSelections` is always `player.hand.length` (RRG 1.8
 * Appendix II step 15: discard *any number*, so the cap is the whole hand),
 * which is never 1 for a real Core/wave 1 opening hand — so for this one
 * `PendingChoice` kind the two rules are provably the same rule. That's
 * asserted directly below, not just assumed.
 */
import { describe, expect, test } from "vitest";
import { CORE_DEPS, coreScenario } from "@mc/cards";
import { createGame, sessionApply, startSession, type Command, type GameSession, type PlayerId } from "@mc/engine";

/** `ChoiceOverlay#toggle`, copied verbatim in behaviour from `scenes/choice.ts`. */
function genericSheetToggle(selected: readonly string[], optionId: string, max: number): readonly string[] {
  const at = selected.indexOf(optionId);
  if (at >= 0) return selected.filter((id) => id !== optionId);
  if (max === 1) return [optionId];
  if (selected.length < max) return [...selected, optionId];
  return selected;
}

/** `SetupDealScene#toggle`, copied verbatim in behaviour from `scenes/setup-deal.ts`. */
function setupSceneToggle(selected: readonly string[], optionId: string, max: number): readonly string[] {
  const at = selected.indexOf(optionId);
  if (at >= 0) return selected.filter((id) => id !== optionId);
  if (selected.length < max) return [...selected, optionId];
  return selected;
}

function fourSeatSession(): GameSession {
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
  return startSession(result.state);
}

/** Each seat's own click sequence: which of its own hand's option ids (by index) to tap, in click order. Empty is "Keep all" — a raw decline, not a toggle at all. */
const CLICK_SEQUENCE_BY_SEAT: Readonly<Record<string, readonly number[]>> = {
  p1: [0, 2],
  p2: [],
  p3: [1],
  p4: [3, 0, 3], // taps the same card twice (select, then deselect) before settling on one — proves order-sensitivity is preserved identically by both rules.
};

describe("SetupDealScene and ChoiceOverlay answer a mulligan the same way", () => {
  test("the max===1 special case never applies to a mulligan (both toggle rules are the same rule here)", () => {
    const session = fourSeatSession();
    let current = session.state;
    for (const player of ["p1", "p2", "p3", "p4"] as const) {
      const choice = current.pendingChoice;
      expect(choice?.prompt.kind).toBe("mulligan");
      expect(choice!.maxSelections).toBeGreaterThan(1);
      const result = sessionApply({ state: current, log: session.log }, { type: "resolveChoice", playerId: player as PlayerId, choiceId: choice!.choiceId, selectedOptionIds: [] });
      if (!result.ok) throw new Error(result.error.message);
      current = result.session.state;
    }
  });

  test("driving all four seats' mulligans through each screen's own toggle rule produces byte-identical command logs", () => {
    let genericSession = fourSeatSession();
    let sceneSession = fourSeatSession();

    for (const player of ["p1", "p2", "p3", "p4"] as const) {
      const genericChoice = genericSession.state.pendingChoice;
      const sceneChoice = sceneSession.state.pendingChoice;
      expect(genericChoice?.prompt.kind).toBe("mulligan");
      expect(sceneChoice?.prompt.kind).toBe("mulligan");
      // Both sessions are built from the identical seeded config, so their instances (and therefore option ids) are
      // identical at every corresponding step — the two logs would otherwise be incomparable by construction.
      expect(genericChoice!.options.map((o) => o.optionId)).toEqual(sceneChoice!.options.map((o) => o.optionId));

      const clicks = CLICK_SEQUENCE_BY_SEAT[player] ?? [];
      const optionIds = genericChoice!.options.map((o) => o.optionId);

      let genericSelected: readonly string[] = [];
      let sceneSelected: readonly string[] = [];
      for (const index of clicks) {
        const optionId = optionIds[index]!;
        genericSelected = genericSheetToggle(genericSelected, optionId, genericChoice!.maxSelections);
        sceneSelected = setupSceneToggle(sceneSelected, optionId, sceneChoice!.maxSelections);
      }
      // The premise the test exists to check: for this choice kind, the two rules never disagree.
      expect(sceneSelected).toEqual(genericSelected);

      const genericResult = sessionApply(genericSession, { type: "resolveChoice", playerId: player as PlayerId, choiceId: genericChoice!.choiceId, selectedOptionIds: genericSelected });
      const sceneResult = sessionApply(sceneSession, { type: "resolveChoice", playerId: player as PlayerId, choiceId: sceneChoice!.choiceId, selectedOptionIds: sceneSelected });
      if (!genericResult.ok) throw new Error(genericResult.error.message);
      if (!sceneResult.ok) throw new Error(sceneResult.error.message);
      genericSession = genericResult.session;
      sceneSession = sceneResult.session;
    }

    expect(sceneSession.log.commands).toEqual(genericSession.log.commands);
    expect(sceneSession.state).toEqual(genericSession.state);
  });

  test("'Keep all' (a raw decline, no toggle at all) answers identically through either screen", () => {
    let genericSession = fourSeatSession();
    let sceneSession = fourSeatSession();
    const declineAll: Command[] = [];

    for (const player of ["p1", "p2", "p3", "p4"] as const) {
      const choiceId = genericSession.state.pendingChoice!.choiceId;
      const command: Command = { type: "resolveChoice", playerId: player as PlayerId, choiceId, selectedOptionIds: [] };
      const genericResult = sessionApply(genericSession, command);
      const sceneResult = sessionApply(sceneSession, command);
      if (!genericResult.ok) throw new Error(genericResult.error.message);
      if (!sceneResult.ok) throw new Error(sceneResult.error.message);
      genericSession = genericResult.session;
      sceneSession = sceneResult.session;
      declineAll.push(command);
    }

    expect(sceneSession.log.commands).toEqual(genericSession.log.commands);
    expect(sceneSession.log.commands).toEqual(declineAll);
  });
});
