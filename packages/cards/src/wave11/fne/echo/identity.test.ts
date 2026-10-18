import { FNE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import { applyCommand, createGame, type Command, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  play,
  playerOf,
  settle,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_ECHO_IDENTITY as REGISTRY, FNE_ECHO_IDENTITY_SKIPPED as SKIPPED } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Echo (60037a hero face) and Maya Lopez (60037b), docs/phase7-wave11.md section 3.9 and 8.4 line 6, in the printed
 * starter deck `fne-echo-protection` against Core's Rhino. Hero face: THW 2, ATK 2, DEF 2, hand size 5, 9 hit points;
 * alter-ego face: REC 3, hand size 6. Cards are placed by surgery (retagging deck cards), so other modules are not
 * relied on. Rulings: August 13, 2026 (1) (a stunned Echo's attack event still counts as played; a borrowed event
 * cannot be tucked).
 */
const WATCH = "60037a.watch-and-learn";
const PRACTICE = "60037b.practice-makes-perfect";

const FIRST_AID = "01086"; // basic event, cost 1
const HAYMAKER = "01087"; // basic event, cost 2, Attack
const ARMY_OF_ONE = "60048"; // protection event
const GET_THEIR_ATTENTION = "60049"; // protection event
const STUDY_THE_TAPE = "60041"; // Echo's identity-specific event
const ENERGY = "01088"; // basic resource
const POOL_EVENT = "44021"; // Deadpool's Pool event, cost 1

function newGame(seed = 1, twoPlayers = false): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
  const config = coreScenario("rhino", {
    players: twoPlayers
      ? [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }]
      : [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: twoPlayers ? [seat, config.players[1]!] : [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}
const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((i) => codeOf(s, i));
const discardCodes = (s: GameState): string[] => codes(s, playerOf(s, P1).discard);
const tuckedCodes = (s: GameState): string[] => codes(s, inst(s, identityOf(s)).tucked);

/** Exactly `list` (each a retagged deck card) in P1's hand. */
function handOf(state: GameState, ...list: readonly string[]) {
  let current = state;
  const ids: InstanceId[] = [];
  for (const code of list) {
    const id = playerOf(current, P1).deck.find((i) => !ids.includes(i))!;
    current = patchInstance(current, id, { cardId: cardId(code) });
    current = {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
    };
    ids.push(id);
  }
  return {
    ids,
    state: {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, hand: ids } : p)),
    } as GameState,
  };
}
/** Cards tucked under the identity (retagged deck cards, taken out of every zone). */
function withTucked(state: GameState, ...list: readonly string[]): GameState {
  let current = state;
  const tucked: InstanceId[] = [];
  for (const code of list) {
    const id = playerOf(current, P1).deck.find((i) => !tucked.includes(i))!;
    current = patchInstance(current, id, { cardId: cardId(code) });
    current = {
      ...current,
      players: current.players.map((p) => (p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
    };
    tucked.push(id);
  }
  return patchInstance(current, identityOf(current), { tucked });
}

/** Takes the option of `abilityId` when a window offers it (`seen.offered` records it), else the first legal pick. */
const taking =
  (abilityId: string | null, seen: { offered: boolean }): Picker =>
  (state) => {
    const options = state.pendingChoice?.options ?? [];
    const hit = abilityId ? options.find((o) => o.optionId.endsWith(`:${abilityId}`)) : undefined;
    if (hit) seen.offered = true;
    return hit ? [hit.optionId] : firstLegal(state);
  };

function drive(state: GameState, command: Command, take: string | null = WATCH) {
  const seen = { offered: false };
  const first = applyCommand(state, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(first.error.message);
  const rest = driveStepwise(WAVE11_DEPS, first.state, taking(take, seen));
  return {
    state: rest.state,
    events: [...first.events, ...rest.events] as readonly GameEvent[],
    offered: seen.offered,
  };
}

describe("wave 11 fne/echo/identity", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts both refs of 60037a/b, none skipped, with the printed timing", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([PRACTICE, WATCH].sort());
    expect(SKIPPED).toEqual({});
    expect(REGISTRY[WATCH]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[PRACTICE]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
  });

  describe("60037a.watch-and-learn", () => {
    it("tucks a played basic event under Echo from her discard pile", () => {
      const staged = handOf(heroGame(), HAYMAKER, ENERGY, ENERGY);
      const run = drive(staged.state, play(P1, staged.ids[0]!, [staged.ids[1]!, staged.ids[2]!]));
      expect(run.offered).toBe(true);
      expect(tuckedCodes(run.state)).toEqual([HAYMAKER]);
      expect(discardCodes(run.state)).not.toContain(HAYMAKER);
    });

    it("tucks an aspect event too (Protection), and the response is optional (declined: it stays discarded)", () => {
      const staged = handOf(heroGame(), ARMY_OF_ONE, ENERGY);
      const taken = drive(staged.state, play(P1, staged.ids[0]!, [staged.ids[1]!]));
      expect(tuckedCodes(taken.state)).toEqual([ARMY_OF_ONE]);
      const declined = drive(staged.state, play(P1, staged.ids[0]!, [staged.ids[1]!]), null);
      expect(tuckedCodes(declined.state)).toEqual([]);
      expect(discardCodes(declined.state)).toContain(ARMY_OF_ONE);
    });

    it("does not answer an identity-specific event (Study the Tape)", () => {
      const staged = handOf(heroGame(), STUDY_THE_TAPE);
      const run = drive(staged.state, play(P1, staged.ids[0]!));
      expect(run.offered).toBe(false);
      expect(tuckedCodes(run.state)).toEqual([]);
      expect(discardCodes(run.state)).toContain(STUDY_THE_TAPE);
    });

    it("a stunned Echo's attack event is still played, so she still tucks it (August 13, 2026 (1) answer 1)", () => {
      const base = handOf(heroGame(), HAYMAKER, ENERGY, ENERGY);
      const id = identityOf(base.state);
      const stunned = patchInstance(base.state, id, { statuses: { ...inst(base.state, id).statuses, stunned: 1 } });
      const run = drive(stunned, play(P1, base.ids[0]!, [base.ids[1]!, base.ids[2]!]));
      expect(run.offered).toBe(true);
      expect(tuckedCodes(run.state)).toEqual([HAYMAKER]);
      expect(inst(run.state, id).statuses.stunned).toBe(0);
    });

    it("with 3 already tucked, a fourth makes her discard all but 3 (her choice), the rest to the discard pile", () => {
      const base = handOf(
        withTucked(heroGame(), ARMY_OF_ONE, GET_THEIR_ATTENTION, FIRST_AID),
        HAYMAKER,
        ENERGY,
        ENERGY,
      );
      const run = drive(base.state, play(P1, base.ids[0]!, [base.ids[1]!, base.ids[2]!]));
      expect(tuckedCodes(run.state)).toHaveLength(3);
      const all = [ARMY_OF_ONE, GET_THEIR_ATTENTION, FIRST_AID, HAYMAKER];
      const gone = all.filter((c) => !tuckedCodes(run.state).includes(c));
      expect(gone).toHaveLength(1);
      expect(discardCodes(run.state)).toContain(gone[0]);
    });

    it("with 2 already tucked a third is simply added", () => {
      const base = handOf(withTucked(heroGame(), ARMY_OF_ONE, GET_THEIR_ATTENTION), HAYMAKER, ENERGY, ENERGY);
      const run = drive(base.state, play(P1, base.ids[0]!, [base.ids[1]!, base.ids[2]!]));
      expect(tuckedCodes(run.state).sort()).toEqual([ARMY_OF_ONE, GET_THEIR_ATTENTION, HAYMAKER].sort());
    });

    it("tucks a Pool event too (the five aspects, RRG 1.8 Classifications p. 12)", () => {
      const staged = handOf(heroGame(), POOL_EVENT, ENERGY);
      const run = drive(staged.state, play(P1, staged.ids[0]!, [staged.ids[1]!]));
      expect(run.offered).toBe(true);
      expect(tuckedCodes(run.state)).toEqual([POOL_EVENT]);
    });

    /** P2's hand is exactly `list` (retagged deck cards of P2). */
    function p2Hand(state: GameState, ...list: readonly string[]) {
      let current = state;
      const ids: InstanceId[] = [];
      for (const code of list) {
        const id = playerOf(current, P2).deck.find((i) => !ids.includes(i))!;
        current = patchInstance(current, id, { cardId: cardId(code) });
        current = {
          ...current,
          players: current.players.map((p) => (p.playerId === P2 ? { ...p, deck: p.deck.filter((i) => i !== id) } : p)),
        };
        ids.push(id);
      }
      return {
        ids,
        state: {
          ...current,
          players: current.players.map((p) => (p.playerId === P2 ? { ...p, hand: ids } : p)),
        } as GameState,
      };
    }

    it("another player's aspect event is tucked under Echo from that player's discard pile", () => {
      const base = p2Hand(withForm(newGame(1, true), { heroForm: 0 }), ARMY_OF_ONE, ENERGY);
      const turn = applyCommand(base.state, endTurn(P1), WAVE11_DEPS);
      if (!turn.ok) throw new Error(turn.error.message);
      const run = drive(turn.state, play(P2, base.ids[0]!, [base.ids[1]!]));
      expect(run.offered).toBe(true);
      expect(tuckedCodes(run.state)).toEqual([ARMY_OF_ONE]);
      expect(inst(run.state, base.ids[0]!).ownerId).toBe(P2);
      expect(codes(run.state, playerOf(run.state, P2).discard)).not.toContain(ARMY_OF_ONE);
    });

    it("a discarded tucked card owned by another player goes to that owner's discard pile (RRG Tuck, p. 45)", () => {
      const tucked = withTucked(
        withForm(newGame(1, true), { heroForm: 0 }),
        ARMY_OF_ONE,
        GET_THEIR_ATTENTION,
        FIRST_AID,
      );
      const foreign = inst(tucked, identityOf(tucked)).tucked[0]!;
      const reowned = patchInstance(tucked, foreign, { ownerId: P2 });
      const base = handOf(reowned, HAYMAKER, ENERGY, ENERGY);
      // Echo's player keeps every card but the P2-owned one.
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseCards" && choice.prompt.slot === "kept")
          return choice.options
            .filter((o) => o.optionId !== foreign)
            .slice(0, 3)
            .map((o) => o.optionId);
        return taking(WATCH, { offered: false })(s);
      };
      const first = applyCommand(base.state, play(P1, base.ids[0]!, [base.ids[1]!, base.ids[2]!]), WAVE11_DEPS);
      if (!first.ok) throw new Error(first.error.message);
      const run = driveStepwise(WAVE11_DEPS, first.state, pick);
      expect(inst(run.state, foreign).ownerId).toBe(P2);
      expect(tuckedCodes(run.state)).toHaveLength(3);
      expect(inst(run.state, identityOf(run.state)).tucked).not.toContain(foreign);
      expect(playerOf(run.state, P2).discard).toContain(foreign);
      expect(playerOf(run.state, P1).discard).not.toContain(foreign);
    });
    it("is not available on the Maya Lopez face (it is printed on the hero face)", () => {
      const base = handOf(withForm(newGame(), "alterEgo"), FIRST_AID, ENERGY);
      const run = drive(base.state, play(P1, base.ids[0]!, [base.ids[1]!]));
      expect(run.offered).toBe(false);
      expect(tuckedCodes(run.state)).toEqual([]);
    });
  });

  describe("60037b.practice-makes-perfect", () => {
    const isEvent = (s: GameState, i: InstanceId) =>
      PLAYABLE_CARDS.find((c) => c.id === inst(s, i).cardId)?.type === "event";

    it("on changing to hero form, searches the deck for an aspect or basic event, adds it to hand and shuffles", () => {
      const alterEgo = withForm(newGame(), "alterEgo");
      const before = playerOf(alterEgo, P1);
      const eventsInDeck = before.deck.filter((i) => isEvent(alterEgo, i) && codeOf(alterEgo, i) !== STUDY_THE_TAPE);
      expect(eventsInDeck.length).toBeGreaterThan(0);
      const run = drive(alterEgo, toHero(), PRACTICE);
      expect(run.offered).toBe(true);
      const after = playerOf(run.state, P1);
      expect(after.hand.length).toBe(before.hand.length + 1);
      const added = after.hand.filter((i) => !before.hand.includes(i));
      expect(added).toHaveLength(1);
      expect(eventsInDeck).toContain(added[0]);
      expect(after.deck).toHaveLength(before.deck.length - 1);
      // Shuffled: the remaining deck is not the old order with the found card removed.
      expect(after.deck).not.toEqual(before.deck.filter((i) => i !== added[0]));
    });

    it("does not find Echo's identity-specific events (Study the Tape stays in the deck)", () => {
      let state = withForm(newGame(), "alterEgo");
      for (const i of playerOf(state, P1).deck) {
        if (isEvent(state, i)) state = patchInstance(state, i, { cardId: cardId(ENERGY) });
      }
      state = patchInstance(state, playerOf(state, P1).deck[0]!, { cardId: cardId(STUDY_THE_TAPE) });
      const before = playerOf(state, P1).hand.length;
      const run = drive(state, toHero(), PRACTICE);
      expect(playerOf(run.state, P1).hand).toHaveLength(before);
      expect(codes(run.state, playerOf(run.state, P1).deck)).toContain(STUDY_THE_TAPE);
    });
  });
});
