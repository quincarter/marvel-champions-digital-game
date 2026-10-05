/**
 * "Play under any player's control" asks whose play area (RRG 1.8 "Ownership and Control", p. 30; Storm's Uncanny X-Men
 * 36018, "Max 1 TEAM card per player"), however the play was started: `legalActions` lists one play per seat, the board
 * names each seat by its hero, the asking seat first, and sends the one picked. With one seat there is nothing to ask.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, GameState, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { UNCANNY_CARD, startUncannyDevGame, startUncannySoloDevGame } from "../../store/dev-uncanny-game.js";
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

const game = (): GameState => store.state.game!;
const seatIds = (): readonly PlayerId[] => game().players.map((p) => p.playerId);
const identityOf = (playerId: PlayerId): InstanceId =>
  game().players.find((p) => p.playerId === playerId)!.identity.instanceId;

async function open(start: (s: SessionStore) => Promise<void>): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await start(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  card = game().players[0]!.hand.find((id) => (game().instances[id]!.cardId as string) === UNCANNY_CARD)!;
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

const pay = (controller: BoardController): void => {
  for (const source of controller.paymentView()!.sources) {
    if (controller.paymentView()!.command) break;
    controller.togglePaymentOption(source.optionId);
  }
};

describe("in a two-hero game Uncanny X-Men asks whose play area", () => {
  beforeEach(async () => {
    await open(startUncannyDevGame);
  });

  const ways: [string, (c: BoardController) => Promise<void> | void][] = [
    ["Inspect's Play it", (c) => c.playCard(card)],
    ["a tap or click on the card", (c) => c.tapHandCard(card)],
    ["Enter on the focused card", (c) => c.playCard(card, { confirmFree: true })],
  ];

  test.each(ways)("%s", async (_name, start) => {
    const controller = new BoardController(host(false));
    await start(controller);
    await Promise.resolve();
    expect(dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("choosingController");
    const panel = controller.targetingPanel()!;
    expect(panel.title).toBe("Whose play area?");
    // One tile per seat, named for its hero, the asking seat first and the default answer.
    expect(panel.options.map((o) => o.name)).toEqual(["Storm", "Wolverine"]);
    expect(panel.options.map((o) => o.instanceId)).toEqual(seatIds().map(identityOf));
    expect(panel.defaultId).toBe(identityOf(seatIds()[0]!));
    expect(panel.options[0]!.lines).toEqual(["You"]);
    expect(panel.options[1]!.lines).toEqual(["Logan"]);
    expect(controller.focusOrder().map((t) => t.kind)).toEqual(["card", "card", "cancel"]);
  });

  test("the seat tapped (not the first) is what is sent, and only after it is paid for", async () => {
    const controller = new BoardController(host(false));
    const [storm, wolverine] = seatIds() as [PlayerId, PlayerId];
    await controller.playCard(card);
    expect(controller.tapInMode(identityOf(wolverine))).toBe(true);
    await Promise.resolve();
    expect(controller.selection.kind).toBe("paying");
    expect(dispatch).not.toHaveBeenCalled();
    pay(controller);
    await controller.commitPayment();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect((dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>).controllerId).toBe(wolverine);
    expect(game().instances[card]!.controllerId).toBe(wolverine);
    expect(game().instances[card]!.controllerId).not.toBe(storm);
  });

  test("the asking seat's own tile plays it under Storm, as the engine spells it (no controller)", async () => {
    const controller = new BoardController(host(false));
    const [storm] = seatIds() as [PlayerId, PlayerId];
    await controller.playCard(card);
    controller.tapInMode(identityOf(storm));
    await Promise.resolve();
    pay(controller);
    await controller.commitPayment();
    expect(game().instances[card]!.controllerId).toBe(storm);
  });

  test("on the tabbed (phone) board a tap opens Inspect first, and its Play it asks the same question", async () => {
    const phone = host(true);
    const controller = new BoardController(phone);
    controller.tapHandCard(card);
    expect(phone.inspect).toHaveBeenCalledWith(card);
    expect(controller.selection.kind).toBe("idle");
    await controller.playCard(card);
    expect(controller.selection.kind).toBe("choosingController");
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("Cancel sends nothing", async () => {
    const controller = new BoardController(host(false));
    await controller.playCard(card);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("with one seat there is nothing to ask", () => {
  test("Uncanny X-Men goes straight to payment", async () => {
    await open(startUncannySoloDevGame);
    const controller = new BoardController(host(false));
    await controller.playCard(card);
    expect(controller.selection.kind).toBe("paying");
    expect(controller.targetingPanel()).toBeNull();
  });
});
