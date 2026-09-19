/**
 * docs/phase7-wave2.md §3.1 (separate game areas) and §3.4 (villain decks beyond one sequence), proven with synthetic
 * cards shaped like The Once and Future Kang and scripted with stub abilities: a stage 1 whose completion loses, a
 * villain whose defeat advances the main scheme at the end of the phase, a central stage 2 with dashed values that reveals
 * a random stage 3 per player, per-player areas each with their own villain, joining and dissolving areas, and a final
 * villain whose defeat wins.
 *
 * Sources: The Once and Future Kang insert, "Setup", "Create Separate Game Areas", "Playing With Separate Game Areas",
 * "Joining Another Game Area" and "Rules Clarifications" (quoted in docs/phase7-wave2.md §3.1); RRG 1.8 FAQ "The Once
 * and Future Kang Scenario Pack" (p. 60); RRG 1.8 "Villain Defeat" (p. 47), "Dash (Value)" (p. 15), "Unique Icon"
 * (pp. 45–46), "Lasting Effects" (p. 26); the Golden Rules (p. 4).
 */

import { abilityId, cardId, flat, perPlayerOnly, trait, unerrataedText, type AbilityReference, type AnyCard, type MainSchemeCard, type MainSchemeStage, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityTriggerSpec, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeckId, areaOfCard, areaOfPlayer, mainSchemeStateOf, mustInstance, villainOf } from "./query.js";
import { cardsInPlay, contextArea, matchesQuery, resolvePlayers, resolveRef, type EffectContext } from "./select.js";
import { createGame, villainsForDifficulty } from "./setup.js";
import type { EffectSpec, Predicate } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubEnvironment, stubIdentity, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, seatIdentities, settle, TREACHERY } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const text = unerrataedText("");
const self = { kind: "self" } as const;
const abilities: StubAbility[] = [];
const ability = (id: string, trigger: AbilityTriggerSpec, effects: readonly EffectSpec[]): AbilityReference => {
  const made = stubAbility(id, { trigger, effects });
  abilities.push(made);
  return made.ref;
};
const setAside = (slot: string, name: string): EffectSpec => ({ kind: "selectCards", slot, cards: { kind: "encounterSetAside", filter: { name } } });
const constantAbility = (id: string, trigger: Omit<Extract<AbilityTriggerSpec, { kind: "constant" }>, "kind">): AbilityReference => {
  const made = stubAbility(id, { trigger: { kind: "constant", ...trigger }, effects: [] });
  abilities.push(made);
  return made.ref;
};

// ---- Villains: Kang (I) in the villain deck, one Kang (II) per stage 3, Kang (III) for stage 4 --------------------

const K1 = stubVillain({
  id: "k1",
  name: "Kang (I)",
  // "When Defeated: Advance the main scheme to stage 2 at the end of the phase."
  stages: [{ hp: flat(5), atk: 0, sch: 0, abilities: [ability("k1.defeated", { kind: "whenDefeated" }, [{ kind: "atEndOfPhase", effects: [{ kind: "advanceMainScheme", to: { stageNumber: 2 } }] }])] }],
});
/** "When Defeated: Remove <stage> from the game. At the end of the phase, join another game area." */
const k2 = (id: string, name: string, stageName: string): VillainCard =>
  stubVillain({
    id,
    name,
    stages: [
      {
        hp: flat(4),
        atk: 0,
        sch: 1,
        abilities: [
          ability(`${id}.defeated`, { kind: "whenDefeated" }, [
            { kind: "removeMainSchemeStage", scheme: { kind: "named", name: stageName } },
            { kind: "atEndOfPhase", effects: [{ kind: "joinGameArea" }] },
          ]),
        ],
      },
    ],
  });
const K2A = k2("k2a", "Kang (Alpha)", "Alpha Stage");
const K2B = k2("k2b", "Kang (Beta)", "Beta Stage");
const K2C = k2("k2c", "Kang (Gamma)", "Gamma Stage");
// "When Defeated: The players win the game."
const K3 = stubVillain({ id: "k3", name: "Kang (III)", stages: [{ hp: flat(6), atk: 0, sch: 0, abilities: [ability("k3.defeated", { kind: "whenDefeated" }, [{ kind: "endGame", result: "win" }])] }] });

