import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { SUMMARY_VERSION, summarizeGame } from "./game-summary.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** Plays a passive table to its loss, folding the record the way the session does. */
async function passiveLoss() {
  const host = new LocalEngineHost();
  let record: GameRecord = emptyRecord();
  let state: GameState | null = null;
  host.subscribe((update) => {
    record = recordEvents(record, update.events, update.state);
    state = update.state;
  });
  await host.start(RHINO_SOLO);
  for (let step = 0; step < 1500 && !state!.outcome; step++) {
    const choice = state!.pendingChoice;
    if (choice) {
      await host.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
      continue;
    }
    const legal = await host.legalActions(state!.players[0]!.playerId);
    if (legal.kind !== "turn") break;
    const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await host.dispatch(end.example);
  }
  return { state: state!, record };
}

describe("summarizeGame", () => {
  test("a game still in play has no summary", async () => {
    const host = new LocalEngineHost();
    let state: GameState | null = null;
    host.subscribe((update) => (state = update.state));
    await host.start(RHINO_SOLO);
    expect(summarizeGame(state!, emptyRecord())).toBeNull();
  });

  test("a real loss names its reason and counts the defeat, with no winners", async () => {
    const { state, record } = await passiveLoss();
    expect(state.outcome?.result).toBe("loss");
    const summary = summarizeGame(state, record)!;
    expect(summary.winners).toEqual([]);
    expect(summary.alliesPlayed).toBe(0);
    expect(summary.lossReason).toBe(
      state.outcome!.reason === "mainSchemeCompleted" ? "schemeCompleted" : "playersDefeated",
    );
    expect(summary.heroesDefeated).toBe(record.seats.filter((seat) => seat.defeatedInRound !== null).length);
  });

  test("a win lists the standing seats with their hit points, and sums allies and defeats", async () => {
    const { state, record } = await passiveLoss();
    const player = state.players[0]!;
    const hero = state.instances[player.identity.instanceId]!;
    const won: GameState = {
      ...state,
      outcome: { result: "win", reason: "villainDefeated" },
      players: [{ ...player, eliminated: false }],
      instances: { ...state.instances, [hero.instanceId]: { ...hero, damage: 0 } },
    };
    const summary = summarizeGame(won, {
      ...record,
      seats: record.seats.map((seat) => ({ ...seat, defeatedInRound: null, alliesPlayed: 2 })),
    })!;
    expect(summary.lossReason).toBeNull();
    expect(summary.heroesDefeated).toBe(0);
    expect(summary.alliesPlayed).toBe(2);
    expect(summary.winners).toHaveLength(1);
    expect(summary.winners[0]!.identityCardId).toBe(player.identity.cardId);
    expect(summary.winners[0]!.hitPoints).toBeGreaterThan(0);
    expect(summary.winners[0]!.inHeroForm).toBe(player.identity.form === "hero");
    expect(summary.finalBlowBy, "no blow on the villain in the record").toBeNull();
  });

  test("a win names the identity whose card dealt the villain its last damage", async () => {
    const { state, record } = await passiveLoss();
    const player = state.players[0]!;
    const won: GameState = { ...state, outcome: { result: "win", reason: "villainDefeated" } };
    const blow = { targetInstanceId: player.identity.instanceId, amount: 3, round: 4 };
    const byHero = { ...record, lastVillainDamage: { ...blow, sourceInstanceId: player.identity.instanceId } };
    expect(summarizeGame(won, byHero)!.finalBlowBy).toBe(player.identity.cardId);
    const byNobody = { ...record, lastVillainDamage: { ...blow, sourceInstanceId: null } };
    expect(summarizeGame(won, byNobody)!.finalBlowBy).toBeNull();
    expect(summarizeGame(state, byHero)!.finalBlowBy, "only a win names one").toBeNull();
  });

  test("a concession is a loss reason of its own", async () => {
    const { state, record } = await passiveLoss();
    const conceded: GameState = {
      ...state,
      outcome: { result: "conceded", reason: "playerConceded", byPlayerId: state.players[0]!.playerId },
    };
    expect(summarizeGame(conceded, record)!.lossReason).toBe("conceded");
  });
});

