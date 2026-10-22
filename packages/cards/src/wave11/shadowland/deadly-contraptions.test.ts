import { activeEncounterDeckId, cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { CAPTAIN_MARVEL, SPIDER_MAN, codeOf, heroForm, types } from "../../wave9/testing.js";
import { SHADOWLAND_DEADLY_CONTRAPTIONS, SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED } from "./deadly-contraptions.js";
import {
  BLINDING,
  CALTROPS,
  FILLER,
  HALL,
  PATH,
  TRAP_DEPS,
  choosingOption,
  encounterPiles,
  endTurnAnswering,
  stackTraps,
  trapGame,
  withHandOnly,
} from "./trap-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadly Contraptions (MC65 pp. 12-13): the TRAP! treacheries Blinding Powder (65050) and Caltrops (65051), and the
 * boosts of Hall of Punishment (65048) and Path of a Thousand Cuts (65049). The pack is gated and the Shadow Labyrinth
 * scenario record does not exist yet, so the trap deck is declared by hand (`trapGame`): Shifting Corridors' own
 * interrupt reveals the top trap card at the end of the first player's turn, which is how a trap reaches a player here.
 * The cards that name a trap's option (65046-65049) are tested at the end.
 */
const THWART_EVENT = "01060"; // For Justice!: a THWART event
const DEFENSE_EVENT = "01003"; // Backflip: a DEFENSE event, and Spider-Man's own (identity-specific) card
const ALLY = "01059"; // Jessica Jones: a Core ally, cost 3, 3 hit points
const OTHER = "01004"; // Enhanced Spider-Sense: neither a Thwart nor a Defense event, but identity-specific

/** The cards discarded from hand during the run (the end-of-round refill reshuffles an emptied deck, so read the log). */
const discarded = (state: GameState, events: readonly GameEvent[]): string[] =>
  types(events, "cardDiscardedFromHand").map((e) => codeOf(state, e.instanceId));
const damage = (s: GameState) => inst(s, identityOf(s)).damage;
const statuses = (s: GameState) => inst(s, identityOf(s)).statuses;

/**
 * A Corridors game whose trap deck top is `trap` and P1's hand exactly `hand` (hero form); the first player's turn ends
 * and Corridors' interrupt reveals the trap for them, `pick` choosing among Avoid, Disarm and Trip. `offered` is the
 * option labels of that prompt (null when none was asked).
 */
function reveal(trap: string, hand: readonly string[], pick: Picker) {
  let state = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
  state = heroForm(stackTraps(withHandOnly(state, P1, ...hand), trap), P1);
  let offered: string[] | null = null;
  const recording: Picker = (s) => {
    if (s.pendingChoice!.prompt.kind === "chooseOption" && offered === null)
      offered = s.pendingChoice!.options.map((o) => o.label.split(":")[0]!);
    return pick(s);
  };
  const run = endTurnAnswering(state, recording);
  return { before: state, ...run, offered: offered as string[] | null, discarded: discarded(run.state, run.events) };
}

describe("Blinding Powder (65050): Avoid, Disarm or Trip", () => {
  it("Avoid discards a Thwart event from the hand and nothing else", () => {
    const r = reveal(BLINDING, [THWART_EVENT, OTHER], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([THWART_EVENT]);
    expect(damage(r.state)).toBe(damage(r.before));
    expect(statuses(r.state).confused).toBe(0);
    expect(statuses(r.state).tough).toBe(0);
  });

  it("Avoid is not offered when the hand holds no Thwart event (a Defense event is not one)", () => {
    const r = reveal(BLINDING, [DEFENSE_EVENT, OTHER], choosingOption("Trip"));
    expect(r.offered).toEqual(["Disarm", "Trip"]);
  });

  it("Disarm discards 2 cards at random, then gives a character you control a tough status card", () => {
    const hand = [OTHER, DEFENSE_EVENT, THWART_EVENT];
    const r = reveal(BLINDING, hand, choosingOption("Disarm"));
    expect(r.discarded).toHaveLength(2);
    expect(new Set(r.discarded).size).toBe(2);
    for (const code of r.discarded) expect(hand).toContain(code);
    expect(statuses(r.state).tough).toBe(1);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  // Owner decision 2026-10-20 (A), reversing Q8: RRG 1.8 "Choose (Option)" (p. 12) bars an option only for want of a
  // target (a card in hand to discard counts, p. 42); a hand of one card is a target, so Disarm is offered.
  it("Disarm with fewer than 2 cards in hand discards what it can and skips its 'then' (no tough status card)", () => {
    const r = reveal(BLINDING, [OTHER], choosingOption("Disarm"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"].filter((l) => l !== "Avoid"));
    expect(r.discarded).toEqual([OTHER]);
    expect(statuses(r.state).tough).toBe(0);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  // RRG 1.8 "Choose (Option)" (p. 12): the discard is a part of its own, so a missing target for the "then" part does not
  // bar Disarm.
  it("Disarm is still offered when the identity already holds a tough status card: the discard resolves, no second card is given", () => {
    const base = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
    const state = patchInstance(
      heroForm(stackTraps(withHandOnly(base, P1, OTHER, DEFENSE_EVENT, THWART_EVENT), BLINDING), P1),
      identityOf(base),
      { statuses: { stunned: 0, confused: 0, tough: 1 } },
    );
    let offered: string[] | null = null;
    const run = endTurnAnswering(state, (s) => {
      if (s.pendingChoice!.prompt.kind === "chooseOption" && offered === null)
        offered = s.pendingChoice!.options.map((o) => o.label.split(":")[0]!);
      return choosingOption("Disarm")(s);
    });
    expect(offered).toContain("Disarm");
    expect(discarded(run.state, run.events)).toHaveLength(2);
    expect(statuses(run.state).tough).toBe(1);
  });

  it("Trip deals 2 damage to the identity and confuses it", () => {
    const r = reveal(BLINDING, [], choosingOption("Trip"));
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    expect(statuses(r.state).confused).toBe(1);
    expect(statuses(r.state).tough).toBe(0);
  });

  it("Trip is choosable while the identity is already confused: it still deals its 2 damage (the identity is a valid target of the damage)", () => {
    let state = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), BLINDING), P1);
    const id = identityOf(state);
    state = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...inst(state, id), statuses: { ...inst(state, id).statuses, confused: 1 } },
      },
    };
    const run = endTurnAnswering(state, choosingOption("Trip"));
    expect(damage(run.state)).toBe(damage(state) + 2);
    expect(statuses(run.state).confused).toBe(1);
  });

  it("is a TRAP! card: it is discarded to the trap discard pile", () => {
    const r = reveal(BLINDING, [], choosingOption("Trip"));
    expect(r.state.scenarioDecks["trap"]!.discard.map((id) => codeOf(r.state, id))).toContain(BLINDING);
  });
});

describe("Caltrops (65051): Avoid, Disarm or Trip", () => {
  it("Avoid discards a Defense event from the hand (a Thwart event is not one)", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT, THWART_EVENT], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
    const none = reveal(CALTROPS, [THWART_EVENT, THWART_EVENT], choosingOption("Trip"));
    expect(none.offered).toBeNull();
    expect(none.discarded).toEqual([]);
    expect(damage(none.state)).toBe(damage(none.before) + 2);
  });

  it("Disarm discards an identity-specific card, then deals 2 damage to an enemy", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT, THWART_EVENT], choosingOption("Disarm"));
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
    // The only enemy in play is the villain.
    const villain = r.before.villains[0]!.instanceId;
    expect(inst(r.state, villain).damage).toBe(inst(r.before, villain).damage + 2);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  it("Disarm is not offered with no identity-specific card in hand", () => {
    // For Justice! is a Justice aspect card, not identity-specific.
    const r = reveal(CALTROPS, [THWART_EVENT], choosingOption("Trip"));
    expect(r.offered).toBeNull();
    expect(damage(r.state)).toBe(damage(r.before) + 2);
  });

  it("Disarm is offered with an identity-specific card in hand (the card is the only requirement)", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT], choosingOption("Disarm"));
    expect(r.offered).toContain("Disarm");
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
  });

  it("Trip deals 2 damage to the identity and stuns it", () => {
    const r = reveal(CALTROPS, [], choosingOption("Trip"));
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    expect(statuses(r.state).stunned).toBe(1);
    expect(statuses(r.state).confused).toBe(0);
  });
});

