import { cardId } from "@mc/content";
import {
  characterProfile,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import {
  JJ_JESSICA_JONES_OBLIGATION_NEMESIS as REGISTRY,
  JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/jessica-jones/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4, H3.10): Work-Life Balance
 * 61030, Purple Man 61031, Indomitable Will 61032 and Suggestion 61033a/b/c. Jessica's identity is another module, so
 * these games seat the Core Spider-Man starter deck (alter-ego form) with cards relabelled by surgery.
 */
const WORK_LIFE_C = "61030.work-life-balance-constant";
const WORK_LIFE_A = "61030.work-life-balance-action";
const PURPLE_MAN_C = "61031.purple-man-constant";
const WILL_REVEALED = "61032.when-revealed";
const WILL_FORCED = "61032.indomitable-will-forced-response";
const SUGGESTION_REFS = [
  ["61033a", "energy", "61033a.suggestion-constant", "61033a.suggestion-forced-action"],
  ["61033b", "mental", "61033b.suggestion-constant", "61033b.suggestion-forced-action"],
  ["61033c", "physical", "61033c.suggestion-constant", "61033c.suggestion-forced-action"],
] as const;
const WORK_LIFE = "61030";
const PURPLE_MAN = "61031";
const WILL = "61032";
const ALLY = "01067"; // Core ally (Maria Hill)
const ADVANCE = "01186"; // Core treachery filler
const byCode = (s: GameState, code: string) => Object.values(s.instances).find((i) => i.cardId === cardId(code))!;
const relabel = (s: GameState, id: InstanceId, code: string) => patchInstance(s, id, { cardId: cardId(code) });

function baseGame(): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const created = createGame({ ...base, requireLegalDecks: false }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE11_DEPS);
  // Headroom on the main scheme (a negative count, surgery), so threat added in a test is readable.
  return patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
}

/** The code relabelled onto the first deck cards, one each. */
function withCodes(...codes: readonly string[]): GameState {
  let s = baseGame();
  const deck = playerOf(s, P1).deck;
  codes.forEach((code, i) => {
    s = relabel(s, deck[i]!, code);
  });
  return s;
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const first = sessionApply(session, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
  }
  const replayed = replay(session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session.state;
}

/** Answers a `chooseOption` prompt with the option ids given (indices, "0", "1"); anything else as `firstLegal`. */
const optionIds =
  (...ids: readonly string[]): Picker =>
  (state) =>
    state.pendingChoice?.prompt.kind === "chooseOption" ? ids : firstLegal(state);

const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;

describe("wave 11 jj/jessica-jones/obligation-nemesis registry", () => {
  it("registers only valid definitions, every ref, with the printed timing", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
    expect(SKIPPED).toEqual({});
    expect(REGISTRY[WORK_LIFE_A]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY[WILL_FORCED]!.trigger).toMatchObject({ kind: "response", forced: true });
    for (const [, , constantRef, actionRef] of SUGGESTION_REFS) {
      expect(REGISTRY[constantRef]!.trigger).toMatchObject({ kind: "constant" });
      expect(REGISTRY[actionRef]!.trigger).toMatchObject({ kind: "action", forced: true });
    }
    expect(Object.keys(REGISTRY)).toHaveLength(11);
  });
});

describe(`${WORK_LIFE_C}: discard 1 card from your hand to change forms`, () => {
  it("refuses the change unpaid and takes the discard when paid, in either direction", () => {
    const { state: s, id } = stagedInPlay(withCodes(WORK_LIFE), WORK_LIFE);
    expect(id).toBeDefined();
    expect(sessionApply(startSession(s), { type: "changeForm", playerId: P1 }, WAVE11_DEPS).ok).toBe(false);
    const card = playerOf(s, P1).hand[0]!;
    const paid = drive(s, { type: "changeForm", playerId: P1, costChoices: { discard: [card] } });
    expect(playerOf(paid, P1).identity.form).toBe("hero");
    expect(playerOf(paid, P1).discard).toContain(card);
    expect(playerOf(paid, P1).hand).not.toContain(card);
  });
});

