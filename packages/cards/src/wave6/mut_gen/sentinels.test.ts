import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { SENTINELS_ABILITIES } from "./sentinels.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  runWith,
  stackEncounterDeck,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost, engageMinion, wideawakeGame } from "./project-wideawake-testing.js";

const run = (state: GameState, ...commands: Command[]) => runWith(WAVE6_DEPS, state, ...commands);
/** The player's identity in hero form by surgery (a real `changeForm` is once per round). */
const hero = (state: GameState, player = P1) => withForm(state, { heroForm: 0 }, player);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const inPlayOf = (state: GameState, code: string) => cardsInPlay(state).filter((id) => codeOf(state, id) === code);
const pileOf = (state: GameState, code: string) => {
  const pile = state.encounterDecks[activeEncounterDeckId(state)]!;
  return [...pile.deck, ...pile.discard].filter((id) => state.instances[id]!.cardId === cardId(code));
};
const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);
/** One villain phase from the end of P1's turn: the stacked cards are drawn in order (the villain's boost card first). */
const phase = (state: GameState, ...top: string[]) =>
  driveEventsPicking(
    WAVE6_DEPS,
    stackEncounterDeck(state, ...top),
    firstLegal,
    ...state.players.map((p): Command => ({ type: "endTurn", playerId: p.playerId })),
  );
const FILLER = "01186";
const NO_BOOST = "01187";
const MARK_V = "32105";
const MARK_VI = "32106";
const TARGETED = "32107";
const ROBOTS = "32108";
/** A game with Targeted for Elimination attached to `player`'s identity by surgery. */
const marked = (base: GameState, player = P1) => attachToHost(base, TARGETED, identityOf(base, player));
const basicThwart = (state: GameState, scheme: InstanceId, player = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(state, player),
  schemeInstanceId: scheme,
});

describe("registry", () => {
  it("registers every ability ref of the set's cards, and the set's cards are in the game from data", () => {
    expect(Object.keys(SENTINELS_ABILITIES).sort()).toEqual([
      "32105.when-revealed",
      "32106.boost",
      "32107.targeted-for-elimination-action",
      "32107.targeted-for-elimination-constant",
      "32107.targeted-for-elimination-constant-2",
      "32108.relentless-robots-constant",
    ]);
    const state = wideawakeGame();
    expect(pileOf(state, MARK_V)).toHaveLength(2);
    expect(pileOf(state, MARK_VI)).toHaveLength(2);
    expect(pileOf(state, TARGETED)).toHaveLength(2);
    expect(pileOf(state, ROBOTS)).toHaveLength(1);
  });
});

describe("Sentinel Mark V (32105)", () => {
  it("Targeted for Elimination on your identity: attacks you even in alter-ego form, and does not search", () => {
    const { state: base, id: tfe } = marked(wideawakeGame());
    expect(inst(base, identityOf(base)).attachments).toContain(tfe);
    const { state, events } = phase(base, FILLER, MARK_V);
    const [mark] = inPlayOf(state, MARK_V);
    expect(mark).toBeDefined();
    const attacks = of(events, "attackResolved").filter((e) => e.enemyInstanceId === mark);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(base));
    expect(attacks[0]!.damageDealt).toBeGreaterThan(0);
    // No search: the other copy is still in the encounter piles, not revealed.
    expect(revealed(events)).not.toContain(TARGETED);
    expect(pileOf(state, TARGETED)).toHaveLength(1);
  });

  it("not attached: searches the encounter deck for Targeted for Elimination and reveals it (no attack)", () => {
    const { state, events } = phase(wideawakeGame(), FILLER, MARK_V);
    const [mark] = inPlayOf(state, MARK_V);
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === mark)).toHaveLength(0);
    const seen = revealed(events);
    expect(seen.slice(seen.indexOf(MARK_V), seen.indexOf(MARK_V) + 2)).toEqual([MARK_V, TARGETED]);
    expect(inst(state, identityOf(state)).attachments.map((a) => codeOf(state, a))).toEqual([TARGETED]);
  });

  it("not attached and no copy left anywhere: nothing is revealed", () => {
    const base = wideawakeGame();
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const gone = [...pile.deck, ...pile.discard].filter((i) => codeOf(base, i) === TARGETED);
    const stripped: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => !gone.includes(i)),
          discard: pile.discard.filter((i) => !gone.includes(i)),
        },
      },
    };
    const { state } = phase(stripped, FILLER, MARK_V);
    expect(inPlayOf(state, TARGETED)).toEqual([]);
    expect(inPlayOf(state, MARK_V)).toHaveLength(1);
  });

  it("Targeted for Elimination on another player's identity only: you search for it (it is not attached to you)", () => {
    const two = wideawakeGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const { state: base } = marked(two, P2);
    const { state, events } = phase(base, FILLER, FILLER, MARK_V);
    const [mark] = inPlayOf(state, MARK_V);
    expect(mark).toBeDefined();
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === mark)).toHaveLength(0);
    expect(revealed(events)).toContain(TARGETED);
    // The found copy attaches to the revealing player's identity, which is the one that searched.
    expect(inst(state, identityOf(state, P1)).attachments.map((a) => codeOf(state, a))).toEqual([TARGETED]);
  });
});

