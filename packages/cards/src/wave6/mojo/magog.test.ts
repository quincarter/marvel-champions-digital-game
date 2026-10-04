import {
  activeVillain,
  cardsInPlay,
  hasKeyword,
  remainingHitPoints,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { MAGOG_ABILITIES } from "./magog.js";
import { challengersOf, championOf, inEncounterPiles, inPlay, magogGame } from "./magog-testing.js";

const deps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const villain = (state: GameState) => activeVillain(state).instanceId;
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const ratings = (state: GameState, id: InstanceId): number => inst(state, id).counters["ratings"] ?? 0;
const withRatings = (state: GameState, id: InstanceId, n: number): GameState =>
  patchInstance(state, id, { counters: { ...inst(state, id).counters, ratings: n } });
const champion = (state: GameState) => ratings(state, championOf(state));
const challengers = (state: GameState) => ratings(state, challengersOf(state));
const flipped = (state: GameState, id: InstanceId): boolean => inst(state, id).flipped;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

/** The main scheme's threat emptied, so that its completion (which puts counters on The Champion) is not in play. */
const calm = (state: GameState): GameState => patchInstance(state, mainScheme(state), { threat: 0 });

const heroGame = (options: Parameters<typeof magogGame>[0] = {}) => run(magogGame(options), toHero(P1));

/** Assault, a boost card with no boost icons: the villain's activation draws one before its attack or scheme. */
const NO_BOOST = "01187";
const JOLT = "39005";
const SURGE = "39006";
const SURPRISE_CONTENDER = "39007";
const PUMP_UP = "39008";
/** Revealed in a test that is not about the revealed card: a side scheme, which puts no counters anywhere. */
const NEUTRAL = PUMP_UP;
const BREAK_A_LEG = "39009";
const DEFEND_THE_TITLE = "39010";
const STAGE_FRIGHT = "39011";

/** Every player, starting with the one whose turn it is (the first player token moves on each round). */
const inTurnOrder = (state: GameState): PlayerId[] => {
  const ids = state.players.map((p) => p.playerId);
  const at = Math.max(0, ids.indexOf(state.firstPlayerId));
  return [...ids.slice(at), ...ids.slice(0, at)];
};
/** One villain phase (every player ending their turn): the boost card, then each player's reveal. */
const villainPhase = (state: GameState, top: readonly string[], pick: Picker = firstLegal) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...top),
    pick,
    ...inTurnOrder(state).map((playerId) => ({ type: "endTurn" as const, playerId })),
  );
/** Alter-ego form (the game's start) with `code` revealed at the end of the turn. */
const revealAsAlterEgo = (state: GameState, code: string) => villainPhase(state, [NO_BOOST, code]);
describe("registry", () => {
  it("registers every ability ref of the MaGog set (both faces, boost abilities included)", () => {
    expect(Object.keys(MAGOG_ABILITIES).sort()).toEqual(
      [
        "39001a.magog-forced-response",
        "39001a.magog-forced-interrupt",
        "39001b.magog-forced-response",
        "39001b.magog-forced-interrupt",
        "39002a.setup",
        "39002b.melee-in-the-mojo-seum-constant",
        "39002b.melee-in-the-mojo-seum-forced-interrupt",
        "39003a.the-champion-constant",
        "39003b.underdogs",
        "39003b.the-champion-constant",
        "39004a.the-challengers-constant",
        "39004b.tag-team",
        "39004b.the-challengers-constant",
        "39005.jolt-of-adrenaline-constant",
        "39005.jolt-of-adrenaline-forced-response",
        "39005.boost",
        "39006.surge-of-aggression-forced-response",
        "39006.boost",
        "39007.surprise-contender-forced-response",
        "39007.when-defeated",
        "39008.when-revealed",
        "39008.when-defeated",
        "39009.when-revealed",
        "39010.when-revealed-alter-ego",
        "39010.when-revealed-hero",
        "39011.when-revealed",
        "39011.boost",
      ].sort(),
    );
  });
});

