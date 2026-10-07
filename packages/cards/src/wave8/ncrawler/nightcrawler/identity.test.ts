import { CORE_CARDS, NCRAWLER_CARDS, NCRAWLER_STARTER_DECKS } from "@mc/content";
import {
  applyCommand,
  createGame,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import {
  driveEvents,
  driveEventsPicking,
  encounterCardInVillainArea,
  moveToDiscard,
  withDamage,
  withForm,
} from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { NIGHTCRAWLER_IDENTITY } from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nightcrawler / Kurt Wagner (48001a/b), docs/phase7-wave8.md §7.4, §3.72. His real Protection precon
 * (`nightcrawler-protection`) against Rhino (Core; standard, no modular set), built through `coreScenario` with the
 * Nightcrawler cards added to the pool. The engine gets this module's registry on top of every earlier wave, not the
 * whole wave 8 registry, so the file tests only what this module scripts. Nightcrawler: THW 2, ATK 1, DEF 3, 9 hit
 * points, hand size 5; Kurt Wagner: REC 3, hand size 6. Bamf! (48006) is staged by printed id and is not scripted here
 * (the supports module's): these tests read where a copy is, never what it does.
 */
const RAPID = "48001a.rapid-teleportation";
const ACTION = "48001b.kurt-wagner-action";
const BAMF = "48006";
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, NIGHTCRAWLER_IDENTITY) };

const PRECON = NCRAWLER_STARTER_DECKS.find((d) => d.id === "nightcrawler-protection")!;
const NIGHTCRAWLER = {
  identityCardId: PRECON.identityCardId,
  aspects: PRECON.aspects,
  deck: PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" };
type Seat = typeof NIGHTCRAWLER | typeof SPIDER_MAN;

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const count = (codes: readonly string[], code: string): number => codes.filter((c) => c === code).length;

function setupGame(players: readonly Seat[] = [NIGHTCRAWLER], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...NCRAWLER_CARDS],
  });
  const created = createGame(
    {
      ...config,
      players: players.map((seat) =>
        "starterDeckId" in seat
          ? { ...coreScenario("rhino", { players: [seat], seed, modularSetIds: [] }).players[0]! }
          : {
              identityCardId: seat.identityCardId,
              aspects: seat.aspects,
              deck: seat.deck,
            },
      ),
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Alter-ego form, as setup leaves it. */
const kurtGame = (players?: readonly Seat[], seed = 1): GameState => setupGame(players, seed);
/** Hero form with the round's one change still unused. */
const heroGame = (players?: readonly Seat[], seed = 1): GameState =>
  withForm(setupGame(players, seed), { heroForm: 0 });
/** The Nightcrawler player of a two-player game staged as seat 2. */
const SEATS_2P: readonly Seat[] = [SPIDER_MAN, NIGHTCRAWLER];

/** Moves one copy of a card from hand or deck to the discard pile, `n` times. */
const intoDiscard = (s: GameState, code: string, n = 1, p: PlayerId = P1): GameState =>
  Array.from({ length: n }).reduce<GameState>((acc) => moveToDiscard(acc, p, code).state, s);
/** Every copy of Bamf! out of the hand and deck, into the discard pile. */
const bamfsOutOfDeck = (s: GameState, p: PlayerId = P1): GameState =>
  intoDiscard(s, BAMF, count(deckCodes(s, p), BAMF) + count(handCodes(s, p), BAMF), p);

/** The action by the owner of the identity, paying 1 card from hand (any card that is not Bamf!, so it is no copy). */
function teleport(s: GameState, p: PlayerId = P1): Command {
  const pay = playerOf(s, p).hand.find((id) => codeOf(s, id) !== BAMF)!;
  return use(p, identityOf(s, p), RAPID, [{ fromHand: pay }]);
}
const kurt = (s: GameState, p: PlayerId = P1): Command => use(p, identityOf(s, p), ACTION);
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;

describe("Nightcrawler identity registry", () => {
  it.each([RAPID, ACTION])("%s validates", (id) => {
    expect(validateDefinition(NIGHTCRAWLER_IDENTITY[id]!)).toEqual([]);
  });
  it("holds exactly the two identity refs", () => {
    expect(Object.keys(NIGHTCRAWLER_IDENTITY).sort()).toEqual([RAPID, ACTION].sort());
  });
});

describe("printed stats, read from the game", () => {
  it("starts as Kurt Wagner: 9 hit points, hand of 6, a 34-card deck holding all 3 copies of Bamf!", () => {
    const s = kurtGame();
    expect(playerOf(s, P1).identity.form).toBe("alterEgo");
    expect(maxHitPoints(s, identityOf(s), DEPS)).toBe(9);
    expect(playerOf(s, P1).hand).toHaveLength(6);
    expect(playerOf(s, P1).deck).toHaveLength(34);
    expect(count(handCodes(s), BAMF) + count(deckCodes(s), BAMF)).toBe(3);
  });
  it("Kurt Wagner REC 3: a basic recovery from 5 damage leaves 2", () => {
    const base = withDamage(kurtGame(), identityOf(kurtGame()), 5);
    const { state } = driveEvents(DEPS, base, { type: "basicRecover", playerId: P1 });
    expect(inst(state, identityOf(state)).damage).toBe(2);
  });
  it("Nightcrawler THW 2: a basic thwart removes 2 threat from a side scheme of 4", () => {
    const staged = encounterCardInVillainArea(heroGame(), "01107", 4);
    const { state } = driveEvents(DEPS, staged.state, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(staged.state),
      schemeInstanceId: staged.id,
    });
    expect(inst(state, staged.id).threat).toBe(2);
  });
  it("Nightcrawler ATK 1: a basic attack deals 1 damage to the villain", () => {
    const base = heroGame();
    const villain = base.activeVillainId!;
    const { state } = driveEvents(DEPS, base, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(base),
      targetInstanceId: villain,
    });
    expect(inst(state, villain).damage).toBe(1);
  });
  it("Nightcrawler DEF 3 and hand size 5: Rhino (ATK 2) with a 2-icon boost card is 4, less DEF 3 is 1 damage; the hand is 5", () => {
    // Boost card: Breakin' & Takin' (2 boost icons, no boost ability); the card dealt after it: Crowd Control.
    const base = stackEncounterDeck(heroGame(), "01107", "01108");
    const defending = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind !== "declareDefender") return firstLegal(s);
      const hit = choice.options.find((o) => o.optionId === identityOf(s));
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const { state } = driveEventsPicking(DEPS, base, defending, endTurn());
    expect(inst(state, identityOf(state)).damage).toBe(1);
    expect(playerOf(state, P1).hand).toHaveLength(5);
  });
});

