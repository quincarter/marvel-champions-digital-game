/**
 * `EffectSpec cancelBoostedActivation`: "[star] Boost: … cancel this activation" (community pack `mephisto-nep`,
 * Blackheart). A Boost ability has no triggering event (RRG 1.8 "Boost, Boost Icon", p. 11: it resolves "when the card
 * is turned face up"), so `cancelTriggeringEvent` finds nothing there; this effect cancels the attack or scheme the
 * card is a boost card for. RRG 1.8 "Cancel" (p. 11): the activation is still regarded as initiated, its effects do not
 * resolve, and "abilities dependent on the canceled effect cannot trigger". So: the rest of the Boost ability resolves,
 * then no further boost card is turned faceup, no damage is dealt and no threat placed, the enemy's boost cards are
 * discarded, and no "after … attacks / schemes" response triggers (as for an activation cancelled in its interrupt
 * window). RRG 1.8 does not say what becomes of boost cards not yet turned faceup: the engine discards them with the
 * activation they were given for (`endedByBoostCancel`).
 *
 * Synthetic cards throughout. Villain ATK 2, SCH 1; every attack is undefended.
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";
import { onTopOfEncounterDeck } from "./testing/wave3.js";
import { auditVillainPhases } from "./villain/audit.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const theVillain = { kind: "named", name: "villain" } as const;
const you = { kind: "controller" } as const;
const draw1: EffectSpec = { kind: "draw", player: you, amount: { kind: "const", value: 1 } };

const action = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects }));
const ATTACK_ABILITY = action("attack.action", [{ kind: "enemyAttack", enemies: theVillain, against: you }]);
/** "The villain attacks you. Give the villain 1 additional boost card for that activation." */
const BIG_ATTACK_ABILITY = action("big-attack.action", [
  { kind: "enemyAttack", enemies: theVillain, against: you, extraBoostCards: 1 },
]);
const SCHEME_ABILITY = action("scheme.action", [{ kind: "enemyScheme", enemies: theVillain, against: you }]);
/** "Cancel this activation" used outside any boost card: nothing to cancel, so its "then" draws nothing. */
const STRAY_ABILITY = action("stray.action", [{ kind: "cancelBoostedActivation" }, { kind: "then", effects: [draw1] }]);
/** "Forced Response: After the villain attacks / schemes, draw 1 card." */
const AFTER_ATTACK_ABILITY = stubAbility(
  "after-attack.response",
  def({ trigger: { kind: "response", forced: true, on: { on: "enemyAttack" } }, effects: [draw1] }),
);
const AFTER_SCHEME_ABILITY = stubAbility(
  "after-scheme.response",
  def({ trigger: { kind: "response", forced: true, on: { on: "enemyScheme" } }, effects: [draw1] }),
);

/** "[star] Boost: Cancel this activation. Draw 1 card." (2 boost icons, which never count.) */
const CANCELLER_BOOST = stubAbility(
  "canceller.boost",
  def({ trigger: { kind: "boost" }, effects: [{ kind: "cancelBoostedActivation" }, draw1] }),
);
const CANCELLER = stubTreachery({ id: "canceller", boostIcons: 2, abilities: [CANCELLER_BOOST.ref] });
const TWO = stubTreachery({ id: "two", boostIcons: 2 });

const support = (id: string, ability: StubAbility) => stubSupport({ id, cost: 0, abilities: [ability.ref] });
const ATTACK = support("attack", ATTACK_ABILITY);
const BIG_ATTACK = support("big-attack", BIG_ATTACK_ABILITY);
const SCHEME = support("scheme", SCHEME_ABILITY);
const STRAY = support("stray", STRAY_ABILITY);
const AFTER_ATTACK = support("after-attack", AFTER_ATTACK_ABILITY);
const AFTER_SCHEME = support("after-scheme", AFTER_SCHEME_ABILITY);
const SUPPORTS = [ATTACK, BIG_ATTACK, SCHEME, STRAY, AFTER_ATTACK, AFTER_SCHEME];