describe("Sentinel Mark VI (32106)", () => {
  /** Hero form, the villain attacks P1 and the stacked card is its boost card. */
  const boosted = (base: GameState) => phase(hero(base), MARK_VI, NO_BOOST);

  it("[star] Boost with Targeted for Elimination on an identity: dealt to that player as a facedown encounter card", () => {
    const { state: armed } = marked(wideawakeGame());
    const { state, events } = boosted(armed);
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("32106.boost");
    const dealt = of(events, "cardMoved").filter((e) => codeOf(state, e.instanceId) === MARK_VI);
    expect(dealt.map((e) => e.to.kind)).toEqual(["boost", "dealtEncounter", "playArea"]);
    // The dealt card is revealed in the same villain phase's reveal step: a Sentinel minion in play, engaged with P1.
    expect(revealed(events)).toContain(MARK_VI);
    expect(inPlayOf(state, MARK_VI)).toHaveLength(1);
  });

  it("the card goes to the player whose identity is marked, not the one the boost was dealt against", () => {
    const two = wideawakeGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const { state: armed } = marked(two, P2);
    const { events } = phase(hero(hero(armed), P2), MARK_VI, NO_BOOST, FILLER, FILLER);
    const dealt = of(events, "cardMoved").filter(
      (e) => codeOf(armed, e.instanceId) === MARK_VI && e.to.kind === "dealtEncounter",
    );
    expect(dealt.map((e) => e.to)).toEqual([{ kind: "dealtEncounter", playerId: P2 }]);
  });

  it("no Targeted for Elimination attached: the boost does nothing and the card is discarded", () => {
    const { state, events } = boosted(wideawakeGame());
    const moved = of(events, "cardMoved").filter((e) => codeOf(state, e.instanceId) === MARK_VI);
    expect(moved.map((e) => e.to.kind)).toEqual(["boost", "encounterDiscard"]);
    expect(revealed(events)).not.toContain(MARK_VI);
    expect(inPlayOf(state, MARK_VI)).toEqual([]);
  });
});

