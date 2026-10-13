/**
 * Undo on the board (`BoardController.undo`, `undoOffer`, `undoWhy`): refused while any selection is open (Escape
 * closes the selection and only that), says why when pressed greyed, says what it undid, and takes one move per
 * deliberate press (the v0.20.0 QA's F2, F3, F8).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import type { SessionConfig } from "../../engine/host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { SessionStore } from "../../store/session-store.js";
import { UNDO_REASONS } from "../../view/undo.js";
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
const host = (): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable }) as unknown as Highlights,
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

const flip = (): Command => {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected the hero's turn");
  return legal.legal.find((a) => a.action.kind === "changeForm")!.example;
};

/** A second plain move after the flip: Spider-Man's basic attack. */
const power = (): Command => {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected the hero's turn");
  return legal.legal.find((a) => a.action.kind === "basicAttack")!.example;
};

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  await toFirstTurn();
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  controller = new BoardController(host());
});

describe("Undo and open selections (F2)", () => {
  test("with a selection open Undo is greyed with the reason and a press takes nothing back", async () => {
    expect(await store.dispatch(flip())).toBe(true);
    expect(controller.undoOffer()).toMatchObject({ kind: "available" });
    const version = store.state.version;
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected the hero's turn");
    const play = legal.legal.find(
      (a) => a.action.kind === "playCard" && a.example.type === "playCard" && a.example.payment.length > 1,
    );
    if (play?.action.kind !== "playCard") throw new Error("a card to pay for");
    playable = new Set([play.action.instanceId]);
    await controller.playCard(play.action.instanceId);
    expect(controller.selection.kind).not.toBe("idle");
    expect(controller.undoOffer()).toEqual({ kind: "unavailable", reason: UNDO_REASONS.selecting });
    await controller.undo();
    expect(store.state.version).toBe(version);
    expect(controller.selection.kind).not.toBe("idle");
    expect(controller.undoWhy()).toBe(UNDO_REASONS.selecting);
    controller.dispose();
    // Escape's own route closes the selection and only that; Undo is offered again.
    controller.cancel();
    expect(controller.undoOffer()).toMatchObject({ kind: "available" });
    expect(store.state.version).toBe(version);
  });
});

describe("Undo says why it is greyed (F3)", () => {
  test("hover and focus show the reason; leaving hides it", () => {
    expect(controller.undoOffer()).toEqual({ kind: "unavailable", reason: UNDO_REASONS.nothing });
    expect(controller.undoWhy()).toBeNull();
    controller.setUndoHover(true);
    expect(controller.undoWhy()).toBe(UNDO_REASONS.nothing);
    controller.setUndoHover(false);
    controller.setUndoFocus(true);
    expect(controller.undoWhy()).toBe(UNDO_REASONS.nothing);
    controller.setUndoFocus(false);
    expect(controller.undoWhy()).toBeNull();
  });

  test("a press (or Z) on a greyed Undo says why, then the notice fades", async () => {
    vi.useFakeTimers();
    try {
      await controller.undo();
      expect(controller.undoWhy()).toBe(UNDO_REASONS.nothing);
      vi.advanceTimersByTime(4000);
      expect(controller.undoWhy()).toBeNull();
    } finally {
      controller.dispose();
      vi.useRealTimers();
    }
  });
});

describe("Undo takes one move per press and says what it undid (F8)", () => {
  test("two presses at once take back one move, and the notice names it", async () => {
    expect(await store.dispatch(flip())).toBe(true);
    expect(await store.dispatch(power())).toBe(true);
    const version = store.state.version;
    await Promise.all([controller.undo(), controller.undo()]);
    expect(store.state.version).toBe(version - 1);
    expect(controller.undoWhy()).toMatch(/^Undid: /);
    controller.dispose();
  });

  test("a press right after an undo is ignored; a deliberate one later takes the next move", async () => {
    expect(await store.dispatch(flip())).toBe(true);
    expect(await store.dispatch(power())).toBe(true);
    const version = store.state.version;
    await controller.undo();
    await controller.undo();
    expect(store.state.version).toBe(version - 1);
    await new Promise((r) => setTimeout(r, 400));
    await controller.undo();
    expect(store.state.version).toBe(version - 2);
    controller.dispose();
  });
});
