import {
  JUBILEE_CARDS,
  MUT_GEN_CARDS,
  WAVE7_CARDS,
  WAVE8_STARTER_DECKS,
  WOLV_CARDS,
  WOLV_STARTER_DECKS,
  cardId,
  type AnyCard,
} from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type Payment,
  type PlayerId,
  type ResourceType,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { action, aScheme, defineAbilities, exhaustThis, exhaustYourHero, thwart, chosen } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  applyOk,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  use,
} from "../../../testing/harness.js";
import { moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../index.js";
import { JUBILEE_SUPPORT_UPGRADES_ALLIES, JUBILEE_SUPPORT_UPGRADES_ALLIES_SKIPPED } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Jubilee's supports, upgrades and allies (47002 Wolverine, 47003 Shopping Spree, 47004 Jubilee's Coat, 47005
 * Jubilee's Sunglasses, 47010a/b/c Plasmoid Energy), docs/phase7-wave8.md section 7.3, 3.62, 3.66, 3.68, 3.69; Q33 = B,
 * Q34 = A, Q36 = A. Real commands in a real game: her starter deck (`jubilee-justice`) against Rhino, with the pool
 * Core and cycle 7 plus the Wolverine and Mutant Genesis packs and her own (the Wolverine hero, the ally Wolverine 32041 and Lay the Trap are earlier waves'
 * cards). Payments are built from real cards by the icons they print: Cell Phone 47019 [energy], Disguise 47013
 * [mental], Waylay 47014 [physical], X-Gene 47020 [wild], Plasmoid Energy 47010a [energy][mental] / b [energy][physical]
 * / c [mental][physical], and the Core Set's Strength 01090 ([physical][physical]). Every answer to a `declareWildTypes`
 * choice is given by the test (an unanswered one throws).
 *
 * Her events that read types (Flash of Light 47008a, cost 2, "3 removed, and with 2 types an enemy confused";
 * Firecracker 47007a, cost 2, "4 damage, and with 2 types a stun") are the events the Coat and the Sunglasses answer.
 * For Justice! 01060 (a THWART event that reads no types) and Haymaker 01087 (an ATTACK event that reads none) are the
 * events for which only the upgrade reads the payment. A cost of 3 or 0 is a fixture (`withCost`, the printed cost
 * changed in this game's pool), as in the events module's test.
 *
 * Disguise 47013 is the unscripted `aspect-basic` module's: where a test needs an alter-ego form's thwart (Q36 = A),
 * a fixture ability is registered under Disguise's own ability id in a copy of the registry (stated at the test).
 */
const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const WOLVERINE = WOLV_STARTER_DECKS.find((d) => d.id === "wolverine-aggression")!;
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...WOLV_CARDS, ...MUT_GEN_CARDS, ...JUBILEE_CARDS];
const DEPS: EngineDeps = { abilities: WAVE8_ABILITIES };

const MALL_RAT = "47001b.mall-rat";
const WOLVERINE_ATTACK = "47002.wolverine-constant";
const WOLVERINE_HEAL = "47002.wolverine-response";
const SPREE_CONSTANT = "47003.shopping-spree-constant";
const SPREE_ACTION = "47003.shopping-spree-action";
const SPREE_DEFEATED = "47003.when-defeated";
const COAT_CONSTANT = "47004.jubilees-coat-constant";
const COAT_RESPONSE = "47004.jubilees-coat-response";
const SHADES_CONSTANT = "47005.jubilees-sunglasses-constant";
const SHADES_RESPONSE = "47005.jubilees-sunglasses-response";
const REFS = [
  WOLVERINE_ATTACK,
  WOLVERINE_HEAL,
  SPREE_CONSTANT,
  SPREE_ACTION,
  SPREE_DEFEATED,
  COAT_CONSTANT,
  COAT_RESPONSE,
  SHADES_CONSTANT,
  SHADES_RESPONSE,
];

const COAT = "47004";
const SHADES = "47005";
const SPREE = "47003";
const FLASH = "47008a";
const FIRECRACKER = "47007a";
const FOR_JUSTICE = "01060";
const HAYMAKER = "01087";
const LAY_THE_TRAP = "41016";
const ALLY_WOLVERINE = "32041";

/** One resource of each kind, by the card that prints exactly that. */
const E = "47019";
const M = "47013";
const PH = "47014";
const W = "47020";
const STRENGTH = "01090";

type SeatKind = "jubilee" | "wolverine" | "spider";
/** Extra cards put into a Jubilee deck so a test can stage them (legality is not required: `requireLegalDecks: false`). */
const JUBILEE_EXTRAS = [STRENGTH, STRENGTH, FOR_JUSTICE, HAYMAKER, LAY_THE_TRAP, ALLY_WOLVERINE, "47010a"] as const;
const expand = (cards: readonly { cardId: unknown; quantity: number }[]) =>
  cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
const seatOf = (kind: SeatKind) => {
  if (kind === "jubilee") {
    return {
      identityCardId: JUBILEE.identityCardId,
      aspects: JUBILEE.aspects,
      deck: [...expand(JUBILEE.cards), ...JUBILEE_EXTRAS.map((c) => cardId(c))],
    };
  }
  if (kind === "wolverine") {
    return { identityCardId: WOLVERINE.identityCardId, aspects: WOLVERINE.aspects, deck: expand(WOLVERINE.cards) };
  }
  return coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
  }).players[0]!;
};

function setupGame(seats: readonly SeatKind[] = ["jubilee"], seed = 1, deps: EngineDeps = DEPS): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const created = createGame(
    { ...config, players: seats.map((s) => seatOf(s) as never), requireLegalDecks: false },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}
