import { HERCULES_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
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
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import {
  CORE_SPIDER_MAN,
  HERCULES_DECK,
  HERO_PACK_CARDS,
  WAVE10_DEPS,
  engageMinion,
  heroPackConfig,
  heroPackSeat,
  herculesGame,
} from "../../testing.js";
import {
  HERCULES_OBLIGATION_NEMESIS as REGISTRY,
  HERCULES_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * Hercules's obligation and nemesis set (59035 Appeal to Athena; 59036 Ares, 59037 Lernean Hydra, 59038 Olympic Feud,
 * 59039 Ares's Axe, 59040 God of War), docs/phase7-wave10-hero-packs.md H3.9 and H8.4 line HS13. Hercules is seated
 * with the hand-built Leadership deck (`HERCULES_DECK`) against Core's Rhino (ATK 2, SCH 1). His identity, Gift and
 * Labor cards are not scripted yet: nothing here relies on them, and the one rule of his kit these cards touch (the
 * Gift count Appeal to Athena zeroes) belongs to his own module. The obligation is in the encounter deck; the nemesis
 * set is set aside, so its cards are moved by surgery or staged for a real reveal. Core cards stand in for the rest:
 * Hydra Mercenary 01101 (ATK 1, SCH 0), Shocker 01103 (ATK 2, SCH 1), Advance 01186 (0 boost icons), and the allies
 * Black Cat 01002 (ATK 1, one energy), Shuri 01041 (one physical), Tigra 01051 (one mental), Hellcat 01020 (one wild).
 */
const OBLIGATION = "59035";
const ARES = "59036";
const HYDRA = "59037";
const FEUD = "59038";
const AXE = "59039";
const WAR = "59040";
const REFS = [
  "59035.appeal-to-athena-constant",
  "59035.appeal-to-athena-action",
  "59036.ares-forced-response",
  "59037.lernean-hydra-forced-response",
  "59038.when-revealed",
  "59039.aress-axe-forced-response",
  "59040.god-of-war-constant",
];
const MERC = "01101";
const SHOCKER = "01103";
const ADVANCE = "01186";
const BLACK_CAT = "01002";
const SHURI = "01041";
const TIGRA = "01051";
const HELLCAT = "01020";
const OLYMPUS_SUPPORT = "59012";
const HULK = "01050";

const data = (code: string) => HERCULES_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const piles = (s: GameState) => activeEncounterDeck(s);
const damageOf = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).damage;
const inPlayArea = (s: GameState, id: InstanceId, player: PlayerId = P1): boolean =>
  playerOf(s, player).playArea.includes(id);

/** Hercules (and, with `twoPlayers`, a Core Spider-Man seat as P2) past setup, alter-ego form, full hands. */
function game(opts: { readonly twoPlayers?: boolean | undefined } = {}): GameState {
  if (!opts.twoPlayers) return herculesGame();
  const base = heroPackConfig(HERCULES_DECK);
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: HERO_PACK_CARDS,
  } as never).players[0]!;
  const created = createGame({ ...base, players: [heroPackSeat(HERCULES_DECK), second] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
}

/** The top `n` cards of the encounter deck made into Advance (0 boost icons): a boost card drawn from them is harmless. */
const fillers = (state: GameState, n = 14): GameState =>
  piles(state)
    .deck.slice(0, n)
    .filter((id) => !codeOf(state, id).startsWith("59"))
    .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
const setDeck = (state: GameState, deck: readonly InstanceId[]): GameState => ({
  ...state,
  encounterDecks: { ...state.encounterDecks, [activeEncounterDeckId(state)]: { ...piles(state), deck: [...deck] } },
});
/** The first copy of `code` that is set aside for P1, or else in the encounter deck. */
function copyOf(s: GameState, code: string): InstanceId {
  const aside = playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code);
  const found =
    aside ?? piles(s).deck.find((i) => codeOf(s, i) === code) ?? piles(s).discard.find((i) => codeOf(s, i) === code);
  if (!found) throw new Error(`no ${code}`);
  return found;
}
/**
 * The encounter deck stacked for a villain phase: `boosts` Advance cards first (the villain's boost cards, one for each
 * activation that draws one), then the given cards in the order they are dealt. A set-aside card is taken from the
 * nemesis set; any other is taken from the deck or its discard pile and, if it is a Core card, retagged to `code`.
 */
