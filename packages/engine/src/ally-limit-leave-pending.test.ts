/**
 * RRG 1.8 "Ally Limit" (p. 7) while a "leaves play" interrupt is in play (docs/phase7-wave9.md §3.20). The limit makes
 * the player "choose and discard from play ally cards they control", and "discarding a card from play" is one of the
 * ways a card leaves play (RRG 1.8 "Leaves Play", p. 27), so an "Interrupt: When an ally leaves play" answers the limit
 * discard like any other, and the ally stays in play while that interrupt resolves (RRG 1.8 "Interrupt", p. 25). The
 * limit is a standing rule checked between frames (`checkStateTriggers`): an ally whose leaving is already on the stack
 * is on its way out and is neither counted nor offered again.
 *
 * Synthetic cards only: the Vault ("Forced Interrupt: When an ally leaves play, tuck it under here and place threat
 * here equal to its cost. Then, place 1 acceleration token here." / "When Defeated: Put each ally tucked here into play
 * under its owner's control."), a Watcher that only places a counter as an ally leaves, restricted upgrades, and allies.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSideScheme, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const self = { kind: "self" } as const;
const one = { kind: "const", value: 1 } as const;
const it_ = { kind: "eventTarget" } as const;
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const tuckedHere: TargetRef = { kind: "tuckedUnder", of: self };
const returning: TargetRef = { kind: "slot", slot: "tucked" };

const VAULT_INTERRUPT = stubAbility("vault.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: { categories: ["ally"] } } },
  effects: [
    { kind: "replaceLeaveDestination", to: { tuckedUnder: self } },
    { kind: "placeThreat", target: self, amount: { kind: "printedCost", of: it_ } },
    { kind: "then", effects: [{ kind: "addAccelerationToken", target: self }] },
  ],
});
const VAULT_DEFEATED = stubAbility("vault.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [
    {
      kind: "forEachCard",
      cards: tuckedHere,
      slot: "tucked",
      effects: [{ kind: "putIntoPlay", card: returning, controller: { kind: "ownerOf", target: returning } }],
    },
  ],
});
/** "Forced Interrupt: When an ally or an upgrade leaves play, place 1 seen counter here." It replaces nothing. */
const WATCHER_INTERRUPT = stubAbility("watcher.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardLeavesPlay", targetIs: { categories: ["ally", "upgrade"] } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: one }],
});
const BREAK_ACTION = stubAbility("break.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeThreat", target: named("vault"), amount: { kind: "const", value: 20 } }],
});

const VAULT = stubSideScheme({
  id: "vault",
  startingThreat: 2,
  boostIcons: 0,
  abilities: [VAULT_INTERRUPT.ref, VAULT_DEFEATED.ref],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_INTERRUPT.ref] });
const BREAK = stubEvent({ id: "break", cost: 0, abilities: [BREAK_ACTION.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const ALLIES = [1, 2, 3, 4, 5].map((cost) => stubAlly({ id: `ally-${cost}`, cost, atk: 1, thw: 1, hp: 3 }));
/** The ally the tests play from hand: it costs 0, so it is played with no payment (and adds no threat when tucked). */
const RECRUIT = stubAlly({ id: "ally-0", cost: 0, atk: 1, thw: 1, hp: 3 });
const GEAR = ["a", "b", "c"].map((id) =>
  stubUpgrade({ id: `gear-${id}`, cost: 0, keywords: [{ name: "restricted" }] }),
);

const deps: EngineDeps = depsOf(VAULT_INTERRUPT, VAULT_DEFEATED, WATCHER_INTERRUPT, BREAK_ACTION);

interface Table {
  readonly state: GameState;
  readonly vault: InstanceId | null;
  readonly watcher: InstanceId | null;
  /** The allies P1 controls, in the order they entered play (costs 1, 2, 3, …). */
  readonly allies: readonly InstanceId[];
}

/** P1 controls `allies` allies (costs 1 upward); the Vault (2 threat) and the Watcher are in play when asked for. */
function table(options: { readonly allies: number; readonly vault?: boolean; readonly watcher?: boolean }): Table {
  let state = gameAtFirstTurn({
    cards: [VAULT, WATCHER, BREAK, FILLER, RECRUIT, ...ALLIES, ...GEAR],
    deps,
    deck: [WATCHER.id, BREAK.id, RECRUIT.id, ...ALLIES.map((ally) => ally.id), ...GEAR.map((gear) => gear.id)],
    encounter: [VAULT.id, ...copiesOf(FILLER.id, 20)],
  });
  let vault: InstanceId | null = null;
  let watcher: InstanceId | null = null;
  if (options.vault) ({ state, id: vault } = encounterCardInVillainArea(state, VAULT.id, 2));
  if (options.watcher) ({ state, id: watcher } = playerCardIntoPlay(state, WATCHER.id));
  const allies: InstanceId[] = [];
  for (const ally of ALLIES.slice(0, options.allies)) {
    const put = playerCardIntoPlay(state, ally.id);
    allies.push(put.id);
    state = put.state;
  }
  return { state, vault, watcher, allies };
}

interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly session: GameSession;
  /** The options of every limit prompt asked, in order. */
  readonly prompts: readonly (readonly string[])[];
}

/** Plays `card` from hand for 0, answering each limit prompt with `discard` (it must be offered) and counting them. */
function play(
  state: GameState,
  card: string,
  discard: InstanceId | readonly InstanceId[],
  kind = "discardOverAllyLimit",
): Run {
  const given = giveCard(state, P1, card as never);
  const prompts: string[][] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== kind) return defaultPick(s);
    prompts.push(choice.options.map((o) => o.optionId));
    if (prompts.length > 5) throw new Error("the limit prompt keeps repeating");
    return typeof discard === "string" ? [discard] : discard;
  };
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  return { session, state: session.state, events, prompts };
}

