import {
  cardsInPlay,
  controllerOf,
  legalActions,
  playCostOf,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  P2,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { MISSION_AREA } from "./mission-rules.js";
import {
  atMission,
  atTheMission,
  attempting,
  CAMPAIGN_DEPS,
  campaignGame,
  DISCOUNT,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Mission Team (45171a/b) on the staged mission table (docs/phase7-wave8.md §3.35): Evacuate Survivors (45167a) and
 * Sugar Man (45182a) in the mission area, Mission Team in front of the first player.
 */
const X23 = "45012";
const MARROW = "45021";
const CLOBBER = "45046";
const CAUGHT_OFF_GUARD = "01188";
const FINISHED_ACTION = "45171b.mission-team-action";
const INTO = { scenarioPlayArea: MISSION_AREA } as const;

const table = (players: 1 | 2 = 1, options: { deck?: readonly string[]; encounter?: readonly string[] } = {}) =>
  campaignGame({ players, ...options, mission: { mission: "45167a", overseer: "45182a", team: true } });
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const toMission = (command: Command): Command => (command.type === "playCard" ? { ...command, into: INTO } : command);
const accepted = (state: GameState, command: Command) => sessionApply(startSession(state), command, CAMPAIGN_DEPS).ok;
const discount = (state: GameState, team: InstanceId) =>
  driveEventsPicking(CAMPAIGN_DEPS, state, picking(DISCOUNT), use(P1, team, MISSION_TEAM_ACTION));
const reductions = (state: GameState) => state.lastingEffects.filter((e) => e.kind === "costReduction");

describe("Mission Team (45171a): 'cannot be discarded and the first player gains control of it'", () => {
  it("setup: in the first player's play area, ready, [MISSION] face up, under their control; only they can use its Action", () => {
    const state = table(2);
    const team = theCard(state, MISSION_TEAM);
    expect(playerOf(state, P1).playArea).toContain(team);
    expect(controllerOf(state, team)).toBe(P1);
    expect(inst(state, team)).toMatchObject({ exhausted: false, flipped: false, faceup: true });
    const listed = legalActions(state, P1, CAMPAIGN_DEPS);
    if (listed.kind !== "turn") throw new Error(listed.kind);
    expect(listed.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === MISSION_TEAM_ACTION)).toBe(
      true,
    );
    expect(accepted(state, use(P2, team, MISSION_TEAM_ACTION))).toBe(false);
  });

  it("test 3: 'discard an upgrade or support you control' (Caught Off Guard) with Mission Team the first player's only one: nothing is discarded", () => {
    const state = table(1, { encounter: [CAUGHT_OFF_GUARD, CAUGHT_OFF_GUARD] });
    const team = theCard(state, MISSION_TEAM);
    // The villain's boost card, then the card the player is dealt.
    const staged = stackEncounterDeck(state, CAUGHT_OFF_GUARD, CAUGHT_OFF_GUARD);
    const run = driveEventsPicking(CAMPAIGN_DEPS, staged, firstLegal, endTurn(P1));
    expect(run.events.some((e) => e.type === "abilityResolved" && e.abilityId === "01188.when-revealed")).toBe(true);
    expect(cardsInPlay(run.state)).toContain(team);
    expect(of(run.events, "cardMoved").filter((e) => e.instanceId === team)).toEqual([]);
    expect(of(run.events, "cardDiscardedFromPlay").filter((e) => e.instanceId === team)).toEqual([]);
  });

  it("test 4: round 2, two players: it is in the new first player's play area under their control, readied at the end of the player phase; the old first player cannot use it", () => {
    const state = table(2);
    const team = theCard(state, MISSION_TEAM);
    const used = discount(state, team);
    expect(inst(used.state, team).exhausted).toBe(true);
    const round = driveEventsPicking(CAMPAIGN_DEPS, used.state, firstLegal, endTurn(P1), endTurn(P2));
    expect(round.state.round).toBe(2);
    expect(round.state.firstPlayerId).toBe(P2);
    expect(playerOf(round.state, P2).playArea).toContain(team);
    expect(controllerOf(round.state, team)).toBe(P2);
    expect(inst(round.state, team)).toMatchObject({ exhausted: false, flipped: false });
    expect(accepted(round.state, use(P1, team, MISSION_TEAM_ACTION))).toBe(false);
    expect(accepted(round.state, use(P2, team, MISSION_TEAM_ACTION))).toBe(true);
  });

  it("test 5: the first player is eliminated: Mission Team is in play under the next player's control", () => {
    const state = table(2);
    const team = theCard(state, MISSION_TEAM);
    // Spider-Man in hero form with 1 hit point left: Rhino's undefended attack (ATK 2) defeats him in the villain phase.
    const doomed = patchInstance(withForm(state, { heroForm: 0 }), identityOf(state, P1), { damage: 9 });
    const run = driveEventsPicking(CAMPAIGN_DEPS, doomed, firstLegal, endTurn(P1), endTurn(P2));
    expect(playerOf(run.state, P1).eliminated).toBe(true);
    expect(run.state.outcome).toBeFalsy();
    expect(cardsInPlay(run.state)).toContain(team);
    expect(controllerOf(run.state, team)).toBe(P2);
    expect(playerOf(run.state, P2).playArea).toContain(team);
  });
});

describe("Mission Team (45171a): 'Reduce the cost of the next ally played to the mission this phase by 2'", () => {
  it("test 1: the first player exhausts it for the reduction; the next player plays X-23 (cost 3) to the mission for 1, and a second ally to the mission that phase costs its printed cost", () => {
    const state = table(2, { deck: [X23, MARROW] });
    const team = theCard(state, MISSION_TEAM);
    const used = discount(state, team);
    expect(inst(used.state, team).exhausted).toBe(true);
    expect(reductions(used.state)).toMatchObject([{ amount: 2, into: INTO, anyPlayer: true }]);
    const theirs = driveEventsPicking(CAMPAIGN_DEPS, used.state, firstLegal, endTurn(P1)).state;
    const hand = moveToHand(theirs, P2, X23, MARROW);
    const [x23, marrow] = hand.ids as [InstanceId, InstanceId];
    expect(playCostOf(hand.state, P2, x23, CAMPAIGN_DEPS)).toMatchObject({ printed: 3, current: 3 });
    expect(playCostOf(hand.state, P2, x23, CAMPAIGN_DEPS, null, MISSION_AREA)).toMatchObject({
      current: 1,
      reduction: 2,
    });
    // One resource short of nothing: a payment of no cards is refused there, and X-23 at her own area still costs 3.
    expect(accepted(hand.state, toMission(play(P2, x23, [])))).toBe(false);
    const played = driveEventsPicking(
      CAMPAIGN_DEPS,
      hand.state,
      firstLegal,
      toMission(play(P2, x23, payWith(hand.state, P2, 1, [x23, marrow]))),
    );
    expect(atTheMission(played.state)).toContain(x23);
    expect(reductions(played.state)).toEqual([]);
    expect(playCostOf(played.state, P2, marrow, CAMPAIGN_DEPS, null, MISSION_AREA)).toMatchObject({
      current: 2,
      reduction: 0,
    });
  });

  it("test 2: an ally played to the player's own area costs full and leaves the reduction waiting; unused, it ends with the player phase", () => {
    const state = table(1, { deck: [X23] });
    const team = theCard(state, MISSION_TEAM);
    const used = discount(state, team);
    const hand = moveToHand(used.state, P1, X23);
    const x23 = hand.ids[0]!;
    const own = driveEventsPicking(
      CAMPAIGN_DEPS,
      hand.state,
      firstLegal,
      play(P1, x23, payWith(hand.state, P1, 3, [x23])),
    );
    expect(playerOf(own.state, P1).playArea).toContain(x23);
    expect(reductions(own.state)).toHaveLength(1);
    const next = driveEventsPicking(CAMPAIGN_DEPS, own.state, firstLegal, endTurn(P1));
    expect(next.state.round).toBe(2);
    expect(reductions(next.state)).toEqual([]);
    expect(of(next.events, "lastingEffectEnded").map((e) => e.reason)).toContain("expired");
  });
});

describe("Mission Team (45171b), the [FINISHED] face", () => {
  it("test 6: the mission is defeated: Mission Team shows [FINISHED] and keeps its exhausted state; next round its Action has a chosen player draw 1 card, and it still cannot be discarded", () => {
    const game = table(1, { deck: [X23, CLOBBER] });
    const mission = theCard(game, "45167a");
    // No Overseer left and 1 threat: X-23 with a Clobber defeats the mission.
    const sugarMan = theCard(game, "45182a");
    const cleared: GameState = {
      ...patchInstance(game, mission, { threat: 1 }),
      scenarioPlayAreas: {
        ...game.scenarioPlayAreas,
        [MISSION_AREA]: {
          ...game.scenarioPlayAreas![MISSION_AREA]!,
          cards: game.scenarioPlayAreas![MISSION_AREA]!.cards.filter((id) => id !== sugarMan),
        },
      },
      removedFromGame: [...game.removedFromGame, sugarMan],
    };
    const ally = atMission(cleared, P1, X23);
    const top = putOnTopOfDeck(ally.state, P1, CLOBBER);
    const team = theCard(top.state, MISSION_TEAM);
    const done = driveEventsPicking(
      CAMPAIGN_DEPS,
      top.state,
      attempting(() => [[top.ids[0]!, ally.ids[0]!]]),
      use(P1, team, MISSION_TEAM_ACTION),
    );
    expect(inst(done.state, team)).toMatchObject({ flipped: true, exhausted: true });
    expect(accepted(done.state, use(P1, team, FINISHED_ACTION))).toBe(false);

    const next = driveEventsPicking(CAMPAIGN_DEPS, done.state, firstLegal, endTurn(P1));
    expect(inst(next.state, team)).toMatchObject({ flipped: true, exhausted: false });
    // The [MISSION] face's Action is gone with the face.
    expect(accepted(next.state, use(P1, team, MISSION_TEAM_ACTION))).toBe(false);
    const before = playerOf(next.state, P1).hand.length;
    const drew = driveEventsPicking(CAMPAIGN_DEPS, next.state, firstLegal, use(P1, team, FINISHED_ACTION));
    expect(playerOf(drew.state, P1).hand.length).toBe(before + 1);
    expect(inst(drew.state, team).exhausted).toBe(true);
  });
});
