/**
 * A "(thwart)"-labeled ability is a real thwart (owner decision, 2026-10-03), however its threat removal is written.
 *
 * - RRG 1.8 "Labeled Ability" (p. 26): "When a player resolves an ability labeled '(thwart),' that ability is
 *   considered to be a thwart made by that player's identity." That the card does not use the hero's THW is beside the
 *   point.
 * - RRG 1.8 "Patrol" (p. 32): "While a minion with the patrol keyword is engaged with a player, that player cannot use
 *   cards they control to thwart the main scheme." So patrol stops a labeled removal from the main scheme, and leaves
 *   an unlabeled "remove N threat" alone.
 * - RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a valid target for a thwart-labeled ability."
 * - RRG 1.8 "Thwart" (p. 44): "An ability labeled as a thwart is considered a single thwart, even if that thwart removes
 *   multiple instances of threat." Owner decision Q78 (docs/phase7-wave6.md §4.1): an "additional threat" modifier
 *   (Operative Skill's shape) increases each instance of threat removal.
 *
 * So `removeThreat`, `divide("threat")` and `modifyAttack.removesThreat` resolved by a "(thwart)" ability make `thwart`
 * events by the controller's identity, exactly as the `thwart` effect does. Synthetic cards; the default hero's THW is
 * not used by any of them. No FFG ruling in the post-RRG 1.7 transcript names these cards.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport } from "./testing/fixtures.js";
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
const MAIN: TargetRef = { kind: "mainScheme" };
const yourIdentity: TargetQuery = { categories: ["identity"], controller: "you" };
const chosen: TargetRef = { kind: "slot", slot: "scheme" };
const aScheme: EffectSpec = {
  kind: "chooseTarget",
  slot: "scheme",
  chooser: { kind: "controller" },
  query: { categories: ["scheme"] },
};
const action = (label: boolean, ...effects: EffectSpec[]): AbilityDefinition => ({
  trigger: { kind: "action" },
  ...(label ? { label: ["thwart"] as const } : {}),
  effects,
});

/** "Hero Action (thwart): Remove 3 threat from a scheme.", written as a plain removal. */
const LABELED = stubAbility(
  "labeled.action",
  action(true, aScheme, { kind: "removeThreat", target: chosen, amount: n(3) }),
);
/** "Hero Action: Remove 3 threat from a scheme." No label: not a thwart. */
const UNLABELED = stubAbility(
  "unlabeled.action",
  action(false, aScheme, { kind: "removeThreat", target: chosen, amount: n(3) }),
);
/** "Hero Action (thwart): Remove 2 threat from the main scheme. Draw 1 card." */
const LABELED_MAIN = stubAbility(
  "labeled-main.action",
  action(
    true,
    { kind: "removeThreat", target: MAIN, amount: n(2) },
    { kind: "draw", player: { kind: "controller" }, amount: n(1) },
  ),
);
/** "Hero Action (thwart): Remove 2 threat from the main scheme." and nothing else. */
const ONLY_MAIN = stubAbility("only-main.action", action(true, { kind: "removeThreat", target: MAIN, amount: n(2) }));
/** "Hero Action: Remove 2 threat from the main scheme. Draw 1 card." No label. */
const UNLABELED_MAIN = stubAbility(
  "unlabeled-main.action",
  action(
    false,
    { kind: "removeThreat", target: MAIN, amount: n(2) },
    { kind: "draw", player: { kind: "controller" }, amount: n(1) },
  ),
);
const draw1: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: n(1) };
/** Brainstorm's shape: "Hero Action (thwart): choose one: remove 2 threat from the main scheme, or draw 1 card." */
const BRANCHED = stubAbility(
  "branched.action",
  action(true, {
    kind: "chooseOne",
    chooser: { kind: "controller" },
    options: [
      { label: "Remove", effects: [{ kind: "removeThreat", target: MAIN, amount: n(2) }] },
      { label: "Draw", effects: [draw1] },
    ],
  }),
);
/** "Hero Action (thwart): Remove 1 threat from each scheme." */
const EACH = stubAbility(
  "each.action",
  action(true, {
    kind: "removeThreat",
    target: { kind: "each", query: { categories: ["scheme"] } },
    amount: n(1),
  }),
);
/**
 * Looking for Trouble's shape: "Hero Action (thwart): Discard cards from the top of the encounter deck until you discard
 * a minion. Put that minion into play engaged with you. Remove 2 threat from the main scheme."
 */
