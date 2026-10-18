import { flat, type CardId } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, withEncounterPiles } from "./testing/scenario.js";

/**
 * "At the end of this attack" effects of an attack whose attacker left play before it resolved.
 *
 * RRG 1.8 "Activation" (p. 6): "If an activating minion leaves play, that minion's activation ends immediately and no
 * further steps of that activation resolve." "Delayed Effect" (p. 16): a delayed effect resolves "automatically and
 * immediately after [its] specified timing point". The attack has ended, so the delayed effects it holds resolve.
 * Ruling January 11, 2026 - Ruling 1, answer 3: "if Armored Defense defeats the attacking minion, Hulkling still
 * receives a Tough status card."
 *
 * An attack cancelled in the same window ends too. FFG ruling Feb 15, 2024, Ruling 148 (post-RRG 1.5): when Grasping
 * Tendrils cancels Rhino's attack, "the attack is still considered to 'end' and Charge is discarded." RRG 1.8 "Cancel"
 * (p. 11) does not contradict it: the cancelled ability "is still regarded as initiated", and "abilities dependent on
 * the canceled effect cannot trigger" covers new triggers (the attack's damage, "after ... attacks"), not a delayed
 * effect an already-resolved interrupt set up. So the held "at the end of this attack" effects resolve; nothing else of
 * the attack does.
 */
const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const you = { kind: "controller" } as const;
const myIdentity = { kind: "identityOf", player: you } as const;
const attacker = { kind: "attackingEnemy" } as const;
const amount = (value: number) => ({ kind: "const", value }) as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
});
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

/**
 * A support whose forced interrupt answers a minion's attack: it deals `strike` damage to the attacker and holds
 * `atEnd` for the end of the attack, then resolves `thenAlso`. Played against a minion (ATK 2) with `hp` hit points.
 */
function game(hp: number, strike: number, atEnd: readonly EffectSpec[], thenAlso: readonly EffectSpec[] = []) {
  const guard = stubAbility(
    "guard-post",
    def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["minion"] } } },
      effects: [
        { kind: "dealDamage", target: attacker, amount: amount(strike) },
        { kind: "atEndOfAttack", effects: atEnd },
        ...thenAlso,
      ],
    }),
  );
  const POST = stubSupport({ id: "post", cost: 0, abilities: [guard.ref] });
  const THUG = stubMinion({ id: "thug", atk: 2, sch: 0, hp, boostIcons: 0 });
  const deps = depsOf(guard);
  const fresh = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [BLANK, POST, THUG],
    deck: [...copies(RESOURCE.id, 12), ...copies(POST.id, 3)],
    encounterDeck: [THUG.id, ...copies(BLANK.id, 20)],
    deps,
  });
  // Round 1, alter-ego: the villain schemes with a blank boost card, then the minion is dealt and engages.
  const pile = [...activeEncounterDeck(fresh).deck];
  const thugAt = pile.findIndex((id) => fresh.instances[id]?.cardId === THUG.id);
  const thug = pile[thugAt] as InstanceId;
  pile.splice(thugAt, 1);
  const stacked = withEncounterPiles(fresh, { deck: [pile[0] as InstanceId, thug, ...pile.slice(1)] });

  let session: GameSession = startSession(stacked);
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type}: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
    for (let turns = 0; session.state.pendingChoice && !session.state.outcome; turns++) {
      if (turns > 100) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      const picked =
        choice.prompt.kind === "declareDefender"
          ? ["decline"]
          : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      const next = sessionApply(
        session,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
        deps,
      );
      if (!next.ok) throw new Error(`resolveChoice: ${next.error.code}: ${next.error.message}`);
      session = next.session;
      events.push(...next.events);
    }
  };
  apply({ type: "endTurn", playerId: p1 });
  expect(mustPlayer(session.state, p1).playArea).toContain(thug);

  const given = giveCards(session.state, p1, POST.id);
  session = startSession(given.state);
  apply({
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.ids[0] as InstanceId,
    payment: [],
    attachToInstanceId: null,
  });
  apply({ type: "changeForm", playerId: p1 });
  const before = events.length;
  apply({ type: "endTurn", playerId: p1 });
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events: events.slice(before), thug };
}

const identity = (state: GameState) => mustInstance(state, mustPlayer(state, p1).identity.instanceId);
const damageTo = (events: readonly GameEvent[], id: InstanceId) =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === id ? [e.amount] : []));
const giveTough: EffectSpec = { kind: "giveStatus", target: myIdentity, status: "tough" };

