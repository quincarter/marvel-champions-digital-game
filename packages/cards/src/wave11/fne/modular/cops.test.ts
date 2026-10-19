import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  characterProfile,
  createGame,
  hasKeyword,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  withForm,
} from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_MODULAR_COPS as REGISTRY, FNE_MODULAR_COPS_SKIPPED as SKIPPED } from "./cops.js";

vi.setConfig({ testTimeout: 180_000 });

const COP = "60182";
const CROOKED = "60183";
const WANTED = "60184";
const CORDON = "60185";
const ADVANCE = "01186";
const ASSAULT = "01187";
const WHIPLASH = "60081";
const REFS = [
  "60182.cop-forced-interrupt",
  "60182.when-defeated",
  "60183.when-defeated",
  "60183.boost",
  "60184.obligation",
  "60185.police-cordon-constant",
  "60185.when-revealed",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const heroDamage = (s: GameState, p: PlayerId = P1): number => damageOf(s, identityOf(s, p));
const mainScheme = (s: GameState): InstanceId => s.mainScheme!.instanceId;
const threatOf = (s: GameState): number => inst(s, mainScheme(s)).threat;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const idsOf = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);

/** Core Spider-Man (and Captain Marvel with `players: 2`) against Rhino, with the Cops set added to the encounter deck. */
function newGame(players = 1): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["cops"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  let s = withForm(settled, { heroForm: 0 });
  if (players > 1) s = withForm(s, { heroForm: 0 }, P2);
  return s;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

describe("registry", () => {
  it("registers every printed ref of the four cards; nothing is skipped", () => {
    const printed = [COP, CROOKED, WANTED, CORDON].flatMap((c) => abilityRefIds(data(c))).sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

/** The encounter pile (deck or discard) the card `id` sits in, as `"deck"`, `"discard"` or `"elsewhere"`. */
const pileOf = (s: GameState, id: InstanceId): string => {
  const piles = activeEncounterDeck(s);
  return piles.deck.includes(id) ? "deck" : piles.discard.includes(id) ? "discard" : "elsewhere";
};
const engagedWith = (s: GameState, id: InstanceId) => inst(s, id).engagedWith;
const playAreaCodes = (s: GameState, p: PlayerId): string[] => playerOf(s, p).playArea.map((i) => codeOf(s, i));
const attacks = (events: readonly GameEvent[]) => ofType(events, "enemyAttackedEnemy");
const has = (s: GameState, id: string, name: "guard" | "patrol") => hasKeyword(s, id as InstanceId, name, WAVE11_DEPS);

describe("Cop 60182", () => {
  it("60182.cop-forced-interrupt: when Cop would scheme, it attacks the villain instead (2 damage, no scheme)", () => {
    const s = engageMinion(newGame(), COP, "cop");
    const alter = withForm(s, "alterEgo");
    const run = driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(alter, ADVANCE, WANTED), declines, endTurn(P1));
    const hits = attacks(run.events).filter((e) => (e.attackerInstanceId as string) === "cop");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.targetInstanceId).toBe(villainOf(s));
    expect(damageOf(run.state, villainOf(s))).toBe(2);
    // The Cop's own scheme never resolved: only the step's placement (1) and Rhino's scheme (1) added threat.
    expect(ofType(run.events, "schemeResolved").map((e) => e.enemyInstanceId as string)).not.toContain("cop");
    expect(threatOf(run.state)).toBe(threatOf(s) + 2);
    expect(heroDamage(run.state)).toBe(0);
  });

  it("60182.cop-forced-interrupt: does nothing while it attacks (hero form: it attacks you, not the villain)", () => {
    const s = engageMinion(newGame(), COP, "cop");
    const run = driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(s, ADVANCE, WANTED), declines, endTurn(P1));
    expect(attacks(run.events)).toHaveLength(0);
    expect(damageOf(run.state, villainOf(s))).toBe(0);
    // Rhino (2) and the Cop (2) both hit the hero.
    expect(heroDamage(run.state)).toBe(4);
  });

  it("60182.when-defeated: places 2 threat on the main scheme", () => {
    const s = engageMinion(newGame(), COP, "cop");
    const after = defeatWithAttack(WAVE11_DEPS, s, "cop" as InstanceId);
    expect(encounterDiscard(after)).toContain(COP);
    expect(threatOf(after)).toBe(threatOf(s) + 2);
  });
});

describe("Crooked Cop 60183", () => {
  it("60183.when-defeated: the defeating player (P2, not the engaged P1) is dealt 1 facedown encounter card", () => {
    const s = engageMinion(newGame(2), CROOKED, "crook");
    const top = activeEncounterDeck(s).deck[0]!;
    const p2Turn = driveEventsPicking(WAVE11_DEPS, s, declines, endTurn(P1)).state;
    expect(p2Turn.step.phase).toBe("player");
    const after = defeatWithAttack(WAVE11_DEPS, p2Turn, "crook" as InstanceId, P2);
    expect(encounterDiscard(after)).toContain(CROOKED);
    expect(playerOf(after, P2).dealtEncounter).toEqual([top]);
    expect(playerOf(after, P1).dealtEncounter).toEqual([]);
    expect(inst(after, top).faceup).toBe(false);
  });

  it("60183.when-defeated: the engaged player who defeats it deals themselves the card", () => {
    const s = engageMinion(newGame(2), CROOKED, "crook");
    const after = defeatWithAttack(WAVE11_DEPS, s, "crook" as InstanceId, P1);
    expect(playerOf(after, P1).dealtEncounter).toHaveLength(1);
    expect(playerOf(after, P2).dealtEncounter).toEqual([]);
  });

  it("60183.boost: 2 indirect damage to the player the boosted attack is against, not the other player", () => {
    const s = newGame(2);
    const atk = characterProfile(s, villainOf(s), WAVE11_DEPS)!.atk;
    // Rhino's boost cards in order: Crooked Cop for P1's attack, a blank for P2's; then the two dealt cards.
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(s, CROOKED, ADVANCE, WANTED, CORDON),
      declines,
      endTurn(P1),
      endTurn(P2),
    );
    expect(encounterDiscard(run.state)).toContain(CROOKED);
    expect(heroDamage(run.state, P1)).toBe(atk + 2);
    const crooked = idsOf(run.state, CROOKED)[0]!;
    const indirect = ofType(run.events, "damageDealt").filter((e) => e.sourceInstanceId === crooked);
    expect(indirect.map((e) => [e.targetInstanceId, e.amount])).toEqual([[identityOf(run.state, P1), 2]]);
  });
});

describe("Wanted 60184", () => {
  /** Wanted put into `player`'s play area as a revealed obligation (ownerless, like any encounter card). */
  function wantedFor(state: GameState, player: PlayerId): { state: GameState; id: InstanceId } {
    const id = idsOf(state, WANTED)[0]!;
    const piles = activeEncounterDeck(state);
    const key = Object.keys(state.encounterDecks).find((k) => state.encounterDecks[k]!.deck.includes(id))!;
    const placed: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [key]: { deck: piles.deck.filter((i) => i !== id), discard: piles.discard },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    };
    return {
      id,
      state: patchInstance(placed, id, { home: { kind: "playArea", playerId: player }, faceup: true } as never),
    };
  }
  /** Assault (01187) retyped as Whiplash (a non-Police minion) and stacked second: the search must skip over it. */
  function rigged(state: GameState): GameState {
    const decoy = activeEncounterDeck(state).deck.find((i) => codeOf(state, i) === ASSAULT)!;
    return stackEncounterDeck(patchInstance(state, decoy, { cardId: cardId(WHIPLASH) }), ADVANCE, WHIPLASH, COP);
  }

  it("60184.obligation: discards cards until a Police minion, which enters play engaged with you; Wanted is discarded", () => {
    const w = wantedFor(rigged(newGame()), P1);
    const cop = activeEncounterDeck(w.state).deck[2]!;
    expect(codeOf(w.state, cop)).toBe(COP);
    const whip = idsOf(w.state, WHIPLASH)[0]!;
    const run = driveEventsPicking(WAVE11_DEPS, w.state, declines, use(P1, w.id, "60184.obligation"));
    expect(playerOf(run.state, P1).playArea).toContain(cop);
    expect(engagedWith(run.state, cop)).toBe(P1);
    // The skipped cards are discarded; the non-Police minion is not put into play.
    expect(pileOf(run.state, whip)).toBe("discard");
    expect(encounterDiscard(run.state)).toEqual(expect.arrayContaining([ADVANCE, WHIPLASH, WANTED]));
    expect(playAreaCodes(run.state, P1)).not.toContain(WANTED);
    expect(playAreaCodes(run.state, P1)).not.toContain(WHIPLASH);
  });

  it("60184.obligation: in a two-player game it engages the player who used it", () => {
    const w = wantedFor(rigged(newGame(2)), P2);
    const cop = activeEncounterDeck(w.state).deck[2]!;
    expect(codeOf(w.state, cop)).toBe(COP);
    const run = driveEventsPicking(WAVE11_DEPS, w.state, declines, use(P2, w.id, "60184.obligation"));
    expect(engagedWith(run.state, cop)).toBe(P2);
    expect(playerOf(run.state, P2).playArea).toContain(cop);
    expect(playerOf(run.state, P1).playArea).not.toContain(cop);
    expect(encounterDiscard(run.state)).toContain(WANTED);
  });
});

