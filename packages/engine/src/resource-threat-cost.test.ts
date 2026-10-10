/**
 * docs/phase7-wave9.md §3.7 (b): a resource ability whose cost removes a chosen amount of threat and whose resources
 * read that amount ("Resource: Exhaust this card and remove up to 2 threat from your suit form upgrade → generate a
 * [mental] resource for each threat you removed this way"), with synthetic cards. The amount travels in the payment
 * (`ResourceAbilityUse.costSelection.removeThreat`), so what the use generates is known as the payment is priced.
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): the cost is determined and paid (steps 3, 5) before the effect,
 * generating resources (step 6); "Cost" (p. 13): "a player is permitted to generate resources beyond the specified
 * cost", and (p. 14) "up to" some number in a cost "requires a minimum of one"; "Resource Ability" (p. 37).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { paymentOptions, paymentsFromOptionIds, resourceAbilityOptionId } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { createCtx } from "./ctx.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions, paymentFor } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const REMOVED = { kind: "var", name: "cost.removeThreat" } as const;
const theVault = { kind: "each", query: { categories: ["support"], name: "vault" } } as const;

/** "Resource: Exhaust this card and remove up to 2 threat from the vault → a [mental] resource for each removed." */
const WATCH_RESOURCE = stubAbility("watch.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true, removeThreat: { from: theVault, amount: { choose: { min: 1, max: 2 } } } },
  generates: { kind: "amount", resource: "mental", amount: REMOVED },
  effects: [],
} as Omit<AbilityDefinition, "id">);
const WATCH = stubUpgrade({ id: "watch", cost: 0, abilities: [WATCH_RESOURCE.ref] });
/** The card that holds the threat: not a scheme, so its threat is only tokens (§3.7 (a)). */
const VAULT = stubSupport({ id: "vault", cost: 0 });

/** Events costing 1, 2 and 3 that mark the identity when they resolve. */
const mark = stubAbility("spend.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "resolved",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const ONE = stubEvent({ id: "cost-one", cost: 1, abilities: [mark.ref] });
const TWO = stubEvent({ id: "cost-two", cost: 2, abilities: [mark.ref] });
const THREE = stubEvent({ id: "cost-three", cost: 3, abilities: [mark.ref] });

/** "Action: Remove up to 3 threat from the vault → place that many `paid` counters here." */
const DRAIN_ACTION = stubAbility("drain.action", {
  trigger: { kind: "action" },
  cost: { removeThreat: { from: theVault, amount: { choose: { min: 1, max: 3 } } } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "paid", amount: REMOVED }],
} as Omit<AbilityDefinition, "id">);
const DRAIN = stubSupport({ id: "drain", cost: 0, abilities: [DRAIN_ACTION.ref] });

const deps: EngineDeps = depsOf(WATCH_RESOURCE, mark, DRAIN_ACTION);

interface Table {
  readonly state: GameState;
  readonly watch: InstanceId;
  readonly vault: InstanceId;
  readonly card: InstanceId;
}

/** The watch and the vault (holding `threat`) in play and `event` in hand; `resources` resource cards in hand too. */
function table(threat: number, event: { readonly id: string } = TWO, resources = 0): Table {
  let state = gameAtFirstTurn({
    cards: [WATCH, VAULT, DRAIN, ONE, TWO, THREE],
    deps,
    deck: [WATCH.id, VAULT.id, DRAIN.id, ONE.id, TWO.id, THREE.id, ...copiesOf(RESOURCE.id, 3)],
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.hand, ...p.deck] })) };
  const watch = playerCardIntoPlay(state, WATCH.id);
  const vault = playerCardIntoPlay(watch.state, VAULT.id);
  state = {
    ...vault.state,
    instances: { ...vault.state.instances, [vault.id]: { ...mustInstance(vault.state, vault.id), threat } },
  };
  for (let i = 0; i < resources; i++) state = giveCard(state, P1, RESOURCE.id).state;
  const card = giveCard(state, P1, event.id as never);
  return { state: card.state, watch: watch.id, vault: vault.id, card: card.id };
}

const watchUse = (t: Table, removeThreat?: number): Payment => ({
  ability: {
    instanceId: t.watch,
    abilityId: WATCH_RESOURCE.ref.id,
    ...(removeThreat === undefined ? {} : { costSelection: { removeThreat } }),
  },
});
const play = (t: Table, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: t.card,
  payment,
  attachToInstanceId: null,
});
const refusal = (t: Table, payment: readonly Payment[]): string | undefined => {
  const result = applyCommand(t.state, play(t, payment), deps);
  return result.ok ? undefined : result.error.message;
};
/** Plays the event with `payment`; the log replays to the same state, and no prompt was needed. */
function pay(t: Table, payment: readonly Payment[]) {
  const asked: string[] = [];
  const { session, events } = driveSession(startSession(t.state), deps, [play(t, payment)], (state) => {
    asked.push(state.pendingChoice?.prompt.kind ?? "?");
    return [];
  });
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  expect(asked).toEqual([]);
  return { state: session.state, events };
}
const generated = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "resourcesGenerated" && e.instanceId !== undefined ? [e.pool] : []));
const mental = (n: number) => ({ energy: 0, mental: n, physical: 0, wild: 0 });
const threat = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const resolved = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters.resolved ?? 0;
const watchOptions = (t: Table) =>
  paymentOptions(createCtx(t.state, deps), P1, t.card).filter(
    (o) => o.ref.kind === "ability" && o.ref.abilityId === WATCH_RESOURCE.ref.id,
  );
