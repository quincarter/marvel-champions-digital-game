import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  keywordTotal,
  createGame,
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
  moveToHand,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../../testing/staging.js";
import { stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_VILLAINS_TYPHOID_MARY as REGISTRY, FNE_VILLAINS_TYPHOID_MARY_SKIPPED as SKIPPED } from "./typhoid-mary.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Typhoid Mary villain set (60110a/b and 60111a/b Typhoid / Bloody Mary, 60112 Disturbed Psyche, 60113a/b
 * Establish Trust / Mary Walker, 60114 Telekinesis, 60115 Psionic Slash, 60116 Psi Nova, 60117 Assembled Armor,
 * 60118 Hail of Blades, 60119 Scavenged Bulwark, 60120 Hand Lookout), docs/phase7-wave11-scenarios.md section S6, S3.4.
 * Each game is Core's Spider-Man (Justice) against Typhoid Mary (stage chosen per test) with the set added to the Core
 * encounter deck; Disturbed Psyche and Establish Trust enter play at setup (Setup keyword, RRG 1.8 Appendix II step 11,
 * p. 51), and Psyche's Setup draws the villain's side from the seed (so a test picks a seed by the side it lands on).
 * Assault (01187) prints no boost icon and no boost ability: the blank boost card.
 */
const MARY = "60110b";
const PSYCHE = "60112";
const TRUST = "60113a";
const WALKER = "60113b";
const TELEKINESIS = "60114";
const SLASH = "60115";
const NOVA = "60116";
const ARMOR = "60117";
const BLADES = "60118";
const BULWARK = "60119";
const LOOKOUT = "60120";
const ASSAULT = "01187";
const BLACK_CAT = "01002";
const REFS = [
  "60110b.bloody-mary-forced-interrupt",
  "60111b.when-revealed",
  "60111b.bloody-mary-forced-interrupt",
  "60110a.typhoid-mary-forced-interrupt",
  "60111a.typhoid-mary-forced-interrupt",
  "60112.setup",
  "60112.disturbed-psyche-forced-interrupt",
  "60112.disturbed-psyche-constant",
  "60113a.establish-trust-constant",
  "60113a.when-defeated",
  "60113b.mary-walker-constant",
  "60113b.mary-walker-forced-response",
  "60114.telekinesis-action",
  "60114.boost",
  "60115.when-revealed",
  "60115.boost",
  "60116.when-revealed",
  "60116.boost",
  "60117.assembled-armor-forced-interrupt",
  "60117.boost",
  "60118.when-revealed",
  "60118.boost",
  "60119.when-revealed",
  "60119.boost",
  "60120.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const damageOf = (s: GameState, id: InstanceId = hero(s)): number => inst(s, id).damage;
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const psyche = (s: GameState): InstanceId => idOf(s, PSYCHE);
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
const villainState = (s: GameState) => s.villains.find((v) => v.instanceId === villainOf(s))!;
const sideOf = (s: GameState): "A" | "B" => villainState(s).side as "A" | "B";
const stageOf = (s: GameState): number => villainState(s).stageIndex;
const nameOf = (s: GameState): string => (sideOf(s) === "A" ? "Bloody Mary" : "Typhoid Mary");
const tough = (s: GameState): number => inst(s, villainOf(s)).statuses.tough ?? 0;
const encounterDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
/** Hit points the villain has left. */
const remaining = (s: GameState): number => profile(s, villainOf(s)).maxHp - damageOf(s, villainOf(s));

/** Core Spider-Man (hero form), plus Captain Marvel with `players: 2`, against Typhoid Mary at `stage` (1 or 2). */
function newGame(
  opts: { stage?: 1 | 2; players?: number; seed?: number; expert?: boolean; side?: "A" | "B" } = {},
): GameState {
  const { stage = 1, players = 1, seed = 1, expert = false } = opts;
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const build = (s: number): GameState => {
    const base = coreScenario("rhino", {
      players: seats.slice(0, players),
      seed: s,
      difficulty: expert ? "expert" : "standard",
      modularSetIds: [],
      cardPool: PLAYABLE_CARDS,
    } as never);
    const created = createGame(
      {
        ...base,
        villainCardId: cardId(MARY),
        villainSide: "A",
        villainStartStageIndex: stage - 1,
        villainLastStageIndex: 1,
        encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["typhoid_mary"], PLAYABLE_CARDS)],
      },
      WAVE11_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const settled = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
    return withForm(settled, { heroForm: 0 });
  };
  if (opts.side === undefined) return build(seed);
  // The side is drawn from the game seed: take the first seed from `seed` up that lands on the wanted side.
  for (let s = seed; s < seed + 40; s++) {
    const game = build(s);
    if (sideOf(game) === opts.side) return game;
  }
  throw new Error(`no seed lands on side ${opts.side}`);
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
const ready = (s: GameState): GameState => patchInstance(s, hero(s), { exhausted: false });
const strike = (s: GameState): GameState => defeatWithAttack(WAVE11_DEPS, ready(s), villainOf(s));
/** The side scheme or attachment holding the Establish Trust / Mary Walker card (one card, two faces). */
const trustCard = (s: GameState): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => [TRUST, WALKER].includes(codeOf(s, i)))!;
const faceOf = (s: GameState): string => inst(s, trustCard(s)).cardId as string;

