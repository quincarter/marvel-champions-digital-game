/**
 * Rules audit chunk 06 (Glossary: DEFEND, DEFENSE ... ENEMY). Audit proofs only: each `it.fails` marks a place the
 * engine does something the rules forbid, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Delayed Effect" (p. 15): "Delayed effects resolve automatically and immediately after their specified
 * timing point or future condition occurs or becomes true, and before responses to that point or condition may be
 * used. Delayed effects have the same timing priority as constant effects."
 * FFG rulings: Alex, Sep 26, 2024 (post-RRG 1.6 #12): Riposte "creates a delayed effect, which has the same timing
 * priority as the Retaliate keyword"; May 22, 2025 (post-RRG 1.6): a delayed effect that resolves "after the attack"
 * has "the same timing as the Retaliate keyword" (A.I.M. Commando, Spider Reflexes + Assault); Oct 12, 2023 (post-RRG
 * 1.5 #100): Last Stand's discard "makes sense to us as resolving at a similar timing point as a Response to the
 * attack". Retaliate resolves before the attack's responses (RRG 1.8 p. 9, step 6a before 6b), so "at the end of
 * this attack" effects (`atEndOfAttack`) should too. The engine runs them after the attack's response window
 * (`resolve/event.ts`, stage "done": "At the end of this attack: run after the response window").
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "../abilities.js";
import type { Command } from "../commands.js";
import type { GameEvent } from "../events.js";
import { playerId, type InstanceId } from "../ids.js";
import { activeVillain, mustInstance, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { applyCommand } from "../engine.js";
import { stubAlly, stubEvent, stubMainScheme, stubSupport, stubTreachery, stubVillain } from "../testing/fixtures.js";
import { runCommands } from "../testing/drive.js";
import type { EffectSpec } from "../spec.js";
import {
  expectOk,
  giveCard,
  giveCards,
  newGame,
  resolvePending,
  RESOURCE,
  runWith,
  settle,
  settleUntil,
} from "../testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "../testing/wave3.js";

const p1 = playerId("p1");
const n = (value: number) => ({ kind: "const", value }) as const;
const def = (definition: AbilityDefinition) => definition;
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const indexOfEvent = (events: readonly GameEvent[], match: (event: GameEvent) => boolean): number =>
  events.findIndex(match);

describe("an '(attack)' event with an 'at the end of this attack' delayed effect and a response to the attack", () => {
  // "Forced Interrupt: When you attack, at the end of this attack place 1 counter here." (Last Stand's shape)
  const DELAYED = stubAbility("delayed.interrupt", {
    trigger: { kind: "interrupt", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [
      {
        kind: "atEndOfAttack",
        effects: [
          {
            kind: "addCounters",
            target: { kind: "each", query: { categories: ["support"], name: "delayed" } },
            counterType: "delayed",
            amount: n(1),
          },
        ],
      },
    ],
  });
  // "Forced Response: After you attack, place 1 counter here." (a response to the attack, e.g. Spider-Ham's)
  const RESPONSE = stubAbility("response.response", {
    trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller" } },
    effects: [
      {
        kind: "addCounters",
        target: { kind: "each", query: { categories: ["support"], name: "response" } },
        counterType: "response",
        amount: n(1),
      },
    ],
  });
  const KICK = stubAbility("kick.action", {
    trigger: { kind: "action" },
    label: ["attack"],
    effects: [{ kind: "attack", target: { kind: "villain" }, amount: n(2) }],
  });
  const DELAYED_S = stubSupport({ id: "delayed", cost: 0, abilities: [DELAYED.ref] });
  const RESPONSE_S = stubSupport({ id: "response", cost: 0, abilities: [RESPONSE.ref] });
  const KICK_E = stubEvent({ id: "kick", cost: 0, abilities: [KICK.ref] });
  const deps = depsOf(DELAYED, RESPONSE, KICK);

  it.fails("resolves before the attack's responses (RRG 1.8 'Delayed Effect' p. 15; Alex, Oct 12, 2023 #100 on Last Stand)", () => {
    const base = gameAtFirstTurn({
      cards: [DELAYED_S, RESPONSE_S, KICK_E, BLANK],
      deps,
      villain: stubVillain({ id: "v", stages: [{ hp: flat(40), atk: 2, sch: 1 }] }),
      encounter: copiesOf(BLANK.id, 20),
      deck: [DELAYED_S.id, RESPONSE_S.id, KICK_E.id],
    });
    let state: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    state = playerCardIntoPlay(state, DELAYED_S.id).state;
    state = playerCardIntoPlay(state, RESPONSE_S.id).state;
    const { events } = playFree(state, deps, KICK_E.id);
    const delayedAt = indexOfEvent(events, (e) => e.type === "counterAdded" && e.counterType === "delayed");
    const responseAt = indexOfEvent(events, (e) => e.type === "counterAdded" && e.counterType === "response");
    expect(delayedAt).toBeGreaterThan(-1);
    expect(responseAt).toBeGreaterThan(-1);
    // Actual: the response (counter "response") is placed first; the delayed effect after the response window.
    expect(delayedAt).toBeLessThan(responseAt);
  });
});

describe("Riposte vs Electrostatic Armor (FFG ruling Sep 26, 2024 #12, post-RRG 1.6)", () => {
  const damageVillain = (amount: number) =>
    ({ kind: "dealDamage", target: { kind: "villain" }, amount: n(amount) }) as const;
  // Riposte: "+2 DEF ... If you take no damage, deal 3 damage to the attacker" as a delayed effect (3 here, source: this card).
  const riposte = stubAbility(
    "riposte",
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
      effects: [{ kind: "atEndOfAttack", effects: [damageVillain(3)] }],
    }),
  );
  // Electrostatic Armor: "Response: After you defend, deal 1 damage to the attacker."
  const armor = stubAbility(
    "armor",
    def({
      trigger: { kind: "response", forced: true, on: { on: "defended", playerIs: "controller" } },
      effects: [damageVillain(1)],
    }),
  );
  const RIPOSTE = stubSupport({ id: "riposte", cost: 0, abilities: [riposte.ref] });
  const ARMOR = stubSupport({ id: "armor", cost: 0, abilities: [armor.ref] });

  it.fails("the delayed 3 damage lands before the Electrostatic Armor response's 1 (RRG 1.8 p. 16 Delayed Effect, p. 5 timing priority)", () => {
    const deps = depsOf(riposte, armor);
    const scheme = stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
    });
    const start = newGame({
      villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0 }] }),
      mainScheme: scheme,
      extraCards: [BLANK, RIPOSTE, ARMOR],
      deck: [...copiesOf(RIPOSTE.id, 4), ...copiesOf(ARMOR.id, 4), ...copiesOf(RESOURCE.id, 8)],
      encounterDeck: copiesOf(BLANK.id, 20),
      deps,
    });
    const given = giveCards(start, p1, RIPOSTE.id, ARMOR.id);
    const [riposteId, armorId] = given.ids as [InstanceId, InstanceId];
    const play = (id: InstanceId): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    });
    const inPlay = runWith(deps, given.state, { type: "changeForm", playerId: p1 }, play(riposteId), play(armorId), {
      type: "endTurn",
      playerId: p1,
    });
    const atDefense = settleUntil(inPlay, "declareDefender", deps);
    const hero = mustPlayer(atDefense, p1).identity.instanceId;
    const result = applyCommand(
      atDefense,
      {
        type: "resolveChoice",
        playerId: p1,
        choiceId: atDefense.pendingChoice?.choiceId as never,
        selectedOptionIds: [hero],
      },
      deps,
    );
    const events = result.ok ? result.events : [];
    expectOk(result);
    const villain = activeVillain(atDefense).instanceId;
    const hits = events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === villain ? [e.amount] : []));
    expect(hits).toHaveLength(2);
    // Actual: [1, 3] (the response first, then the delayed effect).
    expect(hits).toEqual([3, 1]);
    void mustInstance;
  });
});

/**
 * RRG 1.8 "Leaves Play" (p. 27): "When a card leaves play, there is no memory of its previous state and it is
 * considered to be a new copy of the card." A delayed effect "At the end of the phase, discard Goliath" (Goliath 23015;
 * To Me, My X-Men! 36020 "return it to hand") is bound to the copy that was in play when it was created. The engine
 * keeps the delayed effect on the instance id, which survives the trip.
 * No FFG ruling in the transcripts covers it; the RRG sentence above is the authority.
 */