// ---- The main scheme deck: 1, 2 (central, dashed), three alternative 3s, 4 ------------------------------------------

const stage = (stageNumber: number, extra: Partial<MainSchemeStage> = {}): MainSchemeStage => ({
  stageNumber,
  startingThreat: flat(0),
  targetThreat: perPlayerOnly(20),
  acceleration: flat(1),
  icons: [],
  text,
  traits: [],
  keywords: [],
  abilities: [],
  aSide: { text, abilities: [] },
  ...extra,
});
const notSplit: Predicate = { kind: "not", of: { kind: "gameAreasSplit" } };
/** A stage 3: "Create your own game area and place this scheme in it. Add Kang (X) to the game area." */
const stage3 = (name: string, villain: string, key: string): MainSchemeStage =>
  stage(3, {
    name,
    targetThreat: flat(9),
    aSide: {
      text,
      abilities: [
        ability(`${key}.revealed`, { kind: "whenRevealed" }, [
          { kind: "createGameArea", scheme: self },
          setAside(`${key}.kang`, villain),
          { kind: "addVillain", villain: { kind: "slot", slot: `${key}.kang` } },
        ]),
      ],
    },
    abilities: [
      // "If all the players at this stage are defeated, this stage is complete."
      ability(`${key}.defeated`, { kind: "stateCheck", when: { kind: "areaPlayersDefeated" } }, [{ kind: "completeMainScheme", scheme: self }]),
      // "After this stage is complete, place 1 set-aside Dominion facedown under stage 4A. At the end of the phase, remove
      // Kang (X) and this stage from the game and combine your game area with another game area."
      ability(`${key}.completed`, { kind: "response", forced: true, on: { on: "mainSchemeCompleted", selfIs: "target" } }, [
        setAside(`${key}.dominion`, "Dominion"),
        { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: `${key}.dominion` } }, under: { kind: "mainScheme", of: "central" }, facedown: true },
        setAside(`${key}.gone`, villain),
        { kind: "atEndOfPhase", effects: [{ kind: "joinGameArea" }] },
      ]),
    ],
  });
const SCHEME: MainSchemeCard = {
  id: cardId("kang-scheme"),
  type: "main_scheme",
  name: "Kang's Arrival",
  setCode: HERO.setCode,
  cycleId: HERO.cycleId,
  collectorNumber: "7",
  quantityInSet: 1,
  unique: false,
  encounterSetIds: [],
  stages: [
    // "If this stage is completed, the players lose the game."
    stage(1, { targetThreat: perPlayerOnly(7), abilities: [ability("s1.completed", { kind: "whenCompleted" }, [{ kind: "endGame", result: "loss" }])] }),
    stage(2, {
      name: "The Master of Time",
      startingThreat: flat(0),
      targetThreat: flat(0),
      acceleration: flat(0),
      dashedValues: ["startingThreat", "targetThreat", "acceleration"],
      aSide: {
        text,
        // "Each player reveals a random stage 3A in turn order. Remove any unused stage 3 schemes from the game."
        abilities: [ability("s2.revealed", { kind: "whenRevealed" }, [{ kind: "revealMainSchemeStage", player: { kind: "each" }, stageNumber: 3, removeUnused: true }])],
      },
      // "When all the players have joined this game area, advance to stage 4A." and, alongside it on the same printed
      // card, "Forced Interrupt: When an acceleration token would be placed on another scheme, place it here
      // instead." — the second is a constant redirect read at placement (docs/phase7-wave2.md §10.3).
      abilities: [
        ability("s2.joined", { kind: "stateCheck", when: notSplit }, [{ kind: "advanceMainScheme", to: { stageNumber: 4 }, scheme: self }]),
        constantAbility("s2.accelerationHere", { rules: [{ kind: "accelerationTokenDestination", to: self }] }),
      ],
    }),
    stage3("Alpha Stage", "Kang (Alpha)", "alpha"),
    stage3("Beta Stage", "Kang (Beta)", "beta"),
    stage3("Gamma Stage", "Kang (Gamma)", "gamma"),
    stage(4, {
      name: "Kang's Wrath",
      targetThreat: perPlayerOnly(20),
      aSide: {
        text,
        // "Reveal Kang (III) and add him to the game area. Reveal each face down Dominion under this stage."
        abilities: [ability("s4.revealed", { kind: "whenRevealed" }, [setAside("s4.kang", "Kang (III)"), { kind: "addVillain", villain: { kind: "slot", slot: "s4.kang" }, reveal: true }])],
      },
    }),
  ],
};
const DOMINION = stubEnvironment({ id: "dominion", name: "Dominion" });