const alliesOf = (state: GameState) =>
  mustPlayer(state, P1).playArea.filter((id) => mustInstance(state, id).cardId.startsWith("ally-"));
const newest = (state: GameState, card: string) =>
  mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === card);
const tucked = (state: GameState, host: InstanceId) => mustInstance(state, host).tucked;
const resolved = (events: readonly GameEvent[], ability: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ability).length;
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("the ally limit with a 'leaves play' interrupt in play", () => {
  it("a fourth ally played (the cost-2 ally chosen): 1 prompt, it ends tucked with 2 + 2 threat and 1 token, 3 allies remain", () => {
    const t = table({ allies: 3, vault: true });
    const run = play(t.state, RECRUIT.id, t.allies[1]!);
    const fourth = newest(run.state, RECRUIT.id)!;
    expect(run.prompts).toHaveLength(1);
    expect([...run.prompts[0]!].sort()).toEqual([...t.allies, fourth].sort());
    expect(tucked(run.state, t.vault!)).toEqual([t.allies[1]]);
    expect(mustPlayer(run.state, P1).discard).not.toContain(t.allies[1]);
    expect(mustInstance(run.state, t.vault!).threat).toBe(4);
    expect(mustInstance(run.state, t.vault!).counters.acceleration).toBe(1);
    expect([...alliesOf(run.state)].sort()).toEqual([t.allies[0], t.allies[2], fourth].sort());
    expect(resolved(run.events, "vault.interrupt")).toBe(1);
    expect(run.state.pendingChoice).toBeNull();
    expectReplays(run.session);
  });

  it("the ally just played may be the one chosen: it ends tucked (cost 0: 2 threat, 1 token), the first 3 remain", () => {
    const t = table({ allies: 3, vault: true });
    const given = giveCard(t.state, P1, RECRUIT.id);
    const run = play(t.state, RECRUIT.id, given.id);
    expect(run.prompts).toHaveLength(1);
    expect(tucked(run.state, t.vault!)).toEqual([given.id]);
    expect(mustInstance(run.state, t.vault!).threat).toBe(2);
    expect(mustInstance(run.state, t.vault!).counters.acceleration).toBe(1);
    expect(alliesOf(run.state)).toEqual(t.allies);
    expectReplays(run.session);
  });

  it("an interrupt that replaces nothing: 1 prompt, 1 counter, the chosen ally is in the discard pile, 3 remain", () => {
    const t = table({ allies: 3, watcher: true });
    const run = play(t.state, RECRUIT.id, t.allies[0]!);
    expect(run.prompts).toHaveLength(1);
    expect(mustInstance(run.state, t.watcher!).counters.seen).toBe(1);
    expect(mustPlayer(run.state, P1).discard).toContain(t.allies[0]);
    expect(alliesOf(run.state)).toHaveLength(3);
    expectReplays(run.session);
  });

  it("no interrupt in play: unchanged, 1 prompt, the chosen ally is discarded at once, 3 remain", () => {
    const t = table({ allies: 3 });
    const run = play(t.state, RECRUIT.id, t.allies[2]!);
    expect(run.prompts).toHaveLength(1);
    expect(run.prompts[0]).toHaveLength(4);
    expect(mustPlayer(run.state, P1).discard).toContain(t.allies[2]);
    expect(alliesOf(run.state)).toHaveLength(3);
    expect(run.events.filter((e) => e.type === "cardDiscardedFromPlay").map((e) => e.instanceId)).toEqual([
      t.allies[2],
    ]);
    expectReplays(run.session);
  });

  it("two allies over a limit of three, both chosen at once: 1 prompt for 2, both tucked (costs 1 + 2: 5 threat, 2 tokens)", () => {
    // Surgery: five allies in play, which only a lowered limit or a control change reaches. The check between frames
    // asks as the flow next moves, here while an unrelated card is played.
    const t = table({ allies: 5, vault: true });
    const run = play(t.state, WATCHER.id, [t.allies[0]!, t.allies[1]!]);
    expect(run.prompts).toHaveLength(1);
    expect(run.prompts[0]).toHaveLength(5);
    expect([...tucked(run.state, t.vault!)].sort()).toEqual([t.allies[0], t.allies[1]].sort());
    expect(mustInstance(run.state, t.vault!).threat).toBe(5);
    expect(mustInstance(run.state, t.vault!).counters.acceleration).toBe(2);
    expect(alliesOf(run.state)).toEqual(t.allies.slice(2));
    expectReplays(run.session);
  });
});

