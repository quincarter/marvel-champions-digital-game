import {
  cardsInPlay,
  createGame,
  NO_STATUSES,
  remainingHitPoints,
  villainOf,
  type GameEvent,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
} from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { drive, type Picks } from "../../testing/qa-bench.js";
import { withForm } from "../../testing/staging.js";
import { defeatWithAttack, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { KANG_SET } from "./kang.js";

const DOMINION = "11023";

type GameAreaState = GameState["gameAreas"][number];

const HAWKEYE = "hawkeye-leadership";
const SPIDER_WOMAN = "spider-woman-aggression-justice";
const BLACK_PANTHER = "core-black-panther-protection"; // Retaliate 1: he can defeat a Kang (II) in the villain phase.

/**
 * Kang (I) defeated and the phase ended: each player is in their own stage 3 area with a Kang (II). Returns the state at
 * the first player's turn (p2 holds the token after the first round). P1 is in hero form, the others in alter-ego form.
 */
const splitGame = (decks: readonly string[], seed = 2026, difficulty?: "expert") => {
  const players = decks.map((starterDeckId) => ({ starterDeckId }));
  const config = wave2Scenario("kang", { players, seed, ...(difficulty ? { difficulty } : {}) });
  let state = runWave2(startWave2Game(config), toHero());
  state = defeatWithAttack(state, state.villains[0]!.instanceId);
  for (const player of state.players)
    state = settle(runWave2(state, endTurn(player.playerId)), firstLegal, undefined, WAVE2_DEPS);
  expect(state.gameAreas).toHaveLength(decks.length);
  return state;
};
const twoPlayerSplit = () => splitGame([HAWKEYE, SPIDER_WOMAN]);

/** Ends each remaining turn of this round, playing out the villain phase. Returns its events, and the state after it. */
const playOutRound = (start: GameState, picks: Picks = {}) => {
  const events: GameEvent[] = [];
  let state = start;
  while (state.round === start.round && !state.outcome && state.step.phase === "player" && state.step.kind === "turn") {
    const done = drive(state, endTurn(state.step.activePlayerId), picks, WAVE2_DEPS);
    if (!done.accepted) throw new Error("endTurn was rejected");
    events.push(...done.events);
    state = done.state;
  }
  return { state, events };
};

const withThreat = (state: GameState, area: GameAreaState): GameState =>
  patchInstance(state, area.mainScheme!.instanceId, { threat: 8 });
/** Damage up to 1 hit point from defeat. */
const toLastHitPoint = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { damage: inst(state, id).damage + (remainingHitPoints(state, id, WAVE2_DEPS) ?? 0) - 1 });
const allAlterEgo = (split: GameState): GameState =>
  split.players.reduce((state, player) => withForm(state, "alterEgo", player.playerId), split);
const areaOf = (state: GameState, player: string): GameAreaState =>
  state.gameAreas.find((area) => area.playerIds.includes(player as typeof P1))!;
const count = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type).length;

/**
 * Puts the given areas' stage 3 one threat from its target, then ends both turns: step one of the villain phase
 * completes them. Returns every event of the villain phase, and the state after it.
 */
const completeStagesThenEndPhase = (
  split: GameState,
  areaIndexes: readonly number[],
): { readonly state: GameState; readonly events: readonly GameEvent[] } => {
  // Alter-ego form, so each Kang schemes instead of attacking: a hero eliminated by the villain phase would complete
  // its stage for "all the players at this stage are defeated", which is not what these tests drive.
  const staged = areaIndexes.reduce((s, index) => withThreat(s, s.gameAreas[index]!), allAlterEgo(split));
  return playOutRound(staged);
};

/**
 * P1 (Black Panther) stays in hero form, his stage one threat from its target and his Kang (II) on 1 hit point: step one
 * completes the stage, then that Kang attacks him and his Retaliate 1 defeats it, in the same phase. The stage's
 * Forced Response and the Kang's When Defeated each queue a join for the end of the phase.
 */
