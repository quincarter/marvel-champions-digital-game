import {
  activeEncounterDeck,
  activeEncounterDeckId,
  cardsInPlay,
  characterProfile,
  hasKeyword,
  replay,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
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
import { driveEventsPicking, playFromHand } from "../../testing/staging.js";
import { engageMinion } from "../mut_gen/project-wideawake-testing.js";
import { intoPlayArea } from "../mut_gen/magneto-testing.js";
import { playToOutcome } from "../../testing/driver.js";
import { LONGSHOT_ABILITIES } from "./longshot.js";
import { inEncounterPiles, inPlay, longshotGame } from "./longshot-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

const LONGSHOT = "39071";
/** Reveals (treacheries 01187 and 01186) to fill the boost and reveal slots of a villain phase. */
const FILLER = "01187";
const FILLER_2 = "01186";
const MINION = "32146";
const BLACK_WIDOW = "01075";
const GENIUS = "01089";
const PANTHER = { starterDeckId: "core-black-panther-protection" };
const TWO = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-iron-man-aggression" }];

const endTurns = (state: GameState) => state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId }));
/** The villain phase with `top` stacked (the first is the villain's boost card, then one dealt card per player). */
const villainPhase = (state: GameState, top: readonly string[], pick: Picker = firstLegal) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...top), pick, ...endTurns(state));
const heroForm = (options: Parameters<typeof longshotGame>[0] = {}) =>
  run(longshotGame({ players: [PANTHER], ...options }), toHero(P1));
const revealedCodes = (state: GameState, events: readonly GameEvent[]) =>
  of(events, "encounterCardRevealed").map((e) => inst(state, e.instanceId).cardId as string);
/** An ally of the Core pool in `player`'s play area (state surgery). */
const allyInPlay = (state: GameState, code: string, player = P1) => {
  const given = moveToHand(state, player, code);
  return intoPlayArea(given.state, player, code);
};

/** Longshot out of the encounter deck and into `player`'s play area, ready (state surgery: what a reveal does, without the reveal). */
const longshotInPlay = (state: GameState, player = P1) => {
  const pile = activeEncounterDeck(state);
  const id = [...pile.deck, ...pile.discard].find((i) => inst(state, i).cardId === LONGSHOT)!;
  const moved: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: {
        deck: pile.deck.filter((i) => i !== id),
        discard: pile.discard.filter((i) => i !== id),
      },
    },
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return { state: patchInstance(moved, id, { faceup: true, exhausted: false, controllerId: player }), id };
};

describe("registry", () => {
  it("scripts every ability ref of the Longshot set", () => {
    expect(Object.keys(LONGSHOT_ABILITIES).sort()).toEqual(
      ["39071.longshot-constant", "39071.longshot-constant-2", "39071.when-revealed"].sort(),
    );
  });

  it("Longshot is in the encounter deck of a game that asked for him, and in none that did not", () => {
    expect(inEncounterPiles(longshotGame(), LONGSHOT)).toHaveLength(1);
    expect(inEncounterPiles(longshotGame({ extraModularSetIds: [] }), LONGSHOT)).toHaveLength(0);
  });
});