/** Jubilee (seat 1) in alter-ego form, as setup leaves her. */
const alterEgoGame = (seats?: readonly SeatKind[], deps?: EngineDeps): GameState => setupGame(seats, 1, deps);
/** Jubilee (seat 1) in hero form. */
const heroGame = (seats?: readonly SeatKind[], deps?: EngineDeps): GameState =>
  withForm(setupGame(seats, 1, deps), { heroForm: 0 }, P1);

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const profile = (s: GameState, id: InstanceId, deps: EngineDeps = DEPS) => characterProfile(s, id, deps)!;
const withMainThreat = (s: GameState, threat: number): GameState => patchInstance(s, mainOf(s), { threat });

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

/** An upgrade of `player` attached to their identity by surgery (no play, no cost), out of the deck. */
function withUpgrade(s: GameState, code: string, player: PlayerId = P1): { state: GameState; id: InstanceId } {
  const staged = moveToHand(s, player, code);
  const id = staged.ids[0]!;
  const removed: GameState = {
    ...staged.state,
    players: staged.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id) } : p,
    ),
  };
  const host = identityOf(removed, player);
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
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

interface Seen {
  readonly kind: string;
  readonly player: PlayerId;
  readonly options: readonly string[];
}
interface Played {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Every prompt the command raised, in order, with the options it offered. */
  readonly seen: readonly Seen[];
  /** The `declareWildTypes` prompts asked. */
  readonly declared: readonly Seen[];
}
interface Answers {
  readonly player?: PlayerId;
  readonly abilities?: readonly Payment[];
  /** The answers to the `declareWildTypes` prompts in order, one type per wild. */
  readonly declare?: readonly (readonly ResourceType[])[];
  /** The answers to the `chooseTarget` prompts in order (each a list of instances); the first options when absent. */
  readonly targets?: readonly (readonly InstanceId[])[];
  /** Ability refs to accept when an optional trigger is offered; every other optional trigger is declined. */
  readonly accept?: readonly string[];
  /** For a search (`chooseCards`): the instance wanted; the first option otherwise. */
  readonly take?: readonly InstanceId[];
}

const playCommand = (card: InstanceId, pay: readonly InstanceId[], o: Answers = {}): Command => ({
  type: "playCard",
  playerId: o.player ?? P1,
  cardInstanceId: card,
  payment: [...(o.abilities ?? []), ...pay.map((fromHand) => ({ fromHand }))],
  attachToInstanceId: null,
});

/** Applies `command` and answers every choice it raises. A `declareWildTypes` prompt with no answer given throws. */
function drive(s: GameState, command: Command, o: Answers = {}, deps: EngineDeps = DEPS): Played {
  const first = applyCommand(s, command, deps);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  const events: GameEvent[] = [...first.events];
  const seen: Seen[] = [];
  const declared: Seen[] = [];
  let targets = 0;
  let declares = 0;
  let state = first.state;
  for (let guard = 0; state.pendingChoice; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = state.pendingChoice;
    const ids = choice.options.map((x) => x.optionId as string);
    const record = { kind: choice.prompt.kind, player: choice.playerId, options: ids };
    seen.push(record);
    let selected: string[];
    if (choice.prompt.kind === "declareWildTypes") {
      const answer = o.declare?.[declares++];
      declared.push(record);
      if (!answer)
        throw new Error(`declareWildTypes was asked and the test gave no answer (options ${ids.join(", ")})`);
      selected = answer.map((type, index) => `${index}:${type}`);
    } else if (choice.prompt.kind === "chooseTarget") {
      const wanted = o.targets?.[targets++];
      selected = wanted ? [...wanted] : ids.slice(0, choice.maxSelections);
    } else if (choice.prompt.kind === "declareDefender") {
      selected = ["decline"];
    } else if (choice.prompt.kind === "chooseCards") {
      const wanted = o.take?.map((i) => i as string).filter((i) => ids.includes(i));
      selected = wanted && wanted.length > 0 ? wanted : ids.slice(0, choice.maxSelections);
    } else {
      const hits = ids.filter((id) => o.accept?.some((ref) => id.endsWith(`:${ref}`)));
      selected = hits.length > 0 ? hits.slice(0, choice.maxSelections) : [...firstLegal(state)];
    }
    const next = applyCommand(
      state,
      { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
      deps,
    );
    if (!next.ok) {
      throw new Error(
        `resolveChoice rejected: ${next.error.code}: ${next.error.message} (${choice.prompt.kind}, options ${ids.join(", ")})`,
      );
    }
    events.push(...next.events);
    state = next.state;
  }
  return { state, events, seen, declared };
}

/** Stages `card` and the payers in a hand (the card first) and plays it with them. */
function cast(
  s: GameState,
  card: string,
  payers: readonly string[],
  o: Answers = {},
): Played & { readonly cardId: InstanceId; readonly start: GameState; readonly payerIds: readonly InstanceId[] } {
  const staged = handOf(s, o.player ?? P1, card, ...payers);
  const [id, ...payerIds] = staged.ids as [InstanceId, ...InstanceId[]];
  const played = drive(staged.state, playCommand(id, payerIds, o), o);
  return { ...played, cardId: id, start: staged.state, payerIds };
}

const rejectedWith = (s: GameState, c: Command, deps: EngineDeps = DEPS): string | null => {
  const r = applyCommand(s, c, deps);
  return r.ok ? null : r.error.code;
};
/** Whether an optional ability was offered in any prompt of the run. */
const offered = (p: Played, ref: string): boolean => p.seen.some((x) => x.options.some((o) => o.endsWith(`:${ref}`)));

/** Shopping Spree put into play by Mall Rat (alter-ego form), the search answered with the first card offered. */
function withSpree(s: GameState): { state: GameState; id: InstanceId } {
  const used = settle(
    applyOk(s, use(P1, identityOf(s, P1), MALL_RAT), DEPS).state,
    (st) => st.pendingChoice!.options.slice(0, 1).map((o) => o.optionId),
    undefined,
    DEPS,
  );
  const id = instancesOf(used, SPREE).find((i) => !playerOf(used, P1).deck.includes(i))!;
  return { state: used, id };
}

describe("Jubilee supports, upgrades and allies registry", () => {
  it("holds exactly the nine refs of 47002 to 47005 and none for Plasmoid Energy, none skipped", () => {
    expect(Object.keys(JUBILEE_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...REFS].sort());
    expect(JUBILEE_SUPPORT_UPGRADES_ALLIES_SKIPPED).toEqual({});
  });
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(JUBILEE_SUPPORT_UPGRADES_ALLIES[ref]!)).toEqual([]);
  });
  it("the printed cards carry exactly those ability ids (Plasmoid Energy none) and their costs and icons", () => {
    const s = heroGame();
    const card = (code: string) =>
      s.cardPool[cardId(code)] as unknown as {
        cost?: number;
        resourceIcons?: Record<string, number>;
        producesIcons?: Record<string, number>;
        abilities: { id: string }[];
        unique: boolean;
      };
    expect(card("47002").abilities.map((a) => a.id)).toEqual([WOLVERINE_ATTACK, WOLVERINE_HEAL]);
    expect(card(SPREE).abilities.map((a) => a.id)).toEqual([SPREE_CONSTANT, SPREE_ACTION, SPREE_DEFEATED]);
    expect(card(COAT).abilities.map((a) => a.id)).toEqual([COAT_CONSTANT, COAT_RESPONSE]);
    expect(card(SHADES).abilities.map((a) => a.id)).toEqual([SHADES_CONSTANT, SHADES_RESPONSE]);
    expect([card("47002").cost, card(SPREE).cost, card(COAT).cost, card(SHADES).cost]).toEqual([4, 0, 2, 2]);
    expect(["47010a", "47010b", "47010c"].map((c) => card(c).abilities)).toEqual([[], [], []]);
    expect(["47010a", "47010b", "47010c"].map((c) => card(c).producesIcons)).toEqual([
      { energy: 1, mental: 1 },
      { energy: 1, physical: 1 },
      { mental: 1, physical: 1 },
    ]);
  });
});

