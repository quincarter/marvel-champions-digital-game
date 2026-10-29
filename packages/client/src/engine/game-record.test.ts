/**
 * The game record, folded from a real Core game's events. Real games rather
 * than crafted event lists, so attribution is checked against the sources the
 * engine actually names.
 */

import { describe, expect, test } from "vitest";
import {
  activeVillain,
  printedResources,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type ResourcePool,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "./local-host.js";
import type { SessionConfig } from "./host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** Starts a game with a record folded from every update, the way the host will fold it. */
async function recordedGame(config: SessionConfig) {
  const host = new LocalEngineHost();
  let record: GameRecord = emptyRecord();
  let state: GameState | null = null;
  host.subscribe((update) => {
    record = recordEvents(record, update.events, update.state);
    state = update.state;
  });
  await host.start(config);
  return {
    host,
    record: () => record,
    state: () => state!,
  };
}

describe("game record", () => {
  test("a passive table's loss is recorded to the round, with the last threat that ended it", async () => {
    const game = await recordedGame(RHINO_SOLO);
    for (let step = 0; step < 1500 && !game.state().outcome; step++) {
      const choice = game.state().pendingChoice;
      if (choice) {
        await game.host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
        });
        continue;
      }
      const legal = await game.host.legalActions(game.state().players[0]!.playerId);
      if (legal.kind !== "turn") break;
      const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await game.host.dispatch(end.example);
    }

    const state = game.state();
    const record = game.record();
    expect(state.outcome).not.toBeNull();
    expect(record.round).toBe(state.round);
    expect(record.seats).toHaveLength(1);
    expect(record.threatPlaced).toBeGreaterThan(0);
    if (state.outcome!.reason === "mainSchemeCompleted") {
      expect(record.lastThreat).not.toBeNull();
      expect(record.lastThreat!.round).toBe(state.round);
    }
    // Rounds come back in order and never repeat.
    const rounds = record.rounds.map((entry) => entry.round);
    expect(rounds).toEqual([...new Set(rounds)].sort((a, b) => a - b));
  }, 120_000);

  test("a hero's basic attack on the villain counts toward that hero's seat", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const settle = async () => {
      for (let step = 0; step < 10; step++) {
        const choice = game.state().pendingChoice;
        if (!choice) return;
        await game.host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
        });
      }
    };
    await settle();
    const me = game.state().players[0]!.playerId;
    const actions = async () => {
      const legal = await game.host.legalActions(me);
      return legal.kind === "turn" ? legal.legal : [];
    };
    const flip = (await actions()).find((entry) => entry.action.kind === "changeForm");
    await game.host.dispatch(flip!.example);
    await settle();
    const attack = (await actions()).find((entry) => entry.action.kind === "basicAttack");
    expect(attack).toBeDefined();
    await game.host.dispatch(attack!.example);
    await settle();

    const record = game.record();
    const seat = record.seats.find((entry) => entry.playerId === me)!;
    expect(record.damageToVillain).toBeGreaterThan(0);
    expect(seat.damage).toBe(record.damageToEnemies);
    expect(record.lastVillainDamage).not.toBeNull();
  }, 60_000);
});

describe("game record: Overkill counts where the excess lands", () => {
  test("the spill comes back off the first target instead of counting twice", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const hero = state.players[0]!.identity.instanceId;
    const villain = activeVillain(state).instanceId;
    // A 5-damage hit on the villain whose last 2 spill over, and land on the hero as a stand-in for another enemy.
    const hit: GameEvent = { type: "damageDealt", targetInstanceId: villain, amount: 5, sourceInstanceId: hero };
    const spill: GameEvent = { type: "overkillSpilled", fromInstanceId: villain, toInstanceId: hero, amount: 2 };
    const record = recordEvents(emptyRecord(), [hit, spill], state);
    expect(record.damageToEnemies).toBe(3);
    expect(record.damageToVillain).toBe(3);
    expect(record.seats.find((seat) => seat.playerId === state.players[0]!.playerId)?.damage).toBe(3);
  });

  test("a hit with no spill still counts the full amount taken", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const hero = state.players[0]!.identity.instanceId;
    const hit: GameEvent = {
      type: "damageDealt",
      targetInstanceId: activeVillain(state).instanceId,
      amount: 2,
      sourceInstanceId: hero,
    };
    expect(recordEvents(emptyRecord(), [hit], state).damageToEnemies).toBe(2);
  });
});

