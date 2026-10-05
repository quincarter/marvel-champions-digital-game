/**
 * Every way of playing a hand card asks which host first (RRG 1.8 "Cost", p. 13; Energy Transfer 38007's attach cost,
 * erratum p. 69). A tap or click, Inspect's "Play it" and the keyboard all reach `BoardController#playCard`; with two
 * legal hosts none of them sends the engine's example (the first host). The phone's sheet is the same targeting mode:
 * it names the card and the question, lists every host and sends nothing until one is picked and paid for.
 * Real content and a stub store over the real game, like `controller.test.ts`.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { EngineSessionCore } from "../../engine/session-core.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
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

class StubStore {
  state: { game: GameState; perspectiveId: PlayerId; legal: unknown; [key: string]: unknown };
  readonly dispatch = vi.fn(async (_command: Command) => {});
  constructor(state: StubStore["state"]) {
    this.state = state;
  }
}

let game: GameState;
let me: PlayerId;
let transfer: InstanceId;
let stub: StubStore;

/** Rogue (hero side) with Energy Transfer in hand beside Spider-Man, against Rhino: Rhino and Spider-Man can host Touched. */
async function rogueTurn(): Promise<void> {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "rogue-protection" }, { starterDeckId: "core-spider-man-justice" }],
    seed: 11,
  });
  let state = { ...started.snapshot.state, cardPool: started.cardPool } as GameState;
  const settle = (s: GameState): GameState => {
    let current = s;
    for (let guard = 0; guard < 40 && current.pendingChoice; guard++) {
      const choice = current.pendingChoice;
      const result = applyOrThrow(current, {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
      current = result;
    }
    return current;
  };
  state = settle(state);
  me = state.players[0]!.playerId;
  if (state.players[0]!.identity.form !== "hero") state = applyOrThrow(state, { type: "changeForm", playerId: me });
  const seat = state.players[0]!;
  const found = [...seat.deck, ...seat.hand, ...seat.discard].find((id) => state.instances[id]?.cardId === "38007");
  if (!found) throw new Error("no Energy Transfer in Rogue's deck");
  transfer = found;
  game = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === me
        ? {
            ...p,
            hand: [...p.hand.filter((id) => id !== transfer), transfer],
            deck: p.deck.filter((id) => id !== transfer),
            discard: p.discard.filter((id) => id !== transfer),
          }
        : p,
    ),
  };
}

import { applyCommand } from "@mc/engine";
function applyOrThrow(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

function host(
  tabbed: boolean,
): BoardControllerHost & { readonly inspect: ReturnType<typeof vi.fn<(id: InstanceId) => void>> } {
  return {
    model: (): BoardModel | null => null,
    marks: (): Highlights | null => ({ playable: new Set([transfer]) }) as unknown as Highlights,
    tabbed: (): boolean => tabbed,
    redraw: (): void => {},
    inspect: vi.fn<(id: InstanceId) => void>(),
    confirmEndTurn: vi.fn(),
    holdOn: vi.fn(),
  };
}

beforeEach(async () => {
  await rogueTurn();
  const actions = legalActions(game, me, POOL_DEPS);
  stub = new StubStore({ game, perspectiveId: me, legal: { playerId: me, actions } });
  (appSession() as unknown as { store: StubStore }).store = stub;
  // Guided mode's "Hold on!" is its own tested layer (`controller.test.ts`); here the payment goes straight through.
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
});

const hosts = (): readonly InstanceId[] => {
  const legal = legalActions(game, me, POOL_DEPS);
  if (legal.kind !== "turn") throw new Error("not a turn");
  return legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === transfer)!.targets;
};

describe("a hand play with several legal hosts asks which, however it was started", () => {
  const ways: [string, (controller: BoardController) => Promise<void> | void][] = [
    ["Inspect's Play it (the phone sheet, the desktop sheet)", (c) => c.playCard(transfer)],
    ["a tap or click on the card (desktop)", (c) => c.tapHandCard(transfer)],
    ["Enter on the focused card (keyboard)", (c) => c.playCard(transfer, { confirmFree: true })],
  ];

  test.each(ways)("%s", async (_name, start) => {
    const controller = new BoardController(host(false));
    expect(hosts().length).toBeGreaterThan(1);
    await start(controller);
    await Promise.resolve();

    // Nothing went to the engine, and the board is waiting on the host.
    expect(stub.dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("targeting");
    const panel = controller.targetingPanel();
    expect(panel?.options.map((o) => o.instanceId)).toEqual([...hosts()]);
    // The sheet says which card and what is being chosen.
    expect(panel?.source.label).toBe("Energy Transfer: choose the character it attaches to");
    expect(panel?.source.instanceId).toBe(transfer);
  });

  test("the picked host (not the first) is what is sent, and only after it is paid for", async () => {
    const controller = new BoardController(host(false));
    const [first, second] = hosts() as [InstanceId, InstanceId];
    await controller.playCard(transfer);
    expect(controller.tapInMode(second)).toBe(true);
    await Promise.resolve();
    expect(controller.selection.kind).toBe("paying");
    expect(stub.dispatch).not.toHaveBeenCalled();

    for (const source of controller.paymentView()!.sources) {
      if (controller.paymentView()!.command) break;
      controller.togglePaymentOption(source.optionId);
    }
    expect(controller.paymentView()!.command, "the payment covers the cost").not.toBeNull();
    await controller.commitPayment();
    expect(stub.dispatch).toHaveBeenCalledTimes(1);
    const sent = stub.dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>;
    expect(sent.costChoices?.host).toEqual([second]);
    expect(sent.costChoices?.host).not.toEqual([first]);
  });

  test("on the tabbed (phone) board a tap opens Inspect first, and its Play it asks the same question", async () => {
    const phone = host(true);
    const controller = new BoardController(phone);
    controller.tapHandCard(transfer);
    expect(phone.inspect).toHaveBeenCalledWith(transfer);
    expect(stub.dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("idle");
    // Inspect's footer emits `mc-play-card`, which the board hands to `playCard`.
    await controller.playCard(transfer);
    expect(controller.selection.kind).toBe("targeting");
    expect(stub.dispatch).not.toHaveBeenCalled();
  });
});