describe("Jubilee's Coat (47004)", () => {
  const armed = (cost?: { code: string; cost: number }) => {
    const base = withMainThreat(heroGame(), 9);
    const priced = cost ? withCost(base, cost.code, cost.cost) : base;
    return withUpgrade(priced, COAT);
  };

  it("constant: Jubilee gets +1 THW in hero form (2 instead of 1) and a basic thwart removes 2", () => {
    const bare = withMainThreat(heroGame(), 9);
    expect(profile(bare, identityOf(bare)).thw).toBe(1);
    const { state } = withUpgrade(bare, COAT);
    expect(profile(state, identityOf(state)).thw).toBe(2);
    const thwarted = settle(
      applyOk(
        state,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(state), schemeInstanceId: mainOf(state) },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(threatOf(thwarted, mainOf(thwarted))).toBe(7);
  });

  it("Flash of Light paid with [energy] and [mental] (2 types): 3 removed, the villain confused, then the Coat removes 2 and exhausts", () => {
    const { state, id } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [E, M], {
      accept: [COAT_RESPONSE],
      targets: [[main], [villainOf(state)], [main]],
    });
    expect(played.declared).toEqual([]);
    expect(offered(played, COAT_RESPONSE)).toBe(true);
    expect(threatOf(played.state, main)).toBe(9 - 3 - 2);
    expect(inst(played.state, villainOf(state)).statuses.confused).toBe(1);
    expect(inst(played.state, id).exhausted).toBe(true);
  });

  it("paid with 1 type ([physical] twice): the Coat removes 1 (3 + 1 removed)", () => {
    const { state } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [PH, PH], { accept: [COAT_RESPONSE], targets: [[main], [main]] });
    expect(threatOf(played.state, main)).toBe(9 - 3 - 1);
    expect(inst(played.state, villainOf(state)).statuses.confused).toBe(0);
  });

  it("paid with 3 types (Flash of Light at a fixture cost of 3, [energy], [mental], [physical]): the Coat removes 3", () => {
    const { state } = armed({ code: FLASH, cost: 3 });
    const main = mainOf(state);
    const played = cast(state, FLASH, [E, M, PH], {
      accept: [COAT_RESPONSE],
      targets: [[main], [villainOf(state)], [main]],
    });
    expect(threatOf(played.state, main)).toBe(9 - 3 - 3);
  });

  it("Q34 = A: a cost of 2 paid with Strength and Plasmoid 47010a (4 resources): the 2 that give the most types are the paid ones, so 2 types", () => {
    const { state } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [STRENGTH, "47010a"], {
      accept: [COAT_RESPONSE],
      targets: [[main], [villainOf(state)], [main]],
    });
    expect(played.declared).toEqual([]);
    expect(threatOf(played.state, main)).toBe(9 - 3 - 2);
    expect(inst(played.state, villainOf(state)).statuses.confused).toBe(1);
  });
  it("Q34 = A: a cost of 2 paid with Strength alone ([physical] twice, overpaid by nothing): 1 type, 1 removed more", () => {
    const { state } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [STRENGTH], { accept: [COAT_RESPONSE], targets: [[main], [main]] });
    expect(threatOf(played.state, main)).toBe(9 - 3 - 1);
  });

  it("declined: the Coat stays ready and nothing more is removed", () => {
    const { state, id } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [E, M], { targets: [[main], [villainOf(state)]] });
    expect(offered(played, COAT_RESPONSE)).toBe(true);
    expect(threatOf(played.state, main)).toBe(6);
    expect(inst(played.state, id).exhausted).toBe(false);
  });

  it("an event of the wrong trait (Firecracker, an ATTACK event, paid with 2 types): the Coat is not offered", () => {
    const { state } = armed();
    const played = cast(state, FIRECRACKER, [E, M], { accept: [COAT_RESPONSE] });
    expect(offered(played, COAT_RESPONSE)).toBe(false);
    expect(damageOf(played.state, villainOf(state))).toBe(4);
  });

  it("not offered at a cost of 0 (no type paid), and nothing is asked", () => {
    const { state } = armed({ code: FLASH, cost: 0 });
    const main = mainOf(state);
    const played = cast(state, FLASH, [W], { accept: [COAT_RESPONSE], targets: [[main], [villainOf(state)]] });
    expect(played.declared).toEqual([]);
    expect(offered(played, COAT_RESPONSE)).toBe(false);
    expect(threatOf(played.state, main)).toBe(9 - 3);
  });

  it("another player's THWART event: not offered to Jubilee's Coat ('After you play')", () => {
    const base = withMainThreat(heroGame(["jubilee", "spider"]), 9);
    const spiderHero = withForm(base, { heroForm: 0 }, P2);
    const { state } = withUpgrade(spiderHero, COAT);
    const played = cast(state, FOR_JUSTICE, [STRENGTH], { player: P2, accept: [COAT_RESPONSE] });
    expect(played.declared).toEqual([]);
    expect(offered(played, COAT_RESPONSE)).toBe(false);
    expect(threatOf(played.state, mainOf(state))).toBe(9 - 3);
  });

  it("a wild is declared when the Coat could respond and never otherwise (For Justice! reads no types itself)", () => {
    const { state, id } = armed();
    const main = mainOf(state);
    // Ready Coat: asked. [energy] and [physical]: 2 types, 4 (For Justice! paid with a wild counts [mental]) + 2.
    const energy = cast(state, FOR_JUSTICE, [W, PH], {
      declare: [["energy"]],
      accept: [COAT_RESPONSE],
      targets: [[main], [main]],
    });
    expect(energy.declared).toHaveLength(1);
    expect(threatOf(energy.state, main)).toBe(9 - 4 - 2);
    const physical = cast(state, FOR_JUSTICE, [W, PH], {
      declare: [["physical"]],
      accept: [COAT_RESPONSE],
      targets: [[main], [main]],
    });
    expect(threatOf(physical.state, main)).toBe(9 - 4 - 1);
    // An exhausted Coat cannot respond: nothing is asked.
    const tired = patchInstance(state, id, { exhausted: true });
    const none = cast(tired, FOR_JUSTICE, [W, PH], { accept: [COAT_RESPONSE], targets: [[main]] });
    expect(none.declared).toEqual([]);
    expect(offered(none, COAT_RESPONSE)).toBe(false);
    expect(threatOf(none.state, main)).toBe(9 - 4);
    // No Coat at all: nothing is asked either.
    const bare = cast(withMainThreat(heroGame(), 9), FOR_JUSTICE, [W, PH], { targets: [[main]] });
    expect(bare.declared).toEqual([]);
  });

  it("an ATTACK event's wild is not asked for by the Coat alone", () => {
    const { state } = armed();
    const played = cast(state, HAYMAKER, [W, PH]);
    expect(played.declared).toEqual([]);
  });

  it("Q33 = B: a wild left a wild is its own type: [physical] and [wild] are 2 types", () => {
    const { state } = armed();
    const main = mainOf(state);
    const played = cast(state, FOR_JUSTICE, [W, PH], {
      declare: [["wild"]],
      accept: [COAT_RESPONSE],
      targets: [[main], [main]],
    });
    expect(threatOf(played.state, main)).toBe(9 - 4 - 2);
  });
});