describe("game record: main scheme swaps (issue #518)", () => {
  test("a swap is kept with the scheme it replaced and its round", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const scheme = state.mainScheme.instanceId;
    const swap: GameEvent = {
      type: "mainSchemeSwapped",
      outgoing: "old" as typeof scheme,
      incoming: scheme,
      cardIds: [state.mainScheme.cardId, state.mainScheme.cardId],
      playArea: null,
      threat: 3,
    };
    const record = recordEvents({ ...emptyRecord(), round: 3 }, [swap], state);
    expect(record.schemeSwaps).toEqual([
      { outgoing: "old", incoming: scheme, outgoingCardId: state.mainScheme.cardId, round: 3 },
    ]);
    expect(recordEvents(emptyRecord(), [], state).schemeSwaps).toBeUndefined();
  });
});

describe("game record: what each seat did with its cards", () => {
  test("a card played from hand is counted by its card id", async () => {
    const game = await recordedGame(RHINO_SOLO);
    for (let step = 0; step < 10 && game.state().pendingChoice; step++) {
      const choice = game.state().pendingChoice!;
      await game.host.dispatch({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
    }
    const me = game.state().players[0]!.playerId;
    const legal = await game.host.legalActions(me);
    const play = legal.kind === "turn" ? legal.legal.find((entry) => entry.action.kind === "playCard") : undefined;
    expect(play).toBeDefined();
    const instanceId = (play!.action as { readonly instanceId: string }).instanceId;
    const cardId = game.state().instances[instanceId]!.cardId;
    await game.host.dispatch(play!.example);
    const seat = game.record().seats.find((entry) => entry.playerId === me)!;
    expect(seat.plays?.[cardId]).toBe(1);
  }, 60_000);

  test("abilities count on the seat's own cards, not on encounter cards or played events", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const player = state.players[0]!;
    const hero = player.identity.instanceId;
    const event = player.deck.find((id) => state.cardPool[state.instances[id]!.cardId]?.type === "event");
    const villain = activeVillain(state).instanceId;
    const resolved = (instanceId: string): GameEvent => ({
      type: "abilityResolved",
      instanceId: instanceId as typeof hero,
      abilityId: "x" as never,
      controllerId: player.playerId,
    });
    const record = recordEvents(
      emptyRecord(),
      [resolved(hero), resolved(hero), resolved(villain), ...(event ? [resolved(event)] : [])],
      state,
    );
    expect(record.seats[0]!.activations).toEqual({ [state.instances[hero]!.cardId]: 2 });
  });

  test("with the ability registry, only abilities the player chose count, and a granted one counts for its granter", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const player = state.players[0]!;
    const hero = player.identity.instanceId;
    const support = player.deck.find((id) => state.cardPool[state.instances[id]!.cardId]?.type === "support")!;
    const deps = {
      abilities: {
        act: { trigger: { kind: "action" } },
        res: { trigger: { kind: "resource" } },
        choose: { trigger: { kind: "response" } },
        forced: { trigger: { kind: "interrupt", forced: true } },
        setup: { trigger: { kind: "setup" } },
      },
    } as unknown as EngineDeps;
    const resolved = (abilityId: string, extra: Partial<GameEvent> = {}): GameEvent =>
      ({ type: "abilityResolved", instanceId: hero, abilityId, controllerId: player.playerId, ...extra }) as GameEvent;
    const record = recordEvents(
      emptyRecord(),
      [
        resolved("act"),
        resolved("res"),
        resolved("choose"),
        resolved("forced"),
        resolved("setup"),
        resolved("keyword:temporary"),
        resolved("act", { grantedByInstanceId: support } as Partial<GameEvent>),
      ],
      state,
      deps,
    );
    expect(record.seats[0]!.activations).toEqual({
      [state.instances[hero]!.cardId]: 3,
      [state.instances[support]!.cardId]: 1,
    });
  });

  test("the seat's deck is kept as it stood when the record began", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const player = game.state().players[0]!;
    const deck = game.record().seats[0]!.deck!;
    const inDeck = [...player.deck, ...player.hand].map((id) => game.state().instances[id]!.cardId);
    expect(new Set(deck)).toEqual(new Set(inDeck));
  });

  test("side schemes in play and defeated are counted by card; a scheme put into play counts too", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const side = Object.values(state.cardPool).find((card) => card.type === "side_scheme")!;
    const minion = Object.values(state.cardPool).find((card) => card.type === "minion")!;
    const me = state.players[0]!.playerId;
    const record = recordEvents(
      emptyRecord(),
      [
        { type: "encounterCardRevealed", instanceId: "a" as never, cardId: side.id, playerId: me },
        { type: "encounterCardRevealed", instanceId: "b" as never, cardId: minion.id, playerId: me },
        { type: "schemeDefeated", instanceId: "a" as never, cardId: side.id },
        {
          type: "cardMoved",
          instanceId: "c" as never,
          cardId: side.id,
          from: { kind: "encounterSetAside" },
          to: { kind: "villainArea" },
        },
      ],
      state,
    );
    expect(record.sideSchemesSeen).toEqual({ [side.id]: 2 });
    expect(record.sideSchemesDefeated).toEqual({ [side.id]: 1 });
    expect(record.sideSchemesInPlay).toEqual({ c: side.id });
    expect(recordEvents(emptyRecord(), [], state).sideSchemesSeen).toBeUndefined();
  });
});