describe("a delayed 'discard this at the end of the phase' and a copy that left play and came back", () => {
  const you = { kind: "controller" } as const;
  const GOLIATH_ACTION = stubAbility("goliath.action", {
    trigger: { kind: "action" },
    effects: [{ kind: "atEndOfPhase", effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
  });
  const GOLIATH = stubAlly({ id: "goliath", cost: 0, atk: 1, thw: 1, hp: 5, abilities: [GOLIATH_ACTION.ref] });
  const action = (id: string, ...effects: EffectSpec[]) => {
    const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
    return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
  };
  const OUT = action("out", {
    kind: "discardFromPlay",
    target: { kind: "each", query: { categories: ["ally"], name: GOLIATH.name } },
  });
  const BACK = action(
    "back",
    {
      kind: "chooseCards",
      slot: "taken",
      from: { kind: "zone", zone: "discard", player: you, filter: { categories: ["ally"] } },
      chooser: you,
      min: 1,
      max: 1,
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "taken" }, controller: you },
  );
  const deps = depsOf(GOLIATH_ACTION, OUT.ability, BACK.ability);

  it.fails("the copy that returned is a new card: the old delayed discard does not touch it", () => {
    const base = gameAtFirstTurn({
      cards: [GOLIATH, OUT.card, BACK.card, BLANK],
      deps,
      villain: stubVillain({ id: "v", stages: [{ hp: flat(40), atk: 0, sch: 0 }] }),
      encounter: copiesOf(BLANK.id, 20),
      deck: [GOLIATH.id, OUT.card.id, BACK.card.id],
    });
    let state: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const put = playerCardIntoPlay(state, GOLIATH.id);
    state = put.state;
    const used = runCommands(state, deps, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: put.id,
      abilityId: GOLIATH_ACTION.ref.id,
      payment: [],
    });
    const outAndBack = (s: GameState, card: typeof OUT.card) => {
      const given = giveCard(s, P1, card.id);
      return runCommands(given.state, deps, {
        type: "playCard",
        playerId: P1,
        cardInstanceId: given.id,
        payment: [],
        attachToInstanceId: null,
      }).state;
    };
    const left = outAndBack(used.state, OUT.card);
    expect(mustPlayer(left, P1).discard).toContain(put.id);
    const returned = outAndBack(left, BACK.card);
    expect(mustPlayer(returned, P1).playArea).toContain(put.id);
    // End of the player phase: the delayed effect of the first copy fires.
    const ended = runCommands(returned, deps, { type: "endTurn", playerId: P1 }).state;
    // Actual: the returned copy is discarded by the old delayed effect (same instance id).
    expect(mustPlayer(ended, P1).playArea).toContain(put.id);
  });
});

