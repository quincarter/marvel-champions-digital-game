/**
 * Issue #1006 sections 1.3, 1.4 and 1.5: lines for what happened without one (a minion put into play from the encounter
 * discard, damage placed on an attachment, a mill and the cards it returns to hand, a card effect's draw, an extra
 * attack), the duplicates folded to one line (tough, surge, temporary, a counter removal), and the reasons stated
 * (cannot take damage, what dealt an encounter card, a search that reveals). Built from the events the engine emits.
 */

import { activeVillain } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { AbilityId } from "@mc/content";
import type { EncounterDeckId, GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { ALLIANCE_DEV_CARD, startAllianceDevGame } from "../store/dev-alliance-game.js";
import { codeOf, ids, nextTurn } from "../store/dev-game-steps.js";
import { appendEvents, emptyLog } from "./log-lines.js";

let state: GameState;
let p1: PlayerId;
let p2: PlayerId;
let villain: InstanceId;
let identity1: InstanceId;
let deckCards: InstanceId[];
let hand1: readonly InstanceId[];
let deckId: EncounterDeckId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
    seed: 3,
  });
  state = store.state.game!;
  p1 = state.players[0]!.playerId;
  p2 = state.players[1]!.playerId;
  villain = activeVillain(state).instanceId;
  identity1 = state.players[0]!.identity.instanceId;
  hand1 = state.players[0]!.hand;
  const [id, encounterDeck] = Object.entries(state.encounterDecks)[0]!;
  deckId = id as EncounterDeckId;
  deckCards = [...encounterDeck.deck];
}, 30_000);

const lines = (events: readonly GameEvent[], viewer: PlayerId = p1): string[] =>
  appendEvents(emptyLog(), events, state, viewer, POOL_DEPS).lines.map((line) => line.text);
const cardIdOf = (id: InstanceId) => state.instances[id]!.cardId;
const ability = (id: string) => id as AbilityId;
const dealt = (id: InstanceId, source: string): GameEvent[] => [
  {
    type: "cardMoved",
    instanceId: id,
    cardId: cardIdOf(id),
    from: { kind: "encounterDeck", deckId },
    to: { kind: "dealtEncounter", playerId: p1 },
  },
  { type: "encounterCardDealt", playerId: p1, instanceId: id, source } as GameEvent,
];