describe("Melee in the Mojo-seum 1A Setup (39002a.setup)", () => {
  it("puts The Champion and The Challengers into play on their BOOING CROWD sides, without ratings counters", () => {
    const state = magogGame();
    expect(inPlay(state, "39003a")).toHaveLength(1);
    expect(inPlay(state, "39004a")).toHaveLength(1);
    expect(inPlay(state, "39003b")).toHaveLength(0);
    expect(inPlay(state, "39004b")).toHaveLength(0);
    expect(flipped(state, championOf(state))).toBe(false);
    expect(flipped(state, challengersOf(state))).toBe(false);
    expect(champion(state)).toBe(0);
    expect(challengers(state)).toBe(0);
    expect(inEncounterPiles(state, "39003a")).toEqual([]);
    expect(inEncounterPiles(state, "39004a")).toEqual([]);
  });

  it("seats MaGog (standard) and the main scheme; the crowds are not the villain's cards", () => {
    const state = magogGame();
    expect(state.instances[villain(state)]!.cardId).toBe("39001a");
    expect(state.instances[mainScheme(state)]!.cardId).toBe("39002a");
    expect(state.outcome).toBeNull();
  });

  it("an expert game starts with the expert MaGog (39001b)", () => {
    const state = magogGame({ difficulty: "expert" });
    expect(state.instances[villain(state)]!.cardId).toBe("39001b");
  });
});

describe("The Champion (39003a/b)", () => {
  it("39003a: stays on its BOOING CROWD side below 5[per_hero] ratings counters (4 with one hero)", () => {
    const state = magogGame();
    const staged = withRatings(state, championOf(state), 2);
    const { state: after } = revealAsAlterEgo(staged, DEFEND_THE_TITLE); // +2 = 4
    expect(champion(after)).toBe(4);
    expect(flipped(after, championOf(after))).toBe(false);
  });

  it("39003a: flips at 5 ratings counters, keeping them (one hero)", () => {
    const state = magogGame();
    const staged = withRatings(state, championOf(state), 3);
    const { state: after } = revealAsAlterEgo(staged, DEFEND_THE_TITLE); // +2 = 5
    expect(champion(after)).toBe(5);
    expect(flipped(after, championOf(after))).toBe(true);
  });

  it("39003a: the threshold is per hero (10 with two heroes)", () => {
    const state = magogGame({ players: TWO });
    const staged = withRatings(state, championOf(state), 3);
    // Both players reveal a Defend the Title in alter-ego form: +2 each.
    const both = [NO_BOOST, NO_BOOST, DEFEND_THE_TITLE, DEFEND_THE_TITLE];
    const { state: below } = villainPhase(staged, both);
    expect(champion(below)).toBe(7);
    expect(flipped(below, championOf(below))).toBe(false);
    const more = withRatings(calm(below), championOf(below), 6);
    const { state: at } = villainPhase(more, both);
    expect(champion(at)).toBe(10);
    expect(flipped(at, championOf(at))).toBe(true);
  });

  it("39003b Underdogs: after The Champion flips to this side, each player draws 1 card", () => {
    const state = magogGame({ players: TWO });
    const staged = withRatings(state, championOf(state), 8);
    const handBefore = [P1, P2].map((p) => playerOf(staged, p).hand.length);
    const { state: after, events } = villainPhase(staged, [NO_BOOST, NO_BOOST, DEFEND_THE_TITLE, NEUTRAL]);
    expect(flipped(after, championOf(after))).toBe(true);
    // The two end-of-turn draws are the same for both players with or without Underdogs: compare against a no-flip run.
    const control = villainPhase(withRatings(state, championOf(state), 0), [
      NO_BOOST,
      NO_BOOST,
      DEFEND_THE_TITLE,
      NEUTRAL,
    ]).state;
    for (const [i, p] of [P1, P2].entries()) {
      expect(playerOf(after, p).hand.length, p).toBe(playerOf(control, p).hand.length + 1);
      expect(handBefore[i]).toBeDefined();
    }
    expect(of(events, "cardFlipped")).toHaveLength(1);
  });

  it("39003b: at 10[per_hero] ratings counters MaGog wins again and the players lose", () => {
    const state = magogGame();
    const flippedOnce = revealAsAlterEgo(withRatings(state, championOf(state), 3), DEFEND_THE_TITLE).state; // 5, flipped
    expect(flippedOnce.outcome).toBeNull();
    const quiet = calm(flippedOnce);
    const nearly = withRatings(quiet, championOf(quiet), 7);
    const { state: below } = revealAsAlterEgo(nearly, NEUTRAL);
    expect(champion(below)).toBe(7);
    expect(below.outcome).toBeNull();
    const { state: lost } = revealAsAlterEgo(withRatings(quiet, championOf(quiet), 8), DEFEND_THE_TITLE); // 10
    expect(champion(lost)).toBe(10);
    // The card's own text lost it, and the outcome names the card (the Game Over screen's cause), not the main scheme.
    expect(lost.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: championOf(lost) });
  });

  it("39003a: the BOOING CROWD side does not end the game even far past 10 (it flips first)", () => {
    const state = magogGame();
    const staged = withRatings(state, championOf(state), 4);
    const { state: after } = revealAsAlterEgo(staged, DEFEND_THE_TITLE);
    expect(after.outcome).toBeNull();
  });
});