describe("the scheme defeated with two tucked allies returning to a player who controls two", () => {
  /** Two allies (costs 1 and 2) tucked under the Vault by surgery, P1 controlling the cost-3 and cost-4 allies. */
  function returningTable() {
    const t = table({ allies: 4, vault: true });
    const [a, b, c, d] = t.allies as [InstanceId, InstanceId, InstanceId, InstanceId];
    const state: GameState = {
      ...t.state,
      players: t.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== a && id !== b) } : p,
      ),
      instances: {
        ...t.state.instances,
        [t.vault!]: { ...mustInstance(t.state, t.vault!), tucked: [a, b] },
        [a]: { ...mustInstance(t.state, a), controllerId: null },
        [b]: { ...mustInstance(t.state, b), controllerId: null },
      },
    };
    return { state, vault: t.vault!, under: [a, b] as const, held: [c, d] as const };
  }

  it("the fourth ally to arrive asks once; the ally chosen is tucked under the defeated scheme and discarded with it", () => {
    const t = returningTable();
    const run = play(t.state, BREAK.id, t.held[0]);
    // The third ally is at the limit; the fourth is one over: one prompt, among the four in play.
    expect(run.prompts).toHaveLength(1);
    expect([...run.prompts[0]!].sort()).toEqual([...t.under, ...t.held].sort());
    // The scheme is still in play while its When Defeated resolves (RRG 1.8 p. 48), so its Forced Interrupt answers
    // once: the chosen ally goes under it, and is discarded as the scheme leaves play (RRG 1.8 "Leaves Play", p. 27).
    expect(resolved(run.events, "vault.interrupt")).toBe(1);
    expect(resolved(run.events, "vault.when-defeated")).toBe(1);
    expect(mustPlayer(run.state, P1).discard).toContain(t.held[0]);
    expect(run.state.villainArea).not.toContain(t.vault);
    expect([...alliesOf(run.state)].sort()).toEqual([...t.under, t.held[1]].sort());
    for (const id of t.under) expect(mustInstance(run.state, id)).toMatchObject({ controllerId: P1, damage: 0 });
    expect(run.state.pendingChoice).toBeNull();
    expectReplays(run.session);
  });

  it("the returning ally itself may be chosen: it is not returned a second time, 3 allies remain", () => {
    const t = returningTable();
    const run = play(t.state, BREAK.id, t.under[0]);
    expect(run.prompts).toHaveLength(1);
    expect(resolved(run.events, "vault.interrupt")).toBe(1);
    // It entered play once (as the third ally), was chosen when the fourth arrived, and did not come back.
    expect(
      run.events.filter(
        (e) =>
          e.type === "triggerEvent" &&
          e.phase === "resolved" &&
          e.event.kind === "cardEntersPlay" &&
          e.event.instanceId === t.under[0],
      ),
    ).toHaveLength(1);
    expect(mustPlayer(run.state, P1).discard).toContain(t.under[0]);
    expect(alliesOf(run.state)).toHaveLength(3);
    expectReplays(run.session);
  });
});

describe("the restricted limit with a 'leaves play' interrupt in play", () => {
  it("a third restricted upgrade played: 1 prompt, 1 counter, 2 restricted cards remain", () => {
    let state = table({ allies: 0, watcher: true }).state;
    const watcher = newest(state, WATCHER.id)!;
    const held: InstanceId[] = [];
    for (const gear of GEAR.slice(0, 2)) {
      const put = playerCardIntoPlay(state, gear.id);
      held.push(put.id);
      state = put.state;
    }
    const run = play(state, "gear-c", held[0]!, "discardRestricted");
    expect(run.prompts).toHaveLength(1);
    expect(mustInstance(run.state, watcher).counters.seen).toBe(1);
    expect(mustPlayer(run.state, P1).discard).toContain(held[0]);
    expect(cardsInPlay(run.state).filter((id) => mustInstance(run.state, id).cardId.startsWith("gear-"))).toHaveLength(
      2,
    );
    expectReplays(run.session);
  });
});