describe("lines for what happened silently (1.3)", () => {
  test("a card put into play from the encounter discard is told, and a minion engages", () => {
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: villain,
        cardId: cardIdOf(villain),
        from: { kind: "encounterDiscard", deckId },
        to: { kind: "playArea", playerId: p1 },
      },
    ];
    expect(lines(events)).toEqual([expect.stringMatching(/ is put into play from the encounter discard/)]);
  });

  test("damage placed on a card is told, a manual adjustment is left to its own line", () => {
    const placed: GameEvent = {
      type: "damagePlaced",
      targetInstanceId: identity1,
      amount: 2,
      sourceInstanceId: villain,
    };
    expect(lines([placed])[0]).toMatch(/^2 damage is placed on .* by /);
    expect(lines([{ ...placed, sourceInstanceId: identity1 } as GameEvent])[0]).toMatch(
      /^2 damage is placed on [^b]*\.$/,
    );
    expect(lines([{ ...placed, sourceInstanceId: null } as GameEvent])).toEqual([]);
  });

  test("a mill and the cards taken back to hand from the discard are told (Black Cat)", () => {
    const [milled, kept] = [hand1[0]!, hand1[1]!];
    const events: GameEvent[] = [
      {
        type: "cardMoved",
        instanceId: milled,
        cardId: cardIdOf(milled),
        from: { kind: "deck", playerId: p1 },
        to: { kind: "discard", playerId: p1 },
      },
      {
        type: "cardMoved",
        instanceId: kept,
        cardId: cardIdOf(kept),
        from: { kind: "discard", playerId: p1 },
        to: { kind: "hand", playerId: p1 },
      },
    ];
    const out = lines(events);
    expect(out[0]).toMatch(/is discarded from the top of your deck\.$/);
    expect(out[1]).toMatch(/goes from your discard pile to your hand\.$/);
  });

  test("a deck discard that pays a cost keeps its one cost line", () => {
    const id = hand1[0]!;
    const out = lines([
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "deck", playerId: p1 },
        to: { kind: "discard", playerId: p1 },
      },
      {
        type: "deckDiscardCostSettled",
        instanceId: null,
        playerId: p1,
        chosen: 1,
        discarded: [id],
        paid: true,
      } as GameEvent,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/from the top of your deck as a cost/);
  });

  test("an extra attack after the first (Hydra Jet-Trooper's boost) gets its own attacks line", () => {
    const initiated = (): GameEvent => ({
      type: "triggerEvent",
      phase: "initiated",
      event: {
        kind: "enemyAttack",
        enemyInstanceId: villain,
        attackedPlayerId: p1,
        targetPlayerId: p1,
        targetInstanceId: identity1,
      },
    });
    const resolved: GameEvent = {
      type: "attackResolved",
      enemyInstanceId: villain,
      targetInstanceId: identity1,
      baseAtk: 3,
      boostIcons: 0,
      defenseReduction: 0,
      damageDealt: 3,
    } as GameEvent;
    const activated: GameEvent = {
      type: "enemyActivated",
      enemyInstanceId: villain,
      activation: "attack",
      playerId: p1,
    };
    const out = lines([activated, initiated(), resolved, initiated(), resolved]);
    expect(out.filter((l) => / attacks /.test(l))).toHaveLength(2);
    expect(out.filter((l) => l.endsWith("attacks you again."))).toHaveLength(1);
    // The first attack, begun by its activation, is not repeated by the trigger.
    expect(lines([activated, initiated()])).toHaveLength(1);
  });

  test("a card effect's draw is told, a draw outside any frame (opening hand, refill) is not", () => {
    const drawn = (id: InstanceId): GameEvent => ({ type: "cardDrawn", playerId: p1, instanceId: id });
    const push = { type: "framePushed", frameId: "f1", frame: "effects", description: "draw" } as unknown as GameEvent;
    const pop = { type: "framePopped", frameId: "f1", frame: "effects" } as unknown as GameEvent;
    const draws = (events: GameEvent[]) => lines(events).filter((l) => /draw/.test(l));
    expect(draws([push, drawn(hand1[0]!), pop])).toEqual(["You draw a card."]);
    expect(draws([push, drawn(hand1[0]!), drawn(hand1[1]!), pop])).toEqual(["You draw 2 cards."]);
    // The frame was pushed by an earlier command (a choice answered later), or is still open when the command ends.
    expect(draws([drawn(hand1[0]!), pop])).toEqual(["You draw a card."]);
    expect(draws([push, drawn(hand1[0]!)])).toEqual(["You draw a card."]);
    // A frame that closed before the draw (a setup ability) did not make it.
    expect(draws([push, pop, drawn(hand1[0]!), drawn(hand1[1]!)])).toEqual([]);
    expect(draws([drawn(hand1[0]!)])).toEqual([]);
  });

  test("Avengers Mansion's draw for a teammate, the choice answered in a later command, is told (real engine)", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "core-spider-man-justice" }],
      seed: 7,
      stack: { players: { 0: ids("01091", "01012", "01012", "01012", "01013", "01013") } },
    });
    const turn = (await nextTurn(store))!;
    const game = store.state.game!;
    const me = game.players[0]!;
    const mate = game.players[1]!.playerId;
    const play = turn.legal.find((e) => e.action.kind === "playCard" && codeOf(game, e.action.instanceId) === "01091")!;
    if (play.example.type !== "playCard") throw new Error("not a play");
    const others = me.hand.filter((id) => codeOf(game, id) !== "01091");
    for (let count = 0; count <= others.length; count++) {
      await store.dispatch({ ...play.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
      if (!store.state.error) break;
    }
    const afterPlay = store.state.legal!.actions;
    if (afterPlay.kind !== "turn") throw new Error("not on a turn");
    const mansion = Object.values(store.state.game!.instances).find((i) => (i.cardId as string) === "01091")!;
    const use = afterPlay.legal.find(
      (e) =>
        e.action.kind === "useAbility" &&
        e.example.type === "useAbility" &&
        e.example.cardInstanceId === mansion.instanceId,
    )!;
    await store.dispatch(use.example);
    // The ability's command stops at the target choice; the draw is in the command that answers it.
    expect(store.state.lastEvents.some((e) => e.type === "cardDrawn")).toBe(false);
    const choice = store.state.legal!.actions;
    if (choice.kind !== "choice") throw new Error("no choice");
    await store.resolveChoice([choice.choice.options.find((o) => o.optionId === (mate as string))!.optionId]);
    const events = store.state.lastEvents;
    expect(events.some((e) => e.type === "cardDrawn" && e.playerId === mate)).toBe(true);
    const read = (viewer: PlayerId) =>
      appendEvents(emptyLog(), events, store.state.game!, viewer, POOL_DEPS).lines.map((line) => line.text);
    expect(read(me.playerId).filter((l) => /draw/.test(l))).toEqual([expect.stringMatching(/ draws a card\.$/)]);
    expect(read(mate).filter((l) => /draw/.test(l))).toEqual(["You draw a card."]);
  }, 30_000);
});

