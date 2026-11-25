import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId, ZoneId } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { initActor, type RecordFoldContext } from "./record-actor.js";
import { TOGETHER_COUNTERS, togetherFold, type TogetherFoldState } from "./record-together.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;
const id = (value: string) => value as InstanceId;

/** Cards by instance: [cardId, type, owner, controller]. Each instance's card id is its instance id. */
const CARDS: Record<string, [string, PlayerId | null, PlayerId | null]> = {
  h1: ["hero", P1, P1],
  h2: ["hero", P2, P2],
  ally1: ["ally", P1, P1],
  ally2: ["ally", P2, P2],
  upg1: ["upgrade", P1, P2],
  ev1: ["event", P1, P1],
  ev2: ["event", P2, P2],
  minion: ["minion", null, null],
  minion2: ["minion", null, null],
  treach: ["treachery", null, null],
  side: ["side_scheme", null, null],
  main: ["main_scheme", null, null],
  villain: ["villain", null, null],
  p2card: ["event", P2, P1],
};

/** A state just big enough for the fold's reads: two players, their identities, the cards above. */
function fakeState(): GameState {
  const instances = Object.fromEntries(
    Object.entries(CARDS).map(([key, [, ownerId, controllerId]]) => [
      key,
      { instanceId: key, cardId: key, ownerId, controllerId, home: { kind: "deck" }, damage: 0 },
    ]),
  );
  const cardPool = Object.fromEntries(Object.entries(CARDS).map(([key, [type]]) => [key, { type }]));
  return {
    players: [
      { playerId: P1, identity: { instanceId: "h1" } },
      { playerId: P2, identity: { instanceId: "h2" } },
    ],
    instances,
    cardPool,
  } as unknown as GameState;
}

type Step = GameEvent | [GameEvent, PlayerId | null];

/** Folds the events, each with the acting player given beside it (null when not). */
function fold(steps: readonly Step[], from: TogetherFoldState = togetherFold.init()): TogetherFoldState {
  const state = fakeState();
  let together = from;
  for (const entry of steps) {
    const [event, actor] = Array.isArray(entry) ? entry : [entry, null];
    const ctx: RecordFoldContext = {
      actor,
      actorBefore: actor,
      tracker: initActor(),
      state,
      round: 1,
      cardIdAt: (instance) => instance,
    };
    together = togetherFold.step(together, event, ctx);
  }
  return together;
}

const counts = (steps: readonly Step[]) => togetherFold.finish(fold(steps));

const ev = (event: Record<string, unknown>) => event as unknown as GameEvent;
const moved = (instanceId: string, from: ZoneId, to: ZoneId) =>
  ev({ type: "cardMoved", instanceId, cardId: instanceId, from, to });
const attack = (enemy: string, playerId: PlayerId) =>
  ev({ type: "enemyActivated", enemyInstanceId: enemy, activation: "attack", playerId });
const played = (instanceId: string, playerId: PlayerId) =>
  ev({ type: "cardPlayed", playerId, instanceId, cardId: instanceId, resourcesPaid: 1, paid: {} });
const encounterDeck: ZoneId = { kind: "encounterDeck", deckId: "main" } as ZoneId;

