/**
 * Direct picks (`view/pick-assign.ts`): while a thwart waits on its scheme, the controller offers the targeting panel's
 * tiles as the candidates a button or a digit picks, pages them, and answers a pick as a tap on the tile would.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { InstanceId } from "@mc/engine";
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

async function settle(): Promise<void> {
  for (let step = 0; step < 40; step++) {
    const pending = store.state.legal;
    if (!pending || pending.actions.kind !== "choice") break;
    const { choice } = pending.actions;
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
}

const turnEntries = () => (store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : []);

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "red-skull",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
  });
  await settle();
  const flip = turnEntries().find((entry) => entry.action.kind === "changeForm");
  if (flip) await store.dispatch(flip.example);
  await settle();
  // One round on: the villain phase put threat on the main scheme, so a thwart has two schemes to choose between.
  const end = turnEntries().find((entry) => entry.action.kind === "endTurn");
  await store.dispatch(end!.example);
  await settle();
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
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

describe("direct picks", () => {
  test("offers nothing while idle", () => {
    const controller = new BoardController(host());
    expect(controller.pickIds()).toBeNull();
    expect(controller.pickByIndex(0)).toBe(false);
  });

  test("a thwart with two schemes offers the targeting panel's tiles, in the order they are drawn", () => {
    const controller = new BoardController(host());
    const targets = turnEntries().find((entry) => entry.action.kind === "basicThwart")?.targets ?? [];
    expect(targets.length).toBeGreaterThan(1);
    controller.chooseBasic("thwart");
    expect(controller.selection.kind).toBe("targeting");
    expect(controller.pickIds()).toEqual(controller.targetingPanel()!.options.map((option) => option.instanceId));
    expect([...controller.pickIds()!].sort()).toEqual([...targets].sort());
  });

  test("picking a candidate answers the target, as a tap on its tile does", async () => {
    const controller = new BoardController(host());
    const dispatch = vi.spyOn(store, "dispatch");
    controller.chooseBasic("thwart");
    const ids = controller.pickIds()!;
    // The Red House asks THW or ATK first (issue #365); any other scheme is thwarted straight away.
    const index = ids.findIndex((id) => store.state.game!.instances[id]?.cardId !== "04139");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(controller.pickByIndex(index)).toBe(true);
    await vi.waitFor(() => expect(dispatch).toHaveBeenCalled());
    const sent = dispatch.mock.calls[0]![0];
    expect(sent.type).toBe("basicThwart");
    expect((sent as { schemeInstanceId: InstanceId }).schemeInstanceId).toBe(ids[index]);
    expect(controller.selection.kind).toBe("idle");
  });

  test("a pick past the candidates there are does nothing, and paging stays on one page when everything fits", () => {
    const controller = new BoardController(host());
    controller.chooseBasic("thwart");
    const count = controller.pickIds()!.length;
    expect(controller.pickByIndex(count)).toBe(false);
    expect(controller.selection.kind).toBe("targeting");
    expect(controller.pagePicks(1, count)).toBe(false);
    expect(controller.pickOffset()).toBe(0);
  });

  test("pages through more candidates than a page of slots holds, cycling, and starts over with a new list", () => {
    const controller = new BoardController(host());
    controller.chooseBasic("thwart");
    const count = controller.pickIds()!.length;
    // A page of one slot: each press moves one candidate on, and the last page's next is the first.
    for (let step = 1; step < count; step++) {
      expect(controller.pagePicks(1, 1)).toBe(true);
      expect(controller.pickOffset()).toBe(step);
    }
    expect(controller.pagePicks(1, 1)).toBe(true);
    expect(controller.pickOffset()).toBe(0);
    expect(controller.pagePicks(-1, 1)).toBe(true);
    expect(controller.pickOffset()).toBe(count - 1);
    controller.cancel();
    expect(controller.pickIds()).toBeNull();
    controller.chooseBasic("thwart");
    expect(controller.pickOffset()).toBe(0);
  });
});
