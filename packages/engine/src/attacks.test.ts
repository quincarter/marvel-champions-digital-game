import { activeEncounterDeck, activeVillain } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, expectOk, giveCards, newGame, resolvePending, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (definition: AbilityDefinition) => definition;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const play = (id: InstanceId): Command => ({ type: "playCard", playerId: p1, cardInstanceId: id, payment: [], attachToInstanceId: null });
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);
const draw1 = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }],
});
const villainWith = (stage: Partial<Parameters<typeof stubVillain>[0]["stages"][number]> = {}) =>
  stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 2, sch: 0, ...stage }] });

interface Setup {
  readonly cards?: readonly AnyCard[];
  readonly abilities?: readonly StubAbility[];
  readonly villain?: ReturnType<typeof stubVillain>;
  readonly encounter?: readonly CardId[];
}

function setup({ cards = [], abilities = [], villain = villainWith(), encounter }: Setup): { deps: EngineDeps; state: GameState } {
  const deps = depsOf(...abilities);
  const state = newGame({
    villain,
    mainScheme: SCHEME,
    extraCards: [BLANK, ...cards],
    deck: [...cards.filter((c) => c.type !== "minion" && c.type !== "attachment" && c.type !== "treachery" && c.type !== "side_scheme").flatMap((c) => copies(c.id)), ...copies(RESOURCE.id, 8), ...copies(ALLY.id)],
    encounterDeck: encounter ?? copies(BLANK.id, 20),
    deps,
  });
  return { deps, state };
}

const patchInstance = (state: GameState, id: InstanceId, patch: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...patch } },
});
const identityOf = (state: GameState) => mustPlayer(state, p1).identity.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const threatOnMain = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const run = (deps: EngineDeps, state: GameState, command: Command) => {
  const result = applyCommand(state, command, deps);
  return { state: expectOk(result), events: result.ok ? result.events : [] };
};

const kickAbility = stubAbility("kick", def({
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 3 } }],
}));
const KICK = stubEvent({ id: "kick", cost: 0, abilities: [kickAbility.ref] });

describe("'(attack)' abilities resolve as attacks (RRG 'Attack (Player Ability Type)', 'Labeled Ability')", () => {
  it("deal their damage as an attack by the identity, so retaliate answers it", () => {
    const { deps, state } = setup({ cards: [KICK], abilities: [kickAbility], villain: villainWith({ keywords: [{ name: "retaliate", value: 1 }] }) });
    const given = giveCards(state, p1, "kick");
    const after = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(3);
    expect(damageOn(after, identityOf(after))).toBe(1);
  });

  it("can't attack the villain past a guard minion", () => {
    const guard = stubMinion({ id: "guard", atk: 0, sch: 0, hp: 4, boostIcons: 0, keywords: [{ name: "guard" }] });
    const { deps, state } = setup({ cards: [KICK, guard], abilities: [kickAbility], encounter: copies(guard.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    expect(mustPlayer(roundTwo, p1).playArea.some((id) => roundTwo.instances[id]?.cardId === guard.id)).toBe(true);
    const given = giveCards(roundTwo, p1, "kick");
    const after = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(0);
    expect(mustPlayer(after, p1).discard).toContain(given.ids[0]);
  });

  it("a stunned identity's (attack) ability is canceled except for its costs, and the stun is removed", () => {
    const { deps, state } = setup({ cards: [KICK], abilities: [kickAbility] });
    const given = giveCards(state, p1, "kick");
    const hero = runWith(deps, given.state, toHero);
    const stunned = patchInstance(hero, identityOf(hero), { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const after = runWith(deps, stunned, play(given.ids[0] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(0);
    expect(mustInstance(after, identityOf(after)).statuses.stunned).toBe(0);
    expect(mustPlayer(after, p1).discard).toContain(given.ids[0]);
  });

  it("reads the identity's modified ATK for 'damage equal to your hero's ATK'", () => {
    const strength = stubAbility("strength", def({
      trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 2, target: { categories: ["hero"], controller: "you" } }] },
      effects: [],
    }));
    const punch = stubAbility("punch", def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat: "atk" } }],
    }));
    const upgrade = stubUpgrade({ id: "strength", cost: 0, abilities: [strength.ref] });
    const event = stubEvent({ id: "punch", cost: 0, abilities: [punch.ref] });
    const { deps, state } = setup({ cards: [upgrade, event], abilities: [strength, punch] });
    const given = giveCards(state, p1, "strength", "punch");
    const after = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId), play(given.ids[1] as InstanceId));
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(4);
  });

  it("reports defeats: overkill spills to the villain and 'after your hero attacks and defeats' fires", () => {
    const thug = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 2, boostIcons: 0 });
    const assault = stubAbility("assault", def({
      trigger: { kind: "action", form: "hero" },
      label: ["attack"],
      effects: [
        { kind: "chooseTarget", slot: "m", chooser: { kind: "controller" }, query: { categories: ["minion"] } },
        { kind: "attack", target: { kind: "slot", slot: "m" }, amount: { kind: "const", value: 5 }, overkill: true },
      ],
    }));
    const chase = stubAbility("chase", def({
      trigger: { kind: "response", forced: true, on: { on: "attack", playerIs: "controller", requireResults: { defeated: 1 } } },
      effects: [draw1],
    }));
    const event = stubEvent({ id: "assault", cost: 0, abilities: [assault.ref] });
    const room = stubSupport({ id: "room", cost: 0, abilities: [chase.ref] });
    const { deps, state } = setup({ cards: [event, room, thug], abilities: [assault, chase], encounter: copies(thug.id, 20) });
    const roundTwo = settle(runWith(deps, state, endTurn), undefined, deps);
    const given = giveCards(roundTwo, p1, "room", "assault");
    const [roomId, eventId] = given.ids as [InstanceId, InstanceId];
    const atChoice = runWith(deps, given.state, toHero, play(roomId), play(eventId));
    const thugId = atChoice.pendingChoice?.options[0]?.optionId as InstanceId;
    // The event left the hand when it was played (RRG "Event": out of play while resolving).
    const handBefore = mustPlayer(atChoice, p1).hand.length;
    expect(mustPlayer(atChoice, p1).hand).not.toContain(eventId);
    const after = resolvePending(atChoice, [thugId], deps);
    expect(activeEncounterDeck(after).discard).toContain(thugId);
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(3);
    expect(mustPlayer(after, p1).discard).toContain(eventId);
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore + 1);
  });
});

