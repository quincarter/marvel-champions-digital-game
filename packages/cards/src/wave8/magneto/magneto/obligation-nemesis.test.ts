import { cardId, CORE_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { MAGNETO_IDENTITY } from "./identity.js";
import {
  MAGNETO_OBLIGATION_NEMESIS,
  MAGNETO_OBLIGATION_NEMESIS_DRAFTS,
  MAGNETO_OBLIGATION_NEMESIS_SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Magneto's obligation and nemesis set (49027 Old Grievances; 49028 Exodus, 49029 Martyr for Mutants, 49030 Fabian Cortez,
 * 49031 Frenzy, 49032 Angry Acolyte), docs/phase7-wave8.md section 7.5, 3.71, 3.80, 3.81. His real starter deck
 * (`magneto-leadership`) against Rhino (Core, standard). Magneto: ATK 2, DEF 2, 10 hit points, hand size 5. A minion is
 * engaged by relabeling a Hydra Mercenary (01101); a card that must be revealed or drawn as a boost card is a relabeled
 * card on top of the encounter deck (Advance 01186 is the filler: a boost card with no icons, a reveal that only
 * schemes). Printed icons used: Squared Off 49017 physical, Noble Sacrifice 49018 mental, Metal Shards 49009 MAGNETIC
 * physical.
 */
const OLD_GRIEVANCES = "49027";
const EXODUS = "49028";
const MARTYR = "49029";
const FABIAN = "49030";
const FRENZY = "49031";
const ACOLYTE_TREACHERY = "49032";
const MERCENARY = "01101";
const ADVANCE = "01186";
const SQUARED_OFF = "49017";
const NOBLE = "49018";
const SHARDS = "49009";
const PULL = "49001a.magnetic-pull";
const GRIEVANCE_ACTION = "49027.old-grievances-action";

const REFS = [
  "49027.obligation",
  "49027.old-grievances-forced-response",
  GRIEVANCE_ACTION,
  "49029.when-defeated",
  "49030.when-defeated",
  "49030.boost",
  "49031.frenzy-forced-response",
  "49031.boost",
  "49032.when-revealed",
];
const EXODUS_REF = "49028.exodus-forced-response";

const MAGNETO = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const SEAT = {
  identityCardId: MAGNETO.identityCardId,
  aspects: MAGNETO.aspects,
  deck: MAGNETO.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const BASE = mergeRegistries(WAVE7_ABILITIES, MAGNETO_IDENTITY, MAGNETO_OBLIGATION_NEMESIS);
const DEPS: EngineDeps = { abilities: BASE };
const DRAFT_DEPS: EngineDeps = { abilities: mergeRegistries(BASE, MAGNETO_OBLIGATION_NEMESIS_DRAFTS) };
const dataOf = (code: string) =>
  WAVE8_CARDS.find((c) => (c.id as string) === code) as never as Record<string, unknown> & {
    abilities: { id: string }[];
  };

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState): string[] => codes(s, playerOf(s, P1).hand);
const discardOf = (s: GameState): string[] => codes(s, playerOf(s, P1).discard);
const deckOf = (s: GameState): string[] => codes(s, playerOf(s, P1).deck);
const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;
const encounterDiscard = (s: GameState): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => codes(s, d.discard));

function setupGame(deps: EngineDeps = DEPS): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE8_CARDS],
  } as never);
  const created = createGame({ ...config, players: [SEAT] }, deps);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
  // Headroom on the main scheme (a negative count, surgery): a villain phase schemes and accelerates.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
const heroGame = (deps?: EngineDeps): GameState => withForm(setupGame(deps), { heroForm: 0 });
const egoGame = (): GameState => withForm(setupGame(), "alterEgo");