describe(`${WORK_LIFE_A}: Alter-Ego Action, choose one`, () => {
  it("removes an ally you control from the game, then removes itself from the game", () => {
    const g = stagedInPlay(withCodes(WORK_LIFE, ALLY), WORK_LIFE);
    const ally = stagedInPlay(g.state, ALLY);
    const after = drive(ally.state, use(P1, g.id, WORK_LIFE_A), optionIds("0"));
    expect(playerOf(after, P1).playArea).not.toContain(ally.id);
    expect(playerOf(after, P1).playArea).not.toContain(g.id);
    for (const id of [ally.id, g.id]) {
      expect(playerOf(after, P1).discard).not.toContain(id);
      expect(Object.values(after.encounterDecks).some((p) => p.discard.includes(id))).toBe(false);
    }
  });

  it("offers the ally option only with an ally in play: alone, the one option left is to confuse", () => {
    const g = stagedInPlay(withCodes(WORK_LIFE), WORK_LIFE);
    const after = drive(g.state, use(P1, g.id, WORK_LIFE_A));
    expect(inst(after, identityOf(after)).statuses.confused).toBe(1);
    expect(playerOf(after, P1).playArea).not.toContain(g.id);
  });

  it("confusing your identity discards the card", () => {
    const g = stagedInPlay(withCodes(WORK_LIFE, ALLY), WORK_LIFE);
    const ally = stagedInPlay(g.state, ALLY);
    const after = drive(ally.state, use(P1, g.id, WORK_LIFE_A), optionIds("1"));
    expect(inst(after, identityOf(after)).statuses.confused).toBe(1);
    expect(playerOf(after, P1).playArea).toContain(ally.id);
    expect(playerOf(after, P1).playArea).not.toContain(g.id);
  });

  // No option is selectable here. Today the engine accepts the action and resolves it as a no-op; a "some option is
  // selectable" gate on chooseOne (so the action cannot be initiated) is queued as an engine task.
  it("with no ally and the identity already confused, the action resolves as a no-op and the card stays", () => {
    const g = stagedInPlay(withCodes(WORK_LIFE), WORK_LIFE);
    const confused = patchInstance(g.state, identityOf(g.state), { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const after = drive(confused, use(P1, g.id, WORK_LIFE_A));
    expect(playerOf(after, P1).playArea).toContain(g.id);
  });

  it("cannot be used in hero form", () => {
    const g = stagedInPlay(withCodes(WORK_LIFE), WORK_LIFE);
    const hero = withForm(g.state, { heroForm: 0 });
    expect(sessionApply(startSession(hero), use(P1, g.id, WORK_LIFE_A), WAVE11_DEPS).ok).toBe(false);
  });
});

describe(`${PURPLE_MAN_C}: SCH from the highest SCH or THW, ATK from the highest ATK, among the other characters`, () => {
  // Core stats: Spider-Man hero THW 1 ATK 2, alter-ego THW 0 ATK 0; Rhino SCH 1 ATK 2; minion 01102 SCH 2 ATK 3;
  // Heroic Intuition 01065 gives the hero +1 THW. Each literal below is read off those, so a wrong base or a
  // self-read would show.
  const pm = "pm" as InstanceId;
  const heroGame = (...extra: readonly string[]) => {
    let s = withForm(withCodes("01065"), { heroForm: 0 });
    for (const code of extra) s = engageMinion(s, code, `m${code}`);
    return engageMinion(s, PURPLE_MAN, "pm");
  };

  it("hero form: SCH 1 and ATK 2 (Rhino and the hero); a +1 THW upgrade lifts SCH to 2", () => {
    const s = heroGame();
    expect(profile(s, pm)).toMatchObject({ sch: 1, atk: 2 });
    const upgraded = stagedInPlay(s, "01065", { attach: true }).state;
    expect(profile(upgraded, identityOf(upgraded)).thw).toBe(2);
    expect(profile(upgraded, pm)).toMatchObject({ sch: 2, atk: 2 });
  });

  it("alter-ego form adds nothing: SCH 1 (the villain) and ATK 2", () => {
    const s = engageMinion(withCodes("01065"), PURPLE_MAN, "pm");
    expect(profile(s, pm)).toMatchObject({ sch: 1, atk: 2 });
  });

  it("copies another minion's SCH 2 and ATK 3", () => {
    expect(profile(heroGame("01102"), pm)).toMatchObject({ sch: 2, atk: 3 });
  });
});

describe(`${WILL_REVEALED} and ${WILL_FORCED}: pheromone counters on Suggestion obligations`, () => {
  /** The nth card of the encounter deck relabelled as `code` (surgery); returns the card's id. */
  const relabelEncounterCard = (state: GameState, n: number, code: string) => {
    const id = Object.values(state.encounterDecks)[0]!.deck[n]!;
    return { state: relabel(state, id, code), id };
  };
  /** `code` stacked as the player's reveal (behind Rhino's boost filler) and the villain phase run. */
  const revealed = (state: GameState, code: string) =>
    drive(stackEncounterDeck(state, ADVANCE, code), { type: "endTurn", playerId: P1 });

  it("When Revealed: 2 counters on each Suggestion in play and none on other cards", () => {
    const a = stagedInPlay(withCodes("61033a", "61033b", ALLY), "61033a", { counters: { pheromone: 3 } });
    const b = stagedInPlay(a.state, "61033b", { counters: { pheromone: 1 } });
    // Exhausted, so their own Forced Actions are not owed when the turn ends.
    const spent = patchInstance(patchInstance(b.state, a.id, { exhausted: true }), b.id, { exhausted: true });
    const other = stagedInPlay(spent, ALLY);
    const will = relabelEncounterCard(other.state, 2, WILL);
    const after = revealed(will.state, WILL);
    expect(inst(after, will.id).faceup).toBe(true);
    expect(after.villainArea).toContain(will.id);
    expect(inst(after, a.id).counters.pheromone).toBe(5);
    expect(inst(after, b.id).counters.pheromone).toBe(3);
    expect(inst(after, other.id).counters.pheromone ?? 0).toBe(0);
  });

  it("When Revealed skips a Suggestion that is not in play (one still in the deck)", () => {
    const deckSuggestion = byCode(withCodes("61033a"), "61033a");
    const will = relabelEncounterCard(withCodes("61033a"), 2, WILL);
    const after = revealed(will.state, WILL);
    expect(inst(after, byCode(after, "61033a").instanceId).counters.pheromone ?? 0).toBe(0);
    expect(deckSuggestion.instanceId).toBe(byCode(after, "61033a").instanceId);
  });

  it("Forced Response: a Suggestion that enters play afterwards gets 2 more on top of its 3", () => {
    const will = relabelEncounterCard(baseGame(), 2, WILL);
    const suggestion = relabelEncounterCard(will.state, 3, "61033c");
    const inPlay = encounterCardInVillainArea(suggestion.state, WILL);
    const after = revealed(inPlay.state, "61033c");
    expect(inst(after, suggestion.id).counters.pheromone).toBe(5);
    expect(playerOf(after, P1).playArea).toContain(suggestion.id);
  });

  it("without Indomitable Will in play a Suggestion keeps its 3", () => {
    const suggestion = relabelEncounterCard(baseGame(), 3, "61033a");
    const after = revealed(suggestion.state, "61033a");
    expect(inst(after, suggestion.id).counters.pheromone).toBe(3);
  });
});

// Core Justice supports by printed icon, to stage the hand: Energy Channel-style 01063 [energy] cost 1, 01064 [mental]
// cost 2, and the basic 01092 [physical] cost 3.
const SUPPORT_BY_ICON = { energy: "01063", mental: "01064", physical: "01092" } as const;
const COST_BY_ICON = { energy: 1, mental: 2, physical: 3 } as const;
const OTHER_ICON = { energy: "01064", mental: "01063", physical: "01063" } as const;

describe.each(SUGGESTION_REFS)(
  "%s Suggestion ([%s]): Uses (3 pheromone), forced play of that icon or 2 threat",
  (code, icon, _constantRef, action) => {
    const staged = (pheromone: number) => stagedInPlay(withCodes(code), code, { counters: { pheromone } });
    const withHand = (s: GameState, codes: readonly string[]) => {
      let next = s;
      playerOf(s, P1).hand.forEach((id, i) => {
        if (codes[i]) next = relabel(next, id, codes[i]!);
      });
      return next;
    };

    it("exhausts, removes 1 counter, and adds 2 threat to the main scheme when the player chooses it", () => {
      const g = staged(3);
      const after = drive(withHand(g.state, [SUPPORT_BY_ICON[icon]]), use(P1, g.id, action), optionIds("1"));
      expect(inst(after, g.id).exhausted).toBe(true);
      expect(inst(after, g.id).counters.pheromone).toBe(2);
      expect(mainThreat(after)).toBe(mainThreat(g.state) + 2);
    });

    it("plays a card with that printed icon, paying its cost, and adds no threat", () => {
      const g = staged(3);
      const hand = Array.from({ length: 5 }, (_, i) => (i === 0 ? SUPPORT_BY_ICON[icon] : OTHER_ICON[icon]));
      const prepared = withHand(g.state, hand);
      const support = playerOf(prepared, P1).hand[0]!;
      const after = drive(prepared, use(P1, g.id, action), optionIds("0"));
      expect(inst(after, g.id).exhausted).toBe(true);
      expect(inst(after, g.id).counters.pheromone).toBe(2);
      expect(playerOf(after, P1).playArea).toContain(support);
      expect(playerOf(after, P1).hand.length).toBe(playerOf(prepared, P1).hand.length - 1 - COST_BY_ICON[icon]);
      expect(mainThreat(after)).toBe(mainThreat(g.state));
    });

    it("offers the play option only while the hand holds a card with that printed icon", () => {
      const g = staged(3);
      const wrong = withHand(
        g.state,
        Array.from({ length: 5 }, () => OTHER_ICON[icon]),
      );
      const after = drive(wrong, use(P1, g.id, action));
      expect(mainThreat(after)).toBe(mainThreat(g.state) + 2);
      const emptied = { ...g.state, players: g.state.players.map((p) => ({ ...p, hand: [] })) };
      expect(mainThreat(drive(emptied, use(P1, g.id, action)))).toBe(mainThreat(g.state) + 2);
    });

    it("does not count a printed wild icon as that resource", () => {
      const g = staged(3);
      const wild = withHand(
        g.state,
        Array.from({ length: 5 }, () => "01011"),
      );
      expect(mainThreat(drive(wild, use(P1, g.id, action)))).toBe(mainThreat(g.state) + 2);
    });

    it("the third use removes the last counter and discards the card (RRG 1.8 Uses, p. 44)", () => {
      const g = staged(1);
      const after = drive(g.state, use(P1, g.id, action), optionIds("1"));
      expect(playerOf(after, P1).playArea).not.toContain(g.id);
    });

    it("with no counter left the cost cannot be paid", () => {
      const g = staged(0);
      expect(sessionApply(startSession(g.state), use(P1, g.id, action), WAVE11_DEPS).ok).toBe(false);
    });
  },
);
