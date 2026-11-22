import { beforeAll, describe, expect, test } from "vitest";
import {
  groupId,
  minionsEngagedWith,
  type GameEvent,
  type GameState,
  type InstanceId,
  type LastingEffect,
  type PodState,
} from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { summarizeGame } from "./game-summary.js";
import { endStateOf } from "./summary-end-state.js";

const TWO_SEATS = {
  scenarioId: "rhino",
  difficulty: "standard" as const,
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
  seed: 909,
};

let start: GameState;
let minionCard: string;
let sideSchemeCard: string;
let supportCard: string;
const MINION = "m1" as InstanceId;
const SCHEME = "s1" as InstanceId;
const SUPPORT = "u1" as InstanceId;
const PLAIN_SUPPORT = "u2" as InstanceId;
const USES_CARD = "test-uses-support";

beforeAll(async () => {
  const host = new LocalEngineHost();
  let state: GameState | null = null;
  host.subscribe((update) => (state = update.state));
  await host.start(TWO_SEATS);
  start = state! as GameState;
  const pool = Object.values(start.cardPool);
  minionCard = pool.find((card) => card.type === "minion")!.id;
  sideSchemeCard = pool.find((card) => card.type === "side_scheme")!.id;
  supportCard = pool.find((card) => card.type === "support")!.id;
}, 60_000);

const won = (state: GameState): GameState => ({ ...state, outcome: { result: "win", reason: "villainDefeated" } });

/** `start` with instances added (copies of a hand card's instance) and placed by `place`. */
function withCards(
  cards: readonly { id: InstanceId; cardId: string; owner: "p1" | null; counters?: Record<string, number> }[],
  place: (state: GameState) => GameState,
  base: GameState = start,
): GameState {
  const template = base.instances[base.players[0]!.hand[0]!]!;
  const p1 = base.players[0]!.playerId;
  const instances = { ...base.instances };
  for (const card of cards)
    instances[card.id] = {
      ...template,
      instanceId: card.id,
      cardId: card.cardId as GameState["instances"][string]["cardId"],
      ownerId: card.owner ? p1 : null,
      controllerId: card.owner ? p1 : null,
      counters: card.counters ?? {},
    };
  return place({ ...base, instances } as GameState);
}

describe("endStateOf: hit points of the winners", () => {
  test("a winner at full health reads remaining == max == printed", () => {
    const end = endStateOf(won(start), emptyRecord());
    expect(end.winners).toHaveLength(2);
    for (const winner of end.winners) {
      expect(winner.hitPoints).toBe(winner.maxHitPoints);
      expect(winner.maxHitPoints).toBe(winner.printedHitPoints);
      expect(winner.printedHitPoints).toBeGreaterThan(0);
    }
  });

  test("damage lowers the remaining hit points only; a max hit points bonus lifts max above printed", () => {
    const identity = start.players[0]!.identity.instanceId;
    const bonus = {
      id: "l-hp",
      kind: "statModifier",
      stat: "hp",
      amount: { kind: "const", value: 3 },
      scope: { selfInstanceId: null, controllerId: null, vars: {}, bindings: {} },
      targets: [identity],
      affects: null,
      duration: { kind: "endOfRound" },
    } as unknown as LastingEffect;
    const state = won({
      ...start,
      instances: { ...start.instances, [identity]: { ...start.instances[identity]!, damage: 1 } },
      lastingEffects: [...start.lastingEffects, bonus],
    });
    const [first, second] = endStateOf(state, emptyRecord()).winners;
    expect(first!.maxHitPoints).toBe(first!.printedHitPoints + 3);
    expect(first!.hitPoints).toBe(first!.printedHitPoints + 2);
    expect(second!.hitPoints).toBe(second!.maxHitPoints);
  });

  test("an eliminated seat is no winner, and only a win has winners", () => {
    const players = start.players.map((player, index) => (index === 1 ? { ...player, eliminated: true } : player));
    const end = endStateOf(won({ ...start, players } as GameState), emptyRecord());
    expect(end.winners.map((winner) => winner.playerId)).toEqual([start.players[0]!.playerId]);
    const lost: GameState = { ...start, outcome: { result: "loss", reason: "mainSchemeCompleted" } };
    expect(endStateOf(lost, emptyRecord()).winners).toEqual([]);
  });

  test("the winners agree with the summary's winners", () => {
    const summary = summarizeGame(won(start), emptyRecord())!;
    expect(summary.endState!.winners.map(({ identityCardId, hitPoints }) => ({ identityCardId, hitPoints }))).toEqual(
      summary.winners.map(({ identityCardId, hitPoints }) => ({ identityCardId, hitPoints })),
    );
  });
});