/** Takes a copy of each code from the deck, the discard pile or (last) the hand, refilling the hand from the rest. */
function take(state: GameState, wanted: readonly string[]) {
  const owner = playerOf(state, P1);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find(
      (c) => codeOf(state, c) === code && !used.includes(c),
    );
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !used.includes(id));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return { used, rest: rest.slice(0, rest.length - takenFromHand), hand: [...strip(owner.hand), ...refill] };
}
const patchPlayer = (state: GameState, change: Partial<ReturnType<typeof playerOf>>): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === P1 ? { ...p, ...change } : p)),
});
/** The top of the deck, in order, above the rest; the discard pile is emptied into the deck's bottom. */
function stackDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const { used, rest, hand } = take(state, wanted);
  return patchPlayer(state, { deck: [...used, ...rest], discard: [], hand });
}
/** Exactly this deck, top first; the discard pile is emptied and the rest set aside out of the way. */
function setDeck(state: GameState, ...wanted: readonly string[]): GameState {
  const { used, hand } = take(state, wanted);
  return patchPlayer(state, { deck: used, discard: [], hand });
}
/** The obligation card taken out of the encounter deck and put into the player's play area. */
function withGrievances(state: GameState): { state: GameState; id: InstanceId } {
  const id = instancesOf(state, OLD_GRIEVANCES)[0]!;
  const without = <T>(list: readonly T[]) => list.filter((i) => (i as unknown) !== id);
  const stripped: GameState = {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([k, d]) => [k, { deck: without(d.deck), discard: without(d.discard) }]),
    ),
    players: state.players.map((p) => ({
      ...p,
      setAside: without(p.setAside),
      dealtEncounter: without(p.dealtEncounter),
    })),
  };
  const placed: GameState = {
    ...stripped,
    players: stripped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
  };
  return { state: patchInstance(placed, id, { faceup: true }), id };
}
/** Relabels the first cards of the active encounter deck as `codes`, in order. */
function stageTop(state: GameState, ...wanted: readonly string[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const deck = state.encounterDecks[deckId]!.deck;
  return wanted.reduce<GameState>(
    (s, code, n) => patchInstance(s, deck[n]!, { cardId: cardId(code), faceup: false }),
    state,
  );
}
/** Engages a minion with Magneto: a Hydra Mercenary, relabeled `code`. */
function withMinion(state: GameState, code: string): { state: GameState; minion: InstanceId } {
  const { state: engaged, id } = engageMinion(state, MERCENARY, P1);
  return { state: patchInstance(engaged, id, { cardId: cardId(code) }), minion: id };
}
/** A villain phase: Magneto ends his turn. Returns the state and every event. */
const villainPhase = (state: GameState, pick: Picker = firstLegal) =>
  driveEventsPicking(DEPS, state, pick, endTurn(P1));
const pull = (s: GameState) => use(P1, identityOf(s), PULL);
const dealtDiscards = (before: GameState, after: GameState): number =>
  discardOf(after).length - discardOf(before).length;
/**
 * Cards the end of Magneto's turn and the villain phase discard from his deck with nothing of this set in play (the
 * hand is refilled and trimmed): subtracted from every count below so a test reads what the card did.
 */
const BASELINE = dealtDiscardsOf(() => {
  const s0 = stageTop(heroGame(), ADVANCE, ADVANCE, ADVANCE);
  return [s0, villainPhase(s0).state];
});
function dealtDiscardsOf(run: () => [GameState, GameState]): number {
  const [before, after] = run();
  return discardOf(after).length - discardOf(before).length;
}
const extraDiscards = (before: GameState, after: GameState): number => dealtDiscards(before, after) - BASELINE;
const events = (list: readonly GameEvent[], type: GameEvent["type"]) => list.filter((e) => e.type === type);

describe("registry and data", () => {
  it.each(REFS)("%s validates", (ref) => {
    expect(validateDefinition(MAGNETO_OBLIGATION_NEMESIS[ref]!)).toEqual([]);
  });
  it("registers the nine refs it can; Exodus's Forced Response is skipped with a reason and held as a draft", () => {
    expect(Object.keys(MAGNETO_OBLIGATION_NEMESIS).sort()).toEqual([...REFS].sort());
    expect(Object.keys(MAGNETO_OBLIGATION_NEMESIS_SKIPPED)).toEqual([EXODUS_REF]);
    expect(Object.keys(MAGNETO_OBLIGATION_NEMESIS_DRAFTS)).toEqual([EXODUS_REF]);
    const named = [OLD_GRIEVANCES, EXODUS, MARTYR, FABIAN, FRENZY, ACOLYTE_TREACHERY].flatMap((c) =>
      dataOf(c).abilities.map((a) => a.id),
    );
    expect(named.sort()).toEqual([...REFS, EXODUS_REF].sort());
  });
  it("printed data: keywords, stats and the nemesis flag the abilities rely on", () => {
    const d = (c: string) => dataOf(c) as never as Record<string, any>;
    expect(d(EXODUS).keywords.map((k: { name: string }) => k.name)).toEqual(["steady", "toughness", "villainous"]);
    expect([d(EXODUS).atk, d(EXODUS).sch, d(EXODUS).hp, d(EXODUS).nemesisMinion]).toEqual([2, 2, 6, true]);
    expect(d(FABIAN).keywords.map((k: { name: string }) => k.name)).toEqual(["guard"]);
    expect([d(FABIAN).atk, d(FABIAN).sch, d(FABIAN).hp]).toEqual([2, 2, 4]);
    expect(d(FRENZY).keywords.map((k: { name: string }) => k.name)).toEqual(["quickstrike"]);
    expect([d(FRENZY).atk, d(FRENZY).sch, d(FRENZY).hp]).toEqual([2, 2, 4]);
    expect(d(MARTYR).startingThreat).toEqual({ base: 0, perPlayer: 3 });
    expect(d(MARTYR).amplifyIcons).toBe(1);
    expect(d(ACOLYTE_TREACHERY).type).toBe("treachery");
  });
});

describe("Old Grievances (49027): after you use Magnetic Pull, take 1 damage for each card discarded by it", () => {
  const pulled = (s: GameState, top: readonly string[]) => {
    const { state, id } = withGrievances(stackDeck(heroGame(), ...top));
    return { state, id, after: driveEventsPicking(DEPS, state, firstLegal, pull(state)) };
  };

  it("sits in the play area and is not discarded by being played (no When Revealed)", () => {
    const { state, id } = withGrievances(heroGame());
    expect(playerOf(state, P1).playArea).toContain(id);
  });
  it("Squared Off, Noble Sacrifice, Metal Shards: three cards discarded (the found one counts, Q42 = A): 3 damage, 0 to 3", () => {
    const { state, after } = pulled(heroGame(), [SQUARED_OFF, NOBLE, SHARDS]);
    expect(damageOf(state)).toBe(0);
    expect(damageOf(after.state)).toBe(3);
    expect(handOf(after.state)).toContain(SHARDS);
    expect(discardOf(after.state)).toEqual(expect.arrayContaining([SQUARED_OFF, NOBLE]));
  });
  it("the card found at once: 1 damage", () => {
    const { after } = pulled(heroGame(), [SHARDS, NOBLE]);
    expect(damageOf(after.state)).toBe(1);
  });
  it("Q41 = A: no MAGNETIC card in a deck of four: four discarded, nothing added to hand, 4 damage, the use is spent", () => {
    const s0 = withGrievances(setDeck(heroGame(), SQUARED_OFF, NOBLE, NOBLE, SQUARED_OFF)).state;
    const handBefore = handOf(s0);
    const result = driveEventsPicking(DEPS, s0, firstLegal, pull(s0));
    expect(damageOf(result.state)).toBe(4);
    expect(handOf(result.state)).toEqual(handBefore);
    expect(applyCommand(result.state, pull(result.state), DEPS).ok).toBe(false);
  });
  it("it is one instance of damage: a tough status card stops all of it and is spent", () => {
    const { state } = withGrievances(stackDeck(heroGame(), SQUARED_OFF, NOBLE, SHARDS));
    const toughened = patchInstance(state, identityOf(state), { statuses: { tough: 1 } as never });
    const result = driveEventsPicking(DEPS, toughened, firstLegal, pull(toughened));
    expect(damageOf(result.state)).toBe(0);
    expect(inst(result.state, identityOf(result.state)).statuses.tough ?? 0).toBe(0);
  });
  it("a second Pull is refused in the same round, so the damage is dealt once", () => {
    const { after } = pulled(heroGame(), [SQUARED_OFF, NOBLE, SHARDS]);
    expect(applyCommand(after.state, pull(after.state), DEPS).ok).toBe(false);
    expect(damageOf(after.state)).toBe(3);
  });
  it("without the obligation in play the Pull deals no damage", () => {
    const s0 = stackDeck(heroGame(), SQUARED_OFF, NOBLE, SHARDS);
    const result = driveEventsPicking(DEPS, s0, firstLegal, pull(s0));
    expect(damageOf(result.state)).toBe(0);
  });

  describe("Alter-Ego Action: exhaust Erik Lehnsherr, discard Old Grievances", () => {
    it("in alter-ego form: Erik exhausts and the card leaves play", () => {
      const { state, id } = withGrievances(egoGame());
      const result = driveEventsPicking(DEPS, state, firstLegal, use(P1, id, GRIEVANCE_ACTION));
      expect(inst(result.state, identityOf(result.state)).exhausted).toBe(true);
      expect(playerOf(result.state, P1).playArea).not.toContain(id);
      expect(encounterDiscard(result.state)).toContain(OLD_GRIEVANCES);
    });
    it("not in hero form", () => {
      const { state, id } = withGrievances(heroGame());
      expect(applyCommand(state, use(P1, id, GRIEVANCE_ACTION), DEPS).ok).toBe(false);
    });
    it("not while Erik is exhausted", () => {
      const { state, id } = withGrievances(egoGame());
      const tired = patchInstance(state, identityOf(state), { exhausted: true });
      expect(applyCommand(tired, use(P1, id, GRIEVANCE_ACTION), DEPS).ok).toBe(false);
    });
  });
});

describe("Martyr for Mutants (49029): When Defeated, the defeating player discards the top 9 cards of their deck", () => {
  /** Martyr in the villain area with 1 threat, thwarted by Magneto's basic thwart (THW 2). */
  function defeated(deckSize?: number) {
    let s = heroGame();
    const id = instancesOf(s, MARTYR)[0] ?? Object.values(s.players)[0]!.setAside.find((i) => codeOf(s, i) === MARTYR)!;
    const without = <T>(list: readonly T[]) => list.filter((i) => (i as unknown) !== id);
    s = {
      ...s,
      players: s.players.map((p) => ({ ...p, setAside: without(p.setAside) })),
      encounterDecks: Object.fromEntries(
        Object.entries(s.encounterDecks).map(([k, d]) => [k, { deck: without(d.deck), discard: without(d.discard) }]),
      ),
      villainArea: [...s.villainArea, id],
    };
    s = patchInstance(s, id, { faceup: true, threat: 1 });
    if (deckSize !== undefined) s = patchPlayer(s, { deck: playerOf(s, P1).deck.slice(0, deckSize) });
    const result = driveEventsPicking(DEPS, s, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: id,
    } as Command);
    return { before: s, ...result, id };
  }

  it("a full deck: the side scheme is defeated and exactly 9 cards go to the discard pile from the top", () => {
    const top = playerOf(heroGame(), P1).deck.slice(0, 9);
    const run = defeated();
    expect(run.events.some((e) => e.type === "triggerEvent" && e.event.kind === "schemeDefeated")).toBe(true);
    expect(discardOf(run.state)).toHaveLength(9);
    expect(discardOf(run.state).sort()).toEqual(codes(run.state, top).sort());
  });
  it("a deck of 4: it discards what it has and the deck resets", () => {
    const run = defeated(4);
    expect(events(run.events, "playerDeckReset").length).toBeGreaterThan(0);
    expect(deckOf(run.state).length).toBeGreaterThan(0);
  });
});