/** Pump Up the Crowd put into the villain area with `threat` and thwarted by a basic thwart from the hero: its When Defeated places 1[per_hero] ratings counters on The Challengers. */
const thwartPumpUp = (state: GameState, threat = 1, player = P1): GameState => {
  const { state: staged0, id } = encounterCardInVillainArea(state, PUMP_UP, threat);
  const staged = patchInstance(staged0, identityOf(staged0, player), { exhausted: false });
  return settle(
    run(staged, {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(staged, player),
      schemeInstanceId: id,
    }),
    firstLegal,
    undefined,
    deps,
  );
};

describe("The Challengers (39004a/b)", () => {
  it("39004a: flips at 5 ratings counters, keeping them (one hero)", () => {
    const state = heroGame();
    const staged = withRatings(state, challengersOf(state), 3);
    const below = thwartPumpUp(staged); // +1 = 4
    expect(challengers(below)).toBe(4);
    expect(flipped(below, challengersOf(below))).toBe(false);
    const at = thwartPumpUp(below); // +1 = 5
    expect(challengers(at)).toBe(5);
    expect(flipped(at, challengersOf(at))).toBe(true);
    expect(at.outcome).toBeNull();
  });

  it("39004a: the threshold is per hero (10 with two heroes)", () => {
    const state = heroGame({ players: TWO });
    const nine = thwartPumpUp(withRatings(state, challengersOf(state), 7), 1); // +2 (1 per hero) = 9
    expect(challengers(nine)).toBe(9);
    expect(flipped(nine, challengersOf(nine))).toBe(false);
    const ten = thwartPumpUp(nine);
    expect(challengers(ten)).toBe(11);
    expect(flipped(ten, challengersOf(ten))).toBe(true);
  });

  describe("39004b Tag Team: after The Challengers flips to this side", () => {
    // One hero: 4 + 1 = 5; two heroes: 8 + 2 = 10, the threshold being 5[per_hero].
    const flipNow = (state: GameState, from = 4) => thwartPumpUp(withRatings(state, challengersOf(state), from));
    const contenders = (state: GameState) => inPlay(state, SURPRISE_CONTENDER);

    it("puts Surprise Contender from the encounter deck into play engaged with the first player", () => {
      const base = heroGame({ players: TWO });
      const after = flipNow(base, 8);
      expect(flipped(after, challengersOf(after))).toBe(true);
      expect(contenders(after)).toHaveLength(1);
      const contender = inst(after, contenders(after)[0]!);
      expect(contender.engagedWith).toBe(P1);
      expect(contender.statuses.tough).toBe(0);
      expect(inEncounterPiles(after, SURPRISE_CONTENDER)).toEqual([]);
    });

    it("finds it in the encounter discard pile too", () => {
      const state = heroGame();
      const [id] = inEncounterPiles(state, SURPRISE_CONTENDER) as [InstanceId];
      // Defeated earlier, it lies in the encounter discard pile.
      const discarded = {
        ...state,
        encounterDecks: Object.fromEntries(
          Object.entries(state.encounterDecks).map(([deckId, pile]) => [
            deckId,
            { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard.filter((i) => i !== id), id] },
          ]),
        ),
      };
      expect(discarded.encounterDecks[Object.keys(discarded.encounterDecks)[0]!]!.discard).toContain(id);
      const after = flipNow(discarded);
      expect(flipped(after, challengersOf(after))).toBe(true);
      expect(contenders(after)).toHaveLength(1);
      expect(inst(after, contenders(after)[0]!).engagedWith).toBe(P1);
      expect(inst(after, id).statuses.tough).toBe(0);
    });

    it("gives it a tough status card if it is already in play (and puts no second copy into play)", () => {
      const base = heroGame({ players: TWO });
      const { state: withContender, id } = engageMinion(base, SURPRISE_CONTENDER, P2);
      const after = flipNow(withContender, 8);
      expect(flipped(after, challengersOf(after))).toBe(true);
      expect(contenders(after)).toEqual([id]);
      expect(inst(after, id).statuses.tough).toBe(1);
      expect(inst(after, id).engagedWith).toBe(P2);
    });
  });

  it("39004b: at 10[per_hero] ratings counters you wow the crowd and the players win", () => {
    const state = heroGame();
    const flippedState = thwartPumpUp(withRatings(state, challengersOf(state), 4));
    expect(flippedState.outcome).toBeNull();
    const nine = withRatings(flippedState, challengersOf(flippedState), 8);
    expect(thwartPumpUp(nine).outcome).toBeNull(); // 9
    const won = thwartPumpUp(withRatings(flippedState, challengersOf(flippedState), 9)); // 10
    expect(challengers(won)).toBe(10);
    expect(won.outcome).toMatchObject({ result: "win" });
  });
});