describe("Police Cordon 60185", () => {
  it("is Hinder 1 per hero with 3 fixed threat (data)", () => {
    expect(data(CORDON).keywords).toContainEqual({ name: "hinder", value: 0, perPlayer: 1 });
    expect(data(CORDON).startingThreat).toEqual({ base: 3, perPlayer: 0 });
  });

  it("60185.police-cordon-constant: each Police minion has guard and patrol while it is in play, and no other minion", () => {
    const base = engageMinion(engageMinion(newGame(), COP, "cop"), WHIPLASH, "other");
    expect(has(base, "cop", "guard")).toBe(false);
    expect(has(base, "cop", "patrol")).toBe(false);
    const placed = encounterCardInVillainArea(base, CORDON, 1);
    expect(has(placed.state, "cop", "guard")).toBe(true);
    expect(has(placed.state, "cop", "patrol")).toBe(true);
    expect(has(placed.state, "other", "guard")).toBe(false);
    expect(has(placed.state, "other", "patrol")).toBe(false);
    // A Police minion that arrives later has them too, and they go when the scheme is gone.
    expect(has(engageMinion(placed.state, CROOKED, "late"), "late", "guard")).toBe(true);
    const gone = driveEventsPicking(WAVE11_DEPS, placed.state, declines, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(placed.state, P1),
      schemeInstanceId: placed.id,
    } as never);
    expect(encounterDiscard(gone.state)).toContain(CORDON);
    expect(has(gone.state, "cop", "guard")).toBe(false);
    expect(has(gone.state, "cop", "patrol")).toBe(false);
  });

  it("60185.when-revealed: searches the deck and discard pile for a Police minion, reveals it and shuffles the deck", () => {
    const s = newGame();
    // Every Police minion goes to the discard pile, so only the discard-pile half of the search can find one.
    const police = [...idsOf(s, COP), ...idsOf(s, CROOKED)];
    const key = Object.keys(s.encounterDecks).find((k) => s.encounterDecks[k]!.deck.includes(police[0]!))!;
    const piles = s.encounterDecks[key]!;
    const moved: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [key]: { deck: piles.deck.filter((i) => !police.includes(i)), discard: [...piles.discard, ...police] },
      },
    };
    const run = driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(moved, ADVANCE, CORDON), declines, endTurn(P1));
    const revealed = police.filter((i) => playerOf(run.state, P1).playArea.includes(i));
    expect(revealed).toHaveLength(1);
    expect(engagedWith(run.state, revealed[0]!)).toBe(P1);
    expect(pileOf(run.state, revealed[0]!)).toBe("elsewhere");
    expect(ofType(run.events, "deckShuffled").length).toBeGreaterThan(0);
    // The scheme stays (3 threat plus Hinder 1 per hero, RRG 1.8 "Hinder", p. 22), and its own guard and patrol apply to the minion it revealed.
    expect(inst(run.state, idsOf(run.state, CORDON)[0]!).threat).toBe(4);
    expect(has(run.state, revealed[0]!, "guard")).toBe(true);
  });
});