describe("registry", () => {
  it("registers every printed ref of the cards; nothing is skipped", () => {
    const printed = [
      "60110b",
      "60112",
      "60113a",
      "60113b",
      "60114",
      "60115",
      "60116",
      "60117",
      "60118",
      "60119",
      "60120",
    ]
      .flatMap((c) => abilityRefIds(data(c)))
      .sort();
    expect(printed).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------

/** Every player ends the turn, first player first: the hero phase over, the villain phase runs. */
const endAll = (s: GameState) =>
  s.players.length > 1 && s.firstPlayerId === P2
    ? [endTurn(P2), endTurn(P1)]
    : s.players.map((p) => endTurn(p.playerId));
/** One blank-as-a-reveal minion per player: the encounter cards the phase deals while a test is about something else. */
const fillers = (s: GameState): string[] => s.players.map(() => LOOKOUT);
/**
 * The villain phase on a stacked encounter deck: `boosts` are the top cards (the villain's boost cards, one per
 * activation), then `dealt` (default one filler per player) are the encounter cards the players are dealt, in turn order.
 * Advance (01186) and Assault (01187) print no boost icon and no boost ability, so they are the blank boost cards.
 */
const phase = (s: GameState, boosts: readonly string[] = [], dealt?: readonly string[], pick: Picker = declines) =>
  driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(s, ...boosts, ...(dealt ?? fillers(s))), pick, ...endAll(s));
/** The villain given the status that stops her next attack (stunned) and/or her next scheme (confused). */
const hobbled = (s: GameState, ...kinds: readonly ("stunned" | "confused")[]): GameState =>
  patchInstance(s, villainOf(s), {
    statuses: { ...inst(s, villainOf(s)).statuses, ...Object.fromEntries(kinds.map((k) => [k, 1])) },
  });
/**
 * The villain stunned for each player in hero form and confused for each in alter-ego form: her activation against
 * each only discards that card (no attack, no scheme, no boost card), so the dealt cards' own effects are alone. A
 * status a player's form does not use is not given, or it would block the dealt card's own attack or scheme.
 */
const quiet = (s: GameState, dealt?: readonly string[], pick: Picker = declines) => {
  const kinds = s.players.map(
    (p) => (p.identity.form === "alterEgo" ? "confused" : "stunned") as "stunned" | "confused",
  );
  return phase(hobbled(s, ...new Set(kinds)), [], dealt, pick);
};

function takeFromEncounter(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
    },
  };
}
/** Surgery: the first copy of `code` attached to the villain, faceup. */
function attachToVillain(state: GameState, code: string) {
  const host = villainOf(state);
  const taken = takeFromEncounter(state, code);
  const placed = patchInstance(taken.state, taken.id, { faceup: true, attachedTo: host, controllerId: null });
  return {
    id: taken.id,
    state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, taken.id] }),
  };
}

const thwartTrust = (s: GameState, player: PlayerId = P1) =>
  driveEventsPicking(WAVE11_DEPS, patchInstance(s, trustCard(s), { threat: 1 }), declines, {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: hero(s, player),
    schemeInstanceId: trustCard(s),
  } as never);
/** A game with Establish Trust turned over to Mary Walker on the villain. */
function walkerGame(opts: Parameters<typeof newGame>[0] = {}): GameState {
  const s = thwartTrust(newGame(opts)).state;
  if (faceOf(s) !== WALKER) throw new Error(`Establish Trust did not flip (${faceOf(s)})`);
  return s;
}
const dealt = (s: GameState, p: PlayerId): number => playerOf(s, p).dealtEncounter.length;

// ---------------------------------------------------------------------------------------------------------------
// The villain
// ---------------------------------------------------------------------------------------------------------------

const psycheTokens = (s: GameState): number => inst(s, psyche(s)).damage + inst(s, psyche(s)).threat;