const deps: EngineDeps = depsOf(
  ATTACK_ABILITY,
  BIG_ATTACK_ABILITY,
  SCHEME_ABILITY,
  STRAY_ABILITY,
  AFTER_ATTACK_ABILITY,
  AFTER_SCHEME_ABILITY,
  CANCELLER_BOOST,
);

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
  readonly cards: Readonly<Record<string, InstanceId>>;
  readonly villain: InstanceId;
  readonly hero: InstanceId;
  readonly scheme: InstanceId;
}

/** `inPlay` supports in play, hero form unless `alterEgo`; `top` on top of an encounter deck of 2-icon cards. */
function setup(
  inPlay: readonly (typeof ATTACK)[],
  top: readonly CardId[],
  options: { readonly alterEgo?: boolean } = {},
): Setup {
  const state = newGame({
    villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 1 }] }),
    mainScheme: stubMainScheme({
      id: "main",
      stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
    }),
    extraCards: [TWO, CANCELLER, ...SUPPORTS],
    deck: [...inPlay.map((c) => c.id), ...copies(RESOURCE.id, 20)],
    encounterDeck: [CANCELLER.id, ...copies(TWO.id, 20)],
    deps,
  });
  const given = giveCards(state, p1, ...inPlay.map((c) => c.id));
  const supports = given.ids as readonly InstanceId[];
  const ready = runWith(
    deps,
    given.state,
    ...(options.alterEgo ? [] : [{ type: "changeForm", playerId: p1 } as Command]),
    ...supports.map(play),
  );
  // Every CANCELLER sunk to the bottom, then the named cards on top in order.
  const deck = activeEncounterDeck(ready).deck;
  const isTwo = (id: InstanceId) => ready.instances[id]?.cardId === TWO.id;
  const sunk: GameState = {
    ...ready,
    encounterDecks: Object.fromEntries(
      Object.entries(ready.encounterDecks).map(([id, piles]) => [
        id,
        piles.deck === deck ? { ...piles, deck: [...deck.filter(isTwo), ...deck.filter((i) => !isTwo(i))] } : piles,
      ]),
    ),
  };
  const stacked = [...top].reverse().reduce((s, card) => onTopOfEncounterDeck(s, card), sunk);
  return {
    state: stacked,
    cards: Object.fromEntries(inPlay.map((c, i) => [c.id, supports[i]!])),
    villain: Object.values(stacked.instances).find((i) => i.cardId === "villain")!.instanceId,
    hero: mustPlayer(stacked, p1).identity.instanceId,
    scheme: stacked.mainScheme.instanceId,
  };
}

const run = (s: Setup, commands: readonly Command[]) =>
  driveSession(startSession(s.state), deps, commands, defaultPick);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const handSize = (state: GameState) => mustPlayer(state, p1).hand.length;
const cardOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId;

