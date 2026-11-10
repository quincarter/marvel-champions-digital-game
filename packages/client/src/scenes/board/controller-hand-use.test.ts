/**
 * A tap on a hand card with an Action that works from the hand (Slingshot, issue #634) asks "Play it" or that Action
 * before anything is paid; with only the Action usable it starts that Action; Cancel and a second tap send nothing.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { codeOf } from "../../store/dev-game-steps.js";
import {
  ENERGY_CARD,
  SLINGSHOT_ACTION,
  SLINGSHOT_CARD,
  startSlingshotDevGame,
} from "../../store/dev-slingshot-game.js";
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
let sling: InstanceId;
let energy: InstanceId;

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await startSlingshotDevGame(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const game = store.state.game!;
  sling = game.players[0]!.hand.find((id) => codeOf(game, id) === SLINGSHOT_CARD)!;
  energy = game.players[0]!.hand.find((id) => codeOf(game, id) === ENERGY_CARD)!;
  dispatch = vi.spyOn(store, "dispatch");
});

const host = (playable: boolean, inspect = vi.fn<(id: InstanceId) => void>()): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [{ instanceId: sling }] }) as unknown as BoardModel,
  marks: (): Highlights | null =>
    ({ playable: new Set(playable ? [sling] : []), usableAbilities: new Set([sling]) }) as unknown as Highlights,
  tabbed: (): boolean => false,
  redraw: (): void => {},
  inspect,
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

describe("Slingshot in hand", () => {
  test("a tap asks Play it or her Action, with nothing sent", () => {
    const controller = new BoardController(host(true));
    controller.tapHandCard(sling);
    expect(controller.selection.kind).toBe("choosingHandUse");
    const options = controller.handUseChoice()!.options;
    expect(options.map((o) => o.kind)).toEqual(["play", "ability"]);
    expect(options[0]!.label).toBe("Play it · costs 3");
    expect(options[1]!.label).toMatch(/^Action · spend 1/);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("Enter on the focused card asks the same, where it used to open Inspect", () => {
    const inspect = vi.fn<(id: InstanceId) => void>();
    const controller = new BoardController(host(true, inspect));
    controller.activate({ kind: "card", instanceId: sling });
    expect(controller.selection.kind).toBe("choosingHandUse");
    expect(inspect).not.toHaveBeenCalled();
  });

  test("Cancel and a second tap on her put her back with nothing spent", () => {
    const controller = new BoardController(host(true));
    controller.tapHandCard(sling);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    controller.tapHandCard(sling);
    expect(controller.tapInMode(sling)).toBe(true);
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("picking Play it opens the payment for 3", async () => {
    const controller = new BoardController(host(true));
    controller.tapHandCard(sling);
    await controller.chooseHandUse(0);
    expect(controller.selection.kind).toBe("paying");
    expect(controller.paymentView()!.subject).toBe(sling);
  });

  test("picking her Action pays one [energy], never with her, and sends the Action", async () => {
    const controller = new BoardController(host(true));
    controller.tapHandCard(sling);
    await controller.chooseHandUse(1);
    expect(controller.selection.kind).toBe("paying");
    const sources = controller.paymentView()!.sources;
    expect(sources.some((s) => s.instanceId === sling)).toBe(false);
    controller.togglePaymentOption(sources.find((s) => s.instanceId === energy)!.optionId);
    await controller.commitPayment();
    const sent = dispatch.mock.calls[0]![0] as Extract<Command, { type: "useAbility" }>;
    expect(sent).toMatchObject({ type: "useAbility", cardInstanceId: sling, abilityId: SLINGSHOT_ACTION });
    expect(sent.payment).toEqual([{ fromHand: energy }]);
  });

  test("when she cannot be played, a tap starts her Action straight away", () => {
    const controller = new BoardController(host(false));
    controller.tapHandCard(sling);
    expect(controller.selection.kind).toBe("paying");
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("an answer past the offered options does nothing", async () => {
    const controller = new BoardController(host(true));
    controller.tapHandCard(sling);
    await controller.chooseHandUse(5);
    expect(controller.selection.kind).toBe("choosingHandUse");
  });
});