/**
 * RRG 1.8 "Defend, Defense" (p. 15): "While a hero is defending against an attack, other friendly characters cannot
 * defend against that attack" and the same for a defending ally. FFG ruling, Alex, Jul 19, 2023 (post-RRG 1.5 #49):
 * "since your hero is already defending the attack, the ally put into play with Mutant Protectors cannot defend that
 * attack. (The rules of defending are strict on this; once one character defends, only that character can defend the
 * attack unless that character leaves play before the attack finishes.)" The engine bars only another
 * PLAYER's characters (`defenseBarFor`); a second declaration by the same player replaces the defender
 * (`declareDefenderByEffect`, `resolve/enemy-activation.ts`).
 */
describe("a second character declared the defender of an attack that already has one (same player)", () => {
  const ALLY_A = stubAlly({ id: "ally-a", cost: 0, atk: 1, thw: 1, hp: 9 });
  const ALLY_B = stubAlly({ id: "ally-b", cost: 0, atk: 1, thw: 1, hp: 9 });
  const declare = (id: string, name: string) =>
    stubAbility(
      id,
      def({
        trigger: {
          kind: "interrupt",
          forced: true,
          on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
        },
        label: ["defense"],
        effects: [{ kind: "declareDefender", character: { kind: "each", query: { categories: ["ally"], name } } }],
      }),
    );
  // "Hero Interrupt (defense): When an enemy attacks you, declare an ally you control the defender" (Mutant Protectors' shape).
  const DECLARE_A = declare("declare-a", ALLY_A.name);
  const DECLARE_B = declare("declare-b", ALLY_B.name);
  const CARD_A = stubSupport({ id: "card-a", cost: 0, abilities: [DECLARE_A.ref] });
  const CARD_B = stubSupport({ id: "card-b", cost: 0, abilities: [DECLARE_B.ref] });
  // "Hero Interrupt (defense): When an enemy attacks you, ..." with no further text: the label alone makes the hero the defender.
  const GUARD = stubAbility(
    "guard",
    def({
      trigger: {
        kind: "interrupt",
        forced: true,
        on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true },
      },
      label: ["defense"],
      effects: [],
    }),
  );
  const GUARD_CARD = stubSupport({ id: "guard", cost: 0, abilities: [GUARD.ref] });
  const deps = depsOf(DECLARE_A, DECLARE_B, GUARD);

  function stage(cards: readonly (typeof CARD_A | typeof GUARD_CARD)[]) {
    const scheme = stubMainScheme({
      id: "scheme",
      stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
    });
    const start = newGame({
      villain: stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 4, sch: 0 }] }),
      mainScheme: scheme,
      extraCards: [BLANK, ALLY_A, ALLY_B, CARD_A, CARD_B, GUARD_CARD],
      deck: [
        ...copiesOf(ALLY_A.id, 2),
        ...copiesOf(ALLY_B.id, 2),
        ...cards.map((c) => c.id),
        ...copiesOf(RESOURCE.id, 8),
      ],
      encounterDeck: copiesOf(BLANK.id, 20),
      deps,
    });
    const given = giveCards(start, p1, ALLY_A.id, ALLY_B.id, ...cards.map((c) => c.id));
    const [allyA, allyB, ...rest] = given.ids as InstanceId[];
    const play = (id: InstanceId): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    });
    const inPlay = runWith(
      deps,
      given.state,
      { type: "changeForm", playerId: p1 },
      play(allyA!),
      play(allyB!),
      ...rest.map(play),
      { type: "endTurn", playerId: p1 },
    );
    return { inPlay, allyA: allyA!, allyB: allyB!, rest };
  }

  /** Orders the two forced interrupts `first`, `second`, then declines any defender prompt. */
  function finish(t: ReturnType<typeof stage>, order: readonly string[]): GameState {
    const ordering = settleUntil(t.inPlay, "orderTriggers", deps);
    expect(ordering.pendingChoice?.prompt.kind).toBe("orderTriggers");
    const ordered = resolvePending(ordering, order, deps);
    return settle(ordered, undefined, deps);
  }

  it.fails("Mutant Protectors twice: the first ally declared stays the defender (FFG ruling Jul 19, 2023, post-RRG 1.5 #49)", () => {
    const t = stage([CARD_A, CARD_B]);
    const [cardA, cardB] = t.rest as [InstanceId, InstanceId];
    const after = finish(t, [`${cardA}:declare-a`, `${cardB}:declare-b`]);
    const hurt = (id: InstanceId) => mustInstance(after, id).damage;
    // Actual: ally B took the attack (the second declaration replaced the defender); ally A took nothing.
    expect(hurt(t.allyA)).toBe(4);
    expect(hurt(t.allyB)).toBe(0);
  });

  it.fails("a (defense) ability makes the hero the defender, then an ally is declared: the hero stays (post-RRG 1.5 #49 item 4)", () => {
    const t = stage([GUARD_CARD, CARD_A]);
    const [guardId, cardA] = t.rest as [InstanceId, InstanceId];
    const after = finish(t, [`${guardId}:guard`, `${cardA}:declare-a`]);
    const hero = mustPlayer(after, p1).identity.instanceId;
    // Actual: ally A is the defender and takes the 4; the hero, already defending, should have taken it.
    expect(mustInstance(after, t.allyA).damage).toBe(0);
    expect(mustInstance(after, hero).damage).toBe(4);
  });
});