describe("Fabian Cortez (49030): Guard. When Defeated, the defeating player discards the top 4. Boost: discard the top 4", () => {
  it("defeated by Magneto's attack: 4 cards from the top of his deck", () => {
    const { state, minion } = withMinion(heroGame(), FABIAN);
    const top4 = playerOf(state, P1).deck.slice(0, 4);
    const after = defeatWithAttack(DEPS, state, minion);
    expect(discardOf(after)).toHaveLength(4);
    expect(discardOf(after).sort()).toEqual(codes(after, top4).sort());
    expect(encounterDiscard(after)).toContain(FABIAN);
  });
  it("boost on Rhino's attack: the attacked player discards the top 4 of his deck", () => {
    const s0 = stageTop(heroGame(), FABIAN, ADVANCE);
    const before = playerOf(s0, P1).deck.slice(0, 4);
    const result = villainPhase(s0);
    expect(codes(result.state, before).every((c) => discardOf(result.state).includes(c))).toBe(true);
    expect(extraDiscards(s0, result.state)).toBe(4);
  });
});

describe("Frenzy (49031): Quickstrike. After she attacks you, discard the top 2 cards. Boost: discard the top 4", () => {
  it("her attack in the villain phase: 2 cards from the top of the deck go to the discard pile", () => {
    const base = withMinion(heroGame(), FRENZY);
    const s0 = stageTop(base.state, ADVANCE, ADVANCE, ADVANCE);
    const result = villainPhase(s0);
    expect(
      events(result.events, "enemyActivated").filter(
        (e) => (e as { enemyInstanceId: InstanceId }).enemyInstanceId === base.minion,
      ),
    ).toHaveLength(1);
    expect(extraDiscards(s0, result.state)).toBe(2);
  });
  it("boost on Rhino's attack: 4 cards discarded", () => {
    const s0 = stageTop(heroGame(), FRENZY, ADVANCE);
    const result = villainPhase(s0);
    expect(extraDiscards(s0, result.state)).toBe(4);
  });
  it("no attack, no discard: a minion that does not attack the player (no Forced Response heard)", () => {
    const s0 = stageTop(heroGame(), ADVANCE, ADVANCE);
    const result = villainPhase(s0);
    expect(extraDiscards(s0, result.state)).toBe(0);
  });
});