describe("game record: a side scheme that comes back (Codex review on #530)", () => {
  test("revealed, defeated, shuffled back and revealed again: two appearances, one defeat", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const side = Object.values(state.cardPool).find((card) => card.type === "side_scheme")!;
    const me = state.players[0]!.playerId;
    const reveal: GameEvent = {
      type: "encounterCardRevealed",
      instanceId: "s" as never,
      cardId: side.id,
      playerId: me,
    };
    const enter: GameEvent = {
      type: "cardMoved",
      instanceId: "s" as never,
      cardId: side.id,
      from: { kind: "encounterDeck", deckId: "main" as never },
      to: { kind: "villainArea" },
    };
    const defeat: GameEvent = { type: "schemeDefeated", instanceId: "s" as never, cardId: side.id };
    const toDeck: GameEvent = {
      type: "cardMoved",
      instanceId: "s" as never,
      cardId: side.id,
      from: { kind: "encounterDiscard", deckId: "main" as never },
      to: { kind: "encounterDeck", deckId: "main" as never },
    };
    // One appearance reported twice (the reveal, then its move into play) still counts once.
    const record = recordEvents(emptyRecord(), [reveal, enter, defeat, toDeck, reveal, enter], state);
    expect(record.sideSchemesSeen).toEqual({ [side.id]: 2 });
    expect(record.sideSchemesDefeated).toEqual({ [side.id]: 1 });
  });
});