describe("Nightcrawler (48001a): Rapid Teleportation", () => {
  it("pays 1 resource from hand and returns a copy of Bamf! from the discard pile to the hand", () => {
    const base = intoDiscard(heroGame(), BAMF);
    const handBefore = playerOf(base, P1).hand.length;
    expect(discardCodes(base)).toEqual([BAMF]);
    const paid = playerOf(base, P1).hand.find((id) => codeOf(base, id) !== BAMF)!;
    const { state } = driveEvents(DEPS, base, teleport(base));
    // The paid card went to the discard pile; the copy came to the hand: net hand 6 -> 6, discard [paid card].
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
    expect(playerOf(state, P1).hand).not.toContain(paid);
    expect(playerOf(state, P1).discard).toEqual([paid]);
    expect(count(handCodes(state), BAMF)).toBe(count(handCodes(base), BAMF) + 1);
    expect(state.instances[playerOf(state, P1).hand.find((id) => !playerOf(base, P1).hand.includes(id))!]!.cardId).toBe(
      BAMF,
    );
  });
  it("moves exactly one copy when two are in the discard pile", () => {
    const base = intoDiscard(heroGame(), BAMF, 2);
    const { state } = driveEvents(DEPS, base, teleport(base));
    expect(count(discardCodes(state), BAMF)).toBe(1);
    expect(count(handCodes(state), BAMF)).toBe(count(handCodes(base), BAMF) + 1);
  });
  it("is limited to once per phase: a second use in the same player phase is refused", () => {
    const base = intoDiscard(heroGame(), BAMF, 2);
    const once = driveEvents(DEPS, base, teleport(base)).state;
    expect(count(discardCodes(once), BAMF)).toBe(1);
    expect(accepted(once, teleport(once))).toBe(false);
  });
  it("is offered again in the next player phase", () => {
    const base = intoDiscard(heroGame(), BAMF, 2);
    const once = driveEvents(DEPS, base, teleport(base)).state;
    // Round end: Rhino acts (boost 0 from the stacked card) and the next player phase begins.
    const next = settle(
      driveEvents(DEPS, stackEncounterDeck(once, "01186", "01186"), endTurn()).state,
      firstLegal,
      (s) => s.step.phase === "player",
      DEPS,
    );
    expect(next.step.phase).toBe("player");
    expect(playerOf(next, P1).identity.form).toBe("hero");
    expect(accepted(next, teleport(next))).toBe(true);
  });
  it("with no copy of Bamf! in the discard pile it is refused (a copy in hand or deck does not count)", () => {
    const base = heroGame();
    expect(count(discardCodes(base), BAMF)).toBe(0);
    expect(accepted(base, teleport(base))).toBe(false);
  });
  it("another card in the discard pile is not a copy of Bamf!", () => {
    const base = intoDiscard(heroGame(), "48007");
    expect(accepted(base, teleport(base))).toBe(false);
  });
  it("is refused without the resource: no card paid", () => {
    const base = intoDiscard(heroGame(), BAMF);
    expect(accepted(base, use(P1, identityOf(base), RAPID))).toBe(false);
  });
  it("is the hero face's ability: refused as Kurt Wagner", () => {
    const base = intoDiscard(kurtGame(), BAMF);
    expect(accepted(base, teleport(base))).toBe(false);
  });
  it("two players, Nightcrawler is player 2: only his discard pile and hand change", () => {
    const base = intoDiscard(withForm(setupGame(SEATS_2P), { heroForm: 0 }, P2), BAMF, 1, P2);
    const other = { hand: handCodes(base, P1), deck: deckCodes(base, P1), discard: discardCodes(base, P1) };
    const { state } = driveEvents(DEPS, base, teleport(base, P2));
    expect(count(handCodes(state, P2), BAMF)).toBe(count(handCodes(base, P2), BAMF) + 1);
    expect(discardCodes(state, P2)).toHaveLength(1);
    expect({ hand: handCodes(state, P1), deck: deckCodes(state, P1), discard: discardCodes(state, P1) }).toEqual(other);
  });
});