describe("'(thwart)' abilities resolve as thwarts", () => {
  const forJustice = stubAbility("for-justice", def({
    trigger: { kind: "action", form: "hero" },
    label: ["thwart"],
    effects: [
      { kind: "thwart", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 }, bind: "t" },
      { kind: "if", condition: { kind: "varAtLeast", name: "t.threatRemoved", amount: 1 }, then: [draw1] },
    ],
  }));
  const JUSTICE = stubEvent({ id: "justice", cost: 0, abilities: [forJustice.ref] });

  it("remove threat as a thwart and bind how much was removed", () => {
    const { deps, state } = setup({ cards: [JUSTICE], abilities: [forJustice] });
    const given = giveCards(state, p1, "justice");
    const hero = runWith(deps, given.state, toHero);
    const after = runWith(deps, hero, play(given.ids[0] as InstanceId));
    expect(threatOnMain(after)).toBe(3);
    expect(mustPlayer(after, p1).hand.length).toBe(mustPlayer(hero, p1).hand.length); // -1 event, +1 draw
  });

  it("a confused identity's (thwart) ability is canceled and the confusion removed", () => {
    const { deps, state } = setup({ cards: [JUSTICE], abilities: [forJustice] });
    const given = giveCards(state, p1, "justice");
    const hero = runWith(deps, given.state, toHero);
    const confused = patchInstance(hero, identityOf(hero), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const after = runWith(deps, confused, play(given.ids[0] as InstanceId));
    expect(threatOnMain(after)).toBe(5);
    expect(mustInstance(after, identityOf(after)).statuses.confused).toBe(0);
  });

  it("a crisis icon stops any player card from removing main-scheme threat (RRG 'Crisis Icon')", () => {
    const crisis = stubSideScheme({ id: "crowd", startingThreat: 2, icons: ["crisis"], boostIcons: 0 });
    const { deps, state } = setup({ cards: [JUSTICE, crisis], abilities: [forJustice], encounter: [crisis.id, ...copies(BLANK.id, 10)] });
    const crisisId = activeEncounterDeck(state).deck.find((id) => state.instances[id]?.cardId === crisis.id) as InstanceId;
    const withCrisis: GameState = {
      ...state,
      encounterDecks: withEncounterPiles(state, { deck: activeEncounterDeck(state).deck.filter((id) => id !== crisisId) }).encounterDecks,
      villainArea: [...state.villainArea, crisisId],
    };
    const given = giveCards(withCrisis, p1, "justice");
    const after = runWith(deps, given.state, toHero, play(given.ids[0] as InstanceId));
    expect(threatOnMain(after)).toBe(5);
  });
});