describe("Typhoid Mary / Bloody Mary forced interrupts (60110a/b, 60111a/b)", () => {
  // [ref, stage, side, hit points per hero]
  const FACES = [
    ["60110b.bloody-mary-forced-interrupt", 1, "A", 10],
    ["60110a.typhoid-mary-forced-interrupt", 1, "B", 10],
    ["60111b.bloody-mary-forced-interrupt", 2, "A", 13],
    ["60111a.typhoid-mary-forced-interrupt", 2, "B", 13],
  ] as const;

  it.each(FACES)(
    "%s: a defeat puts 1 damage token on Disturbed Psyche and resets her hit points",
    (_ref, stage, side, hp) => {
      for (const players of [1, 2]) {
        const entered = newGame({ stage, side, players });
        expect(sideOf(entered)).toBe(side);
        // Typhoid II enters tough; that status card would take the blow, which is its own test below.
        const s = patchInstance(entered, villainOf(entered), {
          statuses: { ...inst(entered, villainOf(entered)).statuses, tough: 0 },
        });
        expect(psycheTokens(s)).toBe(0);
        const after = strike(s);
        expect(after.outcome).toBeNull();
        expect(villainOf(after)).toBe(villainOf(s));
        expect([stageOf(after), sideOf(after)]).toEqual([stage - 1, side]);
        expect(inst(after, psyche(after)).damage).toBe(1);
        expect(inst(after, psyche(after)).threat).toBe(0);
        // Reset to the printed number per hero, not to whatever the dial held.
        expect(remaining(after)).toBe(hp * players);
      }
    },
  );

  it("60111a.typhoid-mary-forced-interrupt: a tough status card takes the blow first, so no token is placed that time", () => {
    const s = newGame({ stage: 2, side: "B" });
    expect(tough(s)).toBe(1);
    const after = strike(s);
    expect(tough(after)).toBe(0);
    expect(inst(after, psyche(after)).damage).toBe(0);
    expect(inst(after, psyche(after)).damage + inst(strike(after), psyche(after)).damage).toBe(1);
  });

  it("60110b.bloody-mary-forced-interrupt: she is never defeated: no victory display, no stage change", () => {
    const s = newGame({ side: "A" });
    const after = strike(strike(s));
    expect(after.villains.length).toBe(1);
    expect(inst(after, psyche(after)).damage).toBe(2);
    expect(stageOf(after)).toBe(0);
  });

  it("60110a.typhoid-mary-forced-interrupt: the reset heals the damage she had already taken", () => {
    const s = newGame({ side: "B", players: 2 });
    const hurt = patchInstance(s, villainOf(s), { damage: 5 });
    expect(remaining(hurt)).toBe(15);
    expect(remaining(strike(hurt))).toBe(20);
  });
});

describe("Bloody Mary II 60111b", () => {
  it("60111b.when-revealed: deals 1 damage to each identity (both players)", () => {
    const s = newGame({ stage: 2, side: "A", players: 2 });
    expect(damageOf(s, hero(s, P1))).toBe(1);
    expect(damageOf(s, hero(s, P2))).toBe(1);
    expect(tough(s)).toBe(0);
  });
  it("60111b.when-revealed: Bloody Mary I and Typhoid Mary II reveal for no damage", () => {
    for (const s of [newGame({ stage: 1, side: "A", players: 2 }), newGame({ stage: 2, side: "B", players: 2 })]) {
      expect(damageOf(s, hero(s, P1))).toBe(0);
      expect(damageOf(s, hero(s, P2))).toBe(0);
    }
  });
  it("60111a.typhoid-mary-forced-interrupt: Typhoid Mary II is Toughness data and enters tough", () => {
    const s = newGame({ stage: 2, side: "B" });
    expect(tough(s)).toBe(1);
    expect(tough(newGame({ stage: 1, side: "B" }))).toBe(0);
  });
});