describe("Jubilee's Sunglasses (47005)", () => {
  const armed = (cost?: { code: string; cost: number }) => {
    const base = heroGame();
    const priced = cost ? withCost(base, cost.code, cost.cost) : base;
    return withUpgrade(priced, SHADES);
  };

  it("constant: Jubilee gets +1 ATK in hero form (2 instead of 1)", () => {
    const bare = heroGame();
    expect(profile(bare, identityOf(bare)).atk).toBe(1);
    const { state } = withUpgrade(bare, SHADES);
    expect(profile(state, identityOf(state)).atk).toBe(2);
  });

  it("Firecracker paid with [energy] and [mental] (2 types): 4 damage and a stun, then the Sunglasses deal 2 and exhaust", () => {
    const { state, id } = armed();
    const rhino = villainOf(state);
    const played = cast(state, FIRECRACKER, [E, M], { accept: [SHADES_RESPONSE] });
    expect(played.declared).toEqual([]);
    expect(offered(played, SHADES_RESPONSE)).toBe(true);
    expect(damageOf(played.state, rhino)).toBe(4 + 2);
    expect(inst(played.state, rhino).statuses.stunned).toBe(1);
    expect(inst(played.state, id).exhausted).toBe(true);
  });

  it("paid with 1 type ([physical] twice): the Sunglasses deal 1 (4 + 1), no stun", () => {
    const { state } = armed();
    const played = cast(state, FIRECRACKER, [PH, PH], { accept: [SHADES_RESPONSE] });
    expect(damageOf(played.state, villainOf(state))).toBe(4 + 1);
    expect(inst(played.state, villainOf(state)).statuses.stunned).toBe(0);
  });

  it("paid with 3 types (Firecracker at a fixture cost of 3): the Sunglasses deal 3 (4 + 3)", () => {
    const { state } = armed({ code: FIRECRACKER, cost: 3 });
    const played = cast(state, FIRECRACKER, [E, M, PH], { accept: [SHADES_RESPONSE] });
    expect(damageOf(played.state, villainOf(state))).toBe(4 + 3);
  });

  it("'choose an enemy': any enemy, not the one the event attacked (2 damage to a minion)", () => {
    const base = armed();
    const { state, id: minion } = withMinion(base.state, P1, "01102");
    const rhino = villainOf(state);
    const played = cast(state, FIRECRACKER, [E, M], {
      accept: [SHADES_RESPONSE],
      targets: [[rhino], [minion]],
    });
    expect(damageOf(played.state, rhino)).toBe(4);
    expect(damageOf(played.state, minion)).toBe(2);
  });

  it("an event of the wrong trait (Flash of Light, a THWART event, paid with 2 types): not offered", () => {
    const { state } = armed();
    const main = mainOf(state);
    const played = cast(state, FLASH, [E, M], { accept: [SHADES_RESPONSE], targets: [[main], [villainOf(state)]] });
    expect(offered(played, SHADES_RESPONSE)).toBe(false);
  });

  it("not offered at a cost of 0 (no type paid), and nothing is asked", () => {
    const { state } = armed({ code: FIRECRACKER, cost: 0 });
    const played = cast(state, FIRECRACKER, [W], { accept: [SHADES_RESPONSE] });
    expect(played.declared).toEqual([]);
    expect(offered(played, SHADES_RESPONSE)).toBe(false);
    expect(damageOf(played.state, villainOf(state))).toBe(4);
  });

  it("another player's ATTACK event: not offered to Jubilee's Sunglasses", () => {
    const spiderHero = withForm(heroGame(["jubilee", "spider"]), { heroForm: 0 }, P2);
    const { state } = withUpgrade(spiderHero, SHADES);
    const played = cast(state, HAYMAKER, [STRENGTH], { player: P2, accept: [SHADES_RESPONSE] });
    expect(played.declared).toEqual([]);
    expect(offered(played, SHADES_RESPONSE)).toBe(false);
  });

  it("a wild is declared only while the Sunglasses could respond (Haymaker reads no types itself)", () => {
    const { state, id } = armed();
    const rhino = villainOf(state);
    const energy = cast(state, HAYMAKER, [W, PH], { declare: [["energy"]], accept: [SHADES_RESPONSE] });
    expect(energy.declared).toHaveLength(1);
    const physical = cast(state, HAYMAKER, [W, PH], { declare: [["physical"]], accept: [SHADES_RESPONSE] });
    const bareDamage = damageOf(cast(heroGame(), HAYMAKER, [W, PH]).state, rhino);
    expect(damageOf(energy.state, rhino) - bareDamage).toBe(2);
    expect(damageOf(physical.state, rhino) - bareDamage).toBe(1);
    const tired = patchInstance(state, id, { exhausted: true });
    const none = cast(tired, HAYMAKER, [W, PH], { accept: [SHADES_RESPONSE] });
    expect(none.declared).toEqual([]);
    expect(offered(none, SHADES_RESPONSE)).toBe(false);
    expect(damageOf(none.state, rhino)).toBe(bareDamage);
  });

  it("a THWART event's wild is not asked for by the Sunglasses alone", () => {
    const { state } = armed();
    const played = cast(withMainThreat(state, 9), FOR_JUSTICE, [W, PH], { targets: [[mainOf(state)]] });
    expect(played.declared).toEqual([]);
  });

  it("the Coat and the Sunglasses together: each reads its own events, the merged readers ask once", () => {
    const base = withMainThreat(heroGame(), 9);
    const both = withUpgrade(withUpgrade(base, COAT).state, SHADES).state;
    const played = cast(both, HAYMAKER, [W, PH], { declare: [["energy"]], accept: [SHADES_RESPONSE, COAT_RESPONSE] });
    expect(played.declared).toHaveLength(1);
    expect(offered(played, COAT_RESPONSE)).toBe(false);
    expect(offered(played, SHADES_RESPONSE)).toBe(true);
  });
});

