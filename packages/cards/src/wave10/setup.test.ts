import { WAVE10_SCENARIOS, WAVE10_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  COMPETITIVE_MODE_UNAVAILABLE_MESSAGE,
  createGame,
  maxHitPoints,
  replay,
  sessionApply,
  startSession,
  type GameSetupConfig,
  type GameState,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, settle } from "../testing/harness.js";
import { WAVE10_CARDS } from "./cards.js";
import { WAVE10_DEPS } from "./index.js";
import { wave10Scenario, wave10StarterDeckSetup, type Wave10ScenarioOptions } from "./setup.js";
import {
  CAPTAIN_AMERICA_SCENARIO,
  CAPTAIN_MARVEL_SCENARIO,
  HULKLING_DECK,
  IRON_MAN_SCENARIO,
  SPIDER_WOMAN_SCENARIO,
  TIGRA_DECK,
  civilWarConfig,
  civilWarGame,
  civilWarSetup,
} from "./testing.js";

describe("wave10StarterDeckSetup", () => {
  it.each([
    ["tigra-aggression", "56001a"],
    ["hulkling-protection", "56029a"],
  ])("%s expands to its 40 cards under its identity", (id, identity) => {
    const seat = wave10StarterDeckSetup(id);
    expect(seat.identityCardId).toBe(identity);
    const listed = WAVE10_STARTER_DECKS.find((d) => d.id === id)!;
    expect(seat.deck).toHaveLength(listed.cards.reduce((sum, c) => sum + c.quantity, 0));
    expect(seat.deck).toHaveLength(40);
  });

  it("seats a Core starter deck too, and refuses an unknown id", () => {
    expect(wave10StarterDeckSetup("core-spider-man-justice").identityCardId).toBe("01001a");
    expect(() => wave10StarterDeckSetup("nope")).toThrow(/no wave 10 or Core starter deck nope/);
  });
});

/**
 * docs/phase7-wave10.md §3.1 (MC56 pp. 4-8): what `wave10Scenario` guarantees about a Civil War game, read from the
 * config and from the state `createGame` returns, before any card ability resolves. Nothing here needs a leader's or a
 * main scheme's script.
 */

const SEATS = [
  { starterDeckId: TIGRA_DECK },
  { starterDeckId: HULKLING_DECK },
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-she-hulk-aggression" },
] as const;

const byId = new Map<string, AnyCard>(WAVE10_CARDS.map((card) => [card.id as string, card]));

const build = (scenarioId: string, options: Partial<Wave10ScenarioOptions> = {}): GameSetupConfig =>
  wave10Scenario(scenarioId, { players: SEATS.slice(0, 1), seed: 7, ...options });

function create(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE10_DEPS);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return created.state;
}

/** How many cards of each encounter set the config's encounter deck holds. */
function deckBySet(config: GameSetupConfig): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of config.encounterDeck ?? []) {
    const card = byId.get(id as string)!;
    const sets = "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
    expect(sets, `${id} names one encounter set`).toHaveLength(1);
    counts[sets[0]!] = (counts[sets[0]!] ?? 0) + 1;
  }
  return counts;
}

const stageNameAt = (state: GameState): string | undefined => {
  const card = byId.get(state.mainScheme.cardId as string)!;
  if (card.type !== "main_scheme") throw new Error("not a main scheme");
  return card.stages[state.mainScheme.stageIndex]!.name;
};

/** MC56 pp. 7-8, each leader's card: hit points per player at stage I and at stage III, and the preconstructed deck. */
const PRECONS = [
  {
    id: IRON_MAN_SCENARIO,
    leader: "56059",
    leaderSet: "iron_man_leader",
    hp: { standard: 12, expert: 16 },
    mainScheme: "56063a",
    stageIndexes: [0, 1],
    stage1: "Cut Off Support",
    modular: ["mighty_avengers", "the_initiative", "maria_hill_modular", "dangerous_recruits"],
  },
  {
    id: CAPTAIN_MARVEL_SCENARIO,
    leader: "56092",
    leaderSet: "captain_marvel_leader",
    hp: { standard: 14, expert: 18 },
    mainScheme: "56063a",
    stageIndexes: [2, 3],
    stage1: "S.H.I.E.L.D. Recruits",
    modular: ["cape_killer", "martial_law", "heroes_for_hire", "paladin"],
  },
  {
    id: CAPTAIN_AMERICA_SCENARIO,
    leader: "56137",
    leaderSet: "captain_america_leader",
    hp: { standard: 14, expert: 18 },
    mainScheme: "56141a",
    stageIndexes: [0, 1],
    stage1: "Gathering Support",
    modular: ["new_avengers", "secret_avengers", "namor_modular", "atlanteans"],
  },
  {
    id: SPIDER_WOMAN_SCENARIO,
    leader: "56168",
    leaderSet: "spider_woman_leader",
    hp: { standard: 13, expert: 17 },
    mainScheme: "56141a",
    stageIndexes: [2, 3],
    stage1: "Open Rebellion",
    modular: ["spider_man_modular", "defenders", "hells_kitchen", "cloak_and_dagger_modular"],
  },
] as const;

