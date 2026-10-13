/**
 * The payment strip's wave 10 lines (docs/phase7-wave10-client.md C14, section 5.5): the amount a hand card spent
 * through its own ability takes (Energy Siphon's damage, one source per amount), and the line for each other player
 * whose cards help pay. Real games; the sources the engine offers only in a hand not dealt here are added to the real
 * query exactly as `PaymentSource` documents them.
 */
import { WAVE10_DEPS } from "@mc/cards";
import { cardOf, legalActions, type GameState, type InstanceId, type PaymentSource, type PlayerId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { heroPackGame } from "./hero-pack-fixture.js";
import { beginPayment, paymentView, togglePayment, type PaymentState } from "./payment-model.js";

const pool = (extra: Partial<PaymentSource["pool"]>): PaymentSource["pool"] => ({
  physical: 0,
  mental: 0,
  energy: 0,
  wild: 0,
  ...extra,
});

function firstPayment(state: GameState, me: PlayerId, deps = POOL_DEPS): { payment: PaymentState; card: InstanceId } {
  const legal = legalActions(state, me, deps);
  if (legal.kind !== "turn") throw new Error(`expected a turn, got ${legal.kind}`);
  const entry = legal.legal.find(
    (e) =>
      e.action.kind === "playCard" && e.needsPayment && (cardOf(state, e.action.instanceId) as { cost?: number })?.cost,
  );
  if (!entry || entry.action.kind !== "playCard") throw new Error("no card to pay for");
  const payment = beginPayment(state, me, entry.action, null, deps);
  if (!payment) throw new Error("no payment");
  return { payment, card: entry.action.instanceId };
}

describe("a hand card spent through its own ability says the amount it takes", () => {
  test("Energy Siphon's three amounts are three tiles, each saying its damage, and the plain card says none", () => {
    const state = heroPackGame("wonderMan");
    const me = state.players[0]!.playerId;
    const { payment } = firstPayment(state, me, WAVE10_DEPS);
    const siphon = state.players[0]!.hand.find((id) => id !== undefined)!;
    const sources: PaymentSource[] = [1, 2, 3].map(
      (damage) =>
        ({
          optionId: `hand:${siphon}:58006.energy-siphon-interrupt@#damageSelf=${damage}`,
          kind: "resourceAbility",
          instanceId: siphon,
          label: "Energy Siphon",
          pool: pool({ energy: 1 + damage }),
          spendsHandCard: true,
          costSelection: { damageSelf: damage },
        }) as PaymentSource,
    );
    const view = paymentView(
      state,
      me,
      { ...payment, query: { ...payment.query, sources: [...payment.query.sources, ...sources] } },
      "x",
      WAVE10_DEPS,
    );
    const notes = view.sources.filter((source) => source.spendsHandCard).map((source) => source.amountNote);
    expect(notes).toEqual(["take 1 damage", "take 2 damage", "take 3 damage"]);
    expect(view.sources.filter((source) => !source.spendsHandCard).every((source) => source.amountNote === null)).toBe(
      true,
    );
    // All three are table tiles (the strip draws them), told apart by the amount and by what each generates.
    expect(view.tableSources.filter((source) => source.spendsHandCard)).toHaveLength(3);
  }, 120_000);
});

describe("Coordinated-Effort style help: one line per helper", () => {
  test("another player's picked cards read as 'Helped by <hero>: <resources>'", async () => {
    const core = new EngineSessionCore();
    const started = await core.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 4,
    });
    const state = {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      pendingChoice: null,
    } as unknown as GameState;
    const me = state.players[0]!.playerId;
    const helperCard = state.players[1]!.hand[0]!;
    const base = beginPayment(
      state,
      me,
      { kind: "playCard", instanceId: state.players[0]!.hand[0]! },
      null,
      POOL_DEPS,
    ) ?? {
      action: { kind: "playCard", instanceId: state.players[0]!.hand[0]! },
      target: null,
      query: { requirement: { generic: 1, physical: 0, mental: 0, energy: 0, wild: 0 }, sources: [], suggested: [] },
      picked: [],
      reductions: [],
    };
    const source = {
      optionId: `hand:${helperCard}`,
      kind: "handCard",
      instanceId: helperCard,
      label: "Helper's card",
      pool: pool({ energy: 1 }),
    } as PaymentSource;
    const open = { ...base, query: { ...base.query, sources: [...base.query.sources, source] } } as PaymentState;
    expect(paymentView(state, me, open, "x", POOL_DEPS).helperLines).toEqual([]);
    const spent = paymentView(state, me, togglePayment(open, source.optionId), "x", POOL_DEPS);
    expect(spent.helperLines).toHaveLength(1);
    expect(spent.helperLines[0]).toMatch(/^Helped by .+: 1 energy$/);
    expect(spent.tableSources.some((entry) => entry.helperName !== null)).toBe(true);
  }, 120_000);
});