const stunned = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, stunned: 1 } });
const toughOn = (state: GameState, id: InstanceId): GameState =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 1 } });
/** Declares `defender` for every attack it is offered as a defender for. */
const defendWith =
  (defender: InstanceId): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "declareDefender" &&
    state.pendingChoice.options.some((o) => o.optionId === defender)
      ? [defender]
      : firstLegal(state);
const hurt = (state: GameState, id: InstanceId): number => inst(state, id).damage;

describe("MaGog (39001a standard, 39001b expert)", () => {
  describe("Forced Response: after MaGog attacks and damages a character, place ratings counters on The Champion", () => {
    it("39001a: 1 counter after an attack that damages the hero (and the hero took the damage)", () => {
      const state = run(magogGame(), toHero(P1));
      const { state: after } = villainPhase(state, [NO_BOOST, NEUTRAL]);
      expect(hurt(after, identityOf(after))).toBe(2);
      expect(champion(after)).toBe(1);
    });

    it("39001b: 2 counters, and MaGog hits for 3", () => {
      const state = run(magogGame({ difficulty: "expert" }), toHero(P1));
      const { state: after } = villainPhase(state, [NO_BOOST, NEUTRAL]);
      expect(hurt(after, identityOf(after))).toBe(3);
      expect(champion(after)).toBe(2);
    });

    it("places nothing when the attack damages no character (a tough status card absorbs it)", () => {
      const state = run(magogGame(), toHero(P1));
      const hero = identityOf(state);
      const { state: after } = villainPhase(toughOn(state, hero), [NO_BOOST, NEUTRAL]);
      expect(hurt(after, hero)).toBe(0);
      expect(inst(after, hero).statuses.tough).toBe(0);
      expect(champion(after)).toBe(0);
    });

    it("counts damage to an ally that defends", () => {
      const iron = run(magogGame({ players: [{ starterDeckId: "core-iron-man-aggression" }] }), toHero(P1));
      const { state: withAlly, id: ally } = intoPlayArea(iron, P1, "01051"); // Tigra
      const { state: after } = villainPhase(withAlly, [NO_BOOST, NEUTRAL], defendWith(ally));
      expect(hurt(after, ally)).toBeGreaterThan(0);
      expect(hurt(after, identityOf(after))).toBe(0);
      expect(champion(after)).toBe(1);
    });

    it("places nothing when MaGog schemes instead (alter-ego form)", () => {
      const { state: after } = villainPhase(magogGame(), [NO_BOOST, NEUTRAL]);
      expect(champion(after)).toBe(0);
    });
  });

  describe("Forced Interrupt: when MaGog would be defeated, reset his hit points instead", () => {
    const defeated = (state: GameState) => defeatWithAttack(deps, state, villain(state));
    const dealt = (state: GameState, player: PlayerId) => playerOf(state, player).dealtEncounter.length;

    it("39001a: back to 10 hit points, 3 counters on The Challengers, 1 facedown encounter card dealt; no victory", () => {
      const state = heroGame();
      const after = defeated(state);
      expect(after.outcome).toBeNull();
      expect(activeVillain(after).instanceId).toBe(villain(state));
      expect(hurt(after, villain(after))).toBe(0);
      expect(remainingHitPoints(after, villain(after), deps)).toBe(10);
      expect(challengers(after)).toBe(3);
      expect(dealt(after, P1)).toBe(dealt(state, P1) + 1);
    });

    it("39001b: 2 counters instead of 3", () => {
      const state = heroGame({ difficulty: "expert" });
      const after = defeated(state);
      expect(after.outcome).toBeNull();
      expect(remainingHitPoints(after, villain(after), deps)).toBe(10);
      expect(challengers(after)).toBe(2);
      expect(dealt(after, P1)).toBe(dealt(state, P1) + 1);
    });

    it("is per hero: 20 hit points, 6 counters and a card for each of two players", () => {
      const state = heroGame({ players: TWO });
      const after = defeated(state);
      expect(after.outcome).toBeNull();
      expect(remainingHitPoints(after, villain(after), deps)).toBe(20);
      expect(challengers(after)).toBe(6);
      expect(dealt(after, P1)).toBe(dealt(state, P1) + 1);
      expect(dealt(after, P2)).toBe(dealt(state, P2) + 1);
    });

    it("is replaced every time: a second defeat resets him again", () => {
      const once = defeated(heroGame());
      const twice = defeated(patchInstance(once, identityOf(once), { exhausted: false }));
      expect(twice.outcome).toBeNull();
      expect(challengers(twice)).toBe(6); // 3 + 3, flipped at 5
      expect(flipped(twice, challengersOf(twice))).toBe(true);
      expect(remainingHitPoints(twice, villain(twice), deps)).toBe(10);
    });
  });
});