describe("game record: the stats screen's per-seat numbers (#529)", () => {
  async function table() {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const player = state.players[0]!;
    const typed = (type: string, owned: boolean) =>
      Object.values(state.instances).find(
        (instance) => state.cardPool[instance.cardId]?.type === type && (instance.ownerId !== null) === owned,
      )!;
    return {
      state,
      me: player.playerId,
      hero: player.identity.instanceId,
      villain: activeVillain(state).instanceId,
      ally: typed("ally", true),
      minion: typed("minion", false),
      support: typed("support", true),
    };
  }
  const hit = (target: string, amount: number, source: string | null): GameEvent => ({
    type: "damageDealt",
    targetInstanceId: target as never,
    amount,
    sourceInstanceId: source as never,
  });

  test("cards drawn are counted per seat", async () => {
    const { state, me } = await table();
    const drawn: GameEvent = { type: "cardDrawn", playerId: me, instanceId: "x" as never };
    expect(recordEvents(emptyRecord(), [drawn, drawn], state).seats[0]!.drawn).toBe(2);
  });

  test("resources by type, and the cards paid with: a card spent from hand and a resource ability in play", async () => {
    const { state, me, support } = await table();
    const handCard = state.players[0]!.hand[0]!;
    const handCardId = state.instances[handCard]!.cardId;
    const generated: GameEvent = {
      type: "resourcesGenerated",
      playerId: me,
      instanceId: support.instanceId,
      abilityId: "res" as never,
      amount: 1,
      pool: { physical: 0, mental: 1, energy: 0, wild: 0 },
    };
    const command = {
      type: "playCard",
      playerId: me,
      instanceId: "played",
      payment: [{ fromHand: handCard }, { ability: { instanceId: support.instanceId, abilityId: "res" } }],
    } as unknown as Command;
    const seat = recordEvents(emptyRecord(), [generated], state, undefined, command).seats[0]!;
    expect(seat.paidWith).toEqual({ [handCardId]: 1, [support.cardId]: 1 });
    expect(seat.discardedToPay).toBe(1);
    const printed = printedResources(state.cardPool[handCardId]!);
    expect(seat.resources).toEqual({ ...printed, mental: printed.mental + 1 });
  });

  test("a seat's best turn is its own turn's damage and thwart, not another phase's", async () => {
    const { state, me, hero, villain } = await table();
    const removed = (amount: number): GameEvent => ({
      type: "threatRemoved",
      schemeInstanceId: state.mainScheme.instanceId,
      amount,
      sourceInstanceId: hero,
    });
    const record = recordEvents(
      emptyRecord(),
      [
        { type: "turnStarted", playerId: me },
        hit(villain, 3, hero),
        removed(1),
        { type: "turnEnded", playerId: me },
        // The villain phase: the hero's damage is the seat's (a retaliate), but no turn's.
        hit(villain, 5, hero),
        { type: "turnStarted", playerId: me },
        hit(villain, 1, hero),
        removed(2),
      ],
      state,
    );
    // The second turn is still going: it counts once it ends, or once the game ends during it.
    expect(record.seats[0]!.bestTurn).toEqual({ damage: 3, thwart: 1 });
    expect(record.turn).toEqual({ playerId: me, damage: 1, thwart: 2 });
    expect(record.seats[0]!.damage).toBe(9);
    const won = { ...state, outcome: { result: "win", reason: "villainDefeated" } } as GameState;
    expect(recordEvents(record, [], won).seats[0]!.bestTurn).toEqual({ damage: 3, thwart: 2 });
  });

  test("an Overkill spill dealt in a later command (after a defeat's interrupt window) still counts once", async () => {
    const { state, me, ally, minion, villain } = await table();
    const hitCommand = recordEvents(
      emptyRecord(),
      [{ type: "turnStarted", playerId: me }, hit(minion.instanceId, 5, ally.instanceId)],
      state,
    );
    const spilled = recordEvents(
      hitCommand,
      [
        { type: "overkillSpilled", fromInstanceId: minion.instanceId, toInstanceId: villain, amount: 2 },
        // Toughness on the villain stopped the spilled damage: nothing lands.
        { type: "turnEnded", playerId: me },
      ],
      state,
    );
    expect(spilled.seats[0]!.allyDamage).toEqual({ [ally.cardId]: 3 });
    expect(spilled.seats[0]!.damage).toBe(3);
    expect(spilled.seats[0]!.bestTurn).toEqual({ damage: 3, thwart: 0 });
    expect(spilled.damageToEnemies).toBe(3);
    expect(spilled.lastHits).toBeUndefined();
  });

  test("an enemy's Overkill through a defending ally counts on the identity, once, across commands", async () => {
    const { state, ally, villain, hero } = await table();
    const villainCardId = state.instances[villain]!.cardId;
    const first = recordEvents(emptyRecord(), [hit(ally.instanceId, 6, villain)], state);
    const record = recordEvents(
      first,
      [
        { type: "overkillSpilled", fromInstanceId: ally.instanceId, toInstanceId: hero, amount: 4 },
        hit(hero, 4, villain),
      ],
      state,
    );
    expect(record.hurtBy).toEqual({ [villainCardId]: 6 });
  });

  test("a hit names its source's card as it was then, though the card flips later in the command", async () => {
    const { state, hero, villain } = await table();
    const villainCardId = state.instances[villain]!.cardId;
    const record = recordEvents(
      emptyRecord(),
      [
        hit(hero, 2, villain),
        hit(villain, 1, hero),
        {
          type: "cardFlippedToOtherFace",
          instanceId: villain,
          from: "other-face" as never,
          to: villainCardId,
          typeChanged: false,
        },
        hit(hero, 1, villain),
      ],
      state,
    );
    expect(record.hurtBy).toEqual({ "other-face": 2, [villainCardId]: 1 });
    expect(record.lastVillainDamage?.sourceCardId).toBe(state.instances[hero]!.cardId);
  });

  test("a counter spent as if it were a resource pays, but adds no resources", async () => {
    const { state, me, support } = await table();
    const deps = {
      abilities: { asIf: { trigger: { kind: "resource", spentAsIfResource: true } } },
    } as unknown as EngineDeps;
    const spent: GameEvent = {
      type: "resourcesGenerated",
      playerId: me,
      instanceId: support.instanceId,
      abilityId: "asIf" as never,
      amount: 1,
      pool: { physical: 1, mental: 0, energy: 0, wild: 0 },
    };
    const seat = recordEvents(emptyRecord(), [spent], state, deps).seats[0]!;
    expect(seat.paidWith).toEqual({ [support.cardId]: 1 });
    expect(seat.resources).toBeUndefined();
  });

  test("an ally's damage to enemies is its own, and an Overkill excess counts where it lands", async () => {
    const { state, ally, minion, villain } = await table();
    const record = recordEvents(
      emptyRecord(),
      [
        hit(minion.instanceId, 5, ally.instanceId),
        { type: "overkillSpilled", fromInstanceId: minion.instanceId, toInstanceId: villain, amount: 2 },
        hit(villain, 2, ally.instanceId),
      ],
      state,
    );
    expect(record.seats[0]!.allyDamage).toEqual({ [ally.cardId]: 5 });
    expect(record.damageToEnemies).toBe(5);
  });

  test("an ally's defenses count, and so does its defeat by the attack it defended, but not a later one", async () => {
    const { state, me, ally, villain } = await table();
    const declared: GameEvent = {
      type: "defenderDeclared",
      attackInstanceId: villain,
      defenderInstanceId: ally.instanceId,
      playerId: me,
    };
    const resolved: GameEvent = {
      type: "attackResolved",
      enemyInstanceId: villain,
      targetInstanceId: ally.instanceId,
      baseAtk: 3,
      boostIcons: 0,
      defenseReduction: 0,
      damageDealt: 3,
    };
    const defeated: GameEvent = { type: "characterDefeated", instanceId: ally.instanceId, cardId: ally.cardId };
    const activated: GameEvent = {
      type: "enemyActivated",
      enemyInstanceId: villain,
      activation: "attack",
      playerId: me,
    };
    // Defended, hit by the attack and defeated by it.
    const died = recordEvents(emptyRecord(), [declared, resolved, hit(ally.instanceId, 3, villain), defeated], state);
    expect(died.seats[0]!.allyBlocks).toEqual({ [ally.cardId]: 1 });
    expect(died.seats[0]!.allyDiedBlocking).toEqual({ [ally.cardId]: 1 });
    expect(died.allyDefending).toBeUndefined();
    // Defended across commands (a choice between), survived, then defeated after the next attack began.
    const first = recordEvents(emptyRecord(), [declared], state);
    expect(first.allyDefending?.[villain]).toBeDefined();
    const survived = recordEvents(first, [resolved, hit(ally.instanceId, 1, villain), activated, defeated], state);
    expect(survived.seats[0]!.allyBlocks).toEqual({ [ally.cardId]: 1 });
    expect(survived.seats[0]!.allyDiedBlocking).toBeUndefined();
    // An attack that never resolved (canceled) is over once an encounter card is revealed.
    const reveal: GameEvent = {
      type: "encounterCardRevealed",
      instanceId: "e" as never,
      cardId: "x" as never,
      playerId: me,
    };
    const canceled = recordEvents(first, [reveal, defeated], state);
    expect(canceled.allyDefending).toBeUndefined();
    expect(canceled.seats[0]!.allyDiedBlocking).toBeUndefined();
  });
});

