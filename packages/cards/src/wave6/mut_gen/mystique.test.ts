import {
  activeEncounterDeckId,
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  runWith,
  stackEncounterDeck as stackEncounter,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { engageMinion } from "./project-wideawake-testing.js";
import { intoPlayArea } from "./magneto-testing.js";
import { inEncounterPiles, mystiqueGame, onTopOfPlayerDeck, resolvedRefs } from "./mystique-testing.js";
import { MYSTIQUE_ABILITIES } from "./mystique.js";

const deps: EngineDeps = WAVE6_DEPS;
const MYSTIQUE = "32080";
const MAYHEM = "32081";
const INFILTRATION = "32082";
const SURPRISE = "32083";
const DAREDEVIL = "01058";

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const seat = (state: GameState) => state.players.find((p) => p.playerId === P1)!;
const encounterDiscard = (state: GameState) => state.encounterDecks[activeEncounterDeckId(state)]!.discard;
const villainId = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
const heroGame = () => runWith(deps, mystiqueGame(), toHero(P1));
/** Empties P1's hand into the discard pile, so the end-of-turn draw fills it to five from the top of the deck. */
const emptyHand = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, hand: [], discard: [...p.discard, ...p.hand] })),
});
/** P1 ends the turn in hero form with an empty hand: draws five, `code` (stacked on top of the deck) first. */
function drawsAtTurnEnd(state: GameState, code: string, pick: Picker = firstLegal) {
  const staged = onTopOfPlayerDeck(emptyHand(state), code, P1);
  const result = driveEventsPicking(deps, staged.state, pick, { type: "endTurn", playerId: P1 });
  const phaseChange = result.events.findIndex((e) => e.type === "stepChanged" && e.to.phase === "villain");
  return { ...result, id: staged.id, drawPhase: result.events.slice(0, phaseChange) };
}
const movesOf = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "cardMoved").filter((e) => e.instanceId === id);

describe("registry and data", () => {
  it("registers every ability ref of the Mystique set", () => {
    const refs = [
      "32080.mystique-constant",
      "32080.mystique-constant-2",
      "32081.when-defeated",
      "32082.when-revealed",
      "32082.infiltration-forced-response",
      "32083.when-revealed",
      "32083.shapeshifter-surprise-forced-response",
    ];
    for (const ref of refs) {
      expect((MYSTIQUE_ABILITIES as Record<string, unknown>)[ref], ref).toBeDefined();
      expect(deps.abilities[ref], ref).toBeDefined();
    }
    expect(Object.keys(MYSTIQUE_ABILITIES).sort()).toEqual([...refs].sort());
  });

  it("the set's five cards are in the Sabretooth game from data (Infiltration twice)", () => {
    const state = mystiqueGame();
    const pooled = (code: string) => inEncounterPiles(state, code).length;
    expect([MYSTIQUE, MAYHEM, INFILTRATION, SURPRISE].map(pooled)).toEqual([1, 1, 2, 1]);
  });
});

describe("Mystique (32080)", () => {
  it("her SCH and ATK are the villain's, read live (a modifier on the villain carries over)", () => {
    const { state, id } = engageMinion(heroGame(), MYSTIQUE, P1);
    const villain = characterProfile(state, villainId(state), deps)!;
    const mystique = characterProfile(state, id, deps)!;
    expect(villain.atk).toBeGreaterThan(0);
    expect(villain.sch).toBeGreaterThan(0);
    expect(mystique.atk).toBe(villain.atk);
    expect(mystique.sch).toBe(villain.sch);
    expect(mystique.maxHp).toBe(9);
  });

  it("players cannot attack the villain while she is in play, and can once she is gone", () => {
    const attack = (state: GameState) =>
      applyCommand(
        patchInstance(state, identityOf(state), { exhausted: false }),
        {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: identityOf(state),
          targetInstanceId: villainId(state),
        },
        deps,
      ).ok;
    const free = heroGame();
    expect(attack(free)).toBe(true);
    const { state } = engageMinion(free, MYSTIQUE, P1);
    expect(attack(state)).toBe(false);
  });

  it("she herself can still be attacked", () => {
    const { state, id } = engageMinion(heroGame(), MYSTIQUE, P1);
    const ready = patchInstance(state, identityOf(state), { exhausted: false });
    expect(
      applyCommand(
        ready,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(ready), targetInstanceId: id },
        deps,
      ).ok,
    ).toBe(true);
  });

  it("has toughness from data", () => {
    const { state, id } = engageMinion(heroGame(), MYSTIQUE, P1);
    expect(state.cardPool[inst(state, id).cardId]).toMatchObject({ keywords: [{ name: "toughness" }] });
  });
});