describe("wave10Scenario: the four preconstructed scenarios (MC56 pp. 7-8)", () => {
  it("are the Civil War box's four records (Synthezoid Smackdown's two follow them in WAVE10_SCENARIOS)", () => {
    expect(
      WAVE10_SCENARIOS.filter((scenario) => (scenario.packCode as string) === "cw").map((scenario) => scenario.id),
    ).toEqual(PRECONS.map((precon) => precon.id));
  });

  describe.each(PRECONS)("$id", (precon) => {
    it.each([
      ["standard", 1, 0, 1],
      ["standard", 2, 0, 1],
      ["standard", 4, 0, 1],
      ["expert", 1, 2, 3],
      ["expert", 2, 2, 3],
      ["expert", 4, 2, 3],
    ] as const)(
      "%s, %i player(s): the leader starts at stage index %i and ends at %i",
      (difficulty, n, first, last) => {
        const state = create(build(precon.id, { players: SEATS.slice(0, n), difficulty }));
        expect(state.villains).toHaveLength(1);
        const leader = state.villains[0]!;
        expect(leader.cardId).toBe(precon.leader);
        expect([leader.stageIndex, leader.lastStageIndex]).toEqual([first, last]);
        expect(leader.defeated).toBe(false);
        expect(maxHitPoints(state, leader.instanceId, WAVE10_DEPS)).toBe(precon.hp[difficulty] * n);
        expect(state.players).toHaveLength(n);
      },
    );

    it("the stages in use are I and II in standard mode, III and IV in expert mode", () => {
      const villain = byId.get(precon.leader)!;
      if (villain.type !== "villain") throw new Error("not a villain");
      const numbers = villain.sides[0]!.stages.map((stage) => stage.stageNumber);
      const standard = build(precon.id);
      const expert = build(precon.id, { difficulty: "expert" });
      expect([numbers[standard.villainStartStageIndex!], numbers[standard.villainLastStageIndex!]]).toEqual([1, 2]);
      expect([numbers[expert.villainStartStageIndex!], numbers[expert.villainLastStageIndex!]]).toEqual([3, 4]);
      expect(standard.difficulty).toBeUndefined();
      expect(expert.difficulty).toBe("expert");
    });

    it("the main scheme deck is the recommended stage 1 over the recommended stage 2, with no threat on it", () => {
      const config = build(precon.id);
      expect(config.mainSchemeCardId).toBe(precon.mainScheme);
      expect(config.mainSchemeStageIndexes).toEqual(precon.stageIndexes);
      const state = create(config);
      expect(state.mainScheme.cardId).toBe(precon.mainScheme);
      expect(state.mainScheme.stageIndex).toBe(precon.stageIndexes[0]);
      expect(state.mainScheme.stageOrder).toEqual(precon.stageIndexes);
      expect(stageNameAt(state)).toBe(precon.stage1);
      // Every Civil War stage prints a starting threat of 0; hinder is the stage's own text.
      expect(state.instances[state.mainScheme.instanceId]!.threat).toBe(0);
    });

    it("the encounter deck is the leader's 10, the four modular sets' 5 each and the Standard set's 7", () => {
      const config = build(precon.id);
      expect(deckBySet(config)).toEqual({
        [precon.leaderSet]: 10,
        ...Object.fromEntries(precon.modular.map((set) => [set, 5])),
        standard: 7,
      });
      expect(config.encounterDeck).toHaveLength(37);
      expect(config.setAside).toBeUndefined();
    });

    it("expert mode adds the Expert set's 3 and nothing else", () => {
      const config = build(precon.id, { difficulty: "expert" });
      expect(deckBySet(config)).toEqual({
        [precon.leaderSet]: 10,
        ...Object.fromEntries(precon.modular.map((set) => [set, 5])),
        standard: 7,
        expert: 3,
      });
      expect(config.encounterDeck).toHaveLength(40);
    });
  });

  it("each player's obligation joins the 37 and each nemesis set stays out of the deck; stage 1A's Setup takes Stark Tower out", () => {
    for (const n of [1, 2, 4]) {
      const state = create(build(IRON_MAN_SCENARIO, { players: SEATS.slice(0, n) }));
      const deck = state.encounterDecks[state.villains[0]!.encounterDeckId]!.deck;
      // 37 + n cards are built; the main scheme's Setup finds the leader's side scheme and reveals it (MC56 stage 1A),
      // so Stark Tower (56072) is in play and no longer in the deck.
      expect(deck).toHaveLength(37 + n - 1);
      expect(state.villainArea.map((id) => state.instances[id]!.cardId)).toEqual(["56072"]);
    }
  });
});