describe("game record: the encounter side (#529)", () => {
  test("encounter cards revealed are counted by card id", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const minion = Object.values(state.instances).find(
      (instance) => state.cardPool[instance.cardId]?.type === "minion",
    )!;
    const reveal: GameEvent = {
      type: "encounterCardRevealed",
      instanceId: minion.instanceId,
      cardId: minion.cardId,
      playerId: state.players[0]!.playerId,
    };
    expect(recordEvents(emptyRecord(), [reveal, reveal], state).encounterRevealed).toEqual({ [minion.cardId]: 2 });
  });

  test("damage to the heroes and their allies is counted by the encounter card that dealt it", async () => {
    const game = await recordedGame(RHINO_SOLO);
    const state = game.state();
    const hero = state.players[0]!.identity.instanceId;
    const villain = activeVillain(state);
    const ally = Object.values(state.instances).find((instance) => state.cardPool[instance.cardId]?.type === "ally")!;
    const hurt = (target: string, amount: number, source: string | null): GameEvent => ({
      type: "damageDealt",
      targetInstanceId: target as never,
      amount,
      sourceInstanceId: source as never,
    });
    const record = recordEvents(
      emptyRecord(),
      [
        hurt(hero, 3, villain.instanceId),
        hurt(ally.instanceId, 2, villain.instanceId),
        // A player card (consequential damage) and a hit with no source are no encounter card's.
        hurt(ally.instanceId, 1, ally.instanceId),
        hurt(hero, 1, null),
      ],
      state,
    );
    expect(record.hurtBy).toEqual({ [villain.cardId]: 5 });
  });
});