// ---- Player-side tools ------------------------------------------------------------------------------------------

/** "Action: deal 99 damage to the villain" on the identity, so a test drives defeats through commands alone. */
const BLAST_ACTION = abilityId("blaster.blast");
abilities.push(stubAbility(BLAST_ACTION, { trigger: { kind: "action" }, effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 99 } }] }));
/** Test tools for §10.2/§10.3, on the identity so a test drives each through a real `useAbility` command. */
const TOKEN_HERE_ACTION = abilityId("blaster.tokenArea");
abilities.push(stubAbility(TOKEN_HERE_ACTION, { trigger: { kind: "action" }, effects: [{ kind: "addAccelerationToken", target: { kind: "mainScheme" } }] }));
const TOKEN_CENTRAL_ACTION = abilityId("blaster.tokenCentral");
abilities.push(stubAbility(TOKEN_CENTRAL_ACTION, { trigger: { kind: "action" }, effects: [{ kind: "addAccelerationToken", target: { kind: "mainScheme", of: "central" } }] }));
const TUCK_DOMINION_ACTION = abilityId("blaster.tuckDominion");
abilities.push(
  stubAbility(TUCK_DOMINION_ACTION, {
    trigger: { kind: "action" },
    effects: [
      setAside("dom", "Dominion"),
      { kind: "tuckCards", cards: { kind: "ref", ref: { kind: "slot", slot: "dom" } }, under: { kind: "mainScheme", of: "central" }, facedown: true },
    ],
  }),
);
const REVEAL_TUCKED_ACTION = abilityId("blaster.revealTucked");
abilities.push(
  stubAbility(REVEAL_TUCKED_ACTION, {
    trigger: { kind: "action" },
    effects: [{ kind: "revealCard", cards: { kind: "tuckedUnder", of: { kind: "mainScheme", of: "central" } }, player: { kind: "firstPlayer" } }],
  }),
);
const JOIN_ACTION = abilityId("blaster.join");
abilities.push(stubAbility(JOIN_ACTION, { trigger: { kind: "action" }, effects: [{ kind: "joinGameArea" }] }));
const TOOLS = [{ id: TOKEN_HERE_ACTION }, { id: TOKEN_CENTRAL_ACTION }, { id: TUCK_DOMINION_ACTION }, { id: REVEAL_TUCKED_ACTION }, { id: JOIN_ACTION }];
const BLASTER = stubIdentity({ id: "blaster", hp: 30, atk: 1, thw: 1, def: 1, rec: 1, heroHandSize: 5, alterEgoHandSize: 5, heroAbilities: [{ id: BLAST_ACTION }, ...TOOLS], alterEgoAbilities: [{ id: BLAST_ACTION }, ...TOOLS] });
const UNIQUE_ALLY: AnyCard = { ...stubAlly({ id: "unique-ally", cost: 0, atk: 1, thw: 1, hp: 3 }), unique: true };
const CARDS: readonly AnyCard[] = [K1, K2A, K2B, K2C, K3, SCHEME, DOMINION, UNIQUE_ALLY];
const deps: EngineDeps = depsOf(...abilities);