const FETCH = stubAbility(
  "fetch.action",
  action(
    true,
    { kind: "discardEncounterUntil", filter: { categories: ["minion"] }, bind: "found" },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
    { kind: "removeThreat", target: MAIN, amount: n(2) },
  ),
);
const divided = (upTo: boolean): EffectSpec => ({
  kind: "divide",
  what: "threat",
  amount: n(3),
  among: { categories: ["scheme"] },
  chooser: { kind: "controller" },
  ...(upTo ? { upTo: true as const } : {}),
});
/** "Hero Action (thwart): Remove a total of 3 threat from among schemes in play." (Inconspicuous's shape.) */
const SPREAD = stubAbility("spread.action", action(true, divided(false)));
/** "Hero Action (thwart): Remove a total of up to 3 threat from among schemes." (Agile Flight's shape.) */
const SPREAD_UP_TO = stubAbility("spread-up-to.action", action(true, divided(true)));
/** "Hero Action: Remove a total of 3 threat from among schemes in play." No label. */
const SPREAD_UNLABELED = stubAbility("spread-unlabeled.action", action(false, divided(false)));
/** "Interrupt (thwart): When the villain schemes, this activation removes threat instead of placing it." */
const MANIPULATE = stubAbility("manipulate.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", sourceIs: { categories: ["villain"] } } },
  label: ["thwart"],
  effects: [{ kind: "modifyAttack", removesThreat: true }],
} satisfies AbilityDefinition);
/** "Action: The villain schemes." */
const VILLAIN_SCHEMES = stubAbility(
  "goad.action",
  action(false, { kind: "enemyScheme", enemies: { kind: "villain" } }),
);
/** Operative Skill's shape: "Interrupt: When you thwart, remove 1 operative counter from here → 1 additional threat." */
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

/** "Forced Response: After you thwart, place 1 heard counter here." Counts the thwarts, not the threat. */
const HEARD = stubAbility("ledger.heard", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", sourceIs: yourIdentity } },
  effects: [{ kind: "addCounters", target: SELF, counterType: "heard", amount: n(1) }],
} satisfies AbilityDefinition);
/** "Forced Interrupt: When you thwart, place 1 began counter here." Counts the "when you thwart" windows. */
const BEGAN = stubAbility("ledger.began", {
  trigger: { kind: "interrupt", forced: true, on: { on: "thwart", sourceIs: yourIdentity } },
  effects: [{ kind: "addCounters", target: SELF, counterType: "began", amount: n(1) }],
} satisfies AbilityDefinition);
/** Back Alley Burglary's shape, on the side scheme: "Forced Response: After you thwart this scheme, place 1 counter here." */
const THWARTED_HERE = stubAbility("side.thwarted", {
  trigger: { kind: "response", forced: true, on: { on: "thwart", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: SELF, counterType: "thwarted", amount: n(1) }],
} satisfies AbilityDefinition);
/** "Interrupt: When you thwart, cancel that thwart." */
const VETO = stubAbility("veto.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "thwart", sourceIs: yourIdentity } },
  effects: [{ kind: "cancelTriggeringEvent" }],
} satisfies AbilityDefinition);
const another: TargetRef = { kind: "slot", slot: "scheme2" };
/**
 * Multitasking's shape: "Hero Action (thwart): Remove 2 threat from a scheme. Remove 2 threat from a different scheme.
 * Draw 1 card." Two sentences, two effects, one ability.
 */
const TWICE = stubAbility(
  "twice.action",
  action(
    true,
    aScheme,
    { kind: "removeThreat", target: chosen, amount: n(2) },
    {
      kind: "chooseTarget",
      slot: "scheme2",
      chooser: { kind: "controller" },
      query: { categories: ["scheme"], excludeSlots: ["scheme"] },
    },
    { kind: "removeThreat", target: another, amount: n(2) },
    draw1,
  ),
);
/**
 * Multitasking's shape: "Remove 2 threat from a scheme. If [always, here], remove 2 threat from a different scheme."
 * The second removal resolves in the `if`'s own branch frame.
 */
