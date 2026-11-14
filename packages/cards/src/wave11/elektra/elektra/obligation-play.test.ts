import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  legalActions,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../../index.js";
import { elektraGame, elektraHeroGame } from "./elektra.testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Play-throughs of Conditioned by the Hand 63040 and Aka 63041 (PROVISIONAL text, see obligation-nemesis.ts) with
 * Elektra herself seated (`elektra.testing.ts`): the obligation staged in P1's play area as if drawn earlier.
 */
const MOON_KNIGHT = "63039"; // an ally with 5 hit points
const OBLIG = "oblig" as InstanceId;
const ACTION = "63040.conditioned-by-the-hand-action";

const step = (s: GameState, command: Parameters<typeof applyCommand>[1]): GameState => {
  const r = applyCommand(s, command, DEPS);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const refuses = (s: GameState, command: Parameters<typeof applyCommand>[1]): boolean =>
  !applyCommand(s, command, DEPS).ok;

/** A copy of Moon Knight (retagged from a spare deck card) in P1's play area. */
function withAlly(state: GameState): { state: GameState; id: InstanceId } {
  const deck = playerOf(state, P1).deck;
  return stagedInPlay(patchInstance(state, deck[deck.length - 1]!, { cardId: cardId(MOON_KNIGHT) }), MOON_KNIGHT);
}
/** Conditioned by the Hand in P1's play area, faceup, held by P1 (the luke_cage `injury()` shape). */
function withObligation(state: GameState): GameState {
  const placed = engageMinion(state, "63040", "oblig");
  return patchInstance(placed, OBLIG, { engagedWith: null, ownerId: P1, controllerId: P1 });
}

/** Every player ends their turn; reports the options of the obligation's target prompt, if one was asked. */
function endPlayerPhase(state: GameState): { prompt: readonly string[] | null; state: GameState } {
  let prompt: readonly string[] | null = null;
  const pick: Picker = (s) => {
    const c = s.pendingChoice!;
    if (c.prompt.kind === "chooseTarget" && (c.prompt as { slot?: string }).slot === "victim") {
      prompt ??= c.options.map((o) => String(o.optionId));
      return [c.options[0]!.optionId];
    }
    if (c.prompt.kind === "chooseTriggers") return c.options.map((o) => o.optionId);
    return c.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
  };
  let s = state;
  for (const p of state.players) s = settle(step(s, endTurn(p.playerId)), pick, undefined, DEPS);
  return { prompt, state: s };
}

describe("63040 Conditioned by the Hand: Forced Response (Hero)", () => {
  it("hero form: at the end of the player phase offers allies and other identities, not her own, and the target takes exactly 3", () => {
    const hero = withAlly(withObligation(elektraHeroGame({ withSpiderMan: true })));
    const { prompt, state } = endPlayerPhase(hero.state);
    expect(prompt).not.toBeNull();
    expect(prompt).toContain(hero.id);
    expect(prompt).toContain(identityOf(hero.state, P2));
    expect(prompt).not.toContain(identityOf(hero.state, P1));
    const chosen = prompt![0]!;
    expect(inst(state, chosen as InstanceId).damage).toBeGreaterThanOrEqual(3);
    expect(inst(state, hero.id).damage + inst(state, identityOf(state, P2)).damage).toBe(3);
  });

  it("alter-ego form: does not fire", () => {
    const ally = withAlly(withObligation(elektraGame()));
    const { prompt, state } = endPlayerPhase(ally.state);
    expect(prompt).toBeNull();
    expect(inst(state, ally.id).damage).toBe(0);
  });

  it("hero form with no ally and no other identity: no legal target, nothing is asked or damaged", () => {
    const control = endPlayerPhase(elektraHeroGame()).state;
    const { prompt, state } = endPlayerPhase(withObligation(elektraHeroGame()));
    expect(prompt).toBeNull();
    expect(inst(state, identityOf(state)).damage).toBe(inst(control, identityOf(control)).damage);
  });
});

describe("63040 Conditioned by the Hand: Alter-Ego Action", () => {
  const offered = (s: GameState): boolean => {
    const actions = legalActions(s, P1, DEPS);
    return actions.kind === "turn" && actions.legal.some((a) => JSON.stringify(a.example).includes(ACTION));
  };

  it("alter-ego form: exhausts her identity and discards the card to the encounter discard pile", () => {
    const state = withObligation(elektraGame());
    expect(offered(state)).toBe(true);
    const after = settle(step(state, use(P1, OBLIG, ACTION)), firstLegal, undefined, DEPS);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    expect(playerOf(after, P1).playArea).not.toContain(OBLIG);
    expect(activeEncounterDeck(after).discard).toContain(OBLIG);
  });

  it("is refused in hero form, and with her identity exhausted", () => {
    const hero = withObligation(elektraHeroGame());
    expect(refuses(hero, use(P1, OBLIG, ACTION))).toBe(true);
    const alter = withObligation(elektraGame());
    expect(refuses(patchInstance(alter, identityOf(alter), { exhausted: true }), use(P1, OBLIG, ACTION))).toBe(true);
  });
});

/** The set-aside nemesis card `code` on top of the encounter deck, the next cards turned into Advance (boost 0). */
function onTop(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = playerOf(state, P1).setAside.find((i) => state.instances[i]!.cardId === cardId(code))!;
  const rest = pile.deck.filter((i) => i !== id);
  const placed: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { deck: [id, ...rest], discard: pile.discard } },
  };
  return {
    id,
    state: rest.slice(0, 15).reduce((acc, i) => patchInstance(acc, i, { cardId: cardId("01186") }), placed),
  };
}

describe("63041 Aka: Boost, deal this card to the Elektra Natchios player as a facedown encounter card", () => {
  it.each([
    ["hero", () => elektraHeroGame()],
    ["alter-ego", () => elektraGame()],
  ])("%s form: Rhino's boost card Aka is dealt to her and revealed, ending engaged with her", (_form, make) => {
    const aka = onTop(make(), "63041");
    const decline: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
    const after = settle(step(aka.state, endTurn(P1)), decline, undefined, DEPS);
    expect(inst(after, aka.id).engagedWith).toBe(P1);
    expect(playerOf(after, P1).playArea).toContain(aka.id);
  });
});