describe("one line for one thing (1.4)", () => {
  test("a tough card used up reads once", () => {
    const out = lines([
      { type: "damagePrevented", targetInstanceId: villain, amount: 3, reason: "tough" },
      { type: "statusRemoved", instanceId: villain, status: "tough", reason: "preventedDamage" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/took 0 damage/);
  });

  test("a surge's deal reads once, in the surge's line", () => {
    const id = deckCards[0]!;
    const out = lines([
      { type: "surgeTriggered", instanceId: villain, playerId: p1 } as GameEvent,
      ...dealt(id, "surge"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/surges/);
  });

  test("a Temporary card's discard reads once", () => {
    const out = lines([
      { type: "abilityResolved", instanceId: identity1, abilityId: ability("keyword:temporary"), controllerId: p1 },
      { type: "keywordResolved", keyword: "temporary", instanceId: identity1, playerId: p1 } as GameEvent,
      { type: "cardDiscardedFromPlay", instanceId: identity1, cardId: cardIdOf(identity1) } as GameEvent,
    ]);
    expect(out).toEqual([expect.stringMatching(/Temporary: discarded at the end of the round\.$/)]);
  });

  test("Bishop's counters read once, with the real count", () => {
    const out = lines([
      { type: "counterRemoved", instanceId: identity1, counterType: "energy", amount: 5 },
      {
        type: "abilityResolved",
        instanceId: identity1,
        abilityId: ability("37011.bishop-interrupt"),
        controllerId: p1,
      },
    ]);
    expect(out.filter((l) => /energy counter/.test(l))).toHaveLength(1);
    expect(out.join("\n")).toMatch(/loses 5 energy counters/);
  });
});

describe("the why (1.5)", () => {
  test("damage into a card that cannot take damage says so", () => {
    const out = lines([{ type: "damagePrevented", targetInstanceId: villain, amount: 3, reason: "cannotTakeDamage" }]);
    expect(out[0]).toMatch(/took 0 damage: it cannot take damage\.$/);
  });

  test("an encounter card dealt by a defeat names the defeated card", () => {
    const id = deckCards[1]!;
    const out = lines([
      { type: "schemeDefeated", instanceId: villain, cardId: cardIdOf(villain) },
      ...dealt(id, "ability"),
    ]);
    expect(out.at(-1)).toMatch(/dealt a facedown encounter card \(.* was defeated\)\.$/);
  });

  test("an encounter card dealt by an ability names the ability's card", () => {
    const id = deckCards[1]!;
    const out = lines([
      { type: "abilityResolved", instanceId: villain, abilityId: ability("x.when-defeated"), controllerId: p1 },
      ...dealt(id, "ability"),
    ]);
    expect(out.at(-1)).toMatch(/\(by .*\)\.$/);
  });

  test("a search that reveals the card is not a deal", () => {
    const id = deckCards[2]!;
    const out = lines([
      ...dealt(id, "ability"),
      { type: "encounterCardRevealed", instanceId: id, cardId: cardIdOf(id), playerId: p1 },
    ]);
    expect(out.join("\n")).not.toMatch(/dealt a facedown encounter card/);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/revealed/);
  });

  test("an effect's deal that waits for the reveal step is still a deal", () => {
    const id = deckCards[3]!;
    const out = lines([
      ...dealt(id, "ability"),
      {
        type: "stepChanged",
        from: { phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] },
        to: { phase: "villain", kind: "revealEncounterCards", remainingPlayerIds: [p1, p2] },
      } as GameEvent,
      { type: "encounterCardRevealed", instanceId: id, cardId: cardIdOf(id), playerId: p1 },
    ]);
    expect(out[0]).toMatch(/dealt a facedown encounter card/);
  });

  test("an attack that ends because a player was eliminated says who", () => {
    const out = lines([
      { type: "enemyActivated", enemyInstanceId: villain, activation: "attack", playerId: p2 },
      { type: "playerEliminated", playerId: p2 },
      { type: "activationSkipped", enemyInstanceId: villain, activation: "attack", reason: "playerEliminated" },
    ]);
    expect(out.at(-1)).toMatch(/^The attack ends: .* was eliminated\.$/);
    expect(
      lines([
        { type: "activationSkipped", enemyInstanceId: villain, activation: "attack", reason: "playerEliminated" },
      ]),
    ).toEqual(["The attack ends: a player was eliminated."]);
  });
});

describe("help paying, read from the engine's own payment (1.1 review)", () => {
  test("another seat's hand cards paying for an Alliance play read as help, the payer's own do not", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startAllianceDevGame(store);
    const game = store.state.game!;
    const [payer, helper] = game.players;
    const actions = store.state.legal!.actions;
    if (actions.kind !== "turn") throw new Error("not on a turn");
    const play = actions.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        (game.instances[entry.action.instanceId]?.cardId as string) === ALLIANCE_DEV_CARD,
    )!;
    const command = play.example;
    if (command.type !== "playCard") throw new Error("not a play");
    // Star-Lord's cards pay, one more each time, until the engine takes the payment.
    let accepted = false;
    for (let count = 1; count <= helper!.hand.length && !accepted; count++) {
      accepted = await store.dispatch({
        ...command,
        payment: helper!.hand.slice(0, count).map((instanceId) => ({ fromHand: instanceId })),
      });
    }
    expect(accepted).toBe(true);
    const events = store.state.lastEvents;
    const text = appendEvents(emptyLog(), events, store.state.game!, payer!.playerId, POOL_DEPS).lines.map(
      (line) => line.text,
    );
    expect(events.some((e) => e.type === "paymentCommitted")).toBe(true);
    expect(text.filter((l) => l.endsWith("to help pay.")).length).toBeGreaterThan(0);
    expect(text.filter((l) => /^You discard .* to help pay/.test(l))).toEqual([]);
  });
});

