import { activeEncounterDeck } from "./query.js";
import { withEncounterPiles } from "./testing/scenario.js";
import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubMainScheme, stubMinion, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { ALLY, newGame, resolvePending, RESOURCE, runWith, settle, settleUntil } from "./testing/scenario.js";

// Encounter-card effects that make enemies attack/scheme, reusing the enemy activation procedures.
const p1 = playerId("p1");
const p2 = playerId("p2");
const def = (definition: AbilityDefinition) => definition;
const toHero = (player = p1): Command => ({ type: "changeForm", playerId: player });
const endTurn = (player = p1): Command => ({ type: "endTurn", playerId: player });
const copies = (id: CardId, n = 20): readonly CardId[] => Array.from({ length: n }, () => id);
const you = { kind: "controller" } as const;

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({ id: "scheme", stages: [{ startingThreat: flat(5), targetThreat: flat(40), acceleration: flat(0) }] });
const VILLAIN = (atk = 2, sch = 1) => stubVillain({ id: "villain", stages: [{ hp: flat(30), atk, sch }] });

/** A treachery whose When Revealed runs `effects`; the encounter deck is all copies of it (boost icons 0). */
function treacheryGame(effects: readonly EffectSpec[], options: { villain?: ReturnType<typeof stubVillain>; players?: number; extra?: readonly AnyCard[]; extraAbilities?: readonly StubAbility[]; encounter?: readonly CardId[] } = {}) {
  const ability = stubAbility("revealed", def({ trigger: { kind: "whenRevealed" }, effects }));
  const card = stubTreachery({ id: "t", boostIcons: 0, abilities: [ability.ref] });
  const deps = depsOf(ability, ...(options.extraAbilities ?? []));
  const state = newGame({
    players: options.players ?? 1,
    villain: options.villain ?? VILLAIN(),
    mainScheme: SCHEME,
    extraCards: [card, BLANK, ...(options.extra ?? [])],
    deck: [...copies(RESOURCE.id, 12), ...copies(ALLY.id, 6)],
    encounterDeck: options.encounter ?? copies(card.id),
    deps,
  });
  return { deps, state, card };
}

const identityOf = (state: GameState, player = p1) => mustPlayer(state, player).identity.instanceId;
const damageOn = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const revealedCount = (state: GameState, cardId: CardId) => activeEncounterDeck(state).discard.filter((id) => state.instances[id]?.cardId === cardId).length;
const decline = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : (state.pendingChoice?.options.slice(0, state.pendingChoice.minSelections).map((o) => o.optionId) ?? []);
/**
 * Test surgery: reorder the encounter deck so its first cards are copies of `order`, in order.
 * In round 1 the villain's activation draws a boost card first (one per player), then each player is dealt one.
 */
function stackEncounter(state: GameState, ...order: readonly CardId[]): GameState {
  const rest = [...activeEncounterDeck(state).deck];
  const top: InstanceId[] = [];
  for (const card of order) {
    const index = rest.findIndex((id) => state.instances[id]?.cardId === card);
    if (index < 0) throw new Error(`no ${card} in the encounter deck`);
    top.push(rest[index] as InstanceId);
    rest.splice(index, 1);
  }
  return withEncounterPiles(state, { deck: [...top, ...rest] });
}

const patch = (state: GameState, id: InstanceId, change: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...change } },
});