describe("Plasmoid Energy (47010a/b/c) as resources", () => {
  it.each([
    ["47010a", 2],
    ["47010b", 2],
    ["47010c", 2],
  ])("%s alone pays Flash of Light's cost of 2 with 2 different types: 3 removed and the villain confused", (code) => {
    const base = withMainThreat(heroGame(), 9);
    const main = mainOf(base);
    const played = cast(base, FLASH, [code], { targets: [[main], [villainOf(base)]] });
    expect(played.declared).toEqual([]);
    expect(threatOf(played.state, main)).toBe(6);
    expect(inst(played.state, villainOf(base)).statuses.confused).toBe(1);
    expect(discardCodes(played.state)).toContain(code);
  });
  it("each version pays Firecracker with 2 types (a stun) and is discarded to pay", () => {
    for (const code of ["47010a", "47010b", "47010c"]) {
      const base = heroGame();
      const played = cast(base, FIRECRACKER, [code]);
      expect(damageOf(played.state, villainOf(base))).toBe(4);
      expect(inst(played.state, villainOf(base)).statuses.stunned).toBe(1);
      expect(discardCodes(played.state)).toContain(code);
    }
  });
  it("the three versions are three records of one title", () => {
    const names = ["47010a", "47010b", "47010c"].map(
      (c) => (heroGame().cardPool[cardId(c)] as unknown as { name: string }).name,
    );
    expect(new Set(names)).toEqual(new Set(["Plasmoid Energy"]));
  });
});