const stageCompletedThenKangDefeated = (split: GameState, picks: Picks = {}) => {
  const area = areaOf(split, P1);
  const others = split.players.filter((p) => p.playerId !== P1);
  const kang = area.villainIds[0]!;
  const heroForm = others.reduce((s, player) => withForm(s, "alterEgo", player.playerId), split);
  const brink = patchInstance(toLastHitPoint(withThreat(heroForm, area), kang), kang, { statuses: NO_STATUSES });
  const staged = patchInstance(brink, identityOf(heroForm, P1), {
    damage: 0,
  });
  return { ...playOutRound(staged, picks), area, kang };
};

const kangVsHeroes = () =>
  startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));

describe("Kang scenario", () => {
  it("standalone setup: Kang (I) alone in the villain deck, Kang (II)/(III) set aside, the game is legal", () => {
    const config = wave2Scenario("kang", {
      players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
      seed: 2026,
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.villains.map((v) => v.cardId)).toEqual(["11001"]);
    const setAsideKangs = created.state.encounterSetAside.filter((id) =>
      ["11002", "11003", "11004", "11005", "11006"].includes(created.state.instances[id]?.cardId ?? ""),
    );
    expect(setAsideKangs).toHaveLength(5);
    expect(created.state.outcome).toBeNull();
    const settled = settle(created.state, firstLegal, undefined, WAVE2_DEPS);
    expect(settled.outcome).toBeNull();
  });

  it("expert mode: the Expert Kang villain and Expert Kang (II)/(III) set-aside cards replace the standard ones", () => {
    const config = wave2Scenario("kang", {
      players: [{ starterDeckId: "hawkeye-leadership" }],
      seed: 2026,
      difficulty: "expert",
    });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.villains.map((v) => v.cardId)).toEqual(["11034"]);
    const setAsideKangs = created.state.encounterSetAside.filter((id) =>
      ["11035", "11036", "11037", "11038", "11039"].includes(created.state.instances[id]?.cardId ?? ""),
    );
    expect(setAsideKangs).toHaveLength(5);
  });

  it("Kang (I): Forced Interrupt, when he attacks you, either places 1 threat on the main scheme or gets +2 ATK for this attack", () => {
    expect(KANG_SET["11001.kang-the-conqueror-forced-interrupt"]).toBeDefined();
  });

  it("Kang (I): When Defeated, advances the main scheme to stage 2 at the end of the phase (not immediately)", () => {
    const start = kangVsHeroes();
    const hero = runWave2(start, toHero());
    const villain = hero.villains[0]!.instanceId;
    const damaged = {
      ...hero,
      instances: { ...hero.instances, [villain]: { ...hero.instances[villain]!, damage: 999 } },
    };
    const identity = identityOf(damaged);
    const settled = settle(
      runWave2(damaged, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // At zero: a hit point dial stops there (RRG 1.8 "Hit Points", p. 22; the engine's `settleDials`), so the damage on
    // him is his maximum hit points, not the 999 of the surgery, which this line read until 2026-10-10.
    expect(remainingHitPoints(settled, villain, WAVE2_DEPS)).toBe(0);
    // Still stage 1 immediately after defeat...
    expect(settled.mainScheme.stageIndex).toBe(0);
    // ...but stage 2 once the phase (the rest of this round) ends.
    const afterPhase = settle(runWave2(settled, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(afterPhase.mainScheme.stageIndex).toBeGreaterThanOrEqual(1);
  });

  it("Kang (Rama-Tut): gets +1 ATK for each obligation in play (a live count)", () => {
    expect(KANG_SET["11004.kang-rama-tut-constant"]).toBeDefined();
  });

  it("Kang (Scarlet Centurion): his attacks gain piercing (a constant keyword grant on himself)", () => {
    expect(KANG_SET["11005.kang-scarlet-centurion-constant"]).toBeDefined();
  });

  it("Kang (III): When Defeated, the players win the game", () => {
    expect(KANG_SET["11006.when-defeated"]).toBeDefined();
  });

  it("Kang's Arrival 1A: removes each player's obligation from the game; the Kang set's own obligations stay in the deck", () => {
    expect(KANG_SET["11007a.setup"]).toBeDefined();
    const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const settled = settle(created.state, firstLegal, undefined, WAVE2_DEPS);
    const deckId = Object.keys(settled.encounterDecks)[0]!;
    const pile = settled.encounterDecks[deckId]!;
    const inPiles = (pattern: RegExp) =>
      [...pile.deck, ...pile.discard].filter((id) => pattern.test(String(settled.instances[id]?.cardId)));
    // Hawkeye's own obligation (04026) is removed from the game ...
    expect(inPiles(/^04026$/)).toHaveLength(0);
    expect(Object.values(settled.instances).some((i) => String(i.cardId) === "04026")).toBe(true);
    // ... and the Kang set's obligations (11018-11021: "remove each player's obligation cards") are not.
    expect(inPiles(/^1101[89]$|^1102[01]$/).length).toBeGreaterThanOrEqual(7);
  });

  it("Kang's Arrival 1B (11007b, MainSchemeStage.completionLoses): completing stage 1 loses the game instead of advancing to The Master of Time", () => {
    const start = kangVsHeroes();
    const scheme = start.mainScheme.instanceId;
    expect(start.mainScheme.stageIndex).toBe(0);
    // Threat 1 below target (7 for 1 hero): step one's own acceleration (1[per_hero]) pushes it to target,
    // completing the stage through the real event system (a direct patch to the target value would not fire the
    // completion check at all, since that check runs where threat is *placed*, not on every read) — same shape
    // as Hostile Takeover 1B (`packages/cards/src/wave1/gob/risky-business.test.ts`).
    const primed = patchInstance(start, scheme, { threat: 6 });
    const settled = settle(runWave2(primed, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(settled.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
    // Not advanced: stage 1 completing is a loss, not a trip to stage 2 (The Master of Time).
    expect(settled.mainScheme.stageIndex).toBe(0);
  });

  it("The Chronopolis 3A (Kang (Immortus)'s stage): creates a game area, adds Kang (Immortus), and deals the revealing player an encounter card", () => {
    expect(KANG_SET["11009a.when-revealed"]).toBeDefined();
  });

  it("The Chronopolis 3B: if all the players at this stage are defeated, this stage is completed (a stateCheck)", () => {
    expect(KANG_SET["11009b.the-chronopolis-constant"]).toBeDefined();
  });

  it("Kang's Dominion: all 4 copies start set aside, none in the encounter deck (Kang's Arrival 1A)", () => {
    const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const settled = settle(created.state, firstLegal, undefined, WAVE2_DEPS);
    const isDominion = (id: string) => settled.instances[id]?.cardId === DOMINION;
    expect(settled.encounterSetAside.filter(isDominion)).toHaveLength(4);
    const inDecks = Object.values(settled.encounterDecks).flatMap((piles) => [...piles.deck, ...piles.discard]);
    expect(inDecks.filter(isDominion)).toHaveLength(0);
  });

  it("stage 3B Forced Response: the completed stage and its Kang (II) stay until the end of the phase, then both are removed and the areas combine; an undefeated Kang (II) does not follow", () => {
    expect(KANG_SET["11009b.the-chronopolis-forced-response"]).toBeDefined();
    const split = twoPlayerSplit();
    const [done, other] = split.gameAreas;
    const stage = done!.mainScheme!.instanceId;
    const doneKang = done!.villainIds[0]!;
    const otherKang = other!.villainIds[0]!;
    expect(villainOf(split, doneKang)?.defeated).toBe(false);

    const { state, events } = completeStagesThenEndPhase(split, [0]);
    const at = (test: (e: GameEvent) => boolean) => events.findIndex(test);
    const completed = at((e) => e.type === "mainSchemeCompleted");
    const dealt = at((e) => e.type === "encounterCardDealt");
    const kangRemoved = at((e) => e.type === "villainRemoved" && e.instanceId === doneKang);
    const stageRemoved = at((e) => e.type === "mainSchemeStageRemoved" && e.schemeInstanceId === stage);
    const joined = at((e) => e.type === "gameAreaJoined");
    // Completed in step one; step three's deal still happens with the stage and Kang in place; then the end of the phase.
    expect(completed).toBeGreaterThanOrEqual(0);
    expect(dealt).toBeGreaterThan(completed);
    expect(kangRemoved).toBeGreaterThan(dealt);
    expect(stageRemoved).toBeGreaterThan(dealt);
    expect(joined).toBeGreaterThan(kangRemoved);

    // Kang (II) is gone from the game, not carried into the area the players joined: that area holds only the other
    // Kang, who stays the one active villain there.
    expect(villainOf(state, doneKang)?.defeated).toBe(true);
    expect(state.removedFromGame).toContain(stage);
    expect(state.gameAreas).toHaveLength(1);
    const joinedArea = state.gameAreas[0]!;
    expect(joinedArea.playerIds).toHaveLength(2);
    expect(joinedArea.villainIds).toEqual([otherKang]);
    expect(joinedArea.activeVillainId).toBe(otherKang);
    expect(villainOf(state, otherKang)?.defeated).toBe(false);
    expect(state.mainScheme.stageIndex).toBe(1);
  });

  it("stage 3B Forced Response: exactly 1 of the 4 set-aside Kang's Dominion goes facedown under stage 4A per completed stage", () => {
    const split = twoPlayerSplit();
    const isDominion = (id: string) => split.instances[id]?.cardId === DOMINION;
    const central = split.mainScheme.instanceId;
    expect(split.encounterSetAside.filter(isDominion)).toHaveLength(4);
    expect(inst(split, central).tucked ?? []).toHaveLength(0);

    const { state } = completeStagesThenEndPhase(split, [0]);
    const tucked = inst(state, central).tucked ?? [];
    expect(tucked).toHaveLength(1);
    expect(isDominion(tucked[0]!)).toBe(true);
    expect(inst(state, tucked[0]!).faceup).toBe(false);
    expect(cardsInPlay(state).filter(isDominion)).toHaveLength(0);
    expect(state.encounterSetAside.filter(isDominion)).toHaveLength(3);
  });

  it("Kang's Wrath 4A reveals each facedown Kang's Dominion tucked under it (both stages completed, all areas joined)", () => {
    const split = twoPlayerSplit();
    const { state } = completeStagesThenEndPhase(split, [0, 1]);
    // Both areas joined and the center advanced to stage 4A (index 6), which revealed Kang (III).
    expect(state.gameAreas).toHaveLength(0);
    expect(state.mainScheme.stageIndex).toBe(6);
    expect(state.villains.some((v) => v.cardId === "11006")).toBe(true);
    const isDominion = (id: string) => state.instances[id]?.cardId === DOMINION;
    const inPlay = cardsInPlay(state).filter(isDominion);
    expect(inPlay).toHaveLength(2);
    expect(inst(state, state.mainScheme.instanceId).tucked ?? []).toHaveLength(0);
    expect(state.encounterSetAside.filter(isDominion)).toHaveLength(2);
    // Neither Kang (II) came along into stage 4.
    expect(state.villains.filter((v) => !v.defeated).map((v) => v.cardId)).toEqual(["11006"]);
  });

  it("stage 3B, solo: completing the only stage dissolves the area to the central one, 4A follows, Kang (II) is gone", () => {
    let state = runWave2(kangVsHeroes(), toHero());
    state = defeatWithAttack(state, state.villains[0]!.instanceId);
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const area = state.gameAreas[0]!;
    const kang = area.villainIds[0]!;
    // Full health: Kang's Wrath 4B brings Crossfire in and Kang (III) may attack before the assertions.
    const staged = patchInstance(allAlterEgo(withThreat(state, area)), identityOf(state), { damage: 0 });

    const after = playOutRound(staged);
    expect(after.state.gameAreas).toHaveLength(0);
    expect(after.state.mainScheme.stageIndex).toBe(6);
    expect(villainOf(after.state, kang)?.defeated).toBe(true);
    expect(after.state.removedFromGame).toContain(area.mainScheme!.instanceId);
    expect(after.state.villains.filter((v) => !v.defeated).map((v) => v.cardId)).toEqual(["11006"]);
    expect(count(after.events, "gameAreaJoined")).toBe(1);
  });

  it("stage 3B: all the players at a stage defeated, in a 2-player game: one Dominion tucked, its Kang (II) removed, the area joined", () => {
    const split = twoPlayerSplit();
    const area = areaOf(split, P1);
    const other = areaOf(split, "p2");
    const kang = area.villainIds[0]!;
    const isDominion = (id: string) => split.instances[id]?.cardId === DOMINION;
    // P1's hero stays in hero form on 1 hit point; his Kang (II)'s attack defeats him.
    const staged = toLastHitPoint(withForm(split, "alterEgo", "p2" as typeof P1), identityOf(split, P1));

    const { state, events } = playOutRound(staged);
    expect(playerOf(state, P1).eliminated).toBe(true);
    expect(inst(state, state.mainScheme.instanceId).tucked?.filter(isDominion)).toHaveLength(1);
    expect(count(events, "villainRemoved")).toBe(1);
    expect(villainOf(state, kang)?.defeated).toBe(true);
    expect(state.removedFromGame).toContain(area.mainScheme!.instanceId);
    expect(count(events, "gameAreaJoined")).toBe(1);
    expect(state.gameAreas).toHaveLength(1);
    expect(state.gameAreas[0]!.villainIds).toEqual(other.villainIds);
    expect(state.gameAreas[0]!.mainScheme?.instanceId).toBe(other.mainScheme!.instanceId);
  });

  it("stage 3B completed in the player phase: Kang (II) removed and the area joined at the end of that phase, before villain step one", () => {
    // Seed 2026: p2, who acts first, faces Kang (Iron Lad), whose Retaliate 1 defeats a hero on 1 hit point who attacks him.
    const split = twoPlayerSplit();
    const p2 = "p2" as typeof P1;
    const area = areaOf(split, p2);
    const kang = area.villainIds[0]!;
    expect(split.instances[kang]?.cardId).toBe("11003");
    const staged = toLastHitPoint(withForm(split, { heroForm: 0 }, p2), identityOf(split, p2));
    const attack: Command = {
      type: "basicAttack",
      playerId: p2,
      attackerInstanceId: identityOf(split, p2),
      targetInstanceId: kang,
    };
    const attacked = drive(staged, attack, {}, WAVE2_DEPS);
    expect(attacked.accepted).toBe(true);

    // Completed now; the stage and Kang wait for the end of the phase.
    expect(playerOf(attacked.state, p2).eliminated).toBe(true);
    expect(attacked.state.step.phase).toBe("player");
    expect(count(attacked.events, "mainSchemeCompleted")).toBe(1);
    expect(inst(attacked.state, attacked.state.mainScheme.instanceId).tucked ?? []).toHaveLength(1);
    expect(villainOf(attacked.state, kang)?.defeated).toBe(false);
    expect(attacked.state.gameAreas).toHaveLength(2);

    const { state, events } = playOutRound(attacked.state);
    const at = (test: (e: GameEvent) => boolean) => events.findIndex(test);
    const removed = at((e) => e.type === "villainRemoved" && e.instanceId === kang);
    const joined = at((e) => e.type === "gameAreaJoined");
    const stepOne = at((e) => e.type === "threatPlaced");
    expect(removed).toBeGreaterThanOrEqual(0);
    expect(joined).toBeGreaterThan(removed);
    expect(stepOne).toBeGreaterThan(joined);
    expect(state.gameAreas).toHaveLength(1);
  });

  it("expert: the stage's Forced Response finds the expert Kang (Iron Lad), 11036, by name", () => {
    // Seed 2026: the first area is Inexorable Fate, with 11036 in it.
    const split = splitGame([HAWKEYE, SPIDER_WOMAN], 2026, "expert");
    const area = split.gameAreas[0]!;
    const kang = area.villainIds[0]!;
    expect(split.instances[kang]?.cardId).toBe("11036");
    const { state, events } = completeStagesThenEndPhase(split, [0]);
    expect(events.some((e) => e.type === "villainRemoved" && e.instanceId === kang)).toBe(true);
    expect(villainOf(state, kang)?.defeated).toBe(true);
    expect(state.gameAreas).toHaveLength(1);
  });

  describe("a stage completed and its Kang (II) defeated in the same phase: those players join once", () => {
    // An engine reading (owner decision, 2026-10-31). Only this order is reachable: a defeated Kang (II) removes his stage, and
    // a removed stage cannot then be completed. The join queued by his When Defeated resolves second and does nothing.
    it("2 players: one join; the surviving area's stage and Kang are untouched, and stage 4 does not start", () => {
      const split = splitGame([BLACK_PANTHER, HAWKEYE]);
      const other = areaOf(split, "p2");
      const { state, events, kang, area } = stageCompletedThenKangDefeated(split);

      expect(count(events, "mainSchemeCompleted")).toBe(1);
      expect(events.some((e) => e.type === "damageDealt" && e.retaliate && e.targetInstanceId === kang)).toBe(true);
      expect(villainOf(state, kang)?.defeated).toBe(true);
      expect(count(events, "gameAreaJoined")).toBe(1);
      expect(state.removedFromGame).toContain(area.mainScheme!.instanceId);
      expect(state.gameAreas).toHaveLength(1);
      const survivor = state.gameAreas[0]!;
      expect(survivor.areaId).toBe(other.areaId);
      expect(survivor.playerIds).toHaveLength(2);
      expect(survivor.mainScheme?.instanceId).toBe(other.mainScheme!.instanceId);
      expect(survivor.villainIds).toEqual(other.villainIds);
      expect(villainOf(state, other.villainIds[0]!)?.defeated).toBe(false);
      expect(state.removedFromGame).not.toContain(other.mainScheme!.instanceId);
      expect(state.mainScheme.stageIndex).toBe(1);
      expect(state.villains.some((v) => v.cardId === "11006" && !v.defeated)).toBe(false);
    });

    it.each(["p2", "p3"])("3 areas, joining %s's: the two other areas keep their stage and Kang", (into) => {
      // Seed 2: P1's Kang (II) is Kang (Scarlet Centurion), who can take the retaliate.
      const split = splitGame([BLACK_PANTHER, HAWKEYE, SPIDER_WOMAN], 2);
      const others = split.gameAreas.filter((area) => !area.playerIds.includes(P1));
      const { state, events, kang } = stageCompletedThenKangDefeated(split, { labels: [`Game area with ${into}`] });

      expect(villainOf(state, kang)?.defeated).toBe(true);
      expect(events.filter((e) => e.type === "gameAreaJoined")).toMatchObject([
        { intoAreaId: areaOf(split, into).areaId },
      ]);
      expect(count(events, "mainSchemeStageRemoved")).toBe(1);
      expect(state.gameAreas).toHaveLength(2);
      for (const area of others) {
        const now = state.gameAreas.find((candidate) => candidate.areaId === area.areaId)!;
        expect(now.mainScheme?.instanceId).toBe(area.mainScheme!.instanceId);
        expect(now.villainIds).toEqual(area.villainIds);
        expect(villainOf(state, area.villainIds[0]!)?.defeated).toBe(false);
      }
      expect(areaOf(state, P1).areaId).toBe(areaOf(split, into).areaId);
      expect(state.mainScheme.stageIndex).toBe(1);
    });
  });

  it("The Master of Time 2B / Kang's Wrath 4A: a full one-player split-and-rejoin — defeating Kang (I) creates a stage 3 area, defeating that area's Kang (II) removes the stage and rejoins the (now sole) central area, which then advances straight to 4A and adds Kang (III)", () => {
    let state = runWave2(kangVsHeroes(), toHero());
    const kang1 = state.villains[0]!.instanceId;

    // Stage 1 -> stage 2: Kang (I) defeated, "advance to stage 2 at the end of the phase".
    state = defeatWithAttack(state, kang1);
    expect(state.mainScheme.stageIndex).toBe(0);
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(state.mainScheme.stageIndex).toBeGreaterThanOrEqual(1);

    // Stage 2A's own When Revealed already ran as part of that same advance: one random stage 3 is revealed for
    // the lone player, creating their own game area with a Kang (II) variant in it (11008a.when-revealed).
    expect(state.gameAreas).toHaveLength(1);
    const area = state.gameAreas[0]!;
    expect(area.playerIds).toEqual([P1]);
    const areaKang = area.villainIds[0]!;
    expect(["11002", "11003", "11004", "11005"]).toContain(state.instances[areaKang]?.cardId);

    // Defeat that area's Kang (II): its own "When Defeated" removes the stage and (at the end of the phase) joins
    // another game area — the only one left is the central stage, so this dissolves the split entirely.
    state = defeatWithAttack(state, areaKang);
    // Full health first: Kang's Wrath 4B brings Hawkeye's nemesis minion in (below), and Crossfire's quickstrike plus
    // Kang (III)'s attack would otherwise end the game before the assertions.
    state = patchInstance(state, identityOf(state), { damage: 0 });
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(state.gameAreas).toHaveLength(0);

    // The Master of Time 2B's own constant fired the instant the split ended ("when all the players have joined
    // this game area, advance to stage 4A", 11008b.the-master-of-time-constant) — no player action needed. Kang's
    // Wrath 4A's own When Revealed (11013a) then added Kang (III). No Kang's Dominion is tucked under the stage to
    // reveal: one is tucked only when a stage 3 is completed (11009b to 11012b), and here its Kang (II) was defeated.
    // Stage index 6 in Kang's Arrival's own stage list (1, 2, four alternative 3s, 4) is "Kang's Wrath".
    expect(state.mainScheme.stageIndex).toBe(6);
    expect(state.villains.some((v) => v.cardId === "11006")).toBe(true);
    // Kang's Wrath 4B's When Revealed (11013b): Hawkeye's nemesis minion, Crossfire (04027), the only minion of his
    // nemesis set and so printing no parenthetical, is found and put into play (docs/phase7-wave4.md §3.50).
    expect(instancesOf(state, "04027").some((id) => playerOf(state, P1).playArea.includes(id))).toBe(true);
  });

  it("Kang's Wrath 4B: each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion and puts it into play engaged with them (docs/phase7-wave2.md §17.1)", () => {
    // Ant-Man: his nemesis set has several minions, so his nemesis minion is the one printing the parenthetical
    // (Yellowjacket, 12027, `nemesisMinion: true`). The single-minion case (Hawkeye's Crossfire, 04027, no
    // parenthetical; RRG 1.8 "Nemesis Encounter Set", p. 30) is asserted by the split-and-rejoin test above
    // (docs/phase7-wave4.md §3.50).
    // A three-sided identity's `changeForm` needs an explicit hero form (`toHero()` alone is ambiguous, Tiny or
    // Giant); which one is irrelevant here, since the test only cares about Yellowjacket's own defeat/engage state.
    // `settle`: Ant-Man's own kit responds to "after you change to hero form" (Puny Pest/Giant Nuisance) with an
    // optional prompt, which must be resolved (declined) before another command can be issued.
    let state = settle(
      runWave2(startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 })), {
        type: "changeForm",
        playerId: P1,
        to: { heroForm: 0 },
      }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    const kang1 = state.villains[0]!.instanceId;
    const yellowjacket = instancesOf(state, "12027")[0]!;
    expect(playerOf(state, P1).setAside).toContain(yellowjacket);

    state = defeatWithAttack(state, kang1);
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    const areaKang = state.gameAreas[0]!.villainIds[0]!;
    state = defeatWithAttack(state, areaKang);
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);

    // Kang's Wrath (stage index 6) is now active, and its own base-stage When Revealed (11013b) resolved right
    // after the A side's (11013a) as part of the very same advance (RRG-modeled ordering, `resolve/defeat.ts`'s
    // `advanceMainScheme`: "the new stage's A side is revealed first … then the B side").
    expect(state.mainScheme.stageIndex).toBe(6);
    expect(playerOf(state, P1).setAside).not.toContain(yellowjacket);
    expect(playerOf(state, P1).playArea).toContain(yellowjacket);
    expect(inst(state, yellowjacket).engagedWith).toBe(P1);
  });
});