describe("endStateOf: what was left in play", () => {
  test("counts minions and side schemes in play and the victory display", () => {
    const p1 = start.players[0]!;
    const state = withCards(
      [
        { id: MINION, cardId: minionCard, owner: null },
        { id: SCHEME, cardId: sideSchemeCard, owner: null },
      ],
      (state) => ({
        ...state,
        players: state.players.map((player) =>
          player.playerId === p1.playerId ? { ...player, playArea: [...player.playArea, MINION] } : player,
        ),
        villainArea: [...state.villainArea, SCHEME],
        victoryDisplay: [p1.hand[1]!, p1.hand[2]!],
      }),
    );
    const end = endStateOf(won(state), emptyRecord());
    expect(end.minionsInPlayAtEnd).toBe(
      start.players.reduce((n, p) => n + minionsEngagedWith(start, p.playerId).length, 0) + 1,
    );
    expect(end.sideSchemesInPlayAtEnd).toBeGreaterThanOrEqual(1);
    expect(end.victoryDisplayCount).toBe(2);
    // The same cards out of play count nothing.
    const cleared = endStateOf(won({ ...start, victoryDisplay: [] }), emptyRecord());
    expect(cleared.minionsInPlayAtEnd).toBe(end.minionsInPlayAtEnd - 1);
    expect(cleared.sideSchemesInPlayAtEnd).toBe(end.sideSchemesInPlayAtEnd - 1);
    expect(cleared.victoryDisplayCount).toBe(0);
  });

  test("a stand-in for another table's card is not counted", () => {
    const state = withCards(
      [{ id: MINION, cardId: minionCard, owner: null }],
      (state) =>
        ({
          ...state,
          instances: { ...state.instances, [MINION]: { ...state.instances[MINION]!, remoteOf: {} } },
          villainArea: [...state.villainArea, MINION],
        }) as GameState,
    );
    expect(endStateOf(won(state), emptyRecord()).minionsInPlayAtEnd).toBe(
      endStateOf(won(start), emptyRecord()).minionsInPlayAtEnd,
    );
  });
});

describe("endStateOf: supports with Uses", () => {
  const withSupport = (counters: Record<string, number>) => {
    const p1 = start.players[0]!.playerId;
    const base: GameState = {
      ...start,
      cardPool: {
        ...start.cardPool,
        [USES_CARD]: {
          ...start.cardPool[supportCard]!,
          id: USES_CARD,
          keywords: [{ name: "uses", count: 3, counterType: "ammo" }],
        } as unknown as GameState["cardPool"][string],
      },
    };
    return withCards(
      [
        { id: SUPPORT, cardId: USES_CARD, owner: "p1", counters },
        { id: PLAIN_SUPPORT, cardId: supportCard, owner: "p1" },
      ],
      (state) => ({
        ...state,
        players: state.players.map((player) =>
          player.playerId === p1 ? { ...player, playArea: [...player.playArea, SUPPORT, PLAIN_SUPPORT] } : player,
        ),
      }),
      base,
    );
  };

  test("a support still holding its printed Uses count is full; one spent is not; one with no Uses is neither", () => {
    const full = endStateOf(won(withSupport({ ammo: 3 })), emptyRecord()).seats;
    const plainHasUses = (start.cardPool[supportCard] as { keywords?: { name: string }[] }).keywords?.some(
      (keyword) => keyword.name === "uses",
    );
    const extra = plainHasUses ? 1 : 0;
    expect(full[0]).toMatchObject({ usesSupports: 1 + extra, fullUsesSupports: 1 });
    expect(full[1]).toMatchObject({ usesSupports: 0, fullUsesSupports: 0 });
    const spent = endStateOf(won(withSupport({ ammo: 2 })), emptyRecord()).seats;
    expect(spent[0]).toMatchObject({ usesSupports: 1 + extra, fullUsesSupports: 0 });
  });
});