describe("'X attacks you' / 'The villain schemes'", () => {
  const assault: readonly EffectSpec[] = [
    {
      kind: "if",
      condition: { kind: "form", player: you, form: "hero" },
      then: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you }],
      otherwise: [{ kind: "gainSurge" }],
    },
  ];

  it("'When Revealed (Hero): The villain attacks you' runs a full attack against the revealing player", () => {
    const { deps, state } = treacheryGame(assault);
    // Hero form: the villain's own activation, then the treachery's attack.
    const firstDefense = settleUntil(runWith(deps, state, toHero(), endTurn()), "declareDefender", deps);
    const secondDefense = settleUntil(resolvePending(firstDefense, ["decline"], deps), "declareDefender", deps);
    expect(secondDefense.pendingChoice?.prompt.kind).toBe("declareDefender");
    const after = settle(resolvePending(secondDefense, ["decline"], deps), decline, deps);
    expect(damageOn(after, identityOf(after))).toBe(4);
  });

  it("'When Revealed (Alter-Ego): This card gains surge'", () => {
    const { deps, state, card } = treacheryGame(assault, { encounter: [...copies(BLANK.id, 10)], extra: [] });
    // Test surgery: encounter deck = [blank (the villain's boost card), Assault (the dealt card), blanks…].
    const [boost, dealt, ...rest] = activeEncounterDeck(state).deck as [InstanceId, InstanceId, ...InstanceId[]];
    const stacked: GameState = {
      ...patch(state, dealt, { cardId: card.id }),
      encounterDecks: withEncounterPiles(state, { deck: [boost, dealt, ...rest] }).encounterDecks,
    };
    const after = settle(runWith(deps, stacked, endTurn()), decline, deps);
    expect(revealedCount(after, card.id)).toBe(1);
    // The boost card plus the one extra card revealed by the surge.
    expect(revealedCount(after, BLANK.id)).toBe(2);
  });

  it("'The villain schemes' (Advance) places the villain's SCH", () => {
    const { deps, state } = treacheryGame([{ kind: "enemyScheme", enemies: { kind: "villain" } }], { villain: VILLAIN(0, 3) });
    const after = settle(runWith(deps, state, endTurn()), decline, deps);
    // Villain activation (alter-ego → scheme 3) + Advance (scheme 3).
    expect(threat(after)).toBe(5 + 3 + 3);
  });

  it("'Ultron schemes. Discard the top card of your deck for each threat placed this way' — scheme results bind", () => {
    const { deps, state } = treacheryGame(
      [
        { kind: "enemyScheme", enemies: { kind: "villain" }, bind: "s" },
        { kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: { kind: "var", name: "s.threatPlaced" } }, to: "discard" },
      ],
      { villain: VILLAIN(0, 2) },
    );
    const discardBefore = mustPlayer(state, p1).discard.length;
    const after = settle(runWith(deps, state, endTurn()), decline, deps);
    // 2 threat placed → 2 cards discarded from the deck (plus the end-of-phase draw doesn't discard).
    expect(mustPlayer(after, p1).discard.length - discardBefore).toBe(2);
  });
});

