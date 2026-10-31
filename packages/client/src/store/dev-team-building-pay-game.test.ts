/**
 * Issue #569's own game: Team-Building Exercise's payment for a card from hand, with Organizational Support in hand. The
 * report picked Organizational Support twice, once plainly and once exhausting cards; the engine refused the payment,
 * so nothing was played and the activation was gone, and Undo would not take it back.
 */
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { optionCounterNotesOf, spendCaptionsOf } from "../view/choice-tile-notes.js";
import { paymentSheetView } from "../view/payment-sheet.js";
import { shownSpendChoice, spendAnswerOf, toggleSpendPick } from "../view/spend-choice.js";
import { undoOf } from "../view/undo.js";
import { startTeamBuildingPayGame } from "./dev-team-building-pay-game.js";
import { SessionStore } from "./session-store.js";

async function opened() {
  const store = new SessionStore(new LocalEngineHost());
  await startTeamBuildingPayGame(store);
  const game = store.state.game!;
  return { store, game, choice: game.pendingChoice! };
}

const TIMEOUT = 120_000;

describe("Team-Building Exercise's payment (issue #569)", () => {
  test(
    "the sets of cards to exhaust become one tile per card, with their name and what each adds",
    async () => {
      const { game, choice } = await opened();
      expect(choice.prompt.kind).toBe("spendResources");
      const shown = shownSpendChoice(choice);
      const tiles = shown.options.filter((option) => option.optionId.startsWith("exhaust:"));
      expect(tiles.map((tile) => tile.label).sort()).toEqual([
        "Exhaust Agent 13",
        "Exhaust Field Agent",
        "Exhaust The Iliad",
      ]);
      expect(shown.options.some((option) => option.optionId.includes("@"))).toBe(false);
      const captions = spendCaptionsOf(game, choice, shown, POOL_DEPS);
      expect(tiles.every((tile) => /^Exhaust( \+\d+ \w+.*)?$/.test(captions.get(tile.optionId) ?? ""))).toBe(true);
    },
    TIMEOUT,
  );

  test(
    "what was spent twice in the report can't be, and the tiles answer with the engine's way",
    async () => {
      const { choice } = await opened();
      const shown = shownSpendChoice(choice);
      const tiles = shown.options.filter((option) => option.optionId.startsWith("exhaust:")).map((o) => o.optionId);
      const hand = tiles[0]!.split(":")[1]!;
      let picks: readonly string[] = [];
      for (const tile of tiles) picks = toggleSpendPick(choice, picks, tile);
      expect(picks).toContain(`hand:${hand}`);
      const answer = spendAnswerOf(choice, picks);
      expect(answer).toHaveLength(1);
      expect(answer[0]).toMatch(new RegExp(`^hand:${hand}:50014\\.organizational-support-interrupt@`));
      expect(toggleSpendPick(choice, picks, `hand:${hand}`)).toEqual([]);
    },
    TIMEOUT,
  );

  test(
    "Confirm waits for what the engine takes, and says so",
    async () => {
      const { game, choice } = await opened();
      const view = (picks: readonly string[]) =>
        paymentSheetView(game, choice, spendAnswerOf(choice, picks), POOL_DEPS)!;
      expect(view([])).toMatchObject({ canConfirm: false, declineLabel: "Don't play it" });
      expect(view([]).note).toContain("Team-Building Exercise stays exhausted");
      // The report's own answer, the same hand card twice: refused, so Confirm stays off.
      const twice = paymentSheetView(
        game,
        choice,
        ["hand:i21:50014.organizational-support-interrupt@exhausted=i16,i40", "hand:i21", "hand:i10", "hand:i6"],
        POOL_DEPS,
      )!;
      expect(twice.canConfirm).toBe(false);
    },
    TIMEOUT,
  );

  test(
    "the tiles' answer pays: Confirm lights, and the card leaves the hand",
    async () => {
      const { store, game, choice } = await opened();
      const frame = game.stack.find((entry) => entry.frameId === choice.frameId);
      const card = frame && "bindings" in frame ? frame.bindings["_play.card"]![0]! : null;
      let picks: readonly string[] = [];
      for (const { optionId } of shownSpendChoice(choice).options) {
        if (optionId.startsWith("exhaust:")) picks = toggleSpendPick(choice, picks, optionId);
      }
      const answer = spendAnswerOf(choice, picks);
      expect(paymentSheetView(game, choice, answer, POOL_DEPS)).toMatchObject({ canConfirm: true, paid: 4 });
      expect(await store.resolveChoice(answer)).toBe(true);
      expect(store.state.game!.players[0]!.hand).not.toContain(card);
    },
    TIMEOUT,
  );

  test(
    "declining takes the activation away, and Undo gives it back",
    async () => {
      const { store, game } = await opened();
      const teamBuilding = Object.values(game.instances).find((i) => (i.cardId as string) === "12024")!;
      expect(await store.resolveChoice([])).toBe(true);
      const after = store.state.game!;
      expect(after.instances[teamBuilding.instanceId]?.exhausted).toBe(true);
      const offer = undoOf(store.state.commandTrail, after, store.state.perspectiveId!);
      expect(offer?.kind).toBe("available");
      await store.rewindTo(offer?.kind === "available" ? offer.target : 0);
      expect(store.state.game!.instances[teamBuilding.instanceId]?.exhausted).toBe(false);
    },
    TIMEOUT,
  );

  test(
    "a card in play says what it holds (issue #571): The Iliad's mission counters on its exhaust tile",
    async () => {
      const { game, choice } = await opened();
      const notes = optionCounterNotesOf(game, shownSpendChoice(choice));
      expect([...notes.values()].some((note) => note.includes("mission"))).toBe(true);
    },
    TIMEOUT,
  );
});
