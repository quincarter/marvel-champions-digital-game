import { activeVillain, cardsInPlay, locateCard, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  firstLegal,
  inst,
  mainThreat,
  P1,
  P2,
  P3,
  patchInstance,
  playerOf,
  putOnTopOfDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  atMission,
  atTheMission,
  attempting,
  CAMPAIGN_DEPS,
  campaignGame,
  encounterCardAtMission,
  MISSION_TEAM,
  MISSION_TEAM_ACTION,
  theCard,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * How a mission ends (docs/phase7-wave8.md §2.13, §3.40; MC45 pp. 5–6), on the staged mission table: defeated (no
 * threat and no minion in the area) or failed (the fourth attempt counter), each mission's two bullets, and what
 * leaves the area how.
 *
 * **Failed** is staged with three attempt counters on the mission and an attempt with no ally there, which discards
 * nothing and still counts (§3.40). **Defeated** is staged with the mission at 1 threat, no Overseer in the area and
 * X-23 (THW 1, [physical]) at the mission with a Clobber ([physical]) on top of the first player's deck.
 */
const X23 = "45012";
const RANDALL = "45003";
const CLOBBER = "45046";
const CROWN = "45033";
const BLOODGEM = "45050";
const AGENT = "45164";
const SUGAR_MAN = "45182a";
const DESPERATE_MEASURES = "45176";
const SEA_WALL = "45177";
const CAMPAIGN_ALLIES = ["45172", "45173", "45174", "45175"];
const SEATS = [P1, P2, P3] as const;

type Options = Omit<NonNullable<Parameters<typeof campaignGame>[0]>, "mission" | "deck">;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const resolved = (events: readonly GameEvent[], ref: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref).length;
/** Every ref of the five missions: the a face's Forced Response and When Defeated, the b face's Forced Response. */
const REFS: Readonly<Record<string, { readonly a: string; readonly defeated: string; readonly b: string }>> = {
  "45166": {
    a: "45166a.liberate-the-seattle-core-forced-response",
    defeated: "45166a.when-defeated",
    b: "45166b.liberate-the-seattle-core-forced-response",
  },
  "45167": {
    a: "45167a.evacuate-survivors-forced-response",
    defeated: "45167a.when-defeated",
    b: "45167b.evacuate-survivors-forced-response",
  },
  "45168": {
    a: "45168a.sabotage-the-sea-wall-forced-response",
    defeated: "45168a.when-defeated",
    b: "45168b.sabotage-the-sea-wall-forced-response",
  },
  "45169": {
    a: "45169a.find-lost-mutants-forced-response",
    defeated: "45169a.when-defeated",
    b: "45169b.find-lost-mutants-forced-response",
  },
  "45170": {
    a: "45170a.protect-the-professor-forced-response",
    defeated: "45170a.when-defeated",
    b: "45170b.protect-the-professor-forced-response",
  },
};
const refOf = (mission: string, face: "a" | "b") => REFS[mission]![face];

/** The mission fails: its fourth attempt counter. Returns the game after the [FINISHED] face has resolved. */
function failed(mission: string, options: Options = {}, pick: Picker = firstLegal, stage = (s: GameState) => s) {
  const game = stage(campaignGame({ ...options, mission: { mission: `${mission}a`, team: true } }));
  const card = theCard(game, `${mission}a`);
  const before = patchInstance(game, card, { counters: { attempt: 3 } });
  const team = theCard(before, MISSION_TEAM);
  const run = driveEventsPicking(
    CAMPAIGN_DEPS,
    before,
    attempting(() => [], pick),
    use(P1, team, MISSION_TEAM_ACTION),
  );
  return { ...run, before, mission: card, team };
}
/** The mission is defeated by an attempt's step 5. Returns the game after the [FINISHED] face has resolved. */
function defeated(mission: string, options: Options = {}, pick: Picker = firstLegal, stage = (s: GameState) => s) {
  const game = stage(
    campaignGame({ ...options, deck: [X23, CLOBBER], mission: { mission: `${mission}a`, team: true } }),
  );
  const card = theCard(game, `${mission}a`);
  const ally = atMission(patchInstance(game, card, { threat: 1 }), P1, X23);
  const top = putOnTopOfDeck(ally.state, P1, CLOBBER);
  const team = theCard(top.state, MISSION_TEAM);
  const run = driveEventsPicking(
    CAMPAIGN_DEPS,
    top.state,
    attempting(() => [[top.ids[0]!, ally.ids[0]!]], pick),
    use(P1, team, MISSION_TEAM_ACTION),
  );
  return { ...run, before: top.state, mission: card, team, ally: ally.ids[0]! };
}
const hand = (state: GameState, player: (typeof SEATS)[number]) => playerOf(state, player).hand;
const codesIn = (state: GameState, ids: readonly InstanceId[]) => ids.map((id) => inst(state, id).cardId as string);

describe("§3.40 how a mission ends", () => {
  it("defeated: one `schemeDefeated` for the a face (what the campaign's `cardsDefeated { name }` reads), the When Defeated once, Mission Team flipped and in play, the [FINISHED] face removed from the game last", () => {
    const run = defeated("45167");
    expect(of(run.events, "schemeDefeated")).toMatchObject([{ instanceId: run.mission, cardId: "45167a" }]);
    expect(resolved(run.events, "45167a.when-defeated")).toBe(1);
    expect(resolved(run.events, refOf("45167", "a"))).toBe(0);
    expect(resolved(run.events, refOf("45167", "b"))).toBe(1);
    expect(inst(run.state, run.team)).toMatchObject({ flipped: true, exhausted: true });
    expect(cardsInPlay(run.state)).toContain(run.team);
    expect(playerOf(run.state, P1).deck).toContain(run.ally);
    expect(locateCard(run.state, run.mission)).toEqual({ kind: "removedFromGame" });
    expect(atTheMission(run.state)).toEqual([]);
    // The face flipped inside the mission area and stayed there until its own text removed it.
    const moves = of(run.events, "cardMoved").filter((e) => e.instanceId === run.mission);
    expect(moves.map((e) => e.to.kind)).toEqual(["removedFromGame"]);
  });

  it("failed: no `schemeDefeated`; Mission Team is removed from the game though it cannot be discarded; the fourth counter is placed first", () => {
    const run = failed("45167");
    expect(of(run.events, "schemeDefeated")).toEqual([]);
    expect(resolved(run.events, refOf("45167", "a"))).toBe(1);
    expect(resolved(run.events, "45167a.when-defeated")).toBe(0);
    expect(locateCard(run.state, run.team)).toEqual({ kind: "removedFromGame" });
    expect(of(run.events, "leavePlayBlocked")).toEqual([]);
    expect(locateCard(run.state, run.mission)).toEqual({ kind: "removedFromGame" });
    expect(resolved(run.events, refOf("45167", "b"))).toBe(1);
  });

  it("test 3: failed with allies, the Overseer and an Agent of Apocalypse at the mission: the allies take the Forced Response's 1 damage, then every card there is removed from the game, in no discard pile and not in the victory display", () => {
    const game = campaignGame({
      deck: [X23, RANDALL, CROWN, CROWN],
      encounter: [AGENT],
      mission: { mission: "45167a", overseer: SUGAR_MAN, team: true },
    });
    const allies = atMission(game, P1, X23, RANDALL);
    const agent = encounterCardAtMission(allies.state, AGENT);
    const mission = theCard(agent.state, "45167a");
    const sugarMan = theCard(agent.state, SUGAR_MAN);
    const before = putOnTopOfDeck(patchInstance(agent.state, mission, { counters: { attempt: 3 } }), P1, CROWN, CROWN);
    const run = driveEventsPicking(
      CAMPAIGN_DEPS,
      before.state,
      attempting(() => []),
      use(P1, theCard(before.state, MISSION_TEAM), MISSION_TEAM_ACTION),
    );
    expect(of(run.events, "damageDealt").filter((e) => allies.ids.includes(e.targetInstanceId))).toHaveLength(2);
    for (const id of [...allies.ids, sugarMan, agent.id, mission]) {
      expect(locateCard(run.state, id), id).toEqual({ kind: "removedFromGame" });
      expect(run.state.victoryDisplay).not.toContain(id);
    }
    expect(playerOf(run.state, P1).discard).not.toContain(allies.ids[0]);
    expect(of(run.events, "characterDefeated")).toEqual([]);
    expect(atTheMission(run.state)).toEqual([]);
  });

  it("test 2: the mission at 2 threat with Sugar Man alive goes to 0 and stays in play with one counter; a later attempt that defeats Sugar Man in step 4 defeats the mission then: step 5 removes nothing and no counter is placed", () => {
    const game = campaignGame({
      deck: [X23, RANDALL, CLOBBER, BLOODGEM, CROWN, CROWN],
      mission: { mission: "45167a", overseer: SUGAR_MAN, team: true },
    });
    const allies = atMission(game, P1, RANDALL, X23);
    const [randall, x23] = allies.ids as [InstanceId, InstanceId];
    const mission = theCard(allies.state, "45167a");
    const sugarMan = theCard(allies.state, SUGAR_MAN);
    const team = theCard(allies.state, MISSION_TEAM);
    const top = putOnTopOfDeck(patchInstance(allies.state, mission, { threat: 2 }), P1, CROWN, CLOBBER);
    // Randall (ATK 1, THW 2) and X-23 (ATK 3, THW 1): pool 4 of Sugar Man's 5, THW 3 against 2 threat.
    const first = driveEventsPicking(
      CAMPAIGN_DEPS,
      top.state,
      attempting(() => [
        [top.ids[0]!, randall],
        [top.ids[1]!, x23],
      ]),
      use(P1, team, MISSION_TEAM_ACTION),
    );
    expect(inst(first.state, sugarMan).damage).toBe(4);
    expect(inst(first.state, mission)).toMatchObject({ cardId: "45167a", threat: 0, counters: { attempt: 1 } });
    expect(cardsInPlay(first.state)).toContain(mission);
    expect(of(first.events, "schemeDefeated")).toEqual([]);

    // A [wild] card for X-23 this time: a [physical] one would heal Sugar Man 3 first (his Mission Response).
    const ready = patchInstance(first.state, team, { exhausted: false });
    const again = putOnTopOfDeck(ready, P1, BLOODGEM, CROWN);
    const second = driveEventsPicking(
      CAMPAIGN_DEPS,
      again.state,
      attempting(() => [[again.ids[0]!, x23]]),
      use(P1, team, MISSION_TEAM_ACTION),
    );
    expect(locateCard(second.state, sugarMan)).toEqual({ kind: "victoryDisplay" });
    expect(of(second.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([mission]);
    // The defeat came from the state check as the last minion left, before step 5.
    const defeat = second.events.findIndex((e) => e.type === "schemeDefeated");
    const pool = second.events.findIndex((e) => e.type === "damagePoolResolved");
    expect(defeat).toBeLessThan(pool);
    expect(of(second.events, "threatRemoved").filter((e) => e.schemeInstanceId === mission)).toEqual([]);
    expect(resolved(second.events, refOf("45167", "a"))).toBe(0);
    expect(resolved(second.events, refOf("45167", "b"))).toBe(1);
    expect(inst(second.state, team).flipped).toBe(true);
  });

  it("test 8: the fourth attempt can still succeed: three counters, 1 threat, no minion, X-23 matched: defeated, Mission Team shows [FINISHED], no fourth counter", () => {
    const run = defeated("45167", {}, firstLegal, (game) =>
      patchInstance(game, theCard(game, "45167a"), { counters: { attempt: 3 } }),
    );
    expect(of(run.events, "schemeDefeated")).toHaveLength(1);
    expect(resolved(run.events, refOf("45167", "a"))).toBe(0);
    expect(inst(run.state, run.team).flipped).toBe(true);
    expect(cardsInPlay(run.state)).toContain(run.team);
  });
});

describe("§3.40 the five [FINISHED] faces", () => {
  it.each(Object.keys(REFS))(
    "%s: failed, the a face's Forced Response then the b face's resolve once each; defeated, the When Defeated then the b face's",
    (mission) => {
      const setAside = [DESPERATE_MEASURES, ...CAMPAIGN_ALLIES];
      const lost = failed(mission, { setAside, encounter: [SEA_WALL] });
      expect(resolved(lost.events, REFS[mission]!.a)).toBe(1);
      expect(resolved(lost.events, REFS[mission]!.defeated)).toBe(0);
      expect(resolved(lost.events, REFS[mission]!.b)).toBe(1);
      const won = defeated(mission, { setAside, encounter: [SEA_WALL] });
      expect(resolved(won.events, REFS[mission]!.a)).toBe(0);
      expect(resolved(won.events, REFS[mission]!.defeated)).toBe(1);
      expect(resolved(won.events, REFS[mission]!.b)).toBe(1);
      expect(locateCard(won.state, won.mission)).toEqual({ kind: "removedFromGame" });
      expect(inst(won.state, won.team).flipped).toBe(true);
    },
  );

  it("test 4, Evacuate Survivors, 2 players. Failed: each player has 1 facedown encounter card. Defeated: each searches their deck and discard pile for 1 card", () => {
    const lost = failed("45167", { players: 2 });
    for (const seat of [P1, P2]) {
      expect(playerOf(lost.state, seat).dealtEncounter.length - playerOf(lost.before, seat).dealtEncounter.length).toBe(
        1,
      );
    }
    const won = defeated("45167", { players: 2 });
    for (const seat of [P1, P2]) expect(hand(won.state, seat).length - hand(won.before, seat).length).toBe(1);
  });

  it("test 5, Liberate the Seattle Core, 3 players. Failed: 6 threat on the main scheme. Defeated: each player has 1 Desperate Measures in hand and one copy is still set aside", () => {
    const setAside = [DESPERATE_MEASURES, DESPERATE_MEASURES, DESPERATE_MEASURES, DESPERATE_MEASURES];
    const lost = failed("45166", { players: 3, setAside });
    expect(mainThreat(lost.state) - mainThreat(lost.before)).toBe(6);
    const won = defeated("45166", { players: 3, setAside });
    expect(mainThreat(won.state)).toBe(mainThreat(won.before));
    for (const seat of SEATS) {
      const gained = hand(won.state, seat).filter((id) => !hand(won.before, seat).includes(id));
      expect(codesIn(won.state, gained)).toEqual([DESPERATE_MEASURES]);
      expect(inst(won.state, gained[0]!).ownerId).toBe(seat);
    }
    expect(codesIn(won.state, won.state.encounterSetAside).filter((c) => c === DESPERATE_MEASURES)).toHaveLength(1);
  });

  it("Sabotage the Sea Wall. Failed: North American Sea Wall is found and revealed (2 + 2 per player threat). Defeated: it is removed from the game and each player deals 3 damage to an enemy", () => {
    const lost = failed("45168", { encounter: [SEA_WALL] });
    const wall = theCard(lost.state, SEA_WALL);
    expect(cardsInPlay(lost.state)).toContain(wall);
    expect(inst(lost.state, wall).threat).toBe(4);

    const won = defeated(
      "45168",
      { encounter: [SEA_WALL] },
      firstLegal,
      (game) => encounterCardInVillainArea(game, SEA_WALL).state,
    );
    const removed = theCard(won.state, SEA_WALL);
    // In play before, with "The villain cannot take damage" in force; gone first, so the 3 damage lands.
    expect(cardsInPlay(won.before)).toContain(removed);
    expect(locateCard(won.state, removed)).toEqual({ kind: "removedFromGame" });
    expect(won.state.victoryDisplay).not.toContain(removed);
    expect(of(won.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([won.mission]);
    const villain = activeVillain(won.state)!.instanceId;
    expect(inst(won.state, villain).damage - inst(won.before, villain).damage).toBe(3);
  });

  it("test 6, Find Lost Mutants, 2 players. Failed: each player discards 1 card from their hand. Defeated: each has one campaign ally in hand, two stay set aside, and the ally's 'enters your hand' Response is offered", () => {
    const lost = failed("45169", { players: 2 });
    for (const seat of [P1, P2]) expect(hand(lost.before, seat).length - hand(lost.state, seat).length).toBe(1);

    const accept: Picker = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") return choice.options.slice(0, 1).map((o) => o.optionId);
      return firstLegal(state);
    };
    const won = defeated("45169", { players: 2, setAside: CAMPAIGN_ALLIES }, accept);
    const gained = [P1, P2].map((seat) => hand(won.state, seat).filter((id) => !hand(won.before, seat).includes(id)));
    expect(gained.map((ids) => ids.length)).toEqual([1, 1]);
    const taken = gained.flatMap((ids) => codesIn(won.state, ids));
    expect(taken.every((code) => CAMPAIGN_ALLIES.includes(code))).toBe(true);
    expect(new Set(taken).size).toBe(2);
    expect(codesIn(won.state, won.state.encounterSetAside).filter((c) => CAMPAIGN_ALLIES.includes(c))).toHaveLength(2);
    // Each ally's "Response: After [this ally] enters your hand" was offered and, accepted, resolved.
    const responses = won.events.filter(
      (e) => e.type === "abilityResolved" && /^4517[2-5]\..*-response$/.test(e.abilityId as string),
    );
    expect(responses).toHaveLength(2);
  });

  it("test 7, Protect the Professor. Failed: the players lose the game at once. Defeated: each player searches their deck and discard pile for an ally", () => {
    const lost = failed("45170");
    expect(lost.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });

    const won = defeated("45170");
    expect(won.state.outcome).toBeFalsy();
    const gained = hand(won.state, P1).filter((id) => !hand(won.before, P1).includes(id));
    expect(gained).toHaveLength(1);
    expect(won.state.cardPool[inst(won.state, gained[0]!).cardId]?.type).toBe("ally");
  });
});
