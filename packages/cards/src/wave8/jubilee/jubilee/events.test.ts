import { cardId, WAVE8_STARTER_DECKS, type AnyCard, type DeckContents } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  validateDeck,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type Payment,
  type PlayerId,
  type ResourceType,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  playerOf,
  resourceAbility,
  settle,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE8_CARDS } from "../../cards.js";
import { WAVE8_DEPS } from "../../index.js";
import { JUBILEE_EVENTS, JUBILEE_EVENTS_SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Jubilee's signature events (47006 Blinding Flash, 47007a/b/c Firecracker, 47008a/b/c Flash of Light, 47009 Grand
 * Finale), docs/phase7-wave8.md section 7.3, 3.62, 3.69; Q33 = B, Q34 = A. Real commands in a real game: her starter
 * deck (`jubilee-justice`) against Rhino, in hero form. Every payment is built from real cards by the icons they print:
 * Cell Phone 47019 [energy], Disguise 47013 [mental], Waylay 47014 [physical], X-Gene 47020 [wild], Plasmoid Energy
 * 47010a [energy][mental] / b [energy][physical] / c [mental][physical], The Power of Justice 47017 [wild] (doubled only
 * for a Justice card, so not for these events), and, added to the deck for the double-resource cases, the Core Set's
 * Strength 01090 ([physical][physical]). "Like, totally!" is her hero resource ability: one [wild].
 *
 * Every answer to a `declareWildTypes` choice is given explicitly by the test (an unanswered one throws). Enemies: Rhino
 * plus minions relabeled from spare encounter cards: Shocker 01103 (3 hit points), Sandman 01102 (4), Hydra Mercenary
 * 01101 (3, guard).
 */
const LIKE_TOTALLY = "47001a.like-totally";
const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;

const BLINDING = "47006";
const FIRECRACKERS = ["47007a", "47007b", "47007c"] as const;
const FLASHES = ["47008a", "47008b", "47008c"] as const;
const FINALE = "47009";
const FIRECRACKER_REFS = ["47007a.firecracker-action", "47007b.firecracker-action", "47007c.firecracker-action"];
const FLASH_REFS = ["47008a.flash-of-light-action", "47008b.flash-of-light-action", "47008c.flash-of-light-action"];
const REFS = ["47006.blinding-flash-action", ...FIRECRACKER_REFS, ...FLASH_REFS, "47009.grand-finale-action"];

/** One resource of each kind, by the card that prints exactly that. */
const E = "47019";
const M = "47013";
const PH = "47014";
const W = "47020";
const STRENGTH = "01090";

type Seat = "jubilee" | typeof SPIDER_MAN;
const seatOf = (seat: Seat) =>
  seat === "jubilee"
    ? {
        identityCardId: JUBILEE.identityCardId,
        aspects: JUBILEE.aspects,
        deck: [
          ...JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
          cardId(STRENGTH),
          cardId(STRENGTH),
        ],
      }
    : seat;

function setupGame(seats: readonly Seat[] = ["jubilee"], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: seats.map(seatOf),
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  } as never);
  const created = createGame({ ...config, requireLegalDecks: false }, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}
const alterEgoGame = (seats?: readonly Seat[]): GameState => setupGame(seats);
/** Jubilee (seat 1, or seat 2 with Spider-Man first) in hero form. */
const heroGame = (seats: readonly Seat[] = ["jubilee"]): GameState => {
  const s = setupGame(seats);
  return withForm(s, { heroForm: 0 }, seats.indexOf("jubilee") === 0 ? P1 : P2);
};
/** Spider-Man is seat 1, Jubilee seat 2. */
const TWO: readonly Seat[] = [SPIDER_MAN, "jubilee"];

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const stunned = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned;
const confused = (s: GameState, id: InstanceId): number => inst(s, id).statuses.confused;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));

/** Replaces the hand with exactly these cards (by code, in order); the old hand goes to the bottom of the deck. */
function handOf(s: GameState, player: PlayerId, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const cleared: GameState = {
    ...s,
    players: s.players.map((p) => (p.playerId === player ? { ...p, hand: [], deck: [...p.deck, ...p.hand] } : p)),
  };
  const moved = moveToHand(cleared, player, ...codes);
  return { state: moved.state, ids: [...moved.ids] };
}

/** A card's printed cost changed in this game's pool: the fixture for a cost reduction (or increase). */
function withCost(s: GameState, code: string, cost: number): GameState {
  const card = s.cardPool[cardId(code)] as AnyCard & { cost: number };
  return { ...s, cardPool: { ...s.cardPool, [code]: { ...card, cost } as AnyCard } };
}

/** A minion relabeled from the next spare encounter card, engaged with `to`, faceup and undamaged. */
function withMinion(s: GameState, to: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const minion = s.cardPool[cardId(code)];
  if (minion?.type !== "minion") throw new Error(`no minion ${code} in the pool`);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  const relabeled: GameState = {
    ...patchInstance(s, spare, { cardId: minion.id, faceup: true, engagedWith: to, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === to ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: relabeled, id: spare };
}
function withMinions(s: GameState, to: PlayerId, ...codes: readonly string[]): { state: GameState; ids: InstanceId[] } {
  let state = s;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const next = withMinion(state, to, code);
    state = next.state;
    ids.push(next.id);
  }
  return { state, ids };
}

interface Played {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** The `declareWildTypes` choices asked, with their options and who was asked. */
  readonly declared: readonly { readonly player: PlayerId; readonly options: readonly string[] }[];
  /** The `chooseTarget` choices asked, with their options. */
  readonly targeted: readonly {
    readonly player: PlayerId;
    readonly options: readonly string[];
    readonly max: number;
  }[];
}
interface PlayOptions {
  readonly player?: PlayerId;
  /** "Like, totally!" and the like: resource abilities that pay. */
  readonly abilities?: readonly Payment[];
  /** The declaration given up front on the command. */
  readonly wildAs?: readonly ResourceType[];
  /** The answers to the `declareWildTypes` choices in order, one type per wild. */
  readonly declare?: readonly (readonly ResourceType[])[];
  /** The answers to the `chooseTarget` choices in order (each a list of instances); the first options when absent. */
  readonly targets?: readonly (readonly InstanceId[])[];
}

const playCommand = (s: GameState, card: InstanceId, pay: readonly InstanceId[], o: PlayOptions = {}): Command => ({
  type: "playCard",
  playerId: o.player ?? P1,
  cardInstanceId: card,
  payment: [...(o.abilities ?? []), ...pay.map((fromHand) => ({ fromHand }))],
  attachToInstanceId: null,
  ...(o.wildAs ? { wildAs: o.wildAs } : {}),
});

/** Applies `command` and answers every choice it raises. A `declareWildTypes` choice with no answer given throws. */
function drive(s: GameState, command: Command, o: PlayOptions = {}): Played {
  const first = applyCommand(s, command, WAVE8_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  const events: GameEvent[] = [...first.events];
  const declared: Played["declared"][number][] = [];
  const targeted: Played["targeted"][number][] = [];
  let state = first.state;
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = state.pendingChoice;
    const ids = choice.options.map((x) => x.optionId as string);
    let selected: string[];
    if (choice.prompt.kind === "declareWildTypes") {
      const answer = o.declare?.[declared.length];
      declared.push({ player: choice.playerId, options: ids });
      if (!answer)
        throw new Error(`declareWildTypes was asked and the test gave no answer (options ${ids.join(", ")})`);
      selected = answer.map((type, index) => `${index}:${type}`);
    } else if (choice.prompt.kind === "chooseTarget") {
      const wanted = o.targets?.[targeted.length];
      targeted.push({ player: choice.playerId, options: ids, max: choice.maxSelections });
      selected = wanted ? [...wanted] : ids.slice(0, choice.maxSelections);
    } else if (choice.prompt.kind === "declareDefender") {
      selected = ["decline"];
    } else {
      selected = [...firstLegal(state)];
    }
    const next = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
      WAVE8_DEPS,
    );
    if (!next.ok) {
      throw new Error(
        `resolveChoice rejected: ${next.error.code}: ${next.error.message} (${choice.prompt.kind}, options ${ids.join(", ")})`,
      );
    }
    events.push(...next.events);
    state = next.state;
  }
  return { state, events, declared, targeted };
}