const watchSources = (t: Table) =>
  (paymentFor(t.state, P1, { kind: "playCard", instanceId: t.card }, {}, deps)?.sources ?? []).filter(
    (s) => s.kind === "resourceAbility",
  );
const playable = (t: Table): boolean => {
  const listed = legalActions(t.state, P1, deps);
  if (listed.kind !== "turn") throw new Error(`not the player's turn: ${listed.kind}`);
  return listed.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === t.card);
};

describe("§3.7 (b) a resource ability generating a resource for each threat its cost removed", () => {
  it("with 0 threat there it is not a payment source, a payment naming it is refused, and the card is not playable", () => {
    const t = table(0);
    expect(watchOptions(t)).toEqual([]);
    expect(watchSources(t)).toEqual([]);
    expect(refusal(t, [watchUse(t)])).toMatch(/not enough threat/);
    expect(refusal(t, [watchUse(t, 1)])).toMatch(/not enough threat/);
    expect(playable(t)).toBe(false);
    expect(mustInstance(t.state, t.watch).exhausted).toBe(false);
  });

  it("with 1 threat it is one source worth 1 [mental]: it pays a cost of 1 and leaves 0 threat", () => {
    const t = table(1, ONE);
    expect(watchOptions(t).map((o) => o.optionId)).toEqual([`ability:${t.watch}:${WATCH_RESOURCE.ref.id}`]);
    expect(watchSources(t).map((s) => s.pool)).toEqual([mental(1)]);
    expect(playable(t)).toBe(true);
    const after = pay(t, [watchUse(t)]);
    expect(generated(after.events)).toEqual([mental(1)]);
    expect(threat(after.state, t.vault)).toBe(0);
    expect(mustInstance(after.state, t.watch).exhausted).toBe(true);
    expect(resolved(after.state)).toBe(1);
  });

  it("with 1 threat it cannot pay a cost of 2 alone, and naming 2 is refused", () => {
    const t = table(1, TWO);
    expect(refusal(t, [watchUse(t)])).toBeDefined();
    expect(refusal(t, [watchUse(t, 2)])).toMatch(/removes 1 to 1 threat, not 2/);
    expect(playable(t)).toBe(false);
  });

  it("with 4 threat it offers the most (2) as the plain source and 1 as another, each with its own pool", () => {
    const t = table(4);
    const plain = `ability:${t.watch}:${WATCH_RESOURCE.ref.id}`;
    expect(watchOptions(t).map((o) => [o.optionId, o.label])).toEqual([
      [plain, "watch (remove 2 threat)"],
      [`${plain}@#removeThreat=1`, "watch (remove 1 threat)"],
    ]);
    expect(watchSources(t).map((s) => [s.costSelection?.removeThreat, s.pool])).toEqual([
      [undefined, mental(2)],
      [1, mental(1)],
    ]);
    expect(paymentsFromOptionIds([`${plain}@#removeThreat=1`])).toEqual([watchUse(t, 1)]);
    expect(
      resourceAbilityOptionId({
        instanceId: t.watch,
        abilityId: WATCH_RESOURCE.ref.id,
        costSelection: { removeThreat: 1 },
      }),
    ).toBe(`${plain}@#removeThreat=1`);
  });

  it("choosing 2 of 4: 2 [mental] pays a cost of 2, 2 threat left", () => {
    const t = table(4);
    const after = pay(t, [watchUse(t, 2)]);
    expect(generated(after.events)).toEqual([mental(2)]);
    expect(threat(after.state, t.vault)).toBe(2);
    expect(resolved(after.state)).toBe(1);
    expect(after.events.filter((e) => e.type === "threatCostSettled")).toMatchObject([
      { instanceId: t.watch, fromInstanceId: t.vault, chosen: 2, removed: 2, paid: true },
    ]);
  });

  it("no amount named removes the most: 2 of 4", () => {
    const t = table(4);
    const after = pay(t, [watchUse(t)]);
    expect(generated(after.events)).toEqual([mental(2)]);
    expect(threat(after.state, t.vault)).toBe(2);
  });

  it("choosing 1 of 4: 1 [mental] pays a cost of 1, 3 threat left; it does not pay a cost of 2", () => {
    const one = table(4, ONE);
    const after = pay(one, [watchUse(one, 1)]);
    expect(generated(after.events)).toEqual([mental(1)]);
    expect(threat(after.state, one.vault)).toBe(3);
    expect(resolved(after.state)).toBe(1);
    const two = table(4, TWO);
    expect(refusal(two, [watchUse(two, 1)])).toBeDefined();
    expect(threat(two.state, two.vault)).toBe(4);
  });

  it("the card's cap bounds it: 3 of 4 and 0 are refused", () => {
    const t = table(4, THREE);
    expect(refusal(t, [watchUse(t, 3)])).toMatch(/removes 1 to 2 threat, not 3/);
    expect(refusal(t, [watchUse(t, 0)])).toMatch(/removes 1 to 2 threat, not 0/);
    expect(refusal(t, [watchUse(t, 1.5)])).toMatch(/removes 1 to 2 threat/);
    expect(refusal(t, [watchUse(t)])).toBeDefined();
    expect(playable(t)).toBe(false);
  });

  it("overpaying is legal as for any generator: 2 [mental] for a cost of 1 removes both threat", () => {
    const t = table(2, ONE);
    const after = pay(t, [watchUse(t)]);
    expect(generated(after.events)).toEqual([mental(2)]);
    expect(threat(after.state, t.vault)).toBe(0);
    expect(resolved(after.state)).toBe(1);
  });

  it("one use pays one amount: both sources of the same ability in a payment are refused", () => {
    const t = table(4, THREE);
    expect(refusal(t, [watchUse(t, 2), watchUse(t, 1)])).toBeDefined();
    expect(refusal(t, [watchUse(t), watchUse(t, 1)])).toBeDefined();
  });

  it("with a hand card: 2 [mental] and a resource card pay a cost of 3, and the suggested payment uses the most", () => {
    const t = table(2, THREE, 1);
    expect(playable(t)).toBe(true);
    const query = paymentFor(t.state, P1, { kind: "playCard", instanceId: t.card }, {}, deps);
    expect(query?.suggested).toContain(`ability:${t.watch}:${WATCH_RESOURCE.ref.id}`);
    const hand = mustPlayer(t.state, P1).hand.find((id) => id !== t.card)!;
    const after = pay(t, [watchUse(t), { fromHand: hand }]);
    expect(threat(after.state, t.vault)).toBe(0);
    expect(resolved(after.state)).toBe(1);
  });

  it("the threat comes off before the card paid for resolves", () => {
    const t = table(4);
    const { events } = pay(t, [watchUse(t, 2)]);
    const settled = events.findIndex((e) => e.type === "threatCostSettled");
    const marked = events.findIndex((e) => e.type === "counterAdded");
    expect(settled).toBeGreaterThanOrEqual(0);
    expect(marked).toBeGreaterThan(settled);
    expect(events.findIndex((e) => e.type === "resourcesGenerated")).toBeLessThan(settled);
  });

  it("once exhausted it is no longer a source", () => {
    const t = table(4);
    const exhausted: Table = {
      ...t,
      state: {
        ...t.state,
        instances: { ...t.state.instances, [t.watch]: { ...mustInstance(t.state, t.watch), exhausted: true } },
      },
    };
    expect(watchOptions(exhausted)).toEqual([]);
    expect(refusal(exhausted, [watchUse(exhausted, 1)])).toBeDefined();
  });
});