describe("Disturbed Psyche 60112", () => {
  it("60112.setup: both Disturbed Psyche and Establish Trust begin in play", () => {
    const s = newGame();
    expect(s.villainArea.map((i) => codeOf(s, i)).sort()).toEqual([TRUST, PSYCHE].sort());
    expect(inst(s, trustCard(s)).threat).toBe(8);
    const two = newGame({ players: 2 });
    expect(inst(two, trustCard(two)).threat).toBe(16);
  });

  it("60112.setup: the villain starts on a random side drawn from the seed, and the same seed gives the same side", () => {
    const seeds = Array.from({ length: 10 }, (_, i) => i + 1);
    const sides = seeds.map((seed) => sideOf(newGame({ seed })));
    expect(new Set(sides)).toEqual(new Set(["A", "B"]));
    expect(seeds.map((seed) => sideOf(newGame({ seed })))).toEqual(sides);
  });

  it("60112.setup: the side chosen is the one revealed (stage II toughness on Typhoid, damage on Bloody) and stage is kept", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = newGame({ stage: 2, seed, players: 2 });
      expect(stageOf(s)).toBe(1);
      expect(tough(s)).toBe(sideOf(s) === "B" ? 1 : 0);
      expect(damageOf(s, hero(s, P1))).toBe(sideOf(s) === "A" ? 1 : 0);
    }
  });

  it("60112.disturbed-psyche-forced-interrupt: the villain phase ending flips the villain; she acts on the old face first", () => {
    const s = newGame({ side: "A" });
    // Bloody Mary attacks the hero in hero form for her ATK 2 (a blank boost card), then the villain flips.
    const run = phase(s, [ASSAULT]);
    expect(damageOf(run.state)).toBe(2);
    expect(sideOf(run.state)).toBe("B");
    expect(nameOf(run.state)).toBe("Typhoid Mary");
    expect(ofType(run.events, "villainFlipped")).toHaveLength(1);
    expect(sideOf(phase(run.state, [ASSAULT]).state)).toBe("A");
  });

  it("60112.disturbed-psyche-forced-interrupt: the new face is revealed: Typhoid II's toughness", () => {
    const s = newGame({ stage: 2, side: "A" });
    expect(tough(s)).toBe(0);
    const run = quiet(withForm(s, "alterEgo"));
    expect(sideOf(run.state)).toBe("B");
    expect(tough(run.state)).toBe(1);
  });

  it("60112.disturbed-psyche-forced-interrupt: the new face is revealed: Bloody Mary II's When Revealed (each identity)", () => {
    const s = newGame({ stage: 2, side: "B", players: 2 });
    const run = quiet(s);
    expect(sideOf(run.state)).toBe("A");
    expect(damageOf(run.state, hero(run.state, P1))).toBe(1);
    expect(damageOf(run.state, hero(run.state, P2))).toBe(1);
  });

  it("60112.disturbed-psyche-constant: 3 tokens (damage and threat together) win the game; fewer do not", () => {
    const s = newGame({ side: "A" });
    const two = strike(strike(s));
    expect(two.outcome).toBeNull();
    expect(strike(two).outcome).toMatchObject({ result: "win" });
    // Damage and threat tokens both count.
    expect(strike(patchInstance(s, psyche(s), { damage: 1, threat: 1 })).outcome).toMatchObject({ result: "win" });
    expect(strike(patchInstance(s, psyche(s), { threat: 1 })).outcome).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Establish Trust / Mary Walker
// ---------------------------------------------------------------------------------------------------------------

describe("Establish Trust 60113a", () => {
  it("is Permanent and Setup data", () => {
    expect(data(TRUST).keywords).toEqual(expect.arrayContaining([{ name: "permanent" }, { name: "setup" }]));
  });

  it("60113a.establish-trust-constant: in expert mode it gains hinder 3 per hero, in standard mode none", () => {
    const hinder = (s: GameState) => keywordTotal(s, trustCard(s), "hinder", WAVE11_DEPS);
    expect(hinder(newGame({ expert: true }))).toBe(3);
    expect(hinder(newGame({ expert: true, players: 2 }))).toBe(6);
    expect(hinder(newGame())).toBe(0);
    expect(hinder(newGame({ players: 2 }))).toBe(0);
  });

  it("60113a.when-defeated: removing the last threat places a threat token on Disturbed Psyche and flips it onto the villain", () => {
    for (const players of [1, 2]) {
      const run = thwartTrust(newGame({ players }));
      expect(faceOf(run.state)).toBe(WALKER);
      expect(inst(run.state, psyche(run.state)).threat).toBe(1);
      expect(inst(run.state, trustCard(run.state)).attachedTo).toBe(villainOf(run.state));
      expect(run.state.villainArea.includes(trustCard(run.state))).toBe(false);
    }
  });

  it("60113a.when-defeated: a thwart that leaves threat behind does nothing", () => {
    const s = newGame();
    const run = driveEventsPicking(WAVE11_DEPS, patchInstance(s, trustCard(s), { threat: 5 }), declines, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(s),
      schemeInstanceId: trustCard(s),
    } as never);
    expect(faceOf(run.state)).toBe(TRUST);
    expect(psycheTokens(run.state)).toBe(0);
  });
});

describe("Mary Walker 60113b", () => {
  it("60113b.mary-walker-constant: the attached villain cannot activate", () => {
    const run = phase(withForm(walkerGame(), "alterEgo"));
    expect(ofType(run.events, "activationBlocked").length).toBeGreaterThan(0);
    expect(ofType(run.events, "enemyActivated")).toEqual([]);
    // Control: with Establish Trust in play the same phase has the villain scheme.
    const free = phase(withForm(newGame(), "alterEgo"), [ASSAULT]);
    expect(ofType(free.events, "enemyActivated").length).toBeGreaterThan(0);
  });

  const hit = (s: GameState) =>
    driveEventsPicking(WAVE11_DEPS, ready(s), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(s),
      targetInstanceId: villainOf(s),
    } as never);
  const dealtMoves = (events: readonly GameEvent[]) =>
    ofType(events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter");

  it("60113b.mary-walker-forced-response: after the villain takes damage, each player is dealt a facedown encounter card and it flips", () => {
    const s = walkerGame({ players: 2 });
    expect([dealt(s, P1), dealt(s, P2)]).toEqual([0, 0]);
    const run = hit(s);
    expect([dealt(run.state, P1), dealt(run.state, P2)]).toEqual([1, 1]);
    expect(faceOf(run.state)).toBe(TRUST);
    expect(inst(run.state, trustCard(run.state)).threat).toBe(16);
    expect(inst(run.state, trustCard(run.state)).attachedTo).toBeNull();
  });

  it("60113b.mary-walker-forced-response: damage that is not taken (a tough status card) does not trigger it", () => {
    const s = walkerGame();
    const toughened = patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 1 } });
    const run = hit(toughened);
    expect(faceOf(run.state)).toBe(WALKER);
    expect(dealt(run.state, P1)).toBe(0);
  });

  it("60113b.mary-walker-forced-response: or when the round ends", () => {
    const run = phase(walkerGame({ players: 2 }));
    expect(faceOf(run.state)).toBe(TRUST);
    // The villain phase deals each of the two players an encounter card anyway; Mary Walker deals two more.
    expect(dealtMoves(run.events)).toHaveLength(4);
  });

  it("60113b.mary-walker-forced-response: once flipped back it does not fire again at the round's end", () => {
    const damaged = hit(walkerGame()).state;
    // Only the villain phase's own deal to the one player.
    expect(dealtMoves(phase(damaged).events)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The encounter cards
// ---------------------------------------------------------------------------------------------------------------

/** The hand cards of the deck that show exactly one printed resource icon of `type` and nothing else. */
const icons = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any).resourceIcons ?? {};
function onlyOf(state: GameState, type: string, player: PlayerId = P1): string[] {
  const p = playerOf(state, player);
  return [...p.hand, ...p.deck]
    .map((i) => codeOf(state, i))
    .filter((c) => {
      const found = icons(c);
      return (found[type] ?? 0) === 1 && Object.entries(found).every(([k, n]) => k === type || !n);
    });
}
/** P1's hand replaced with exactly these cards. */
function handOf(state: GameState, ...codes: string[]): { state: GameState; ids: readonly InstanceId[] } {
  const emptied = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], discard: [...p.discard, ...p.hand] } : p)),
  };
  return moveToHand(emptied, P1, ...codes);
}
/** Black Cat (01002) in P1's play area as an ally. */
function allyInPlay(state: GameState) {
  const placed = stagedInPlay(state, BLACK_CAT);
  return {
    id: placed.id,
    state: patchInstance(placed.state, placed.id, { home: { kind: "playArea", playerId: P1 } } as never),
  };
}
const exhaustedOf = (s: GameState, id: InstanceId): boolean => inst(s, id).exhausted;
const statusOf = (s: GameState, id: InstanceId, status: string): number =>
  ((inst(s, id).statuses as unknown as Record<string, number>)[status] ?? 0) as number;