describe("39071.when-revealed", () => {
  it("revealed from the encounter deck, he enters play under the revealing player's control and gains surge", () => {
    const state = heroForm();
    const { state: after, events } = villainPhase(state, [FILLER_2, LONGSHOT, FILLER]);
    const [longshot] = inPlay(after, LONGSHOT);
    expect(longshot).toBeDefined();
    expect(inPlay(after, LONGSHOT)).toHaveLength(1);
    expect(inst(after, longshot!).controllerId).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(longshot);
    expect(inEncounterPiles(after, LONGSHOT)).toHaveLength(0);
    // Surge: the card stacked behind him is revealed too.
    expect(revealedCodes(after, events)).toEqual([LONGSHOT, FILLER]);
  });

  it("in a two-player game he goes under the control of the player who revealed him", () => {
    const state = longshotGame({ players: TWO });
    // One boost card per activation (P1's and P2's), then P1's revealed card, then P2's: Longshot is P2's.
    const { state: after } = villainPhase(state, [FILLER_2, "01188", "01189", LONGSHOT, "01190", FILLER]);
    const [longshot] = inPlay(after, LONGSHOT);
    expect(longshot).toBeDefined();
    expect(inst(after, longshot!).controllerId).toBe(P2);
    expect(playerOf(after, P2).playArea).toContain(longshot);
    expect(playerOf(after, P1).playArea).not.toContain(longshot);
  });

  describe("This effect cannot be canceled", () => {
    /** Black Widow in play and ready, Genius in hand to pay for her interrupt (the then-sweep's staging). */
    const withWidow = () => {
      const base = heroForm();
      const given = moveToHand(base, P1, GENIUS);
      const [genius] = given.ids as [InstanceId];
      const widow = allyInPlay(given.state, BLACK_WIDOW);
      return { state: widow.state, widow: widow.id, genius };
    };
    const widowOffer = (widow: InstanceId) => `${widow}:01075.black-widow-interrupt`;
    /** Accepts Black Widow's interrupt whenever it is offered, paying with Genius; records whether it was offered. */
    const accepting = (widow: InstanceId, genius: InstanceId, offered: { value: boolean }): Picker => {
      return (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        const hers = choice.options.find((o) => o.optionId === widowOffer(widow));
        if (hers) {
          offered.value = true;
          return [hers.optionId];
        }
        if (choice.prompt.kind === "payForAbility" || choice.prompt.kind === "spendResources") {
          const pay = choice.options.find((o) => o.optionId.includes(genius));
          if (pay) return [pay.optionId];
        }
        return firstLegal(s);
      };
    };

    it("Black Widow's cancel is not offered for him: only the card his surge reveals is cancelled, and he still enters play", () => {
      const { state, widow, genius } = withWidow();
      const offered = { value: false };
      const { state: after, events } = villainPhase(
        state,
        [FILLER_2, LONGSHOT, FILLER],
        accepting(widow, genius, offered),
      );
      // Her cancel is offered for the card behind him (any revealed card), and for no other.
      expect(of(events, "revealCancelled").map((e) => inst(after, e.instanceId).cardId)).toEqual([FILLER]);
      expect(inPlay(after, LONGSHOT)).toHaveLength(1);
      expect(revealedCodes(after, events).slice(0, 2)).toEqual([LONGSHOT, FILLER]);
    });

    it("the control: the same cancel is offered, and cancels, an ordinary card", () => {
      const { state, widow, genius } = withWidow();
      const offered = { value: false };
      const { events } = villainPhase(state, [FILLER_2, FILLER, FILLER_2], accepting(widow, genius, offered));
      expect(offered.value).toBe(true);
      expect(of(events, "revealCancelled").length).toBeGreaterThan(0);
    });
  });

  it("the When Revealed ability itself is flagged uncancellable", () => {
    expect(LONGSHOT_ABILITIES["39071.when-revealed"]!.uncancellable).toBe(true);
  });
});

describe("39071.longshot-constant-2: does not count against the ally limit", () => {
  const CORE_ALLIES = ["01075", "01076", "01083"];

  it("a player at the limit keeps every ally when Longshot joins them", () => {
    let state = heroForm();
    const allies: InstanceId[] = [];
    for (const code of CORE_ALLIES) {
      const put = allyInPlay(state, code);
      state = put.state;
      allies.push(put.id);
    }
    const { state: after } = villainPhase(state, [FILLER_2, LONGSHOT, FILLER]);
    const [longshot] = inPlay(after, LONGSHOT);
    expect(longshot).toBeDefined();
    for (const id of [...allies, longshot!]) expect(cardsInPlay(after), id).toContain(id);
    expect(after.pendingChoice).toBeNull();
  });

  it("playing a further ally with him in play counts only the others: two others plus Longshot, a third other ally is played with no discard prompt", () => {
    let state = heroForm();
    const longshot = longshotInPlay(state);
    state = longshot.state;
    const [first, second, third] = CORE_ALLIES as [string, string, string];
    state = allyInPlay(state, first).state;
    state = allyInPlay(state, second).state;
    const { state: played, id } = playFromHand(deps, state, third, 3);
    expect(cardsInPlay(played)).toEqual(expect.arrayContaining([longshot.id, id]));
    expect(played.pendingChoice).toBeNull();
    expect(playerOf(played, P1).discard).not.toContain(id);
  });
});

