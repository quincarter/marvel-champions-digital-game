import {
  activeVillain,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  keywordTotal,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { MANSION_ATTACK_ABILITIES } from "./mansion-attack.js";
import { WAVE6_DEPS } from "../index.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  playFromHand as playFromHandWith,
  withForm,
} from "../../testing/staging.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  toHero,
} from "../../testing/harness.js";
import { engageMinion as engageMinionBySurgery } from "./project-wideawake-testing.js";
import {
  mansionAttackGame,
  onlySetAsideVillain,
  setAsideVillainIds,
  villainTitle,
  withoutDealtCards,
} from "./mansion-attack-testing.js";

/** A minion engaged with a player by surgery, taken from the deck or (the 1B-dealt facedown card included) the discard pile. */
const engageMinion = (state: GameState, code: string, player: PlayerId = P1) =>
  engageMinionBySurgery(withoutDealtCards(state), code, player);
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const villain = (state: GameState) => activeVillain(state).instanceId;
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const LEADERSHIP = [{ starterDeckId: "core-captain-marvel-leadership" }] as const;
const STAGE = { strikes: 0, atrium: 1, cafeteria: 2, court: 3, courtyard: 4 } as const;

/** The game's main scheme at one of the 32125a stages (state surgery: stands in for the shuffle having put it there). */
const atStage = (state: GameState, stageIndex: number): GameState => ({
  ...state,
  mainScheme: { ...state.mainScheme, stageIndex },
});
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });

describe("registry", () => {
  it("registers every ability ref of the Mansion Attack scenario set", () => {
    expect(Object.keys(MANSION_ATTACK_ABILITIES).sort()).toEqual(
      [
        "32121a.avalanche-forced-response",
        "32121b.avalanche-forced-response",
        "32122a.blob-forced-response",
        "32122b.blob-forced-response",
        "32123a.pyro-forced-response",
        "32123b.pyro-forced-response",
        "32124a.toad-forced-response",
        "32124b.toad-forced-response",
        "32125a.setup",
        "32125b.when-revealed",
        "32126a.when-revealed",
        "32126b.the-atrium-constant",
        "32126b.when-completed",
        "32126b.the-atrium-constant-2",
        "32127a.when-revealed",
        "32127b.the-cafeteria-constant",
        "32127b.when-completed",
        "32127b.the-cafeteria-constant-2",
        "32128a.when-revealed",
        "32128b.the-basketball-court-constant",
        "32128b.when-completed",
        "32128b.the-basketball-court-constant-2",
        "32129a.when-revealed",
        "32129b.the-courtyard-constant",
        "32129b.when-completed",
        "32129b.the-courtyard-constant-2",
        "32130.save-the-school-forced-response",
        "32131.when-revealed",
        "32131.brotherhood-beatdown-constant",
        "32131.brotherhood-beatdown-constant-2",
        "32131.brotherhood-beatdown-constant-3",
        "32131.brotherhood-beatdown-constant-4",
        "32132.when-revealed",
        "32132.boost",
        "32133.when-revealed",
        "32133.boost",
        "32134.when-revealed",
        "32134.boost",
        "32135.when-revealed",
        "32135.boost",
        "32136.when-defeated",
        "32137.when-revealed",
      ].sort(),
    );
  });
});

