/**
 * docs/phase7-wave6.md §3.55: `EffectSpec modifyThwart { extraThreat }`, "that thwart removes 1 additional threat" for
 * the thwart in progress. Synthetic cards shaped like Operative Skill (Gambit 37013: "Interrupt: When you thwart,
 * remove 1 operative counter from here → that thwart removes 1 additional threat."), on a support so no attachment
 * is in the way.
 *
 * - Added to the thwart's own removal after its amount is computed: a basic thwart's THW, a "(thwart)" ability's or
 *   event's amount. One removal (RRG 1.8 "Thwart", p. 44: "considered a single thwart"), from the thwart's own scheme.
 * - So the thwart's checks see the total: a crisis icon or patrol stops all of it (RRG 1.8 "Crisis Icon", p. 14;
 *   "Patrol", p. 32), and "after you thwart" responses read the threat actually removed.
 * - The cost is paid before the effect (RRG 1.8 "Initiating Abilities", p. 24), and the interrupt resolves before the
 *   thwart it interrupts (RRG 1.8 "Interrupt", p. 25).
 * - A confused hero's thwart never happens (RRG 1.8 "Confuse, Confused", p. 13): no window, no counter spent. A thwart
 *   cancelled or replaced in the same window removes nothing, the extra included.
 *
 * Sources: the card's text and scan (`assets/card-art/bundles/cards/37013.png`); RRG 1.8 pages above. No FFG ruling on
 * Operative Skill in the post-RRG 1.7 rulings transcript.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const SELF: TargetRef = { kind: "self" };
const yourIdentity: TargetQuery = { categories: ["identity"], controller: "you" };
const chosen: TargetRef = { kind: "slot", slot: "scheme" };
const aScheme: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  chooser: { kind: "controller" },
  query: { categories: ["scheme"] },
};

/** Operative Skill's shape: "Interrupt: When you thwart, remove 1 operative counter from here → … 1 additional threat." */
const SKILL = stubAbility("skill.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "thwart", sourceIs: yourIdentity } },
  cost: { spendCounters: { counterType: "operative", amount: 1 } },
  effects: [{ kind: "modifyThwart", extraThreat: n(1) }],
} satisfies AbilityDefinition);
/** "Forced Response: After you thwart, place a counter here for each threat that thwart removed." */
const SEEN = stubAbility("ledger.response", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", sourceIs: yourIdentity } },
  effects: [{ kind: "addCounters", target: SELF, counterType: "seen", amount: { kind: "eventAmount" } }],
} satisfies AbilityDefinition);
/** "Action (thwart): Remove 2 threat from a scheme." on a support, your identity thwarting. */
const SUPPORT_THWART = stubAbility("gadget.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [aScheme, { kind: "thwart", target: chosen, amount: n(2) }],
} satisfies AbilityDefinition);
/** "Hero Action (thwart): Remove 3 threat from a scheme." (Breaking and Entering's shape.) */
const BREAK_IN = stubAbility("break-in.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [aScheme, { kind: "thwart", target: chosen, amount: n(3) }],
} satisfies AbilityDefinition);
/** "Hero Action (thwart): Remove 2 threat from the main scheme. Draw 1 card." — playable under crisis or patrol. */
const PUSH = stubAbility("push.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [
    { kind: "thwart", target: { kind: "mainScheme" }, amount: n(2) },
    { kind: "draw", player: { kind: "controller" }, amount: n(1) },
  ],
} satisfies AbilityDefinition);
/** "Interrupt: When a hero thwarts, cancel that thwart." */
const CANCEL = stubAbility("veto.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "thwart" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
} satisfies AbilityDefinition);
/** "Interrupt: When a hero thwarts, instead remove 1 threat from the main scheme." */
const REPLACE = stubAbility("swap.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "thwart" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(1) }],
    },
  ],
} satisfies AbilityDefinition);

const SKILL_CARD = stubSupport({ id: "skill", cost: 0, abilities: [SKILL.ref] });
const LEDGER = stubSupport({ id: "ledger", cost: 0, abilities: [SEEN.ref] });
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [SUPPORT_THWART.ref] });
const VETO = stubSupport({ id: "veto", cost: 0, abilities: [CANCEL.ref] });
const SWAP = stubSupport({ id: "swap", cost: 0, abilities: [REPLACE.ref] });
const BREAK_IN_CARD = stubEvent({ id: "break-in", cost: 0, abilities: [BREAK_IN.ref] });
const PUSH_CARD = stubEvent({ id: "push", cost: 0, abilities: [PUSH.ref] });
const SIDEKICK = stubAlly({ id: "sidekick", cost: 0, atk: 1, thw: 1, hp: 3 });
const PATROLLER = stubMinion({ id: "patroller", atk: 0, sch: 0, hp: 5, keywords: [{ name: "patrol" }] });
const SIDE = stubSideScheme({ id: "side", startingThreat: 0, boostIcons: 0 });
const CRISIS = stubSideScheme({ id: "crisis-side", startingThreat: 0, icons: ["crisis"], boostIcons: 0 });

