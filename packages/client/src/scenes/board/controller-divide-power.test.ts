/**
 * Issue #322: Wasp's Giant face lets her divide her basic attack among enemies (13001c, "Damage dealt by your basic
 * attack power can be divided among enemies as you choose"; RRG 1.8 FAQ "Wasp (#1C)", p. 61), but the board only ever
 * asked for one target. Now the attack opens the divide picker: a tap places one point, Confirm sends the division.
 * Real content and a real session (`store/dev-giant-wasp-game.ts`), like `controller-in-play-cost.test.ts`.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, GameState, InstanceId } from "@mc/engine";
import { characterProfile } from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { LocalEngineHost } from "../../engine/local-host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { nextTurn } from "../../store/dev-game-steps.js";
import {
  BREAKIN_AND_TAKIN,
  GIANT_WASP_THWART_DEV_CONFIG,
  giantWaspThwartReached,
  mercenaries,
  startGiantWaspDevGame,
} from "../../store/dev-giant-wasp-game.js";
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
let first: InstanceId;
let second: InstanceId;
let atk: number;

const game = (): GameState => store.state.game!;

const host = (): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable: new Set() }) as unknown as Highlights,
  tabbed: (): boolean => false,
  redraw: (): void => {},
  inspect: vi.fn(),
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

const sent = (): Extract<Command, { type: "basicAttack" }> =>
  dispatch.mock.calls[0]![0] as Extract<Command, { type: "basicAttack" }>;

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await startGiantWaspDevGame(store);
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  [first, second] = mercenaries(game()) as [InstanceId, InstanceId];
  atk = characterProfile(game(), game().players[0]!.identity.instanceId, POOL_DEPS)!.atk!;
  dispatch = vi.spyOn(store, "dispatch");
});

describe("Giant Wasp's attack can be divided among enemies (issue #322)", () => {
  test("Attack opens the divide picker over both Mercenaries; nothing is sent yet", () => {
    expect(atk).toBeGreaterThanOrEqual(2);
    const controller = new BoardController(host());
    controller.chooseBasic("attack");
    expect(controller.selection.kind).toBe("dividingPower");
    const panel = controller.targetingPanel()!;
    expect(panel.title).toBe(`Divide ${atk} damage`);
    expect(panel.options.map((option) => option.instanceId).sort()).toEqual([first, second].sort());
    expect(panel.multi).toMatchObject({ summary: `${atk} DAMAGE · ${atk} LEFT`, canConfirm: false });
    expect(controller.focusOrder().map((target) => target.kind)).toEqual(["card", "card", "confirm", "cancel"]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("one tap and Confirm is the ordinary attack, all of it on that enemy", async () => {
    const controller = new BoardController(host());
    controller.chooseBasic("attack");
    expect(controller.tapInMode(second)).toBe(true);
    expect(controller.targetingPanel()!.multi).toMatchObject({
      canConfirm: true,
      preview: expect.stringMatching(/^All /),
    });
    await controller.confirmPick();
    expect(sent()).toMatchObject({ type: "basicAttack", targetInstanceId: second });
    expect(sent().divide).toBeUndefined();
  });

  test("points placed on both enemies are sent as the division, in the order tapped, once every point is placed", async () => {
    const controller = new BoardController(host());
    controller.chooseBasic("attack");
    controller.tapInMode(second);
    controller.tapInMode(first);
    for (let point = 2; point < atk; point++) controller.tapInMode(second);
    expect(controller.targetingPanel()!.multi).toMatchObject({ summary: `${atk} DAMAGE · 0 LEFT`, canConfirm: true });
    // Every point is placed: a tap now takes one back off that enemy. One enemy holding points is the ordinary attack.
    controller.tapInMode(first);
    expect(controller.targetingPanel()!.multi).toMatchObject({ canConfirm: true });
    expect(controller.selection.kind === "dividingPower" && controller.selection.choice.shares).toEqual([
      { targetInstanceId: second, amount: atk - 1 },
    ]);
    controller.tapInMode(first);
    await controller.confirmPick();
    expect(sent()).toMatchObject({
      type: "basicAttack",
      targetInstanceId: second,
      divide: [
        { targetInstanceId: second, amount: atk - 1 },
        { targetInstanceId: first, amount: 1 },
      ],
    });
    // The engine took it (an interrupt window, Rapid Growth, is passed): each Mercenary (3 HP) took its own share.
    await nextTurn(store);
    expect(store.state.error ?? null).toBeNull();
    expect(atk - 1).toBeLessThan(3);
    expect(game().instances[first]!.damage).toBe(1);
    expect(game().instances[second]!.damage).toBe(atk - 1);
  });
});

describe("Giant Wasp's thwart can be divided among schemes", () => {
  test("points placed on Breakin' & Takin' and the main scheme are sent as one divided basic thwart", async () => {
    store = new SessionStore(new LocalEngineHost());
    await startGiantWaspDevGame(store, GIANT_WASP_THWART_DEV_CONFIG, giantWaspThwartReached);
    (appSession() as unknown as { store: SessionStore }).store = store;
    dispatch = vi.spyOn(store, "dispatch");
    const state = game();
    const main = state.mainScheme.instanceId;
    const side = state.villainArea.find((id) => (state.instances[id]!.cardId as string) === BREAKIN_AND_TAKIN)!;
    const thw = characterProfile(state, state.players[0]!.identity.instanceId, POOL_DEPS)!.thw!;
    const threat = (id: InstanceId): number => game().instances[id]!.threat;
    const [mainBefore, sideBefore] = [threat(main), threat(side)];

    const controller = new BoardController(host());
    controller.chooseBasic("thwart");
    expect(controller.selection.kind).toBe("dividingPower");
    expect(controller.targetingPanel()!.title).toBe(`Divide ${thw} threat`);
    controller.tapInMode(side);
    for (let point = 1; point < thw; point++) controller.tapInMode(main);
    await controller.confirmPick();
    const command = dispatch.mock.calls[0]![0] as Extract<Command, { type: "basicThwart" }>;
    expect(command).toMatchObject({
      type: "basicThwart",
      schemeInstanceId: side,
      divide: [
        { targetInstanceId: side, amount: 1 },
        { targetInstanceId: main, amount: thw - 1 },
      ],
    });
    await nextTurn(store);
    expect(store.state.error ?? null).toBeNull();
    expect(threat(side)).toBe(sideBefore - 1);
    expect(threat(main)).toBe(Math.max(0, mainBefore - (thw - 1)));
  });
});