const boostFlips = (events: readonly GameEvent[]) => ofType(events, "boostCardFlipped").length;

describe("Telekinesis 60114", () => {
  it("is an attachment to the villain with +2 SCH", () => {
    expect(data(TELEKINESIS).statModifiers).toEqual({ sch: 2 });
    const s = newGame({ side: "B" });
    const base = profile(s, villainOf(s)).sch;
    const attached = attachToVillain(s, TELEKINESIS).state;
    expect(profile(attached, villainOf(attached)).sch).toBe(base + 2);
  });

  const hostWith = (s: GameState) => attachToVillain(s, TELEKINESIS);

  it("60114.telekinesis-action: spending two mental resources discards it", () => {
    const placed = hostWith(newGame());
    const mental = onlyOf(placed.state, "mental").slice(0, 2);
    expect(mental).toHaveLength(2);
    const given = handOf(placed.state, ...mental);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      given.state,
      firstLegal,
      use(
        P1,
        placed.id,
        "60114.telekinesis-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
    );
    expect(inst(run.state, villainOf(run.state)).attachments).toEqual([]);
    expect(encounterDiscard(run.state)).toContain(TELEKINESIS);
    expect(playerOf(run.state, P1).hand).toHaveLength(0);
  });

  it("60114.telekinesis-action: a physical resource does not pay for it", () => {
    const placed = hostWith(newGame());
    const physical = onlyOf(placed.state, "physical").slice(0, 2);
    const given = handOf(placed.state, ...physical);
    const attempt = (() => {
      try {
        return driveEventsPicking(
          WAVE11_DEPS,
          given.state,
          firstLegal,
          use(
            P1,
            placed.id,
            "60114.telekinesis-action",
            given.ids.map((fromHand) => ({ fromHand })),
          ),
        ).state;
      } catch {
        return given.state;
      }
    })();
    expect(inst(attempt, villainOf(attempt)).attachments).toEqual([placed.id]);
  });

  it("60114.boost: Typhoid Mary activating, you take 3 indirect damage and each character damaged is exhausted", () => {
    const base = allyInPlay(newGame({ side: "B" }));
    const run = phase(withForm(base.state, "alterEgo"), [TELEKINESIS]);
    expect(boostFlips(run.events)).toBe(1);
    const me = hero(run.state);
    const total = damageOf(run.state, me) + damageOf(run.state, base.id);
    expect(total).toBe(3);
    for (const id of [me, base.id]) expect(exhaustedOf(run.state, id)).toBe(damageOf(run.state, id) > 0);
  });

  it("60114.boost: only the player activated against takes it (the first player, in a two-player game)", () => {
    const s = newGame({ side: "B", players: 2 });
    // P1's activation is first and takes the Telekinesis boost; P2's boost card is blank.
    const run = phase(withForm(withForm(s, "alterEgo"), "alterEgo", P2), [TELEKINESIS, ASSAULT]);
    expect(damageOf(run.state, hero(run.state, P1))).toBe(3);
    expect(damageOf(run.state, hero(run.state, P2))).toBe(0);
  });

  it("60114.boost: Bloody Mary activating, nothing happens", () => {
    const base = allyInPlay(newGame({ side: "A" }));
    const run = phase(withForm(base.state, "alterEgo"), [TELEKINESIS]);
    expect(boostFlips(run.events)).toBe(1);
    expect(damageOf(run.state, hero(run.state)) + damageOf(run.state, base.id)).toBe(0);
    expect(exhaustedOf(run.state, base.id)).toBe(false);
  });
});