const TWICE_BRANCHED = stubAbility(
  "twice-branched.action",
  action(
    true,
    aScheme,
    { kind: "removeThreat", target: chosen, amount: n(2) },
    {
      kind: "if",
      condition: { kind: "not", of: { kind: "varAtLeast", name: "never", amount: 1 } },
      then: [
        {
          kind: "chooseTarget",
          slot: "scheme2",
          chooser: { kind: "controller" },
          query: { categories: ["scheme"], excludeSlots: ["scheme"] },
        },
        { kind: "removeThreat", target: another, amount: n(2) },
      ],
    },
  ),
);

const event = (id: string, ability: { readonly ref: { readonly id: string } }) =>
  stubEvent({ id, cost: 0, abilities: [ability.ref as never] });
const LABELED_CARD = event("labeled", LABELED);
const UNLABELED_CARD = event("unlabeled", UNLABELED);
const LABELED_MAIN_CARD = event("labeled-main", LABELED_MAIN);
const ONLY_MAIN_CARD = event("only-main", ONLY_MAIN);
const UNLABELED_MAIN_CARD = event("unlabeled-main", UNLABELED_MAIN);
const BRANCHED_CARD = event("branched", BRANCHED);
const EACH_CARD = event("each", EACH);
const FETCH_CARD = event("fetch", FETCH);
const TWICE_CARD = event("twice", TWICE);
const TWICE_BRANCHED_CARD = event("twice-branched", TWICE_BRANCHED);
const VETO_CARD = stubSupport({ id: "veto", cost: 0, abilities: [VETO.ref] });
const SPREAD_CARD = event("spread", SPREAD);
const SPREAD_UP_TO_CARD = event("spread-up-to", SPREAD_UP_TO);
const SPREAD_UNLABELED_CARD = event("spread-unlabeled", SPREAD_UNLABELED);
const MANIPULATOR = stubSupport({ id: "manipulator", cost: 0, abilities: [MANIPULATE.ref] });
const GOAD = stubSupport({ id: "goad", cost: 0, abilities: [VILLAIN_SCHEMES.ref] });
const SKILL_CARD = stubSupport({ id: "skill", cost: 0, abilities: [SKILL.ref] });
const LEDGER = stubSupport({ id: "ledger", cost: 0, abilities: [SEEN.ref, HEARD.ref, BEGAN.ref] });
const PATROLLER = stubMinion({ id: "patroller", atk: 0, sch: 0, hp: 5, keywords: [{ name: "patrol" }] });
const SIDE = stubSideScheme({ id: "side", startingThreat: 0, boostIcons: 0, abilities: [THWARTED_HERE.ref] });
const CRISIS = stubSideScheme({ id: "crisis-side", startingThreat: 0, icons: ["crisis"], boostIcons: 0 });

const deps: EngineDeps = depsOf(
  LABELED,
  UNLABELED,
  LABELED_MAIN,
  ONLY_MAIN,
  UNLABELED_MAIN,
  BRANCHED,
  EACH,
  FETCH,
  SPREAD,
  SPREAD_UP_TO,
  SPREAD_UNLABELED,
  MANIPULATE,
  VILLAIN_SCHEMES,
  SKILL,
  SEEN,
  HEARD,
  BEGAN,
  THWARTED_HERE,
  VETO,
  TWICE,
  TWICE_BRANCHED,
);
const PLAYER_CARDS = [
  LABELED_CARD,
  UNLABELED_CARD,
  LABELED_MAIN_CARD,
  ONLY_MAIN_CARD,
  UNLABELED_MAIN_CARD,
  BRANCHED_CARD,
  EACH_CARD,
  FETCH_CARD,
  SPREAD_CARD,
  SPREAD_UP_TO_CARD,
  SPREAD_UNLABELED_CARD,
  MANIPULATOR,
  GOAD,
  SKILL_CARD,
  LEDGER,
  TWICE_CARD,
  TWICE_BRANCHED_CARD,
  VETO_CARD,
];

interface Table {
  readonly state: GameState;
  readonly ledger: InstanceId;
  readonly side: InstanceId;
  readonly skill: InstanceId | null;
}

