/**
 * The pad route through a decision's mode bar (`BoardController.focusOrder`, `activate`): the bar's buttons come after
 * the cards and before Cancel, Cancel appears once, the music note ends the idle route, and Enter on each does its job.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { LocalEngineHost } from "../../engine/local-host.js";
import type { SessionConfig } from "../../engine/host.js";
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

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

let store: SessionStore;
let controller: BoardController;

let playable = new Set<string>();
let bar = { count: 2, cancel: true };
let music = true;
const pressed: number[] = [];
const openMusic = vi.fn();
const host = (): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable, usableAbilities: new Set(), basics: [] }) as unknown as Highlights,
  barStops: () => bar,
  pressBarStop: (index) => void pressed.push(index),
  hasMusicStop: () => music,
  openMusic,
  tabbed: (): boolean => false,
  redraw: (): void => {},
  inspect: vi.fn(),
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

async function toFirstTurn(): Promise<void> {
  for (let guard = 0; guard < 50; guard += 1) {
    const legal = store.state.legal!.actions;
    if (legal.kind === "turn") return;
    if (legal.kind !== "choice") throw new Error(`unexpected legal kind ${legal.kind}`);
    await store.dispatch({
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId),
    });
  }
  throw new Error("never reached the hero's turn");
}

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  await toFirstTurn();
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  controller = new BoardController(host());
  bar = { count: 2, cancel: true };
  music = true;
  pressed.length = 0;
  openMusic.mockClear();
});

describe("the pad route through a mode bar", () => {
  test("an idle table ends its route on the music note, and Enter on it opens the player", () => {
    const route = controller.focusOrder();
    expect(route.at(-1)).toEqual({ kind: "music" });
    controller.activate({ kind: "music" });
    expect(openMusic).toHaveBeenCalledTimes(1);
    music = false;
    expect(controller.focusOrder().some((target) => target.kind === "music")).toBe(false);
  });

  test("a payment's route is the sources, then the bar's buttons, then Cancel once", async () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected the hero's turn");
    const play = legal.legal.find((a) => a.action.kind === "playCard" && a.example.type === "playCard");
    if (play?.action.kind !== "playCard") throw new Error("a card to pay for");
    playable = new Set([play.action.instanceId]);
    await controller.playCard(play.action.instanceId);
    expect(controller.selection.kind).toBe("paying");
    const route = controller.focusOrder();
    const kinds = route.map((target) => target.kind);
    expect(kinds.slice(-3)).toEqual(["bar", "bar", "cancel"]);
    expect(kinds.filter((kind) => kind === "cancel")).toHaveLength(1);
    expect(kinds.indexOf("bar")).toBeGreaterThan(kinds.lastIndexOf("card"));
    controller.activate({ kind: "bar", index: 1 });
    expect(pressed).toEqual([1]);
    // A bar with no Cancel of its own adds none to a payment's route.
    bar = { count: 1, cancel: false };
    expect(controller.focusOrder().map((target) => target.kind)).not.toContain("cancel");
  });
});