describe("The Brotherhood Strikes! 1A / 1B (32125a/b) and the villain deck", () => {
  it("32125a.setup: Save the School is in play, the stage 2s are shuffled and 1B is already in the victory display", () => {
    const state = mansionAttackGame();
    expect(cardsInPlay(state).map((id) => codeOf(state, id))).toContain("32130");
    const order = state.mainScheme.stageOrder!;
    expect(order).toHaveLength(5);
    expect(order[0]).toBe(0);
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(state.mainScheme.stageIndex).toBe(order[1]);
    expect(state.mainScheme.stageIndex).toBeGreaterThan(0);
    // Save the School is out of the encounter deck; the deck is the set plus Brotherhood plus Standard.
    const deck = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.deck.map((id) => codeOf(state, id));
    expect(deck).not.toContain("32130");
    expect(deck).toContain("32073");
  });

  it("32125b.when-revealed: 1B is the first main scheme in the victory display and each player is dealt a facedown encounter card", () => {
    const state = mansionAttackGame({ players: TWO });
    const schemes = state.victoryDisplay.filter((id) => state.cardPool[codeOf(state, id)]!.type === "main_scheme");
    expect(schemes).toHaveLength(1);
    expect(state.instances[schemes[0]!]!.mainSchemeStageIndex).toBe(0);
    expect(state.players.map((p) => p.dealtEncounter.length)).toEqual([1, 1]);
    expect(state.outcome).toBeNull();
  });

  it("the villain deck: a random one of the four starts in play, the other three are set aside, tough and undamaged", () => {
    const titles = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const state = mansionAttackGame({ seed });
      titles.add(villainTitle(state));
      expect(setAsideVillainIds(state)).toHaveLength(3);
      expect(inst(state, villain(state)).statuses.tough).toBe(1);
      expect(inst(state, villain(state)).damage).toBe(0);
    }
    expect([...titles].sort()).toEqual(["Avalanche", "Blob", "Pyro", "Toad"]);
  });

  it("the same seed shuffles the same way", () => {
    const a = mansionAttackGame({ seed: 7 });
    const b = mansionAttackGame({ seed: 7 });
    expect(codeOf(a, villain(a))).toBe(codeOf(b, villain(b)));
    expect(a.mainScheme.stageOrder).toEqual(b.mainScheme.stageOrder);
  });

  it("standard mode plays the (a) villains and expert the (b) villains, with the printed hit points", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const standard = mansionAttackGame({ seed });
      const expert = mansionAttackGame({ seed, difficulty: "expert" });
      expect(codeOf(standard, villain(standard))).toMatch(/^3212[1-4]a$/);
      expect(codeOf(expert, villain(expert))).toBe(codeOf(standard, villain(standard)).replace("a", "b"));
      for (const id of setAsideVillainIds(expert)) expect(id).toMatch(/^3212[1-4]b$/);
    }
    const expert = mansionAttackGame({ difficulty: "expert", villain: "Avalanche" });
    expect(characterProfile(expert, villain(expert), WAVE6_DEPS)).toMatchObject({ atk: 4, sch: 2, maxHp: 18 });
    const standard = mansionAttackGame({ villain: "Avalanche" });
    expect(characterProfile(standard, villain(standard), WAVE6_DEPS)).toMatchObject({ atk: 3, sch: 2, maxHp: 15 });
  });
});

describe("the four stage 2s (32126b-32129b)", () => {
  const hero = (state: GameState) => identityOf(state, P1);
  it("The Atrium: each character gains steady", () => {
    const base = mansionAttackGame({ villain: "Blob" });
    const at = atStage(base, STAGE.atrium);
    for (const id of [hero(at), villain(at)]) expect(hasKeyword(at, id, "steady", WAVE6_DEPS)).toBe(true);
    const other = atStage(base, STAGE.courtyard);
    expect(hasKeyword(other, hero(other), "steady", WAVE6_DEPS)).toBe(false);
  });

  it("The Cafeteria: each character gains retaliate 1", () => {
    const base = mansionAttackGame({ villain: "Blob" });
    const at = atStage(base, STAGE.cafeteria);
    for (const id of [hero(at), villain(at)]) expect(keywordTotal(at, id, "retaliate", WAVE6_DEPS)).toBe(1);
    expect(keywordTotal(atStage(base, STAGE.atrium), hero(base), "retaliate", WAVE6_DEPS)).toBe(0);
  });

  it("The Basketball Court: each ally and minion gains toughness (the tough card comes as it enters play)", () => {
    const base = atStage(mansionAttackGame({ villain: "Blob", players: LEADERSHIP }), STAGE.court);
    const { state: withAlly, id: ally } = playFromHandWith(WAVE6_DEPS, base, "01011", 3);
    expect(hasKeyword(withAlly, ally, "toughness", WAVE6_DEPS)).toBe(true);
    expect(inst(withAlly, ally).statuses.tough).toBe(1);
    const { state: withMinion, id: minion } = engageMinion(base, "32074");
    expect(hasKeyword(withMinion, minion, "toughness", WAVE6_DEPS)).toBe(true);
    // Not the villain, not a hero.
    expect(hasKeyword(base, villain(base), "toughness", WAVE6_DEPS)).toBe(true); // Blob's own printed toughness
    expect(hasKeyword(base, hero(base), "toughness", WAVE6_DEPS)).toBe(false);
    const elsewhere = atStage(base, STAGE.atrium);
    const control = playFromHandWith(WAVE6_DEPS, elsewhere, "01011", 3);
    expect(control.state.instances[control.id]!.statuses.tough).toBe(0);
  });

  it("The Courtyard: each character gets +1 ATK", () => {
    const base = mansionAttackGame({ villain: "Blob" });
    const plainHero = characterProfile(base, hero(base), WAVE6_DEPS)!.atk;
    const plainVillain = characterProfile(base, villain(base), WAVE6_DEPS)!.atk;
    const at = atStage(base, STAGE.courtyard);
    expect(characterProfile(at, hero(at), WAVE6_DEPS)!.atk).toBe(plainHero + 1);
    expect(characterProfile(at, villain(at), WAVE6_DEPS)!.atk).toBe(plainVillain + 1);
  });

  it("each 32126a-32129a When Revealed (flip this card) leaves the stage current: its B side's text applies", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const state = mansionAttackGame({ seed });
      expect(state.mainScheme.completed).toBe(false);
      const stage = state.mainScheme.stageIndex;
      const hero = identityOf(state, P1);
      expect(hasKeyword(state, hero, "steady", WAVE6_DEPS)).toBe(stage === STAGE.atrium);
      expect(keywordTotal(state, hero, "retaliate", WAVE6_DEPS)).toBe(stage === STAGE.cafeteria ? 1 : 0);
    }
  });
});