/** P1 in hero form, 6 threat on the main scheme, 5 on a side scheme, the ledger in play; the skill (3 counters) on request. */
function table(opts: { readonly skill?: boolean } = {}): Table {
  let state = gameAtFirstTurn({
    cards: [...PLAYER_CARDS, PATROLLER, SIDE, CRISIS],
    deps,
    encounter: [PATROLLER.id, SIDE.id, CRISIS.id, ...copiesOf("treachery" as CardId, 20)],
    deck: PLAYER_CARDS.map((c) => c.id),
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
  const ledger = playerCardIntoPlay(side.state, LEDGER.id);
  state = ledger.state;
  let skill: InstanceId | null = null;
  if (opts.skill) {
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
  return { state, ledger: ledger.id, side: side.id, skill };
}

interface Picks {
  /** The scheme a "choose a scheme" prompt takes. */
  readonly target?: InstanceId;
  /** How a division is spread: scheme → points. */
  readonly shares?: ReadonlyMap<InstanceId, number>;
  /** Ability ids to use whenever a window offers them. */
  readonly use?: readonly string[];
  /** Every option offered by a prompt of this kind is recorded here. */
  readonly offered?: { kind: string; ids: string[] };
}

const picker =
  (picks: Picks) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (picks.offered && choice.prompt.kind === picks.offered.kind) {
      picks.offered.ids.push(...choice.options.map((o) => o.optionId));
    }
    if (choice.prompt.kind === "chooseTarget" && picks.target) {
      const match = choice.options.find((o) => o.optionId === picks.target);
      if (match) return [match.optionId];
    }
    if (choice.prompt.kind === "divide" && picks.shares) {
      return [...picks.shares].flatMap(([id, points]) => Array.from({ length: points }, (_, i) => `${id}#${i + 1}`));
    }
    const wanted = (picks.use ?? []).flatMap((id) =>
      choice.options.filter((o) => o.optionId.includes(id)).map((o) => o.optionId),
    );
    return wanted.length > 0 ? wanted.slice(0, Math.max(1, choice.maxSelections)) : defaultPick(state);
  };

/** Runs `commands`, checks the log replays to the same state (deep-equal), and returns the run. */
function run(state: GameState, picks: Picks, ...commands: Command[]) {
  const result = runCommandsPicking(state, deps, picker(picks), ...commands);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});
/** Gives P1 the card and plays it. */
function playing(state: GameState, card: CardId, picks: Picks = {}) {
  const given = giveCard(state, P1, card);
  return run(given.state, picks, play(given.id));
}

const hero = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const mainThreat = (state: GameState): number => threatOn(state, state.mainScheme.instanceId);
const counter = (state: GameState, id: InstanceId | null, type: string): number =>
  id === null ? 0 : (mustInstance(state, id).counters[type] ?? 0);
const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const removals = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemoved" ? [{ scheme: e.schemeInstanceId, amount: e.amount }] : []));
const blocked = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemovalBlocked" ? [e.reason] : []));
/** The thwarts that resolved: who thwarted, which scheme, and the threat each actually removed. */
const thwarts = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart"
      ? [{ by: e.event.thwarterInstanceId, scheme: e.event.schemeInstanceId, amount: e.event.amount }]
      : [],
  );
/** The resolved thwarts' instances of threat removal (`thwart.instances`): one list per thwart, empty for a single instance. */
const instancesOf = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart"
      ? [(e.event.instances ?? []).map((i) => [i.schemeInstanceId, i.amount] as const)]
      : [],
  );
/** How many "when you thwart" windows opened: the thwarts that initiated. */
const initiated = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "thwart").length;