describe("enemy attacks: modifications, defenses, results", () => {
  it("'When Rhino attacks, the attack gains overkill … At the end of this attack, discard Charge'", () => {
    const charge = stubAbility("charge", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
      effects: [{ kind: "modifyAttack", overkill: true }, { kind: "atEndOfAttack", effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
    }));
    const CHARGE = stubAttachment({ id: "charge", attachesTo: { kind: "villain" }, keywords: [{ name: "setup" }], statModifiers: { atk: 1 }, abilities: [charge.ref] });
    const { deps, state } = setup({ cards: [CHARGE], abilities: [charge], villain: villainWith({ atk: 4 }), encounter: [CHARGE.id, ...copies(BLANK.id, 20)] });
    const chargeId = mustInstance(state, activeVillain(state).instanceId).attachments[0] as InstanceId;
    expect(chargeId).toBeDefined();
    const given = giveCards(state, p1, ALLY.id, RESOURCE.id, RESOURCE.id);
    const [allyId, r1, r2] = given.ids as [InstanceId, InstanceId, InstanceId];
    const playAlly: Command = {
      type: "playCard",
      playerId: p1,
      cardInstanceId: allyId,
      payment: [{ fromHand: r1 }, { fromHand: r2 }],
      attachToInstanceId: null,
    };
    const withAlly = runWith(deps, given.state, toHero, playAlly, endTurn);
    expect(mustPlayer(withAlly, p1).playArea).toContain(allyId);
    const atDefense = settleUntil(withAlly, "declareDefender", deps);
    const after = resolvePending(atDefense, [allyId], deps);
    // Villain ATK 4 + Charge +1 = 5 into a 3-HP ally: 2 excess spills to the ally's controller.
    expect(mustPlayer(after, p1).discard).toContain(allyId);
    expect(damageOn(after, identityOf(after))).toBe(2);
    expect(activeEncounterDeck(after).discard).toContain(chargeId);
  });

  it("'give him 1 additional boost card for this activation'", () => {
    const klaw = stubAbility("klaw-boost", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
      effects: [{ kind: "modifyAttack", extraBoostCards: 1 }],
    }));
    const oneIcon = stubTreachery({ id: "icon", boostIcons: 1 });
    const { deps, state } = setup({ cards: [oneIcon], abilities: [klaw], villain: villainWith({ atk: 1, abilities: [klaw.ref] }), encounter: copies(oneIcon.id, 20) });
    const hero = runWith(deps, state, toHero);
    const atDefense = settleUntil(runWith(deps, hero, endTurn), "declareDefender", deps);
    const { state: after, events } = run(deps, atDefense, {
      type: "resolveChoice",
      playerId: p1,
      choiceId: atDefense.pendingChoice?.choiceId as never,
      selectedOptionIds: ["decline"],
    });
    const flips = events.filter((e: GameEvent) => e.type === "boostCardFlipped");
    expect(flips).toHaveLength(2);
    expect(damageOn(after, identityOf(after))).toBe(3);
  });

  it("'After your hero defends against an enemy attack' (Counter-Punch) fires on a basic defense", () => {
    const counter = stubAbility("counter-punch", def({
      trigger: { kind: "response", forced: false, on: { on: "defended", playerIs: "controller" }, form: "hero" },
      label: ["attack"],
      effects: [{ kind: "attack", target: { kind: "eventSource" }, amount: { kind: "stat", of: { kind: "identityOf", player: { kind: "controller" } }, stat: "atk" } }],
    }));
    const COUNTER = stubEvent({ id: "counter", cost: 0, abilities: [counter.ref] });
    const { deps, state } = setup({ cards: [COUNTER], abilities: [counter] });
    const given = giveCards(state, p1, "counter");
    const atDefense = settleUntil(runWith(deps, given.state, toHero, endTurn), "declareDefender", deps);
    const offered = resolvePending(atDefense, [identityOf(atDefense)], deps);
    expect(offered.pendingChoice?.prompt.kind).toBe("chooseTriggers");
    // Selecting the event in `chooseTriggers` plays it: a 0-cost event in a
    // window asks for no payment (see `requestWindowPayment`).
    const played = resolvePending(offered, [`${given.ids[0]}:counter-punch`], deps);
    const after = settle(played, undefined, deps);
    expect(damageOn(after, activeVillain(after).instanceId)).toBe(2);
  });

  it("a (defense) ability makes the identity the defender without its DEF reducing the damage", () => {
    const brace = stubAbility("brace", def({
      trigger: { kind: "interrupt", forced: false, on: { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true }, form: "hero" },
      label: ["defense"],
      effects: [],
    }));
    const BRACE = stubEvent({ id: "brace", cost: 0, abilities: [brace.ref] });
    const { deps, state } = setup({ cards: [BRACE], abilities: [brace], villain: villainWith({ atk: 3 }) });
    const given = giveCards(state, p1, "brace");
    const offered = settleUntil(runWith(deps, given.state, toHero, endTurn), "chooseTriggers", deps);
    // Selecting it in `chooseTriggers` plays it — a 0-cost event asks for no
    // payment — so the defence happens in *this* command's events.
    const { state: afterPay, events } = run(deps, offered, {
      type: "resolveChoice",
      playerId: p1,
      choiceId: offered.pendingChoice?.choiceId as never,
      selectedOptionIds: [`${given.ids[0]}:brace`],
    });
    const defended = events.find((e: GameEvent) => e.type === "triggerEvent" && e.event.kind === "defended");
    expect(defended && defended.type === "triggerEvent" && defended.event).toMatchObject({ kind: "defended", basic: false });
    // The hero may still make a basic defense; declining keeps the labeled defense (not undefended).
    const after = settle(afterPay, undefined, deps);
    expect(damageOn(after, identityOf(after))).toBe(3);
  });

  it("boost abilities read the attack in progress: 'undefended attack' and 'if this activation deals damage'", () => {
    const kree = stubAbility("kree-boost", def({
      trigger: { kind: "boost" },
      effects: [
        { kind: "if", condition: { kind: "currentAttack", key: "undefended", atLeast: 1 }, then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }] },
        {
          kind: "atEndOfAttack",
          effects: [{ kind: "if", condition: { kind: "eventResultAtLeast", key: "damage", amount: 1 }, then: [{ kind: "exhaust", target: { kind: "identityOf", player: { kind: "eventPlayer" } } }] }],
        },
      ],
    }));
    const KREE = stubTreachery({ id: "kree", boostIcons: 0, abilities: [kree.ref] });
    const { deps, state } = setup({ cards: [KREE], abilities: [kree], encounter: copies(KREE.id, 20) });
    const atDefense = settleUntil(runWith(deps, state, toHero, endTurn), "declareDefender", deps);
    const threatBefore = threatOnMain(atDefense);
    const after = resolvePending(atDefense, ["decline"], deps);
    expect(threatOnMain(after)).toBe(threatBefore + 1);
    expect(damageOn(after, identityOf(after))).toBe(2);
    expect(mustInstance(after, identityOf(after)).exhausted).toBe(true);
  });
});

test("ability attacks, defenses and enemy-attack modifications replay to an identical state", () => {
  const charge = stubAbility("charge", def({
    trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
    effects: [{ kind: "modifyAttack", overkill: true, extraBoostCards: 1 }, { kind: "atEndOfAttack", effects: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
  }));
  const CHARGE = stubAttachment({ id: "charge", attachesTo: { kind: "villain" }, keywords: [{ name: "setup" }], abilities: [charge.ref] });
  const { deps, state } = setup({ cards: [KICK, CHARGE], abilities: [kickAbility, charge], encounter: [CHARGE.id, ...copies(BLANK.id, 20)] });
  const given = giveCards(state, p1, "kick");
  let session: GameSession = startSession(given.state);
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply(toHero);
  apply(play(given.ids[0] as InstanceId));
  apply(endTurn);
  while (session.state.pendingChoice) {
    const choice = session.state.pendingChoice;
    apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: choice.prompt.kind === "declareDefender" ? ["decline"] : choice.options.slice(0, choice.minSelections).map((o) => o.optionId) });
  }
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});
