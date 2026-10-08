import { cardsInPlay, characterProfile, locateCard, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { inst, P1, playerOf, putOnTopOfDeck, use } from "../../../testing/harness.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { MISSION_AREA } from "./mission-rules.js";
import {
  atMission,
  atTheMission,
  attempting,
  CAMPAIGN_DEPS,
  campaignGame,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * A mission attempt with the box's own cards (docs/phase7-wave8.md §2.13's example, §3.36, §3.37, §3.39, §3.40): the
 * rulebook's table (MC45 p. 6). One player; Evacuate Survivors (45167a, 5 threat) and Sugar Man (45182a, 5 hit points)
 * in the mission area; Randall ([wild]; THW 2, ATK 1, 3 hit points), X-23 ([physical]; THW 1, ATK 3, 3 hit points) and
 * Marrow ([energy]; THW 1, ATK 2, 2 hit points) at the mission; Mission Team in front of the first player. The top of
 * the deck is Magik's Crown ([mental]), Clobber ([physical]) and Bloodgem ([wild]).
 */
const RANDALL = "45003";
const X23 = "45012";
const MARROW = "45021";
const CROWN = "45033";
const CLOBBER = "45046";
const BLOODGEM = "45050";
const EVACUATE = "45167a";
const EVACUATE_DONE = "45167b";
const SUGAR_MAN = "45182a";

interface Table {
  readonly state: GameState;
  readonly randall: InstanceId;
  readonly x23: InstanceId;
  readonly marrow: InstanceId;
  readonly mission: InstanceId;
  readonly sugarMan: InstanceId;
  readonly team: InstanceId;
  /** The cards on top of the deck, the first on top. */
  readonly top: readonly InstanceId[];
}
function table(top: readonly string[] = [CROWN, CLOBBER, BLOODGEM]): Table {
  const game = campaignGame({
    deck: [RANDALL, X23, MARROW, CROWN, CLOBBER, CLOBBER, BLOODGEM],
    mission: { mission: EVACUATE, overseer: SUGAR_MAN, team: true },
  });
  const allies = atMission(game, P1, RANDALL, X23, MARROW);
  const stacked = putOnTopOfDeck(allies.state, P1, ...top);
  const [randall, x23, marrow] = allies.ids as [InstanceId, InstanceId, InstanceId];
  return {
    state: stacked.state,
    randall,
    x23,
    marrow,
    mission: theCard(stacked.state, EVACUATE),
    sugarMan: theCard(stacked.state, SUGAR_MAN),
    team: theCard(stacked.state, MISSION_TEAM),
    top: stacked.ids,
  };
}
const attempt = (t: Table, pairs: Parameters<typeof attempting>[0], state: GameState = t.state) =>
  driveEventsPicking(CAMPAIGN_DEPS, state, attempting(pairs), use(P1, t.team, MISSION_TEAM_ACTION));
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const resolved = (events: readonly GameEvent[], ref: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref).length;

describe("a mission attempt, the rulebook's example (MC45 p. 6)", () => {
  it("the table: 5 threat, 5 hit points, three allies with their printed stats and nobody's control", () => {
    const t = table();
    expect(inst(t.state, t.mission).threat).toBe(5);
    expect(characterProfile(t.state, t.sugarMan, CAMPAIGN_DEPS)).toMatchObject({ maxHp: 5 });
    expect(characterProfile(t.state, t.randall, CAMPAIGN_DEPS)).toMatchObject({ thw: 2, atk: 1, maxHp: 3 });
    expect(characterProfile(t.state, t.x23, CAMPAIGN_DEPS)).toMatchObject({ thw: 1, atk: 3, maxHp: 3 });
    expect(characterProfile(t.state, t.marrow, CAMPAIGN_DEPS)).toMatchObject({ thw: 1, atk: 2, maxHp: 2 });
    expect(atTheMission(t.state)).toEqual([t.mission, t.sugarMan, t.randall, t.x23, t.marrow]);
  });

  it("§3.36 test 1 and §3.37 test 1: all three participate; the pool of 6 defeats Sugar Man (victory display) and 1 is lost; THW 4 takes the mission from 5 to 1; then 1 attempt counter and 1 damage to each ally", () => {
    const t = table();
    const [crown, clobber, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    const run = attempt(t, () => [
      [crown, t.randall],
      [clobber, t.x23],
      [gem, t.marrow],
    ]);
    // Step 1: three cards, in order, to the discard pile, where they stay.
    expect(of(run.events, "cardsPaired")[0]?.pairs).toEqual([
      { cardInstanceId: crown, characterInstanceId: t.randall, matched: true },
      { cardInstanceId: clobber, characterInstanceId: t.x23, matched: true },
      { cardInstanceId: gem, characterInstanceId: t.marrow, matched: true },
    ]);
    for (const id of t.top) expect(playerOf(run.state, P1).discard).toContain(id);
    // Sugar Man's Mission Response: one [physical] discarded, heal 3; he has no damage.
    expect(resolved(run.events, "45182a.sugar-man-forced-response")).toBe(1);
    // Steps 3 and 4: 1 + 3 + 2 = 6; he takes 5 and is defeated; 1 is lost.
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 6, dealt: 5, lost: 1 });
    expect(locateCard(run.state, t.sugarMan)).toEqual({ kind: "victoryDisplay" });
    // Step 5: 2 + 1 + 1 = 4, not a thwart.
    expect(inst(run.state, t.mission)).toMatchObject({ threat: 1, counters: { attempt: 1 } });
    const removed = of(run.events, "threatRemoved").filter((e) => e.schemeInstanceId === t.mission);
    expect(removed).toMatchObject([{ amount: 4, sourceInstanceId: t.team }]);
    // The mission's Forced Response: Randall 1 of 3, X-23 1 of 3, Marrow 1 of 2.
    expect(of(run.events, "momentRaised")).toHaveLength(1);
    expect([t.randall, t.x23, t.marrow].map((id) => inst(run.state, id).damage)).toEqual([1, 1, 1]);
    // Mission Team is exhausted, still in play, on its [MISSION] face; no ally exhausted.
    expect(inst(run.state, t.team)).toMatchObject({ exhausted: true, flipped: false });
    expect([t.randall, t.x23, t.marrow].map((id) => inst(run.state, id).exhausted)).toEqual([false, false, false]);
    expect(inst(run.state, t.mission).cardId).toBe(EVACUATE);
  });

  it("§3.36 test 2: paired worse (Clobber to Marrow, Bloodgem to X-23, the Crown to Randall), two participate: pool 4, THW 3", () => {
    const t = table();
    const [crown, clobber, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    const run = attempt(t, () => [
      [clobber, t.marrow],
      [gem, t.x23],
      [crown, t.randall],
    ]);
    expect(of(run.events, "cardsPaired")[0]?.pairs.map((p) => p.matched)).toEqual([false, true, true]);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 4, dealt: 4, lost: 0 });
    expect(inst(run.state, t.sugarMan).damage).toBe(4);
    expect(inst(run.state, t.mission).threat).toBe(2);
  });

  it("§3.37 test 4 and §3.40: with nobody paired the pool is 0 and no threat is removed, and the attempt still counts: 1 attempt counter, 1 damage to each ally", () => {
    const t = table();
    const run = attempt(t, () => []);
    expect(of(run.events, "damagePoolResolved")[0]).toMatchObject({ pool: 0, dealt: 0 });
    expect(of(run.events, "threatRemoved").filter((e) => e.schemeInstanceId === t.mission)).toEqual([]);
    expect(inst(run.state, t.mission)).toMatchObject({ threat: 5, counters: { attempt: 1 } });
    expect([t.randall, t.x23, t.marrow].map((id) => inst(run.state, id).damage)).toEqual([1, 1, 1]);
  });

  it("the next round: X-23 alone removes the last threat in step 5 and the mission is defeated with one counter on it. The allies are shuffled into the deck, Mission Team shows [FINISHED], and the [FINISHED] face clears the area and itself", () => {
    const t = table();
    const [crown, clobber, gem] = t.top as [InstanceId, InstanceId, InstanceId];
    const first = attempt(t, () => [
      [crown, t.randall],
      [clobber, t.x23],
      [gem, t.marrow],
    ]);
    // Next round's attempt: Mission Team readied (the end-of-phase ready, here by surgery), a Clobber on top.
    const again = putOnTopOfDeck(
      {
        ...first.state,
        instances: { ...first.state.instances, [t.team]: { ...inst(first.state, t.team), exhausted: false } },
      },
      P1,
      CLOBBER,
      CLOBBER,
      CROWN,
    );
    const [c1] = again.ids as [InstanceId, InstanceId, InstanceId];
    const before = again.state;
    const second = attempt(t, () => [[c1, t.x23]], before);
    expect(of(second.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([t.mission]);
    // No second counter: the a face had flipped before the moment was raised.
    expect(of(second.events, "momentRaised")).toHaveLength(1);
    expect(resolved(second.events, "45167a.evacuate-survivors-forced-response")).toBe(0);
    expect(resolved(second.events, "45167a.when-defeated")).toBe(1);
    // Each player card at the mission went into its owner's deck.
    for (const ally of [t.randall, t.x23, t.marrow]) {
      expect(playerOf(second.state, P1).deck).toContain(ally);
      expect(cardsInPlay(second.state)).not.toContain(ally);
      expect(inst(second.state, ally).damage).toBe(0);
    }
    // Mission Team flipped, in play, keeping its exhausted state.
    expect(inst(second.state, t.team)).toMatchObject({ flipped: true, exhausted: true });
    expect(cardsInPlay(second.state)).toContain(t.team);
    // The [FINISHED] face resolved its "defeated" bullet: the player searched for 1 card (hand +1) and it is gone.
    expect(resolved(second.events, "45167b.evacuate-survivors-forced-response")).toBe(1);
    expect(inst(second.state, t.mission).cardId).toBe(EVACUATE_DONE);
    expect(locateCard(second.state, t.mission)).toEqual({ kind: "removedFromGame" });
    expect(atTheMission(second.state)).toEqual([]);
    expect(second.state.scenarioPlayAreas?.[MISSION_AREA]?.cards).toEqual([]);
    expect(playerOf(second.state, P1).hand.length).toBe(playerOf(before, P1).hand.length + 1);
  });
});