describe("Psionic Slash 60115", () => {
  const schemes = (events: readonly GameEvent[]) => ofType(events, "schemeResolved").length;

  it("60115.when-revealed: with Mary Walker in play it flips her to Establish Trust, and the villain schemes", () => {
    const s = walkerGame();
    const run = phase(withForm(s, "alterEgo"), [], [SLASH, ASSAULT]);
    expect(faceOf(run.state)).toBe(TRUST);
    expect(inst(run.state, trustCard(run.state)).threat).toBe(8);
    // The villain could not act in her own step (Mary Walker); the Slash is the one scheme of the phase.
    expect(schemes(run.events)).toBe(1);
    expect(ofType(run.events, "activationBlocked").length).toBeGreaterThan(0);
  });

  it("60115.when-revealed: with Mary Walker not in play it only schemes", () => {
    const s = newGame();
    const run = quiet(withForm(s, "alterEgo"), [SLASH, ASSAULT]);
    expect(faceOf(run.state)).toBe(TRUST);
    expect(inst(run.state, trustCard(run.state)).attachedTo).toBeNull();
    // One more scheme than the same phase with a blank card in its place.
    const control = quiet(withForm(s, "alterEgo"), [LOOKOUT, ASSAULT]);
    expect(schemes(run.events)).toBe(schemes(control.events) + 1);
  });

  it("60115.boost: Typhoid Mary activating, 3 damage to an ally you control", () => {
    const base = allyInPlay(newGame({ side: "B" }));
    const run = phase(withForm(base.state, "alterEgo"), [SLASH]);
    expect(boostFlips(run.events)).toBe(1);
    // Three damage defeats Black Cat (2 hit points).
    expect(profile(base.state, base.id).maxHp).toBeLessThanOrEqual(3);
    expect(ofType(run.events, "characterDefeated").map((e) => e.instanceId)).toContain(base.id);
  });

  it("60115.boost: Bloody Mary activating, nothing", () => {
    const base = allyInPlay(newGame({ side: "A" }));
    const run = phase(withForm(base.state, "alterEgo"), [SLASH]);
    expect(boostFlips(run.events)).toBe(1);
    expect(inst(run.state, base.id).damage).toBe(0);
  });
});

describe("Psi Nova 60116", () => {
  it("60116.when-revealed: 1 damage to each character you control, and you are stunned", () => {
    const base = allyInPlay(newGame());
    const run = quiet(base.state, [NOVA]);
    expect(damageOf(run.state, hero(run.state))).toBe(1);
    expect(inst(run.state, base.id).damage).toBe(1);
    expect(statusOf(run.state, hero(run.state), "stunned")).toBe(1);
  });

  it("60116.when-revealed: you, not every player, in a two-player game", () => {
    const s = newGame({ players: 2 });
    // P1 reveals the first card, P2 the second: Psi Nova on P2 leaves P1 alone.
    const run = quiet(s, [LOOKOUT, NOVA]);
    expect(damageOf(run.state, hero(run.state, P2))).toBe(1);
    expect(statusOf(run.state, hero(run.state, P2), "stunned")).toBe(1);
    expect(damageOf(run.state, hero(run.state, P1))).toBe(0);
    expect(statusOf(run.state, hero(run.state, P1), "stunned")).toBe(0);
  });

  it("60116.boost: Typhoid Mary activating, you are stunned", () => {
    const run = phase(newGame({ side: "B" }), [NOVA]);
    expect(statusOf(run.state, hero(run.state), "stunned")).toBe(1);
  });

  it("60116.boost: Bloody Mary activating, you are not", () => {
    const run = phase(newGame({ side: "A" }), [NOVA]);
    expect(statusOf(run.state, hero(run.state), "stunned")).toBe(0);
  });
});