describe("an encounter card's unnamed choices belong to the first player (RRG 1.8 'First Player', p. 19)", () => {
  it("Blinding Powder revealed for the second player: the first player picks which of their characters gets the tough card", () => {
    let state = trapGame({
      seats: [SPIDER_MAN, CAPTAIN_MARVEL],
      passage: 5,
      trapCards: [BLINDING, BLINDING, CALTROPS],
      encounter: [FILLER, FILLER, FILLER],
    });
    state = heroForm(withHandOnly(state, P1), P1, P2);
    // P1 ends their turn; P2 then puts an ally into play, so P2 controls two characters that can take a tough card.
    state = endTurnAnswering(state, firstLegal, P1).state;
    const played = playFromHand(TRAP_DEPS, state, "01083", 3, firstLegal, P2);
    state = stackTraps(played.state, BLINDING, BLINDING);
    const asked: { player: string; labels: string[] }[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget")
        asked.push({ player: choice.playerId, labels: choice.options.map((o) => o.label) });
      const disarm = choice.prompt.kind === "chooseOption" && choice.options.find((o) => o.label.startsWith("Disarm"));
      if (disarm) return [disarm.optionId];
      if (choice.prompt.kind === "chooseTarget")
        return [choice.options.find((o) => o.label === "Mockingbird")!.optionId];
      return firstLegal(s);
    };
    const run = endTurnAnswering(state, pick, P2);
    // Two characters of P2's (the identity and the ally) to choose from, chosen by P1.
    expect(asked).toEqual([{ player: P1, labels: expect.arrayContaining(["Mockingbird"]) }]);
    expect(asked[0]!.labels).toHaveLength(2);
    expect(run.state.instances[played.id]!.statuses.tough).toBe(1);
    expect(statuses(run.state).tough).toBe(0);
  });
});