describe("Infiltration (32082)", () => {
  it("When Revealed: shuffles itself into the revealing player's deck and gains surge (the next card is revealed)", () => {
    const base = heroGame();
    const id = inEncounterPiles(base, INFILTRATION)[0]!;
    const before = seat(base).deck.length;
    // The villain's boost card is dealt first (01186), Sabretooth's own Forced Response discards the next (32071), then
    // Infiltration is revealed, and its surge reveals 32070.
    const revealed = driveEventsPicking(
      deps,
      stackEncounter(base, "01186", "32071", INFILTRATION, "32070"),
      firstLegal,
      {
        type: "endTurn",
        playerId: P1,
      },
    );
    expect(resolvedRefs(revealed.events)).toContain("32082.when-revealed");
    const reveals = of(revealed.events, "encounterCardRevealed").map((e) => e.cardId as string);
    expect(reveals.slice(0, 2)).toEqual([INFILTRATION, "32070"]);
    // Shuffled into P1's deck as an unowned, facedown encounter card; the deck is one card bigger.
    expect(seat(revealed.state).deck).toContain(id);
    expect(seat(revealed.state).deck.length).toBe(before + 1);
    expect(inst(revealed.state, id)).toMatchObject({ ownerId: null, faceup: false });
    expect(encounterDiscard(revealed.state)).not.toContain(id);
  });

  it("drawn: stays in the hand (no deal, no replacement draw) and its Forced Response discards an ally", () => {
    const state = intoPlayArea(heroGame(), P1, DAREDEVIL).state;
    const daredevil = state.players[0]!.playArea.find((i) => state.instances[i]!.cardId === cardId(DAREDEVIL))!;
    const { state: after, events, id, drawPhase } = drawsAtTurnEnd(state, INFILTRATION);
    // Five draws, the Infiltration one of them: no card was drawn in its place.
    expect(of(drawPhase, "cardDrawn")).toHaveLength(5);
    expect(of(drawPhase, "cardDrawn")[0]!.instanceId).toBe(id);
    expect(seat(after).hand).toContain(id);
    expect(seat(after).dealtEncounter).toEqual([]);
    expect(movesOf(events, id).map((e) => e.to.kind)).toEqual(["hand"]);
    expect(inst(after, id)).toMatchObject({ ownerId: null });
    // The Forced Response fired once, on the draw, and Daredevil (the only ally or support) was discarded.
    expect(resolvedRefs(drawPhase).filter((r) => r === "32082.infiltration-forced-response")).toHaveLength(1);
    expect(movesOf(events, daredevil).map((e) => e.to.kind)).toEqual(["discard"]);
    expect(seat(after).discard).toContain(daredevil);
  });

  it("with an ally and a support (Aunt May), the player chooses which to discard", () => {
    let state = intoPlayArea(heroGame(), P1, DAREDEVIL).state;
    const tracer = intoPlayArea(state, P1, "01006");
    state = tracer.state;
    const pickTracer: Picker = (s) => {
      const choice = s.pendingChoice!;
      return choice.prompt.kind === "chooseTarget" && choice.options.some((o) => o.optionId === tracer.id)
        ? [tracer.id]
        : firstLegal(s);
    };
    const { state: after } = drawsAtTurnEnd(state, INFILTRATION, pickTracer);
    expect(seat(after).discard).toContain(tracer.id);
    expect(cardsInPlay(after).some((i) => after.instances[i]!.cardId === cardId(DAREDEVIL))).toBe(true);
  });

  it("with no ally or support in play, the Forced Response has nothing to discard", () => {
    const { state: after, drawPhase, id } = drawsAtTurnEnd(heroGame(), INFILTRATION);
    expect(seat(after).hand).toContain(id);
    expect(resolvedRefs(drawPhase)).toContain("32082.infiltration-forced-response");
    expect(of(drawPhase, "cardMoved").filter((e) => e.from.kind === "playArea")).toEqual([]);
  });

  it("discarded from the hand (end-of-phase hand size): goes to the encounter discard pile, faceup", () => {
    const base = heroGame();
    const staged = onTopOfPlayerDeck(base, INFILTRATION, P1);
    const id = staged.id;
    // Surgery into the hand (no draw, so no Forced Response): six cards at the end of the turn is one too many.
    const withSix: GameState = {
      ...staged.state,
      players: staged.state.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] })),
    };
    expect(seat(withSix).hand.length).toBeGreaterThan(5);
    const picking: Picker = (s) => {
      const choice = s.pendingChoice!;
      return choice.prompt.kind === "discardDownToHandSize"
        ? [id, ...choice.options.filter((o) => o.optionId !== id).map((o) => o.optionId)].slice(0, choice.minSelections)
        : firstLegal(s);
    };
    const { state, events } = driveEventsPicking(deps, withSix, picking, { type: "endTurn", playerId: P1 });
    expect(movesOf(events, id).map((e) => e.to.kind)).toEqual(["encounterDiscard"]);
    expect(encounterDiscard(state)).toContain(id);
    expect(seat(state).discard).not.toContain(id);
    expect(seat(state).hand).not.toContain(id);
    expect(inst(state, id).faceup).toBe(true);
    expect(resolvedRefs(events)).not.toContain("32082.infiltration-forced-response");
  });
});