describe("a '(thwart)'-labeled ability's threat removal is a thwart by its controller's identity (RRG 1.8 p. 26; owner decision 2026-10-03)", () => {
  it("'(thwart): remove 3 threat from a scheme' is a thwart by your identity, and 'after you thwart' hears it", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(t.state, LABELED_CARD.id, { target: main });
    expect(mainThreat(after)).toBe(6 - 3);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: main, amount: 3 }]);
    expect(removals(events)).toEqual([{ scheme: main, amount: 3 }]);
    expect(counter(after, t.ledger, "seen")).toBe(3);
  });

  it("an unlabeled 'remove 3 threat from a scheme' stays a plain removal: no thwart, no 'after you thwart'", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(t.state, UNLABELED_CARD.id, { target: main });
    expect(mainThreat(after)).toBe(6 - 3);
    expect(thwarts(events)).toEqual([]);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });

  // Owner decision, 2026-10-03: this used to play the card, block the removal and resolve the draw. A "(thwart)" that
  // names only the main scheme has no valid target while patrolled, whatever else it does (Impede, Looking for Trouble).
  it("owner decision 2026-10-03: '(thwart): remove 2 threat from the main scheme. Draw 1 card.' cannot be played while patrolled, and nothing of it resolves (RRG 1.8 'Target', p. 43; 'Patrol', p. 32)", () => {
    const t = table();
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const given = giveCard(patrolled, P1, LABELED_MAIN_CARD.id);
    const refused = sessionApply(startSession(given.state), play(given.id), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    // Without the patrol minion it plays: a thwart, then the draw.
    const held = giveCard(t.state, P1, LABELED_MAIN_CARD.id);
    const free = run(held.state, {}, play(held.id));
    expect(mainThreat(free.state)).toBe(6 - 2);
    expect(thwarts(free.events)).toHaveLength(1);
    // The event left the hand and its "draw 1 card" resolved.
    expect(handSize(free.state)).toBe(handSize(held.state) - 1 + 1);
  });

  it("patrol does not stop an unlabeled removal from the main scheme", () => {
    const t = table();
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const { state: after, events } = playing(patrolled, UNLABELED_MAIN_CARD.id);
    expect(mainThreat(after)).toBe(6 - 2);
    expect(blocked(events)).toEqual([]);
  });

  it("while patrolled the main scheme is no target for a labeled removal: only the side scheme is offered (RRG 1.8 'Target', p. 43)", () => {
    const t = table();
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const offered = { kind: "chooseTarget", ids: [] as string[] };
    const { state: after, events } = playing(patrolled, LABELED_CARD.id, { offered });
    // A single valid target may be taken without a prompt; either way the main scheme was never offered.
    expect(offered.ids).not.toContain(t.state.mainScheme.instanceId);
    expect(mainThreat(after)).toBe(6);
    expect(threatOn(after, t.side)).toBe(5 - 3);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: t.side, amount: 3 }]);
  });

  it("'(thwart): remove 2 threat from the main scheme' alone cannot be played while patrolled (RRG 1.8 'Target', p. 43)", () => {
    const t = table();
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const given = giveCard(patrolled, P1, ONLY_MAIN_CARD.id);
    const result = sessionApply(startSession(given.state), play(given.id), deps);
    expect(result.ok).toBe(false);
    // Without the patrol minion it plays, as a thwart.
    const free = playing(t.state, ONLY_MAIN_CARD.id);
    expect(mainThreat(free.state)).toBe(6 - 2);
    expect(thwarts(free.events)).toHaveLength(1);
  });

  it("owner decision 2026-10-03: under a crisis icon the same card cannot be played, and no zero-amount thwart is raised (RRG 1.8 'Target', p. 43; 'Crisis Icon', p. 14)", () => {
    const t = table();
    const crisis = encounterCardInVillainArea(t.state, CRISIS.id, 1);
    const given = giveCard(crisis.state, P1, LABELED_MAIN_CARD.id);
    const refused = sessionApply(startSession(given.state), play(given.id), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
  });

  it("'that thwart removes 1 additional threat' adds to a labeled removal", () => {
    const t = table({ skill: true });
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(t.state, LABELED_CARD.id, { target: main, use: [SKILL.ref.id] });
    expect(mainThreat(after)).toBe(6 - 4);
    expect(removals(events)).toEqual([{ scheme: main, amount: 4 }]);
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(counter(after, t.ledger, "seen")).toBe(4);
  });
});