describe("Melee in the Mojo-seum (39002a/b)", () => {
  const nearlyComplete = (state: GameState) => patchInstance(state, mainScheme(state), { threat: 5 });

  it("39002b: when it would be completed, 2[per_hero] ratings counters go on The Champion and all threat is removed instead", () => {
    const state = nearlyComplete(magogGame());
    const { state: after } = villainPhase(state, [NO_BOOST, NEUTRAL]);
    expect(after.outcome).toBeNull();
    expect(champion(after)).toBe(2);
    expect(state.instances[mainScheme(after)]!.cardId).toBe("39002a");
    expect(inst(after, mainScheme(after)).threat).toBe(1); // all removed; MaGog's own scheme then adds its 1
  });

  it("39002b: two heroes, 4 counters", () => {
    const base = magogGame({ players: TWO });
    const state = patchInstance(base, mainScheme(base), { threat: 11 });
    const { state: after, events } = villainPhase(state, [NO_BOOST, NO_BOOST, NEUTRAL, DEFEND_THE_TITLE]);
    expect(after.outcome).toBeNull();
    // One placement of 2 x 2 from the scheme, and 2 more from the second player's Defend the Title.
    expect(of(events, "counterAdded").map((e) => e.amount)).toEqual([4, 2]);
    expect(champion(after)).toBe(6);
  });

  it("39002b: below its target the scheme completes nothing", () => {
    const state = patchInstance(magogGame(), mainScheme(magogGame()), { threat: 1 });
    const { state: after } = villainPhase(state, [NO_BOOST, NEUTRAL]);
    expect(champion(after)).toBe(0);
  });

  it("the players cannot win by defeating MaGog or by any threat race: 1B is only ever beaten by wowing the crowd", () => {
    // MaGog's defeat is always replaced (Forced Interrupt), so even from his last hit point the game goes on.
    const after = defeatWithAttack(
      deps,
      patchInstance(heroGame(), villain(heroGame()), { damage: 9 }),
      villain(heroGame()),
    );
    expect(after.outcome).toBeNull();
  });
});