describe("Assembled Armor 60117", () => {
  const armored = (opts: Parameters<typeof newGame>[0] = {}) => attachToVillain(newGame({ side: "B", ...opts }), ARMOR);
  const armorDamage = (s: GameState, id: InstanceId): number => inst(s, id).damage;

  it("is an attachment to the villain with +2 ATK", () => {
    expect(data(ARMOR).statModifiers).toEqual({ atk: 2 });
    const s = newGame({ side: "B" });
    const attached = attachToVillain(s, ARMOR).state;
    expect(profile(attached, villainOf(attached)).atk).toBe(profile(s, villainOf(s)).atk + 2);
  });

  it("60117.assembled-armor-forced-interrupt: damage meant for the villain is placed on the armor instead", () => {
    const placed = armored();
    const run = driveEventsPicking(WAVE11_DEPS, ready(placed.state), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(placed.state),
      targetInstanceId: villainOf(placed.state),
    } as never);
    expect(armorDamage(run.state, placed.id)).toBeGreaterThan(0);
    expect(damageOf(run.state, villainOf(run.state))).toBe(0);
  });

  it("60117.assembled-armor-forced-interrupt: at 5 damage it is discarded (standard mode); the villain took none of it", () => {
    const placed = armored();
    const atk = profile(placed.state, hero(placed.state)).atk;
    const nearly = patchInstance(placed.state, placed.id, { damage: 5 - atk });
    const run = driveEventsPicking(WAVE11_DEPS, ready(nearly), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(nearly),
      targetInstanceId: villainOf(nearly),
    } as never);
    expect(inst(run.state, villainOf(run.state)).attachments).toEqual([]);
    expect(encounterDiscard(run.state)).toContain(ARMOR);
    expect(damageOf(run.state, villainOf(run.state))).toBe(0);
  });

  it("60117.assembled-armor-forced-interrupt: 4 damage is not enough to discard it (standard mode)", () => {
    const placed = armored();
    const atk = profile(placed.state, hero(placed.state)).atk;
    const nearly = patchInstance(placed.state, placed.id, { damage: 4 - atk });
    const run = driveEventsPicking(WAVE11_DEPS, ready(nearly), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(nearly),
      targetInstanceId: villainOf(nearly),
    } as never);
    expect(inst(run.state, villainOf(run.state)).attachments).toEqual([placed.id]);
  });

  it("60117.assembled-armor-forced-interrupt: in expert mode it takes 8, not 5", () => {
    const placed = armored({ expert: true });
    const atk = profile(placed.state, hero(placed.state)).atk;
    const at = (n: number) => {
      const near = patchInstance(placed.state, placed.id, { damage: n });
      return driveEventsPicking(WAVE11_DEPS, ready(near), declines, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(near),
        targetInstanceId: villainOf(near),
      } as never).state;
    };
    // 5 would have discarded it in standard mode; 8 is the line here.
    expect(inst(at(5 - atk), villainOf(at(5 - atk))).attachments).toEqual([placed.id]);
    expect(inst(at(7 - atk), villainOf(at(7 - atk))).attachments).toEqual([placed.id]);
    expect(inst(at(8 - atk), villainOf(at(8 - atk))).attachments).toEqual([]);
  });

  it("60117.assembled-armor-forced-interrupt: 'would take': a tough status card goes first, so the armor takes nothing", () => {
    const placed = armored();
    const toughened = patchInstance(placed.state, villainOf(placed.state), {
      statuses: { ...inst(placed.state, villainOf(placed.state)).statuses, tough: 1 },
    });
    const run = driveEventsPicking(WAVE11_DEPS, ready(toughened), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(toughened),
      targetInstanceId: villainOf(toughened),
    } as never);
    expect(tough(run.state)).toBe(0);
    expect(armorDamage(run.state, placed.id)).toBe(0);
  });

  it("60117.boost: Bloody Mary activating, you are confused", () => {
    const run = phase(newGame({ side: "A" }), [ARMOR]);
    expect(statusOf(run.state, hero(run.state), "confused")).toBe(1);
  });

  it("60117.boost: Typhoid Mary activating, you are not", () => {
    const run = phase(newGame({ side: "B" }), [ARMOR]);
    expect(statusOf(run.state, hero(run.state), "confused")).toBe(0);
  });
});

