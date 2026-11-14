import {
  activeEncounterDeck,
  activeEncounterDeckId,
  locateCard,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  applyOk,
  firstLegal,
  settle,
  type Picker,
  endTurn,
  identityOf,
  inst,
  patchInstance,
  moveToHand,
  play,
  playerOf,
} from "../../testing/harness.js";
import { ELEKTRA_JUSTICE as REGISTRY, ELEKTRA_JUSTICE_SKIPPED as SKIPPED } from "./justice.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { elektraHeroGame } from "./elektra/elektra.testing.js";
import { ADVANCE, SPIDER_MAN_JUSTICE, accepting, drive, elektraAspectGame } from "./aspect-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `elektra/justice`: Double-Cross 63034 and its Linked treacheries Backstab 63035, Misdirect 63036 and Sabotage
 * 63037. Played against Core's Rhino: the card is a Core treachery retagged
 * (surgery) and stacked, once as the card revealed in the villain phase and once as Rhino's boost card.
 */
const BACKSTAB = "63035";
const MISDIRECT = "63036";
const SABOTAGE = "63037";

const base = (): GameState => elektraAspectGame("01088", SPIDER_MAN_JUSTICE);
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
/** The villain phase with the encounter deck's top cards retagged as `top` (the first is Rhino's boost card). */
function villainPhase(state: GameState, ...top: readonly string[]): GameState {
  const deck = activeEncounterDeck(state).deck;
  const retagged = top.reduce((s, code, i) => patchInstance(s, deck[i]!, { cardId: code as never }), state);
  return drive(retagged, accepting(), endTurn(P1));
}
/** Every event of the same villain phase, answering optional triggers yes and everything else with the first choice. */
function villainPhaseEvents(state: GameState, ...top: readonly string[]): readonly GameEvent[] {
  const deck = activeEncounterDeck(state).deck;
  const retagged = top.reduce((s, code, i) => patchInstance(s, deck[i]!, { cardId: code as never }), state);
  let result = applyOk(retagged, endTurn(P1), DEPS);
  const events = [...result.events];
  while (result.state.pendingChoice) {
    const choice = result.state.pendingChoice;
    const selected =
      choice.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : accepting()(result.state);
    result = applyOk(
      result.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: selected,
      } as never,
      DEPS,
    );
    events.push(...result.events);
  }
  return events;
}
const deckSize = (s: GameState) => activeEncounterDeck(s).deck.length;

describe("registry", () => {
  it("registers Double-Cross and the three treacheries, skips nothing, and each validates", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [
        "63034.when-defeated",
        "63035.when-revealed",
        "63035.boost",
        "63036.when-revealed",
        "63036.boost",
        "63037.when-revealed",
        "63037.boost",
      ].sort(),
    );
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });
});

describe("63035 Backstab", () => {
  it("When Revealed: deals 4 damage to the villain and gains surge (one more card is revealed)", () => {
    const state = base();
    const plain = villainPhase(state, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(state, ADVANCE, BACKSTAB, ADVANCE);
    expect(inst(after, villainOf(after)).damage - inst(plain, villainOf(plain)).damage).toBe(4);
    expect(deckSize(plain) - deckSize(after)).toBe(1); // surge revealed one more card
  });

  it("Boost, with the villain attacking: deals 2 damage to the activating enemy", () => {
    const state = base();
    const plain = villainPhase(state, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(state, BACKSTAB, ADVANCE, ADVANCE);
    expect(inst(after, villainOf(after)).damage - inst(plain, villainOf(plain)).damage).toBe(2);
  });

  it("Boost, as villainous Elektra's boost card on her own basic attack: no enemy is activating, so it adds 2 boost icons", () => {
    const attackWith = (top: string): number => {
      const state = elektraHeroGame();
      const deck = activeEncounterDeck(state).deck;
      const staged = [top, ADVANCE, ADVANCE].reduce(
        (st, code, i) => patchInstance(st, deck[i]!, { cardId: code as never }),
        state,
      );
      const villain = villainOf(staged);
      const decline: Picker = (s) => (s.pendingChoice!.prompt.kind === "chooseTriggers" ? [] : firstLegal(s));
      const after = settle(
        applyOk(
          staged,
          { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(staged), targetInstanceId: villain },
          DEPS,
        ).state,
        decline,
        undefined,
        DEPS,
      );
      return inst(after, villain).damage;
    };
    expect(attackWith(BACKSTAB) - attackWith(ADVANCE)).toBe(2);
  });
});

describe("63036 Misdirect", () => {
  it("When Revealed: heals 4 damage from an identity and gains surge", () => {
    const state = base();
    const hero = identityOf(state);
    const hurt = patchInstance(state, hero, { damage: 6 });
    const plain = villainPhase(hurt, ADVANCE, ADVANCE, ADVANCE);
    const after = villainPhase(hurt, ADVANCE, MISDIRECT, ADVANCE);
    expect(inst(plain, hero).damage - inst(after, hero).damage).toBe(4);
    const deckSizeDrop = deckSize(plain) - deckSize(after);
    expect(deckSizeDrop).toBe(1); // surge: one more card revealed
  });

  it("Boost: stuns an enemy", () => {
    const state = base();
    const events = villainPhaseEvents(state, MISDIRECT, ADVANCE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "statusGiven", instanceId: villainOf(state), status: "stunned" }),
    );
  });
});