describe("Jolt of Adrenaline (39005) and Surge of Aggression (39006)", () => {
  const withJolt = (state: GameState) => attachToHost(state, JOLT, villain(state));
  const withSurge = (state: GameState) => attachToHost(state, SURGE, villain(state));

  it("39005: MaGog gains retaliate 1 and stalwart while it is attached", () => {
    const state = heroGame();
    expect(hasKeyword(state, villain(state), "stalwart", deps)).toBe(false);
    expect(hasKeyword(state, villain(state), "retaliate", deps)).toBe(false);
    const { state: armed } = withJolt(state);
    expect(hasKeyword(armed, villain(armed), "stalwart", deps)).toBe(true);
    expect(hasKeyword(armed, villain(armed), "retaliate", deps)).toBe(true);
  });

  it("39005: retaliate 1 deals 1 damage to a hero who attacks MaGog", () => {
    const { state: armed } = withJolt(heroGame());
    const after = settle(
      run(armed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(armed),
        targetInstanceId: villain(armed),
      }),
      firstLegal,
      undefined,
      deps,
    );
    expect(hurt(after, identityOf(after))).toBe(1);
  });

  it("39006: MaGog gets +1 ATK and +1 SCH", () => {
    const { state: armed } = withSurge(run(magogGame(), toHero(P1)));
    const { state: after } = villainPhase(armed, [NO_BOOST, NEUTRAL]);
    expect(hurt(after, identityOf(after))).toBe(3);
    const { state: scheming } = withSurge(magogGame());
    const { state: plain } = villainPhase(magogGame(), [NO_BOOST, NEUTRAL]);
    const { state: surged } = villainPhase(scheming, [NO_BOOST, NEUTRAL]);
    expect(inst(surged, mainScheme(surged)).threat).toBe(inst(plain, mainScheme(plain)).threat + 1);
  });

  it("after MaGog's hit points are reset: 1[per_hero] counters on The Challengers and the card is discarded (Jolt)", () => {
    const { state: armed, id: jolt } = withJolt(heroGame());
    const after = defeatWithAttack(deps, armed, villain(armed));
    expect(challengers(after)).toBe(3 + 1);
    expect(inst(after, jolt).attachedTo).toBeNull();
    expect(cardsInPlay(after)).not.toContain(jolt);
    expect(inst(after, villain(after)).attachments).not.toContain(jolt);
    expect(after.outcome).toBeNull();
  });

  it("after MaGog's hit points are reset: 1[per_hero] counters on The Challengers and the card is discarded (Surge of Aggression)", () => {
    const { state: armed, id: surge } = withSurge(heroGame({ players: TWO }));
    const after = defeatWithAttack(deps, armed, villain(armed));
    expect(challengers(after)).toBe(6 + 2);
    expect(cardsInPlay(after)).not.toContain(surge);
  });

  it("both attached: each places its own counters, expert MaGog", () => {
    const base = heroGame({ difficulty: "expert" });
    const { state: one } = withJolt(base);
    const { state: both } = withSurge(one);
    const after = defeatWithAttack(deps, both, villain(both));
    expect(challengers(after)).toBe(2 + 1 + 1);
    expect(inst(after, villain(after)).attachments).toEqual([]);
  });

  it("neither fires when MaGog merely takes damage", () => {
    const { state: armed, id: jolt } = withJolt(heroGame());
    const after = settle(
      run(armed, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(armed),
        targetInstanceId: villain(armed),
      }),
      firstLegal,
      undefined,
      deps,
    );
    expect(cardsInPlay(after)).toContain(jolt);
    expect(challengers(after)).toBe(0);
  });

  it("[star] Boost: Reveal this card: as a boost card, each attaches to MaGog", () => {
    for (const code of [JOLT, SURGE]) {
      const state = run(magogGame(), toHero(P1));
      const { state: after } = villainPhase(state, [code, NEUTRAL]);
      const attached = inst(after, villain(after)).attachments.map((id) => after.instances[id]!.cardId as string);
      expect(attached, code).toEqual([code]);
    }
  });
});

describe("Surprise Contender (39007)", () => {
  it("[star] Forced Response: after it attacks and damages a character, 1 ratings counter on The Champion", () => {
    const state = run(magogGame(), toHero(P1));
    const { state: withContender, id: contender } = engageMinion(state, SURPRISE_CONTENDER);
    // MaGog is stunned so that only the Contender attacks: one boost card for it, then the reveal.
    const { state: after } = villainPhase(stunned(withContender, villain(withContender)), [NO_BOOST, NEUTRAL]);
    expect(hurt(after, identityOf(after))).toBe(2);
    expect(inst(after, contender).engagedWith).toBe(P1);
    expect(champion(after)).toBe(1);
  });

  it("places nothing when its attack damages nobody (tough)", () => {
    const state = run(magogGame(), toHero(P1));
    const { state: withContender } = engageMinion(state, SURPRISE_CONTENDER);
    const staged = toughOn(stunned(withContender, villain(withContender)), identityOf(withContender));
    const { state: after } = villainPhase(staged, [NO_BOOST, NEUTRAL]);
    expect(hurt(after, identityOf(after))).toBe(0);
    expect(champion(after)).toBe(0);
  });

  it("When Defeated: 2[per_hero] ratings counters on The Challengers", () => {
    const { state: withContender, id } = engageMinion(heroGame(), SURPRISE_CONTENDER);
    const after = defeatWithAttack(deps, withContender, id);
    expect(cardsInPlay(after)).not.toContain(id);
    expect(challengers(after)).toBe(2);
  });

  it("When Defeated, two heroes: 4 counters", () => {
    const { state: withContender, id } = engageMinion(heroGame({ players: TWO }), SURPRISE_CONTENDER);
    expect(challengers(defeatWithAttack(deps, withContender, id))).toBe(4);
  });

  it("is villainous (data), and a revealed copy enters play engaged with the player who revealed it", () => {
    const state = run(magogGame(), toHero(P1));
    const { state: after } = villainPhase(stunned(state, villain(state)), [SURPRISE_CONTENDER]);
    const [contender] = inPlay(after, SURPRISE_CONTENDER) as [InstanceId];
    expect(inst(after, contender).engagedWith).toBe(P1);
    expect(hasKeyword(after, contender, "villainous", deps)).toBe(true);
  });
});

/** The side schemes in the villain area printed as `code`. */
const sideSchemes = (state: GameState, code: string): InstanceId[] =>
  state.villainArea.filter((id) => state.instances[id]!.cardId === code);
