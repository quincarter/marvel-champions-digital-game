/**
 * A basic power whose own additional cost discards from hand asks which card (RRG 1.8 "Cost", p. 13): Wonder Man
 * (03014, "As an additional cost for Wonder Man to attack, you must discard 1 card from your hand"). Before, the board
 * sent the engine's example pick, the first card in hand, without asking (issue #242). Real content and a real session
 * (`store/dev-in-play-cost-games.ts`), like `controller-in-play-cost.test.ts`.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, GameState, InstanceId } from "@mc/engine";
import { cardsInPlay } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { startStrengthInNumbersDevGame } from "../../store/dev-in-play-cost-games.js";
import { nextTurn } from "../../store/dev-game-steps.js";
import { SessionStore } from "../../store/session-store.js";
import type { Highlights } from "../../view/highlights.js";
import type { BoardModel } from "../../view/board-model.js";
import { BoardController, type BoardControllerHost } from "./controller.js";

class NoopWorker {
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = NoopWorker;

let store: SessionStore;
let dispatch: ReturnType<typeof vi.spyOn>;
let wonderMan: InstanceId;

const game = (): GameState => store.state.game!;

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await startStrengthInNumbersDevGame(store);
  // The dev game spends the opening hand on the allies; the next turn's draw gives the discard a real choice.
  const turn = await nextTurn(store);
  const endTurn = turn?.legal.find((entry) => entry.action.kind === "endTurn");
  if (!endTurn) throw new Error("expected to end the turn");
  await store.dispatch(endTurn.example);
  await nextTurn(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const state = game();
  wonderMan = cardsInPlay(state).find((id) => (state.instances[id]!.cardId as string) === "03014")!;
  dispatch = vi.spyOn(store, "dispatch");
});

function host(): BoardControllerHost {
  return {
    model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
    marks: (): Highlights | null => ({ playable: new Set() }) as unknown as Highlights,
    tabbed: (): boolean => false,
    redraw: (): void => {},
    inspect: vi.fn<(id: InstanceId) => void>(),
    confirmEndTurn: vi.fn(),
    holdOn: vi.fn(),
  };
}

describe("Wonder Man's attack asks which card to discard", () => {
  test("opens the discard picker, and the card picked, not the first in hand, is what is sent and discarded", async () => {
    const controller = new BoardController(host());
    controller.chooseBasic("attack");
    expect(controller.selection.kind).toBe("choosingSource");
    controller.chooseSource(wonderMan);
    await Promise.resolve();
    expect(dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("choosingDiscard");

    const hand = game().players[0]!.hand;
    const first = hand[0]!;
    const last = hand[hand.length - 1]!;
    expect(controller.discardChoiceView()).toMatchObject({ min: 1, max: 1, command: null });
    controller.toggleDiscardPick(last);
    expect(controller.discardChoiceView()!.command).not.toBeNull();

    await controller.commitDiscardChoice();
    expect(dispatch).toHaveBeenCalledTimes(1);
    const sent = dispatch.mock.calls[0]![0] as Extract<Command, { type: "basicAttack" }>;
    expect(sent.type).toBe("basicAttack");
    expect(sent.attackerInstanceId).toBe(wonderMan);
    expect(sent.costChoices?.discard).toEqual([last]);
    expect(game().players[0]!.discard).toContain(last);
    expect(game().players[0]!.hand).toContain(first);
  });

  test("Cancel backs out without attacking or discarding", async () => {
    const controller = new BoardController(host());
    const handBefore = [...game().players[0]!.hand];
    controller.chooseBasic("attack");
    controller.chooseSource(wonderMan);
    expect(controller.selection.kind).toBe("choosingDiscard");
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
    expect(game().players[0]!.hand).toEqual(handBefore);
  });
});
