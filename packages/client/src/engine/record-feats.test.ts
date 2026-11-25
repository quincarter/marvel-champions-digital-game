import { beforeAll, describe, expect, test } from "vitest";
import { minionsEngagedWith, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { initActor, type RecordFoldContext } from "./record-actor.js";
import { blankSeatFeats, featsFold, type FeatsFoldState } from "./record-feats.js";

const TWO_SEATS = {
  scenarioId: "rhino",
  difficulty: "standard" as const,
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
  seed: 909,
};

/** A real two-seat start, with a minion `m1` and `m2` (encounter cards, out of play) and P1's ally `a1` added. */
let base: GameState;
let P1: PlayerId;
let P2: PlayerId;
let minionCard: string;
let obligationOfP1: string;
const M1 = "m1" as InstanceId;
const M2 = "m2" as InstanceId;
const ALLY = "a1" as InstanceId;
const VILLAIN_CARD_SOURCE = "enc-src" as InstanceId;

beforeAll(async () => {
  const host = new LocalEngineHost();
  let state: GameState | null = null;
  host.subscribe((update) => (state = update.state));
  await host.start(TWO_SEATS);
  const start = state! as GameState;
  P1 = start.players[0]!.playerId;
  P2 = start.players[1]!.playerId;
  minionCard = Object.values(start.cardPool).find((card) => card.type === "minion")!.id;
  const identity = start.cardPool[start.players[0]!.identity.cardId] as { obligationCardId: string };
  obligationOfP1 = identity.obligationCardId;
  const p1Card = start.players[0]!.hand[0]!;
  const allyCard = Object.values(start.cardPool).find((card) => card.type === "ally")!.id;
  const template = start.instances[p1Card]!;
  const encounter = (id: InstanceId, cardId: string) => ({
    ...template,
    instanceId: id,
    cardId,
    ownerId: null,
    controllerId: null,
  });
  base = {
    ...start,
    instances: {
      ...start.instances,
      [M1]: encounter(M1, minionCard),
      [M2]: encounter(M2, minionCard),
      [VILLAIN_CARD_SOURCE]: encounter(VILLAIN_CARD_SOURCE, minionCard),
      [ALLY]: { ...template, instanceId: ALLY, cardId: allyCard, ownerId: P1, controllerId: P1 },
    },
  } as GameState;
}, 60_000);

const ctxOf = (state: GameState, actor: PlayerId | null = null): RecordFoldContext => ({
  actor,
  actorBefore: actor,
  tracker: initActor(),
  state,
  round: 1,
  cardIdAt: (id) => state.instances[id]?.cardId,
});

/** Folds `steps` (an event, with the acting seat and the state after its command) from a fresh fold. */
function fold(steps: readonly (GameEvent | [GameEvent, PlayerId | null, GameState?])[]): FeatsFoldState {
  let feats = featsFold.init();
  for (const entry of steps) {
    const [event, actor, state] = Array.isArray(entry) ? entry : [entry, null, undefined];
    feats = featsFold.step(feats, event, ctxOf(state ?? base, actor));
  }
  return feats;
}
const seat = (feats: FeatsFoldState, playerId: PlayerId) => featsFold.finish(feats)[playerId] ?? blankSeatFeats();

const hit = (target: InstanceId, source: InstanceId | null, amount = 3, excess?: number): GameEvent =>
  ({
    type: "damageDealt",
    targetInstanceId: target,
    sourceInstanceId: source,
    amount,
    ...(excess !== undefined ? { excess } : {}),
  }) as GameEvent;
const defeated = (id: InstanceId): GameEvent =>
  ({ type: "characterDefeated", instanceId: id, cardId: base.instances[id]?.cardId ?? minionCard }) as GameEvent;
const stunned = (id: InstanceId): GameEvent => ({ type: "statusGiven", instanceId: id, status: "stunned" });
const turnStarted = (playerId: PlayerId): GameEvent => ({ type: "turnStarted", playerId });
const p1Identity = () => base.players[0]!.identity.instanceId;

describe("feats fold", () => {
  test("every seat starts blank, and the fold is plain data", () => {
    const feats = fold([turnStarted(P1)]);
    expect(seat(feats, P1)).toEqual(blankSeatFeats());
    expect(Object.keys(featsFold.finish(feats)).sort()).toEqual([P1, P2].sort());
    expect(JSON.parse(JSON.stringify(feats))).toEqual(feats);
  });

  test("a record kept while the fold was a stub folds on", () => {
    const feats = featsFold.step({} as FeatsFoldState, { type: "playerDeckReset", playerId: P1 }, ctxOf(base));
    expect(seat(feats, P1).deckResets).toBe(1);
  });

  test("a minion's defeat goes to the seat whose card hit it last, else to the seat acting", () => {
    const feats = fold([
      turnStarted(P1),
      [hit(M1, p1Identity()), P1],
      // P2's card lands the last hit inside P1's frame: the hit's card decides.
      [hit(M1, base.players[1]!.identity.instanceId), P1],
      [defeated(M1), P1],
      // No hit on M2 this turn: the seat acting defeats it.
      [defeated(M2), P2],
    ]);
    expect(seat(feats, P2).minionsDefeated).toBe(2);
    expect(seat(feats, P1).minionsDefeated).toBe(0);
  });

  test("an ally's hit counts for its controller; an encounter card's last hit for nobody", () => {
    const feats = fold([
      [hit(M1, ALLY), null],
      [defeated(M1), null],
      [hit(M2, p1Identity()), P1],
      [hit(M2, VILLAIN_CARD_SOURCE), null],
      [defeated(M2), P1],
    ]);
    expect(seat(feats, P1).minionsDefeated).toBe(1);
  });

  test("a hit does not carry into the next turn", () => {
    const feats = fold([turnStarted(P1), [hit(M1, p1Identity()), P1], turnStarted(P2), [defeated(M1), P2]]);
    expect(seat(feats, P1).minionsDefeated).toBe(0);
    expect(seat(feats, P2).minionsDefeated).toBe(1);
  });

  test("a villain's defeat is not a minion's", () => {
    const villain = Object.values(base.instances).find(
      (card) => base.cardPool[card.cardId]?.type === "villain",
    )!.instanceId;
    const feats = fold([
      [hit(villain, p1Identity()), P1],
      [{ type: "characterDefeated", instanceId: villain, cardId: base.instances[villain]!.cardId } as GameEvent, P1],
    ]);
    expect(seat(feats, P1).minionsDefeated).toBe(0);
  });

  test("the largest excess of a hit on an enemy, for the hitting seat", () => {
    const feats = fold([
      [hit(M1, p1Identity(), 6, 2), P1],
      [hit(M2, p1Identity(), 9, 5), P1],
      [hit(M1, ALLY, 4, 1), P1],
      // Excess on a player character is not this feat.
      [hit(p1Identity(), VILLAIN_CARD_SOURCE, 20, 9), null],
      [hit(M1, base.players[1]!.identity.instanceId, 3, 4), P2],
    ]);
    expect(seat(feats, P1).maxExcess).toBe(5);
    expect(seat(feats, P2).maxExcess).toBe(4);
  });

  test("deck resets count per seat", () => {
    const reset = (playerId: PlayerId): GameEvent => ({ type: "playerDeckReset", playerId });
    const feats = fold([reset(P1), reset(P2), reset(P1)]);
    expect(seat(feats, P1).deckResets).toBe(2);
    expect(seat(feats, P2).deckResets).toBe(1);
  });

  test("a stun and a defeat by the same seat in the same turn", () => {
    const feats = fold([
      turnStarted(P1),
      [stunned(M1), P1],
      [hit(M1, p1Identity()), P1],
      [defeated(M1), P1],
      // Stunned by P1, defeated by P2: no feat for either.
      [stunned(M2), P1],
      [hit(M2, base.players[1]!.identity.instanceId), P2],
      [defeated(M2), P2],
    ]);
    expect(seat(feats, P1).stunDefeats).toBe(1);
    expect(seat(feats, P2).stunDefeats).toBe(0);
    const later = fold([
      turnStarted(P1),
      [stunned(M1), P1],
      turnStarted(P1),
      [hit(M1, p1Identity()), P1],
      [defeated(M1), P1],
    ]);
    expect(seat(later, P1).stunDefeats).toBe(0);
    expect(seat(later, P1).minionsDefeated).toBe(1);
  });

  test("the most paid for one card, overpayment left out when the play logs it", () => {
    const played = (playerId: PlayerId, resourcesPaid: number, paidCount?: number): GameEvent =>
      ({
        type: "cardPlayed",
        playerId,
        instanceId: "x" as InstanceId,
        cardId: "01001",
        resourcesPaid,
        paid: { physical: 0, mental: 0, energy: 0, wild: 0 },
        ...(paidCount !== undefined ? { paidCount } : {}),
      }) as GameEvent;
    const feats = fold([played(P1, 3), played(P1, 6, 4), played(P1, 2), played(P2, 5)]);
    expect(seat(feats, P1).maxPaidForOneCard).toBe(4);
    expect(seat(feats, P2).maxPaidForOneCard).toBe(5);
  });

  test("the most minions engaged at once and a dip below half, read from the state after a command", () => {
    const p1 = base.players[0]!;
    const identityAt = (damage: number) => ({ ...base.instances[p1.identity.instanceId]!, damage });
    const surrounded = {
      ...base,
      players: [{ ...p1, playArea: [...p1.playArea, M1, M2] }, base.players[1]!],
      instances: { ...base.instances, [p1.identity.instanceId]: identityAt(0) },
    } as GameState;
    const hurt = (damage: number) =>
      ({ ...base, instances: { ...base.instances, [p1.identity.instanceId]: identityAt(damage) } }) as GameState;
    const any: GameEvent = { type: "thenSkipped" };
    const feats = fold([
      [any, null, surrounded],
      [any, null, base],
    ]);
    expect(seat(feats, P1).maxEngagedMinions).toBe(2);
    expect(seat(feats, P2).maxEngagedMinions).toBe(0);
    expect(seat(feats, P1).fellBelowHalf).toBe(false);
    // Spider-Man has 10 hit points: 5 damage leaves half, not below it; 6 leaves 4, below it.
    expect(seat(fold([[any, null, hurt(5)]]), P1).fellBelowHalf).toBe(false);
    expect(seat(fold([[any, null, hurt(6)]]), P1).fellBelowHalf).toBe(true);
    // A hero defeated in a command is caught by its defeat.
    expect(seat(fold([[defeated(p1.identity.instanceId), null]]), P1).fellBelowHalf).toBe(true);
  });

  test("a seat's own obligation removed from the game, not another's", () => {
    const moved = (cardId: string, to: "removedFromGame" | "encounterDiscard"): GameEvent =>
      ({
        type: "cardMoved",
        instanceId: "o1" as InstanceId,
        cardId,
        from: { kind: "resolving", playerId: P2 },
        to: to === "removedFromGame" ? { kind: to } : { kind: to, deckId: "main" },
      }) as GameEvent;
    expect(seat(fold([moved(obligationOfP1, "encounterDiscard")]), P1).ownObligationRemoved).toBe(false);
    const feats = fold([moved(obligationOfP1, "removedFromGame")]);
    expect(seat(feats, P1).ownObligationRemoved).toBe(true);
    expect(seat(feats, P2).ownObligationRemoved).toBe(false);
  });

  test("a surge chain: each reveal after the card before it surged", () => {
    const revealed = (id: string, playerId: PlayerId): GameEvent =>
      ({ type: "encounterCardRevealed", instanceId: id, cardId: minionCard, playerId }) as GameEvent;
    const dealt = (id: string, playerId: PlayerId): GameEvent =>
      ({
        type: "cardMoved",
        instanceId: id,
        cardId: minionCard,
        from: { kind: "encounterDeck", deckId: "main" },
        to: { kind: "dealtEncounter", playerId },
      }) as GameEvent;
    const surge = (id: string, playerId: PlayerId): GameEvent =>
      ({ type: "surgeTriggered", instanceId: id, playerId }) as GameEvent;
    const feats = fold([
      dealt("e1", P1),
      dealt("f1", P2),
      revealed("e1", P1),
      dealt("e2", P1),
      surge("e1", P1),
      revealed("f1", P2),
      revealed("e2", P1),
      dealt("e3", P1),
      surge("e2", P1),
      revealed("e3", P1),
      // A fresh reveal starts a new run.
      revealed("e4", P1),
    ]);
    expect(seat(feats, P1).maxSurgeChain).toBe(3);
    expect(seat(feats, P2).maxSurgeChain).toBe(1);
    // A surge's card waiting into the next round no longer chains.
    const across = fold([
      revealed("e1", P1),
      dealt("e2", P1),
      surge("e1", P1),
      { type: "roundStarted", round: 2 },
      revealed("e2", P1),
    ]);
    expect(seat(across, P1).maxSurgeChain).toBe(1);
  });
});

describe("feats in a real game", () => {
  test("a two-seat game played to its end folds feats that agree with its events", async () => {
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
        // Into hero form, then every card it can play, an attack (on minions when one guards) and a thwart.
        const next =
          (player.identity.form === "alterEgo" ? find("changeForm") : undefined) ??
          find("playCard") ??
          find("basicAttack") ??
          find("basicThwart") ??
          find("endTurn");
        if (!next) continue;
        // An attack goes at an engaged minion when it can: the feats are about minions.
        const minion = minionsEngagedWith(state!, player.playerId)[0];
        const command = next.example;
        const atMinion =
          command.type === "basicAttack" && minion
            ? await host.dispatch({ ...command, targetInstanceId: minion })
            : null;
        if (!atMinion?.ok) await host.dispatch(command);
        acted = true;
        break;
      }
      if (!acted) break;
    }
    expect(state!.outcome).toBeTruthy();
    const feats = featsFold.finish(record.feats!);
    expect(JSON.parse(JSON.stringify(record.feats))).toEqual(record.feats);
    for (const player of state!.players) {
      const mine = feats[player.playerId]!;
      expect(mine).toBeDefined();
      const resets = events.filter((event) => event.type === "playerDeckReset" && event.playerId === player.playerId);
      expect(mine.deckResets).toBe(resets.length);
      const paid = events.flatMap((event) =>
        event.type === "cardPlayed" && event.playerId === player.playerId
          ? [event.paidCount ?? event.resourcesPaid]
          : [],
      );
      expect(mine.maxPaidForOneCard).toBe(Math.max(0, ...paid));
      expect(mine.stunDefeats).toBeLessThanOrEqual(mine.minionsDefeated);
    }
    const minionDefeats = events.filter(
      (event) => event.type === "characterDefeated" && state!.cardPool[event.cardId]?.type === "minion",
    ).length;
    const credited = Object.values(feats).reduce((sum, seat) => sum + seat.minionsDefeated, 0);
    expect(credited).toBeLessThanOrEqual(minionDefeats);
    // The heroes attacked minions all game: some defeat is credited, and Rhino's minions engaged someone.
    expect(credited).toBeGreaterThan(0);
    expect(Math.max(...Object.values(feats).map((seat) => seat.maxEngagedMinions))).toBeGreaterThan(0);
  }, 180_000);
});