describe("owner decision 2026-10-03: a '(thwart)' whose threat removal names no scheme its player can thwart cannot be initiated (RRG 1.8 'Target', pp. 42-43)", () => {
  const refusedCode = (state: GameState, card: CardId): string | null => {
    const given = giveCard(state, P1, card);
    const result = sessionApply(startSession(given.state), play(given.id), deps);
    return result.ok ? null : result.error.code;
  };
  const patrolled = (state: GameState): GameState => minionEngagedWith(state, PATROLLER.id).state;
  const underCrisis = (state: GameState): GameState => encounterCardInVillainArea(state, CRISIS.id, 1).state;

  it("a removal from the main scheme inside an option is judged too: not playable while patrolled or under a crisis icon", () => {
    const t = table();
    expect(refusedCode(patrolled(t.state), BRANCHED_CARD.id)).toBe("no_valid_target");
    expect(refusedCode(underCrisis(t.state), BRANCHED_CARD.id)).toBe("no_valid_target");
    expect(refusedCode(t.state, BRANCHED_CARD.id)).toBeNull();
  });

  it("'remove 1 threat from each scheme' is playable while one scheme can be thwarted, and raises no thwart on the patrolled main scheme (RRG 1.8 'Target', p. 43)", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(patrolled(t.state), EACH_CARD.id);
    expect(mainThreat(after)).toBe(6);
    expect(threatOn(after, t.side)).toBe(5 - 1);
    expect(blocked(events)).toEqual(["patrol"]);
    // No zero-amount thwart on the main scheme: only the side scheme was thwarted.
    expect(thwarts(events).map((h) => h.scheme)).toEqual([t.side]);
    expect(thwarts(events).some((h) => h.scheme === main)).toBe(false);
  });

  it("'remove 1 threat from each scheme' with only an unthwartable main scheme in play cannot be played", () => {
    const t = table();
    const alone: GameState = { ...t.state, villainArea: t.state.villainArea.filter((id) => id !== t.side) };
    expect(refusedCode(patrolled(alone), EACH_CARD.id)).toBe("no_valid_target");
    expect(refusedCode(alone, EACH_CARD.id)).toBeNull();
  });

  it("a choice of schemes is playable while one can be thwarted; with none it is not", () => {
    const t = table();
    const alone: GameState = { ...t.state, villainArea: t.state.villainArea.filter((id) => id !== t.side) };
    expect(refusedCode(patrolled(t.state), LABELED_CARD.id)).toBeNull();
    expect(refusedCode(patrolled(alone), LABELED_CARD.id)).toBe("no_valid_target");
    expect(refusedCode(patrolled(alone), SPREAD_CARD.id)).toBe("no_valid_target");
    expect(refusedCode(patrolled(alone), SPREAD_UP_TO_CARD.id)).toBe("no_valid_target");
    // An unlabeled removal is not a thwart: patrol does not make the main scheme invalid for it.
    expect(refusedCode(patrolled(alone), SPREAD_UNLABELED_CARD.id)).toBeNull();
  });

  it("a scheme that becomes unthwartable as the ability resolves (the minion it puts into play has patrol) is not thwarted: no thwart event, no 'after you thwart'", () => {
    const t = table();
    const { state: after, events } = playing(t.state, FETCH_CARD.id);
    expect(mainThreat(after)).toBe(6);
    expect(blocked(events)).toEqual(["patrol"]);
    expect(thwarts(events)).toEqual([]);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });
});