/** Stages `card` and the payers in a hand (the card first) and plays it with them. */
function cast(
  s: GameState,
  card: string,
  payers: readonly string[],
  o: PlayOptions = {},
): Played & { readonly cardId: InstanceId; readonly start: GameState; readonly payerIds: readonly InstanceId[] } {
  const staged = handOf(s, o.player ?? P1, card, ...payers);
  const [id, ...payerIds] = staged.ids as [InstanceId, ...InstanceId[]];
  const played = drive(staged.state, playCommand(staged.state, id, payerIds, o), o);
  return { ...played, cardId: id, start: staged.state, payerIds };
}

/** The instances of damage dealt, in order, as [target, amount]. */
const instances = (events: readonly GameEvent[]): [InstanceId, number][] =>
  events.flatMap((e) => (e.type === "damageDealt" ? [[e.targetInstanceId, e.amount] as [InstanceId, number]] : []));
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  instances(events)
    .filter(([t]) => t === target)
    .map(([, amount]) => amount);

const rejectedWith = (s: GameState, c: Command): string | null => {
  const r = applyCommand(s, c, WAVE8_DEPS);
  return r.ok ? null : r.error.code;
};
const like = (s: GameState, player: PlayerId = P1): Payment => resourceAbility(identityOf(s, player), LIKE_TOTALLY);

describe("Jubilee events registry", () => {
  it("holds exactly the eight event refs, none skipped", () => {
    expect(Object.keys(JUBILEE_EVENTS).sort()).toEqual([...REFS].sort());
    expect(JUBILEE_EVENTS_SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(JUBILEE_EVENTS[ref]!)).toEqual([]);
  });
  it("the three versions of Firecracker, and of Flash of Light, are one definition object (section 3.69)", () => {
    expect(JUBILEE_EVENTS[FIRECRACKER_REFS[1]!]).toBe(JUBILEE_EVENTS[FIRECRACKER_REFS[0]!]);
    expect(JUBILEE_EVENTS[FIRECRACKER_REFS[2]!]).toBe(JUBILEE_EVENTS[FIRECRACKER_REFS[0]!]);
    expect(JUBILEE_EVENTS[FLASH_REFS[1]!]).toBe(JUBILEE_EVENTS[FLASH_REFS[0]!]);
    expect(JUBILEE_EVENTS[FLASH_REFS[2]!]).toBe(JUBILEE_EVENTS[FLASH_REFS[0]!]);
    expect(JUBILEE_EVENTS[FIRECRACKER_REFS[0]!]).not.toBe(JUBILEE_EVENTS[FLASH_REFS[0]!]);
  });
  it("each event is marked with exactly what it reads", () => {
    const reads = (ref: string) => (JUBILEE_EVENTS[ref] as { readsPaidTypes?: unknown }).readsPaidTypes;
    expect(reads(REFS[0]!)).toEqual({ count: true });
    for (const ref of [...FIRECRACKER_REFS, ...FLASH_REFS]) expect(reads(ref)).toEqual({ atLeast: 2 });
    expect(reads(REFS[7]!)).toEqual({ count: true });
  });
  it("the printed cards carry those ability ids, costs and icons per version", () => {
    const s = heroGame();
    const card = (code: string) =>
      s.cardPool[cardId(code)] as unknown as {
        cost: number;
        resourceIcons: Record<string, number>;
        abilities: { id: string }[];
        name: string;
      };
    expect(card(BLINDING).cost).toBe(3);
    expect(card(BLINDING).resourceIcons).toEqual({ wild: 1 });
    expect(card(FINALE).cost).toBe(3);
    expect(card(FINALE).resourceIcons).toEqual({ wild: 1 });
    expect(card(FINALE).abilities.map((a) => a.id)).toEqual(["47009.grand-finale-action"]);
    expect(FIRECRACKERS.map((c) => card(c).resourceIcons)).toEqual([{ energy: 1 }, { mental: 1 }, { physical: 1 }]);
    expect(FLASHES.map((c) => card(c).resourceIcons)).toEqual([{ energy: 1 }, { mental: 1 }, { physical: 1 }]);
    for (const c of [...FIRECRACKERS, ...FLASHES]) expect(card(c).cost).toBe(2);
    expect(FIRECRACKERS.map((c) => card(c).abilities[0]!.id)).toEqual(FIRECRACKER_REFS);
    expect(FLASHES.map((c) => card(c).abilities[0]!.id)).toEqual(FLASH_REFS);
  });
});

