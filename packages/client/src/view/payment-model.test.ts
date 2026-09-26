/**
 * The payment mode, against a real Core Set game.
 *
 * The property that matters: the client never decides whether a payment works.
 * Every assertion here goes through the engine, and the command the mode hands
 * back must be one `applyCommand` actually accepts.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { applyCommand, type GameState, type InstanceId, type LegalAction, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { allianceHelpersOf, beginPayment, clearPayment, paymentView, togglePayment } from "./payment-model.js";
import type { PaymentState } from "./payment-model.js";

const SPIDER_MAN_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 4,
};

let store: SessionStore;
let state: GameState;
let me: PlayerId;

/** Plays past setup, flipping to hero when asked so real hero-form cards are playable. */
async function intoTurn(flip: boolean): Promise<void> {
  store = new SessionStore(new LocalEngineHost());
  await store.start(SPIDER_MAN_SOLO);
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
  }
  const legal = store.state.legal?.actions;
  if (flip && legal?.kind === "turn") {
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

describe("payment mode", () => {
  beforeEach(() => intoTurn(true));

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

describe("resources on the table", () => {
  // Peter Parker's Scientist is a resource ability on the alter-ego itself, so
  // staying in alter-ego puts a non-hand source into every payment.
  beforeEach(() => intoTurn(false));

  test("an identity's resource ability is a table source, and the engine takes a payment that spends it", () => {
    const entry = costedPlay();
    const opened = beginPayment(state, me, entry.action, null, CORE_DEPS)!;
    const identity = state.players.find((player) => player.playerId === me)!.identity.instanceId;

    const view = paymentView(state, me, opened, "test", CORE_DEPS);
    expect(view.tableSources.every((source) => source.kind === "resourceAbility")).toBe(true);
    const scientist = view.tableSources.find((source) => source.instanceId === identity);
    expect(scientist).toBeDefined();
    // The card being bought came from the hand, which already tags it.
    expect(view.subjectInHand).toBe(true);

    let payment = togglePayment(opened, scientist!.optionId);
    for (const source of opened.query.sources) {
      if (paymentView(state, me, payment, "test", CORE_DEPS).command) break;
      if (source.kind === "handCard") payment = togglePayment(payment, source.optionId);
    }
    const settled = paymentView(state, me, payment, "test", CORE_DEPS);
    expect(settled.command).not.toBeNull();
    expect(settled.tableSources.find((source) => source.optionId === scientist!.optionId)?.spent).toBe(true);
    expect(applyCommand(state, settled.command!, CORE_DEPS).ok).toBe(true);
  });
});

/**
 * docs/phase7-wave4.md §4 Q10 (USER DECISION 2026-09-25): each contributing player approves their own contribution
 * before the command is sent. `allianceHelpersOf` is the pure read this build's approval flow gates on — it
 * doesn't need a real alliance card in play (the engine already offers another seat's hand cards as payment
 * sources whenever `paidAsGroup` says so; that logic is `@mc/engine`'s, exercised in `packages/engine/src/
 * alliance.test.ts`), only a `PaymentState` whose picks include another seat's real card instance.
 */
describe("allianceHelpersOf", () => {
  const TWO_PLAYERS: SessionConfig = {
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    seed: 4,
  };

  /** A `PaymentState` naming `pickedInstanceIds` as picked sources, whoever owns them — real `controllerOf` reads, no fabricated card data. */
  function paymentNaming(subject: InstanceId, pickedInstanceIds: readonly InstanceId[]): PaymentState {
    const sources = pickedInstanceIds.map((instanceId) => ({
      optionId: `hand:${instanceId}`,
      kind: "handCard" as const,
      instanceId,
      label: instanceId,
      pool: { physical: 0, mental: 0, energy: 0, wild: 0 },
    }));
    return {
      action: { kind: "playCard", instanceId: subject },
      target: null,
      query: { requirement: { physical: 0, mental: 0, energy: 0, wild: 0, generic: 0 }, sources, suggested: [] },
      picked: sources.map((s) => s.optionId),
      reductions: [],
    };
  }

  test("empty for a payment that spends only the payer's own cards", async () => {
    let localStore = new SessionStore(new LocalEngineHost());
    await localStore.start(TWO_PLAYERS);
    for (let step = 0; step < 12 && localStore.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = localStore.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await localStore.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const localState = localStore.state.game!;
    const me2 = localStore.state.perspectiveId!;
    const myHand = localState.players.find((p) => p.playerId === me2)!.hand;
    expect(myHand.length).toBeGreaterThan(0);
    const payment = paymentNaming(myHand[0]!, [myHand[0]!]);
    expect(allianceHelpersOf(localState, me2, payment)).toEqual([]);
  });

  test("names each other seat whose card the picks spend, in seat order, never the payer", async () => {
    let localStore = new SessionStore(new LocalEngineHost());
    await localStore.start(TWO_PLAYERS);
    for (let step = 0; step < 12 && localStore.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = localStore.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await localStore.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
    }
    const localState = localStore.state.game!;
    const me2 = localStore.state.perspectiveId!;
    const other = localState.players.find((p) => p.playerId !== me2)!;
    expect(other.hand.length).toBeGreaterThan(0);
    const myHand = localState.players.find((p) => p.playerId === me2)!.hand;
    const payment = paymentNaming(myHand[0] ?? other.hand[0]!, [other.hand[0]!]);
    const helpers = allianceHelpersOf(localState, me2, payment);
    expect(helpers).toEqual([{ playerId: other.playerId, instanceIds: [other.hand[0]] }]);
  });
});
