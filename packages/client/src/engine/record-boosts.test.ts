import { describe, expect, test } from "vitest";
import type { GameEvent, GameState, GroupId, InstanceId, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { initActor, type RecordFoldContext } from "./record-actor.js";
import { BIG_BOOST_ICONS, blankSeatBoosts, boostsFold, type BoostsFoldState } from "./record-boosts.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;
const VILLAIN = "v1" as InstanceId;
const MINION = "m1" as InstanceId;
/** Competitive: leader one is the active villain of team one's area (team one's enemy leader), leader two of team two's. */
const LEADER_ONE = "l1" as InstanceId;
const LEADER_TWO = "l2" as InstanceId;
const CAP_LEADER_CARD = "cap-leader";

/** A cooperative state: the fold reads no more of it than its teams and game areas. */
const coop = { teams: undefined, gameAreas: [] } as unknown as GameState;
const competitive = {
  teams: [
    { teamId: "t1", side: "registration", playerIds: [P1], areaId: "a1" },
    { teamId: "t2", side: "resistance", playerIds: [P2], areaId: "a2" },
  ],
  gameAreas: [
    { areaId: "a1", activeVillainId: LEADER_ONE },
    { areaId: "a2", activeVillainId: LEADER_TWO },
  ],
} as unknown as GameState;

const ctxOf = (state: GameState): RecordFoldContext => ({
  actor: null,
  actorBefore: null,
  tracker: initActor(),
  state,
  round: 1,
  cardIdAt: (id) => (id === LEADER_TWO ? CAP_LEADER_CARD : id === LEADER_ONE ? "other-leader" : undefined),
});

function fold(events: readonly GameEvent[], state: GameState = coop): BoostsFoldState {
  return events.reduce((acc, event) => boostsFold.step(acc, event, ctxOf(state)), boostsFold.init());
}
const seat = (folded: BoostsFoldState, playerId: PlayerId) =>
  boostsFold.finish(folded).seats[playerId] ?? blankSeatBoosts();

const attackLine = (
  phase: "initiated" | "resolved" | "cancelled",
  playerId: PlayerId,
  enemy: InstanceId = VILLAIN,
): GameEvent =>
  ({
    type: "triggerEvent",
    phase,
    event: {
      kind: "enemyAttack",
      enemyInstanceId: enemy,
      attackedPlayerId: playerId,
      targetPlayerId: playerId,
      targetInstanceId: "hero" as InstanceId,
    },
  }) as GameEvent;
const schemeLine = (phase: "initiated" | "resolved", playerId: PlayerId): GameEvent =>
  ({
    type: "triggerEvent",
    phase,
    event: { kind: "enemyScheme", enemyInstanceId: VILLAIN, playerId },
  }) as GameEvent;
let boostId = 0;
const flip = (icons: number, enemy: InstanceId = VILLAIN): GameEvent => ({
  type: "boostCardFlipped",
  enemyInstanceId: enemy,
  instanceId: `b${++boostId}` as InstanceId,
  boostIcons: icons,
});
/** One attack against `playerId`, its boost cards showing `icons`. */
const attack = (playerId: PlayerId, ...icons: number[]): GameEvent[] => [
  attackLine("initiated", playerId),
  ...icons.map((count) => flip(count)),
  attackLine("resolved", playerId),
];

describe("boosts fold", () => {
  test("every seat starts blank, and the fold is plain data", () => {
    const folded = fold(attack(P1, 1));
    expect(seat(folded, P1)).toEqual(blankSeatBoosts());
    expect(boostsFold.finish(folded).leaderRedirects).toEqual({});
    expect(JSON.parse(JSON.stringify(folded))).toEqual(folded);
  });

  test("a record kept while the fold was a stub folds on", () => {
    let folded = {} as BoostsFoldState;
    for (const event of attack(P1, 0)) folded = boostsFold.step(folded, event, ctxOf(coop));
    expect(seat(folded, P1).luckyStreakMax).toBe(1);
    expect(boostsFold.finish({} as BoostsFoldState)).toEqual({ seats: {}, leaderRedirects: {} });
  });

  test("lucky streak: consecutive attacks whose every boost card was blank, per seat", () => {
    const folded = fold([
      ...attack(P1, 0),
      ...attack(P1, 0, 0),
      // Another seat's attacks do not touch P1's run.
      ...attack(P2, 2),
      ...attack(P1, 0),
      // One card with an icon breaks the run, even beside a blank one.
      ...attack(P1, 0, 1),
      ...attack(P1, 0),
    ]);
    expect(seat(folded, P1).luckyStreakMax).toBe(3);
    expect(seat(folded, P2).luckyStreakMax).toBe(0);
  });

  test("lucky streak: an attack with no boost card turned faceup neither extends nor breaks the run", () => {
    const folded = fold([...attack(P1, 0), ...attack(P1), ...attack(P1, 0)]);
    expect(seat(folded, P1).luckyStreakMax).toBe(2);
  });

  test("lucky streak: a scheme's boost cards do not count; a flip by another enemy is not the attack's", () => {
    const folded = fold([
      schemeLine("initiated", P1),
      flip(0),
      schemeLine("resolved", P1),
      attackLine("initiated", P1),
      flip(0),
      // A villainous character's or another enemy's card, no activation of its own open.
      flip(2, MINION),
      attackLine("resolved", P1),
    ]);
    expect(seat(folded, P1).luckyStreakMax).toBe(1);
  });

  test("an attack retargeted onto another seat counts for the seat it ends against", () => {
    const folded = fold([attackLine("initiated", P1), flip(0), attackLine("resolved", P2)]);
    expect(seat(folded, P2).luckyStreakMax).toBe(1);
    expect(seat(folded, P1).luckyStreakMax).toBe(0);
  });

  test("activations nest: a boost card goes to the innermost open activation of its enemy", () => {
    const folded = fold([
      attackLine("initiated", P1),
      flip(0),
      // A Boost ability starts another attack by a minion against P2 while the villain's is open.
      attackLine("initiated", P2, MINION),
      flip(BIG_BOOST_ICONS, MINION),
      attackLine("resolved", P2, MINION),
      attackLine("resolved", P1),
    ]);
    expect(seat(folded, P1)).toMatchObject({ luckyStreakMax: 1, bigBoosts: 0 });
    expect(seat(folded, P2)).toMatchObject({ luckyStreakMax: 0, bigBoosts: 1 });
  });

  test("big boosts: cards with 3+ icons on attacks and schemes against the seat", () => {
    const folded = fold([
      ...attack(P1, 3, 2),
      schemeLine("initiated", P1),
      flip(4),
      schemeLine("resolved", P1),
      ...attack(P2, 5),
    ]);
    expect(seat(folded, P1).bigBoosts).toBe(2);
    expect(seat(folded, P2).bigBoosts).toBe(1);
  });

  test("a cancelled attack still counts its boost cards; a stun's cancel line with nothing open closes nothing", () => {
    const folded = fold([
      attackLine("cancelled", P1),
      attackLine("initiated", P1),
      flip(3),
      attackLine("cancelled", P1),
    ]);
    expect(seat(folded, P1).bigBoosts).toBe(1);
    expect(folded.open).toBeUndefined();
  });

  test("an activation the game ended inside is credited at the finish", () => {
    const folded = fold([attackLine("initiated", P1), flip(3)]);
    expect(seat(folded, P1).bigBoosts).toBe(1);
  });

  test("leader redirects: the enemy leader's attack on a player moved onto the team's own leader", () => {
    const redirected = (playerId: PlayerId, attacker: InstanceId, target: InstanceId): GameEvent[] => [
      attackLine("initiated", playerId, attacker),
      flip(4, attacker),
      { type: "enemyAttackedEnemy", attackerInstanceId: attacker, targetInstanceId: target, damageDealt: 6 },
      attackLine("cancelled", playerId, attacker),
    ];
    const folded = fold(
      [
        // Team one's enemy leader (leader one) attacks P1, and the attack goes to team one's own leader (leader two).
        ...redirected(P1, LEADER_ONE, LEADER_TWO),
        // The wrong way round: not a redirect onto the attacked team's leader.
        ...redirected(P2, LEADER_ONE, LEADER_TWO),
        // Skipped: the attack never reached the leader.
        attackLine("initiated", P1, LEADER_ONE),
        {
          type: "enemyAttackedEnemy",
          attackerInstanceId: LEADER_ONE,
          targetInstanceId: LEADER_TWO,
          damageDealt: 0,
          skipped: "leftPlay",
        },
        attackLine("cancelled", P1, LEADER_ONE),
      ],
      competitive,
    );
    expect(boostsFold.finish(folded).leaderRedirects).toEqual({ t1: [CAP_LEADER_CARD] });
    // The redirected attack's boost card was not against P1.
    expect(seat(folded, P1).bigBoosts).toBe(0);
  });

  test("leader redirects: a leader attacking the other leader as a player's action is no redirect", () => {
    const folded = fold(
      [{ type: "enemyAttackedEnemy", attackerInstanceId: LEADER_ONE, targetInstanceId: LEADER_TWO, damageDealt: 2 }],
      competitive,
    );
    expect(boostsFold.finish(folded).leaderRedirects).toEqual({});
  });

  test("leader redirects: none in a cooperative game", () => {
    const folded = fold([
      attackLine("initiated", P1),
      { type: "enemyAttackedEnemy", attackerInstanceId: VILLAIN, targetInstanceId: MINION, damageDealt: 2 },
      attackLine("cancelled", P1),
    ]);
    expect(boostsFold.finish(folded).leaderRedirects).toEqual({});
  });

  test("remote defeats: each remote power that defeated its card, for the player who made it", () => {
    const settled = (playerId: PlayerId, power: "attack" | "thwart", cardId: string, defeated: boolean): GameEvent => ({
      type: "remotePowerSettled",
      fromGroupId: "g2" as GroupId,
      playerId,
      power,
      cardId: cardId as never,
      defeated,
    });
    const folded = fold([
      settled(P1, "attack", "55041", false),
      settled(P1, "attack", "55041", true),
      settled(P2, "thwart", "55046", true),
    ]);
    expect(seat(folded, P1).remoteDefeats).toEqual([{ cardId: "55041", power: "attack" }]);
    expect(seat(folded, P2).remoteDefeats).toEqual([{ cardId: "55046", power: "thwart" }]);
  });
});

describe("boosts in a real game", () => {
  test("a two-seat game played to its end folds boost counters that agree with its events", async () => {
    const host = new LocalEngineHost();
    let record: GameRecord = emptyRecord();
    let state: GameState | null = null;
    const events: GameEvent[] = [];
    host.subscribe((update) => {
      record = recordEvents(record, update.events, update.state);
      events.push(...update.events);
      state = update.state;
    });
    await host.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      seed: 909,
    });
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
    expect(state!.outcome).toBeTruthy();
    expect(JSON.parse(JSON.stringify(record.boosts))).toEqual(record.boosts);
    const counters = boostsFold.finish(record.boosts!);
    // Every activation closed by the end, or was credited at the finish.
    const attacks = events.filter(
      (event) => event.type === "triggerEvent" && event.phase === "initiated" && event.event.kind === "enemyAttack",
    );
    expect(attacks.length).toBeGreaterThan(0);
    const flips = events.flatMap((event) => (event.type === "boostCardFlipped" ? [event.boostIcons] : []));
    const big = flips.filter((icons) => icons >= BIG_BOOST_ICONS).length;
    const credited = Object.values(counters.seats).reduce((sum, seat) => sum + seat.bigBoosts, 0);
    // Every boost card in this game is an activation's (no villainous characters, no redirects).
    expect(credited).toBe(big);
    for (const seat of Object.values(counters.seats)) {
      expect(seat.luckyStreakMax).toBeLessThanOrEqual(attacks.length);
      expect(seat.remoteDefeats).toEqual([]);
    }
    expect(counters.leaderRedirects).toEqual({});
  }, 180_000);
});