describe("section 3.69: her nine version records in a starter deck", () => {
  const deck = (): DeckContents => ({
    identityCardId: JUBILEE.identityCardId,
    aspects: JUBILEE.aspects,
    cards: JUBILEE.cards,
  });
  const withQuantity = (code: string, quantity: number, base = deck()): DeckContents => ({
    ...base,
    cards: base.cards.map((l) => (l.cardId === cardId(code) ? { ...l, quantity } : l)),
  });
  const without = (code: string, base = deck()): DeckContents => ({
    ...base,
    cards: base.cards.filter((l) => l.cardId !== cardId(code)),
  });
  const problemsOf = (d: DeckContents) => {
    const verdict = validateDeck(d, WAVE8_CARDS);
    return verdict.ok ? [] : verdict.problems;
  };

  it("the starter deck holds each of the nine records once and is legal", () => {
    const d = deck();
    for (const c of [...FIRECRACKERS, ...FLASHES, "47010a", "47010b", "47010c"]) {
      expect(d.cards.find((l) => l.cardId === cardId(c))?.quantity).toBe(1);
    }
    expect(d.cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    expect(validateDeck(d, WAVE8_CARDS)).toEqual({ ok: true });
  });
  it("a second 47007a is illegal (one too many of an identity-set card)", () => {
    const verdict = problemsOf(withQuantity("47007a", 2));
    expect(verdict.length).toBeGreaterThan(0);
    expect(verdict.some((p) => p.cardIds.includes(cardId("47007a")))).toBe(true);
  });
  it("without 47007b it is illegal (a missing identity-set card)", () => {
    const verdict = problemsOf(without("47007b"));
    expect(verdict.length).toBeGreaterThan(0);
    expect(verdict.some((p) => p.cardIds.includes(cardId("47007b")))).toBe(true);
  });
  it("47007a three times and no b or c is illegal", () => {
    const d = withQuantity("47007a", 3, without("47007c", without("47007b")));
    expect(problemsOf(d).length).toBeGreaterThanOrEqual(2);
  });
  it("no 'more than three copies' or deck-limit problem is reported for a legal deck", () => {
    expect(problemsOf(deck())).toEqual([]);
  });
  it("a version pays as its own icon: 47007a, b and c pay a Grand Finale as energy, mental and physical", () => {
    const { state } = cast(heroGame(), FINALE, ["47007a", "47007b", "47007c"]);
    expect(damageOf(state, villainOf(state))).toBe(8);
  });
});

describe("Firecracker (47007a/b/c): 4 damage to an enemy; stun it if 2 different types paid", () => {
  const start = (): GameState => heroGame();

  describe.each(FIRECRACKERS)("version %s", (version) => {
    it("two different types (energy and mental cards): 4 damage and a stunned status, nothing asked", () => {
      const s = start();
      const r = cast(s, version, [E, M]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
      expect(r.declared).toHaveLength(0);
      expect(discardCodes(r.state)).toEqual(expect.arrayContaining([E, M, version]));
      expect(playerOf(r.state, P1).hand).toHaveLength(0);
      expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
    });
    it("one type (two cards of one type, counting once): 4 damage, no stun", () => {
      const r = cast(start(), version, [E, E]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
    });
  });

  it("1 type, 2 types: Plasmoid Energy 47010a ([energy][mental]) alone stuns; 47010b and c as well", () => {
    for (const plasmoid of ["47010a", "47010b", "47010c"]) {
      const r = cast(start(), "47007a", [plasmoid]);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
    }
  });
  it("a card printing two icons of one type (Strength, [physical][physical]) is one type: no stun", () => {
    const r = cast(start(), "47007b", [STRENGTH]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(4);
    expect(stunned(r.state, villainOf(r.state))).toBe(0);
  });
  it("a cost of 2 reads at most 2 types, however many were generated (Q34 = A): three cards of three types stun once", () => {
    const r = cast(start(), "47007a", [E, M, PH]);
    expect(stunned(r.state, villainOf(r.state))).toBe(1);
    expect(r.declared).toHaveLength(0);
    // The overpaid card was paid anyway: all three left the hand.
    expect(playerOf(r.state, P1).hand).toHaveLength(0);
    expect(discardCodes(r.state)).toEqual(expect.arrayContaining([E, M, PH]));
  });
  it("a stunned status already on the enemy stays one (an enemy holds one stunned status)", () => {
    const s = start();
    const stun = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, stunned: 1 } });
    const r = cast(stun, "47007a", [E, M]);
    expect(stunned(r.state, villainOf(r.state))).toBe(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(4);
  });
  it("the enemy hit is the one chosen: a minion takes the 4 damage and the stun, Rhino nothing", () => {
    const s = start();
    const m = withMinion(s, P1, "01102");
    const r = cast(m.state, "47007a", [E, M], { targets: [[m.id]] });
    expect(r.targeted[0]!.options).toEqual(expect.arrayContaining([m.id, villainOf(s)]));
    expect(damageOf(r.state, m.id)).toBe(0);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    // Sandman has 4 hit points: 4 damage defeats it; with nothing left to stun the rest is just the attack.
    expect(damageTo(r.events, m.id)).toEqual([4]);
    expect(r.state.players.some((p) => p.playArea.includes(m.id))).toBe(false);
  });
  it("the stun lands on the enemy chosen, not on another enemy in play", () => {
    const s = start();
    const m = withMinion(s, P1, "01102");
    const r = cast(m.state, "47007c", [E, PH], { targets: [[villainOf(m.state)]] });
    expect(stunned(r.state, villainOf(r.state))).toBe(1);
    expect(stunned(r.state, m.id)).toBe(0);
    expect(damageOf(r.state, m.id)).toBe(0);
  });
  it("a guard minion engaged with her must be attacked first: only it is offered", () => {
    const s = start();
    const g = withMinion(s, P1, "01101");
    const r = cast(g.state, "47007a", [E, M]);
    expect(r.targeted[0]!.options).toEqual([g.id]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });

  describe("Q33 = B: a wild in the payment is declared by the player", () => {
    it("Like, totally! and a [physical] card: she is asked once for the one wild, four options, none preselected", () => {
      const s = start();
      const r = cast(s, "47007c", [PH], { abilities: [like(s)], declare: [["energy"]] });
      expect(r.declared).toHaveLength(1);
      expect(r.declared[0]!.player).toBe(P1);
      expect([...r.declared[0]!.options].sort()).toEqual(["0:energy", "0:mental", "0:physical", "0:wild"]);
    });
    it.each(["energy", "mental", "wild"] as const)("declared %s: two types, so 4 damage and a stun", (type) => {
      const s = start();
      const r = cast(s, "47007c", [PH], { abilities: [like(s)], declare: [[type]] });
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
      expect(inst(r.state, identityOf(r.state)).exhausted).toBe(true);
    });
    it("declared [physical]: one type, 4 damage and no stun", () => {
      const s = start();
      const r = cast(s, "47007c", [PH], { abilities: [like(s)], declare: [["physical"]] });
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
    });
    it("the declaration given up front as wildAs on the command: nothing is asked", () => {
      const s = start();
      const stun = cast(s, "47007c", [PH], { abilities: [like(s)], wildAs: ["mental"] });
      expect(stun.declared).toHaveLength(0);
      expect(stunned(stun.state, villainOf(stun.state))).toBe(1);
      const none = cast(s, "47007c", [PH], { abilities: [like(s)], wildAs: ["physical"] });
      expect(none.declared).toHaveLength(0);
      expect(stunned(none.state, villainOf(none.state))).toBe(0);
    });
    it("two wilds (Like, totally! and an X-Gene card): two declarations; two different types stun, the same twice does not", () => {
      const s = start();
      const stuns = [
        [["energy", "mental"], 1],
        [["wild", "energy"], 1],
        [["physical", "wild"], 1],
        [["energy", "energy"], 0],
        [["wild", "wild"], 0],
        [["mental", "mental"], 0],
      ] as const;
      for (const [declaration, stun] of stuns) {
        const r = cast(s, "47007a", [W], { abilities: [like(s)], declare: [declaration] });
        expect(r.declared).toHaveLength(1);
        expect(r.declared[0]!.options).toHaveLength(8);
        expect(stunned(r.state, villainOf(r.state))).toBe(stun);
        expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      }
    });
    it("asked although one answer is plainly best: Like, totally! and Strength", () => {
      const s = start();
      const r = cast(s, "47007a", [STRENGTH], { abilities: [like(s)], declare: [["energy"]] });
      expect(r.declared).toHaveLength(1);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
      // Overpaid (Q34 = A): the cost is 2 of the 3 resources generated; declared [physical] the set is one type.
      const same = cast(s, "47007a", [STRENGTH], { abilities: [like(s)], declare: [["physical"]] });
      expect(same.declared).toHaveLength(1);
      expect(stunned(same.state, villainOf(same.state))).toBe(0);
    });
    it("the shortcut: a cost of 1 (fixture) paid with Like, totally! alone is one type whatever it is called: nothing asked", () => {
      const s = withCost(start(), "47007a", 1);
      const r = cast(s, "47007a", [], { abilities: [like(s)] });
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
    });
    it("the shortcut: typed resources already fill the two types, so a wild beside them asks nothing", () => {
      const s = start();
      const r = cast(s, "47007a", ["47010a"], { abilities: [like(s)] });
      expect(r.declared).toHaveLength(0);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
    });
    it("the shortcut: no wild generated, nothing asked (an energy card and a mental card)", () => {
      const r = cast(start(), "47007a", [E, M]);
      expect(r.declared).toHaveLength(0);
    });
  });

  describe("cost changes", () => {
    it("reduced to 0 (fixture): nothing is paid, so no type was used; 4 damage, no stun, an energy card paid anyway", () => {
      const s = withCost(start(), "47007a", 0);
      const r = cast(s, "47007a", [E]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
      expect(r.declared).toHaveLength(0);
    });
    it("reduced to 1 (fixture): at most one type can be read, so two cards of two types do not stun", () => {
      const s = withCost(start(), "47007a", 1);
      const r = cast(s, "47007a", [E, M]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
    });
    it("raised to 3 (fixture): three resources, two types or more still stun", () => {
      const s = withCost(start(), "47007a", 3);
      const r = cast(s, "47007a", [E, E, M]);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
    });
  });

  describe("refusals", () => {
    it("alter-ego form: refused, the card stays in hand", () => {
      const s = alterEgoGame();
      const staged = handOf(s, P1, "47007a", E, M);
      const [id, a, b] = staged.ids as [InstanceId, InstanceId, InstanceId];
      const command = playCommand(staged.state, id, [a, b]);
      expect(rejectedWith(staged.state, command)).toBe("wrong_form");
      expect(playerOf(staged.state, P1).hand).toContain(id);
    });
    it("cannot afford: one card for a cost of 2", () => {
      const staged = handOf(start(), P1, "47007a", E);
      const [id, a] = staged.ids as [InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a]))).toBe("insufficient_resources");
    });
    it("a stunned identity cancels the whole event (the status is removed, no damage) and the card is lost", () => {
      const s = start();
      const id = identityOf(s);
      const stunnedHero = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
      const r = cast(stunnedHero, "47007a", [E, M]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(0);
      expect(stunned(r.state, villainOf(r.state))).toBe(0);
      expect(stunned(r.state, identityOf(r.state))).toBe(0);
      expect(discardCodes(r.state)).toEqual(expect.arrayContaining(["47007a", E, M]));
    });
  });

  describe("two players: the paying player declares, the enemy is stunned", () => {
    it("Jubilee as seat 2 pays with her own wild; the choice is hers and Spider-Man's identity is untouched", () => {
      const s = heroGame(TWO);
      const r = cast(s, "47007c", [PH], { player: P2, abilities: [like(s, P2)], declare: [["energy"]] });
      expect(r.declared).toHaveLength(1);
      expect(r.declared[0]!.player).toBe(P2);
      expect(stunned(r.state, villainOf(r.state))).toBe(1);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
      expect(stunned(r.state, identityOf(r.state, P1))).toBe(0);
      expect(stunned(r.state, identityOf(r.state, P2))).toBe(0);
      expect(inst(r.state, identityOf(r.state, P2)).exhausted).toBe(true);
      expect(inst(r.state, identityOf(r.state, P1)).exhausted).toBe(false);
    });
    it("seat 1 cannot use her resource ability to pay for a card of seat 2's hand", () => {
      const s = heroGame(TWO);
      const staged = handOf(s, P2, "47007c", PH);
      const [id, a] = staged.ids as [InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a], { player: P1 }))).not.toBeNull();
      expect(
        rejectedWith(staged.state, playCommand(staged.state, id, [], { player: P2, abilities: [like(s, P1)] })),
      ).not.toBeNull();
    });
  });
});