describe("Shapeshifter Surprise (32083)", () => {
  it("drawn with Mystique in play: she activates against you (a hero is attacked) as the card enters the hand", () => {
    const base = engageMinion(heroGame(), MYSTIQUE, P1);
    const { events, drawPhase } = drawsAtTurnEnd(base.state, SURPRISE);
    expect(resolvedRefs(drawPhase)).toContain("32083.shapeshifter-surprise-forced-response");
    // Her attack is declared against P1's hero and resolves before the villain phase starts.
    const defends = of(drawPhase, "choiceRequested").filter(
      (e) => e.choice.prompt.kind === "declareDefender" && e.choice.prompt.attack.enemyInstanceId === base.id,
    );
    expect(defends).toHaveLength(1);
    expect(of(drawPhase, "attackResolved").map((e) => e.enemyInstanceId)).toEqual([base.id]);
    // She did not need searching for: she is the same instance and was never revealed.
    expect(of(events, "encounterCardRevealed").filter((e) => e.instanceId === base.id)).toEqual([]);
  });

  it("drawn with Mystique in the encounter deck: searches for her and reveals her (engaged with you), then shuffles", () => {
    const state = heroGame();
    const [mystique] = inEncounterPiles(state, MYSTIQUE);
    const { drawPhase } = drawsAtTurnEnd(state, SURPRISE);
    expect(of(drawPhase, "encounterCardRevealed").map((e) => e.instanceId)).toEqual([mystique]);
    // Revealed to P1 and put into play engaged with them (the game itself is lost to her attack soon after).
    expect(movesOf(drawPhase, mystique!).map((e) => e.to)).toEqual([
      { kind: "dealtEncounter", playerId: P1 },
      { kind: "playArea", playerId: P1 },
    ]);
    expect(of(drawPhase, "attackResolved")).toEqual([]);
  });

  it("drawn with Mystique in the encounter discard pile: finds her there", () => {
    const base = heroGame();
    const [mystique] = inEncounterPiles(base, MYSTIQUE);
    const deckId = activeEncounterDeckId(base);
    const piles = base.encounterDecks[deckId]!;
    const inDiscard: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== mystique), discard: [...piles.discard, mystique!] },
      },
    };
    const { drawPhase } = drawsAtTurnEnd(inDiscard, SURPRISE);
    expect(of(drawPhase, "encounterCardRevealed").map((e) => e.instanceId)).toEqual([mystique]);
    expect(movesOf(drawPhase, mystique!).map((e) => e.to.kind)).toEqual(["dealtEncounter", "playArea"]);
  });

  it("stays in the hand like Infiltration: no deal, no replacement draw", () => {
    const { drawPhase, id } = drawsAtTurnEnd(heroGame(), SURPRISE);
    expect(of(drawPhase, "cardDrawn")).toHaveLength(5);
    expect(of(drawPhase, "cardDrawn")[0]!.instanceId).toBe(id);
    expect(movesOf(drawPhase, id).map((e) => e.to.kind)).toEqual(["hand"]);
  });

  it("discarded from the hand: goes to the encounter discard pile", () => {
    const base = heroGame();
    const staged = onTopOfPlayerDeck(base, SURPRISE, P1);
    const id = staged.id;
    const withSeven: GameState = {
      ...staged.state,
      players: staged.state.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== id), hand: [...p.hand, id] })),
    };
    const picking: Picker = (s) => {
      const choice = s.pendingChoice!;
      return choice.prompt.kind === "discardDownToHandSize"
        ? [id, ...choice.options.filter((o) => o.optionId !== id).map((o) => o.optionId)].slice(0, choice.minSelections)
        : firstLegal(s);
    };
    const { events } = driveEventsPicking(deps, withSeven, picking, { type: "endTurn", playerId: P1 });
    expect(movesOf(events, id).map((e) => e.to.kind)).toEqual(["encounterDiscard"]);
  });
});

