/**
 * Activation-scoped boost changes carried by the effect that starts the activation (docs/phase7-wave5.md §4.1 Q66):
 * `enemyAttack`/`enemyScheme` `extraBoostCards` ("The villain attacks you. Give the villain 1 additional boost card for
 * that activation", Swinging Assault, `sm` 27168) and `boostIconsEach` ("Venom activates against you. Each boost card
 * turned faceup during that activation gets +1 boost icon", Biting Retort, `sm` 27082).
 *
 * Both are seeded on the activation's own event frame, the `atkBonus` precedent: boost cards are dealt at the start of
 * the activation and turned faceup one at a time before damage (RRG 1.8 "Boost, Boost Icon", p. 11), so the frame's
 * vars are in place for both, and they end with the frame. An effect after the `enemyAttack` in the same list runs once
 * the activation has fully resolved (RRG 1.8 "Activation", p. 6), which is why `modifyAttack` there is too late. No
 * activation (a stun, RRG 1.8 "Stun"), no extra card and no lingering change. Synthetic cards throughout.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const one = { kind: "const", value: 1 } as const;

const attacksYou = (extra: Partial<Extract<EffectSpec, { kind: "enemyAttack" }>> = {}): EffectSpec => ({
  kind: "enemyAttack",
  enemies: { kind: "named", name: "villain" },
  against: { kind: "controller" },
  ...extra,
});

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects }));

/** "The villain attacks you. Give the villain 1 additional boost card for that activation." */
const ASSAULT_ABILITY = action("assault.action", [attacksYou({ extraBoostCards: 1 })]);
/** The composition the Q66 primitive replaces: `modifyAttack` after the attack runs once it has resolved. */
const LATE_ABILITY = action("late.action", [attacksYou(), { kind: "modifyAttack", extraBoostCards: 1 }]);
/** "The villain attacks you. Each boost card turned faceup during that activation gets +1 boost icon." */
const RETORT_ABILITY = action("retort.action", [attacksYou({ boostIconsEach: one })]);
/** Both at once: 2 boost cards, each with +1. */
const BOTH_ABILITY = action("both.action", [attacksYou({ extraBoostCards: 1, boostIconsEach: one })]);
/** A scheme activation with both. */
const PLOT_ABILITY = action("plot.action", [
  {
    kind: "enemyScheme",
    enemies: { kind: "named", name: "villain" },
    against: { kind: "controller" },
    extraBoostCards: 1,
    boostIconsEach: one,
  },
]);
/** "Forced Interrupt: When the villain attacks you, each boost card turned faceup during this activation gets +1."
 * The "current activation" form: `modifyAttack.boostIconsEach`. */
const HALO_ABILITY = stubAbility(
  "halo.interrupt",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
    },
    effects: [{ kind: "modifyAttack", boostIconsEach: one }],
  }),
);
/** A plain attack: the next activation, which none of the above may reach. */
const PLAIN_ABILITY = action("plain.action", [attacksYou()]);

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const ASSAULT = support("assault", ASSAULT_ABILITY);
const LATE = support("late", LATE_ABILITY);
const RETORT = support("retort", RETORT_ABILITY);
const BOTH = support("both", BOTH_ABILITY);
const PLOT = support("plot", PLOT_ABILITY);
const PLAIN = support("plain", PLAIN_ABILITY);
const HALO = support("halo", HALO_ABILITY);
/** Every encounter card has exactly 1 boost icon and no Boost ability. */
const ONE = stubTreachery({ id: "one", boostIcons: 1 });

const deps: EngineDeps = depsOf(
  ASSAULT_ABILITY,
  LATE_ABILITY,
  RETORT_ABILITY,
  BOTH_ABILITY,
  PLOT_ABILITY,
  PLAIN_ABILITY,
  HALO_ABILITY,
);

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: abilityId as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  readonly first: InstanceId;
  readonly plain: InstanceId;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
}

/** Hero form; `first` and Plain in play. Villain ATK 1, SCH 0; undefended attacks (default pick declines). */
function setup(first: typeof ASSAULT, stunned = false): Setup {
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 0 }] }),
    mainScheme: stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [ONE, first, PLAIN],
    deck: [first.id, PLAIN.id, ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(ONE.id, 20),
    deps,
  });
  const given = giveCards(state, p1, first.id, PLAIN.id);
  const [firstId, plainId] = given.ids as [InstanceId, InstanceId];
  let ready = runWith(deps, given.state, { type: "changeForm", playerId: p1 }, play(firstId), play(plainId));
  const villain = Object.values(ready.instances).find((i) => i.cardId === "villain")!;
  if (stunned) {
    ready = {
      ...ready,
      instances: {
        ...ready.instances,
        [villain.instanceId]: { ...villain, statuses: { ...villain.statuses, stunned: 1 } },
      },
    };
  }
  return {
    state: ready,
    first: firstId,
    plain: plainId,
    villain: villain.instanceId,
    hero: mustPlayer(ready, p1).identity.instanceId,
  };
}

type Flipped = Extract<GameEvent, { type: "boostCardFlipped" }>;
const flips = (events: readonly GameEvent[]): readonly Flipped[] =>
  events.filter((e): e is Flipped => e.type === "boostCardFlipped");