describe("39071.longshot-constant: his attacks gain piercing", () => {
  const stage = () => {
    const hero = heroForm();
    const put = longshotInPlay(hero);
    const minion = engageMinion(put.state, MINION, P1);
    const tough = patchInstance(minion.state, minion.id, {
      statuses: { ...inst(minion.state, minion.id).statuses, tough: 1 },
    });
    return { state: tough, longshot: put.id, minion: minion.id };
  };

  it("his attack discards the target's tough status and the damage lands", () => {
    const { state, longshot, minion } = stage();
    expect(hasKeyword(state, longshot, "piercing", deps)).toBe(false); // the keyword is on his attack, not on him
    const after = settle(
      run(state, { type: "basicAttack", playerId: P1, attackerInstanceId: longshot, targetInstanceId: minion }),
      firstLegal,
      undefined,
      deps,
    );
    expect(characterProfile(state, longshot, deps)!.atk).toBe(2);
    expect(inst(after, minion).damage).toBe(2);
    expect(inst(after, minion).statuses.tough).toBe(0);
  });

  it("the control: a hero's basic attack has its damage prevented by the same tough status", () => {
    const { state, minion } = stage();
    const after = settle(
      run(state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(state),
        targetInstanceId: minion,
      }),
      firstLegal,
      undefined,
      deps,
    );
    expect(inst(after, minion).damage).toBe(0);
    expect(inst(after, minion).statuses.tough).toBe(0);
  });

  it("his thwart is a plain thwart: his 2 THW removes 2 threat from the scheme", () => {
    const { state, longshot } = stage();
    const scheme = state.mainScheme.instanceId;
    const loaded = patchInstance(state, scheme, { threat: 5 });
    const after = settle(
      run(loaded, { type: "basicThwart", playerId: P1, thwarterInstanceId: longshot, schemeInstanceId: scheme }),
      firstLegal,
      undefined,
      deps,
    );
    expect(inst(after, scheme).threat).toBe(3);
  });
});

describe("39071 as a boost card and in the discard pile", () => {
  it("dealt as a boost card he adds no boost icons, and goes to the encounter discard pile", () => {
    const state = heroForm();
    const { state: after, events } = villainPhase(state, [LONGSHOT, FILLER, FILLER_2]);
    const [boost] = of(events, "boostCardDealt");
    expect(inst(after, boost!.instanceId).cardId).toBe(LONGSHOT);
    const flipped = of(events, "boostCardFlipped").find((e) => e.instanceId === boost!.instanceId);
    expect(flipped?.boostIcons).toBe(0);
    // A boost card is not revealed: no When Revealed, so he is not put into play.
    expect(inPlay(after, LONGSHOT)).toHaveLength(0);
    expect(activeEncounterDeck(after).discard).toContain(boost!.instanceId);
    expect(playerOf(after, P1).discard).not.toContain(boost!.instanceId);
  });

  it("when he leaves play he goes to the encounter discard pile, not a player's", () => {
    const hero = heroForm();
    const put = longshotInPlay(hero);
    const hurt = patchInstance(put.state, put.id, { damage: 2 });
    const defending: Picker = (s) => (s.pendingChoice?.prompt.kind === "declareDefender" ? [put.id] : firstLegal(s));
    const { state: after } = driveEventsPicking(deps, hurt, defending, ...endTurns(hurt));
    expect(cardsInPlay(after)).not.toContain(put.id);
    expect(activeEncounterDeck(after).discard).toContain(put.id);
    for (const p of after.players) {
      expect(p.discard).not.toContain(put.id);
      expect(p.hand).not.toContain(put.id);
    }
  });
});

describe("determinism", () => {
  it("a whole game with Longshot shuffled in plays to an outcome and replays deep-equal", () => {
    const start = longshotGame({ players: [{ starterDeckId: "core-she-hulk-aggression" }], seed: 2026 });
    expect(inEncounterPiles(start, LONGSHOT).length + inPlay(start, LONGSHOT).length).toBe(1);
    const result = playToOutcome(start, deps);
    expect(result.outcome).not.toBeNull();
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