function kangGame(options: { readonly players?: 1 | 2; readonly seed?: number } = {}): GameState {
  const identities = seatIdentities(BLASTER, options.players ?? 2);
  const deck = [...DEFAULT_DECK, UNIQUE_ALLY.id];
  const result = createGame(
    {
      seed: options.seed ?? 11,
      cards: [...DEFAULT_CARDS, ...CARDS, ...identities],
      villainCardId: K1.id,
      setAsideVillainCardIds: [K2A.id, K2B.id, K2C.id, K3.id],
      victory: "cardAbility",
      separateGameAreas: true,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...Array.from({ length: 20 }, () => TREACHERY.id), DOMINION.id, DOMINION.id, DOMINION.id],
      includeIdentitySets: false,
      players: identities.map((identity) => ({ identityCardId: identity.id, deck })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  // The Dominion cards start set aside (1A: "Set each … Kang's Dominion side scheme aside"): test surgery.
  const state = settle(result.state, defaultPick, deps);
  const dominions = Object.values(state.instances).filter((i) => i.cardId === DOMINION.id).map((i) => i.instanceId);
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId];
  if (!piles) throw new Error("no encounter deck");
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((id) => !dominions.includes(id)) } },
    encounterSetAside: [...state.encounterSetAside, ...dominions],
  };
}

const run = (session: GameSession, command: Command): { readonly session: GameSession; readonly events: readonly GameEvent[] } => {
  const result = sessionApply(session, command, deps);
  if (!result.ok) throw new Error(`${command.type}: ${result.error.code} ${result.error.message}`);
  let current = result.session;
  const events = [...result.events];
  let guard = 0;
  while (current.state.pendingChoice && !current.state.outcome && guard++ < 200) {
    const choice = current.state.pendingChoice;
    const answer = sessionApply(current, { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: defaultPick(current.state) }, deps);
    if (!answer.ok) throw new Error(answer.error.message);
    current = answer.session;
    events.push(...answer.events);
  }
  return { session: current, events };
};
const activePlayer = (state: GameState): PlayerId | null => (state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : null);
/** Ends turns until it is `player`'s turn again (through the villain phase if needed). */
function toTurnOf(session: GameSession, player: PlayerId): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  let guard = 0;
  do {
    const active = activePlayer(current.state);
    if (!active) throw new Error(`not in a turn: ${current.state.step.kind}`);
    const step = run(current, { type: "endTurn", playerId: active });
    current = step.session;
    events.push(...step.events);
  } while (!current.state.outcome && activePlayer(current.state) !== player && guard++ < 20);
  return { session: current, events };
}
/** The player's identity blasts "the villain" of their area for 99. */
function blast(session: GameSession, player: PlayerId): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  const identity = session.state.players.find((p) => p.playerId === player)!.identity.instanceId;
  return run(session, { type: "useAbility", playerId: player, cardInstanceId: identity, abilityId: BLAST_ACTION, payment: [] });
}

/** Uses one of the identity's test tools, so an effect under test runs through a real command. */
function useTool(session: GameSession, player: PlayerId, abilityId_: typeof BLAST_ACTION): { readonly session: GameSession; readonly events: readonly GameEvent[] } {
  const identity = session.state.players.find((p) => p.playerId === player)!.identity.instanceId;
  return run(session, { type: "useAbility", playerId: player, cardInstanceId: identity, abilityId: abilityId_, payment: [] });
}
const context = (state: GameState, player: PlayerId): EffectContext => ({ selfInstanceId: state.players.find((p) => p.playerId === player)!.identity.instanceId, controllerId: player, event: null, bindings: {}, deps });

/** Runs a two-player game from Kang (I)'s defeat to the split. */
function splitGame(): GameSession {
  let session = startSession(kangGame());
  session = blast(session, p1).session;
  return toTurnOf(session, p1).session;
}