describe("wave10Scenario: a custom scenario (MC56 pp. 4-5)", () => {
  it("takes three modular sets and another stage pair of the leader's side", () => {
    const config = build(SPIDER_WOMAN_SCENARIO, {
      modularSetIds: ["new_avengers", "namor_modular", "atlanteans"],
      mainSchemeStageIds: ["56199b", "56202b"],
    });
    expect(deckBySet(config)).toEqual({
      spider_woman_leader: 10,
      new_avengers: 5,
      namor_modular: 5,
      atlanteans: 5,
      standard: 7,
    });
    expect(config.encounterDeck).toHaveLength(32);
    expect(config.mainSchemeStageIndexes).toEqual([4, 7]);
    const state = create(config);
    expect(state.villains[0]!.cardId).toBe("56168");
    expect(state.mainScheme.stageOrder).toEqual([4, 7]);
    expect(stageNameAt(state)).toBe("Rallying Call");
  });

  it("takes Public Outrage and No Going Back at Captain Marvel", () => {
    const config = build(CAPTAIN_MARVEL_SCENARIO, { mainSchemeStageIds: ["56122b", "56124b"] });
    expect(config.mainSchemeStageIndexes).toEqual([5, 7]);
    expect(stageNameAt(create(config))).toBe("Public Outrage");
  });

  it("counts a neutral set from another product as one of the three or four (question 7 = A)", () => {
    const three = build(IRON_MAN_SCENARIO, { modularSetIds: ["mighty_avengers", "the_initiative", "bomb_scare"] });
    expect(deckBySet(three)).toEqual({
      iron_man_leader: 10,
      mighty_avengers: 5,
      the_initiative: 5,
      bomb_scare: 6,
      standard: 7,
    });
    expect(() =>
      build(IRON_MAN_SCENARIO, {
        modularSetIds: ["mighty_avengers", "the_initiative", "maria_hill_modular", "dangerous_recruits", "bomb_scare"],
      }),
    ).toThrow("Registration: Iron Man uses 3 to 4 modular sets, got 5");
  });

  it("seats a hero against the leader of the same name (question 5 = A)", () => {
    const state = create(
      build(CAPTAIN_MARVEL_SCENARIO, { players: [{ starterDeckId: "core-captain-marvel-leadership" }] }),
    );
    expect(state.villains[0]!.cardId).toBe("56092");
    expect(state.players[0]!.identity.cardId).toBe("01010a");
  });
});