describe("summarizeGame: what dealt the defeating blow", () => {
  const startedTable = async (): Promise<GameState> => {
    const host = new LocalEngineHost();
    let state: GameState | null = null;
    host.subscribe((update) => (state = update.state));
    await host.start(RHINO_SOLO);
    return state!;
  };

  const lostOf = (table: GameState): GameState => ({
    ...table,
    outcome: { result: "loss", reason: "allPlayersDefeated" },
  });

  /** The hero falls to `blow`, after `before` this command. */
  function fallenTo(
    table: GameState,
    blow: { sourceInstanceId?: InstanceId; fromAttack?: true; sourceRole?: "villain" | "minion" },
    before: GameEvent[] = [],
  ) {
    const lost = lostOf(table);
    const player = lost.players[0]!;
    const identity = player.identity;
    const record = recordEvents(
      emptyRecord(),
      [
        ...before,
        { type: "characterDefeated", instanceId: identity.instanceId, cardId: identity.cardId, ...blow },
        { type: "playerEliminated", playerId: player.playerId },
      ],
      lost,
    );
    return summarizeGame(lost, record)!;
  }

  const villainOf = (table: GameState): InstanceId => table.villains[0]!.instanceId;

  test("the villain's attack, and the card that made it", async () => {
    const table = await startedTable();
    const summary = fallenTo(table, { sourceInstanceId: villainOf(table), fromAttack: true, sourceRole: "villain" });
    expect(summary.defeatedBy).toBe("villainAttack");
    expect(summary.defeatedByCardId).toBe(table.instances[villainOf(table)]!.cardId);
  });

  test("the villain's damage that is no attack is an encounter card's", async () => {
    const table = await startedTable();
    expect(fallenTo(table, { sourceInstanceId: villainOf(table), sourceRole: "villain" }).defeatedBy).toBe(
      "encounterCard",
    );
  });

  test("a minion's attack", async () => {
    const table = await startedTable();
    const minion = Object.values(table.instances).find((i) => table.cardPool[i.cardId]?.type === "minion");
    expect(minion, "Rhino's encounter deck holds minions").toBeDefined();
    const summary = fallenTo(table, { sourceInstanceId: minion!.instanceId, fromAttack: true, sourceRole: "minion" });
    expect(summary.defeatedBy).toBe("minionAttack");
    expect(summary.defeatedByCardId).toBe(minion!.cardId);
  });

  test("a facedown Drone is a minion, and the player's card under it stays unnamed", async () => {
    const table = await startedTable();
    const drone = table.players[0]!.deck[0]!;
    const summary = fallenTo(table, { sourceInstanceId: drone, fromAttack: true, sourceRole: "minion" });
    expect(summary.defeatedBy).toBe("minionAttack");
    expect(summary.defeatedByCardId).toBeNull();
  });

  test("the hero's own card, or no source at all, is neither the villain's nor an encounter card's", async () => {
    const table = await startedTable();
    const own = table.players[0]!.identity.instanceId;
    expect(fallenTo(table, { sourceInstanceId: own }).defeatedBy).toBe("other");
    const unsourced = fallenTo(table, {});
    expect(unsourced.defeatedBy).toBe("other");
    expect(unsourced.defeatedByCardId).toBeNull();
  });

  test("an earlier hit is not the blow: a defeat that names no source stays unattributed", async () => {
    const table = await startedTable();
    const identity = table.players[0]!.identity.instanceId;
    const hit: GameEvent = {
      type: "damageDealt",
      targetInstanceId: identity,
      amount: 3,
      sourceInstanceId: villainOf(table),
    };
    expect(fallenTo(table, {}, [hit]).defeatedBy).toBe("other");
  });

  test("placed damage that ends the hero names what placed it, though it is not counted as hurt", async () => {
    const table = await startedTable();
    const lost = lostOf(table);
    const player = lost.players[0]!;
    const identity = player.identity;
    const record = recordEvents(
      emptyRecord(),
      [
        { type: "damagePlaced", targetInstanceId: identity.instanceId, amount: 2, sourceInstanceId: villainOf(table) },
        { type: "characterDefeated", instanceId: identity.instanceId, cardId: identity.cardId },
        { type: "playerEliminated", playerId: player.playerId },
      ],
      lost,
    );
    expect(record.hurtBy).toBeUndefined();
    expect(summarizeGame(lost, record)!.defeatedBy).toBe("encounterCard");
  });

  test("a passive table's real loss names its blow; a scheme loss and a win name none", async () => {
    const { state, record } = await passiveLoss();
    const summary = summarizeGame(state, record)!;
    if (summary.lossReason === "playersDefeated") expect(summary.defeatedBy).toMatch(/Attack|encounterCard/);
    else expect(summary.defeatedBy).toBeNull();
    const table = await startedTable();
    const scheme: GameState = { ...table, outcome: { result: "loss", reason: "mainSchemeCompleted" } };
    expect(summarizeGame(scheme, emptyRecord())!.defeatedBy).toBeNull();
    const won: GameState = { ...table, outcome: { result: "win", reason: "villainDefeated" } };
    expect(summarizeGame(won, emptyRecord())!.defeatedBy).toBeNull();
  });
});