function stacked(start: GameState, boosts: number, ...codes: readonly string[]): GameState {
  let s = fillers(start);
  const taken: InstanceId[] = [];
  const ids = codes.map((code) => {
    const aside = playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code && !taken.includes(i));
    if (aside) {
      s = {
        ...s,
        players: s.players.map((p) =>
          p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== aside) } : p,
        ),
      };
      taken.push(aside);
      return aside;
    }
    const own = piles(s).deck.find((i) => !taken.includes(i) && codeOf(s, i) === code);
    if (own && code.startsWith("59")) {
      taken.push(own);
      return own;
    }
    const spare = piles(s).deck.find((i) => !taken.includes(i) && codeOf(s, i) === ADVANCE);
    if (!spare) throw new Error(`no spare card for ${code}`);
    s = patchInstance(s, spare, { cardId: cardId(code) });
    taken.push(spare);
    return spare;
  });
  // The pack's own cards that were not asked for (the obligation) go to the bottom, out of reach of every deal.
  const own = (i: InstanceId) => codeOf(s, i).startsWith("59");
  const left = piles(s).deck.filter((i) => !taken.includes(i));
  const boostIds = left.filter((i) => !own(i)).slice(0, boosts);
  const rest = left.filter((i) => !boostIds.includes(i));
  return setDeck(s, [...boostIds, ...ids, ...rest.filter((i) => !own(i)), ...rest.filter(own)]);
}

/** Picks the first option whose label starts with one of `labels`; declines to defend; otherwise the first legal answer. */
const pickByLabel =
  (...labels: readonly string[]): Picker =>
  (s) => {
    if (s.pendingChoice!.prompt.kind === "declareDefender") return ["decline"];
    for (const label of labels) {
      const hit = s.pendingChoice!.options.find((o) => o.label.startsWith(label));
      if (hit) return [hit.optionId];
    }
    // "The player orders the activations" (RRG 1.8 "Activation", p. 6): every enemy, in the order offered.
    if (s.pendingChoice!.prompt.kind === "orderEnemies") return s.pendingChoice!.options.map((o) => o.optionId);
    return firstLegal(s);
  };
/** The villain phase and the next player phase: every player ends the turn. */
const endRound = (s: GameState, pick: Picker = pickByLabel(), ...players: readonly PlayerId[]) =>
  driveEventsPicking(WAVE10_DEPS, s, pick, ...(players.length ? players : [P1]).map((p) => endTurn(p)));
/** The first `codes.length` hand cards of `player` retagged to `codes` (surgery on what the hand holds). */
const handOf = (s: GameState, player: PlayerId, ...codes: readonly string[]): GameState =>
  codes.reduce((acc, code, n) => patchInstance(acc, playerOf(acc, player).hand[n]!, { cardId: cardId(code) }), s);
/** `code` put into the play area of `player`, faceup and ready, taken from the first card of their hand. */
function allyInPlay(start: GameState, code: string, player: PlayerId): { state: GameState; id: InstanceId } {
  const id = playerOf(start, player).hand[0]!;
  const retagged = patchInstance(start, id, { cardId: cardId(code), faceup: true, controllerId: player });
  return {
    id,
    state: {
      ...retagged,
      players: retagged.players.map((p) =>
        p.playerId === player ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
    },
  };
}
/** A set-aside minion of the set engaged with `player`, faceup, as if revealed earlier. */
function engagedNemesis(start: GameState, code: string, player: PlayerId = P1, damage = 0) {
  const id = copyOf(start, code);
  return {
    id,
    state: {
      ...start,
      players: start.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === player ? [...p.playArea, id] : p.playArea,
      })),
      instances: {
        ...start.instances,
        [id]: { ...start.instances[id]!, faceup: true, controllerId: null, engagedWith: player, damage },
      },
    },
  };
}
/** The set-aside Ares's Axe attached to `host`, faceup. */
function axeOn(start: GameState, host: InstanceId) {
  const id = copyOf(start, AXE);
  const s: GameState = {
    ...start,
    players: start.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
  };
  const attached = patchInstance(s, id, { faceup: true, attachedTo: host });
  return { id, state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }) };
}