describe("wave10Scenario: refusals", () => {
  const refusal = (scenarioId: string, options: Partial<Wave10ScenarioOptions>): string => {
    try {
      build(scenarioId, options);
    } catch (error) {
      return (error as Error).message;
    }
    return "accepted";
  };

  it("a modular set of the other side (MC56 p. 4; ruling Jan 11, 2026)", () => {
    expect(
      refusal(CAPTAIN_AMERICA_SCENARIO, {
        modularSetIds: ["new_avengers", "secret_avengers", "namor_modular", "heroes_for_hire"],
      }),
    ).toBe(
      "Resistance: Captain America: Heroes for Hire is a registration set; Captain America leads the resistance (MC56 p. 4)",
    );
    expect(refusal(IRON_MAN_SCENARIO, { modularSetIds: ["mighty_avengers", "the_initiative", "atlanteans"] })).toBe(
      "Registration: Iron Man: Atlanteans is a resistance set; Iron Man leads the registration side (MC56 p. 4)",
    );
  });

  it("two modular sets, five modular sets, none", () => {
    expect(refusal(IRON_MAN_SCENARIO, { modularSetIds: ["mighty_avengers", "the_initiative"] })).toBe(
      "Registration: Iron Man uses 3 to 4 modular sets, got 2",
    );
    expect(
      refusal(SPIDER_WOMAN_SCENARIO, {
        modularSetIds: ["spider_man_modular", "defenders", "hells_kitchen", "cloak_and_dagger_modular", "atlanteans"],
      }),
    ).toBe("Resistance: Spider-Woman uses 3 to 4 modular sets, got 5");
    expect(refusal(CAPTAIN_MARVEL_SCENARIO, { modularSetIds: [] })).toBe(
      "Registration: Captain Marvel uses 3 to 4 modular sets, got 0",
    );
  });

  it("a set chosen twice, the other leader's set, a Standard PvP set", () => {
    expect(refusal(IRON_MAN_SCENARIO, { modularSetIds: ["paladin", "paladin", "cape_killer"] })).toBe(
      "Registration: Iron Man: a modular set is chosen twice",
    );
    expect(refusal(IRON_MAN_SCENARIO, { modularSetIds: ["paladin", "cape_killer", "captain_marvel_leader"] })).toBe(
      "Registration: Iron Man: captain_marvel_leader belongs to another scenario",
    );
    expect(refusal(IRON_MAN_SCENARIO, { modularSetIds: ["paladin", "cape_killer", "standard_pvp_registration"] })).toBe(
      "Registration: Iron Man: standard_pvp_registration is a competitive-mode set",
    );
    expect(refusal(IRON_MAN_SCENARIO, { difficultySets: { standard: "standard_pvp_registration" } as never })).toBe(
      "Registration: Iron Man: difficultySets: standard set standard_pvp_registration is not in the standard classification",
    );
  });

  it("a stage of the other side", () => {
    expect(refusal(IRON_MAN_SCENARIO, { mainSchemeStageIds: ["56141b", "56064b"] })).toBe(
      "Registration: Iron Man: Gathering Support is a resistance stage; Iron Man leads the registration side (MC56 p. 4)",
    );
    expect(refusal(SPIDER_WOMAN_SCENARIO, { mainSchemeStageIds: ["56172b", "56124b"] })).toBe(
      "Resistance: Spider-Woman: No Going Back is a registration stage; Spider-Woman leads the resistance (MC56 p. 4)",
    );
  });

  it("two stage 1s, a stage 2 before a stage 1, one stage only, an unknown stage", () => {
    expect(refusal(CAPTAIN_MARVEL_SCENARIO, { mainSchemeStageIds: ["56063b", "56096b"] })).toBe(
      "Registration: Captain Marvel: Choose only one stage 1: both Cut Off Support (stage 1) and S.H.I.E.L.D. Recruits (stage 1) are chosen.",
    );
    expect(refusal(CAPTAIN_MARVEL_SCENARIO, { mainSchemeStageIds: ["56064b", "56063b"] })).toBe(
      "Registration: Captain Marvel: Cut Off Support (stage 1) cannot come after Negative Zone Prison (stage 2): choose stages in ascending stage number.",
    );
    expect(refusal(CAPTAIN_MARVEL_SCENARIO, { mainSchemeStageIds: ["56063b"] })).toBe(
      "Registration: Captain Marvel: Choose a stage 2 of Superhero Registration Act: one stage of each number is needed.",
    );
    expect(refusal(CAPTAIN_MARVEL_SCENARIO, { mainSchemeStageIds: ["56063b", "99999b"] })).toBe(
      "Registration: Captain Marvel: 99999b is not a stage of Superhero Registration Act",
    );
  });

  it("competitive mode: the builder passes it on and the engine refuses it with mode_unavailable", () => {
    const config = build(IRON_MAN_SCENARIO, { gameMode: "competitive" });
    expect(config.gameMode).toBe("competitive");
    const created = createGame(config, WAVE10_DEPS);
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe("mode_unavailable");
    expect(created.error.message).toBe("Competitive mode is coming soon. Play this scenario cooperatively for now.");
    expect(created.error.message).toBe(COMPETITIVE_MODE_UNAVAILABLE_MESSAGE);
    expect(build(IRON_MAN_SCENARIO, { gameMode: "cooperative" }).gameMode).toBe("cooperative");
    expect(build(IRON_MAN_SCENARIO).gameMode).toBeUndefined();
  });

  it("an unknown scenario, no players, five players", () => {
    expect(refusal("rhino", {})).toBe("no wave 10 scenario rhino");
    expect(refusal(IRON_MAN_SCENARIO, { players: [] })).toBe("a game has 1-4 players");
    expect(refusal(IRON_MAN_SCENARIO, { players: [...SEATS, SEATS[0]] })).toBe("a game has 1-4 players");
  });
});