describe("cancelBoostedActivation — '[star] Boost: cancel this activation'", () => {
  it("control: a 2-icon boost card on an attack deals ATK 2 + 2, and the 'after attacks' response draws", () => {
    const s = setup([ATTACK, AFTER_ATTACK], [TWO.id]);
    const hand = handSize(s.state);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    expect(session.state.instances[s.hero]!.damage).toBe(4);
    expect(handSize(session.state)).toBe(hand + 1);
    expect(of(events, "activationCancelled")).toEqual([]);
  });

  it("an attack: the rest of the Boost ability resolves, then no damage, no 'after attacks' response; card discarded", () => {
    const s = setup([ATTACK, AFTER_ATTACK], [CANCELLER.id]);
    const hand = handSize(s.state);
    const before = activeEncounterDeck(s.state);
    const { session, events } = run(s, [use(s.cards.attack!, ATTACK_ABILITY)]);
    const card = of(events, "boostCardDealt")[0]!.instanceId;
    expect(cardOf(session.state, card)).toBe(CANCELLER.id);
    expect(session.state.instances[s.hero]!.damage).toBe(0);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(of(events, "attackResolved")).toEqual([]);
    // The Boost ability's own draw, and no draw from the forced "after the villain attacks" response.
    expect(handSize(session.state)).toBe(hand + 1);
    expect(of(events, "activationCancelled")).toEqual([
      {
        type: "activationCancelled",
        enemyInstanceId: s.villain,
        activation: "attack",
        byInstanceId: card,
        discardedBoostCards: [card],
      },
    ]);
    expect(
      events.some((e) => e.type === "triggerEvent" && e.phase === "cancelled" && e.event.kind === "enemyAttack"),
    ).toBe(true);
    expect(activeEncounterDeck(session.state).discard).toEqual([card, ...before.discard]);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
    expect(session.state.stack).toEqual([]);
  });

  it("the activation's other boost card is discarded without being turned faceup", () => {
    const s = setup([BIG_ATTACK], [CANCELLER.id, TWO.id]);
    const { session, events } = run(s, [use(s.cards["big-attack"]!, BIG_ATTACK_ABILITY)]);
    const dealt = of(events, "boostCardDealt").map((e) => e.instanceId);
    expect(dealt.map((id) => cardOf(session.state, id))).toEqual([CANCELLER.id, TWO.id]);
    expect(of(events, "boostCardFlipped").map((e) => e.instanceId)).toEqual([dealt[0]]);
    expect(of(events, "activationCancelled")[0]!.discardedBoostCards).toEqual(dealt);
    expect(session.state.instances[dealt[1]!]!.faceup).toBe(false);
    expect(activeEncounterDeck(session.state).discard.slice(0, 2)).toEqual([...dealt].reverse());
    expect(session.state.instances[s.hero]!.damage).toBe(0);
  });

  it("a canceller turned up second: the first card has already been applied and discarded; still no damage", () => {
    const s = setup([BIG_ATTACK], [TWO.id, CANCELLER.id]);
    const { session, events } = run(s, [use(s.cards["big-attack"]!, BIG_ATTACK_ABILITY)]);
    const dealt = of(events, "boostCardDealt").map((e) => e.instanceId);
    expect(of(events, "boostCardFlipped").map((e) => e.instanceId)).toEqual(dealt);
    expect(of(events, "activationCancelled")[0]!.discardedBoostCards).toEqual([dealt[1]]);
    expect(session.state.instances[s.hero]!.damage).toBe(0);
  });

  it("a scheme: no threat placed and no 'after schemes' response", () => {
    const s = setup([SCHEME, AFTER_SCHEME], [CANCELLER.id], { alterEgo: true });
    const hand = handSize(s.state);
    const { session, events } = run(s, [use(s.cards.scheme!, SCHEME_ABILITY)]);
    expect(session.state.instances[s.scheme]!.threat).toBe(0);
    expect(of(events, "schemeResolved")).toEqual([]);
    expect(of(events, "activationCancelled").map((e) => e.activation)).toEqual(["scheme"]);
    expect(handSize(session.state)).toBe(hand + 1);
    expect(session.state.instances[s.villain]!.boostCards).toEqual([]);
  });

  it("outside a boost card it cancels nothing, so a 'then' after it does not resolve", () => {
    const s = setup([STRAY], []);
    const hand = handSize(s.state);
    const { session, events } = run(s, [use(s.cards.stray!, STRAY_ABILITY)]);
    expect(handSize(session.state)).toBe(hand);
    expect(of(events, "preThenUnresolved").map((e) => e.cause)).toEqual(["nothingToCancel"]);
  });

  it("the villain phase: the villain's attack is cancelled by its boost card and the audit is clean", () => {
    const s = setup([], [CANCELLER.id]);
    const { session, events } = run(s, [{ type: "endTurn", playerId: p1 }]);
    expect(of(events, "activationCancelled").map((e) => e.enemyInstanceId)).toEqual([s.villain]);
    expect(session.state.instances[s.hero]!.damage).toBe(0);
    expect(auditVillainPhases(session.log, deps).violations).toEqual([]);
  });

  it("replays deep-equal", () => {
    const s = setup([BIG_ATTACK, SCHEME, AFTER_ATTACK], [CANCELLER.id, TWO.id, TWO.id]);
    const { session } = run(s, [
      use(s.cards["big-attack"]!, BIG_ATTACK_ABILITY),
      use(s.cards.scheme!, SCHEME_ABILITY),
      { type: "endTurn", playerId: p1 },
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