describe("Flash of Light (47008a/b/c): remove 3 threat from a scheme; confuse an enemy if 2 different types paid", () => {
  /** The main scheme at 6 threat, so a thwart of 3 leaves exactly 3. */
  const start = (): GameState => {
    const s = heroGame();
    return patchInstance(s, mainOf(s), { threat: 6 });
  };
  const threat = (s: GameState): number => inst(s, mainOf(s)).threat;

  describe.each(FLASHES)("version %s", (version) => {
    it("two different types (energy and physical cards): 3 threat removed and the villain confused, nothing asked", () => {
      const r = cast(start(), version, [E, PH]);
      expect(threat(r.state)).toBe(3);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
      expect(r.declared).toHaveLength(0);
      expect(playerOf(r.state, P1).hand).toHaveLength(0);
      expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
    });
    it("one type (two cards of one type counting once): 3 threat removed, nobody confused", () => {
      const r = cast(start(), version, [M, M]);
      expect(threat(r.state)).toBe(3);
      expect(confused(r.state, villainOf(r.state))).toBe(0);
    });
  });

  it("Plasmoid Energy alone (two types on one card) confuses", () => {
    const r = cast(start(), "47008c", ["47010c"]);
    expect(threat(r.state)).toBe(3);
    expect(confused(r.state, villainOf(r.state))).toBe(1);
  });
  it("overpaid (Q34 = A): three cards of three types for a cost of 2 is two types: one confused status, three cards spent", () => {
    const r = cast(start(), "47008a", [E, M, PH]);
    expect(confused(r.state, villainOf(r.state))).toBe(1);
    expect(playerOf(r.state, P1).hand).toHaveLength(0);
  });
  it("the enemy confused is any enemy, chosen: a minion she could not attack past a guard", () => {
    const s = start();
    const guard = withMinion(s, P1, "01101");
    const r = cast(guard.state, "47008a", [E, M], { targets: [[mainOf(s)], [villainOf(s)]] });
    expect(r.targeted[0]!.options).toEqual([mainOf(s)]);
    expect(r.targeted[1]!.options).toEqual(expect.arrayContaining([villainOf(s), guard.id]));
    expect(confused(r.state, villainOf(r.state))).toBe(1);
    expect(confused(r.state, guard.id)).toBe(0);
  });
  it("the thwart removes from the scheme chosen: a side scheme can be chosen instead of the main scheme", () => {
    const s = start();
    const r = cast(s, "47008b", [M, M], { targets: [[mainOf(s)]] });
    expect(threat(r.state)).toBe(3);
  });
  it("a scheme with fewer than 3 threat loses what it has", () => {
    const s = start();
    const low = patchInstance(s, mainOf(s), { threat: 2 });
    const r = cast(low, "47008a", [E, M]);
    expect(threat(r.state)).toBe(0);
    expect(confused(r.state, villainOf(r.state))).toBe(1);
  });

  describe("Q33 = B: a wild in the payment is declared by the player", () => {
    it("Like, totally! and Strength (Spec 3.66 line): declared [energy], [mental] or left [wild]: two types, 3 removed and an enemy confused", () => {
      for (const type of ["energy", "mental", "wild"] as const) {
        const s = start();
        const r = cast(s, "47008a", [STRENGTH], { abilities: [like(s)], declare: [[type]] });
        expect(r.declared).toHaveLength(1);
        expect(threat(r.state)).toBe(3);
        expect(confused(r.state, villainOf(r.state))).toBe(1);
      }
    });
    it("declared [physical]: one type, 3 removed, nobody confused", () => {
      const s = start();
      const r = cast(s, "47008a", [STRENGTH], { abilities: [like(s)], declare: [["physical"]] });
      expect(threat(r.state)).toBe(3);
      expect(confused(r.state, villainOf(r.state))).toBe(0);
    });
    it("wildAs on the command: nothing is asked", () => {
      const s = start();
      const r = cast(s, "47008c", [PH], { abilities: [like(s)], wildAs: ["energy"] });
      expect(r.declared).toHaveLength(0);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
      const same = cast(s, "47008c", [PH], { abilities: [like(s)], wildAs: ["physical"] });
      expect(same.declared).toHaveLength(0);
      expect(confused(same.state, villainOf(same.state))).toBe(0);
    });
    it("the shortcut: an [energy] card and a [mental] card, no wild: nothing asked", () => {
      const r = cast(start(), "47008b", [E, M]);
      expect(r.declared).toHaveLength(0);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
    });
    it("the shortcut: a wild beside typed resources that already fill two types asks nothing (overpaid wild)", () => {
      const s = start();
      const r = cast(s, "47008a", [E, M], { abilities: [like(s)] });
      expect(r.declared).toHaveLength(0);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
    });
    it("two wilds: asked for both; two different types confuse, the same twice does not", () => {
      for (const [declaration, confusedCount] of [
        [["energy", "mental"], 1],
        [["wild", "physical"], 1],
        [["mental", "mental"], 0],
        [["wild", "wild"], 0],
      ] as const) {
        const s = start();
        const r = cast(s, "47008a", [W], { abilities: [like(s)], declare: [declaration] });
        expect(r.declared).toHaveLength(1);
        expect(confused(r.state, villainOf(r.state))).toBe(confusedCount);
      }
    });
  });

  describe("cost changes", () => {
    it("reduced to 0 (fixture): 3 removed, nobody confused", () => {
      const s = withCost(start(), "47008a", 0);
      const r = cast(s, "47008a", [E, M]);
      expect(threat(r.state)).toBe(3);
      expect(confused(r.state, villainOf(r.state))).toBe(0);
    });
    it("reduced to 1 (fixture): two cards of two types read one type: nobody confused", () => {
      const s = withCost(start(), "47008a", 1);
      const r = cast(s, "47008a", [E, M]);
      expect(confused(r.state, villainOf(r.state))).toBe(0);
    });
  });

  describe("refusals", () => {
    it("alter-ego form: refused", () => {
      const s = patchInstance(alterEgoGame(), alterEgoGame().mainScheme.instanceId, { threat: 6 });
      const staged = handOf(s, P1, "47008a", E, M);
      const [id, a, b] = staged.ids as [InstanceId, InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a, b]))).toBe("wrong_form");
    });
    it("cannot afford: one card for a cost of 2", () => {
      const staged = handOf(start(), P1, "47008a", E);
      const [id, a] = staged.ids as [InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a]))).toBe("insufficient_resources");
    });
    it("every scheme at 0 threat: still playable (the confuse part has a target, FAQ Images of Ikonn); nothing is removed", () => {
      const s = heroGame();
      const bare = patchInstance(s, mainOf(s), { threat: 0 });
      const r = cast(bare, "47008a", [E, M]);
      expect(threat(r.state)).toBe(0);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
    });
    it("a confused identity cancels the whole event: the status is removed, 0 threat removed, nobody confused", () => {
      const s = start();
      const id = identityOf(s);
      const confusedHero = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, confused: 1 } });
      const r = cast(confusedHero, "47008a", [E, M]);
      expect(threat(r.state)).toBe(6);
      expect(confused(r.state, identityOf(r.state))).toBe(0);
      expect(confused(r.state, villainOf(r.state))).toBe(0);
      expect(discardCodes(r.state)).toEqual(expect.arrayContaining(["47008a", E, M]));
    });
  });

  describe("two players", () => {
    it("Jubilee as seat 2: she declares, she thwarts, and the confused status is on the enemy, not on either hero", () => {
      const base = heroGame(TWO);
      const s = patchInstance(base, mainOf(base), { threat: 6 });
      const r = cast(s, "47008a", [PH], { player: P2, abilities: [like(s, P2)], declare: [["mental"]] });
      expect(r.declared.map((d) => d.player)).toEqual([P2]);
      expect(threat(r.state)).toBe(3);
      expect(confused(r.state, villainOf(r.state))).toBe(1);
      expect(confused(r.state, identityOf(r.state, P1))).toBe(0);
      expect(confused(r.state, identityOf(r.state, P2))).toBe(0);
    });
  });
});