describe("review additions", () => {
  it("60182.cop-forced-interrupt: a confused Cop that would scheme only removes confused and does not attack", () => {
    // Follows the engine's status-first order (confused is spent before the activation reaches its scheme interrupt),
    // as wave 10's confused Ares/Hercules.
    const s = engageMinion(newGame(), COP, "cop");
    const confused = patchInstance(s, "cop" as InstanceId, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(withForm(confused, "alterEgo"), ADVANCE, WANTED),
      declines,
      endTurn(P1),
    );
    expect(inst(run.state, "cop" as InstanceId).statuses.confused).toBe(0);
    expect(attacks(run.events)).toHaveLength(0);
    expect(damageOf(run.state, villainOf(s))).toBe(0);
  });

  it("60183.boost: on a scheme against alter-ego P2 the indirect damage goes to P2", () => {
    const s = withForm(newGame(2), "alterEgo", P2);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(s, ADVANCE, CROOKED, WANTED, CORDON),
      declines,
      endTurn(P1),
      endTurn(P2),
    );
    const crooked = idsOf(run.state, CROOKED)[0]!;
    const hits = ofType(run.events, "damageDealt").filter((e) => e.sourceInstanceId === crooked);
    expect(hits.map((e) => [e.targetInstanceId, e.amount])).toEqual([[identityOf(run.state, P2), 2]]);
  });

  it("60185.when-revealed: with no Police minion anywhere it ends cleanly and the scheme stays", () => {
    const s = newGame();
    const police = [...idsOf(s, COP), ...idsOf(s, CROOKED)];
    const key = Object.keys(s.encounterDecks).find((k) => s.encounterDecks[k]!.deck.includes(police[0]!))!;
    const piles = s.encounterDecks[key]!;
    const none: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [key]: { deck: piles.deck.filter((i) => !police.includes(i)), discard: piles.discard },
      },
    };
    const run = driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(none, ADVANCE, CORDON), declines, endTurn(P1));
    expect(run.state.pendingChoice).toBeFalsy();
    expect(run.state.villainArea).toContain(idsOf(run.state, CORDON)[0]!);
    expect(police.some((i) => playerOf(run.state, P1).playArea.includes(i))).toBe(false);
  });

  describe("Wanted revealed for real", () => {
    // Two alter-ego players; P1 is dealt Wanted (after one blank boost per scheme activation), P2 something else.
    function revealed() {
      const s = withForm(withForm(newGame(2), "alterEgo"), "alterEgo", P2);
      const run = driveEventsPicking(
        WAVE11_DEPS,
        stackEncounterDeck(s, ADVANCE, ASSAULT, WANTED),
        declines,
        endTurn(P1),
        endTurn(P2),
      );
      return { state: run.state, id: idsOf(run.state, WANTED)[0]! };
    }
    it("60184.obligation: lands in the revealing player's play area; only that player can use it; Quickstrike hits the hero-form user", () => {
      const { state, id } = revealed();
      expect(playerOf(state, P1).playArea).toContain(id);
      expect(() =>
        driveEventsPicking(
          WAVE11_DEPS,
          withForm(state, { heroForm: 0 }, P2),
          declines,
          use(P2, id, "60184.obligation"),
        ),
      ).toThrow();
      const hero = withForm(state, { heroForm: 0 });
      const before = heroDamage(hero);
      const run = driveEventsPicking(WAVE11_DEPS, hero, declines, use(P1, id, "60184.obligation"));
      const cop = playerOf(run.state, P1).playArea.find((i) => [COP, CROOKED].includes(codeOf(run.state, i)))!;
      expect(engagedWith(run.state, cop)).toBe(P1);
      expect(heroDamage(run.state)).toBe(before + 2);
    });
  });
});
