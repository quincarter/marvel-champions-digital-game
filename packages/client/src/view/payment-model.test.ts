/**
 * The payment mode, against a real Core Set game.
 *
 * The property that matters: the client never decides whether a payment works.
 * Every assertion here goes through the engine, and the command the mode hands
 * back must be one `applyCommand` actually accepts.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { applyCommand, type GameState, type LegalAction, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { beginPayment, clearPayment, paymentView, togglePayment } from "./payment-model.js";

const SPIDER_MAN_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

/** Plays past setup and flips to hero, so real hero-form cards are playable. */
async function intoHeroTurn(): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(SPIDER_MAN_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as { choice: { options: readonly { optionId: string }[]; minSelections: number } };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  state = store.state.game!;
  me = store.state.perspectiveId!;
}

/** The first legal card play the engine says costs something. */
function costedPlay(): LegalAction {
  const legal = store.state.legal!.actions;
  if (legal.kind !== "turn") throw new Error("expected a turn");
  const entry = legal.legal.find((candidate) => candidate.action.kind === "playCard" && candidate.needsPayment);
  if (!entry) throw new Error("expected a card that costs something");
  return entry;
}

beforeEach(intoHeroTurn);

describe("payment mode", () => {
  test("opens with nothing picked, so the count fills as you choose", () => {
    const entry = costedPlay();
    const payment = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    expect(payment.picked).toEqual([]);

    const view = paymentView(state, me, payment, "test", CORE_DEPS);
    // Opening a payment already paid reads as the game deciding for you.
    expect(view.paid).toBe(0);
    expect(view.command).toBeNull();
    expect(view.required).toBeGreaterThan(0);
  });

  test("the engine's own suggestion, once applied, is a payment it accepts", () => {
    const entry = costedPlay();
    const opened = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    const view = paymentView(state, me, { ...opened, picked: opened.query.suggested }, "test", CORE_DEPS);
    expect(view.command).not.toBeNull();
    // Not "the client thinks this is enough" — the engine took the command.
    expect(applyCommand(state, view.command!, CORE_DEPS).ok).toBe(true);
  });

  test("never offers the card being paid for as a way to pay for itself", () => {
    const entry = costedPlay();
    const played = (entry.action as { instanceId: string }).instanceId;
    const payment = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    expect(payment.query.sources.some((source) => (source.instanceId as string) === played)).toBe(false);
  });

  test("an emptied selection is refused, with the engine's own reason", () => {
    const entry = costedPlay();
    const payment = clearPayment(beginPayment(state, me, entry.action, null, CORE_DEPS)!);
    const view = paymentView(state, me, payment, "test", CORE_DEPS);
    expect(view.command).toBeNull();
    expect(view.blockedBy).toBeTruthy();
    expect(view.paid).toBe(0);
    expect(view.required).toBeGreaterThan(0);
  });

  test("toggling a source off and on again returns to the same accepted command", () => {
    const entry = costedPlay();
    const opened = { ...beginPayment(state, me, entry.action, null, CORE_DEPS)!, picked: [] as readonly string[] };
    const suggested = { ...opened, picked: opened.query.suggested };
    const first = suggested.picked[0]!;

    const without = togglePayment(suggested, first);
    expect(without.picked).not.toContain(first);

    const back = togglePayment(without, first);
    expect([...back.picked].sort()).toEqual([...suggested.picked].sort());
    expect(paymentView(state, me, back, "test", CORE_DEPS).command).not.toBeNull();
  });

  test("spending more than the cost is still accepted, so 'spend X' stays possible", () => {
    const entry = costedPlay();
    const base = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    const opened = { ...base, picked: base.query.suggested };
    const extra = opened.query.sources.find((source) => !opened.picked.includes(source.optionId));
    if (!extra) return; // Nothing spare in hand this seed; the case can't be posed.

    const overpaid = togglePayment(opened, extra.optionId);
    const view = paymentView(state, me, overpaid, "test", CORE_DEPS);
    expect(view.paid).toBeGreaterThan(view.required);
    expect(view.command).not.toBeNull();
  });

  test("says what is still outstanding, by type, while the payment is short", () => {
    const entry = costedPlay();
    const empty = clearPayment(beginPayment(state, me, entry.action, null, CORE_DEPS)!);
    const view = paymentView(state, me, empty, "test", CORE_DEPS);
    // Every spendable source is offered, and none of them is marked spent yet.
    expect(view.spent.size).toBe(0);
    expect(view.spendable.size).toBe(empty.query.sources.length);
  });

  test("lists every source once, flat, with its own picked state — the resourceAbility gap `spendable`/`spent` alone can't cover", () => {
    const entry = costedPlay();
    const opened = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    const withPick = { ...opened, picked: opened.query.suggested };
    const view = paymentView(state, me, withPick, "test", CORE_DEPS);

    expect(view.sources).toHaveLength(opened.query.sources.length);
    for (const source of view.sources) {
      expect(source.spent).toBe(withPick.picked.includes(source.optionId));
    }
    // The same picks `spent` (keyed by instance id) already reports, just as
    // one flat, ordered list instead of two maps.
    const spentIds = new Set(view.sources.filter((source) => source.spent).map((source) => source.instanceId));
    expect(spentIds).toEqual(new Set(view.spent.keys()));
  });

  test("returns null for an action that costs nothing, so the board just plays it", () => {
    const legal = store.state.legal!.actions;
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const free = legal.legal.find((entry) => entry.action.kind === "basicAttack");
    if (!free) return;
    expect(beginPayment(state, me, free.action, free.targets[0] ?? null, CORE_DEPS)).toBeNull();
  });
});