/** The Champion on its CHEERING CROWD side holding `n` counters (the flip staged by surgery). */
const championCheering = (state: GameState, n: number): GameState =>
  patchInstance(state, championOf(state), { flipped: true, counters: { ratings: n } });

describe("Pump Up the Crowd (39008)", () => {
  it("When Revealed, The Champion on its BOOING CROWD side: just its 4[per_hero] starting threat", () => {
    const { state: after } = villainPhase(magogGame(), [NO_BOOST, PUMP_UP]);
    const [scheme] = sideSchemes(after, PUMP_UP) as [InstanceId];
    expect(inst(after, scheme).threat).toBe(4);
  });

  it("When Revealed, The Champion on its CHEERING CROWD side: an additional 1[per_hero] threat", () => {
    const { state: after } = villainPhase(championCheering(magogGame(), 5), [NO_BOOST, PUMP_UP]);
    const [scheme] = sideSchemes(after, PUMP_UP) as [InstanceId];
    expect(inst(after, scheme).threat).toBe(5);
  });

  it("is per hero: 8 threat, or 10 with The Champion cheering (two heroes)", () => {
    const base = magogGame({ players: TWO });
    const booing = villainPhase(base, [NO_BOOST, NO_BOOST, PUMP_UP, DEFEND_THE_TITLE]).state;
    expect(inst(booing, sideSchemes(booing, PUMP_UP)[0]!).threat).toBe(8);
    const cheering = villainPhase(championCheering(base, 10), [NO_BOOST, NO_BOOST, PUMP_UP, DEFEND_THE_TITLE]).state;
    expect(inst(cheering, sideSchemes(cheering, PUMP_UP)[0]!).threat).toBe(10);
  });

  it("When Defeated: 1[per_hero] ratings counters on The Challengers", () => {
    const after = thwartPumpUp(heroGame());
    expect(challengers(after)).toBe(1);
    expect(challengers(thwartPumpUp(heroGame({ players: TWO })))).toBe(2);
  });
});

describe("Break a Leg (39009)", () => {
  /** Answers Break a Leg's number with `n`, any other choice like `firstLegal`. */
  const placing =
    (n: number): Picker =>
    (state) =>
      state.pendingChoice?.prompt.kind === "chooseNumber" ? [String(n)] : firstLegal(state);
  const reveal = (state: GameState, pick: Picker = firstLegal) => villainPhase(state, [NO_BOOST, BREAK_A_LEG], pick);
  const ahead = (state: GameState) => withRatings(state, challengersOf(state), 1);

  it("You are stunned and take 2 damage when the counters are level", () => {
    const { state: after } = reveal(magogGame());
    const hero = identityOf(after);
    expect(inst(after, hero).statuses.stunned).toBe(1);
    expect(hurt(after, hero)).toBe(2);
    expect(champion(after)).toBe(0);
  });

  it("takes 4 damage instead when there are more ratings counters on The Challengers than on The Champion", () => {
    const { state: after } = reveal(ahead(magogGame()));
    expect(hurt(after, identityOf(after))).toBe(4);
  });

  it("level counters (1 and 1) are not 'more': 2 damage", () => {
    const state = ahead(magogGame());
    const level = withRatings(state, championOf(state), 1);
    expect(hurt(reveal(level).state, identityOf(level))).toBe(2);
  });

  it("asks for a number from 0 up to the damage it reduces (2, or 4 when the Challengers are ahead)", () => {
    const asked = (state: GameState): { min: number; max: number } => {
      let seen: { min: number; max: number } | undefined;
      reveal(state, (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "chooseNumber") seen = { min: prompt.min, max: prompt.max };
        return firstLegal(s);
      });
      return seen!;
    };
    expect(asked(magogGame())).toEqual({ min: 0, max: 2 });
    expect(asked(ahead(magogGame()))).toEqual({ min: 0, max: 4 });
  });

  it("placing 2 counters on The Champion reduces 2 damage to 0", () => {
    const { state: after } = reveal(magogGame(), placing(2));
    expect(hurt(after, identityOf(after))).toBe(0);
    expect(champion(after)).toBe(2);
    expect(inst(after, identityOf(after)).statuses.stunned).toBe(1);
  });

  it("placing 1 of 4 leaves 3 damage and 1 counter on The Champion", () => {
    const { state: after } = reveal(ahead(magogGame()), placing(1));
    expect(hurt(after, identityOf(after))).toBe(3);
    expect(champion(after)).toBe(1);
  });

  it("placing all 4 leaves no damage", () => {
    const { state: after } = reveal(ahead(magogGame()), placing(4));
    expect(hurt(after, identityOf(after))).toBe(0);
    expect(champion(after)).toBe(4);
  });
});