describe("Blinding Flash (47006): choose X enemies, X the number of different types that paid; stun and confuse each", () => {
  const withEnemies = (n: number, game: GameState = heroGame(), to: PlayerId = P1) => {
    const minions = withMinions(game, to, ...["01103", "01102", "01132"].slice(0, n));
    return { state: minions.state, ids: [villainOf(game), ...minions.ids] };
  };
  const hit = (s: GameState, id: InstanceId): [number, number] => [stunned(s, id), confused(s, id)];

  it("one type (three cards of one type): X is 1, one enemy chosen, stunned and confused", () => {
    const { state, ids } = withEnemies(2);
    const r = cast(state, BLINDING, [E, E, E], { targets: [[ids[1]!]] });
    expect(r.targeted).toHaveLength(1);
    expect(r.targeted[0]!.max).toBe(1);
    expect(r.declared).toHaveLength(0);
    expect(ids.map((id) => hit(r.state, id))).toEqual([
      [0, 0],
      [1, 1],
      [0, 0],
    ]);
  });
  it("two types: X is 2, two enemies each stunned and confused", () => {
    const { state, ids } = withEnemies(2);
    const r = cast(state, BLINDING, [E, E, M], { targets: [[ids[0]!, ids[2]!]] });
    expect(r.targeted[0]!.max).toBe(2);
    expect(ids.map((id) => hit(r.state, id))).toEqual([
      [1, 1],
      [0, 0],
      [1, 1],
    ]);
  });
  it("three types: X is 3, three of the four enemies", () => {
    const { state, ids } = withEnemies(3);
    const r = cast(state, BLINDING, [E, M, PH], { targets: [[ids[1]!, ids[2]!, ids[3]!]] });
    expect(r.targeted[0]!.max).toBe(3);
    expect(ids.map((id) => hit(r.state, id))).toEqual([
      [0, 0],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });
  it("Plasmoid Energy ([energy][mental]) and a [physical] card: three types", () => {
    const { state } = withEnemies(3);
    const r = cast(state, BLINDING, ["47010a", PH]);
    expect(r.targeted[0]!.max).toBe(3);
  });
  it("four types (cost raised to 4 by a fixture; Like, totally! declared [wild] beside E, M, PH): X is 4", () => {
    const base = withCost(heroGame(), BLINDING, 4);
    const { state, ids } = withEnemies(3, base);
    const r = cast(state, BLINDING, [E, M, PH], { abilities: [like(state)], declare: [["wild"]] });
    expect(r.declared).toHaveLength(1);
    expect(r.targeted[0]!.max).toBe(4);
    expect(ids.every((id) => hit(r.state, id).join() === "1,1")).toBe(true);
  });
  it("three types but only two enemies in play: every enemy is chosen, each affected once", () => {
    const { state, ids } = withEnemies(1);
    const r = cast(state, BLINDING, [E, M, PH]);
    expect(r.targeted[0]!.options).toHaveLength(2);
    expect(ids.map((id) => hit(r.state, id))).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
  it("an enemy already stunned keeps one stunned status and still gets confused", () => {
    const { state, ids } = withEnemies(1);
    const s = patchInstance(state, ids[0]!, { statuses: { ...inst(state, ids[0]!).statuses, stunned: 1 } });
    const r = cast(s, BLINDING, [E, E, E], { targets: [[ids[0]!]] });
    expect(hit(r.state, ids[0]!)).toEqual([1, 1]);
  });
  it("it is no attack: a guard minion does not restrict the choice, and no damage is dealt", () => {
    const base = withEnemies(2);
    const guard = withMinion(base.state, P1, "01101");
    const r = cast(guard.state, BLINDING, [E, E, E]);
    expect(r.targeted[0]!.options).toEqual(expect.arrayContaining([...base.ids, guard.id]));
    expect(instances(r.events)).toEqual([]);
  });

  describe("Q33 = B: a wild in the payment is declared by the player", () => {
    it("Like, totally! with an energy card and a mental card: [physical] or left [wild] is a third type, [energy] or [mental] is two", () => {
      const expected = { energy: 2, mental: 2, physical: 3, wild: 3 } as const;
      for (const type of ["energy", "mental", "physical", "wild"] as const) {
        const { state } = withEnemies(3);
        const r = cast(state, BLINDING, [E, M], { abilities: [like(state)], declare: [[type]] });
        expect(r.declared).toHaveLength(1);
        expect(r.targeted[0]!.max).toBe(expected[type]);
      }
    });
    it("wildAs on the command: nothing asked", () => {
      const { state } = withEnemies(3);
      const r = cast(state, BLINDING, [E, M], { abilities: [like(state)], wildAs: ["physical"] });
      expect(r.declared).toHaveLength(0);
      expect(r.targeted[0]!.max).toBe(3);
    });
    it("the shortcut: Like, totally! alone at a cost of 1 (fixture) is one type whatever it is: X is 1, nothing asked", () => {
      const base = withCost(heroGame(), BLINDING, 1);
      const { state } = withEnemies(2, base);
      const r = cast(state, BLINDING, [], { abilities: [like(state)] });
      expect(r.declared).toHaveLength(0);
      expect(r.targeted[0]!.max).toBe(1);
    });
    it("the shortcut: three typed resources and a wild beside them (overpaid): nothing asked, X is 3", () => {
      const { state } = withEnemies(3);
      const r = cast(state, BLINDING, [E, M, PH], { abilities: [like(state)] });
      expect(r.declared).toHaveLength(0);
      expect(r.targeted[0]!.max).toBe(3);
    });
    it("two wilds and one typed card: [energy] and [mental] declared makes three types, two the same makes two", () => {
      const results: Record<string, number> = {};
      for (const declaration of [
        ["mental", "physical"],
        ["mental", "mental"],
        ["wild", "wild"],
      ] as const) {
        const { state } = withEnemies(3);
        const r = cast(state, BLINDING, [W, E], { abilities: [like(state)], declare: [declaration] });
        results[declaration.join("+")] = r.targeted[0]!.max;
      }
      expect(results).toEqual({ "mental+physical": 3, "mental+mental": 2, "wild+wild": 2 });
    });
  });

  describe("cost changes", () => {
    it("reduced to 0 (fixture): X is 0, nothing is chosen, nothing asked, nobody is affected", () => {
      const base = withCost(heroGame(), BLINDING, 0);
      const { state, ids } = withEnemies(2, base);
      const r = cast(state, BLINDING, [E, M]);
      expect(r.targeted).toHaveLength(0);
      expect(ids.map((id) => hit(r.state, id))).toEqual([
        [0, 0],
        [0, 0],
        [0, 0],
      ]);
    });
    it("reduced to 2 (fixture): three cards of three types read two", () => {
      const base = withCost(heroGame(), BLINDING, 2);
      const { state } = withEnemies(3, base);
      const r = cast(state, BLINDING, [E, M, PH]);
      expect(r.targeted[0]!.max).toBe(2);
    });
  });

  describe("refusals", () => {
    it("alter-ego form: refused", () => {
      const staged = handOf(alterEgoGame(), P1, BLINDING, E, M, PH);
      const [id, a, b, c] = staged.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a, b, c]))).toBe("wrong_form");
    });
    it("cannot afford: two cards for a cost of 3", () => {
      const staged = handOf(heroGame(), P1, BLINDING, E, M);
      const [id, a, b] = staged.ids as [InstanceId, InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a, b]))).toBe("insufficient_resources");
    });
  });

  describe("two players", () => {
    it("Jubilee as seat 2: X counts her payment only; the choice includes the minion engaged with seat 1", () => {
      const base = heroGame(TWO);
      const { state, ids } = withEnemies(2, base, P1);
      const r = cast(state, BLINDING, [E, M, PH], { player: P2 });
      expect(r.targeted[0]!.player).toBe(P2);
      expect(r.targeted[0]!.max).toBe(3);
      expect(r.targeted[0]!.options).toEqual(expect.arrayContaining(ids));
      expect(ids.map((id) => hit(r.state, id))).toEqual([
        [1, 1],
        [1, 1],
        [1, 1],
      ]);
      expect(hit(r.state, identityOf(r.state, P1))).toEqual([0, 0]);
      expect(hit(r.state, identityOf(r.state, P2))).toEqual([0, 0]);
    });
  });
});