const deps: EngineDeps = depsOf(SKILL, SEEN, SUPPORT_THWART, BREAK_IN, PUSH, CANCEL, REPLACE);
const PLAYER_CARDS = [SKILL_CARD, LEDGER, GADGET, VETO, SWAP, BREAK_IN_CARD, PUSH_CARD, SIDEKICK];

interface Table {
  readonly state: GameState;
  readonly skill: InstanceId | null;
  readonly ledger: InstanceId;
  readonly gadget: InstanceId;
  readonly side: InstanceId;
}

/**
 * P1 in hero form, 6 threat on the main scheme and 5 on a side scheme, the ledger and the gadget in play, and the skill
 * (3 operative counters) unless `skill` is false. `extra` supports go into play too.
 */
function table(opts: { readonly skill?: boolean; readonly extra?: readonly CardId[] } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [...PLAYER_CARDS, PATROLLER, SIDE, CRISIS],
    deps,
    encounter: [PATROLLER.id, SIDE.id, CRISIS.id, ...copiesOf("treachery" as CardId, 20)],
    deck: [...PLAYER_CARDS.map((c) => c.id), ...copiesOf(PUSH_CARD.id, 2)],
  });
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: {
      ...state.instances,
      [state.mainScheme.instanceId]: { ...mustInstance(state, state.mainScheme.instanceId), threat: 6 },
    },
  };
  const side = encounterCardInVillainArea(state, SIDE.id, 5);
  state = side.state;
  let skill: InstanceId | null = null;
  if (opts.skill !== false) {
    const placed = playerCardIntoPlay(state, SKILL_CARD.id);
    skill = placed.id;
    state = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [skill]: { ...mustInstance(placed.state, skill), counters: { operative: 3 } },
      },
    };
  }
  const ledger = playerCardIntoPlay(state, LEDGER.id);
  const gadget = playerCardIntoPlay(ledger.state, GADGET.id);
  state = gadget.state;
  for (const card of opts.extra ?? []) state = playerCardIntoPlay(state, card).state;
  return { state, skill, ledger: ledger.id, gadget: gadget.id, side: side.id };
}

/**
 * Answers choices: in a window, uses every ability of `use` (ability ids) that is offered, in that order;
 * a scheme prompt takes `target` when it is offered; anything else by default.
 */
const picker =
  (use: readonly string[], target: InstanceId | null = null) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTarget" && target) {
      const match = choice.options.find((o) => o.optionId === target);
      if (match) return [match.optionId];
    }
    // Every wanted trigger offered, in the order wanted (a window's trigger prompt takes several, resolved in order).
    const wanted = use.flatMap((id) => choice.options.filter((o) => o.optionId.includes(id)).map((o) => o.optionId));
    return wanted.length > 0 ? wanted.slice(0, Math.max(1, choice.maxSelections)) : defaultPick(state);
  };

/** Runs `commands` with `pick`, checks the log replays to the same state (deep-equal), and returns the run. */
function run(state: GameState, pick: (state: GameState) => readonly string[], ...commands: Command[]) {
  const result = runCommandsPicking(state, deps, pick, ...commands);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

const hero = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const basicThwart = (state: GameState, scheme: InstanceId, thwarter: InstanceId = hero(state)): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const useGadget = (gadget: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: gadget,
  abilityId: SUPPORT_THWART.ref.id,
  payment: [],
});
const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const mainThreat = (state: GameState): number => threatOn(state, state.mainScheme.instanceId);
const counter = (state: GameState, id: InstanceId | null, type: string): number =>
  id === null ? 0 : (mustInstance(state, id).counters[type] ?? 0);
const removals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemoved" ? [{ scheme: e.schemeInstanceId, amount: e.amount }] : []));
const modified = (events: readonly GameEvent[]) => events.filter((e) => e.type === "thwartModified");
const blocked = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemovalBlocked" ? [e.reason] : []));
const resolvedThwarts = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event.amount] : [],
  );
const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);