describe("Wolverine (47002)", () => {
  /** Wolverine played from the hand for 4 ([energy] x3 and [wild]). */
  const withWolverine = (s: GameState) => {
    const played = cast(s, "47002", [E, E, E, W]);
    return { ...played, id: played.cardId };
  };

  it("played for 4: in play ready, THW 1, ATK 3, 4 hit points", () => {
    const base = heroGame();
    const { state, id } = withWolverine(base);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).exhausted).toBe(false);
    expect(profile(state, id)).toMatchObject({ thw: 1, atk: 3, maxHp: 4 });
    expect(discardCodes(state).filter((c) => c === E)).toHaveLength(3);
  });

  it("his attacks gain piercing: a tough status does not stop his 3 damage, and he takes 2 consequential damage", () => {
    const { state: ready, id } = withWolverine(heroGame());
    const { state: foe, id: minion } = withMinion(ready, P1, "01102");
    const tough = patchInstance(foe, minion, { statuses: { ...inst(foe, minion).statuses, tough: 1 } });
    const after = settle(
      applyOk(tough, { type: "basicAttack", playerId: P1, attackerInstanceId: id, targetInstanceId: minion }, DEPS)
        .state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(damageOf(after, minion)).toBe(3);
    expect(inst(after, minion).statuses.tough).toBe(0);
    expect(damageOf(after, id)).toBe(2);
  });

  it("Jubilee's own attack does not gain piercing: the tough status absorbs it", () => {
    const { state: foe, id: minion } = withMinion(heroGame(), P1, "01102");
    const tough = patchInstance(foe, minion, { statuses: { ...inst(foe, minion).statuses, tough: 1 } });
    const after = settle(
      applyOk(
        tough,
        { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(tough), targetInstanceId: minion },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(damageOf(after, minion)).toBe(0);
  });

  it("his thwart removes 1 threat and he takes 1 consequential damage", () => {
    const { state: ready, id } = withWolverine(withMainThreat(heroGame(), 5));
    const after = settle(
      applyOk(
        ready,
        { type: "basicThwart", playerId: P1, thwarterInstanceId: id, schemeInstanceId: mainOf(ready) },
        DEPS,
      ).state,
      firstLegal,
      undefined,
      DEPS,
    );
    expect(threatOf(after, mainOf(after))).toBe(4);
    expect(damageOf(after, id)).toBe(1);
  });

  describe("Response: after you change to alter-ego form, heal 3 damage from him", () => {
    const changed = (damage: number, accept: boolean) => {
      const { state: ready, id } = withWolverine(heroGame());
      const hurt = patchInstance(ready, id, { damage });
      const played = drive(hurt, { type: "changeForm", playerId: P1 }, { accept: accept ? [WOLVERINE_HEAL] : [] });
      return { ...played, id };
    };
    it("3 damage: healed to 0", () => {
      const r = changed(3, true);
      expect(offered(r, WOLVERINE_HEAL)).toBe(true);
      expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
      expect(damageOf(r.state, r.id)).toBe(0);
    });
    it("1 damage: heals only what is there (0)", () => {
      const r = changed(1, true);
      expect(damageOf(r.state, r.id)).toBe(0);
    });
    it("declined: the damage stays", () => {
      const r = changed(3, false);
      expect(offered(r, WOLVERINE_HEAL)).toBe(true);
      expect(damageOf(r.state, r.id)).toBe(3);
    });
    it("a change to hero form does not offer it", () => {
      const { state: ready, id } = withWolverine(heroGame());
      const hurt = patchInstance(withForm(ready, "alterEgo"), id, { damage: 3 });
      const r = drive(hurt, { type: "changeForm", playerId: P1 }, { accept: [WOLVERINE_HEAL] });
      expect(playerOf(r.state, P1).identity.form).toBe("hero");
      expect(offered(r, WOLVERINE_HEAL)).toBe(false);
      expect(damageOf(r.state, id)).toBe(3);
    });
  });

  describe("the unique rule across packs (section 3.68)", () => {
    it("beside the Wolverine hero (the Wolverine pack's 35001a/b, alter-ego title Wolverine / Logan) it cannot be played", () => {
      const base = setupGame(["jubilee", "wolverine"]);
      const staged = handOf(withForm(base, { heroForm: 0 }, P1), P1, "47002", E, E, E, W);
      const [id, ...pay] = staged.ids as [InstanceId, ...InstanceId[]];
      expect(rejectedWith(staged.state, playCommand(id, pay))).toBe("duplicate_unique_card");
    });
    it("beside the Wolverine hero it still pays as a resource (For Justice! paid with 47002 and [physical])", () => {
      const base = setupGame(["jubilee", "wolverine"]);
      const played = cast(withForm(base, { heroForm: 0 }, P1), FOR_JUSTICE, ["47002", PH], {
        targets: [[mainOf(base)]],
      });
      expect(discardCodes(played.state)).toContain("47002");
    });
    it("beside another Wolverine ally (32041, the Aggression Wolverine) it cannot be played", () => {
      const base = heroGame();
      const staged = moveToHand(base, P1, ALLY_WOLVERINE);
      const ally = staged.ids[0]!;
      const inPlay: GameState = {
        ...patchInstance(staged.state, ally, { faceup: true, exhausted: false, damage: 0 }),
        players: staged.state.players.map((p) =>
          p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== ally), playArea: [...p.playArea, ally] } : p,
        ),
      };
      const hand = handOf(inPlay, P1, "47002", E, E, E, W);
      const [id, ...pay] = hand.ids as [InstanceId, ...InstanceId[]];
      expect(rejectedWith(hand.state, playCommand(id, pay))).toBe("duplicate_unique_card");
    });
    it("alone, nothing beside it: it can be played (control)", () => {
      const base = heroGame();
      const hand = handOf(base, P1, "47002", E, E, E, W);
      const [id, ...pay] = hand.ids as [InstanceId, ...InstanceId[]];
      expect(rejectedWith(hand.state, playCommand(id, pay))).toBeNull();
    });
  });
});

