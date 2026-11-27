/**
 * Make the Call (01071) with a 0-cost ally picked (#1050). "Pay the printed cost of an ally in any player's discard
 * pile": the board lists the allies, the player selects one and confirms. A campaign ally of The Rise of Red Skull
 * (Moon Knight 04097) costs 0, so there is no pay step, and a tapped play asks "Play it?" first. That step used to keep
 * only the entry, so its yes sent `LegalAction.example`: the first ally the engine found (Hulk, cost 2, in the first
 * seat's discard) with hand cards it chose to pay for him. The play that skips the question kept the pick but sent the
 * example's payment with it. Both now send the picked ally with nothing spent.
 * Real content and a stub store over the real game, like `controller-play-aim.test.ts`.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CORE_CARDS, TRORS_CARDS, type AnyCard } from "@mc/content";
import { applyCommand, legalActions, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../../content/pool.js";
import { EngineSessionCore } from "../../engine/session-core.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import type { Highlights } from "../../view/highlights.js";
import type { BoardModel } from "../../view/board-model.js";
import type { PaymentState } from "../../view/payment-model.js";
import { judgePayment, type JudgedPayment } from "../../view/payment-verdict.js";
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
  judgePaymentNow(playerId: PlayerId, payment: PaymentState): JudgedPayment {
    return { version: 0, verdict: judgePayment(this.state.game, playerId, payment, POOL_DEPS) };
  }
  constructor(state: StubStore["state"]) {
    this.state = state;
  }
}

const MAKE_THE_CALL = "01071";
const HULK = "01050"; // ally, cost 2
const MOON_KNIGHT = "04097"; // The Rise of Red Skull campaign ally, cost 0

let game: GameState;
let me: PlayerId;
let call: InstanceId;
let hulk: InstanceId;
let moonKnight: InstanceId;
let stub: StubStore;

const cardOfId = (id: string): AnyCard => [...CORE_CARDS, ...TRORS_CARDS].find((card) => card.id === id)!;

function applyOrThrow(state: GameState, command: Command): GameState {
  const result = applyCommand(state, command, POOL_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
}

/**
 * Captain Marvel (Leadership) and Spider-Man against Rhino, on Captain Marvel's turn: Make the Call in her hand, Hulk
 * in her discard pile and Moon Knight in Spider-Man's, so the engine's first pick is Hulk and the player's is Moon Knight.
 */
async function leadershipTurn(): Promise<void> {
  const core = new EngineSessionCore();
  const started = await core.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-spider-man-justice" }],
    seed: 11,
  });
  let state = { ...started.snapshot.state, cardPool: started.cardPool } as GameState;
  for (let guard = 0; guard < 40 && state.pendingChoice; guard++) {
    const choice = state.pendingChoice;
    state = applyOrThrow(state, {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
    });
  }
  const [first, second] = state.players as [GameState["players"][number], GameState["players"][number]];
  me = first.playerId;
  // Three deck cards stand in for the three this needs, so every instance stays the engine's own.
  [call, hulk] = first.deck.slice(0, 2) as [InstanceId, InstanceId];
  moonKnight = second.deck[0]!;
  const recast = (id: InstanceId, cardId: string) => ({ ...state.instances[id]!, cardId: cardId as never });
  game = {
    ...state,
    cardPool: { ...state.cardPool, [HULK]: cardOfId(HULK), [MOON_KNIGHT]: cardOfId(MOON_KNIGHT) },
    instances: {
      ...state.instances,
      [call]: recast(call, MAKE_THE_CALL),
      [hulk]: recast(hulk, HULK),
      [moonKnight]: recast(moonKnight, MOON_KNIGHT),
    },
    players: state.players.map((p) =>
      p.playerId === me
        ? { ...p, hand: [...p.hand, call], deck: p.deck.slice(2), discard: [hulk] }
        : { ...p, deck: p.deck.slice(1), discard: [moonKnight] },
    ),
  };
}

function host(): BoardControllerHost {
  return {
    model: (): BoardModel | null => null,
    marks: (): Highlights | null => ({ playable: new Set([call]) }) as unknown as Highlights,
    tabbed: (): boolean => false,
    redraw: (): void => {},
    inspect: vi.fn<(id: InstanceId) => void>(),
    confirmEndTurn: vi.fn(),
    holdOn: vi.fn(),
  };
}

beforeEach(async () => {
  await leadershipTurn();
  const actions = legalActions(game, me, POOL_DEPS);
  stub = new StubStore({ game, perspectiveId: me, legal: { playerId: me, actions }, peekSeat: null });
  (appSession() as unknown as { store: StubStore }).store = stub;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
});

/** Selects Moon Knight in Make the Call's list and confirms it. */
async function pickMoonKnight(controller: BoardController, start: Promise<void>): Promise<void> {
  await start;
  expect(controller.selection.kind).toBe("choosingSearched");
  const options = controller.searchedPick()!.options;
  expect(options.find((o) => o.instanceId === hulk)?.available).toBe(true);
  expect(options.find((o) => o.instanceId === moonKnight)?.available).toBe(true);
  await controller.chooseSearched(moonKnight);
  await controller.confirmSearched();
}

function expectMoonKnightForFree(): void {
  expect(stub.dispatch).toHaveBeenCalledTimes(1);
  const sent = stub.dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>;
  expect(sent.cardInstanceId).toBe(call);
  expect(Object.values(sent.costChoices ?? {}).flat()).toContain(moonKnight);
  expect(Object.values(sent.costChoices ?? {}).flat()).not.toContain(hulk);
  expect(sent.payment).toEqual([]);
  // The engine takes it, and Moon Knight is the ally that enters play.
  const after = applyOrThrow(game, sent);
  expect(after.players[0]!.playArea).toContain(moonKnight);
  expect(after.players[0]!.playArea).not.toContain(hulk);
}

describe("01071 Make the Call with a 0-cost ally picked (#1050)", () => {
  test("the engine's first pick is Hulk, the one the bug sent", () => {
    const legal = legalActions(game, me, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("not a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === call)!;
    expect(entry.targets).toEqual([hulk, moonKnight]);
    expect(entry.example.type === "playCard" && entry.example.payment.length).toBeGreaterThan(0);
  });

  test("a tap asks Play it?, and its yes sends the picked ally with nothing paid", async () => {
    const controller = new BoardController(host());
    await pickMoonKnight(controller, controller.playCard(call, { confirmFree: true }));
    expect(controller.selection.kind).toBe("confirmingPlay");
    expect(stub.dispatch).not.toHaveBeenCalled();
    await controller.confirmPlay();
    expectMoonKnightForFree();
  });

  test("a play that skips the question sends the picked ally with nothing paid", async () => {
    const controller = new BoardController(host());
    await pickMoonKnight(controller, controller.playCard(call));
    expectMoonKnightForFree();
  });
});
