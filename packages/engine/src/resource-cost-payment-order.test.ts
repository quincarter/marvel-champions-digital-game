/**
 * The held costs of the resource abilities one payment uses resolve in payment order, whatever kind each cost is (PR
 * #821 review): a threat cost ("remove 1 threat from the vault →") and a picked damage cost ("deal 1 damage to
 * attached character →", Clarity of Purpose `spdr` 31029) are held in one list (`SpentPayment.costSteps`), so the
 * resource ability paid first has its cost resolved first, and both before the card paid for (issue #813).
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): each resource ability's cost is paid (step 5) before its effect
 * generates the resource (step 6), so the abilities a payment uses are paid one after another, in the order they are
 * used; and every cost of the payment is paid before the card commences being played (step 6). "Cost" (p. 13–14).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ONE_MENTAL = { kind: "amount", resource: "mental", amount: { kind: "const", value: 1 } } as const;

/** "Resource: Exhaust this card and remove 1 threat from the vault → generate a [mental] resource." */
const WATCH_RESOURCE = stubAbility("watch.resource", {
  trigger: { kind: "resource" },
  cost: {
    exhaustSelf: true,
    removeThreat: { from: { kind: "each", query: { categories: ["support"], name: "vault" } }, amount: 1 },
  },
  generates: ONE_MENTAL,
  effects: [],
} as Omit<AbilityDefinition, "id">);
const WATCH = stubUpgrade({ id: "watch", cost: 0, abilities: [WATCH_RESOURCE.ref] });
/** Holds the threat the watch removes: not a scheme, so its threat is only tokens (docs/phase7-wave9.md §3.7 (a)). */
const VAULT = stubSupport({ id: "vault", cost: 0 });

/** "Resource: Exhaust this card and deal 1 damage to your identity → generate a [mental] resource" (Clarity's shape). */
const CLARITY_RESOURCE = stubAbility("clarity.resource", {
  trigger: { kind: "resource" },
  cost: {
    exhaustSelf: true,
    damageCards: { slot: "damaged", query: { categories: ["identity"], controller: "you" }, min: 1, max: 1, amount: 1 },
  },
  generates: ONE_MENTAL,
  effects: [],
} as Omit<AbilityDefinition, "id">);
const CLARITY = stubUpgrade({ id: "clarity", cost: 0, abilities: [CLARITY_RESOURCE.ref] });

/** "Action: place a `resolved` counter on your identity": marks when the card paid for resolves. */
const MARK = stubAbility("mark.action", {
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
const TWO = stubEvent({ id: "cost-two", cost: 2, abilities: [MARK.ref] });

const deps: EngineDeps = depsOf(WATCH_RESOURCE, CLARITY_RESOURCE, MARK);

interface Table {
  readonly state: GameState;
  readonly watch: InstanceId;
  readonly clarity: InstanceId;
  readonly vault: InstanceId;
  readonly identity: InstanceId;
  readonly card: InstanceId;
}

/** The watch, Clarity and the vault (holding 2 threat) in play; the 2-cost event in an otherwise empty hand. */
function table(): Table {
  let state = gameAtFirstTurn({
    cards: [WATCH, CLARITY, VAULT, TWO],
    deps,
    deck: [WATCH.id, CLARITY.id, VAULT.id, TWO.id],
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, hand: [], deck: [...p.hand, ...p.deck] })) };
  const watch = playerCardIntoPlay(state, WATCH.id);
  const clarity = playerCardIntoPlay(watch.state, CLARITY.id);
  const vault = playerCardIntoPlay(clarity.state, VAULT.id);
  state = {
    ...vault.state,
    instances: { ...vault.state.instances, [vault.id]: { ...mustInstance(vault.state, vault.id), threat: 2 } },
  };
  const card = giveCard(state, P1, TWO.id as never);
  const identity = mustPlayer(card.state, P1).identity.instanceId;
  return { state: card.state, watch: watch.id, clarity: clarity.id, vault: vault.id, identity, card: card.id };
}

const watchUse = (t: Table): Payment => ({ ability: { instanceId: t.watch, abilityId: WATCH_RESOURCE.ref.id } });
const clarityUse = (t: Table): Payment => ({
  ability: { instanceId: t.clarity, abilityId: CLARITY_RESOURCE.ref.id, costChoices: { damaged: [t.identity] } },
});
const play = (t: Table, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: t.card,
  payment,
  attachToInstanceId: null,
});

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

/** The order the costs and the card paid for resolved in, read from the log. */
function resolutionOrder(t: Table, events: readonly GameEvent[]): string[] {
  return events.flatMap((e): string[] => {
    if (e.type === "threatRemoved" && e.schemeInstanceId === t.vault) return ["threat"];
    if (e.type === "damageDealt" && e.targetInstanceId === t.identity) return ["damage"];
    if (e.type === "counterAdded" && e.instanceId === t.identity && e.counterType === "resolved") return ["card"];
    return [];
  });
}

describe("one payment's held resource costs resolve in payment order, across kinds (PR #821 review)", () => {
  it("the threat cost paid first resolves before the picked damage cost, and both before the card", () => {
    const t = table();
    const { state, events } = pay(t, [watchUse(t), clarityUse(t)]);
    expect(resolutionOrder(t, events)).toEqual(["threat", "damage", "card"]);
    expect(mustInstance(state, t.vault).threat).toBe(1);
    expect(mustInstance(state, t.identity).damage).toBe(1);
  });

  it("the picked damage cost paid first resolves before the threat cost, and both before the card", () => {
    const t = table();
    const { state, events } = pay(t, [clarityUse(t), watchUse(t)]);
    expect(resolutionOrder(t, events)).toEqual(["damage", "threat", "card"]);
    expect(mustInstance(state, t.vault).threat).toBe(1);
    expect(mustInstance(state, t.identity).damage).toBe(1);
  });
});