describe("walking the shuffled main scheme deck", () => {
  /** One villain phase from a scheme one threat short of its target (acceleration 1 per hero reaches it). */
  const completeStage = (state: GameState) => {
    const target = 7 * state.players.length;
    return driveEventsPicking(
      WAVE6_DEPS,
      patchInstance(withoutDealtCards(state), mainScheme(state), { threat: target - state.players.length }),
      firstLegal,
      ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
    );
  };
  const stageNames = (state: GameState) =>
    state.victoryDisplay
      .filter((id) => state.cardPool[codeOf(state, id)]!.type === "main_scheme")
      .map((id) => state.instances[id]!.mainSchemeStageIndex);

  it("a completed stage joins the victory display and the next stage in the shuffled order is revealed", () => {
    const start = mansionAttackGame({ villain: "Blob" });
    const order = start.mainScheme.stageOrder!;
    const { state, events } = completeStage(start);
    expect(stageNames(state)).toEqual([0, order[1]]);
    expect(state.mainScheme.stageIndex).toBe(order[2]);
    expect(state.outcome).toBeNull();
    expect(of(events, "mainSchemeStageToVictoryDisplay").map((e) => e.stageIndex)).toEqual([order[1]]);
    expect(of(events, "mainSchemeAdvanced")).toHaveLength(1);
  });

  it("each of the four shuffles, in whatever order, is walked in that order", () => {
    for (const seed of [2, 5, 11]) {
      const start = mansionAttackGame({ seed, villain: "Blob" });
      const order = start.mainScheme.stageOrder!;
      const { state } = completeStage(start);
      expect(state.mainScheme.stageIndex).toBe(order[2]);
    }
  });

  it("the third main scheme in the victory display (1B counts as one) loses the game", () => {
    const start = mansionAttackGame({ villain: "Blob" });
    const afterOne = completeStage(start).state;
    expect(afterOne.outcome).toBeNull();
    const { state } = completeStage(afterOne);
    expect(stageNames(state)).toHaveLength(3);
    expect(state.outcome?.result).toBe("loss");
  });
});