describe("Grand Finale (47009): 2 damage to an enemy, then 2 more for each different type that paid", () => {
  const withEnemies = (n: number, game: GameState = heroGame()) => {
    const minions = withMinions(game, P1, ...["01103", "01102", "01132"].slice(0, n));
    return { state: minions.state, ids: [villainOf(game), ...minions.ids] };
  };

  it("one type: 2 + 2 = 4 damage", () => {
    const r = cast(heroGame(), FINALE, [E, E, E]);
    expect(instances(r.events).map(([, n]) => n)).toEqual([2, 2]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(4);
  });
  it("two types: 2 + 2 + 2 = 6 damage", () => {
    const r = cast(heroGame(), FINALE, [E, E, M]);
    expect(instances(r.events).map(([, n]) => n)).toEqual([2, 2, 2]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(6);
  });
  it("three types: 2 + 2 + 2 + 2 = 8 damage on one enemy", () => {
    const r = cast(heroGame(), FINALE, [E, M, PH]);
    expect(instances(r.events).map(([, n]) => n)).toEqual([2, 2, 2, 2]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(8);
    expect(r.targeted).toHaveLength(4);
  });
  it("three types: 2 each on four different enemies when she chooses so", () => {
    const { state, ids } = withEnemies(3);
    const r = cast(state, FINALE, ["47010a", PH], { targets: ids.map((id) => [id]) });
    expect(instances(r.events)).toEqual(ids.map((id) => [id, 2]));
    expect(ids.map((id) => damageOf(r.state, id))).toEqual([2, 2, 2, 2]);
  });
  it("Plasmoid Energy 47010a and Flash of Light 47008c ([physical]): three types, 8 damage", () => {
    const r = cast(heroGame(), FINALE, ["47010a", "47008c"]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(8);
  });
  it("four types (cost raised to 4 by a fixture): 2 + 4 x 2 = 10 damage", () => {
    const s = withCost(heroGame(), FINALE, 4);
    const r = cast(s, FINALE, [E, M, PH], { abilities: [like(s)], declare: [["wild"]] });
    expect(instances(r.events).map(([, n]) => n)).toEqual([2, 2, 2, 2, 2]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(10);
  });

  describe("Q34 = A: overpaid resources are not read", () => {
    it("Plasmoid Energy 47010a, Flash of Light 47008c and Strength: five resources, three paid, three types: 8 damage", () => {
      const r = cast(heroGame(), FINALE, ["47010a", "47008c", STRENGTH]);
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(8);
      expect(playerOf(r.state, P1).hand).toHaveLength(0);
    });
    it("47010a, Waylay and The Power of Justice (1 [wild], not doubled for this card): four types generated, three paid: 8, not 10", () => {
      const r = cast(heroGame(), FINALE, ["47010a", PH, "47017"]);
      expect(r.declared).toHaveLength(0);
      expect(instances(r.events).map(([, n]) => n)).toEqual([2, 2, 2, 2]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(8);
    });
    it("Strength and a Cell Phone for a cost of 3: [physical][physical][energy] is two types: 6", () => {
      const r = cast(heroGame(), FINALE, [STRENGTH, E]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(6);
    });
    it("a cost of 3 paid with four single cards of four types reads at most three: 8", () => {
      const s = heroGame();
      const r = cast(s, FINALE, [E, M, PH, W], { declare: [["wild"]] });
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(8);
    });
  });

  describe("Q33 = B: a wild in the payment is declared by the player", () => {
    it("Like, totally!, a Cell Phone and a Disguise: asked once; [physical] or [wild] is a third type (8), [energy] or [mental] is two (6)", () => {
      const expected = { energy: 6, mental: 6, physical: 8, wild: 8 } as const;
      for (const type of ["energy", "mental", "physical", "wild"] as const) {
        const s = heroGame();
        const r = cast(s, FINALE, [E, M], { abilities: [like(s)], declare: [[type]] });
        expect(r.declared).toHaveLength(1);
        expect([...r.declared[0]!.options].sort()).toEqual(["0:energy", "0:mental", "0:physical", "0:wild"]);
        expect(damageOf(r.state, villainOf(r.state))).toBe(expected[type]);
      }
    });
    it("two wilds and a Cell Phone: the declarations give 8, 6, 6 and 8", () => {
      const expected: [readonly ResourceType[], number][] = [
        [["mental", "physical"], 8],
        [["mental", "mental"], 6],
        [["wild", "wild"], 6],
        [["wild", "mental"], 8],
        [["energy", "energy"], 4],
      ];
      for (const [declaration, damage] of expected) {
        const s = heroGame();
        const r = cast(s, FINALE, [W, E], { abilities: [like(s)], declare: [declaration] });
        expect(r.declared).toHaveLength(1);
        expect(damageOf(r.state, villainOf(r.state))).toBe(damage);
      }
    });
    it("the declaration given up front as wildAs: nothing asked", () => {
      const s = heroGame();
      const r = cast(s, FINALE, [E, M], { abilities: [like(s)], wildAs: ["physical"] });
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(8);
      const same = cast(s, FINALE, [E, M], { abilities: [like(s)], wildAs: ["energy"] });
      expect(same.declared).toHaveLength(0);
      expect(damageOf(same.state, villainOf(same.state))).toBe(6);
    });
    it("the shortcut: 47010a, 47008c and Like, totally!: four resources, three paid, three types whatever the wild is called: nothing asked, 8", () => {
      const s = heroGame();
      const r = cast(s, FINALE, ["47010a", "47008c"], { abilities: [like(s)] });
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(8);
    });
    it("the shortcut: a cost of 1 (fixture) paid with Like, totally! alone is one type: 4, nothing asked", () => {
      const s = withCost(heroGame(), FINALE, 1);
      const r = cast(s, FINALE, [], { abilities: [like(s)] });
      expect(r.declared).toHaveLength(0);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
    });
    it("the shortcut: three typed cards of three types, no wild: nothing asked", () => {
      const r = cast(heroGame(), FINALE, [E, M, PH]);
      expect(r.declared).toHaveLength(0);
    });
  });

  describe("cost changes", () => {
    it("reduced to 2 (fixture): three cards of three types read two: 6", () => {
      const s = withCost(heroGame(), FINALE, 2);
      const r = cast(s, FINALE, [E, M, PH]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(6);
    });
    it("reduced to 1 (fixture): one type: 4", () => {
      const s = withCost(heroGame(), FINALE, 1);
      const r = cast(s, FINALE, [E, M]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(4);
    });
    it("reduced to 0 (fixture): no type paid, only the first 2 damage; a card paid anyway", () => {
      const s = withCost(heroGame(), FINALE, 0);
      const r = cast(s, FINALE, [E, M, PH]);
      expect(instances(r.events).map(([, n]) => n)).toEqual([2]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(2);
    });
  });

  describe("one attack, several instances of damage", () => {
    it("the instances go to the enemies chosen, the same enemy again included: 2 on a minion, then 2 + 2 + 2 on Rhino", () => {
      const { state, ids } = withEnemies(1);
      const r = cast(state, FINALE, ["47010a", PH], { targets: [[ids[1]!], [ids[0]!], [ids[0]!], [ids[0]!]] });
      expect(instances(r.events)).toEqual([
        [ids[1], 2],
        [ids[0], 2],
        [ids[0], 2],
        [ids[0], 2],
      ]);
      expect(damageOf(r.state, ids[0]!)).toBe(6);
    });
    it("a guard minion must be attacked first; defeating it with one instance makes the villain a valid choice for the next", () => {
      const base = heroGame();
      const g = withMinion(base, P1, "01101");
      const hurt = patchInstance(g.state, g.id, { damage: 1 });
      const r = cast(hurt, FINALE, [E, E, M], { targets: [[g.id], [villainOf(base)], [villainOf(base)]] });
      expect(r.targeted[0]!.options).toEqual([g.id]);
      expect(r.targeted[1]!.options).toContain(villainOf(base));
      expect(r.targeted[1]!.options).not.toContain(g.id);
      expect(instances(r.events)).toEqual([
        [g.id, 2],
        [villainOf(base), 2],
        [villainOf(base), 2],
      ]);
      expect(r.state.players.some((p) => p.playArea.includes(g.id))).toBe(false);
    });
    it("a guard minion that survives the first instance is the only choice for the second as well", () => {
      const base = heroGame();
      const g = withMinion(base, P1, "01101");
      const r = cast(g.state, FINALE, [E, E, E]);
      expect(r.targeted[0]!.options).toEqual([g.id]);
      expect(r.targeted[1]!.options).toEqual([g.id]);
      expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    });
  });

  describe("refusals", () => {
    it("alter-ego form: refused", () => {
      const staged = handOf(alterEgoGame(), P1, FINALE, E, M, PH);
      const [id, a, b, c] = staged.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a, b, c]))).toBe("wrong_form");
    });
    it("cannot afford: two cards for a cost of 3", () => {
      const staged = handOf(heroGame(), P1, FINALE, E, M);
      const [id, a, b] = staged.ids as [InstanceId, InstanceId, InstanceId];
      expect(rejectedWith(staged.state, playCommand(staged.state, id, [a, b]))).toBe("insufficient_resources");
    });
    it("a stunned identity cancels the whole attack: no damage at all", () => {
      const s = heroGame();
      const id = identityOf(s);
      const stunnedHero = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
      const r = cast(stunnedHero, FINALE, [E, M, PH]);
      expect(instances(r.events)).toEqual([]);
      expect(stunned(r.state, identityOf(r.state))).toBe(0);
    });
  });

  describe("two players", () => {
    it("Jubilee as seat 2 pays and declares; the instances go to the villain, a minion engaged with seat 1 and one engaged with her", () => {
      const base = heroGame(TWO);
      const theirs = withMinion(base, P1, "01103");
      const mine = withMinion(theirs.state, P2, "01102");
      const villain = villainOf(base);
      const r = cast(mine.state, FINALE, [E, M], {
        player: P2,
        abilities: [like(mine.state, P2)],
        declare: [["physical"]],
        targets: [[villain], [theirs.id], [mine.id], [villain]],
      });
      expect(r.declared.map((d) => d.player)).toEqual([P2]);
      expect(r.targeted.every((t) => t.player === P2)).toBe(true);
      expect(r.targeted[0]!.options).toEqual(expect.arrayContaining([villain, mine.id, theirs.id]));
      expect(instances(r.events)).toEqual([
        [villain, 2],
        [theirs.id, 2],
        [mine.id, 2],
        [villain, 2],
      ]);
      expect([villain, theirs.id, mine.id].map((id) => damageOf(r.state, id))).toEqual([4, 2, 2]);
    });
  });
});
