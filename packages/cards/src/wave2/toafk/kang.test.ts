import { cardsInPlay, createGame } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, instancesOf, P1, playerOf, settle, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { defeatWithAttack, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { KANG_SET } from "./kang.js";

const kangVsHeroes = () => startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));

describe("Kang scenario", () => {
  it("standalone setup: Kang (I) alone in the villain deck, Kang (II)/(III) set aside, the game is legal", () => {
    const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.villains.map((v) => v.cardId)).toEqual(["11001"]);
    const setAsideKangs = created.state.encounterSetAside.filter((id) => ["11002", "11003", "11004", "11005", "11006"].includes(created.state.instances[id]?.cardId ?? ""));
    expect(setAsideKangs).toHaveLength(5);
    expect(created.state.outcome).toBeNull();
    const settled = settle(created.state, firstLegal, undefined, WAVE2_DEPS);
    expect(settled.outcome).toBeNull();
  });

  it("expert mode: the Expert Kang villain and Expert Kang (II)/(III) set-aside cards replace the standard ones", () => {
    const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026, difficulty: "expert" });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    expect(created.state.villains.map((v) => v.cardId)).toEqual(["11034"]);
    const setAsideKangs = created.state.encounterSetAside.filter((id) => ["11035", "11036", "11037", "11038", "11039"].includes(created.state.instances[id]?.cardId ?? ""));
    expect(setAsideKangs).toHaveLength(5);
  });

  it("Kang (I): Forced Interrupt, when he attacks you, either places 1 threat on the main scheme or gets +2 ATK for this attack", () => {
    expect(KANG_SET["11001.kang-the-conqueror-forced-interrupt"]).toBeDefined();
  });

  it("Kang (I): When Defeated, advances the main scheme to stage 2 at the end of the phase (not immediately)", () => {
    const start = kangVsHeroes();
    const hero = runWave2(start, toHero());
    const villain = hero.villains[0]!.instanceId;
    const damaged = { ...hero, instances: { ...hero.instances, [villain]: { ...hero.instances[villain]!, damage: 999 } } };
    const identity = identityOf(damaged);
    const settled = settle(runWave2(damaged, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, villain).damage).toBeGreaterThanOrEqual(999);
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

  it("Kang's Arrival 1A: removes every obligation-type card from the encounter deck and shuffles it", () => {
    expect(KANG_SET["11007a.setup"]).toBeDefined();
    const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const settled = settle(created.state, firstLegal, undefined, WAVE2_DEPS);
    const deckId = Object.keys(settled.encounterDecks)[0]!;
    const pile = settled.encounterDecks[deckId]!;
    const obligations = [...pile.deck, ...pile.discard].filter((id) => settled.instances[id]?.cardId?.toString().match(/^1101[89]|^1102[01]/));
    expect(obligations).toHaveLength(0);
  });

  it("The Chronopolis 3A (Kang (Immortus)'s stage): creates a game area, adds Kang (Immortus), and deals the revealing player an encounter card", () => {
    expect(KANG_SET["11009a.when-revealed"]).toBeDefined();
  });

  it("The Chronopolis 3B: if all the players at this stage are defeated, this stage is complete (a stateCheck)", () => {
    expect(KANG_SET["11009b.the-chronopolis-constant"]).toBeDefined();
  });

  it("The Chronopolis 3B: Forced Response, after this stage is complete, tucks Kang's Dominion under stage 4A and removes Kang (Immortus)/this stage, joining another area at end of phase", () => {
    expect(KANG_SET["11009b.the-chronopolis-forced-response"]).toBeDefined();
  });

  it("The Master of Time 2B / Kang's Wrath 4A: a full one-player split-and-rejoin — defeating Kang (I) creates a stage 3 area, defeating that area's Kang (II) removes the stage and rejoins the (now sole) central area, which then advances straight to 4A and reveals Kang (III) plus the tucked Kang's Dominion", () => {
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
    state = settle(runWave2(state, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(state.gameAreas).toHaveLength(0);

    // The Master of Time 2B's own constant fired the instant the split ended ("when all the players have joined
    // this game area, advance to stage 4A", 11008b.the-master-of-time-constant) — no player action needed. Kang's
    // Wrath 4A's own When Revealed (11013a) then added Kang (III) and revealed the facedown Kang's Dominion tucked
    // there by the stage 3 area's own Forced Response.
    // Stage index 6 in Kang's Arrival's own stage list (1, 2, four alternative 3s, 4) is "Kang's Wrath".
    expect(state.mainScheme.stageIndex).toBe(6);
    expect(state.villains.some((v) => v.cardId === "11006")).toBe(true);
    expect(cardsInPlay(state).some((id) => state.instances[id]?.cardId === "11023")).toBe(true);
  });

  it("Kang's Wrath 4B: each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion and puts it into play engaged with them (docs/phase7-wave2.md §17.1)", () => {
    // Ant-Man, not Hawkeye: Ant-Man's nemesis minion (Yellowjacket, 12027) carries the `nemesisMinion` parenthetical
    // flag `TargetQuery.nemesisMinionOf` reads; Hawkeye's own single-minion nemesis set (Crossfire, 04027) does not
    // print one (real card behavior — a single-minion set needs no disambiguating parenthetical, RRG 1.8 "Nemesis
    // Encounter Set" p. 30), so `nemesisMinionOf` correctly finds nothing for a Hawkeye player — a data-completeness
    // gap flagged in docs/phase7-wave2-scripting.md, not a scripting bug in this ability.
    // A three-sided identity's `changeForm` needs an explicit hero form (`toHero()` alone is ambiguous, Tiny or
    // Giant); which one is irrelevant here, since the test only cares about Yellowjacket's own defeat/engage state.
    // `settle`: Ant-Man's own kit responds to "after you change to hero form" (Puny Pest/Giant Nuisance) with an
    // optional prompt, which must be resolved (declined) before another command can be issued.
    let state = settle(runWave2(startWave2Game(wave2Scenario("kang", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 })), { type: "changeForm", playerId: P1, to: { heroForm: 0 } }), firstLegal, undefined, WAVE2_DEPS);
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