describe("registry", () => {
  it("registers every printed ref; nothing is skipped", () => {
    const printed = [OBLIGATION, ARES, HYDRA, FEUD, AXE, WAR].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!)).toEqual([]);
  });
  it("timing: a constant marker, an Alter-Ego Action, Forced Responses, and When Reveals", () => {
    expect(REGISTRY["59035.appeal-to-athena-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY["59035.appeal-to-athena-action"]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY["59036.ares-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["59037.lernean-hydra-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["59039.aress-axe-forced-response"]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["59038.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    // The treachery prints no label, so the data names its ability a constant; its text resolves when it is revealed.
    expect(REGISTRY["59040.god-of-war-constant"]!.trigger).toMatchObject({ kind: "whenRevealed" });
  });
});

describe("the printed cards", () => {
  it("Appeal to Athena: an obligation in no encounter set, 2 boost icons, given to the Hercules player", () => {
    expect(data(OBLIGATION)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
    expect(data(OBLIGATION).text.current).toContain("Give to the Hercules player.");
  });
  it("Ares: unique Elite Olympus minion, ATK 3, SCH 0, 5 hit points, retaliate 1, 2 boost icons, nemesis minion", () => {
    expect(data(ARES)).toMatchObject({ type: "minion", unique: true, atk: 3, sch: 0, hp: 5, boostIcons: 2 });
    expect(data(ARES)).toMatchObject({ nemesisMinion: true, keywords: [{ name: "retaliate", value: 1 }] });
    expect(data(ARES).traits).toEqual(["ELITE", "OLYMPUS"]);
    expect(data(ARES).text.current).toContain("(Hercules's nemesis minion.)");
  });
  it("Lernean Hydra: unique Creature minion, ATK 2, SCH 0, 6 hit points, 1 boost icon, not a nemesis minion", () => {
    expect(data(HYDRA)).toMatchObject({ type: "minion", unique: true, atk: 2, sch: 0, hp: 6, boostIcons: 1 });
    expect(data(HYDRA).traits).toEqual(["CREATURE", "HYDRA"]);
    expect(data(HYDRA).nemesisMinion).toBeUndefined();
  });
  it("Olympic Feud: 2 threat flat, a hazard icon, 3 boost icons", () => {
    expect(data(FEUD)).toMatchObject({ type: "side_scheme", startingThreat: { base: 2, perPlayer: 0 }, boostIcons: 3 });
    expect(data(FEUD).icons).toEqual(["hazard"]);
  });
  it("Ares's Axe: +2 ATK, attaches to Ares otherwise the villain, 2 boost icons", () => {
    expect(data(AXE)).toMatchObject({ type: "attachment", statModifiers: { atk: 2 }, boostIcons: 2 });
    expect(data(AXE).attachesTo).toMatchObject({ preferred: { name: "Ares" }, otherwise: { kind: "villain" } });
  });
  it("God of War: a treachery with 3 boost icons", () => {
    expect(data(WAR)).toMatchObject({ type: "treachery", boostIcons: 3 });
  });
  it("setup: the obligation is in the encounter deck once, the five nemesis cards are set aside", () => {
    const s = game();
    expect(piles(s).deck.filter((i) => codeOf(s, i) === OBLIGATION)).toHaveLength(1);
    expect(playerOf(s, P1).setAside.map((i) => codeOf(s, i))).toEqual([ARES, HYDRA, FEUD, AXE, WAR]);
  });
});

describe("59035 Appeal to Athena", () => {
  const ACTION = "59035.appeal-to-athena-action";
  /** Appeal to Athena in the play area of `holder`, as a revealed obligation sits: faceup, controlled by nobody. */
  function held(start: GameState, holder: PlayerId = P1) {
    const id = copyOf(start, OBLIGATION);
    const s: GameState = {
      ...start,
      encounterDecks: {
        ...start.encounterDecks,
        [activeEncounterDeckId(start)]: { ...piles(start), deck: piles(start).deck.filter((i) => i !== id) },
      },
      players: start.players.map((p) => (p.playerId === holder ? { ...p, playArea: [...p.playArea, id] } : p)),
    };
    return { id, state: patchInstance(s, id, { faceup: true, controllerId: null }) };
  }
  const exhaustBranch = { branch: 0 };
  const spendBranch = { branch: 1 };

  it("revealed in the villain phase it goes to the Hercules player's play area and stays there", () => {
    const start = game();
    const id = copyOf(start, OBLIGATION);
    const { state } = endRound(stacked(start, 1, OBLIGATION));
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(inst(state, id).faceup).toBe(true);
    expect(piles(state).discard).not.toContain(id);
    expect(state.removedFromGame).not.toContain(id);
  });

  it("two players: revealed to the other player it is given to the Hercules player, not kept by the revealer", () => {
    const start = game({ twoPlayers: true });
    const id = copyOf(start, OBLIGATION);
    // Rhino's boost card, then P1's own card, then the obligation is P2's.
    const { state } = endRound(stacked(start, 2, ADVANCE, OBLIGATION), pickByLabel(), P1, P2);
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(playerOf(state, P2).playArea).not.toContain(id);
  });

  it("the constant is a marker: it carries no rule of its own (the Gift count is read in Hercules's own module)", () => {
    expect(REGISTRY["59035.appeal-to-athena-constant"]!.effects ?? []).toEqual([]);
  });

  it("Alter-Ego Action, exhausting Hercules: he exhausts and the obligation is removed from the game", () => {
    const h = held(game());
    const { state } = driveEventsPicking(
      WAVE10_DEPS,
      h.state,
      firstLegal,
      use(P1, h.id, ACTION, [], undefined, exhaustBranch),
    );
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
    expect(state.removedFromGame).toContain(h.id);
    expect(inPlayArea(state, h.id)).toBe(false);
    expect(piles(state).discard).not.toContain(h.id);
  });

  it("Alter-Ego Action, spending two mental resources: two hand cards are spent, Hercules stays ready", () => {
    const h = held(handOf(game(), P1, TIGRA, TIGRA));
    const hand = playerOf(h.state, P1).hand;
    const { state } = driveEventsPicking(
      WAVE10_DEPS,
      h.state,
      firstLegal,
      use(P1, h.id, ACTION, [{ fromHand: hand[0]! }, { fromHand: hand[1]! }], undefined, spendBranch),
    );
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(state.removedFromGame).toContain(h.id);
    expect(playerOf(state, P1).hand).toEqual(hand.slice(2));
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining([hand[0]!, hand[1]!]));
  });

  it("one mental resource, or a mental and a physical, is not enough: refused, nothing is spent", () => {
    const h = held(handOf(game(), P1, TIGRA, SHURI));
    const hand = playerOf(h.state, P1).hand;
    const mixed = applyCommand(
      h.state,
      use(P1, h.id, ACTION, [{ fromHand: hand[0]! }, { fromHand: hand[1]! }], undefined, spendBranch),
      WAVE10_DEPS,
    );
    expect(mixed.ok).toBe(false);
    const one = applyCommand(
      h.state,
      use(P1, h.id, ACTION, [{ fromHand: hand[0]! }], undefined, spendBranch),
      WAVE10_DEPS,
    );
    expect(one.ok).toBe(false);
    expect(playerOf(h.state, P1).hand).toEqual(hand);
    expect(inPlayArea(h.state, h.id)).toBe(true);
  });

  it("with Hercules exhausted the exhaust branch cannot be paid; the mental branch still can", () => {
    const h = held(handOf(game(), P1, TIGRA, TIGRA));
    const tired = patchInstance(h.state, identityOf(h.state), { exhausted: true });
    const hand = playerOf(tired, P1).hand;
    expect(applyCommand(tired, use(P1, h.id, ACTION, [], undefined, exhaustBranch), WAVE10_DEPS).ok).toBe(false);
    const { state } = driveEventsPicking(
      WAVE10_DEPS,
      tired,
      firstLegal,
      use(P1, h.id, ACTION, [{ fromHand: hand[0]! }, { fromHand: hand[1]! }], undefined, spendBranch),
    );
    expect(state.removedFromGame).toContain(h.id);
  });

  it("in hero form it is an Alter-Ego Action and cannot be used", () => {
    const h = held(withForm(game(), { heroForm: 0 }));
    expect(applyCommand(h.state, use(P1, h.id, ACTION, [], undefined, exhaustBranch), WAVE10_DEPS).ok).toBe(false);
    expect(inPlayArea(h.state, h.id)).toBe(true);
  });

  it("two players: only the player holding it can use it", () => {
    const h = held(game({ twoPlayers: true }));
    const r = applyCommand(h.state, use(P2, h.id, ACTION, [], undefined, exhaustBranch), WAVE10_DEPS);
    expect(r.ok).toBe(false);
    expect(inst(h.state, identityOf(h.state, P2)).exhausted).toBe(false);
  });
});

describe("59036.ares-forced-response: after Ares schemes, deal yourself 1 facedown encounter card", () => {
  /** Ares engaged with `seat` in alter-ego form, ready to scheme in the villain phase. */
  function table(opts: { readonly seat?: PlayerId; readonly twoPlayers?: boolean } = {}) {
    const start = game({ twoPlayers: opts.twoPlayers });
    const ares = engagedNemesis(start, ARES, opts.seat ?? P1);
    return { ares: ares.id, s: ares.state };
  }
  const minionsEngaged = (s: GameState, player: PlayerId) =>
    Object.values(s.instances)
      .filter((i) => i.engagedWith === player && playerOf(s, player).playArea.includes(i.instanceId))
      .map((i) => i.cardId as string)
      .sort();

  it("alter-ego form: Ares schemes (SCH 0), deals a facedown card, and both it and the normal card are revealed", () => {
    const t = table();
    // Rhino's boost card, then the card Ares deals, then the player's own card for the round.
    const { state, events } = endRound(stacked(t.s, 1, MERC, SHOCKER));
    expect(minionsEngaged(state, P1)).toEqual([ARES, MERC, SHOCKER].sort());
    expect(ofType(events, "abilityResolved").filter((e) => e.abilityId === "59036.ares-forced-response")).toHaveLength(
      1,
    );
  });

  it("control: with Ares absent only the one normal card is revealed", () => {
    const { state } = endRound(stacked(game(), 1, MERC, SHOCKER));
    expect(minionsEngaged(state, P1)).toEqual([MERC]);
  });

  it("hero form: Ares attacks instead, so nothing is dealt", () => {
    const t = table();
    const { state } = endRound(stacked(withForm(t.s, { heroForm: 0 }), 1, MERC, SHOCKER));
    expect(minionsEngaged(state, P1)).toEqual([ARES, MERC].sort());
    expect(damageOf(state)).toBe(2 + 3); // Rhino 2 and Ares 3, undefended
  });

  it("a confused Ares does not scheme, so nothing is dealt and the card is used up", () => {
    const t = table();
    const confused = patchInstance(t.s, t.ares, { statuses: { ...inst(t.s, t.ares).statuses, confused: 1 } });
    const { state } = endRound(stacked(confused, 1, MERC, SHOCKER));
    expect(minionsEngaged(state, P1)).toEqual([ARES, MERC].sort());
    expect(inst(state, t.ares).statuses.confused).toBe(0);
  });

  it("two players, Ares engaged with the other player: the card is dealt to that player, who is 'yourself'", () => {
    const t = table({ seat: P2, twoPlayers: true });
    // Rhino's boost, then Ares's card (MERC, dealt to P2 as Ares's player), then P1's own card, then P2's own.
    const { state } = endRound(stacked(t.s, 2, MERC, ADVANCE, SHOCKER), pickByLabel(), P1, P2);
    expect(minionsEngaged(state, P2)).toEqual([ARES, MERC, SHOCKER].sort());
    expect(minionsEngaged(state, P1)).toEqual([]);
  });
});

describe("59038.when-revealed: Olympic Feud places 1 threat for each Olympus card in play", () => {
  const reveal = (start: GameState, players: readonly PlayerId[] = [P1]) =>
    endRound(stacked(start, players.length, FEUD), pickByLabel(), ...players);
  const sideScheme = (s: GameState) => s.villainArea.find((i) => codeOf(s, i) === FEUD)!;
  /** `code` straight into the play area of `player` (surgery from their hand). */
  const withSupport = (s: GameState, code: string, player: PlayerId = P1) => allyInPlay(s, code, player).state;

  it("with only Hercules in play: 2 starting threat and 1 for him, 3 in all", () => {
    const { state } = reveal(game());
    expect(inst(state, sideScheme(state)).threat).toBe(3);
  });

  it("an Olympus support (Olympus 59012) and Ares both count: 2 + Hercules + support + Ares = 5", () => {
    const start = withSupport(engagedNemesis(game(), ARES).state, OLYMPUS_SUPPORT);
    const { state } = reveal(start);
    expect(inst(state, sideScheme(state)).threat).toBe(5);
  });

  it("an Olympus card in a hand or in a deck is not in play, and a non-Olympus card in play does not count", () => {
    const start = withSupport(game(), BLACK_CAT);
    const { state } = reveal(start);
    expect(inst(state, sideScheme(state)).threat).toBe(3);
  });

  it("two players: the starting threat is fixed (2); another player's Olympus card counts: 2 + Hercules + support = 4", () => {
    const start = withSupport(game({ twoPlayers: true }), OLYMPUS_SUPPORT, P2);
    const { state } = reveal(start, [P1, P2]);
    expect(inst(state, sideScheme(state)).threat).toBe(4);
  });

  it("the side scheme has no traits itself: it is not counted, and nothing is placed on the main scheme", () => {
    const control = endRound(stacked(game(), 1, MERC));
    const { state } = reveal(game());
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(
      inst(control.state, control.state.mainScheme.instanceId).threat,
    );
    expect(sideScheme(state)).toBeDefined();
  });
});

describe("59039.aress-axe-forced-response: after the attached enemy attacks, discard it if no friendly character took damage", () => {
  const forced = (events: readonly GameEvent[]) =>
    ofType(events, "abilityResolved").filter((e) => e.abilityId === "59039.aress-axe-forced-response");
  /** Rhino (ATK 2, +2 from the Axe) attacks Hercules in hero form; the boost card is Advance (0 icons). */
  function onVillain(opts: { readonly tough?: boolean; readonly stunned?: boolean } = {}) {
    let s = withForm(fillers(game()), { heroForm: 0 });
    const axe = axeOn(s, s.activeVillainId!);
    s = axe.state;
    const me = identityOf(s);
    if (opts.tough) s = patchInstance(s, me, { statuses: { ...inst(s, me).statuses, tough: 1 } });
    if (opts.stunned) {
      const v = s.activeVillainId!;
      s = patchInstance(s, v, { statuses: { ...inst(s, v).statuses, stunned: 1 } });
    }
    return { s, axe: axe.id };
  }

  it("Rhino's attack of 4 (2 + 2) damages Hercules: the Axe stays attached", () => {
    const t = onVillain();
    const { state, events } = endRound(t.s);
    expect(damageOf(state)).toBe(4);
    expect(inst(state, t.axe).attachedTo).toBe(state.activeVillainId);
    expect(piles(state).discard).not.toContain(t.axe);
    expect(forced(events)).toHaveLength(1);
  });

  it("the attack deals no damage because a tough status card absorbed it: the Axe is discarded", () => {
    const t = onVillain({ tough: true });
    const { state } = endRound(t.s);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, identityOf(state)).statuses.tough).toBe(0);
    expect(piles(state).discard).toContain(t.axe);
    expect(inst(state, state.activeVillainId!).attachments).not.toContain(t.axe);
  });

  it("an ally who defends and takes damage is a friendly character that took damage: the Axe stays", () => {
    const t = onVillain();
    const ally = allyInPlay(t.s, HULK, P1);
    const defendWithAlly: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [ally.id] : pickByLabel()(s);
    const { state } = endRound(ally.state, defendWithAlly);
    expect(damageOf(state, ally.id)).toBe(4);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, t.axe).attachedTo).toBe(state.activeVillainId);
  });

  it("a stunned Rhino does not attack, so the response is not triggered and the Axe stays", () => {
    const t = onVillain({ stunned: true });
    const { state, events } = endRound(t.s);
    expect(damageOf(state)).toBe(0);
    expect(inst(state, t.axe).attachedTo).toBe(state.activeVillainId);
    expect(forced(events)).toHaveLength(0);
  });

  it("in alter-ego form the villain schemes instead, so the Axe stays", () => {
    const base = fillers(game());
    const axe = axeOn(base, base.activeVillainId!);
    const { state } = endRound(axe.state);
    expect(inst(state, axe.id).attachedTo).toBe(state.activeVillainId);
  });

  it("on Ares, who attacks Hercules for 3 + 2 = 5 while Hercules is protected by a tough status card: discarded", () => {
    let s = withForm(fillers(game()), { heroForm: 0 });
    const ares = engagedNemesis(s, ARES);
    const axe = axeOn(ares.state, ares.id);
    s = axe.state;
    // Rhino is stunned, so Ares's attack is the one the tough card absorbs.
    const v = s.activeVillainId!;
    s = patchInstance(s, v, { statuses: { ...inst(s, v).statuses, stunned: 1 } });
    s = patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: 1 } });
    const { state } = endRound(s);
    expect(damageOf(state)).toBe(0);
    expect(piles(state).discard).toContain(axe.id);
  });

  it("on Ares, undefended: 5 damage and the Axe stays", () => {
    let s = withForm(fillers(game()), { heroForm: 0 });
    const ares = engagedNemesis(s, ARES);
    const axe = axeOn(ares.state, ares.id);
    s = axe.state;
    const v = s.activeVillainId!;
    s = patchInstance(s, v, { statuses: { ...inst(s, v).statuses, stunned: 1 } });
    const { state } = endRound(s);
    expect(damageOf(state)).toBe(5);
    expect(inst(state, axe.id).attachedTo).toBe(ares.id);
  });
});

