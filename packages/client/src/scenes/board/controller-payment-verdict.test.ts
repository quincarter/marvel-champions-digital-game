/**
 * Paying on a host that judges off the main thread (issue #258): the board asks the host for each selection's verdict,
 * draws the picks at once, and Pay waits for the verdict of the picks on screen; a reply for older picks is never
 * sent. The host here is the in-thread one with its verdicts held back until the test releases them, the way the
 * worker's replies arrive later.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Command, InstanceId, LegalActions, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../../engine/local-host.js";
import type { EngineHost, SessionConfig } from "../../engine/host.js";
import { appSession } from "../../session.js";
import { defaultSettings } from "../../settings.js";
import { defaultGuidePrefs, withLevel } from "../../guide/guide-prefs.js";
import { resetGuidePrefsCacheForTests, setGuidePrefs } from "../../guide/guide-store.js";
import { SessionStore } from "../../store/session-store.js";
import type { Highlights } from "../../view/highlights.js";
import type { BoardModel } from "../../view/board-model.js";
import type { PaymentState } from "../../view/payment-model.js";
import type { JudgedPayment } from "../../view/payment-verdict.js";
import { BoardController, type BoardControllerHost } from "./controller.js";

class NoopWorker {
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = NoopWorker;

/** The in-thread host without its synchronous verdict, whose verdicts wait in `held` until released. */
class HeldVerdictHost implements EngineHost {
  readonly inner = new LocalEngineHost();
  readonly held: { readonly picked: readonly string[]; readonly release: () => void }[] = [];
  start = (config: SessionConfig) => this.inner.start(config);
  resume = (gameId: string) => this.inner.resume(gameId);
  dispatch = (command: Command) => this.inner.dispatch(command);
  rewindTo = (count: number) => this.inner.rewindTo(count);
  legalActions = (playerId: PlayerId): Promise<LegalActions> => this.inner.legalActions(playerId);
  subscribe = (listener: Parameters<EngineHost["subscribe"]>[0]) => this.inner.subscribe(listener);
  save = () => this.inner.save();
  latestSave = () => this.inner.latestSave();
  activeSaves = () => this.inner.activeSaves();
  retireSave = (gameId: string) => this.inner.retireSave(gameId);
  listSaves = () => this.inner.listSaves();
  dispose = () => this.inner.dispose();
  judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment> {
    // Judged when asked, as the worker does in its own queue; only the reply is held.
    const judged = this.inner.judgePaymentNow(playerId, payment);
    return new Promise((resolve) => this.held.push({ picked: payment.picked, release: () => resolve(judged) }));
  }
}

const SPIDER_MAN_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let host: HeldVerdictHost;
let store: SessionStore;
let dispatch: ReturnType<typeof vi.spyOn>;
let card: InstanceId;
let redraws: number;

const board = (): BoardControllerHost => ({
  model: (): BoardModel | null => ({ hand: [] }) as unknown as BoardModel,
  marks: (): Highlights | null => ({ playable: new Set([card]) }) as unknown as Highlights,
  tabbed: (): boolean => false,
  redraw: (): void => {
    redraws += 1;
  },
  inspect: vi.fn(),
  confirmEndTurn: vi.fn(),
  holdOn: vi.fn(),
});

/** Lets every settled promise run its continuations. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  host = new HeldVerdictHost();
  store = new SessionStore(host);
  await store.start(SPIDER_MAN_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  (appSession() as unknown as { store: SessionStore }).store = store;
  appSession().settings = defaultSettings();
  resetGuidePrefsCacheForTests();
  setGuidePrefs(withLevel(defaultGuidePrefs, "off"));
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find((candidate) => candidate.action.kind === "playCard" && candidate.needsPayment)!;
  card = (entry.action as { instanceId: InstanceId }).instanceId;
  dispatch = vi.spyOn(store, "dispatch");
  redraws = 0;
});

describe("paying with verdicts judged off the main thread", () => {
  test("the picks show at once, and the bar fills in when the verdict lands", async () => {
    const controller = new BoardController(board());
    await controller.playCard(card);
    expect(controller.selection.kind).toBe("paying");
    const first = controller.paymentView()!;
    expect(first).toMatchObject({ judging: true, command: null, payReady: false });
    // Asked once per selection, however often the board draws it.
    controller.paymentView();
    expect(host.held).toHaveLength(1);

    const pick = first.sources[0]!.optionId;
    controller.togglePaymentOption(pick);
    expect(controller.paymentView()!.sources.find((source) => source.optionId === pick)!.spent).toBe(true);
    expect(host.held).toHaveLength(2);

    host.held[1]!.release();
    await flush();
    expect(redraws).toBeGreaterThan(0);
    expect(controller.paymentView()!.judging).toBe(false);
    expect(host.held).toHaveLength(2);
  });

  test("Pay waits for the verdict of the picks on screen, never an older one", async () => {
    const controller = new BoardController(board());
    await controller.playCard(card);
    const suggested = (controller.selection as { payment: PaymentState }).payment.query.suggested;
    for (const option of suggested) {
      controller.togglePaymentOption(option);
      controller.paymentView();
    }
    const asked = host.held.length;
    expect(asked).toBe(suggested.length + 1);

    const paying = controller.commitPayment();
    // Every older selection's verdict lands first: none of them is sent.
    for (const held of host.held.slice(0, -1)) held.release();
    await flush();
    expect(dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("paying");

    host.held[asked - 1]!.release();
    await paying;
    expect(dispatch).toHaveBeenCalledTimes(1);
    const sent = dispatch.mock.calls[0]![0] as Extract<Command, { type: "playCard" }>;
    expect(sent.payment).toHaveLength(suggested.length);
    expect(controller.selection.kind).toBe("idle");
  });

  test("a second press while the first waits sends once; picks changed while waiting send nothing", async () => {
    const controller = new BoardController(board());
    await controller.playCard(card);
    const suggested = (controller.selection as { payment: PaymentState }).payment.query.suggested;
    for (const option of suggested) controller.togglePaymentOption(option);
    controller.paymentView();

    const first = controller.commitPayment();
    const second = controller.commitPayment();
    for (const held of host.held) held.release();
    await Promise.all([first, second]);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("picks changed while Pay waits are not sent", async () => {
    const controller = new BoardController(board());
    await controller.playCard(card);
    const suggested = (controller.selection as { payment: PaymentState }).payment.query.suggested;
    for (const option of suggested) controller.togglePaymentOption(option);
    controller.paymentView();

    const paying = controller.commitPayment();
    controller.togglePaymentOption(suggested[0]!);
    controller.paymentView();
    for (const held of host.held) held.release();
    await paying;
    expect(dispatch).not.toHaveBeenCalled();
    expect(controller.selection.kind).toBe("paying");
  });
});