describe("'at the end of this attack' when the attacker leaves play in its 'when [enemy] attacks' window", () => {
  it("the attacker defeated by the interrupt: the attack ends with no damage, and the held effect still resolves", () => {
    const { state, events, thug } = game(2, 2, [giveTough]);
    expect(activeEncounterDeck(state).discard).toContain(thug);
    expect(mustPlayer(state, p1).playArea).not.toContain(thug);
    expect(damageTo(events, thug)).toEqual([2]);
    expect(identity(state).damage).toBe(0);
    expect(identity(state).statuses.tough).toBe(1);
    // The attack ended first (RRG "Activation", p. 6), then its delayed effect resolved.
    const skipped = events.findIndex(
      (e) => e.type === "activationSkipped" && e.enemyInstanceId === thug && e.reason === "leftPlay",
    );
    const given = events.findIndex((e) => e.type === "statusGiven" && e.status === "tough");
    expect(skipped).toBeGreaterThanOrEqual(0);
    expect(given).toBeGreaterThan(skipped);
    expect(events.filter((e) => e.type === "statusGiven")).toHaveLength(1);
  });

  it("a held effect that names the departed attacker does nothing; the ones after it still resolve", () => {
    const { state, events, thug } = game(2, 2, [
      { kind: "dealDamage", target: attacker, amount: amount(1) },
      { kind: "giveStatus", target: attacker, status: "stunned" },
      giveTough,
      { kind: "dealDamage", target: { kind: "villain" }, amount: amount(1) },
    ]);
    // Only the interrupt's 2 damage: nothing is dealt to a card that is no longer in play.
    expect(damageTo(events, thug)).toEqual([2]);
    expect(mustInstance(state, thug).damage).toBe(0);
    expect(mustInstance(state, thug).statuses.stunned).toBe(0);
    expect(events.filter((e) => e.type === "statusGiven").map((e) => e.type === "statusGiven" && e.status)).toEqual([
      "tough",
    ]);
    expect(identity(state).statuses.tough).toBe(1);
    expect(mustInstance(state, state.activeVillainId as InstanceId).damage).toBe(1);
  });

  it("the attacker survives: the attack deals its damage first, then the held effects resolve against it too", () => {
    const { state, events, thug } = game(5, 2, [
      { kind: "dealDamage", target: attacker, amount: amount(1) },
      giveTough,
    ]);
    expect(mustPlayer(state, p1).playArea).toContain(thug);
    expect(damageTo(events, thug)).toEqual([2, 1]);
    expect(mustInstance(state, thug).damage).toBe(3);
    // ATK 2, undefended: the tough card arrived after the damage and is still there.
    expect(identity(state).damage).toBe(2);
    expect(identity(state).statuses.tough).toBe(1);
    expect(events.some((e) => e.type === "activationSkipped")).toBe(false);
  });
});

describe("'at the end of this attack' when the attack is cancelled in its 'when [enemy] attacks' window", () => {
  const cancelIt: EffectSpec = { kind: "cancelTriggeringEvent" };
  const cancelledAttacks = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "triggerEvent" && e.phase === "cancelled" && e.event.kind === "enemyAttack");

  it("the held effect still resolves: the tough card, but none of the attack's damage, and the attacker stays", () => {
    const { state, events, thug } = game(5, 1, [giveTough], [cancelIt]);
    expect(cancelledAttacks(events)).toHaveLength(1);
    expect(mustPlayer(state, p1).playArea).toContain(thug);
    // The interrupt's own damage was dealt before the cancel; the attack's 2 was not.
    expect(damageTo(events, thug)).toEqual([1]);
    expect(identity(state).damage).toBe(0);
    expect(identity(state).statuses.tough).toBe(1);
    expect(events.filter((e) => e.type === "statusGiven")).toHaveLength(1);
    // Cancelled, not ended early: the activation was not skipped for a departed enemy.
    expect(events.some((e) => e.type === "activationSkipped")).toBe(false);
  });

  it("every held effect resolves, whatever it names: the attacker, the villain or the player", () => {
    const { state, events, thug } = game(
      5,
      1,
      [
        { kind: "dealDamage", target: attacker, amount: amount(1) },
        giveTough,
        { kind: "dealDamage", target: { kind: "villain" }, amount: amount(1) },
      ],
      [cancelIt],
    );
    expect(cancelledAttacks(events)).toHaveLength(1);
    // The interrupt's 1, then the held effect's 1 (the attack's own 2 is never dealt).
    expect(damageTo(events, thug)).toEqual([1, 1]);
    expect(mustInstance(state, thug).damage).toBe(2);
    expect(identity(state).damage).toBe(0);
    expect(identity(state).statuses.tough).toBe(1);
    expect(mustInstance(state, state.activeVillainId as InstanceId).damage).toBe(1);
  });

  it("control: the same interrupt without the cancel deals the attack's 2 damage, then gives the tough card", () => {
    const { state, events, thug } = game(5, 1, [giveTough]);
    expect(cancelledAttacks(events)).toEqual([]);
    expect(damageTo(events, thug)).toEqual([1]);
    expect(identity(state).damage).toBe(2);
    expect(identity(state).statuses.tough).toBe(1);
  });

  it("an attack cancelled after its attacker was defeated in the same window still ends: the held effect resolves", () => {
    // The interrupt defeats the minion, then cancels the attack. Either way the attack has ended, so the held effect
    // resolves (ruling January 11, 2026 - Ruling 1, answer 3; Ruling 148).
    const { state, events, thug } = game(1, 1, [giveTough], [cancelIt]);
    expect(activeEncounterDeck(state).discard).toContain(thug);
    expect(identity(state).damage).toBe(0);
    expect(identity(state).statuses.tough).toBe(1);
    expect(cancelledAttacks(events)).toHaveLength(1);
  });
});