describe("Hall of Punishment (65048) and Path of a Thousand Cuts (65049) boosts", () => {
  /** Rhino's activation against P1 with `code` on top as its boost card; optionally with an ally in play. */
  const boostRun = (code: string, ally: boolean) => {
    let state = trapGame({ villain: "rhino", encounter: [code, FILLER, FILLER] });
    let may: InstanceId | undefined;
    if (ally) {
      const played = playFromHand(TRAP_DEPS, state, ALLY, 3);
      state = played.state;
      may = played.id;
      expect(cardsInPlay(state)).toContain(may);
    }
    state = heroForm(stackEncounterDeck(state, code, FILLER), P1);
    return { before: state, may, ...endTurnAnswering(state, firstLegal) };
  };
  const boostCard = (r: ReturnType<typeof boostRun>) =>
    types(r.events, "boostCardFlipped").find(
      (e) => codeOf(r.state, e.instanceId) === HALL || codeOf(r.state, e.instanceId) === PATH,
    )!.instanceId;

  it("Hall: 1 threat on the main scheme for each character you control", () => {
    const placed = (r: ReturnType<typeof boostRun>) =>
      types(r.events, "threatPlaced")
        .filter((e) => e.sourceInstanceId === boostCard(r))
        .map((e) => e.amount);
    expect(placed(boostRun(HALL, false))).toEqual([1]);
    expect(placed(boostRun(HALL, true))).toEqual([2]);
  });

  it("Path: 1 damage to each character you control", () => {
    const dealt = (r: ReturnType<typeof boostRun>, target: InstanceId) =>
      types(r.events, "damageDealt").filter(
        (e) => e.targetInstanceId === target && e.sourceInstanceId === boostCard(r),
      );
    const solo = boostRun(PATH, false);
    expect(dealt(solo, identityOf(solo.state)).map((e) => e.amount)).toEqual([1]);
    const withAlly = boostRun(PATH, true);
    expect(dealt(withAlly, identityOf(withAlly.state)).map((e) => e.amount)).toEqual([1]);
    expect(dealt(withAlly, withAlly.may!).map((e) => e.amount)).toEqual([1]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The five later traps: Flame Spout (65052), Oil Slick (65053), Poison Darts (65054), Pressure Plate (65055), Tripwire
// (65056). Each is revealed by Shifting Corridors' interrupt. Their option labels are written like 65050 / 65051's, so
// Path of a Thousand Cuts (65049) reads them the same way.
// ---------------------------------------------------------------------------------------------------------------
const FLAME = "65052";
const OIL = "65053";
const DARTS = "65054";
const PLATE = "65055";
const TRIPWIRE = "65056";
const ATTACK_EVENT = "01087"; // Haymaker: a basic ATTACK event
const UPGRADE = "01008"; // Web-Shooter, cost 1
const SUPPORT = "01063"; // Interrogation Room, cost 1
const ENERGY = "01088"; // Energy: generates 2 [energy]
const GENIUS = "01089"; // Genius: generates 2 [mental]
const STRENGTH = "01090"; // Strength: generates 2 [physical]
const MINION = "01101"; // Hydra Mercenary
const SIDE_SCHEME = "01107"; // Breakin' & Takin'

const handOf = (s: GameState) => s.players.find((p) => p.playerId === P1)!.hand;
const deckOf = (s: GameState) => s.players.find((p) => p.playerId === P1)!.deck;
const discardOf = (s: GameState) => s.players.find((p) => p.playerId === P1)!.discard;

/** `deck` with the first copies of `codes` moved to its top, in order. */
const stackedDeck = (state: GameState, deck: readonly InstanceId[], codes: readonly string[]): InstanceId[] => {
  const top = codes.map((code) => deck.find((id) => codeOf(state, id) === code)!);
  return [...top, ...deck.filter((id) => !top.includes(id))];
};

/**
 * Like `reveal`, for the later traps. P1's hand is exactly `hand` and their deck is emptied (so the end-of-turn refill,
 * which comes before the trap is revealed, adds nothing), or with `keepDeck` their deck is left to be milled and the
 * hand is whatever the refill drew. `inPlay` (code, cost) cards are put into play first, `encounter` is stacked on the
 * encounter deck, and `mainThreat` sets the main scheme's threat. `drawn` is the number of cards the refill drew.
 */
function revealLater(
  trap: string,
  hand: readonly string[],
  pick: Picker,
  opts: {
    readonly inPlay?: readonly (readonly [string, number])[];
    readonly encounter?: readonly string[];
    readonly mainThreat?: number;
    readonly keepDeck?: boolean;
    /** With `keepDeck`: these cards are put on top of the deck, so the refill draws them into the hand. */
    readonly deckTop?: readonly string[];
    /** Without `keepDeck`: the hand is exactly `hand` and the rest of the deck stays behind it (a full hand draws none). */
    readonly deckBehind?: boolean;
    /** Encounter cards added to the encounter deck under `encounter`, for `stage` to take out. */
    readonly alsoInEncounterDeck?: readonly string[];
    /** Surgery on the staged game before the trap is stacked (a side scheme in play, an engaged minion). */
    readonly stage?: (state: GameState) => GameState;
  } = {},
) {
  let state = trapGame({
    trapCards: [trap, BLINDING],
    encounter: [...(opts.encounter ?? [FILLER, FILLER, FILLER]), ...(opts.alsoInEncounterDeck ?? [])],
  });
  const played: InstanceId[] = [];
  for (const [code, cost] of opts.inPlay ?? []) {
    const r = playFromHand(TRAP_DEPS, state, code, cost);
    state = r.state;
    played.push(r.id);
  }
  if (opts.mainThreat !== undefined)
    state = patchInstance(state, state.mainScheme.instanceId, { threat: opts.mainThreat });
  const deckBefore = deckOf(state);
  state = opts.keepDeck
    ? {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: [], deck: stackedDeck(state, p.deck, opts.deckTop ?? []) } : p,
        ),
      }
    : withHandOnly(state, P1, ...hand);
  if (opts.deckBehind) {
    const handIds = handOf(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: deckBefore.filter((id) => !handIds.includes(id)) } : p,
      ),
    };
  }
  if (opts.stage) state = opts.stage(state);
  state = heroForm(stackTraps(state, trap), P1);
  let offered: string[] | null = null;
  const prompts: { kind: string; options: string[] }[] = [];
  const recording: Picker = (s) => {
    if (s.pendingChoice!.prompt.kind === "chooseOption" && offered === null)
      offered = s.pendingChoice!.options.map((o) => o.label.split(":")[0]!);
    prompts.push({ kind: s.pendingChoice!.prompt.kind, options: s.pendingChoice!.options.map((o) => o.optionId) });
    return pick(s);
  };
  const run = endTurnAnswering(state, recording);
  const drawn = types(run.events, "cardDrawn").length;
  return {
    before: state,
    played,
    drawn,
    prompts,
    ...run,
    offered: offered as string[] | null,
    discarded: discarded(run.state, run.events),
  };
}
const trapDiscarded = (s: GameState, code: string) =>
  s.scenarioDecks["trap"]!.discard.map((id) => codeOf(s, id)).includes(code);

describe("Flame Spout (65052)", () => {
  it("Avoid discards an ally from the hand; it is not offered without one", () => {
    const r = revealLater(FLAME, [ALLY, OTHER], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Trip"]);
    expect(r.discarded).toEqual([ALLY]);
    expect(damage(r.state)).toBe(damage(r.before));
    const none = revealLater(FLAME, [OTHER], choosingOption("Trip"));
    expect(none.offered).toBeNull();
    expect(damage(none.state)).toBe(damage(none.before) + 3);
  });

  it("Disarm discards an ally you control, then draws 2 cards; it is not offered without an ally in play", () => {
    const withAlly = { inPlay: [[ALLY, 3]] as const, keepDeck: true };
    const r = revealLater(FLAME, [], choosingOption("Disarm"), withAlly);
    expect(r.offered).toEqual(["Disarm", "Trip"]);
    expect(cardsInPlay(r.state)).not.toContain(r.played[0]);
    expect(discardOf(r.state)).toContain(r.played[0]);
    // The same game answered with Trip draws only the end-of-turn refill.
    expect(r.drawn).toBe(revealLater(FLAME, [], choosingOption("Trip"), withAlly).drawn + 2);
    expect(revealLater(FLAME, [ALLY], choosingOption("Trip")).offered).toEqual(["Avoid", "Trip"]);
  });

  it("Trip deals 3 damage to the identity and discards the top 3 cards of the deck", () => {
    const r = revealLater(FLAME, [], choosingOption("Trip"), { keepDeck: true });
    expect(damage(r.state)).toBe(damage(r.before) + 3);
    for (const id of deckOf(r.before).slice(r.drawn, r.drawn + 3)) expect(discardOf(r.state)).toContain(id);
    expect(trapDiscarded(r.state, FLAME)).toBe(true);
  });
});

describe("Oil Slick (65053)", () => {
  it("Avoid discards an upgrade from the hand; it is not offered without one", () => {
    const r = revealLater(OIL, [UPGRADE, OTHER], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Trip"]);
    expect(r.discarded).toEqual([UPGRADE]);
    const none = revealLater(OIL, [OTHER], choosingOption("Trip"));
    expect(none.offered).toBeNull();
    expect(none.discarded).toEqual([OTHER]);
  });

  it("Disarm discards an upgrade you control, then removes 4 threat from the main scheme", () => {
    const r = revealLater(OIL, [], choosingOption("Disarm"), { inPlay: [[UPGRADE, 1]], mainThreat: 4 });
    expect(r.offered).toEqual(["Disarm", "Trip"]);
    expect(cardsInPlay(r.state)).not.toContain(r.played[0]);
    const removed = types(r.events, "threatRemoved").filter(
      (e) => e.schemeInstanceId === r.before.mainScheme.instanceId,
    );
    expect(removed.map((e) => e.amount)).toEqual([4]);
  });

  it("Trip discards 1 card from the hand and the top 8 cards of the deck", () => {
    const r = revealLater(OIL, [], choosingOption("Trip"), { keepDeck: true });
    expect(r.discarded).toHaveLength(1);
    for (const id of deckOf(r.before).slice(r.drawn, r.drawn + 8)) expect(discardOf(r.state)).toContain(id);
    expect(damage(r.state)).toBe(damage(r.before));
  });
});

describe("Poison Darts (65054)", () => {
  it("Avoid spends [energy][energy] resources", () => {
    const r = revealLater(DARTS, [ENERGY, GENIUS], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([ENERGY]);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  it("Disarm spends [mental][mental][physical] resources, then deals 3 damage to the villain", () => {
    const r = revealLater(DARTS, [GENIUS, STRENGTH], choosingOption("Disarm"));
    expect(r.discarded.sort()).toEqual([GENIUS, STRENGTH].sort());
    const villain = r.before.villains[0]!.instanceId;
    expect(inst(r.state, villain).damage).toBe(inst(r.before, villain).damage + 3);
  });

  it("Disarm unpaid (offered anyway, RRG 1.8 'Choose (Option)' p. 12) skips its 'then' part", () => {
    const r = revealLater(DARTS, [OTHER], choosingOption("Disarm"));
    expect(r.offered).toContain("Disarm");
    const villain = r.before.villains[0]!.instanceId;
    expect(inst(r.state, villain).damage).toBe(inst(r.before, villain).damage);
  });

  it("Trip deals 3 damage to the identity and exhausts it", () => {
    const r = revealLater(DARTS, [], choosingOption("Trip"));
    expect(damage(r.state)).toBe(damage(r.before) + 3);
    expect(types(r.events, "cardExhausted").map((e) => e.instanceId)).toContain(identityOf(r.state));
  });
});

describe("Pressure Plate (65055)", () => {
  it("Avoid spends [mental][mental] resources", () => {
    const r = revealLater(PLATE, [GENIUS, ENERGY], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([GENIUS]);
  });

  it("Disarm spends [energy][physical][physical] resources, then searches exactly the top 4 cards of the deck and shuffles", () => {
    const paying: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind === "spendResources")
        return choice.options.filter((o) => o.label === "Energy" || o.label === "Strength").map((o) => o.optionId);
      return choosingOption("Disarm")(st);
    };
    const r = revealLater(PLATE, [], paying, { keepDeck: true, deckTop: [ENERGY, STRENGTH] });
    expect(r.discarded.sort()).toEqual([ENERGY, STRENGTH].sort());
    // The search offers the top 4 cards of what the refill left, and no others.
    const window = deckOf(r.before).slice(r.drawn, r.drawn + 4);
    const search = r.prompts.find((p) => p.kind !== "chooseOption" && p.options.includes(window[0]!));
    expect(search?.options.slice().sort()).toEqual(window.slice().sort());
    // The picker takes the first: that card is found.
    expect(handOf(r.state)).toContain(window[0]);
    expect(p1DeckShuffles(r.events)).toHaveLength(1);
  });

  it("Disarm unpaid (offered anyway) skips its 'then' part: no search and no shuffle", () => {
    // A full hand (hand size 5, so the refill draws none) with no [physical] resource, and the deck kept behind it.
    const hand = [OTHER, THWART_EVENT, ALLY, ATTACK_EVENT, GENIUS];
    const r = revealLater(PLATE, hand, choosingOption("Disarm"), { deckBehind: true });
    expect(r.offered).toContain("Disarm");
    expect(r.drawn).toBe(0);
    expect(deckOf(r.before).length).toBeGreaterThan(4);
    expect(r.prompts.filter((p) => p.options.includes(deckOf(r.before)[0]!))).toEqual([]);
    expect(p1DeckShuffles(r.events)).toEqual([]);
    expect(r.discarded).toEqual([]);
  });

  it("Trip discards from the top of the encounter deck until a minion is discarded, then reveals it (engaged with you)", () => {
    const r = revealLater(PLATE, [], choosingOption("Trip"), { encounter: [FILLER, FILLER, MINION, FILLER] });
    expect(encounterDiscards(r.state, r.events).slice(0, 3)).toEqual([FILLER, FILLER, MINION]);
    const minion = types(r.events, "encounterCardRevealed").find((e) => codeOf(r.state, e.instanceId) === MINION)!;
    expect(minion).toBeDefined();
    expect(inst(r.state, minion.instanceId).engagedWith).toBe(P1);
    expect(cardsInPlay(r.state)).toContain(minion.instanceId);
  });

  it("Trip with no minion before the encounter deck empties is fulfilled (RRG 1.8 'Encounter Deck', p. 17): nothing is revealed", () => {
    const r = revealLater(PLATE, [], choosingOption("Trip"), { stage: (s) => encounterDeckOnly(s, FILLER, FILLER) });
    const trip = untilVillainPhase(r.events);
    expect(encounterDiscards(r.state, trip)).toEqual([FILLER, FILLER]);
    // Only the trap itself was revealed.
    expect(types(trip, "encounterCardRevealed").map((e) => codeOf(r.state, e.instanceId))).toEqual([PLATE]);
  });
});

describe("Tripwire (65056)", () => {
  it("Avoid discards an Attack event from the hand; it is not offered without one", () => {
    const r = revealLater(TRIPWIRE, [ATTACK_EVENT, OTHER], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Trip"]);
    expect(r.discarded).toEqual([ATTACK_EVENT]);
    expect(revealLater(TRIPWIRE, [OTHER], choosingOption("Trip")).offered).toBeNull();
  });

  it("Disarm discards a support you control, then removes 3 threat from a scheme", () => {
    const r = revealLater(TRIPWIRE, [], choosingOption("Disarm"), { inPlay: [[SUPPORT, 1]], mainThreat: 4 });
    expect(r.offered).toEqual(["Disarm", "Trip"]);
    expect(cardsInPlay(r.state)).not.toContain(r.played[0]);
    const removed = types(r.events, "threatRemoved").filter(
      (e) => e.schemeInstanceId === r.before.mainScheme.instanceId,
    );
    expect(removed.map((e) => e.amount)).toEqual([3]);
  });

  it("Trip discards from the top of the encounter deck until a side scheme is discarded, then reveals it into play", () => {
    const r = revealLater(TRIPWIRE, [], choosingOption("Trip"), { encounter: [FILLER, SIDE_SCHEME, FILLER, FILLER] });
    expect(encounterDiscards(r.state, r.events).slice(0, 2)).toEqual([FILLER, SIDE_SCHEME]);
    const scheme = types(r.events, "encounterCardRevealed").find((e) => codeOf(r.state, e.instanceId) === SIDE_SCHEME)!;
    expect(scheme).toBeDefined();
    expect(r.state.villainArea).toContain(scheme.instanceId);
  });

  it("Trip with no side scheme before the encounter deck empties is fulfilled: nothing is revealed", () => {
    const r = revealLater(TRIPWIRE, [], choosingOption("Trip"), { stage: (s) => encounterDeckOnly(s, FILLER, FILLER) });
    const trip = untilVillainPhase(r.events);
    expect(encounterDiscards(r.state, trip)).toEqual([FILLER, FILLER]);
    expect(types(trip, "encounterCardRevealed").map((e) => codeOf(r.state, e.instanceId))).toEqual([TRIPWIRE]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The cards that name a TRAP! card's option: Nervous Jitters (65046), Iron Monk (65047), and the Forced Interrupts of
// Hall of Punishment (65048) and Path of a Thousand Cuts (65049). They name the option by its tag (`avoid`, `disarm`,
// `trip`), never by the label. RRG 1.8 "Interrupt" (p. 25): a "When you choose" interrupt resolves after the choice and
// before the chosen option.
// ---------------------------------------------------------------------------------------------------------------
const JITTERS = "65046";
const MONK = "65047";

/** Takes `code` out of the encounter deck (or its discard pile). */
function takeEncounter(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const piles = encounterPiles(state);
  const id = [...piles.deck, ...piles.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const deckId = activeEncounterDeckId(state);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: piles.deck.filter((i) => i !== id), discard: piles.discard.filter((i) => i !== id) },
      },
    },
  };
}
/** Nervous Jitters attached to P1's identity (surgery: no reveal). */
const jittersAttached = (state: GameState): GameState => {
  const taken = takeEncounter(state, JITTERS);
  const identity = identityOf(taken.state);
  return {
    ...taken.state,
    instances: {
      ...taken.state.instances,
      [taken.id]: { ...taken.state.instances[taken.id]!, attachedTo: identity, faceup: true, controllerId: null },
      [identity]: {
        ...taken.state.instances[identity]!,
        attachments: [...taken.state.instances[identity]!.attachments, taken.id],
      },
    },
  };
};
/** Iron Monk engaged with P1 (surgery: no reveal). */
const monkEngaged = (state: GameState): GameState => {
  const taken = takeEncounter(state, MONK);
  return {
    ...taken.state,
    players: taken.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, taken.id] } : p)),
    instances: {
      ...taken.state.instances,
      [taken.id]: { ...taken.state.instances[taken.id]!, engagedWith: P1, controllerId: null, faceup: true },
    },
  };
};
const inVillainArea =
  (code: string, threat = 0) =>
  (state: GameState): GameState =>
    encounterCardInVillainArea(state, code, threat).state;
/** The encounter deck is exactly `codes` (the rest moved to the encounter discard pile). */
function encounterDeckOnly(state: GameState, ...codes: readonly string[]): GameState {
  const piles = encounterPiles(state);
  const keep: InstanceId[] = [];
  for (const code of codes) keep.push(piles.deck.find((i) => codeOf(state, i) === code && !keep.includes(i))!);
  const deckId = activeEncounterDeckId(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: keep, discard: [...piles.discard, ...piles.deck.filter((i) => !keep.includes(i))] },
    },
  };
}
/** The codes of the cards moved from the encounter deck to its discard pile, in order. */
const encounterDiscards = (state: GameState, events: readonly GameEvent[]): string[] =>
  types(events, "cardMoved")
    .filter((e) => e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard")
    .map((e) => codeOf(state, e.instanceId));
/** P1's own deck shuffled (not the encounter deck or any other). */
const p1DeckShuffles = (events: readonly GameEvent[]) =>
  types(events, "deckShuffled").filter((e) => e.zone.kind === "deck" && e.zone.playerId === P1);
/** The events before the villain phase deals encounter cards: Shifting Corridors' activation, and the trap, are in them. */
const untilVillainPhase = (events: readonly GameEvent[]): readonly GameEvent[] => {
  const at = events.findIndex((e) => e.type === "stepChanged" && e.to.kind === "dealEncounterCards");
  return at < 0 ? events : events.slice(0, at);
};
/** The index in `events` of the first event matching `test`. */
const indexOf = (events: readonly GameEvent[], test: (e: GameEvent) => boolean): number => events.findIndex(test);
const identityHurt = (s: GameState) => (e: GameEvent) =>
  e.type === "damageDealt" && e.targetInstanceId === identityOf(s);

describe("Path of a Thousand Cuts (65049): Forced Interrupt on choosing Avoid or Trip", () => {
  const path = { alsoInEncounterDeck: [PATH], stage: inVillainArea(PATH, 5) };

  it("Avoid: 2 indirect damage, taken before the Avoid discard resolves", () => {
    const r = revealLater(BLINDING, [THWART_EVENT, OTHER], choosingOption("Avoid"), path);
    expect(r.discarded).toEqual([THWART_EVENT]);
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    const hurt = indexOf(r.events, identityHurt(r.state));
    expect(hurt).toBeGreaterThanOrEqual(0);
    expect(hurt).toBeLessThan(indexOf(r.events, (e) => e.type === "cardDiscardedFromHand"));
  });

  it("Trip, the only option left and chosen without asking: 2 indirect damage, then the Trip's own 2 damage", () => {
    const r = revealLater(BLINDING, [], choosingOption("Trip"), path);
    // An empty hand bars Avoid and Disarm: Trip is picked on its own (`onlyOption`), and still heard.
    expect(r.offered).toBeNull();
    expect(types(r.events, "optionChosen").map((e) => [e.tag, e.onlyOption])).toEqual([["trip", true]]);
    expect(damage(r.state)).toBe(damage(r.before) + 4);
    expect(statuses(r.state).confused).toBe(1);
  });

  it("Disarm is not heard", () => {
    const r = revealLater(BLINDING, [OTHER, DEFENSE_EVENT], choosingOption("Disarm"), path);
    expect(damage(r.state)).toBe(damage(r.before));
  });
});

describe("Hall of Punishment (65048): Forced Interrupt on choosing Trip", () => {
  const hall = { keepDeck: true, alsoInEncounterDeck: [HALL], stage: inVillainArea(HALL, 2) };

  it("Trip: the top 3 cards of your deck are discarded before the Trip resolves", () => {
    const r = revealLater(FLAME, [], choosingOption("Trip"), hall);
    // No ally in the refilled hand or in play bars Avoid and Disarm: Trip is picked on its own (`onlyOption`), and
    // still heard.
    expect(r.offered).toBeNull();
    expect(types(r.events, "optionChosen").map((e) => [e.tag, e.onlyOption])).toEqual([["trip", true]]);
    // The Hall's 3, then Flame Spout's own 3.
    const top = deckOf(r.before).slice(r.drawn, r.drawn + 6);
    for (const id of top) expect(discardOf(r.state)).toContain(id);
    const milled = indexOf(
      r.events,
      (e) => e.type === "cardMoved" && e.from.kind === "deck" && e.instanceId === top[0],
    );
    expect(milled).toBeGreaterThanOrEqual(0);
    expect(milled).toBeLessThan(indexOf(r.events, identityHurt(r.state)));
    expect(damage(r.state)).toBe(damage(r.before) + 3);
  });

  it("Avoid is not heard: nothing is milled", () => {
    const r = revealLater(DARTS, [], choosingOption("Avoid"), hall);
    expect(discardOf(r.state)).not.toContain(deckOf(r.before)[r.drawn]);
  });
});

describe("Nervous Jitters (65046): Forced Interrupt on choosing Avoid or Disarm", () => {
  /** Names `type` when asked for a card type; answers the trap with `option`. */
  const naming =
    (option: string, type: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      const named = choice.options.find((o) => o.label === type);
      if (choice.prompt.kind !== "chooseOption" && named) return [named.optionId];
      return choosingOption(option)(s);
    };
  const jitters = {
    stage: jittersAttached,
    encounter: [FILLER, FILLER, FILLER, FILLER],
    alsoInEncounterDeck: [JITTERS],
  };
  const jittersOf = (s: GameState) => instancesOf(s, JITTERS)[0]!;

  it("only the eight encounter card types can be named", () => {
    const r = revealLater(BLINDING, [THWART_EVENT, OTHER], naming("Avoid", "Attachment"), jitters);
    const asked = r.prompts.find((p) => p.kind !== "chooseOption" && p.options.includes("attachment"));
    expect(asked?.options.slice().sort()).toEqual(
      [
        "attachment",
        "environment",
        "main_scheme",
        "minion",
        "obligation",
        "side_scheme",
        "treachery",
        "villain",
      ].sort(),
    );
  });

  it("naming the discarded card's type: nothing else happens and the attachment stays", () => {
    // The encounter deck's top card is a Rhino attachment.
    const r = revealLater(BLINDING, [THWART_EVENT, OTHER], naming("Avoid", "Attachment"), jitters);
    expect(r.discarded).toEqual([THWART_EVENT]);
    expect(encounterDiscards(r.state, untilVillainPhase(r.events))).toEqual([FILLER]);
    expect(damage(r.state)).toBe(damage(r.before));
    expect(inst(r.state, identityOf(r.state)).attachments).toContain(jittersOf(r.state));
  });

  it("naming another type: 4 indirect damage and the attachment is discarded, before the Disarm resolves", () => {
    const r = revealLater(BLINDING, [OTHER, DEFENSE_EVENT], naming("Disarm", "Minion"), jitters);
    expect(damage(r.state)).toBe(damage(r.before) + 4);
    expect(cardsInPlay(r.state)).not.toContain(jittersOf(r.state));
    expect(indexOf(r.events, identityHurt(r.state))).toBeLessThan(
      indexOf(r.events, (e) => e.type === "cardDiscardedFromHand"),
    );
    expect(statuses(r.state).tough).toBe(1);
  });

  it("Trip is not heard", () => {
    const r = revealLater(BLINDING, [], naming("Trip", "Minion"), jitters);
    expect(encounterDiscards(r.state, untilVillainPhase(r.events))).toEqual([]);
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    expect(cardsInPlay(r.state)).toContain(jittersOf(r.state));
  });
});

describe("Iron Monk (65047): you cannot choose the Avoid effect while it is engaged with you", () => {
  it("engaged with you: Avoid is not offered", () => {
    const r = revealLater(BLINDING, [THWART_EVENT, OTHER], choosingOption("Trip"), {
      alsoInEncounterDeck: [MONK],
      stage: monkEngaged,
    });
    expect(r.offered).toEqual(["Disarm", "Trip"]);
    // A spend Avoid, offered even unpaid on an encounter card, is barred all the same.
    expect(
      revealLater(DARTS, [], choosingOption("Trip"), { alsoInEncounterDeck: [MONK], stage: monkEngaged }).offered,
    ).toEqual(["Disarm", "Trip"]);
  });

  it("with Avoid barred and Disarm unavailable, Trip resolves without asking (RRG 1.8 'Choose (Option)', p. 12)", () => {
    const r = revealLater(BLINDING, [], choosingOption("Trip"), { alsoInEncounterDeck: [MONK], stage: monkEngaged });
    expect(r.offered).toBeNull();
    // The Trip's 2 damage and confusion (the monk's own attack is separate).
    const fromTrap = types(r.events, "damageDealt").filter((e) => codeOf(r.state, e.sourceInstanceId!) === BLINDING);
    expect(fromTrap.map((e) => e.amount)).toEqual([2]);
    expect(statuses(r.state).confused).toBe(1);
  });

  it("not engaged with you (in the villain's area): Avoid is offered", () => {
    const r = revealLater(BLINDING, [THWART_EVENT, OTHER], choosingOption("Avoid"), {
      alsoInEncounterDeck: [MONK],
      stage: inVillainArea(MONK),
    });
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
  });
});

describe("registry", () => {
  it("scripts every ref and skips none", () => {
    expect(Object.keys(SHADOWLAND_DEADLY_CONTRAPTIONS).sort()).toEqual([
      "65046.nervous-jitters-forced-interrupt",
      "65047.iron-monk-constant",
      "65048.boost",
      "65048.hall-of-punishment-forced-interrupt",
      "65049.boost",
      "65049.path-of-a-thousand-cuts-forced-interrupt",
      "65050.when-revealed",
      "65051.when-revealed",
      "65052.when-revealed",
      "65053.when-revealed",
      "65054.when-revealed",
      "65055.when-revealed",
      "65056.when-revealed",
    ]);
    expect(SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED).toEqual({});
  });
});