describe("Hail of Blades 60118", () => {
  it("60118.when-revealed: the villain attacks you even in alter-ego form", () => {
    const s = withForm(newGame({ side: "A" }), "alterEgo");
    const run = quiet(s, [BLADES, ASSAULT]);
    expect(damageOf(run.state, hero(run.state))).toBe(profile(s, villainOf(s)).atk);
  });

  it("60118.when-revealed: with Mary Walker in play it also flips her to Establish Trust", () => {
    const s = walkerGame({ side: "A" });
    const run = phase(withForm(s, "alterEgo"), [], [BLADES, ASSAULT]);
    expect(faceOf(run.state)).toBe(TRUST);
    expect(damageOf(run.state, hero(run.state))).toBe(profile(s, villainOf(s)).atk);
  });

  it("60118.boost: Bloody Mary activating, you take 2 damage", () => {
    const s = withForm(newGame({ side: "A" }), "alterEgo");
    const run = phase(s, [BLADES]);
    // The boost card's 2 damage, on top of the scheme the villain makes against an alter ego.
    expect(damageOf(run.state, hero(run.state))).toBe(2);
  });

  it("60118.boost: Typhoid Mary activating, you do not", () => {
    const s = withForm(newGame({ side: "B" }), "alterEgo");
    const run = phase(s, [BLADES]);
    expect(damageOf(run.state, hero(run.state))).toBe(0);
  });
});

describe("Scavenged Bulwark 60119", () => {
  it("is Surge data", () => {
    expect(data(BULWARK).keywords).toContainEqual({ name: "surge" });
  });

  it("60119.when-revealed: gives the villain a tough status card, and surges", () => {
    const s = newGame({ side: "A" });
    expect(tough(s)).toBe(0);
    const run = quiet(withForm(s, "alterEgo"), [BULWARK, LOOKOUT]);
    expect(tough(run.state)).toBe(1);
    expect(ofType(run.events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });

  it("60119.boost: Bloody Mary activating, she gets a tough status card", () => {
    const s = newGame({ side: "A" });
    const run = phase(withForm(s, "alterEgo"), [BULWARK]);
    expect(tough(run.state)).toBe(1);
  });

  it("60119.boost: Typhoid Mary activating, she does not", () => {
    const s = newGame({ side: "B" });
    const run = phase(withForm(s, "alterEgo"), [BULWARK]);
    expect(tough(run.state)).toBe(0);
  });
});

describe("Hand Lookout 60120", () => {
  it("is Guard and Toughness data", () => {
    expect(data(LOOKOUT).keywords).toEqual(expect.arrayContaining([{ name: "guard" }, { name: "toughness" }]));
  });

  it("60120.boost: the activating enemy gets an additional boost card", () => {
    const s = newGame({ side: "A" });
    const plain = phase(s, [ASSAULT]);
    expect(boostFlips(plain.events)).toBe(1);
    const run = phase(s, [LOOKOUT, ASSAULT]);
    expect(boostFlips(run.events)).toBe(2);
  });
});

describe("review additions", () => {
  const hitVillain = (s: GameState) =>
    driveEventsPicking(WAVE11_DEPS, ready(s), declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(s),
      targetInstanceId: villainOf(s),
    } as never);

  it("60113a.establish-trust-constant: expert hinder makes its starting threat 11 per hero-count, at setup and after Mary Walker flips back", () => {
    expect(inst(newGame({ expert: true }), trustCard(newGame({ expert: true }))).threat).toBe(11);
    const two = newGame({ expert: true, players: 2 });
    expect(inst(two, trustCard(two)).threat).toBe(22);
    for (const players of [1, 2]) {
      const back = hitVillain(walkerGame({ expert: true, players })).state;
      expect(faceOf(back)).toBe(TRUST);
      expect(inst(back, trustCard(back)).threat).toBe(11 * players);
    }
  });

  it("60120.boost: also gives the extra boost card on a scheme against an alter ego", () => {
    const s = withForm(newGame({ side: "A" }), "alterEgo");
    expect(boostFlips(phase(s, [ASSAULT]).events)).toBe(1);
    expect(boostFlips(phase(s, [LOOKOUT, ASSAULT]).events)).toBe(2);
  });

  it("60113b.mary-walker-forced-response: damage the Assembled Armor soaks is not damage the villain takes", () => {
    const walker = walkerGame();
    const armor = attachToVillain(walker, ARMOR);
    const run = hitVillain(armor.state);
    expect(inst(run.state, armor.id).damage).toBeGreaterThan(0);
    expect(faceOf(run.state)).toBe(WALKER);
    expect(dealt(run.state, P1)).toBe(0);
  });

  it('60114.boost: the defending player is "you" (P2 defends P1\'s attacker and takes the indirect damage)', () => {
    const s = withForm(newGame({ side: "B", players: 2 }), { heroForm: 0 }, P2);
    const defends: Picker = (st) => {
      if (st.pendingChoice!.prompt.kind !== "declareDefender") return firstLegal(st);
      const ids = st.pendingChoice!.options.map((o) => o.optionId as string);
      return ids.includes(hero(st, P2)) ? [hero(st, P2)] : ["decline"];
    };
    const run = phase(s, [TELEKINESIS, ASSAULT], undefined, defends);
    expect(damageOf(run.state, hero(run.state, P2))).toBeGreaterThanOrEqual(3);
    expect(damageOf(run.state, hero(run.state, P1))).toBe(0);
  });
});