describe("endStateOf: the phase and the pod", () => {
  test("a win in the villain phase is the villain phase, even with a turn left open on the record", () => {
    const turn = { playerId: start.players[0]!.playerId, damage: 0, thwart: 0 };
    expect(endStateOf(won(start), { ...emptyRecord(), lastPhase: "villain" }).endPhase).toBe("villain");
    expect(endStateOf(won(start), { ...emptyRecord(), lastPhase: "villain", turn }).endPhase).toBe("villain");
  });

  test("an end in the player phase's end steps, no turn open, is the player phase", () => {
    const record = recordEvents(
      emptyRecord(),
      [
        {
          type: "stepChanged",
          from: { phase: "player", kind: "endPhaseReady" },
          to: { phase: "gameOver", kind: "gameOver" },
        },
      ],
      start,
    );
    expect(record.turn).toBeUndefined();
    expect(endStateOf(won(start), record).endPhase).toBe("player");
  });

  test("a record without lastPhase falls back to the turn: open is the player phase, none the villain phase", () => {
    const turn = { playerId: start.players[0]!.playerId, damage: 0, thwart: 0 };
    expect(endStateOf(won(start), { ...emptyRecord(), turn }).endPhase).toBe("player");
    expect(endStateOf(won(start), emptyRecord()).endPhase).toBe("villain");
  });

  test("outside a pod there is no group; in one, the group that defeated the shared villain", () => {
    expect(endStateOf(won(start), emptyRecord())).toMatchObject({ groupId: null, lokiDefeatedByGroup: null });
    const pod: PodState = {
      groupId: groupId("g2"),
      coordinator: "remote",
      groupsInPodAtStart: 2,
      groupsInGameAtStart: 2,
      playersInGameAtStart: 4,
      shared: {
        villainHp: 40,
        villainDamage: 40,
        villainFlipAtRemaining: null,
        villainFlipped: true,
        schemeThreat: 0,
        schemeTarget: 20,
        status: "won",
        defeatedByGroup: groupId("g2"),
      },
      outboundSeq: 0,
      inboundSeq: 0,
    };
    expect(endStateOf(won({ ...start, pod }), emptyRecord())).toMatchObject({
      groupId: "g2",
      lokiDefeatedByGroup: "g2",
    });
    const { defeatedByGroup: _defeated, ...unfinished } = pod.shared!;
    const playing: PodState = { ...pod, shared: { ...unfinished, status: "playing" } };
    expect(endStateOf(won({ ...start, pod: playing }), emptyRecord())).toMatchObject({
      groupId: "g2",
      lokiDefeatedByGroup: null,
    });
  });
});

describe("endStateOf in a real game", () => {
  test("a two-seat game played to its end reads its end state, the phase from its last step", async () => {
    const host = new LocalEngineHost();
    let record: GameRecord = emptyRecord();
    let state: GameState | null = null;
    const events: GameEvent[] = [];
    host.subscribe((update) => {
      record = recordEvents(record, update.events, update.state);
      events.push(...update.events);
      state = update.state;
    });
    await host.start(TWO_SEATS);
    for (let step = 0; step < 3000 && !state!.outcome; step++) {
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
      let acted = false;
      for (const player of state!.players) {
        const legal = await host.legalActions(player.playerId);
        if (legal.kind !== "turn") continue;
        const find = (kind: string) => legal.legal.find((entry) => entry.action.kind === kind);
        const next =
          (player.identity.form === "alterEgo" ? find("changeForm") : undefined) ??
          find("playCard") ??
          find("basicAttack") ??
          find("basicThwart") ??
          find("endTurn");
        if (!next) continue;
        await host.dispatch(next.example);
        acted = true;
        break;
      }
      if (!acted) break;
    }
    const final = state! as GameState;
    expect(final.outcome).toBeTruthy();
    const end = endStateOf(final, record);
    expect(JSON.parse(JSON.stringify(end))).toEqual(end);
    expect(summarizeGame(final, record)!.endState).toEqual(end);

    // The phase the last step was in, from the step change into game over.
    const over = [...events]
      .reverse()
      .find(
        (event): event is Extract<GameEvent, { type: "stepChanged" }> =>
          event.type === "stepChanged" && event.to.phase === "gameOver",
      )!;
    expect(record.lastPhase).toBe(over.from.phase);
    expect(end.endPhase).toBe(over.from.phase);

    expect(end.seats.map((seat) => seat.playerId)).toEqual(final.players.map((player) => player.playerId));
    expect(end.victoryDisplayCount).toBe(final.victoryDisplay.length);
    expect(end.groupId).toBeNull();
    for (const winner of end.winners) {
      expect(winner.maxHitPoints).not.toBeNull();
      expect(winner.hitPoints).toBeLessThanOrEqual(winner.maxHitPoints!);
    }
  }, 120_000);
});