describe("Kurt Wagner (48001b): Action, search for Bamf!", () => {
  it("adds a copy of Bamf! from the deck to the hand and shuffles the deck", () => {
    const base = kurtGame();
    const hand = count(handCodes(base), BAMF);
    const deck = count(deckCodes(base), BAMF);
    const { state, events } = driveEvents(DEPS, base, kurt(base));
    expect(playerOf(state, P1).hand).toHaveLength(7);
    expect(playerOf(state, P1).deck).toHaveLength(33);
    expect(count(handCodes(state), BAMF)).toBe(hand + 1);
    expect(count(deckCodes(state), BAMF)).toBe(deck - 1);
    expect(events.some((e: GameEvent) => e.type === "deckShuffled")).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("is limited to once per round: a second use is refused", () => {
    const once = driveEvents(DEPS, kurtGame(), kurt(kurtGame())).state;
    expect(accepted(once, kurt(once))).toBe(false);
  });
  it("is offered again the next round", () => {
    const once = driveEvents(DEPS, kurtGame(), kurt(kurtGame())).state;
    const next = settle(
      driveEvents(DEPS, stackEncounterDeck(once, "01186", "01186"), endTurn()).state,
      firstLegal,
      (s) => s.step.phase === "player",
      DEPS,
    );
    expect(next.step.phase).toBe("player");
    expect(playerOf(next, P1).identity.form).toBe("alterEgo");
    expect(accepted(next, kurt(next))).toBe(true);
  });
  it("with every copy out of the deck nothing is added, the deck is still shuffled, and the round's use is spent", () => {
    const base = bamfsOutOfDeck(kurtGame());
    expect(count(deckCodes(base), BAMF)).toBe(0);
    const handBefore = playerOf(base, P1).hand.length;
    const deckBefore = playerOf(base, P1).deck.length;
    const { state, events } = driveEvents(DEPS, base, kurt(base));
    expect(playerOf(state, P1).hand).toHaveLength(handBefore);
    expect(playerOf(state, P1).deck).toHaveLength(deckBefore);
    expect(events.some((e: GameEvent) => e.type === "deckShuffled")).toBe(true);
    expect(accepted(state, kurt(state))).toBe(false);
  });
  it("searches the deck only: a copy in the discard pile is not added", () => {
    const base = bamfsOutOfDeck(kurtGame());
    expect(count(discardCodes(base), BAMF)).toBe(3);
    const { state } = driveEvents(DEPS, base, kurt(base));
    expect(count(handCodes(state), BAMF)).toBe(0);
    expect(count(discardCodes(state), BAMF)).toBe(3);
  });
  it("is the alter-ego face's ability: refused as Nightcrawler", () => {
    const base = heroGame();
    expect(accepted(base, kurt(base))).toBe(false);
  });
  it("two players, Kurt is player 2: only his deck and hand change", () => {
    const base = setupGame(SEATS_2P);
    const other = { hand: handCodes(base, P1), deck: deckCodes(base, P1), discard: discardCodes(base, P1) };
    const { state } = driveEvents(DEPS, base, kurt(base, P2));
    expect(playerOf(state, P2).hand).toHaveLength(7);
    expect(playerOf(state, P2).deck).toHaveLength(33);
    expect({ hand: handCodes(state, P1), deck: deckCodes(state, P1), discard: discardCodes(state, P1) }).toEqual(other);
  });
  it("finds a copy by printed name: the precon holds 3 copies of Bamf! (48006) in all", () => {
    expect(instancesOf(kurtGame(), BAMF)).toHaveLength(3);
  });
});
