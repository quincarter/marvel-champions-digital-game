/**
 * Playing an event with two usable Action abilities asks which one before anything is paid (RRG 1.8 "Event", p. 18),
 * however the play was started; Cancel puts the card back with nothing spent; the answer goes out as `abilityId`.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import {
  PLUMAGE_ATTACK,
  PLUMAGE_CARD,
  PLUMAGE_THWART,
  startWhichAbilityDevGame,
  unscopeAdaptivePlumage,
} from "../../store/dev-which-ability-game.js";
import { codeOf } from "../../store/dev-game-steps.js";
import { SessionStore } from "../../store/session-store.js";
import type { BoardModel } from "../../view/board-model.js";
import type { Highlights } from "../../view/highlights.js";
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
let undo: () => void;

beforeEach(async () => {
  undo = unscopeAdaptivePlumage();
  store = new SessionStore(new LocalEngineHost());
  await startWhichAbilityDevGame(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const game = store.state.game!;
  card = game.players[0]!.hand.find((id) => codeOf(game, id) === PLUMAGE_CARD)!;
  dispatch = vi.spyOn(store, "dispatch");
});
afterEach(() => undo());

const host = (tabbed: boolean): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable: new Set([card]) }) as unknown as Highlights,
  tabbed: (): boolean => tabbed,
  redraw: (): void => {},
  inspect: vi.fn<(id: InstanceId) => void>(),
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

describe("Which ability?", () => {
  const ways: [string, (c: BoardController) => Promise<void> | void][] = [
    ["Inspect's Play it", (c) => c.playCard(card)],
    ["a tap or click on the card (and a drag onto the table)", (c) => c.tapHandCard(card)],
    ["Enter on the focused card", (c) => c.playCard(card, { confirmFree: true })],
  ];

  test.each(ways)("%s opens the question, with nothing sent", async (_name, start) => {
    const controller = new BoardController(host(false));
    await start(controller);
    expect(controller.selection.kind).toBe("choosingAbility");
    expect(controller.abilityChoice()!.options.map((o) => o.label)).toEqual([
      "If you are Angel",
      "If you are Archangel",
    ]);
    expect(controller.focusOrder().map((t) => t.kind)).toEqual(["card", "cancel"]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("Cancel returns the card with nothing spent, and a second tap on the card does too", async () => {
    const controller = new BoardController(host(false));
    const before = store.state.game!;
    await controller.playCard(card);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    await controller.playCard(card);
    expect(controller.tapInMode(card)).toBe(true);
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.state.game).toBe(before);
  });

  test("the pick opens payment for that ability, and the command carries its abilityId", async () => {
    const controller = new BoardController(host(false));
    await controller.playCard(card);
    await controller.chooseEventAbility(PLUMAGE_ATTACK as never);
    expect(controller.selection.kind).toBe("paying");
    for (const source of controller.paymentView()!.sources) {
      if (controller.paymentView()!.command) break;
      controller.togglePaymentOption(source.optionId);
    }
    expect((controller.paymentView()!.command as Extract<Command, { type: "playCard" }>).abilityId).toBe(
      PLUMAGE_ATTACK,
    );
    await controller.commitPayment();
    expect((dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>).abilityId).toBe(PLUMAGE_ATTACK);
    expect(PLUMAGE_THWART).not.toBe(PLUMAGE_ATTACK);
  });

  test("an answer that is not one of the offered abilities does nothing", async () => {
    const controller = new BoardController(host(false));
    await controller.playCard(card);
    await controller.chooseEventAbility("nope" as never);
    expect(controller.selection.kind).toBe("choosingAbility");
  });
});