describe("villain decks beyond one sequence (docs/phase7-wave2.md §3.4)", () => {
  it("setup sets Kang (II) and Kang (III) aside; expert play substitutes the expert villains", () => {
    const state = kangGame();
    expect(state.villains.map((v) => v.cardId)).toEqual([K1.id]);
    expect(state.encounterSetAside.map((id) => mustInstance(state, id).cardId)).toEqual(expect.arrayContaining([K2A.id, K2B.id, K2C.id, K3.id]));
    const scenario = { villainCardId: K1.id, setAsideVillainCardIds: [K2A.id], expertVillains: { villainCardId: K3.id, setAsideVillainCardIds: [K2B.id] } };
    expect(villainsForDifficulty(scenario, "standard")).toEqual({ villainCardId: K1.id, setAsideVillainCardIds: [K2A.id] });
    expect(villainsForDifficulty(scenario, "expert")).toEqual({ villainCardId: K3.id, setAsideVillainCardIds: [K2B.id] });
  });

  it("defeating Kang (I) does not win; the main scheme advances to stage 2 at the end of the phase", () => {
    const start = startSession(kangGame());
    const struck = blast(start, p1);
    expect(struck.session.state.outcome).toBeNull();
    expect(villainOf(struck.session.state, struck.session.state.villains[0]!.instanceId)?.defeated).toBe(true);
    expect(struck.session.state.mainScheme.stageIndex).toBe(0);
    const ended = run(struck.session, { type: "endTurn", playerId: p1 });
    expect(ended.session.state.mainScheme.stageIndex).toBe(0);
    const phaseOver = run(ended.session, { type: "endTurn", playerId: p2 });
    expect(phaseOver.session.state.mainScheme.stageIndex).toBe(1);
  });

  it("a dashed target threat never completes the stage by threat (RRG 1.8 'Dash (Value)', p. 15)", () => {
    const state = splitGame().state;
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(mustInstance(state, state.mainScheme.instanceId).threat).toBe(0);
    expect(state.mainScheme.completed).toBe(false);
  });

  it("stage 1's 'If this stage is completed, the players lose the game' ends the game (a When Completed endGame)", () => {
    let session = startSession(kangGame({ players: 1 }));
    let guard = 0;
    while (!session.state.outcome && guard++ < 20) session = toTurnOf(session, p1).session;
    expect(session.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(session.state.mainScheme.stageIndex).toBe(0);
  });
});

describe("separate game areas (docs/phase7-wave2.md §3.1)", () => {
  it("each player reveals a random stage 3 in turn order, in their own area with their own Kang; unused stages are removed", () => {
    const state = splitGame().state;
    expect(state.gameAreas.map((area) => area.playerIds)).toEqual([[p1], [p2]]);
    const names = state.gameAreas.map((area) => (area.mainScheme ? mustInstance(state, area.mainScheme.instanceId).cardId : null));
    expect(names).toEqual([SCHEME.id, SCHEME.id]);
    const stages = state.gameAreas.map((area) => area.mainScheme?.stageIndex);
    expect(new Set(stages).size).toBe(2);
    // Three alternatives, two revealed, the third removed from the game: none left to reveal.
    expect([...state.spentMainSchemeStages].sort()).toEqual([2, 3, 4]);
    const villains = state.gameAreas.map((area) => area.activeVillainId && villainOf(state, area.activeVillainId)?.cardId);
    const expectedKang = (stageIndex: number | undefined) => [K2A.id, K2B.id, K2C.id][(stageIndex ?? 0) - 2];
    expect(villains).toEqual(stages.map(expectedKang));
  });

  it("isolation: attacks, targets and 'each player' stay in the area; 'the villain' is the area's own", () => {
    const split = splitGame().state;
    // Hero form, so a basic attack is otherwise legal (test surgery).
    const state: GameState = { ...split, players: split.players.map((p) => (p.playerId === p1 ? { ...p, identity: { ...p.identity, form: "hero", heroFormIndex: 0 } } : p)) };
    const [a1, a2] = state.gameAreas;
    const theirKang = a2!.activeVillainId as InstanceId;
    const mine = a1!.activeVillainId as InstanceId;
    const attack = applyCommand(state, { type: "basicAttack", playerId: p1, attackerInstanceId: state.players[0]!.identity.instanceId, targetInstanceId: theirKang }, deps);
    expect(attack.ok ? null : attack.error.message).toBe("that enemy is in another game area");
    expect(resolveRef(state, { kind: "villain" }, context(state, p1))).toEqual([mine]);
    expect(resolveRef(state, { kind: "mainScheme" }, context(state, p1))).toEqual([a1!.mainScheme!.instanceId]);
    expect(resolvePlayers(state, { kind: "each" }, context(state, p1))).toEqual([p1]);
    expect(matchesQuery(state, theirKang, { categories: ["enemy"] }, context(state, p1))).toBe(false);
    expect(matchesQuery(state, mine, { categories: ["enemy"] }, context(state, p1))).toBe(true);
  });

  it("the central stage and environments are in every area; the encounter deck is shared", () => {
    const state = splitGame().state;
    expect(areaOfCard(state, state.mainScheme.instanceId)).toBeNull();
    const central: EffectContext = { selfInstanceId: state.mainScheme.instanceId, controllerId: null, event: null, bindings: {}, deps };
    expect(contextArea(state, central)).toBeNull();
    expect([...resolvePlayers(state, { kind: "each" }, central)].sort()).toEqual([p1, p2]);
    expect(state.encounterDeckOrder).toHaveLength(1);
  });

  it("the villain phase places threat on each area's own stage and each Kang activates in its own area", () => {
    const session = splitGame();
    const next = toTurnOf(session, p1);
    const placed = next.events.filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced" && mainSchemeStateOf(next.session.state, e.schemeInstanceId) !== undefined);
    const areaSchemes = session.state.gameAreas.map((area) => area.mainScheme!.instanceId);
    expect(placed.filter((e) => e.sourceInstanceId === null).map((e) => e.schemeInstanceId)).toEqual(expect.arrayContaining(areaSchemes));
    const activations = next.events.filter((e): e is Extract<GameEvent, { type: "enemyActivated" }> => e.type === "enemyActivated" && villainOf(next.session.state, e.enemyInstanceId) !== undefined);
    // In player order (p2 holds the first player token after the first round's villain phase).
    expect(session.state.firstPlayerId).toBe(p2);
    expect(activations.map((e) => [e.enemyInstanceId, e.playerId])).toEqual([
      [session.state.gameAreas[1]!.activeVillainId, p2],
      [session.state.gameAreas[0]!.activeVillainId, p1],
    ]);
  });

  it("acceleration tokens on the central stage add to every area's step one (docs/phase7-wave2.md §4.3, proposed)", () => {
    const session = splitGame();
    const tokened: GameSession = { ...session, state: { ...session.state, mainScheme: { ...session.state.mainScheme, accelerationTokens: 2 } } };
    const next = toTurnOf(tokened, p1);
    const stepOne = next.events.filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced" && e.sourceInstanceId === null && mainSchemeStateOf(next.session.state, e.schemeInstanceId) !== undefined);
    // Each area's stage 3 prints acceleration 1, plus the two central tokens.
    expect(stepOne.map((e) => e.amount)).toEqual([3, 3]);
  });

  /**
   * docs/phase7-wave2.md §10.4. "Players cannot join this game area unless there are no other game areas remaining."
   * (The Master of Time 2B.) No new rule was needed: the join procedure already only reaches the central area when
   * no separate one is left (The Once and Future Kang insert, "Joining Another Game Area" — a joining player chooses
   * *a game area*, and the central stage "is not part of any other game area", docs/phase7-wave2.md §3.1). This
   * pins that, so the claim is asserted rather than assumed.
   */
  it("a player joining while another area remains joins that area, never the central one", () => {
    let session = splitGame();
    const [a1, a2] = session.state.gameAreas;
    expect(session.state.gameAreas).toHaveLength(2);
    const joined = useTool(session, p1, JOIN_ACTION);
    session = joined.session;
    expect(joined.events).toContainEqual({ type: "gameAreaJoined", fromAreaId: a1!.areaId, intoAreaId: a2!.areaId, playerIds: [p1] });
    // Still split: the centre was not an option while p2's area existed.
    expect(session.state.gameAreas).toHaveLength(1);
    // Now it is the last area, so joining dissolves it into the centre. p1 is still the active player after the
    // merge, and both players are in that one area, so either of them joining takes it to the centre.
    const last = useTool(session, p1, JOIN_ACTION);
    expect(last.events.filter((e) => e.type === "gameAreaJoined")).toEqual([
      { type: "gameAreaJoined", fromAreaId: a2!.areaId, intoAreaId: null, playerIds: [p2, p1] },
    ]);
    expect(last.session.state.gameAreas).toHaveLength(0);
  });

  /**
   * docs/phase7-wave2.md §10.3. "Forced Interrupt: When an acceleration token would be placed on another scheme,
   * place it here instead." (The Master of Time 2B, 11008b.) Read as a constant at placement, so the
   * encounter-deck reset that places most tokens (RRG 1.8 "Acceleration Token", p. 5) keeps its exact ordering.
   */
  it("an acceleration token aimed at an area's own stage is redirected to the central stage that claims it", () => {
    const session = splitGame();
    const areaScheme = session.state.gameAreas[0]?.mainScheme?.instanceId as InstanceId;
    const central = session.state.mainScheme.instanceId;
    expect(areaScheme).not.toBe(central);
    const before = session.state.mainScheme.accelerationTokens;
    // "Place 1 acceleration token on your area's stage": 2B's constant sends it to the centre instead.
    const placed = useTool(session, p1, TOKEN_HERE_ACTION);
    expect(placed.events).toContainEqual({ type: "accelerationTokenRedirected", from: areaScheme, to: central });
    expect(placed.session.state.mainScheme.accelerationTokens).toBe(before + 1);
    expect(mainSchemeStateOf(placed.session.state, areaScheme)?.accelerationTokens).toBe(0);
    // A token already headed for the central stage is not redirected onto itself, and logs exactly as it always has.
    const central2 = useTool(placed.session, p1, TOKEN_CENTRAL_ACTION);
    expect(central2.events.filter((e) => e.type === "accelerationTokenRedirected")).toEqual([]);
    expect(central2.events).toContainEqual({ type: "accelerationTokenAdded", total: before + 2 });
  });

  /**
   * docs/phase7-wave2.md §10.2. "Reveal each face down Kang's Dominion under this stage." (Kang's Wrath 4A.) Tucked
   * cards are out of play (RRG 1.8 "Tuck", p. 45), so only a `TargetRef` finds them; `revealCard` then runs the
   * whole reveal procedure on each, from wherever it was.
   */
  it("a facedown card tucked under a stage can be revealed into play by `tuckedUnder` + `revealCard`", () => {
    const session = splitGame();
    const central = session.state.mainScheme.instanceId;
    const [dominion] = session.state.encounterSetAside.filter((id) => mustInstance(session.state, id).cardId === DOMINION.id);
    expect(dominion).toBeDefined();
    // "Place 1 set-aside Kang's Dominion facedown under stage 4A", then 4A's own "Reveal each face down … under this
    // stage" — here both aimed at the central stage, which is where a tuck under a not-yet-revealed stage lands.
    const tucked = useTool(session, p1, TUCK_DOMINION_ACTION);
    expect(mustInstance(tucked.session.state, central).tucked).toContain(dominion);
    expect(cardsInPlay(tucked.session.state)).not.toContain(dominion);

    const revealed = useTool(tucked.session, p1, REVEAL_TUCKED_ACTION);
    expect(mustInstance(revealed.session.state, central).tucked).not.toContain(dominion);
    expect(cardsInPlay(revealed.session.state)).toContain(dominion);
    expect(mustInstance(revealed.session.state, dominion as InstanceId).faceup).toBe(true);
  });

  it("defeating an area's Kang removes its stage; at the end of the phase the player joins the other area, then all join the centre, stage 4A adds Kang (III), and his defeat wins", () => {
    let session = splitGame();
    const [a1, a2] = session.state.gameAreas;
    // p1 defeats their Kang (II): the stage is removed now, the join waits for the end of the phase.
    session = blast(session, p1).session;
    expect(session.state.gameAreas.find((a) => a.areaId === a1!.areaId)?.mainScheme).toBeNull();
    expect(session.state.gameAreas).toHaveLength(2);
    const joined = toTurnOf(session, p1);
    session = joined.session;
    expect(joined.events).toContainEqual({ type: "gameAreaJoined", fromAreaId: a1!.areaId, intoAreaId: a2!.areaId, playerIds: [p1] });
    expect(session.state.gameAreas.map((area) => area.playerIds)).toEqual([[p2, p1]]);
    expect(areaOfPlayer(session.state, p1)?.areaId).toBe(a2!.areaId);
    // Now p1 fights p2's Kang: "the villain" of the merged area.
    expect(resolveRef(session.state, { kind: "villain" }, context(session.state, p1))).toEqual([a2!.activeVillainId]);
    session = blast(session, p1).session;
    const dissolved = toTurnOf(session, p1);
    session = dissolved.session;
    expect(dissolved.events).toContainEqual({ type: "gameAreaJoined", fromAreaId: a2!.areaId, intoAreaId: null, playerIds: [p2, p1] });
    expect(session.state.gameAreas).toEqual([]);
    // "When all the players have joined this game area, advance to stage 4A": Kang (III) is added and revealed.
    expect(session.state.mainScheme.stageIndex).toBe(5);
    const kang3 = session.state.villains.find((v) => v.cardId === K3.id);
    expect(kang3?.defeated).toBe(false);
    expect(session.state.activeVillainId).toBe(kang3?.instanceId);
    expect(session.state.outcome).toBeNull();
    session = blast(session, p1).session;
    expect(session.state.outcome).toEqual({ result: "win", reason: "villainDefeated" });

    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("a unique card in one area places no limit on another; combining areas discards the duplicate, the first player choosing", () => {
    let state = splitGame().state;
    const play = (s: GameState, player: PlayerId): GameState => {
      const given = giveCard(s, player, UNIQUE_ALLY.id);
      const result = applyCommand(given.state, { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null }, deps);
      if (!result.ok) throw new Error(result.error.message);
      return settle(result.state, defaultPick, deps);
    };
    state = play(state, p1);
    // p2's own copy is legal: different area. Test surgery makes it p2's turn.
    const p2Turn: GameState = { ...state, step: { phase: "player", kind: "turn", activePlayerId: p2, remainingPlayerIds: [] } };
    state = play(p2Turn, p2);
    const copies = () => Object.values(state.instances).filter((i) => i.cardId === UNIQUE_ALLY.id && state.players.some((p) => p.playArea.includes(i.instanceId)));
    expect(copies()).toHaveLength(2);
    // Combine: p1's area joins p2's.
    const joinDeps = deps;
    const [a1, a2] = state.gameAreas;
    const frame = {
      frameId: "fjoin" as never,
      answer: null,
      kind: "effects" as const,
      effects: [{ kind: "joinGameArea" } as const],
      cursor: 0,
      bindings: {},
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: a1!.mainScheme!.instanceId,
      controllerId: p1,
      event: null,
      eventFrameId: null,
    };
    const withFrame: GameState = { ...state, step: { phase: "player", kind: "turn", activePlayerId: p1, remainingPlayerIds: [] }, stack: [frame] };
    const result = applyCommand(withFrame, { type: "endTurn", playerId: p1 }, joinDeps);
    const choice = result.ok ? result.state.pendingChoice : null;
    // "If the players cannot agree which one to discard, the first player decides."
    expect(choice?.playerId).toBe(state.firstPlayerId);
    expect(choice?.prompt).toEqual({ kind: "chooseTarget", slot: "_duplicates0.discard", abilityId: null });
    expect(choice?.options).toHaveLength(2);
    const answered = applyCommand(result.ok ? result.state : withFrame, { type: "resolveChoice", playerId: choice!.playerId, choiceId: choice!.choiceId, selectedOptionIds: [choice!.options[0]!.optionId] }, joinDeps);
    expect(answered.ok).toBe(true);
    const after = answered.ok ? answered.state : withFrame;
    expect(after.gameAreas.map((a) => a.areaId)).toEqual([a2!.areaId]);
    expect(Object.values(after.instances).filter((i) => i.cardId === UNIQUE_ALLY.id && after.players.some((p) => p.playArea.includes(i.instanceId)))).toHaveLength(1);
  });
});