describe("together counters", () => {
  test("a defense for another player counts for the defender's seat, one for yourself does not", () => {
    const result = counts([
      attack("minion", P2),
      ev({ type: "defenderDeclared", attackInstanceId: "minion", defenderInstanceId: "ally1", playerId: P2 }),
      ev({ type: "attackResolved", enemyInstanceId: "minion" }),
      attack("minion", P1),
      ev({ type: "defenderDeclared", attackInstanceId: "minion", defenderInstanceId: "h1", playerId: P1 }),
      // Retargeted onto P1 before P2's ally defends: P2 defends for P1.
      attack("villain", P2),
      ev({ type: "attackRetargeted", enemyInstanceId: "villain", targetInstanceId: "h1", playerId: P1 }),
      ev({ type: "defenderDeclared", attackInstanceId: "villain", defenderInstanceId: "ally2", playerId: P1 }),
    ]);
    expect(result[P1]?.defendedForOthers).toBe(1);
    expect(result[P2]?.defendedForOthers).toBe(1);
  });

  test("healing another identity counts the healed amount for the source's seat, else the actor's", () => {
    const result = counts([
      ev({ type: "damageHealed", targetInstanceId: "h2", amount: 3, sourceInstanceId: "ally1" }),
      [ev({ type: "damageHealed", targetInstanceId: "h1", amount: 2 }), P2],
      // Healing yourself, or an ally of another player, is not counted.
      ev({ type: "damageHealed", targetInstanceId: "h1", amount: 4, sourceInstanceId: "h1" }),
      ev({ type: "damageHealed", targetInstanceId: "ally2", amount: 1, sourceInstanceId: "ally1" }),
    ]);
    expect(result[P1]?.healedOthers).toBe(3);
    expect(result[P2]?.healedOthers).toBe(2);
  });

  test("an upgrade played onto another player's card is given; one kept is not", () => {
    const result = counts([
      played("upg1", P1),
      ev({ type: "controllerChanged", instanceId: "upg1", from: P1, to: P2, reason: "attachedTo" }),
      played("upg1", P1),
      ev({ type: "controllerChanged", instanceId: "upg1", from: P2, to: P1, reason: "attachedTo" }),
    ]);
    expect(result[P1]?.upgradesGiven).toBe(1);
  });

  test("a card paid for by two players counts for each payer; one player's payment does not", () => {
    const spent = (spenderId: PlayerId) => ({ instanceId: "x", cardId: "x", spenderId, resources: {} });
    const result = counts([
      ev({ type: "resourcesGenerated", playerId: P2, instanceId: "x", abilityId: "r", amount: 1, pool: {} }),
      ev({ type: "paymentCommitted", playerId: P1, payingForInstanceId: "ally1", fromHand: [spent(P1)] }),
      played("ally1", P1),
      ev({ type: "paymentCommitted", playerId: P1, payingForInstanceId: "ev1", fromHand: [spent(P1), spent(P1)] }),
      played("ev1", P1),
    ]);
    expect(result[P1]?.multiPayerPlays).toBe(1);
    expect(result[P2]?.multiPayerPlays).toBe(1);
  });

  test("a minion engaged with another player defeated by your lethal hit is a kill steal", () => {
    const result = counts([
      moved("minion", encounterDeck, { kind: "playArea", playerId: P2 }),
      ev({ type: "damageDealt", targetInstanceId: "minion", amount: 3, sourceInstanceId: "h1", excess: 1 }),
      ev({ type: "characterDefeated", instanceId: "minion", cardId: "minion" }),
      // Engaged with P1 and beaten by P1's own hit: not a steal.
      moved("minion2", encounterDeck, { kind: "playArea", playerId: P1 }),
      ev({ type: "damageDealt", targetInstanceId: "minion2", amount: 3, sourceInstanceId: "h1", excess: 0 }),
      moved("minion2", { kind: "playArea", playerId: P1 }, { kind: "encounterDiscard", deckId: "main" } as ZoneId),
      ev({ type: "characterDefeated", instanceId: "minion2", cardId: "minion2" }),
    ]);
    expect(result[P1]?.killSteals).toBe(1);
  });

  test("a kill steal without a lethal hit on record is the acting seat's; the villain's hit is nobody's", () => {
    const result = counts([
      moved("minion", encounterDeck, { kind: "playArea", playerId: P1 }),
      [ev({ type: "characterDefeated", instanceId: "minion", cardId: "minion" }), P2],
      moved("minion2", encounterDeck, { kind: "playArea", playerId: P1 }),
      ev({ type: "damageDealt", targetInstanceId: "minion2", amount: 2, sourceInstanceId: "villain", excess: 0 }),
      [ev({ type: "characterDefeated", instanceId: "minion2", cardId: "minion2" }), P2],
    ]);
    expect(result[P2]?.killSteals).toBe(1);
  });

  test("cards another player draws while you act count; their own draws, setup and refills do not", () => {
    const drawn = (playerId: PlayerId) => ev({ type: "cardDrawn", playerId, instanceId: "x" });
    const result = counts([
      [drawn(P2), P1],
      [drawn(P2), P1],
      [drawn(P1), P1],
      drawn(P2),
      ev({ type: "stepChanged", from: {}, to: { phase: "player", kind: "endPhaseDraw" } }),
      [drawn(P2), P1],
      ev({ type: "stepChanged", from: {}, to: { phase: "villain", kind: "villainActivation" } }),
      [drawn(P2), P1],
    ]);
    expect(result[P1]?.drewForOthers).toBe(3);
  });

  test("cancelling a treachery revealed for another player counts for the canceller", () => {
    const result = counts([
      ev({ type: "encounterCardRevealed", instanceId: "treach", cardId: "treach", playerId: P2 }),
      [ev({ type: "revealCancelled", instanceId: "treach", scope: "whenRevealed" }), P1],
      ev({ type: "encounterCardRevealed", instanceId: "treach", cardId: "treach", playerId: P1 }),
      [ev({ type: "revealCancelled", instanceId: "treach", scope: "allEffects" }), P1],
      // Not a treachery.
      ev({ type: "encounterCardRevealed", instanceId: "minion", cardId: "minion", playerId: P2 }),
      [ev({ type: "revealCancelled", instanceId: "minion", scope: "whenRevealed" }), P1],
    ]);
    expect(result[P1]?.cancelledForOthers).toBe(1);
  });

  test("a card taken from another player's discard counts for the taker, unless its owner gave it", () => {
    const result = counts([
      [moved("p2card", { kind: "discard", playerId: P2 }, { kind: "hand", playerId: P1 }), P1],
      [moved("p2card", { kind: "deck", playerId: P2 }, { kind: "attachment", hostInstanceId: id("h1") }), P1],
      [moved("p2card", { kind: "discard", playerId: P2 }, { kind: "hand", playerId: P1 }), P2],
      [moved("p2card", { kind: "deck", playerId: P2 }, { kind: "hand", playerId: P2 }), P1],
    ]);
    expect(result[P1]?.takenFromOthers).toBe(2);
  });

  test("oops: a minion brought in on another player by your thwart that attacks them before your next turn", () => {
    const thwart = ev({ type: "threatRemoved", schemeInstanceId: "side", amount: 2, sourceInstanceId: "h1" });
    const result = counts([
      thwart,
      ev({ type: "schemeDefeated", instanceId: "side", cardId: "side" }),
      moved("minion", encounterDeck, { kind: "playArea", playerId: P2 }),
      ev({ type: "turnStarted", playerId: P2 }),
      attack("minion", P2),
      // The arm ends with a new player action: this minion is nobody's oops.
      thwart,
      played("ev2", P2),
      moved("minion2", encounterDeck, { kind: "playArea", playerId: P2 }),
      attack("minion2", P2),
    ]);
    expect(result[P1]?.oopsMinions).toBe(1);
  });

  test("oops: the candidate lapses when the arming seat's next turn starts", () => {
    const result = counts([
      ev({ type: "threatRemoved", schemeInstanceId: "main", amount: 1, sourceInstanceId: "h1" }),
      moved("minion", encounterDeck, { kind: "playArea", playerId: P2 }),
      ev({ type: "turnStarted", playerId: P1 }),
      attack("minion", P2),
    ]);
    expect(result[P1]).toBeUndefined();
  });

  test("friendly fire: your side scheme defeat damaging another hero at 6 or fewer hit points", () => {
    const hit = (target: string, amount: number, excess?: number) =>
      ev({ type: "damageDealt", targetInstanceId: target, amount, sourceInstanceId: "side", excess });
    const result = counts([
      ev({ type: "threatRemoved", schemeInstanceId: "side", amount: 3, sourceInstanceId: "ally1" }),
      ev({ type: "schemeDefeated", instanceId: "side", cardId: "side" }),
      hit("h2", 2, 0),
      hit("h2", 2, 0),
      // Your own hero is not friendly fire.
      hit("h1", 7, 1),
    ]);
    expect(result[P1]?.friendlyFire).toBe(1);
    // Remaining before the hit: 9 - 2 = 7, above the line.
    const above = [[ev({ type: "schemeDefeated", instanceId: "side", cardId: "side" }), P1], hit("h2", 9, 2)] as Step[];
    expect(counts(above)).toEqual({});
  });

  test("the fold state is plain data, and a scaffold's empty state reads as a fresh fold", () => {
    const state = fold([attack("minion", P2), [ev({ type: "cardDrawn", playerId: P2, instanceId: "x" }), P1]]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const fromScaffold = fold(
      [[ev({ type: "cardDrawn", playerId: P2, instanceId: "x" }), P1]],
      {} as TogetherFoldState,
    );
    expect(togetherFold.finish(fromScaffold)[P1]?.drewForOthers).toBe(1);
  });

  test("in a real two-player game the counters stay consistent with the log", async () => {
    const host = new LocalEngineHost();
    let record: GameRecord = emptyRecord();
    let state: GameState | null = null;
    const log: GameEvent[] = [];
    host.subscribe((update) => {
      record = recordEvents(record, update.events, update.state);
      state = update.state;
      log.push(...update.events);
    });
    await host.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
      seed: 909,
    });
    let seed = 909;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor(seed / 65536) % n;
    };
    for (let step = 0; step < 600 && !state!.outcome; step++) {
      const choice = state!.pendingChoice;
      if (choice) {
        // A random option (the first ones when more are needed), so defenses and targets vary.
        const start = choice.minSelections <= 1 ? next(choice.options.length) : 0;
        const pick = choice.options
          .slice(start, start + Math.max(choice.minSelections, 1))
          .map((option) => option.optionId);
        await host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.minSelections === 0 && next(2) === 0 ? [] : pick,
        });
        continue;
      }
      const active = state!.step.kind === "turn" ? state!.step.activePlayerId : state!.players[0]!.playerId;
      const legal = await host.legalActions(active);
      if (legal.kind !== "turn") break;
      const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
      const others = legal.legal.filter((entry) => entry.action.kind !== "endTurn");
      const chosen = others.length > 0 && next(4) !== 0 ? others[next(others.length)]! : end;
      if (!chosen) break;
      await host.dispatch(chosen.example);
    }
    expect(log.length).toBeGreaterThan(0);
    const together = record.together!;
    expect(JSON.parse(JSON.stringify(together))).toEqual(together);
    const result = togetherFold.finish(together);
    const seats = new Set(state!.players.map((player) => player.playerId as string));
    const kinds = new Set<string>(TOGETHER_COUNTERS);
    for (const [seat, seatCounts] of Object.entries(result)) {
      expect(seats.has(seat)).toBe(true);
      for (const [key, value] of Object.entries(seatCounts)) {
        expect(kinds.has(key)).toBe(true);
        expect(Number.isInteger(value) && value >= 0).toBe(true);
      }
    }
    // Bounds the log sets: no counter can exceed what it counts.
    const total = (key: (typeof TOGETHER_COUNTERS)[number]) =>
      Object.values(result).reduce((sum, seatCounts) => sum + seatCounts[key], 0);
    const count = (type: GameEvent["type"]) => log.filter((event) => event.type === type).length;
    expect(total("defendedForOthers")).toBeLessThanOrEqual(count("defenderDeclared"));
    expect(total("killSteals")).toBeLessThanOrEqual(count("characterDefeated"));
    expect(total("drewForOthers")).toBeLessThanOrEqual(count("cardDrawn"));
    expect(total("cancelledForOthers")).toBeLessThanOrEqual(count("revealCancelled"));
    expect(total("upgradesGiven")).toBeLessThanOrEqual(count("cardPlayed"));
    expect(total("oopsMinions")).toBeLessThanOrEqual(count("enemyActivated"));
    const healed = log.reduce((sum, event) => sum + (event.type === "damageHealed" ? event.amount : 0), 0);
    expect(total("healedOthers")).toBeLessThanOrEqual(healed);
    // Defenses for another player, read straight off the log: this seed's game has one.
    const attackedBy = new Map<string, string>();
    let crossDefenses = 0;
    for (const event of log) {
      if (event.type === "enemyActivated" && event.activation === "attack") {
        attackedBy.set(event.enemyInstanceId, event.playerId);
      }
      if (event.type === "attackRetargeted") attackedBy.set(event.enemyInstanceId, event.playerId);
      if (event.type === "attackResolved") attackedBy.delete(event.enemyInstanceId);
      if (event.type !== "defenderDeclared") continue;
      const defender = state!.instances[event.defenderInstanceId];
      const identityOf = state!.players.find((player) => player.identity.instanceId === event.defenderInstanceId);
      const seat = identityOf?.playerId ?? defender?.controllerId ?? defender?.ownerId ?? event.playerId;
      const attacked = attackedBy.get(event.attackInstanceId);
      if (attacked && seat !== attacked) crossDefenses++;
    }
    expect(crossDefenses).toBeGreaterThan(0);
    expect(total("defendedForOthers")).toBe(crossDefenses);
    // Every minion still tracked as engaged is a minion, and every open attack is an enemy's.
    for (const minion of Object.keys(together.engaged)) {
      expect(state!.cardPool[state!.instances[minion]!.cardId]?.type).toBe("minion");
    }
  }, 180_000);
});
