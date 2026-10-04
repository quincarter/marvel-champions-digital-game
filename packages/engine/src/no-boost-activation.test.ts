/**
 * docs/phase7-wave6.md §3.15: withholding the boost card from the activation in progress. Master Mold I–III (`mut_gen`
 * 32109–32111): "Forced Interrupt: When Master Mold schemes against you, … Do not give Master Mold a boost card for
 * this activation." `modifyAttack.noBoost` rides the activation's own event frame and is read at its `giveBoost` step,
 * beside `extraBoost`: no automatic boost card and no additional ones, whichever effect asked for them. A boost card
 * dealt to the enemy outside the activation still turns faceup and resolves in it (RRG 1.8 "Boost", p. 11). The
 * change ends with the activation. Synthetic cards throughout; every encounter card has exactly 1 boost icon.
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
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;
const you = { kind: "controller" } as const;

/** "Forced Interrupt: When [this villain] schemes against you, … Do not give [it] a boost card for this activation." */
const MOLD_SCHEMES = stubAbility(
  "mold.schemes",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme", selfIs: "source" } },
    effects: [{ kind: "modifyAttack", noBoost: true }],
  }),
);
/** The same sentence on an attack. */
const MOLD_ATTACKS = stubAbility(
  "mold.attacks",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
    effects: [{ kind: "modifyAttack", noBoost: true }],
  }),
);
/** Another effect in the same activation: "When the villain schemes, give it 1 additional boost card." */
const EXTRA_ABILITY = stubAbility(
  "extra.interrupt",
  def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyScheme" } },
    effects: [{ kind: "modifyAttack", extraBoostCards: 1 }],
  }),
);

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects }));
/** "The villain schemes against you." */
const SCHEME_ABILITY = action("scheme.action", [{ kind: "enemyScheme", enemies: theVillain, against: you }]);
/** "The villain schemes against you. Give the villain 1 additional boost card for that activation." */
const BIG_SCHEME_ABILITY = action("big-scheme.action", [
  { kind: "enemyScheme", enemies: theVillain, against: you, extraBoostCards: 1 },
]);
/** "The villain attacks you." */
const ATTACK_ABILITY = action("attack.action", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
/** "The villain attacks you. That attack does not get a boost card." (the effect-initiated `noBoost`) */
const QUIET_ABILITY = action("quiet.action", [
  { kind: "enemyAttack", enemies: theVillain, against: you, boost: false },
]);
/** "Give the villain 1 facedown boost card": dealt outside any activation. */
const GIVE_ABILITY = action("give.action", [{ kind: "giveBoostCard", enemy: theVillain }]);

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const SCHEME = support("scheme", SCHEME_ABILITY);
const BIG_SCHEME = support("big-scheme", BIG_SCHEME_ABILITY);
const ATTACK = support("attack", ATTACK_ABILITY);
const QUIET = support("quiet", QUIET_ABILITY);
const GIVE = support("give", GIVE_ABILITY);
const EXTRA = support("extra", EXTRA_ABILITY);
const ONE = stubTreachery({ id: "one", boostIcons: 1 });

const deps: EngineDeps = depsOf(
  MOLD_SCHEMES,
  MOLD_ATTACKS,
  EXTRA_ABILITY,
  SCHEME_ABILITY,
  BIG_SCHEME_ABILITY,
  ATTACK_ABILITY,
  QUIET_ABILITY,
  GIVE_ABILITY,
);

type Villain = "schemes" | "attacks" | "plain";
const villainOf = (kind: Villain) =>
  stubVillain({
    id: "villain",
    stages: [
      {
        hp: flat(30),
        atk: 2,
        sch: 1,
        abilities: kind === "schemes" ? [MOLD_SCHEMES.ref] : kind === "attacks" ? [MOLD_ATTACKS.ref] : [],
      },
    ],
  });

const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const use = (id: InstanceId, ability: StubAbility): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: id,
  abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
  payment: [],
});

interface Setup {
  readonly state: GameState;
  /** The supports in play, by card id. */
  readonly cards: Readonly<Record<string, InstanceId>>;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
  readonly scheme: InstanceId;
}