describe("a facedown move into a scenario area keeps the card hidden (1.2 review)", () => {
  test("it is not named by the area it lands in", () => {
    const id = deckCards[4]!;
    const out = lines([
      {
        type: "cardMoved",
        instanceId: id,
        cardId: cardIdOf(id),
        from: { kind: "encounterDeck", deckId },
        to: { kind: "scenarioArea", name: "Damnation" },
      } as GameEvent,
    ]);
    expect(out).toEqual(["a facedown card is put into Damnation."]);
  });
});

describe("cards in play may be facedown (review)", () => {
  const hit = (id: InstanceId): GameEvent =>
    ({ type: "damageDealt", targetInstanceId: id, amount: 2, sourceInstanceId: villain }) as GameEvent;
  const toDeck = (id: InstanceId): GameEvent => ({
    type: "cardMoved",
    instanceId: id,
    cardId: cardIdOf(id),
    from: { kind: "playArea", playerId: p1 },
    to: { kind: "deck", playerId: p1 },
  });

  test("a facedown card in play moved to a deck with no defeat stays a facedown card", () => {
    const id = deckCards[5]!;
    expect(lines([hit(id), toDeck(id)])[0]).toMatch(/^a facedown card took 2 damage/);
  });

  test("a card defeated in play (Dreadpool) is still named by its face", () => {
    const id = deckCards[6]!;
    const out = lines([
      hit(id),
      { type: "characterDefeated", instanceId: id, cardId: cardIdOf(id) } as GameEvent,
      toDeck(id),
    ]);
    expect(out[0]).not.toMatch(/a facedown card/);
  });
});

describe("attacks that no activation announces (review)", () => {
  test("an effect's attack in another step gets an attacks line, without again", () => {
    const initiated: GameEvent = {
      type: "triggerEvent",
      phase: "initiated",
      event: {
        kind: "enemyAttack",
        enemyInstanceId: villain,
        attackedPlayerId: p2,
        targetPlayerId: p2,
        targetInstanceId: identity1,
      },
    };
    const out = lines([
      { type: "enemyActivated", enemyInstanceId: villain, activation: "attack", playerId: p1 },
      {
        type: "triggerEvent",
        phase: "initiated",
        event: { ...(initiated as { event: object }).event, attackedPlayerId: p1, targetPlayerId: p1 },
      } as GameEvent,
      initiated,
    ]);
    expect(out.filter((l) => / attacks /.test(l))).toHaveLength(2);
    expect(out.some((l) => /again/.test(l))).toBe(false);
  });
});