describe("overpaying: a cost-0 play and a resource that can only overpay (Mr. Hollywood)", () => {
  /** Wonder Man in hero form, Mr. Hollywood in play, `codes` in hand: the real cards, moved by hand into place. */
  function staged(...codes: readonly string[]) {
    let state = heroPackGame("wonderMan");
    const me = state.players[0]!.playerId;
    const find = (code: string, taken: readonly InstanceId[]): InstanceId => {
      const seat = state.players[0]!;
      const id = [...seat.hand, ...seat.deck, ...seat.discard].find(
        (candidate) => state.instances[candidate]?.cardId === code && !taken.includes(candidate),
      );
      if (!id) throw new Error(`no ${code}`);
      return id;
    };
    const hollywood = find("58009", []);
    const hand = codes.reduce<InstanceId[]>((ids, code) => [...ids, find(code, [hollywood, ...ids])], []);
    state = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        identity: { ...p.identity, form: "hero" as const },
        hand,
        deck: p.deck.filter((id) => id !== hollywood && !hand.includes(id)),
        discard: p.discard.filter((id) => id !== hollywood && !hand.includes(id)),
        playArea: [...p.playArea, hollywood],
      })),
      instances: {
        ...state.instances,
        [hollywood]: { ...state.instances[hollywood]!, faceup: true, controllerId: me },
        [state.mainScheme.instanceId]: { ...state.instances[state.mainScheme.instanceId]!, threat: 8 },
      },
    } as GameState;
    return { state, me, hollywood, hand };
  }

  test("a cost-0 card that reads overpaid.* opens a pay step whose default plays it without overpaying", () => {
    const { state, me, hand } = staged("58003", "58023");
    const open = beginPayment(state, me, { kind: "playCard", instanceId: hand[0]! }, null, WAVE10_DEPS);
    expect(open).not.toBeNull();
    const view = paymentView(state, me, open!, "Active Altruism", WAVE10_DEPS);
    expect(view.required).toBe(0);
    expect(view.payLabel).toBe("Play without overpaying");
    expect(view.blockedBy).toBeNull();
    expect(view.overpaid).toBe(0);
  }, 120_000);

  test("Mr. Hollywood is overpay-only: held until the cost is covered, and counted as overpaid once picked", () => {
    const { state, me, hollywood, hand } = staged("58004", "58023");
    const open = beginPayment(state, me, { kind: "playCard", instanceId: hand[0]! }, null, WAVE10_DEPS)!;
    const star = open.query.sources.find((source) => source.instanceId === hollywood)!;
    expect(star.overpayOnly).toBe(true);
    const before = paymentView(state, me, open, "x", WAVE10_DEPS);
    const tile = before.sources.find((source) => source.instanceId === hollywood)!;
    expect(tile.lockedReason).toMatch(/overpay/i);
    expect(before.lockedNote).toContain(star.label);
    expect(before.payLabel).toBeNull();
    // Picked alone he does not cover the cost: nothing paid, no command.
    const alone = paymentView(state, me, togglePayment(open, star.optionId), "x", WAVE10_DEPS);
    expect(alone.paid).toBe(0);
    expect(alone.command).toBeNull();
    // Once a card covers it he is free, and what he adds is overpaid.
    const energy = open.query.sources.find((source) => source.instanceId === hand[1])!;
    const covered = togglePayment(open, energy.optionId);
    const free = paymentView(state, me, covered, "x", WAVE10_DEPS);
    expect(free.sources.find((source) => source.instanceId === hollywood)!.lockedReason).toBeNull();
    const both = paymentView(state, me, togglePayment(covered, star.optionId), "x", WAVE10_DEPS);
    expect(both.command).not.toBeNull();
    expect(both.overpaid).toBe(both.paid - both.required + 1);
    expect(both.overpaidNote).toBe(`Overpaid by ${both.overpaid}`);
  }, 120_000);
});