describe("a '(thwart)' that removes a total of N threat from among schemes (RRG 1.8 'Thwart', p. 44)", () => {
  // Owner decision, 2026-10-03 (RRG 1.8 "Thwart", p. 44): this pinned one resolved thwart per scheme, each answered by
  // "after you thwart". It is one thwart: one "when you thwart" window, one "after you thwart" window.
  it("owner decision 2026-10-03: a division over two schemes is ONE thwart: 'when you thwart' and 'after you thwart' are each heard once, the response sees the total (RRG 1.8 'Thwart', p. 44)", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { state: after, events } = playing(t.state, SPREAD_CARD.id, { shares });
    expect(mainThreat(after)).toBe(6 - 2);
    expect(threatOn(after, t.side)).toBe(5 - 1);
    // Each instance is still its own removal.
    expect(removals(events)).toEqual([
      { scheme: main, amount: 2 },
      { scheme: t.side, amount: 1 },
    ]);
    // One resolved thwart: its scheme is the first instance's, its amount the total, its instances both.
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: main, amount: 3 }]);
    expect(instancesOf(events)).toEqual([
      [
        [main, 2],
        [t.side, 1],
      ],
    ]);
    expect(initiated(events)).toBe(1);
    expect(counter(after, t.ledger, "began")).toBe(1);
    expect(counter(after, t.ledger, "heard")).toBe(1);
    expect(counter(after, t.ledger, "seen")).toBe(3);
  });

  it("the thwart's targets are every scheme an instance was aimed at: 'after you thwart this scheme' on the second scheme hears it, once", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { state: after } = playing(t.state, SPREAD_CARD.id, { shares });
    expect(counter(after, t.side, "thwarted")).toBe(1);
    // A division that leaves the side scheme alone is not a thwart of it.
    const mainOnly = playing(t.state, SPREAD_CARD.id, { shares: new Map([[main, 3]]) });
    expect(counter(mainOnly.state, t.side, "thwarted")).toBe(0);
    expect(instancesOf(mainOnly.events)).toEqual([[]]);
  });

  it("two 'remove 2 threat from a scheme' sentences in one (thwart) ability are one thwart, answered after the ability's last effect (RRG 1.8 'Thwart', p. 44)", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(t.state, TWICE_CARD.id, { target: main });
    expect(mainThreat(after)).toBe(6 - 2);
    expect(threatOn(after, t.side)).toBe(5 - 2);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: main, amount: 4 }]);
    expect(initiated(events)).toBe(1);
    expect(counter(after, t.ledger, "began")).toBe(1);
    expect(counter(after, t.ledger, "heard")).toBe(1);
    expect(counter(after, t.ledger, "seen")).toBe(4);
    // The response follows the whole ability: the card's "draw 1 card" is logged before the resolved thwart.
    const drew = events.findIndex((e) => e.type === "cardDrawn");
    const resolved = events.findIndex(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart",
    );
    expect(drew).toBeGreaterThan(-1);
    expect(resolved).toBeGreaterThan(drew);
  });

  it("a second removal inside an 'if' branch belongs to the same thwart (Multitasking's shape)", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const { state: after, events } = playing(t.state, TWICE_BRANCHED_CARD.id, { target: main });
    expect(mainThreat(after)).toBe(6 - 2);
    expect(threatOn(after, t.side)).toBe(5 - 2);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: main, amount: 4 }]);
    expect(instancesOf(events)).toEqual([
      [
        [main, 2],
        [t.side, 2],
      ],
    ]);
    expect(counter(after, t.ledger, "began")).toBe(1);
    expect(counter(after, t.ledger, "heard")).toBe(1);
  });

  it("an instance that defeats a side scheme still announces the defeat, by the thwarting player", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const low: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.side]: { ...mustInstance(t.state, t.side), threat: 1 } },
    };
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { events } = playing(low, SPREAD_CARD.id, { shares });
    const defeats = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "schemeDefeated"
        ? [[e.event.instanceId, e.event.defeatedByPlayerId]]
        : [],
    );
    expect(defeats).toEqual([[t.side, P1]]);
    expect(thwarts(events)).toHaveLength(1);
  });

  it("cancelling that thwart in its one 'when you thwart' window cancels every instance, and nothing answers it", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const veto = playerCardIntoPlay(t.state, VETO_CARD.id);
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { state: after, events } = playing(veto.state, SPREAD_CARD.id, { shares, use: [VETO.ref.id] });
    expect(mainThreat(after)).toBe(6);
    expect(threatOn(after, t.side)).toBe(5);
    expect(removals(events)).toEqual([]);
    expect(thwarts(events)).toEqual([]);
    expect(counter(after, t.ledger, "heard")).toBe(0);
  });

  // The threat amounts are the Q78 decision's and are unchanged. The counter was 1 (two counters spent, one per
  // thwart event); with one thwart the interrupt is used once and its 1 additional threat goes to each instance.
  it("owner decision Q78: an 'additional threat' modifier increases each instance of threat removal, used once for the one thwart (RRG 1.8 'Thwart', p. 44)", () => {
    const t = table({ skill: true });
    const main = t.state.mainScheme.instanceId;
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { state: after, events } = playing(t.state, SPREAD_CARD.id, { shares, use: [SKILL.ref.id] });
    // 2 + 1 from the main scheme and 1 + 1 from the side scheme.
    expect(mainThreat(after)).toBe(6 - 3);
    expect(threatOn(after, t.side)).toBe(5 - 2);
    expect(removals(events)).toEqual([
      { scheme: main, amount: 3 },
      { scheme: t.side, amount: 2 },
    ]);
    expect(counter(after, t.skill, "operative")).toBe(2);
    expect(counter(after, t.ledger, "seen")).toBe(5);
    expect(counter(after, t.ledger, "heard")).toBe(1);
  });

  // Owner decision, 2026-10-03: this used to offer the main scheme a share and then not remove it. Only schemes the
  // player can thwart are offered, "up to" or not; with one left it takes the whole total.
  it("while patrolled the main scheme is not offered a share, so the side scheme takes it all (RRG 1.8 'Target', p. 43)", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const offered = { kind: "divide", ids: [] as string[] };
    const { state: after, events } = playing(patrolled, SPREAD_CARD.id, { offered });
    expect(offered.ids.some((id) => id.startsWith(main))).toBe(false);
    expect(mainThreat(after)).toBe(6);
    expect(threatOn(after, t.side)).toBe(5 - 3);
    expect(blocked(events)).toEqual([]);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: t.side, amount: 3 }]);
    expect(counter(after, t.ledger, "seen")).toBe(3);
  });

  it("'up to N': while patrolled the main scheme is not offered a share", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const offered = { kind: "divide", ids: [] as string[] };
    const { state: after } = playing(patrolled, SPREAD_UP_TO_CARD.id, { offered, shares: new Map([[t.side, 3]]) });
    expect(offered.ids.length).toBeGreaterThan(0);
    expect(offered.ids.some((id) => id.startsWith(main))).toBe(false);
    expect(mainThreat(after)).toBe(6);
    expect(threatOn(after, t.side)).toBe(5 - 3);
  });

  it("an unlabeled division stays plain removal: patrol does not stop it and nothing thwarts", () => {
    const t = table();
    const main = t.state.mainScheme.instanceId;
    const patrolled = minionEngagedWith(t.state, PATROLLER.id).state;
    const shares = new Map([
      [main, 2],
      [t.side, 1],
    ]);
    const { state: after, events } = playing(patrolled, SPREAD_UNLABELED_CARD.id, { shares });
    expect(mainThreat(after)).toBe(6 - 2);
    expect(threatOn(after, t.side)).toBe(5 - 1);
    expect(thwarts(events)).toEqual([]);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });
});

