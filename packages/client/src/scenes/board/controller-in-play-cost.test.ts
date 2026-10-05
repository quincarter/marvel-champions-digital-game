/**
 * A hand play whose cost has a choice among cards in play asks which, however it was started, and sends exactly the
 * cards picked (RRG 1.8 "Cost", p. 13). Mutant Peacekeepers (34018) exhausts "your hero and any number of X-MEN allies":
 * before, the board sent the engine's example (the first ally) without a question. Real content and a real session
 * (`store/dev-x-men-games.ts`), like `controller-play-aim.test.ts`.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, GameState, InstanceId } from "@mc/engine";
import { cardsInPlay } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import {
  PEACEKEEPERS_CARD,
  STRENGTH_IN_NUMBERS_CARD,
  startPeacekeepersDevGame,
  startStrengthInNumbersDevGame,
} from "../../store/dev-in-play-cost-games.js";
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
let card: InstanceId;
let allies: readonly InstanceId[];

const game = (): GameState => store.state.game!;

async function open(start: (s: SessionStore) => Promise<void>, held: string, allyCodes: readonly string[]) {
  store = new SessionStore(new LocalEngineHost());
  await start(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const state = game();
  card = state.players[0]!.hand.find((id) => (state.instances[id]!.cardId as string) === held)!;
  allies = cardsInPlay(state).filter((id) => allyCodes.includes(state.instances[id]!.cardId as string));
  dispatch = vi.spyOn(store, "dispatch");
}

function host(
  tabbed: boolean,
): BoardControllerHost & { readonly inspect: ReturnType<typeof vi.fn<(id: InstanceId) => void>> } {
  return {
    model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
    marks: (): Highlights | null => ({ playable: new Set([card]) }) as unknown as Highlights,
    tabbed: (): boolean => tabbed,
    redraw: (): void => {},
    inspect: vi.fn<(id: InstanceId) => void>(),
    confirmEndTurn: vi.fn(),
    holdOn: vi.fn(),
  };
}

const sentCommand = (): Extract<Command, { type: "playCard" }> =>
  dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>;

beforeEach(async () => {
  await open(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]);
});

describe("Mutant Peacekeepers asks which allies, however it was started", () => {
  const ways: [string, (c: BoardController) => Promise<void> | void][] = [
    ["Inspect's Play it (the phone sheet, the desktop sheet)", (c) => c.playCard(card)],
    ["a tap or click on the card (desktop)", (c) => c.tapHandCard(card)],
    ["Enter on the focused card (keyboard)", (c) => c.playCard(card, { confirmFree: true })],
  ];

  test.each(ways)("%s", async (_name, start) => {
    const controller = new BoardController(host(false));
    await start(controller);
    await Promise.resolve();
    expect(dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("choosingInPlayCost");
    const panel = controller.targetingPanel()!;
    expect(panel.title).toBe("Choose cards to exhaust");
    expect(panel.options.map((o) => o.instanceId).sort()).toEqual([...allies].sort());
    expect(panel.multi).toMatchObject({ summary: "PICKED 0 (any number)", canConfirm: false });
    // The keyboard route: both allies, then Confirm, then Cancel.
    expect(controller.focusOrder().map((t) => t.kind)).toEqual(["card", "card", "confirm", "cancel"]);
  });

  test("on the tabbed (phone) board a tap opens Inspect first, and its Play it asks the same question", async () => {
    const phone = host(true);
    const controller = new BoardController(phone);
    controller.tapHandCard(card);
    expect(phone.inspect).toHaveBeenCalledWith(card);
    expect(controller.selection.kind).toBe("idle");
    await controller.playCard(card);
    expect(controller.selection.kind).toBe("choosingInPlayCost");
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("Confirm does nothing until a card is picked; then the picked ally, not the first, is what is sent", async () => {
    const controller = new BoardController(host(false));
    const [first, second] = allies as [InstanceId, InstanceId];
    await controller.playCard(card);
    await controller.confirmInPlayCost();
    expect(controller.selection.kind).toBe("choosingInPlayCost");

    expect(controller.tapInMode(second)).toBe(true);
    expect(controller.targetingPanel()!.multi).toMatchObject({ summary: "PICKED 1 (any number)", canConfirm: true });
    await controller.confirmInPlayCost();
    // Mutant Peacekeepers costs 1: payment is the next step, and nothing has gone to the engine yet.
    expect(controller.selection.kind).toBe("paying");
    expect(dispatch).not.toHaveBeenCalled();

    for (const source of controller.paymentView()!.sources) {
      if (controller.paymentView()!.command) break;
      controller.togglePaymentOption(source.optionId);
    }
    expect(controller.paymentView()!.command, "the payment covers the cost").not.toBeNull();
    await controller.commitPayment();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sentCommand().costChoices?.exhausted).toEqual([second]);
    expect(game().instances[second]!.exhausted).toBe(true);
    expect(game().instances[first]!.exhausted).toBe(false);
  });

  test("both allies picked: both are sent and exhausted; a card tapped twice is put back", async () => {
    const controller = new BoardController(host(false));
    const [first, second] = allies as [InstanceId, InstanceId];
    await controller.playCard(card);
    controller.tapInMode(first);
    controller.tapInMode(second);
    controller.tapInMode(first);
    controller.tapInMode(first);
    expect(controller.inPlayCostView()!.picked.size).toBe(2);
    await controller.confirmInPlayCost();
    for (const source of controller.paymentView()!.sources) {
      if (controller.paymentView()!.command) break;
      controller.togglePaymentOption(source.optionId);
    }
    await controller.commitPayment();
    expect([...sentCommand().costChoices!.exhausted!].sort()).toEqual([first, second].sort());
    expect(game().instances[first]!.exhausted && game().instances[second]!.exhausted).toBe(true);
  });

  test("Cancel sends nothing and leaves everything ready", async () => {
    const controller = new BoardController(host(false));
    await controller.playCard(card);
    controller.tapInMode(allies[0]!);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
    expect(allies.every((id) => !game().instances[id]!.exhausted)).toBe(true);
  });
});

describe("Strength in Numbers (nothing to pay): the picks alone make the command", () => {
  beforeEach(async () => {
    await open(startStrengthInNumbersDevGame, STRENGTH_IN_NUMBERS_CARD, ["03013", "03014"]);
  });

  test("asks, previews the draw, and sends the picked allies straight to the engine on Confirm", async () => {
    const controller = new BoardController(host(false));
    const [first, second] = allies as [InstanceId, InstanceId];
    await controller.playCard(card);
    expect(controller.selection.kind).toBe("choosingInPlayCost");
    controller.tapInMode(second);
    expect(controller.targetingPanel()!.multi?.preview).toBe("X = 1 cards");
    const handBefore = game().players[0]!.hand.length;
    await controller.confirmInPlayCost();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sentCommand().costChoices?.exhausted).toEqual([second]);
    expect(game().instances[second]!.exhausted).toBe(true);
    expect(game().instances[first]!.exhausted).toBe(false);
    expect(game().players[0]!.hand.length).toBe(handBefore - 1 + 1);
  });
});