describe("Angry Acolyte (49032): each ACOLYTE minion engaged activates against its player; else find and reveal one", () => {
  /** The attacks a minion made: the damage events it is the source of (an activation by a card emits no enemyActivated). */
  const hitsBy = (list: readonly GameEvent[], source: InstanceId) =>
    list.filter((e) => e.type === "damageDealt" && e.sourceInstanceId === source);

  it("an engaged Frenzy activates a second time against the player (her Forced Response discards 2 again), nothing is found", () => {
    const base = withMinion(heroGame(), FRENZY);
    // Rhino's boost card, then Angry Acolyte as the player's reveal, then a filler and a Fabian Cortez that must stay put.
    const s0 = stageTop(base.state, ADVANCE, ACOLYTE_TREACHERY, ADVANCE, FABIAN);
    const result = villainPhase(s0);
    expect(hitsBy(result.events, base.minion)).toHaveLength(2);
    expect(extraDiscards(s0, result.state)).toBe(4);
    expect(encounterDiscard(result.state)).toContain(ACOLYTE_TREACHERY);
    expect(playerOf(result.state, P1).playArea.map((id) => codeOf(result.state, id))).not.toContain(FABIAN);
  });
  it("a non-ACOLYTE minion engaged does not activate for it", () => {
    const base = withMinion(heroGame(), MERCENARY);
    const s0 = stageTop(base.state, ADVANCE, ADVANCE, ACOLYTE_TREACHERY, ADVANCE, FABIAN);
    const result = villainPhase(s0);
    expect(hitsBy(result.events, base.minion)).toHaveLength(1);
  });
  it("with no ACOLYTE minion engaged: cards are discarded until an ACOLYTE minion is, and it is revealed", () => {
    const s0 = stageTop(heroGame(), ADVANCE, ACOLYTE_TREACHERY, ADVANCE, MERCENARY, FABIAN);
    const result = villainPhase(s0);
    const inPlay = playerOf(result.state, P1).playArea.map((id) => codeOf(result.state, id));
    expect(inPlay).toContain(FABIAN);
    expect(encounterDiscard(result.state)).toEqual(expect.arrayContaining([ACOLYTE_TREACHERY, MERCENARY]));
    expect(inPlay).not.toContain(MERCENARY);
    const fabian = playerOf(result.state, P1).playArea.find((id) => codeOf(result.state, id) === FABIAN)!;
    expect(inst(result.state, fabian).engagedWith).toBe(P1);
  });
});

