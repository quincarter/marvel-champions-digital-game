/**
 * Make the Call (01071) with a 0-cost ally picked (#1050). "Pay the printed cost of an ally in any player's discard
 * pile": the board lists the allies, the player selects one and confirms. A campaign ally of The Rise of Red Skull
 * (Moon Knight 04097) costs 0, so there is no pay step, and a tapped play asks "Play it?" first. That step used to keep
 * only the entry, so its yes sent `LegalAction.example`: the first ally the engine found (Hulk, cost 2, in the first
 * seat's discard) with hand cards it chose to pay for him. The play that skips the question kept the pick but sent the
 * example's payment with it. Both now send the picked ally with nothing spent, and the mirror case (the free ally
 * found first, a paid one picked) opens the pay step for the paid one instead of sending a refused free play.
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
  readonly advise = vi.fn((_message: string) => {});
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

/** Which ally the engine finds first: the one in Captain Marvel's discard pile (the first seat's). */
type Order = "paidFirst" | "freeFirst";

/**
 * Captain Marvel (Leadership) and Spider-Man against Rhino, on Captain Marvel's turn, with Make the Call in her hand.
 * `paidFirst`: Hulk in her discard pile and Moon Knight in Spider-Man's (the report's order, the engine's first pick is
 * Hulk); `freeFirst`: the other way round.
 */