describe("attack results: 'if this attack deals damage' / 'that character is stunned' / 'if no attack was made'", () => {
  const vengeance: readonly EffectSpec[] = [
    { kind: "enemyAttack", enemies: { kind: "villain" }, against: you, bind: "v" },
    { kind: "if", condition: { kind: "varAtLeast", name: "v.damage", amount: 1 }, then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 1 } }] },
  ];

  it("'If this attack deals damage, place 1 threat on the main scheme' (Klaw's Vengeance) — only when damage lands", () => {
    const { deps, state } = treacheryGame(vengeance, { villain: VILLAIN(2, 0) });
    const first = settleUntil(runWith(deps, state, toHero(), endTurn()), "declareDefender", deps);
    const second = settleUntil(resolvePending(first, ["decline"], deps), "declareDefender", deps);
    // Defend the treachery's attack with the hero: DEF 2 vs ATK 2 → no damage → no threat.
    const blocked = settle(resolvePending(second, [identityOf(second)], deps), decline, deps);
    expect(threat(blocked)).toBe(5);
    // Undefended: damage lands → +1 threat.
    const landed = settle(resolvePending(second, ["decline"], deps), decline, deps);
    expect(threat(landed)).toBe(6);
  });

  it("'Rhino attacks you. If a character is damaged by this attack, that character is stunned' (Stampede)", () => {
    const { deps, state } = treacheryGame([
      { kind: "enemyAttack", enemies: { kind: "villain" }, against: you, bind: "s" },
      { kind: "giveStatus", target: { kind: "slot", slot: "s.damaged" }, status: "stunned" },
    ]);
    const after = settle(runWith(deps, state, toHero(), endTurn()), decline, deps);
    expect(mustInstance(after, identityOf(after)).statuses.stunned).toBe(1);
  });

  it("a stunned enemy discards the stun instead of attacking; 'If Titania did not attack, heal her and this card gains surge'", () => {
    const TITANIA = stubMinion({ id: "titania", atk: 3, sch: 1, hp: 6, boostIcons: 0 });
    const fury: readonly EffectSpec[] = [
      { kind: "enemyAttack", enemies: { kind: "named", name: "titania" }, against: you, bind: "t" },
      {
        kind: "if",
        condition: { kind: "not", of: { kind: "varAtLeast", name: "t.made", amount: 1 } },
        then: [{ kind: "heal", target: { kind: "named", name: "titania" }, amount: { kind: "const", value: 99 } }, { kind: "gainSurge" }],
      },
    ];
    const { deps, state, card } = treacheryGame(fury, { villain: VILLAIN(0, 0), extra: [TITANIA] });
    // Test surgery: turn one encounter-deck card into a stunned, damaged Titania engaged with p1.
    const titaniaId = activeEncounterDeck(state).deck[activeEncounterDeck(state).deck.length - 1] as InstanceId;
    const withTitania: GameState = {
      ...patch(state, titaniaId, {
        cardId: TITANIA.id,
        damage: 2,
        statuses: { stunned: 1, confused: 0, tough: 0 },
        engagedWith: p1,
        controllerId: null,
        faceup: true,
      }),
      encounterDecks: withEncounterPiles(state, { deck: activeEncounterDeck(state).deck.filter((id) => id !== titaniaId) }).encounterDecks,
      players: state.players.map((p) => (p.playerId === p1 ? { ...p, playArea: [...p.playArea, titaniaId] } : p)),
    };
    // Alter-ego form: Titania's own activation is a scheme, so her stun is still there at the reveal.
    // 1st Titania's Fury: stunned → no attack → heal all + surge. 2nd: she attacks the alter-ego for 3 → no surge.
    const after = settle(runWith(deps, withTitania, endTurn()), decline, deps);
    expect(mustInstance(after, titaniaId).damage).toBe(0);
    expect(mustInstance(after, titaniaId).statuses.stunned).toBe(0);
    // Copies in the discard: the villain's boost card + the two revealed Titania's Fury.
    expect(revealedCount(after, card.id)).toBe(3);
    expect(damageOn(after, identityOf(after))).toBe(3);
  });

  it("'The villain and each minion engaged with you attacks you' (Gang-Up) — counts the attacks made", () => {
    const THUG = stubMinion({ id: "thug", atk: 1, sch: 0, hp: 5, boostIcons: 0 });
    const gangUp: readonly EffectSpec[] = [
      { kind: "enemyAttack", enemies: { kind: "villain" }, against: you, bind: "g" },
      { kind: "enemyAttack", enemies: { kind: "each", query: { categories: ["minion"], engagedWith: "you" } }, against: you, bind: "g" },
      { kind: "if", condition: { kind: "varAtLeast", name: "g.made", amount: 2 }, then: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 10 } }] },
    ];
    const { deps, state, card } = treacheryGame(gangUp, { villain: VILLAIN(1, 0), extra: [THUG], encounter: [THUG.id, ...copies(BLANK.id, 4)] });
    // Round 1 (alter-ego): boost card = blank, dealt card = the thug, which engages p1.
    const roundTwo = settle(runWith(deps, stackEncounter(state, BLANK.id, THUG.id), endTurn()), decline, deps);
    expect(mustPlayer(roundTwo, p1).playArea.some((id) => roundTwo.instances[id]?.cardId === THUG.id)).toBe(true);
    // Round 2: index 0 is the villain attack's boost card; the dealt card (index 1) becomes Gang-Up.
    const nextId = activeEncounterDeck(roundTwo).deck[1] as InstanceId;
    const rigged: GameState = { ...roundTwo, instances: { ...roundTwo.instances, [nextId]: { ...mustInstance(roundTwo, nextId), cardId: card.id } } };
    const after = settle(runWith(deps, rigged, toHero(), endTurn()), decline, deps);
    expect(threat(after)).toBe(15);
  });
});