describe("Exodus (49028): skipped until an enemy attack reports its total ATK", () => {
  /**
   * Exodus engaged (ATK 2); Rhino's boost card, then Exodus's own: 01100 prints 2 boost icons, so his total ATK for the
   * attack is 4. Magneto lets Rhino's attack through and defends Exodus's with his basic defense (DEF 2): the damage dealt is 2.
   */
  const attacked = (deps: EngineDeps) => {
    const base = withMinion(heroGame(deps), EXODUS);
    const s0 = stageTop(base.state, ADVANCE, "01100", ADVANCE, ADVANCE);
    // Rhino attacks first (no defense), then Exodus (Magneto defends).
    let prompts = 0;
    const defend: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
      prompts += 1;
      return prompts === 1 ? ["decline"] : [identityOf(s)];
    };
    return { s0, run: driveEventsPicking(deps, s0, defend, endTurn(P1)) };
  };
  const extra = (deps: EngineDeps): number => {
    const { s0, run } = attacked(deps);
    return extraDiscards(s0, run.state);
  };

  it("with no ref registered his attack discards nothing from the deck", () => {
    expect(extra(DEPS)).toBe(0);
  });
  it("what the draft does today: he discards as many cards as the attack dealt damage after DEF (2), not his total ATK", () => {
    expect(extra(DRAFT_DEPS)).toBe(2);
  });
  // Section 3.81 ("the number is the attack's ATK with its boost icons; a defended attack discards as many"), expected
  // to fail: total ATK is 2 + 2 icons = 4 whatever the defense.
  it.fails("the number is his total ATK for that attack (ATK 2 plus the boost icons), whatever the defense", () => {
    expect(extra(DRAFT_DEPS)).toBe(4);
  });
});