describe("Defend the Title (39010)", () => {
  it("When Revealed (Alter-Ego): 2 ratings counters on The Champion (not per hero)", () => {
    const { state: after } = revealAsAlterEgo(magogGame(), DEFEND_THE_TITLE);
    expect(champion(after)).toBe(2);
    expect(challengers(after)).toBe(0);
    const two = villainPhase(magogGame({ players: TWO }), [NO_BOOST, NO_BOOST, DEFEND_THE_TITLE, NEUTRAL]).state;
    expect(champion(two)).toBe(2);
  });

  describe("When Revealed (Hero): MaGog attacks you; a hero defending without taking damage earns 2 counters on The Challengers", () => {
    // MaGog is stunned, so his own attack is skipped; the attack under test is Defend the Title's, with its own boost card.
    const staged = (extra: (state: GameState) => GameState = (s) => s) => {
      const state = heroGame({ players: [{ starterDeckId: "core-iron-man-aggression" }] });
      return extra(stunned(state, villain(state)));
    };
    const reveal = (state: GameState, pick: Picker) => villainPhase(state, [DEFEND_THE_TITLE, NO_BOOST], pick);
    const defendWithHero: Picker = (state) =>
      state.pendingChoice?.prompt.kind === "declareDefender" ? [identityOf(state)] : firstLegal(state);

    it("hero defends and takes no damage (tough): 2 counters on The Challengers", () => {
      const state = staged((s) => toughOn(s, identityOf(s)));
      const { state: after } = reveal(state, defendWithHero);
      expect(hurt(after, identityOf(after))).toBe(0);
      expect(inst(after, identityOf(after)).exhausted).toBe(true);
      expect(challengers(after)).toBe(2);
      expect(champion(after)).toBe(0);
    });

    it("hero defends and takes damage: nothing", () => {
      const { state: after } = reveal(staged(), defendWithHero);
      expect(hurt(after, identityOf(after))).toBeGreaterThan(0);
      expect(challengers(after)).toBe(0);
    });

    it("the attack is undefended and the hero (tough) takes no damage: nothing", () => {
      const state = staged((s) => toughOn(s, identityOf(s)));
      const { state: after } = reveal(state, firstLegal);
      expect(hurt(after, identityOf(after))).toBe(0);
      expect(challengers(after)).toBe(0);
    });

    it("an ally defends: nothing, though the hero took no damage", () => {
      const state = staged();
      const { state: withAlly, id: ally } = intoPlayArea(state, P1, "01051");
      const { state: after } = reveal(withAlly, defendWith(ally));
      expect(hurt(after, identityOf(after))).toBe(0);
      expect(hurt(after, ally)).toBeGreaterThan(0);
      expect(challengers(after)).toBe(0);
    });
  });
});

describe("Stage Fright (39011)", () => {
  /** The last threat placed in the villain phase is the revealed card's: after the villain's own activation. */
  const placedBy = (state: GameState, card: string): number => {
    const { events } = villainPhase(state, [NO_BOOST, card]);
    return of(events, "threatPlaced").at(-1)!.amount;
  };
  const ahead = (state: GameState) => withRatings(state, challengersOf(state), 1);

  it("You are confused and 2 threat go on the main scheme when the counters are level", () => {
    const state = magogGame();
    const { state: after } = villainPhase(state, [NO_BOOST, STAGE_FRIGHT]);
    expect(inst(after, identityOf(after)).statuses.confused).toBe(1);
    expect(placedBy(state, STAGE_FRIGHT)).toBe(2);
  });

  it("level counters (1 and 1) are not 'more': 2 threat", () => {
    const state = ahead(magogGame());
    expect(placedBy(withRatings(state, championOf(state), 1), STAGE_FRIGHT)).toBe(2);
  });

  it("4 threat instead when there are more ratings counters on The Challengers than on The Champion", () => {
    expect(placedBy(ahead(magogGame()), STAGE_FRIGHT)).toBe(4);
  });

  it("[star] Boost: You are confused (as a boost card on MaGog's attack)", () => {
    const state = run(magogGame(), toHero(P1));
    const { state: after } = villainPhase(state, [STAGE_FRIGHT, NEUTRAL]);
    expect(inst(after, identityOf(after)).statuses.confused).toBe(1);
    expect(hurt(after, identityOf(after))).toBe(2);
  });
});