async function leadershipTurn(order: Order): Promise<void> {
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
  const mine = first.deck.slice(0, 2) as [InstanceId, InstanceId];
  const theirs = second.deck[0]!;
  call = mine[0];
  [hulk, moonKnight] = order === "paidFirst" ? [mine[1], theirs] : [theirs, mine[1]];
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
        ? { ...p, hand: [...p.hand, call], deck: p.deck.slice(2), discard: [mine[1]] }
        : { ...p, deck: p.deck.slice(1), discard: [theirs] },
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

async function setUp(order: Order): Promise<void> {
  await leadershipTurn(order);
  const actions = legalActions(game, me, POOL_DEPS);
  stub = new StubStore({ game, perspectiveId: me, legal: { playerId: me, actions }, peekSeat: null });
  (appSession() as unknown as { store: StubStore }).store = stub;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
}

/** The ways a player starts the play: a bare tap (asks "Play it?" when free) and Inspect's Play it. */
const WAYS: [string, boolean][] = [
  ["a tap (Play it? when free)", true],
  ["Inspect's Play it", false],
];

/** Opens Make the Call's list, selects `ally` and confirms it. */
async function pick(controller: BoardController, confirmFree: boolean, ally: InstanceId): Promise<void> {
  await controller.playCard(call, { confirmFree });
  expect(controller.selection.kind).toBe("choosingSearched");
  const options = controller.searchedPick()!.options;
  expect(options.find((o) => o.instanceId === hulk)?.available).toBe(true);
  expect(options.find((o) => o.instanceId === moonKnight)?.available).toBe(true);
  await controller.chooseSearched(ally);
  await controller.confirmSearched();
}

const seatOf = (state: GameState, playerId: PlayerId) => state.players.find((p) => p.playerId === playerId)!;
const ownerOf = (id: InstanceId) => game.instances[id]!.ownerId!;

/** The one command sent: Make the Call aimed at `ally`, checked against what the engine does with it. */
function expectSent(ally: InstanceId, other: InstanceId): Extract<Command, { type: "playCard" }> {
  expect(stub.dispatch).toHaveBeenCalledTimes(1);
  const sent = stub.dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>;
  expect(sent.cardInstanceId).toBe(call);
  expect(Object.values(sent.costChoices ?? {}).flat()).toContain(ally);
  expect(Object.values(sent.costChoices ?? {}).flat()).not.toContain(other);
  const after = applyOrThrow(game, sent);
  // The picked ally left its owner's discard pile for Captain Marvel's play area; the other stayed where it was.
  expect(seatOf(after, me).playArea).toContain(ally);
  expect(seatOf(after, me).playArea).not.toContain(other);
  expect(seatOf(after, ownerOf(ally)).discard).not.toContain(ally);
  expect(seatOf(after, ownerOf(other)).discard).toContain(other);
  // Only Make the Call and the cards the payment names left her hand.
  const spent = sent.payment.flatMap((entry) => ("fromHand" in entry ? [entry.fromHand] : []));
  const kept = seatOf(game, me).hand.filter((id) => id !== call && !spent.includes(id));
  expect([...seatOf(after, me).hand].sort()).toEqual([...kept].sort());
  return sent;
}

describe("01071 Make the Call, Hulk found first: picking the 0-cost ally (#1050)", () => {
  beforeEach(() => setUp("paidFirst"));

  test("the engine's first pick is Hulk, with a payment: the one the bug sent", () => {
    const legal = legalActions(game, me, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("not a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === call)!;
    expect(entry.targets).toEqual([hulk, moonKnight]);
    expect(entry.example.type === "playCard" && entry.example.payment.length).toBeGreaterThan(0);
  });

  test.each(WAYS)("%s sends Moon Knight with nothing paid", async (_name, confirmFree) => {
    const controller = new BoardController(host());
    await pick(controller, confirmFree, moonKnight);
    if (confirmFree) {
      expect(controller.selection.kind).toBe("confirmingPlay");
      expect(stub.dispatch).not.toHaveBeenCalled();
      await controller.confirmPlay();
    }
    expect(expectSent(moonKnight, hulk).payment).toEqual([]);
  });

  test("a pick the engine refuses with nothing paid sends nothing, and says why", async () => {
    const controller = new BoardController(host());
    await controller.playCard(call);
    await controller.chooseSearched(moonKnight);
    // Moon Knight leaves Spider-Man's discard pile while the list is open, so the pick is no longer one the engine takes.
    stub.state = {
      ...stub.state,
      game: {
        ...game,
        players: game.players.map((p) => ({ ...p, discard: p.discard.filter((id) => id !== moonKnight) })),
      },
    };
    await controller.confirmSearched();
    expect(stub.dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("idle");
    expect(stub.advise).toHaveBeenCalledTimes(1);
    expect(stub.advise.mock.calls[0]![0]).toMatch(/\S/);
  });

  test("backing out of Play it? or of the list sends nothing", async () => {
    const controller = new BoardController(host());
    await pick(controller, true, moonKnight);
    expect(controller.selection.kind).toBe("confirmingPlay");
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    await controller.playCard(call, { confirmFree: true });
    await controller.chooseSearched(moonKnight);
    controller.cancel();
    expect(controller.selection.kind).toBe("idle");
    expect(stub.dispatch).not.toHaveBeenCalled();
  });
});

/** Picks hand cards in the pay step until it covers the cost, then pays. */
async function payFor(controller: BoardController): Promise<void> {
  expect(controller.selection.kind).toBe("paying");
  expect(stub.dispatch).not.toHaveBeenCalled();
  for (const source of controller.paymentView()!.sources) {
    if (controller.paymentView()!.command) break;
    controller.togglePaymentOption(source.optionId);
  }
  expect(controller.paymentView()!.command, "the payment covers Hulk's cost").not.toBeNull();
  await controller.commitPayment();
}

describe("01071 Make the Call, Moon Knight found first: picking Hulk (the mirror of #1050)", () => {
  beforeEach(() => setUp("freeFirst"));

  test("the engine's first pick is the free ally, so its entry says nothing to pay", () => {
    const legal = legalActions(game, me, POOL_DEPS);
    if (legal.kind !== "turn") throw new Error("not a turn");
    const entry = legal.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === call)!;
    expect(entry.targets).toEqual([moonKnight, hulk]);
    expect(entry.needsPayment).toBe(false);
  });

  test.each(WAYS)("%s opens the pay step for Hulk and sends what the player paid", async (_name, confirmFree) => {
    const controller = new BoardController(host());
    await pick(controller, confirmFree, hulk);
    await payFor(controller);
    expect(expectSent(hulk, moonKnight).payment.length).toBeGreaterThan(0);
  });

  test.each(WAYS)("%s still plays Moon Knight for free", async (_name, confirmFree) => {
    const controller = new BoardController(host());
    await pick(controller, confirmFree, moonKnight);
    if (confirmFree) await controller.confirmPlay();
    expect(expectSent(moonKnight, hulk).payment).toEqual([]);
  });
});