describe("Metamorphic Mayhem (32081)", () => {
  /** P1's hero thwarts the scheme's last threat away: the defeating player is P1. */
  const defeated = (state: GameState, scheme: InstanceId) => {
    const ready = patchInstance(patchInstance(state, scheme, { threat: 1 }), identityOf(state), { exhausted: false });
    return driveEventsPicking(deps, ready, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(ready),
      schemeInstanceId: scheme,
    });
  };

  it("When Defeated: shuffles each Shapeshifter card from the encounter discard pile into the defeating player's deck", () => {
    const base = heroGame();
    const [infilA, infilB] = inEncounterPiles(base, INFILTRATION);
    const [surprise] = inEncounterPiles(base, SURPRISE);
    const [mystique] = inEncounterPiles(base, MYSTIQUE);
    const deckId = activeEncounterDeckId(base);
    const piles = base.encounterDecks[deckId]!;
    const moving = [infilA!, infilB!, surprise!, mystique!];
    // Two Infiltrations, the Surprise and Mystique (not a Shapeshifter) in the discard pile.
    const staged: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => !moving.includes(i)), discard: [...piles.discard, ...moving] },
      },
    };
    const scheme = encounterCardInVillainArea(staged, MAYHEM);
    const before = seat(scheme.state).deck.length;
    const { state, events } = defeated(scheme.state, scheme.id);
    expect(resolvedRefs(events)).toContain("32081.when-defeated");
    expect(seat(state).deck).toEqual(expect.arrayContaining([infilA, infilB, surprise]));
    expect(seat(state).deck).not.toContain(mystique);
    expect(seat(state).deck.length).toBe(before + 3);
    expect(encounterDiscard(state)).toContain(mystique);
    for (const id of [infilA!, infilB!, surprise!]) {
      expect(encounterDiscard(state)).not.toContain(id);
      expect(inst(state, id)).toMatchObject({ ownerId: null, faceup: false });
    }
  });

  it("with no Shapeshifter in the discard pile it changes nothing", () => {
    const scheme = encounterCardInVillainArea(heroGame(), MAYHEM);
    const before = seat(scheme.state).deck.length;
    const { state } = defeated(scheme.state, scheme.id);
    expect(seat(state).deck.length).toBe(before);
  });
});