describe("Targeted for Elimination (32107)", () => {
  it("When Revealed, none attached: attaches to your identity (no surge)", () => {
    const { state, events } = phase(wideawakeGame(), FILLER, TARGETED, "01188");
    const seen = revealed(events);
    expect(seen.slice(seen.indexOf(TARGETED), seen.indexOf(TARGETED) + 2)).not.toEqual([TARGETED, "01188"]);
    expect(inst(state, identityOf(state)).attachments.map((a) => codeOf(state, a))).toEqual([TARGETED]);
  });

  it("a copy already attached to you: the second gains surge, is not attached, and the next card is revealed", () => {
    const { state: armed, id: first } = marked(wideawakeGame());
    const { state, events } = phase(armed, FILLER, TARGETED, "01188");
    const seen = revealed(events);
    expect(seen.slice(seen.indexOf(TARGETED), seen.indexOf(TARGETED) + 2)).toEqual([TARGETED, "01188"]);
    expect(inst(state, identityOf(state)).attachments).toEqual([first]);
  });

  it("while you are in hero form and engaged with a Sentinel minion you cannot change to alter-ego form", () => {
    const { state: armed } = marked(hero(wideawakeGame()));
    const { state: engaged } = engageMinion(armed, MARK_V);
    const refused = applyCommand(engaged, { type: "changeForm", playerId: P1 }, WAVE6_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("not engaged with a Sentinel minion: you may change form", () => {
    const { state: armed } = marked(hero(wideawakeGame()));
    const result = applyCommand(armed, { type: "changeForm", playerId: P1 }, WAVE6_DEPS);
    expect(result.ok).toBe(true);
  });

  it("engaged only with a non-Sentinel minion: you may change form", () => {
    const base = wideawakeGame({ extraEncounterCards: ["01091"] });
    const { state: armed } = marked(hero(base));
    const { state: engaged, id } = engageMinion(armed, "01091");
    expect(codeOf(engaged, id)).toBe("01091");
    const result = applyCommand(engaged, { type: "changeForm", playerId: P1 }, WAVE6_DEPS);
    expect(result.ok).toBe(true);
  });

  it("in alter-ego form engaged with a Sentinel minion: you may change to hero form", () => {
    const { state: armed } = marked(wideawakeGame());
    const { state: engaged } = engageMinion(armed, MARK_V);
    const result = applyCommand(engaged, { type: "changeForm", playerId: P1 }, WAVE6_DEPS);
    expect(result.ok).toBe(true);
  });

  it("only your own engagement counts: a Sentinel engaged with another player does not hold you", () => {
    const two = wideawakeGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const { state: armed } = marked(hero(two), P1);
    const { state: engaged } = engageMinion(armed, MARK_V, P2);
    expect(applyCommand(engaged, { type: "changeForm", playerId: P1 }, WAVE6_DEPS).ok).toBe(true);
    const { state: mine } = engageMinion(armed, MARK_V, P1);
    expect(applyCommand(mine, { type: "changeForm", playerId: P1 }, WAVE6_DEPS).ok).toBe(false);
  });

  it("Action: exhaust your identity -> discard this card", () => {
    const { state: armed, id } = marked(hero(wideawakeGame()));
    expect(inst(armed, identityOf(armed)).exhausted).toBe(false);
    const state = run(armed, use(P1, id, "32107.targeted-for-elimination-action"));
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(inst(state, identityOf(state)).attachments).toEqual([]);
    expect(inPlayOf(state, TARGETED)).toEqual([]);
    expect(pileOf(state, TARGETED)).toContain(id);
  });

  it("Action: refused while your identity is exhausted", () => {
    const { state: armed, id } = marked(hero(wideawakeGame()));
    const tired = patchInstance(armed, identityOf(armed), { exhausted: true });
    expect(applyCommand(tired, use(P1, id, "32107.targeted-for-elimination-action"), WAVE6_DEPS).ok).toBe(false);
  });
});

describe("Relentless Robots (32108)", () => {
  /** Relentless Robots in play by surgery, with 3 threat. */
  const scheme = (base: GameState) => encounterCardInVillainArea(base, ROBOTS, 3);

  it("a player engaged with a Sentinel minion cannot thwart it", () => {
    const { state: engaged } = engageMinion(hero(wideawakeGame()), MARK_V);
    const { state, id } = scheme(engaged);
    const refused = applyCommand(state, basicThwart(state, id), WAVE6_DEPS);
    expect(refused.ok).toBe(false);
  });

  it("a player not engaged with a Sentinel minion may thwart it", () => {
    const { state, id } = scheme(hero(wideawakeGame()));
    const result = applyCommand(state, basicThwart(state, id), WAVE6_DEPS);
    expect(result.ok).toBe(true);
  });

  it("engaged only with a non-Sentinel minion: may thwart it", () => {
    const base = wideawakeGame({ extraEncounterCards: ["01091"] });
    const { state: engaged } = engageMinion(hero(base), "01091");
    const { state, id } = scheme(engaged);
    expect(applyCommand(state, basicThwart(state, id), WAVE6_DEPS).ok).toBe(true);
  });

  it("engagement is per player: engaged with a Sentinel, you cannot thwart it; the other player's engagement does not bar you", () => {
    const two = wideawakeGame({
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    });
    const { state: engagedOther } = engageMinion(hero(two), MARK_V, P2);
    const { state: free, id } = scheme(engagedOther);
    expect(applyCommand(free, basicThwart(free, id, P1), WAVE6_DEPS).ok).toBe(true);
    const { state: engagedMe } = engageMinion(hero(two), MARK_V, P1);
    const { state: barred, id: id2 } = scheme(engagedMe);
    expect(applyCommand(barred, basicThwart(barred, id2, P1), WAVE6_DEPS).ok).toBe(false);
  });

  it("it only bars thwarting this scheme: another side scheme can still be thwarted by the engaged player", () => {
    const { state: engaged } = engageMinion(hero(wideawakeGame()), MARK_V);
    const { state: both } = scheme(engaged);
    const other = inPlayOf(both, "32104")[0] ?? both.villainArea.find((i) => codeOf(both, i) === "32104")!;
    const armed = patchInstance(both, other, { threat: 3 });
    expect(applyCommand(armed, basicThwart(armed, other), WAVE6_DEPS).ok).toBe(true);
  });
});