describe("§3.7 (b) `CostSelection.removeThreat` on a command: the amount named up front", () => {
  const drain = (t: Table, removeThreat?: number) => {
    const put = playerCardIntoPlay(t.state, DRAIN.id);
    const command: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: DRAIN_ACTION.ref.id,
      payment: [],
      ...(removeThreat === undefined ? {} : { costSelection: { removeThreat } }),
    };
    return { state: put.state, id: put.id, command };
  };

  it("named 2 of 4: no number is asked, 2 come off and the text after the arrow reads 2", () => {
    const { state, id, command } = drain(table(4), 2);
    const asked: string[] = [];
    const { session } = driveSession(startSession(state), deps, [command], (current) => {
      asked.push(current.pendingChoice?.prompt.kind ?? "?");
      return [];
    });
    expect(asked).toEqual([]);
    expect(mustInstance(session.state, id).counters.paid).toBe(2);
    const vault = Object.values(session.state.instances).find((i) => (i.cardId as string) === VAULT.id)!;
    expect(vault.threat).toBe(2);
  });

  it("not named: the payer is asked from 1 to 3 as before", () => {
    const { state, id, command } = drain(table(4));
    const asked: string[] = [];
    const { session } = driveSession(startSession(state), deps, [command], (current) => {
      const choice = current.pendingChoice;
      asked.push(`${choice?.prompt.kind}:${choice?.options.map((o) => o.optionId).join(",")}`);
      return ["3"];
    });
    expect(asked).toEqual(["chooseNumber:1,2,3"]);
    expect(mustInstance(session.state, id).counters.paid).toBe(3);
  });

  it("named out of range is refused", () => {
    const { state, command } = drain(table(2), 3);
    const result = applyCommand(state, command, deps);
    expect(result.ok ? undefined : result.error.message).toMatch(/removes 1 to 2 threat, not 3/);
  });
});