describe("summarizeGame: what the stats screen reads", () => {
  test("each seat has its hero, its deck without resources double-counted, aspects and counts", async () => {
    const { state, record } = await passiveLoss();
    const summary = summarizeGame(state, record)!;
    const seat = summary.seats![0]!;
    expect(seat.identityCardId).toBe(state.players[0]!.identity.cardId);
    expect(seat.deck.length).toBeGreaterThan(5);
    expect(new Set(seat.deck).size).toBe(seat.deck.length);
    expect(seat.deck).not.toContain(seat.identityCardId);
    // Spider-Man's Justice starter deck.
    expect(seat.aspects).toEqual(["justice"]);
    expect(summary.villains).toEqual(["Rhino"]);
    expect(summary.sideSchemes).toBeDefined();
  }, 120_000);
});

describe("summarizeGame: version 2 numbers (#529)", () => {
  test("a real game's summary carries draws, the encounter cards revealed and what hurt the hero", async () => {
    const { state, record } = await passiveLoss();
    const summary = summarizeGame(state, record)!;
    expect(summary.version).toBe(SUMMARY_VERSION);
    const seat = summary.seats![0]!;
    // Every hero phase ends with drawing back up to the hand size.
    expect(seat.drawn).toBeGreaterThan(0);
    expect(seat.drawn).toBe(record.seats[0]!.drawn);
    expect(seat.bestTurn).toEqual(record.seats[0]!.bestTurn ?? { damage: 0, thwart: 0 });
    expect(seat.allyBlocks).toEqual(record.seats[0]!.allyBlocks ?? {});
    expect(Object.values(summary.encounterRevealed!).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0);
    expect(summary.hurtBy).toEqual(record.hurtBy ?? {});
    expect(summary.finalBlowCardId, "only a win names one").toBeNull();
  }, 120_000);

  test("a win names the card that dealt the villain its last damage", async () => {
    const { state, record } = await passiveLoss();
    const player = state.players[0]!;
    const won: GameState = { ...state, outcome: { result: "win", reason: "villainDefeated" } };
    const blow = { targetInstanceId: player.identity.instanceId, amount: 3, round: 4 };
    const byHero = { ...record, lastVillainDamage: { ...blow, sourceInstanceId: player.identity.instanceId } };
    expect(summarizeGame(won, byHero)!.finalBlowCardId).toBe(player.identity.cardId);
    const byNobody = { ...record, lastVillainDamage: { ...blow, sourceInstanceId: null } };
    expect(summarizeGame(won, byNobody)!.finalBlowCardId).toBeNull();
  }, 120_000);
});
