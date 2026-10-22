/**
 * Issue #365: thwarting The Red House (`trors` 04139, "they may use their ATK instead of their THW") asks THW or ATK
 * when it is the scheme thwarted, and the ATK answer goes out as `basicThwart.useAtk` (`thwart-stat-choice.test.ts`
 * covers the schemes that ask nothing).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cardsInPlay, type Command, type InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
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
let redHouse: InstanceId;

async function settle(): Promise<void> {
  for (let step = 0; step < 20; step++) {
    const pending = store.state.legal;
    if (!pending || pending.actions.kind !== "choice") break;
    const { choice } = pending.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
}

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "red-skull",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
  });
  await settle();
  // Peter Parker flips to Spider-Man first: an alter-ego cannot thwart.
  const legal = store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : [];
  const flip = legal.find((entry) => entry.action.kind === "changeForm");
  if (flip) await store.dispatch(flip.example);
  await settle();
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const game = store.state.game!;
  redHouse = cardsInPlay(game).find((id) => game.instances[id]?.cardId === "04139")!;
  dispatch = vi.spyOn(store, "dispatch");
});
afterEach(() => vi.restoreAllMocks());

const host = (): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable: new Set() }) as unknown as Highlights,
  tabbed: (): boolean => false,
  redraw: (): void => {},
  inspect: vi.fn<(id: InstanceId) => void>(),
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

/**
 * Thwart pressed. At the start of this game the main scheme has no threat, so The Red House is the one legal target and
 * there is no target to pick: the question comes straight away (a pick on the board would lead to the same question).
 */
function aimThwart(controller: BoardController): void {
  expect(
    store.state.legal?.actions.kind === "turn" &&
      store.state.legal.actions.legal.find((e) => e.action.kind === "basicThwart")?.targets,
  ).toEqual([redHouse]);
  controller.chooseBasic("thwart");
}

describe("Thwart with? (The Red House)", () => {
  test("aiming at The Red House asks THW or ATK, with nothing sent", () => {
    const controller = new BoardController(host());
    aimThwart(controller);
    expect(controller.selection.kind).toBe("choosingThwartStat");
    expect(controller.thwartStatChoice()!.options.map((option) => option.useAtk)).toEqual([false, true]);
    expect(controller.focusOrder().map((target) => target.kind)).toEqual(["card", "cancel"]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("ATK sends the thwart with useAtk", async () => {
    const controller = new BoardController(host());
    const before = store.state.game!.instances[redHouse]!.threat;
    aimThwart(controller);
    const atk = Number(controller.thwartStatChoice()!.options[1]!.label.replace("ATK ", ""));
    await controller.chooseThwartStat(true);
    const sent = dispatch.mock.calls[0]![0] as Extract<Command, { type: "basicThwart" }>;
    expect(sent).toMatchObject({ type: "basicThwart", schemeInstanceId: redHouse, useAtk: true });
    // The thwart removed ATK worth of threat, not THW.
    expect(store.state.game!.instances[redHouse]?.threat ?? 0).toBe(Math.max(0, before - atk));
  });

  test("THW sends the thwart without useAtk", async () => {
    const controller = new BoardController(host());
    aimThwart(controller);
    await controller.chooseThwartStat(false);
    const plain = dispatch.mock.calls[0]![0] as Extract<Command, { type: "basicThwart" }>;
    expect(plain.schemeInstanceId).toBe(redHouse);
    expect(plain.useAtk).toBeUndefined();
  });

  test("Cancel, or a second tap on the scheme, sends nothing", () => {
    const controller = new BoardController(host());
    aimThwart(controller);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    aimThwart(controller);
    expect(controller.tapInMode(redHouse)).toBe(true);
    expect(controller.selection.kind).toBe("idle");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