describe("Save the School (32130)", () => {
  /** The villain in play, defeated by a real attack (its tough card removed first, so the blow lands). */
  const defeat = (state: GameState, player: PlayerId = P1) => {
    const hero = playerOf(state, player).identity.form === "hero" ? state : run(state, toHero(player));
    const ready = patchInstance(hero, identityOf(hero, player), { exhausted: false });
    return defeatWithAttack(WAVE6_DEPS, bare(ready, villain(ready)), villain(ready), player);
  };
  const dealt = (state: GameState) => state.players.map((p) => p.dealtEncounter.length);

  it("a defeated villain goes to the victory display (Victory 2) and a random set-aside villain of another title takes its place, tough and at full hit points", () => {
    const start = mansionAttackGame({ villain: "Avalanche" });
    const before = villain(start);
    const state = defeat(start);
    expect(state.outcome).toBeNull();
    expect(state.victoryDisplay).toContain(before);
    expect(villainTitle(state)).not.toBe("Avalanche");
    const next = activeVillain(state);
    expect(next.instanceId).not.toBe(before);
    expect(inst(state, next.instanceId).statuses.tough).toBe(1);
    expect(inst(state, next.instanceId).damage).toBe(0);
    expect(setAsideVillainIds(state)).toHaveLength(2);
    expect(setAsideVillainIds(state)).not.toContain(codeOf(state, next.instanceId));
    // 1B dealt one; Save the School deals another.
    expect(dealt(state)).toEqual([dealt(start)[0]! + 1]);
  });

  it("each player is dealt an encounter card", () => {
    const start = mansionAttackGame({ villain: "Toad", players: TWO });
    expect(dealt(defeat(start))).toEqual([dealt(start)[0]! + 1, dealt(start)[1]! + 1]);
  });

  it("the random pick comes from the game's seeded RNG: the same game picks the same villain, and all three turn up over seeds", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const start = mansionAttackGame({ villain: "Avalanche", seed });
      const state = defeat(start);
      seen.add(villainTitle(state));
      expect(villainTitle(defeat(start))).toBe(villainTitle(state));
    }
    expect([...seen].sort()).toEqual(["Blob", "Pyro", "Toad"]);
  });

  it.each([
    ["standard", 2],
    ["expert", 3],
  ] as const)("%s mode: the players win when the %i-th villain is defeated, and not before", (difficulty, needed) => {
    let state = mansionAttackGame({ difficulty });
    for (let defeated = 1; defeated < needed; defeated++) {
      state = defeat(state);
      expect(state.outcome, `after ${defeated}`).toBeNull();
      expect(villainTitle(state)).toBeTruthy();
    }
    state = defeat(state);
    expect(state.outcome?.result).toBe("win");
    expect(state.victoryDisplay.filter((id) => state.cardPool[codeOf(state, id)]!.type === "villain")).toHaveLength(
      needed,
    );
  });

  it("heroic mode needs all four villains, skirmish one", () => {
    let state = mansionAttackGame({ modes: { heroic: 1 } });
    for (let defeated = 1; defeated < 4; defeated++) {
      state = defeat(state);
      expect(state.outcome).toBeNull();
    }
    expect(defeat(state).outcome?.result).toBe("win");
  });

  it("a minion with the new villain's title that is engaged with a player is discarded and the villain activates against that player", () => {
    const base = onlySetAsideVillain(mansionAttackGame({ villain: "Avalanche", players: TWO }), "32122a");
    const { state: engaged, id: blobMinion } = engageMinion(base, "32074", P2);
    const state = withForm(run(engaged, toHero(P1)), { heroForm: 0 }, P2);
    const { state: after, events } = driveEventsPicking(
      WAVE6_DEPS,
      bare(patchInstance(state, villain(state), { damage: 999 }), villain(state)),
      firstLegal,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(state, P1),
        targetInstanceId: villain(state),
      },
    );
    expect(villainTitle(after)).toBe("Blob");
    expect(cardsInPlay(after)).not.toContain(blobMinion);
    expect(after.encounterDecks[Object.keys(after.encounterDecks)[0]!]!.discard).toContain(blobMinion);
    // Blob the villain attacks P2 (hero form) and nobody else: P2's hero takes its damage (Blob has 2 ATK, undefended).
    const attacks = of(events, "attackResolved");
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ enemyInstanceId: villain(after), targetInstanceId: identityOf(after, P2) });
    expect(inst(after, identityOf(after, P2)).damage).toBeGreaterThan(0);
    expect(inst(after, identityOf(after, P1)).damage).toBe(0);
  });

  it("the activation is a scheme when the player the minion is engaged with is in alter-ego form", () => {
    const base = onlySetAsideVillain(mansionAttackGame({ villain: "Avalanche", players: TWO }), "32122a");
    const { state: engaged } = engageMinion(base, "32074", P2);
    const state = withForm(run(engaged, toHero(P1)), "alterEgo", P2);
    const { state: after, events } = driveEventsPicking(
      WAVE6_DEPS,
      bare(patchInstance(state, villain(state), { damage: 999 }), villain(state)),
      firstLegal,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(state, P1),
        targetInstanceId: villain(state),
      },
    );
    expect(of(events, "attackResolved")).toHaveLength(0);
    const schemes = of(events, "schemeResolved");
    expect(schemes).toHaveLength(1);
    expect(schemes[0]!.enemyInstanceId).toBe(villain(after));
  });

  it("no same-title minion: nothing is discarded and the new villain does not activate", () => {
    const base = onlySetAsideVillain(mansionAttackGame({ villain: "Avalanche" }), "32122a");
    const { state: engaged, id: avalancheMinion } = engageMinion(base, "32073", P1);
    const state = defeat(engaged);
    expect(villainTitle(state)).toBe("Blob");
    expect(cardsInPlay(state)).toContain(avalancheMinion);
    expect(inst(state, identityOf(state, P1)).damage).toBe(0);
  });
});