describe("wave10Scenario: save and replay", () => {
  const custom = (): GameSetupConfig =>
    build(CAPTAIN_AMERICA_SCENARIO, {
      players: SEATS.slice(0, 2),
      difficulty: "expert",
      modularSetIds: ["new_avengers", "namor_modular", "atlanteans"],
      mainSchemeStageIds: ["56200b", "56201b"],
      seed: 20261012,
    });

  it("a custom scenario's config is plain data: it survives JSON and builds the same game", () => {
    const config = custom();
    const saved = JSON.parse(JSON.stringify(config)) as GameSetupConfig;
    expect(saved).toEqual(config);
    expect(saved.mainSchemeStageIndexes).toEqual([5, 6]);
    expect(JSON.stringify(create(saved))).toBe(JSON.stringify(create(config)));
    expect(JSON.stringify(create(custom()))).toBe(JSON.stringify(create(config)));
  });

  it("the game's log, saved and loaded, replays to the identical state", () => {
    let session = startSession(create(custom()));
    for (let step = 0; step < 6 && session.state.pendingChoice; step++) {
      const choice = session.state.pendingChoice;
      const result = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(session.state),
        },
        WAVE10_DEPS,
      );
      if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
      session = result.session;
    }
    expect(session.log.commands.length).toBeGreaterThan(0);
    const loaded = JSON.parse(JSON.stringify(session.log)) as typeof session.log;
    const replayed = replay(loaded, WAVE10_DEPS);
    if (!replayed.ok) throw new Error(`replay failed at command ${replayed.commandIndex}`);
    expect(JSON.stringify(replayed.state)).toBe(JSON.stringify(session.state));
    expect(replayed.state.mainScheme.stageOrder).toEqual([5, 6]);
    expect(replayed.state.villains[0]!.cardId).toBe("56137");
  });
});

describe("civilWarGame (testing.ts)", () => {
  it("civilWarConfig seats Tigra by default, Hulkling or a second seat on request, and passes the choices on", () => {
    expect(civilWarConfig(IRON_MAN_SCENARIO).players.map((seat) => seat.identityCardId)).toEqual(["56001a"]);
    const config = civilWarConfig(SPIDER_WOMAN_SCENARIO, {
      starterDeckId: HULKLING_DECK,
      twoPlayers: true,
      difficulty: "expert",
      modularSetIds: ["defenders", "hells_kitchen", "atlanteans"],
      mainSchemeStageIds: ["56199b", "56202b"],
    });
    expect(config.players.map((seat) => seat.identityCardId)).toEqual(["56029a", "01001a"]);
    expect(config.mainSchemeStageIndexes).toEqual([4, 7]);
    expect(config.encounterDeck).toHaveLength(10 + 15 + 7 + 3);
    expect(config.requireLegalDecks).toBe(true);
    expect(civilWarConfig(IRON_MAN_SCENARIO, { swap: { "56002": "01090" } }).requireLegalDecks).toBe(false);
  });

  it("civilWarSetup stops at the mulligan; civilWarGame plays setup through to the first player's turn", () => {
    // Captain America's stage 1B (Gathering Support) opens with the enemy team's minion search, before the hands are drawn.
    const setup = civilWarSetup(CAPTAIN_AMERICA_SCENARIO);
    expect(setup.step).toMatchObject({ phase: "setup", kind: "drawStartingHands" });
    expect(setup.pendingChoice).toMatchObject({ authority: "enemyTeam" });
    // Answering it leads to the mulligan, as before the main scheme was scripted.
    const mulligan = settle(setup, firstLegal, (s) => s.step.kind === "mulligan", WAVE10_DEPS);
    expect(mulligan.step).toMatchObject({ phase: "setup", kind: "mulligan" });
    const game = civilWarGame(CAPTAIN_AMERICA_SCENARIO);
    expect(game.step.phase).toBe("player");
    expect(game.villains[0]!.cardId).toBe("56137");
    expect(game.outcome).toBeFalsy();
  });
});