describe("encounter-card 'you' and Whirlwind", () => {
  it("'After Radioactive Man attacks you, discard 1 card at random from your hand' — 'you' is the attacked player", () => {
    const radiation = stubAbility("radioactive", def({
      trigger: { kind: "response", forced: true, on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true } },
      effects: [{ kind: "discardFromHand", player: you, amount: { kind: "const", value: 1 }, random: true }],
    }));
    const RADIOACTIVE = stubMinion({ id: "radioactive", atk: 1, sch: 0, hp: 7, boostIcons: 0, abilities: [radiation.ref] });
    const deps = depsOf(radiation);
    const state = newGame({ villain: VILLAIN(0, 0), mainScheme: SCHEME, extraCards: [RADIOACTIVE, BLANK], encounterDeck: [RADIOACTIVE.id, ...copies(BLANK.id, 10)], deps });
    const roundTwo = settle(runWith(deps, stackEncounter(state, BLANK.id, RADIOACTIVE.id), endTurn()), decline, deps);
    expect(mustPlayer(roundTwo, p1).playArea.some((id) => roundTwo.instances[id]?.cardId === RADIOACTIVE.id)).toBe(true);
    const atDefense = settleUntil(runWith(deps, roundTwo, toHero(), endTurn()), "declareDefender", deps);
    // Villain (ATK 0) first, then Radioactive Man.
    const second = settleUntil(resolvePending(atDefense, ["decline"], deps), "declareDefender", deps);
    const handBefore = mustPlayer(second, p1).hand.length;
    const after = resolvePending(second, ["decline"], deps);
    expect(mustPlayer(after, p1).hand.length).toBe(handBefore - 1);
  });

  it("'When Whirlwind attacks you, also resolve his attack against each other hero' (not re-triggered by those)", () => {
    const whirl = stubAbility("whirlwind", def({
      trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true } },
      effects: [{ kind: "atEndOfAttack", effects: [{ kind: "enemyAttack", enemies: { kind: "self" }, against: { kind: "others", of: you }, additionalResolution: true }] }],
    }));
    const WHIRLWIND = stubMinion({ id: "whirlwind", atk: 2, sch: 0, hp: 6, boostIcons: 0, abilities: [whirl.ref] });
    const deps = depsOf(whirl);
    const state = newGame({ players: 2, villain: VILLAIN(0, 0), mainScheme: SCHEME, extraCards: [WHIRLWIND, BLANK], encounterDeck: [WHIRLWIND.id, ...copies(BLANK.id, 10)], deps });
    const roundTwo = settle(runWith(deps, stackEncounter(state, BLANK.id, BLANK.id, WHIRLWIND.id), endTurn(p1), endTurn(p2)), decline, deps);
    const engagedWith = [p1, p2].find((p) => mustPlayer(roundTwo, p).playArea.some((id) => roundTwo.instances[id]?.cardId === WHIRLWIND.id));
    expect(engagedWith).toBeDefined();
    const heroes = runWith(deps, roundTwo, toHero(roundTwo.firstPlayerId), endTurn(roundTwo.firstPlayerId));
    const second = roundTwo.players.find((p) => p.playerId !== roundTwo.firstPlayerId)?.playerId ?? p2;
    const after = settle(runWith(deps, heroes, toHero(second), endTurn(second)), decline, deps);
    // Whirlwind's single activation hits both heroes once each (2 damage); no loop.
    expect(damageOn(after, identityOf(after, p1))).toBe(2);
    expect(damageOn(after, identityOf(after, p2))).toBe(2);
  });
});

test("enemy-action effects replay to an identical state", () => {
  const { deps, state } = treacheryGame([
    { kind: "enemyAttack", enemies: { kind: "villain" }, against: you, bind: "s" },
    { kind: "giveStatus", target: { kind: "slot", slot: "s.damaged" }, status: "stunned" },
    { kind: "enemyScheme", enemies: { kind: "villain" } },
  ]);
  let session: GameSession = startSession(state);
  const apply = (command: Command) => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  };
  apply(toHero());
  apply(endTurn());
  while (session.state.pendingChoice) {
    const choice = session.state.pendingChoice;
    apply({ type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: decline(session.state) });
  }
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});