describe("63037 Sabotage", () => {
  it("When Revealed: removes 3 threat from the main scheme and gains surge", () => {
    const state = patchInstance(base(), base().mainScheme.instanceId, { threat: 5 });
    const events = villainPhaseEvents(state, ADVANCE, SABOTAGE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "threatRemoved", schemeInstanceId: state.mainScheme.instanceId, amount: 3 }),
    );
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
  });

  it("Boost: confuses an enemy", () => {
    const state = base();
    const events = villainPhaseEvents(state, SABOTAGE, ADVANCE, ADVANCE);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "statusGiven", instanceId: villainOf(state), status: "confused" }),
    );
  });
});

describe("63034 Double-Cross: When Defeated, shuffle the set-aside treacheries into the top 10 encounter cards", () => {
  const LINKED = [BACKSTAB, MISDIRECT, SABOTAGE];
  const codeOf = (s: GameState, id: InstanceId) => inst(s, id).cardId as string;
  const setAsideLinked = (s: GameState) => s.encounterSetAside.filter((id) => LINKED.includes(codeOf(s, id)));
  /** Spider-Man's deck with Double-Cross, played (2 threat), left with 1 threat; `deck` trims the encounter deck. */
  function inPlay(deckCards?: number) {
    const game = elektraAspectGame("63034", SPIDER_MAN_JUSTICE);
    const given = moveToHand(game, P1, "63034");
    const played = drive(given.state, accepting(), play(P1, given.ids[0]!, []));
    const id = given.ids[0]!;
    let state = patchInstance(played, id, { threat: 1 });
    if (deckCards !== undefined) {
      const deckId = activeEncounterDeckId(state);
      const piles = state.encounterDecks[deckId]!;
      state = {
        ...state,
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(0, deckCards) } },
      };
    }
    return { state, id };
  }
  const thwart = (s: GameState, scheme: InstanceId) =>
    drive(s, accepting(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: scheme,
    } as never);

  it("setup set the three treacheries aside; playing Double-Cross puts it into play", () => {
    const { state, id } = inPlay();
    expect(
      setAsideLinked(state)
        .map((i) => codeOf(state, i))
        .sort(),
    ).toEqual(LINKED);
    expect(locateCard(state, id)?.kind).toBe("villainArea"); // side schemes are in the villain area
    expect(inst(state, id).threat).toBe(1);
  });

  it("defeated: it goes to the victory display and the three are shuffled in among the top 10 (13 on top), the rest in order", () => {
    const { state, id } = inPlay();
    const before = activeEncounterDeck(state).deck;
    const after = thwart(state, id);
    expect(after.victoryDisplay).toContain(id);
    expect(setAsideLinked(after)).toEqual([]);
    const deck = activeEncounterDeck(after).deck;
    expect(deck.length).toBe(before.length + 3);
    const top = deck.slice(0, 13);
    expect(top.filter((i) => LINKED.includes(codeOf(after, i))).length).toBe(3);
    expect([...top].sort()).toEqual([...before.slice(0, 10), ...setAsideLinked(state)].sort());
    expect(deck.slice(13)).toEqual(before.slice(10));
  });

  it("with fewer than 10 encounter cards, they are shuffled into the whole deck", () => {
    const { state, id } = inPlay(4);
    const after = thwart(state, id);
    const deck = activeEncounterDeck(after).deck;
    expect(deck.length).toBe(7);
    expect(deck.filter((i) => LINKED.includes(codeOf(after, i))).length).toBe(3);
  });

  it("with a copy of Double-Cross already in the victory display, nothing is shuffled in", () => {
    const { state, id } = inPlay();
    // Surgery: another Double-Cross (a retagged discard-bound card) already in the victory display.
    const other = playerOf(state, P1).deck[0]!;
    const withCopy: GameState = {
      ...patchInstance(state, other, { cardId: "63034" as never }),
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.slice(1) } : p)),
      victoryDisplay: [...state.victoryDisplay, other],
    };
    const before = activeEncounterDeck(withCopy).deck;
    const after = thwart(withCopy, id);
    expect(after.victoryDisplay).toContain(id);
    expect(setAsideLinked(after).length).toBe(3);
    expect(activeEncounterDeck(after).deck).toEqual(before);
  });
});