describe("59039 Ares's Axe: attached where it is revealed (the data's 'Attach to Ares. Otherwise, the villain')", () => {
  it("revealed with Ares in play it attaches to Ares", () => {
    const ares = engagedNemesis(game(), ARES);
    const axe = copyOf(ares.state, AXE);
    const { state } = endRound(stacked(ares.state, 1, AXE));
    expect(inst(state, axe).attachedTo).toBe(ares.id);
    expect(inst(state, ares.id).attachments).toContain(axe);
  });
  it("revealed with Ares not in play it attaches to the villain", () => {
    const start = game();
    const axe = copyOf(start, AXE);
    const { state } = endRound(stacked(start, 1, AXE));
    expect(inst(state, axe).attachedTo).toBe(state.activeVillainId);
  });
});

describe("59040 God of War", () => {
  // Both players are in alter-ego form, so every minion's villain-phase activation is a scheme and the only damage in
  // these rounds is from God of War: "even if that player is in alter-ego form". Rhino schemes too.
  const merc = (s: GameState, player: PlayerId = P1, slot = "merc") => engageMinion(s, MERC, slot, player);
  const shocker = (s: GameState, player: PlayerId = P1, slot = "shocker") => engageMinion(s, SHOCKER, slot, player);
  const warCard = (s: GameState) => copyOf(s, WAR);

  it("every minion attacks the player it is engaged with, an alter-ego player included, and the card is discarded", () => {
    // Hydra Mercenary (ATK 1) is engaged with P1 and Shocker (ATK 2) with P2. Two boost cards for Rhino, then P1 reveals
    // God of War and P2 an Advance (which only makes the villain scheme).
    const start = shocker(merc(game({ twoPlayers: true }), P1), P2);
    const war = warCard(start);
    const { state } = endRound(stacked(start, 2, WAR, ADVANCE), pickByLabel(), P1, P2);
    expect(damageOf(state, identityOf(state, P1))).toBe(1);
    expect(damageOf(state, identityOf(state, P2))).toBe(2);
    expect(piles(state).discard).toContain(war);
  });

  it("two minions engaged with the same player both attack them: 1 + 2 = 3", () => {
    const start = shocker(merc(game()));
    const { state } = endRound(stacked(start, 1, WAR));
    expect(damageOf(state)).toBe(3);
  });

  it("a hero-form player is attacked as well (undefended), and the attack is an ordinary one", () => {
    const start = shocker(withForm(game(), { heroForm: 0 }));
    // Hero form: Shocker already attacks in the villain phase (2) and Rhino attacks (2); God of War adds Shocker's 2.
    const control = endRound(stacked(start, 1, ADVANCE));
    const { state } = endRound(stacked(start, 1, WAR));
    expect(damageOf(control.state)).toBe(4);
    expect(damageOf(state)).toBe(6);
  });

  it("no minion in play: cards are discarded from the top until a minion is discarded, and that minion is revealed", () => {
    const start = stacked(game(), 1, WAR, ADVANCE, SHOCKER, MERC);
    const { state } = endRound(start);
    const found = Object.values(state.instances).find((i) => i.cardId === cardId(SHOCKER) && i.engagedWith === P1);
    // The first minion on the way down (Shocker) is the one revealed; Hydra Mercenary below it is untouched.
    expect(found).toBeDefined();
    expect(inPlayArea(state, found!.instanceId)).toBe(true);
    expect(damageOf(state)).toBe(0);
    // The discard pile is newest first: the treachery went last, the Advance before it; the minion left for play and
    // the one below it (Hydra Mercenary) was never reached.
    expect(
      piles(state)
        .discard.map((i) => codeOf(state, i))
        .slice(0, 2),
    ).toEqual([WAR, ADVANCE]);
    expect(piles(state).deck.filter((i) => codeOf(state, i) === MERC)).toHaveLength(2);
  });

  it("a minion whose attack a stun card replaced did not activate: God of War discards to a minion and reveals it", () => {
    const start = merc(game());
    const stunned = patchInstance(start, "merc" as InstanceId, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const { state } = endRound(stacked(stunned, 1, WAR, SHOCKER));
    expect(inst(state, "merc" as InstanceId).statuses.stunned).toBe(0);
    expect(damageOf(state)).toBe(0);
    const found = Object.values(state.instances).find((i) => i.cardId === cardId(SHOCKER) && i.engagedWith === P1);
    expect(found).toBeDefined();
  });

  it("two players: the revealed minion engages the player who revealed the treachery", () => {
    const { state } = endRound(stacked(game({ twoPlayers: true }), 2, WAR, ADVANCE, SHOCKER), pickByLabel(), P1, P2);
    const found = Object.values(state.instances).find((i) => i.cardId === cardId(SHOCKER) && i.engagedWith);
    expect(found?.engagedWith).toBe(P1);
  });
});

describe("59037.lernean-hydra-forced-response (owner's answer to question 22 = A, provisional)", () => {
  /**
   * Question 22 = A: "a character you control" is read as the player whose character attacked, whoever the Hydra is
   * engaged with. Two players: the Hydra (6 hit points) is engaged with Hercules (P1, hero form) and carries `damage`
   * damage; the other player (P2) has Black Cat (ATK 1) in play and a hand of `hand`. With `p2Turn`, P1 has ended
   * their turn so that P2 can act (players act in turn).
   */
  function table(damage: number, hand: readonly string[] = [SHURI, BLACK_CAT], p2Turn = true) {
    let s = withForm(game({ twoPlayers: true }), { heroForm: 0 }, P1);
    s = withForm(s, { heroForm: 0 }, P2);
    const cat = allyInPlay(s, BLACK_CAT, P2);
    s = handOf(cat.state, P2, ...hand);
    const hydra = engagedNemesis(s, HYDRA, P1, damage);
    s = hydra.state;
    if (p2Turn) s = driveEventsPicking(WAVE10_DEPS, s, firstLegal, endTurn(P1)).state;
    return { s, hydra: hydra.id, cat: cat.id };
  }
  /** The attack and every choice it raises answered by `pick`, recording who was asked each one. */
  function run(s: GameState, attacker: InstanceId, target: InstanceId, player: PlayerId, pick: Picker) {
    const started = applyCommand(
      s,
      { type: "basicAttack", playerId: player, attackerInstanceId: attacker, targetInstanceId: target },
      WAVE10_DEPS,
    );
    if (!started.ok) throw new Error(started.error.message);
    const asked: { player: PlayerId; labels: string[] }[] = [];
    const done = driveStepwise(WAVE10_DEPS, started.state, (st) => {
      asked.push({ player: st.pendingChoice!.playerId, labels: st.pendingChoice!.options.map((o) => o.label) });
      return pick(st);
    });
    return { state: done.state, events: [...started.events, ...done.events], asked };
  }
  const spend = pickByLabel("Spend a [physical]");
  const heal = pickByLabel("Lernean Hydra heals");
  const choiceOf = (r: ReturnType<typeof run>) =>
    r.asked.find((a) => a.labels.some((l) => l.startsWith("Lernean Hydra heals")));

  it("the other player's ally damages it (3 + 1 = 4): that player is asked, and choosing to heal takes it to 2", () => {
    const t = table(3);
    const r = run(t.s, t.cat, t.hydra, P2, heal);
    expect(choiceOf(r)?.player).toBe(P2);
    expect(damageOf(r.state, t.hydra)).toBe(2);
  });

  it("choosing to spend a physical resource instead: the hand card is spent and the Hydra keeps its 4 damage", () => {
    const t = table(3);
    const hand = playerOf(t.s, P2).hand;
    const r = run(t.s, t.cat, t.hydra, P2, spend);
    expect(choiceOf(r)?.player).toBe(P2);
    expect(damageOf(r.state, t.hydra)).toBe(4);
    expect(playerOf(r.state, P2).hand).toHaveLength(hand.length - 1);
    expect(playerOf(r.state, P2).discard).toContain(hand[0]);
    expect(playerOf(r.state, P1).hand).toHaveLength(playerOf(t.s, P1).hand.length);
  });

  it("a wild resource pays for the physical one", () => {
    const t = table(3, [HELLCAT, BLACK_CAT]);
    const hand = playerOf(t.s, P2).hand;
    const r = run(t.s, t.cat, t.hydra, P2, spend);
    expect(damageOf(r.state, t.hydra)).toBe(4);
    expect(playerOf(r.state, P2).discard).toContain(hand[0]);
  });

  it("healing 2 when only 1 damage is there heals the 1: 0 + 1 damage from the attack, healed to 0", () => {
    const t = table(0);
    const r = run(t.s, t.cat, t.hydra, P2, heal);
    expect(damageOf(r.state, t.hydra)).toBe(0);
  });

  // Owner decision 2026-10-20 (A), reversing Q8/Q33: an encounter card's spend option is offered to a player who cannot pay.
  it("a player who cannot spend a physical resource is still offered the spend; choosing it spends nothing and the Hydra does not heal", () => {
    const t0 = table(3);
    // The whole hand is energy and mental cards.
    const noPhysical = handOf(t0.s, P2, ...playerOf(t0.s, P2).hand.map((_, n) => (n % 2 ? TIGRA : BLACK_CAT)));
    const t = { ...t0, s: noPhysical };
    const r = run(t.s, t.cat, t.hydra, P2, firstLegal);
    const offered = choiceOf(r)?.labels ?? [];
    expect(offered.some((l) => l.startsWith("Spend a [physical]"))).toBe(true);
    expect(damageOf(r.state, t.hydra)).toBe(4);
  });

  it("Hercules's own attack (3 damage, engaged with him): he is the one asked", () => {
    const t = table(1, undefined, false);
    const r = run(t.s, identityOf(t.s, P1), t.hydra, P1, heal);
    expect(choiceOf(r)?.player).toBe(P1);
    expect(damageOf(r.state, t.hydra)).toBe(2); // 1 + 3 = 4, healed 2
  });

  it("an attack that deals no damage (a tough status card on the Hydra) triggers nothing", () => {
    const t = table(3);
    const toughened = patchInstance(t.s, t.hydra, { statuses: { ...inst(t.s, t.hydra).statuses, tough: 1 } });
    const r = run(toughened, t.cat, t.hydra, P2, heal);
    expect(choiceOf(r)).toBeUndefined();
    expect(damageOf(r.state, t.hydra)).toBe(3);
    expect(inst(r.state, t.hydra).statuses.tough).toBe(0);
    expect(playerOf(r.state, P2).hand).toHaveLength(playerOf(t.s, P2).hand.length);
  });

  it("an attack that defeats the Hydra (5 + 1 = 6 damage) leaves nothing to heal and asks nothing", () => {
    const t = table(5);
    const r = run(t.s, t.cat, t.hydra, P2, heal);
    expect(choiceOf(r)).toBeUndefined();
    expect(inPlayArea(r.state, t.hydra)).toBe(false);
    expect(piles(r.state).discard).toContain(t.hydra);
  });
});