function run(s: Setup, commands: readonly Command[]) {
  return driveSession(startSession(s.state), deps, commands, defaultPick);
}

describe("enemyAttack extraBoostCards — 'Give the villain 1 additional boost card for that activation'", () => {
  it("the extra card is dealt at the start of that attack and flipped in it", () => {
    const s = setup(ASSAULT);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.first, ASSAULT_ABILITY.ref.id)]);
    expect(events.filter((e) => e.type === "boostCardDealt")).toHaveLength(2);
    expect(flips(events)).toHaveLength(2);
    // ATK 1 + 2 boost icons, undefended.
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 3);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
  });

  it("control: a modifyAttack after the enemyAttack comes too late for that attack", () => {
    const s = setup(LATE);
    const { events } = run(s, [use(s.first, LATE_ABILITY.ref.id)]);
    expect(flips(events)).toHaveLength(1);
  });

  it("the next activation gets the ordinary single boost card", () => {
    const s = setup(ASSAULT);
    const { session, events } = run(s, [use(s.first, ASSAULT_ABILITY.ref.id)]);
    const next = run({ ...s, state: session.state }, [use(s.plain, PLAIN_ABILITY.ref.id)]);
    expect(flips(events)).toHaveLength(2);
    expect(flips(next.events)).toHaveLength(1);
  });

  it("no attack (the villain is stunned): no card is dealt and none waits for the next activation", () => {
    const s = setup(ASSAULT, true);
    const deckBefore = Object.values(s.state.encounterDecks)[0]!.deck.length;
    const { session, events } = run(s, [use(s.first, ASSAULT_ABILITY.ref.id)]);
    expect(session.state.instances[s.villain]!.statuses.stunned ?? 0).toBe(0);
    expect(events.some((e) => e.type === "boostCardDealt")).toBe(false);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    expect(Object.values(session.state.encounterDecks)[0]!.deck.length).toBe(deckBefore);
    const next = run({ ...s, state: session.state }, [use(s.plain, PLAIN_ABILITY.ref.id)]);
    expect(flips(next.events)).toHaveLength(1);
  });
});

describe("enemyAttack boostIconsEach — 'Each boost card turned faceup during that activation gets +1 boost icon'", () => {
  it("each boost card flipped in that attack gets +1, at the flip and at the count", () => {
    const s = setup(RETORT);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.first, RETORT_ABILITY.ref.id)]);
    expect(flips(events).map((e) => e.boostIcons)).toEqual([2]);
    // ATK 1 + (1 + 1).
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 3);
  });

  it("with extraBoostCards: both of that activation's cards get +1", () => {
    const s = setup(BOTH);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.first, BOTH_ABILITY.ref.id)]);
    expect(flips(events).map((e) => e.boostIcons)).toEqual([2, 2]);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 5);
  });

  it("expires with that activation: the next attack's boost card has its printed icons only", () => {
    const s = setup(RETORT);
    const lastingBefore = s.state.lastingEffects.length;
    const first = run(s, [use(s.first, RETORT_ABILITY.ref.id)]);
    expect(first.session.state.lastingEffects).toHaveLength(lastingBefore);
    const damage = first.session.state.instances[s.hero]!.damage;
    const next = run({ ...s, state: first.session.state }, [use(s.plain, PLAIN_ABILITY.ref.id)]);
    expect(flips(next.events).map((e) => e.boostIcons)).toEqual([1]);
    expect(next.session.state.instances[s.hero]!.damage).toBe(damage + 2);
  });

  it("no attack (the villain is stunned): the next activation is unchanged", () => {
    const s = setup(RETORT, true);
    const { session, events } = run(s, [use(s.first, RETORT_ABILITY.ref.id)]);
    expect(flips(events)).toEqual([]);
    const next = run({ ...s, state: session.state }, [use(s.plain, PLAIN_ABILITY.ref.id)]);
    expect(flips(next.events).map((e) => e.boostIcons)).toEqual([1]);
  });
});

describe("modifyAttack boostIconsEach — the activation in progress", () => {
  it("an interrupt to the attack gives each of its boost cards +1", () => {
    const s = setup(HALO);
    const { events } = run(s, [use(s.plain, PLAIN_ABILITY.ref.id)]);
    expect(flips(events).map((e) => e.boostIcons)).toEqual([2]);
  });
});

describe("enemyScheme carries the same activation-scoped changes", () => {
  it("2 boost cards, each with +1: SCH 0 + 4 threat", () => {
    const s = setup(PLOT);
    const scheme = s.state.mainScheme!.instanceId;
    const threat = s.state.instances[scheme]!.threat;
    const { session, events } = run(s, [use(s.first, PLOT_ABILITY.ref.id)]);
    expect(flips(events).map((e) => e.boostIcons)).toEqual([2, 2]);
    expect(session.state.instances[scheme]!.threat).toBe(threat + 4);
  });
});

describe("replay", () => {
  it("replays deep-equal", () => {
    const s = setup(BOTH);
    const { session } = run(s, [use(s.first, BOTH_ABILITY.ref.id), use(s.plain, PLAIN_ABILITY.ref.id)]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