const USE_SKILL = picker([SKILL.ref.id]);

describe("§3.55 `modifyThwart`: additional threat for the thwart in progress", () => {
  it("a basic thwart removes its THW + 1 in one removal; cost, then the extra, then the removal, then the response", () => {
    const t = table();
    const { state: after, events } = run(t.state, USE_SKILL, basicThwart(t.state, t.state.mainScheme.instanceId));
    // Default hero THW 2, + 1.
    expect(mainThreat(after)).toBe(6 - 3);
    expect(removals(events)).toEqual([{ scheme: after.mainScheme.instanceId, amount: 3 }]);
    // One use per thwart: 3 counters → 2, though the skill could pay again.
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(modified(events)).toEqual([
      {
        type: "thwartModified",
        schemeInstanceId: after.mainScheme.instanceId,
        thwarterInstanceId: hero(after),
        extraThreat: 1,
        total: 1,
        sourceInstanceId: t.skill,
      },
    ]);
    // "After you thwart" sees the total removed.
    expect(counter(after, t.ledger, "seen")).toBe(3);
    expect(resolvedThwarts(events)).toEqual([3]);
    const paid = indexOf(events, (e) => e.type === "counterRemoved" && e.instanceId === t.skill);
    const extra = indexOf(events, (e) => e.type === "thwartModified");
    const removed = indexOf(events, (e) => e.type === "threatRemoved");
    const seen = indexOf(events, (e) => e.type === "counterAdded" && e.instanceId === t.ledger);
    expect(paid).toBeGreaterThanOrEqual(0);
    expect([paid < extra, extra < removed, removed < seen]).toEqual([true, true, true]);
  });

  it("a '(thwart)' ability on a support removes its amount + 1", () => {
    const t = table();
    const { state: after, events } = run(
      t.state,
      picker([SKILL.ref.id], t.state.mainScheme.instanceId),
      useGadget(t.gadget),
    );
    expect(mainThreat(after)).toBe(6 - 3);
    expect(removals(events)).toEqual([{ scheme: after.mainScheme.instanceId, amount: 3 }]);
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(counter(after, t.ledger, "seen")).toBe(3);
  });

  it("a '(thwart)' event removes its amount + 1", () => {
    const t = table();
    const given = giveCard(t.state, P1, BREAK_IN_CARD.id);
    const { state: after, events } = run(
      given.state,
      picker([SKILL.ref.id], t.state.mainScheme.instanceId),
      play(given.id),
    );
    expect(mainThreat(after)).toBe(6 - 4);
    expect(removals(events)).toEqual([{ scheme: after.mainScheme.instanceId, amount: 4 }]);
    expect(counter(after, t.ledger, "seen")).toBe(4);
  });

  it("the extra comes off the thwart's own target: a side scheme, not the main scheme", () => {
    const t = table();
    const { state: after, events } = run(t.state, USE_SKILL, basicThwart(t.state, t.side));
    expect(threatOn(after, t.side)).toBe(5 - 3);
    expect(mainThreat(after)).toBe(6);
    expect(removals(events)).toEqual([{ scheme: t.side, amount: 3 }]);
  });

  it("the extra is capped by the threat there: 2 on the scheme, THW 2 + 1, 2 removed and the response sees 2", () => {
    const t = table();
    const low: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.side]: { ...mustInstance(t.state, t.side), threat: 2 } },
    };
    const { state: after, events } = run(low, USE_SKILL, basicThwart(low, t.side));
    expect(threatOn(after, t.side)).toBe(0);
    expect(counter(after, t.ledger, "seen")).toBe(2);
    expect(resolvedThwarts(events)).toEqual([2]);
  });

  it("a crisis icon stops the whole removal from the main scheme; the counter stays spent", () => {
    const t = table();
    const crisis = encounterCardInVillainArea(t.state, CRISIS.id, 1);
    const given = giveCard(crisis.state, P1, PUSH_CARD.id);
    const { state: after, events } = run(given.state, USE_SKILL, play(given.id));
    expect(mainThreat(after)).toBe(6);
    expect(removals(events)).toEqual([]);
    expect(blocked(events)).toEqual(["crisis"]);
    expect(modified(events)).toHaveLength(1);
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });

  it("patrol stops the whole removal from the main scheme", () => {
    const t = table();
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const given = giveCard(patrolled, P1, PUSH_CARD.id);
    const { state: after, events } = run(given.state, USE_SKILL, play(given.id));
    expect(mainThreat(after)).toBe(6);
    expect(blocked(events)).toEqual(["patrol"]);
    expect(counter(after, t.skill, "operative")).toBe(2);
  });

  it("'when you thwart' is your identity: an ally's thwart is not offered the skill and removes its THW", () => {
    const t = table();
    const ally = playerCardIntoPlay(t.state, SIDEKICK.id);
    const offers: string[] = [];
    const watch = (state: GameState): readonly string[] => {
      for (const o of state.pendingChoice?.options ?? []) offers.push(o.optionId);
      return USE_SKILL(state);
    };
    const { state: after } = run(ally.state, watch, basicThwart(ally.state, ally.state.mainScheme.instanceId, ally.id));
    expect(offers.some((id) => id.includes(SKILL.ref.id))).toBe(false);
    expect(mainThreat(after)).toBe(6 - 1);
    expect(counter(after, t.skill, "operative")).toBe(3);
  });

  it("a confused hero's thwart never happens: no window, no counter spent, no threat removed", () => {
    const t = table();
    const id = hero(t.state);
    const confused: GameState = {
      ...t.state,
      instances: {
        ...t.state.instances,
        [id]: { ...mustInstance(t.state, id), statuses: { ...mustInstance(t.state, id).statuses, confused: 1 } },
      },
    };
    const { state: after, events } = run(confused, USE_SKILL, basicThwart(confused, confused.mainScheme.instanceId));
    expect(mustInstance(after, id).statuses.confused ?? 0).toBe(0);
    expect(mainThreat(after)).toBe(6);
    expect(counter(after, t.skill, "operative")).toBe(3);
    expect(modified(events)).toEqual([]);
  });

  it("a thwart cancelled after the skill resolved removes nothing, the extra included; the counter stays spent", () => {
    const t = table({ extra: [VETO.id] });
    const { state: after, events } = run(
      t.state,
      picker([SKILL.ref.id, CANCEL.ref.id]),
      basicThwart(t.state, t.state.mainScheme.instanceId),
    );
    expect(modified(events)).toHaveLength(1);
    expect(mainThreat(after)).toBe(6);
    expect(removals(events)).toEqual([]);
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });

  it("a thwart cancelled before the skill resolves: the window ends with it, so the skill is not used", () => {
    const t = table({ extra: [VETO.id] });
    const { state: after, events } = run(
      t.state,
      picker([CANCEL.ref.id, SKILL.ref.id]),
      basicThwart(t.state, t.state.mainScheme.instanceId),
    );
    expect(modified(events)).toEqual([]);
    expect(mainThreat(after)).toBe(6);
    expect(removals(events)).toEqual([]);
    expect(counter(after, t.skill, "operative")).toBe(3);
  });

  it("a replaced thwart: the replacement removes its own 1, not 1 + the extra", () => {
    const t = table({ extra: [SWAP.id] });
    const { state: after, events } = run(
      t.state,
      picker([SKILL.ref.id, REPLACE.ref.id]),
      basicThwart(t.state, t.state.mainScheme.instanceId),
    );
    expect(modified(events)).toHaveLength(1);
    expect(mainThreat(after)).toBe(6 - 1);
    expect(removals(events)).toEqual([{ scheme: after.mainScheme.instanceId, amount: 1 }]);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });

  it("the extra is gone with the thwart: the next thwart removes only its own amount", () => {
    const t = table();
    const first = run(t.state, USE_SKILL, basicThwart(t.state, t.side));
    expect(threatOn(first.state, t.side)).toBe(2);
    const second = run(first.state, picker([], first.state.mainScheme.instanceId), useGadget(t.gadget));
    expect(mainThreat(second.state)).toBe(6 - 2);
    expect(counter(second.state, t.skill, "operative")).toBe(2);
    expect(modified(second.events)).toEqual([]);
  });

  it("nothing changes when no card uses it: declined, or not in play, the thwart removes its THW", () => {
    const declined = table();
    const a = run(declined.state, defaultPick, basicThwart(declined.state, declined.state.mainScheme.instanceId));
    const absent = table({ skill: false });
    const b = run(absent.state, defaultPick, basicThwart(absent.state, absent.state.mainScheme.instanceId));
    for (const { state, events } of [a, b]) {
      expect(mainThreat(state)).toBe(6 - 2);
      expect(removals(events)).toEqual([{ scheme: state.mainScheme.instanceId, amount: 2 }]);
      expect(modified(events)).toEqual([]);
      expect(resolvedThwarts(events)).toEqual([2]);
    }
    expect(counter(a.state, declined.skill, "operative")).toBe(3);
  });
});
