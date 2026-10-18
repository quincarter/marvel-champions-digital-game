/**
 * The pay step's verdict, judged apart from the bar (issue #258): `judgePayment` is the only engine call, the host
 * judges it against its own full state at the published version, and `paymentView` draws whatever verdict it is
 * handed, or a still-judging bar when it has none yet. Real Core Set game, as `payment-model.test.ts`.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { applyCommand, type GameState, type LegalAction, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { beginPayment, paymentView, type PaymentState } from "./payment-model.js";
import { judgePayment } from "./payment-verdict.js";

const SPIDER_MAN_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;
let payment: PaymentState;

beforeEach(async () => {
  store = new SessionStore(new LocalEngineHost());
  await store.start(SPIDER_MAN_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find(
    (candidate: LegalAction) => candidate.action.kind === "playCard" && candidate.needsPayment,
  );
  if (!entry) throw new Error("expected a card that costs something");
  payment = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
});

const enough = (): PaymentState => ({ ...payment, picked: payment.query.suggested });

describe("judgePayment", () => {
  test("accepts the engine's own suggestion with a command it applies, covered", () => {
    const verdict = judgePayment(state, me, enough(), CORE_DEPS);
    expect(verdict.covered).toBe(true);
    expect(verdict.blockedBy).toBeNull();
    expect(applyCommand(state, verdict.command!, CORE_DEPS).ok).toBe(true);
  });

  test("refuses nothing picked with the engine's reason", () => {
    const verdict = judgePayment(state, me, payment, CORE_DEPS);
    expect(verdict).toMatchObject({ command: null, covered: false });
    expect(verdict.blockedBy).toEqual(expect.any(String));
  });
});

describe("the host judges at the version it publishes", () => {
  test("the store's verdict matches the in-thread one, tagged with the current version", async () => {
    const judged = await store.judgePayment(me, enough());
    expect(judged.version).toBe(store.state.version);
    expect(judged.verdict).toEqual(judgePayment(state, me, enough(), CORE_DEPS));
    expect(store.judgePaymentNow(me, enough())).toEqual(judged);
  });
});

describe("paymentView draws the verdict it is handed", () => {
  test("still judging: nothing to send, and the bar reads as the verdict before", () => {
    const before = judgePayment(state, me, enough(), CORE_DEPS);
    const view = paymentView(state, me, enough(), "test", CORE_DEPS, null, before);
    expect(view).toMatchObject({ judging: true, command: null, blockedBy: null, payReady: true });
    // The pips count at once, without the engine.
    expect(view.paid).toBeGreaterThanOrEqual(view.required);
    const short = judgePayment(state, me, payment, CORE_DEPS);
    expect(paymentView(state, me, enough(), "test", CORE_DEPS, null, short)).toMatchObject({
      payReady: false,
      blockedBy: short.blockedBy,
      command: null,
    });
    expect(paymentView(state, me, enough(), "test", CORE_DEPS, null)).toMatchObject({
      payReady: false,
      blockedBy: null,
    });
  });

  test("a verdict passed in is the one drawn, not judged again", () => {
    const verdict = judgePayment(state, me, enough(), CORE_DEPS);
    const view = paymentView(state, me, payment, "test", CORE_DEPS, verdict);
    expect(view).toMatchObject({ judging: false, command: verdict.command, payReady: true });
  });
});