describe("game record: a hand card's resources, priced as the engine priced them (Codex review on #530)", () => {
  test("The Power of Aggression spent on an Aggression card counts double; without the state before, its icons", async () => {
    const game = await recordedGame({ ...RHINO_SOLO, players: [{ starterDeckId: "core-she-hulk-aggression" }] });
    const state = game.state();
    const player = state.players[0]!;
    const instanceOf = (id: string) => Object.values(state.instances).find((instance) => instance.cardId === id)!;
    // The Power of Aggression (01055) paying for Uppercut (01054), an Aggression card.
    const power = instanceOf("01055").instanceId;
    const uppercut = instanceOf("01054").instanceId;
    const others = (ids: readonly InstanceId[]): InstanceId[] => ids.filter((id) => id !== power && id !== uppercut);
    const before: GameState = {
      ...state,
      players: [{ ...player, hand: [power, uppercut, ...others(player.hand)], deck: others(player.deck) }],
    };
    const command = {
      type: "playCard",
      playerId: player.playerId,
      cardInstanceId: uppercut,
      payment: [{ fromHand: power }],
    } as unknown as Command;
    const printed = printedResources(state.cardPool["01055"]!);
    const total = (pool: ResourcePool | undefined) =>
      pool ? pool.physical + pool.mental + pool.energy + pool.wild : 0;

    const priced = recordEvents(emptyRecord(), [], state, POOL_DEPS, command, before).seats[0]!;
    expect(total(printed)).toBeGreaterThan(0);
    expect(total(priced.resources)).toBe(2 * total(printed));
    // No state before the command (an older caller): the printed icons.
    const fallback = recordEvents(emptyRecord(), [], state, POOL_DEPS, command).seats[0]!;
    expect(fallback.resources).toEqual(printed);
    expect(fallback.paidWith).toEqual(priced.paidWith);
  }, 60_000);
});