describe("'Interrupt (thwart): When the villain schemes, this activation removes threat instead of placing it'", () => {
  /** The manipulator and the goad in play; P1 uses the goad, so the villain schemes. */
  function scheming(state: GameState) {
    const manipulator = playerCardIntoPlay(state, MANIPULATOR.id);
    const goad = playerCardIntoPlay(manipulator.state, GOAD.id);
    return run(
      goad.state,
      {},
      {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: goad.id,
        abilityId: VILLAIN_SCHEMES.ref.id,
        payment: [],
      },
    );
  }
  const total = (events: readonly GameEvent[]): number => {
    const resolved = events.find((e) => e.type === "schemeResolved");
    if (resolved?.type !== "schemeResolved") throw new Error("the villain did not scheme");
    expect(resolved.threatPlaced).toBe(0);
    expect(resolved.removesThreat).toBe(true);
    return resolved.baseSch + resolved.boostIcons + resolved.threatBonus;
  };

  it("the removal is a thwart by your identity: 'after you thwart' hears it with the threat removed", () => {
    const t = table();
    const { state: after, events } = scheming(t.state);
    const amount = Math.min(6, total(events));
    expect(amount).toBeGreaterThan(0);
    expect(mainThreat(after)).toBe(6 - amount);
    expect(thwarts(events)).toEqual([{ by: hero(after), scheme: after.mainScheme.instanceId, amount }]);
    expect(counter(after, t.ledger, "seen")).toBe(amount);
  });

  it("while you are patrolled nothing is removed, and nothing is placed either (RRG 1.8 'Patrol', p. 32)", () => {
    const t = table();
    const { state: after, events } = scheming(minionEngagedWith(t.state, PATROLLER.id).state);
    expect(total(events)).toBeGreaterThan(0);
    expect(mainThreat(after)).toBe(6);
    expect(blocked(events)).toEqual(["patrol"]);
    expect(events.some((e) => e.type === "threatPlaced")).toBe(false);
    expect(counter(after, t.ledger, "seen")).toBe(0);
  });

  it("with a crisis icon in play nothing is removed and nothing is placed (docs/phase7-wave6.md §4.1 Q17)", () => {
    const t = table();
    const { state: after, events } = scheming(encounterCardInVillainArea(t.state, CRISIS.id, 1).state);
    expect(mainThreat(after)).toBe(6);
    expect(blocked(events)).toEqual(["crisis"]);
    expect(events.some((e) => e.type === "threatPlaced")).toBe(false);
  });
});