describe("Shopping Spree (47003)", () => {
  /** Disguise (Action (thwart): exhaust Disguise and your identity -> remove 2 threat from a scheme) is the unscripted aspect-basic module's: a fixture under its own ability id. */
  const DISGUISE = "47013.disguise-action";
  const FIXTURE_DEPS: EngineDeps = {
    abilities: {
      ...WAVE8_ABILITIES,
      ...defineAbilities({
        [DISGUISE]: action(
          { label: "thwart", cost: [exhaustThis, exhaustYourHero] },
          aScheme("scheme"),
          thwart(2, chosen("scheme")),
        ),
      }),
    },
  };

  it("Mall Rat puts it into play: 2 threat in the villain area, under Jubilee's control, the deck shuffled", () => {
    const base = alterEgoGame();
    const { state, id } = withSpree(base);
    expect(state.villainArea).toContain(id);
    expect(threatOf(state, id)).toBe(2);
  });

  it("two players: still 2 threat (not per hero)", () => {
    const { state, id } = withSpree(alterEgoGame(["jubilee", "spider"]));
    expect(threatOf(state, id)).toBe(2);
  });

  it("played from the hand in hero form for 0: in play with 2 threat", () => {
    const base = heroGame();
    const played = cast(base, SPREE, []);
    expect(played.state.villainArea).toContain(played.cardId);
    expect(threatOf(played.state, played.cardId)).toBe(2);
  });

  describe("threat cannot be removed by heroes or allies", () => {
    const hero = () => {
      const { state, id } = withSpree(alterEgoGame());
      return { state: withMainThreat(withForm(state, { heroForm: 0 }, P1), 5), id };
    };
    it("a hero's basic thwart is refused", () => {
      const { state, id } = hero();
      const thwartOf = (scheme: InstanceId): Command => ({
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: scheme,
      });
      expect(rejectedWith(state, thwartOf(id))).toBe("no_valid_target");
      // Control: the same thwart against the main scheme is legal.
      expect(rejectedWith(state, thwartOf(mainOf(state)))).toBeNull();
    });
    it("an ally's basic thwart (Wolverine 47002) is refused", () => {
      const { state, id } = hero();
      const wolverine = cast(state, "47002", [E, E, E, W]);
      const thwartOf = (scheme: InstanceId): Command => ({
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: wolverine.cardId,
        schemeInstanceId: scheme,
      });
      expect(rejectedWith(wolverine.state, thwartOf(id))).toBe("no_valid_target");
      expect(rejectedWith(wolverine.state, thwartOf(mainOf(wolverine.state)))).toBeNull();
    });
    it("Flash of Light played in hero form: the scheme is not offered as a target, the main scheme is", () => {
      const { state, id } = hero();
      const played = cast(withMainThreat(state, 9), FLASH, [E, M]);
      const targets = played.seen.find((x) => x.kind === "chooseTarget")!;
      expect(targets.options).not.toContain(id);
      expect(targets.options).toContain(mainOf(state));
      expect(threatOf(played.state, id)).toBe(2);
    });
    it("Jubilee's Coat's Response: the scheme is not offered either", () => {
      const { state, id } = hero();
      const armed = withUpgrade(withMainThreat(state, 9), COAT).state;
      const played = cast(armed, FLASH, [E, M], { accept: [COAT_RESPONSE] });
      const choices = played.seen.filter((x) => x.kind === "chooseTarget");
      expect(choices.length).toBeGreaterThanOrEqual(2);
      for (const c of choices) expect(c.options).not.toContain(id);
      expect(threatOf(played.state, id)).toBe(2);
    });
  });

  describe("Alter-Ego Action: exhaust your identity, remove 1 threat; any player may trigger it", () => {
    it("Jubilee exhausts: 2 to 1; a second use while exhausted is refused", () => {
      const { state, id } = withSpree(alterEgoGame());
      const used = settle(applyOk(state, use(P1, id, SPREE_ACTION), DEPS).state, firstLegal, undefined, DEPS);
      expect(threatOf(used, id)).toBe(1);
      expect(inst(used, identityOf(used)).exhausted).toBe(true);
      expect(rejectedWith(used, use(P1, id, SPREE_ACTION))).toBe("already_exhausted");
    });
    it("in hero form the Action is not there to use", () => {
      const { state, id } = withSpree(alterEgoGame());
      const hero = withForm(state, { heroForm: 0 }, P1);
      expect(rejectedWith(hero, use(P1, id, SPREE_ACTION))).toBe("wrong_form");
    });
    it("player 2 in alter-ego form uses it on Jubilee's scheme; the last threat is theirs: they search their own deck for an ITEM", () => {
      const first = withSpree(alterEgoGame(["jubilee", "spider"]));
      const spider = identityOf(first.state, P2);
      expect(playerOf(first.state, P2).identity.form).toBe("alterEgo");
      const one = settle(
        applyOk(first.state, use(P1, first.id, SPREE_ACTION), DEPS).state,
        firstLegal,
        undefined,
        DEPS,
      );
      expect(threatOf(one, first.id)).toBe(1);
      const used = applyOk(one, use(P2, first.id, SPREE_ACTION), DEPS).state;
      expect(inst(used, spider).exhausted).toBe(true);
      expect(used.pendingChoice?.playerId).toBe(P2);
      expect(used.pendingChoice?.prompt.kind).toBe("chooseCards");
      const options = used.pendingChoice!.options.map((o) => o.optionId as string);
      expect(options.length).toBeGreaterThan(0);
      for (const o of options) {
        const card = used.cardPool[used.instances[o as InstanceId]!.cardId] as unknown as { traits: string[] };
        expect(card.traits).toContain("ITEM");
        expect(playerOf(used, P2).deck.concat(playerOf(used, P2).discard)).toContain(o);
      }
    });
  });

  describe("When Defeated: the player who defeated it searches their deck and discard pile for an ITEM and puts it into play", () => {
    const defeated = () => {
      const { state, id } = withSpree(alterEgoGame());
      const moved = moveToDiscard(state, P1, COAT);
      const low = patchInstance(moved.state, id, { threat: 1 });
      return { state: low, id, coat: moved.id };
    };
    it("the last threat removed by the Action: Jubilee takes Jubilee's Coat from her discard pile for nothing", () => {
      const { state, id, coat } = defeated();
      const handBefore = playerOf(state, P1).hand.length;
      const run = drive(state, use(P1, id, SPREE_ACTION), { take: [coat] });
      const search = run.seen.find((x) => x.kind === "chooseCards")!;
      expect(search.player).toBe(P1);
      expect(search.options).toContain(coat);
      expect(inst(run.state, coat).attachedTo).toBe(identityOf(run.state));
      expect(inst(run.state, identityOf(run.state)).attachments).toContain(coat);
      expect(playerOf(run.state, P1).hand).toHaveLength(handBefore);
      expect(run.state.villainArea).not.toContain(id);
      expect(run.state.victoryDisplay).not.toContain(id);
      expect(playerOf(run.state, P1).discard).toContain(id);
      expect(run.events.some((e) => e.type === "deckShuffled")).toBe(true);
    });
    it("only an ITEM is offered (Jubilee's Coat and Sunglasses, not an event or ally)", () => {
      const { state, id } = defeated();
      const run = drive(state, use(P1, id, SPREE_ACTION));
      const search = run.seen.find((x) => x.kind === "chooseCards")!;
      const codes = search.options.map((o) => codeOf(state, o as InstanceId));
      expect(codes).toContain(COAT);
      expect(codes).toContain(SHADES);
      for (const c of codes) {
        const card = state.cardPool[cardId(c)] as unknown as { traits: string[] };
        expect(card.traits).toContain("ITEM");
      }
    });
    it("Shopping Spree is not in the victory display: it goes to its owner's discard pile (No Victory)", () => {
      const { state, id } = defeated();
      const run = drive(state, use(P1, id, SPREE_ACTION));
      expect(run.state.victoryDisplay).not.toContain(id);
      expect(discardCodes(run.state)).toContain(SPREE);
    });
  });

  describe("an alter-ego's thwart works (Q36 = A: only heroes and allies are barred)", () => {
    it("Disguise (fixture) in alter-ego form, Jubilee's identity exhausted with it: removes 2 and defeats it; she takes Jubilee's Coat", () => {
      const base = withSpree(alterEgoGame(undefined, FIXTURE_DEPS));
      const moved = moveToDiscard(base.state, P1, COAT);
      const coat = moved.id;
      const staged = moveToHand(moved.state, P1, "47013");
      const disguise = staged.ids[0]!;
      const inPlay: GameState = {
        ...patchInstance(staged.state, disguise, { faceup: true, exhausted: false }),
        players: staged.state.players.map((p) =>
          p.playerId === P1
            ? { ...p, hand: p.hand.filter((i) => i !== disguise), playArea: [...p.playArea, disguise] }
            : p,
        ),
      };
      const run = drive(inPlay, use(P1, disguise, DISGUISE), { targets: [[base.id]], take: [coat] }, FIXTURE_DEPS);
      const choice = run.seen.find((x) => x.kind === "chooseTarget");
      expect(choice?.options).toContain(base.id);
      expect(threatOf(run.state, base.id)).toBe(0);
      expect(playerOf(run.state, P1).discard).toContain(base.id);
      expect(inst(run.state, coat).attachedTo).toBe(identityOf(run.state));
    });
    it("the same fixture ability in hero form: the scheme is not offered", () => {
      const base = withSpree(alterEgoGame(undefined, FIXTURE_DEPS));
      const hero = withForm(base.state, { heroForm: 0 }, P1);
      const staged = moveToHand(hero, P1, "47013");
      const disguise = staged.ids[0]!;
      const inPlay: GameState = {
        ...patchInstance(staged.state, disguise, { faceup: true, exhausted: false }),
        players: staged.state.players.map((p) =>
          p.playerId === P1
            ? { ...p, hand: p.hand.filter((i) => i !== disguise), playArea: [...p.playArea, disguise] }
            : p,
        ),
      };
      const run = drive(inPlay, use(P1, disguise, DISGUISE), {}, FIXTURE_DEPS);
      for (const c of run.seen.filter((x) => x.kind === "chooseTarget")) expect(c.options).not.toContain(base.id);
      expect(threatOf(run.state, base.id)).toBe(2);
    });
  });

  describe("the player side scheme limit", () => {
    it("Lay the Trap in play, Mall Rat brings a second one: the first player discards one of the two, undefeated", () => {
      const base = alterEgoGame();
      const trapPlayed = cast(
        withForm(base, { heroForm: 0 }, P1),
        LAY_THE_TRAP,
        [E, E, E, W].slice(0, (base.cardPool[cardId(LAY_THE_TRAP)] as unknown as { cost: number }).cost),
      );
      const trap = trapPlayed.cardId;
      expect(trapPlayed.state.villainArea).toContain(trap);
      const alter = withForm(trapPlayed.state, "alterEgo", P1);
      const rat = drive(alter, use(P1, identityOf(alter, P1), MALL_RAT), { take: [] });
      const limit = rat.seen.find((x) => x.kind === "discardOverPlayerSideSchemeLimit");
      expect(limit?.player).toBe(P1);
      expect(limit?.options).toHaveLength(2);
      expect(limit?.options).toContain(trap);
      const spree = instancesOf(rat.state, SPREE)[0]!;
      expect(rat.state.villainArea).toContain(spree);
      expect(rat.state.villainArea).not.toContain(trap);
      expect(rat.state.victoryDisplay).not.toContain(trap);
      expect(playerOf(rat.state, P1).discard).toContain(trap);
    });
  });
});