/** Villain ATK 2, SCH 1; `inPlay` supports in play; hero form unless `alterEgo`; undefended attacks. */
function setup(villain: Villain, inPlay: readonly (typeof SCHEME)[], alterEgo = false): Setup {
  const state = newGame({
    villain: villainOf(villain),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [ONE, SCHEME, BIG_SCHEME, ATTACK, QUIET, GIVE, EXTRA],
    deck: [...inPlay.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: copies(ONE.id, 20),
    deps,
  });
  const given = giveCards(state, p1, ...inPlay.map((c) => c.id));
  const ids = given.ids as readonly InstanceId[];
  const ready = runWith(
    deps,
    given.state,
    ...(alterEgo ? [] : [{ type: "changeForm", playerId: p1 } as Command]),
    ...ids.map(play),
  );
  return {
    state: ready,
    cards: Object.fromEntries(inPlay.map((c, i) => [c.id, ids[i]!])),
    villain: Object.values(ready.instances).find((i) => i.cardId === "villain")!.instanceId,
    hero: mustPlayer(ready, p1).identity.instanceId,
    scheme: ready.mainScheme.instanceId,
  };
}

function run(s: Setup, commands: readonly Command[]) {
  return driveSession(startSession(s.state), deps, commands, defaultPick);
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const deckSize = (state: GameState) => Object.values(state.encounterDecks)[0]!.deck.length;

describe("modifyAttack noBoost — Master Mold's 'Do not give Master Mold a boost card for this activation'", () => {
  it("a scheme: no boost card is dealt, the encounter deck is unchanged, the threat is SCH alone", () => {
    const s = setup("schemes", [SCHEME]);
    const deck = deckSize(s.state);
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards.scheme!, SCHEME_ABILITY)]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "boostCardFlipped")).toEqual([]);
    expect(of(events, "boostWithheld")).toEqual([
      { type: "boostWithheld", enemyInstanceId: s.villain, activation: "scheme" },
    ]);
    expect(deckSize(session.state)).toBe(deck);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 1);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
  });

  it("an attack: no boost card is dealt and the damage is ATK alone", () => {
    const s = setup("attacks", [ATTACK]);
    const deck = deckSize(s.state);
    const damage = s.state.instances[s.hero]!.damage;
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "boostWithheld")).toEqual([
      { type: "boostWithheld", enemyInstanceId: s.villain, activation: "attack" },
    ]);
    expect(deckSize(session.state)).toBe(deck);
    expect(session.state.instances[s.hero]!.damage).toBe(damage + 2);
  });

  it("extra boost cards from another effect in the same activation are withheld too", () => {
    // `extraBoostCards` from the effect that starts the activation, and from another forced interrupt to it.
    const s = setup("schemes", [BIG_SCHEME, EXTRA]);
    const deck = deckSize(s.state);
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards["big-scheme"]!, BIG_SCHEME_ABILITY)]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(deckSize(session.state)).toBe(deck);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 1);
  });

  it("control: without the interrupt the same activation gets 1 + 1 + 1 boost cards", () => {
    const s = setup("plain", [BIG_SCHEME, EXTRA]);
    const threat = s.state.instances[s.scheme]!.threat;
    const { session, events } = run(s, [use(s.cards["big-scheme"]!, BIG_SCHEME_ABILITY)]);
    expect(of(events, "boostCardFlipped")).toHaveLength(3);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 4);
  });

  it("a boost card dealt outside the activation still turns faceup and counts in it", () => {
    const s = setup("schemes", [GIVE, SCHEME]);
    const threat = s.state.instances[s.scheme]!.threat;
    const given = run(s, [use(s.cards.give!, GIVE_ABILITY)]);
    const [held] = given.session.state.instances[s.villain]!.boostCards;
    expect(held).toBeDefined();
    const deck = deckSize(given.session.state);
    const { session, events } = run({ ...s, state: given.session.state }, [use(s.cards.scheme!, SCHEME_ABILITY)]);
    expect(of(events, "boostCardDealt")).toEqual([]);
    expect(of(events, "boostCardFlipped")).toEqual([
      { type: "boostCardFlipped", enemyInstanceId: s.villain, instanceId: held, boostIcons: 1 },
    ]);
    expect(deckSize(session.state)).toBe(deck);
    expect(session.state.instances[s.scheme]!.threat).toBe(threat + 2);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
  });

  it("ends with the activation: the villain's next activation gets its boost card", () => {
    const s = setup("schemes", [SCHEME, ATTACK]);
    const damage = s.state.instances[s.hero]!.damage;
    const first = run(s, [use(s.cards.scheme!, SCHEME_ABILITY)]);
    expect(of(first.events, "boostCardDealt")).toEqual([]);
    const next = run({ ...s, state: first.session.state }, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(next.events, "boostCardDealt")).toHaveLength(1);
    expect(of(next.events, "boostWithheld")).toEqual([]);
    expect(next.session.state.instances[s.hero]!.damage).toBe(damage + 3);
  });

  it("an effect-initiated activation's `boost: false` still deals nothing, without a boostWithheld entry", () => {
    const s = setup("plain", [QUIET, ATTACK]);
    const damage = s.state.instances[s.hero]!.damage;
    const quiet = run(s, [use(s.cards.quiet!, QUIET_ABILITY)]);
    expect(of(quiet.events, "boostCardDealt")).toEqual([]);
    expect(of(quiet.events, "boostWithheld")).toEqual([]);
    expect(quiet.session.state.instances[s.hero]!.damage).toBe(damage + 2);
    const next = run({ ...s, state: quiet.session.state }, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(of(next.events, "boostCardDealt")).toHaveLength(1);
  });

  it("the villain phase: the villain's scheme is dealt no boost card and the audit accepts it", () => {
    const s = setup("schemes", [], true);
    const { session, events } = run(s, [{ type: "endTurn", playerId: p1 }]);
    expect(of(events, "boostWithheld")).toEqual([
      { type: "boostWithheld", enemyInstanceId: s.villain, activation: "scheme" },
    ]);
    expect(of(events, "boostCardDealt").filter((e) => e.enemyInstanceId === s.villain)).toEqual([]);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup("schemes", [GIVE, BIG_SCHEME, EXTRA, ATTACK]);
    const { session } = run(s, [
      use(s.cards.give!, GIVE_ABILITY),
      use(s.cards["big-scheme"]!, BIG_SCHEME_ABILITY),
      use(s.cards.attack!, ATTACK_ABILITY),
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
