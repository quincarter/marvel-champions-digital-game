import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
  hasKeyword,
  keywordTotal,
  mainSchemeValue,
  maxHitPoints,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { APOCALYPSE, APOCALYPSE_SKIPPED } from "./apocalypse.js";
import { PRELATES } from "./prelates.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Apocalypse scenario's villain, main scheme and `apocalypse` set (docs/phase7-wave8.md §2.7, §3.18 to §3.22).
 * There is no wave 8 scenario builder yet, so the game is Core's Rhino config with the villain (stages II to IV),
 * main scheme, the five Prelates and The Tyrant's Throne set aside, and the `apocalypse` set (without its chained
 * cards) added to the encounter deck by hand. Step 12a's Setup runs for real.
 */
const STAGE_II = 1;
const STAGE_IV = 3;
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, APOCALYPSE, PRELATES) };

const PRELATE_CODES = ["45179b", "45180b", "45181b", "45182b", "45183b"];
const HEART = "45104a";
const CITADEL = "45104b";
const THRONE = "45105a";
const NLW = "45105b";
const CYBERPATHY = "45106";
const BIOMORPHING = "45107";
const MOLECULAR = "45108";
const FITTEST = "45109";
const WOLF = "45110";

const REGISTERED = [
  "45102b.apocalypse-constant",
  "45102b.apocalypse-forced-interrupt",
  "45103b.the-age-of-apocalypse-constant",
  "45103a.setup",
  "45104a.heart-of-the-empire-constant",
  "45104a.when-defeated",
  "45104b.the-towering-citadel-constant",
  "45104b.when-defeated",
  "45105a.the-tyrants-throne-constant",
  "45105a.when-defeated",
  "45105b.no-longer-worthy-constant",
  "45105b.no-longer-worthy-forced-interrupt",
  "45106.cyberpathy-forced-response",
  "45106.boost",
  "45107.biomorphing-constant",
  "45107.boost",
  "45108.molecular-control-constant",
  "45108.boost",
  "45109.the-fittest-constant",
  "45109.the-fittest-constant-2",
  "45110.when-revealed",
  "45110.boost",
];

interface Opts {
  readonly players?: number;
  readonly stage?: number;
  /** Cards (by code) added to the encounter deck in addition to the set. */
  readonly extra?: readonly string[];
}

function setupGame(opts: Opts = {}): GameState {
  const decks = ["core-spider-man-justice", "core-captain-marvel-leadership", "core-black-panther-protection"];
  const config = coreScenario("rhino", {
    players: decks.slice(0, opts.players ?? 1).map((starterDeckId) => ({ starterDeckId })),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const set = encounterSetId("apocalypse");
  const copies = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(set) &&
      !["45104b", "45105a", "45105b"].includes(c.id as string) &&
      (c.type as string) !== "villain" &&
      (c.type as string) !== "main_scheme",
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: "45101a" as typeof config.villainCardId,
      villainSide: "A",
      villainStartStageIndex: opts.stage ?? STAGE_II,
      villainLastStageIndex: STAGE_IV,
      mainSchemeCardId: "45103a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies, ...((opts.extra ?? []) as never[])],
      setAside: [...PRELATE_CODES, THRONE] as never[],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const dataOf = (code: string) =>
  AOA_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const allIds = (s: GameState) => Object.keys(s.instances) as InstanceId[];
const byCode = (s: GameState, code: string) => allIds(s).filter((id) => codeOf(s, id) === code);
const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => codeOf(s, id) === code);
const villain = (s: GameState): InstanceId => s.activeVillainId!;
/** The Prelates in play (engaged with someone). */
const prelatesInPlay = (s: GameState) =>
  allIds(s).filter((id) => PRELATE_CODES.includes(codeOf(s, id)) && inst(s, id).engagedWith !== null);
const prelatesAside = (s: GameState) =>
  allIds(s).filter(
    (id) => PRELATE_CODES.includes(codeOf(s, id)) && inst(s, id).engagedWith === null && !inVictory(s, id),
  );
const inVictory = (s: GameState, id: InstanceId) => s.victoryDisplay.includes(id);

function drive(state: GameState, ...commands: Command[]) {
  return driveEventsPicking(DEPS, state, firstLegal, ...commands);
}
const thwart = (s: GameState, scheme: InstanceId, player = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: identityOf(s, player),
  schemeInstanceId: scheme,
});
const attack = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s, P1),
  targetInstanceId: target,
});
const readied = (s: GameState, player = P1) => patchInstance(s, identityOf(s, player), { exhausted: false });
const asHero = (s: GameState) => withForm(s, { heroForm: 0 });
/** The first `n` blank boost cards (no icons, no Boost ability) stacked on the encounter deck, then `then`. */
const blanks = (s: GameState, n: number) => {
  const piles = Object.values(s.encounterDecks)[0]!;
  return [...piles.deck, ...piles.discard]
    .map((id) => codeOf(s, id))
    .filter((c) => c === "01186" || c === "01187")
    .slice(0, n);
};
/** One boost card for the villain, one for the Prelate (and one for the Prelate's second activation), then `reveals`. */
const stackBlank = (s: GameState, ...reveals: string[]) => stackEncounterDeck(s, ...blanks(s, 2), ...reveals);
/** The boost cards are `code` first (Apocalypse's own activation), then blanks. */
const stackBlankFirst = (s: GameState, code: string) => stackEncounterDeck(s, code, ...blanks(s, 2));
const stackBlankAfter = (s: GameState, code: string) => stackEncounterDeck(s, code, ...blanks(s, 2));
const defeatAll = (s: GameState): GameState => {
  let cur = asHero(s);
  for (const id of prelatesInPlay(s)) {
    cur = patchInstance(cur, id, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    cur = defeatWithAttack(DEPS, readied(cur), id);
  }
  return readied(cur);
};
/** The identity's THW and ATK are small: give it room by patching the scheme or enemy near zero first. */

describe("registry", () => {
  it("registers every ref the card data names except the skipped ones, each a valid definition", () => {
    expect(Object.keys(APOCALYPSE).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(APOCALYPSE)) expect(validateDefinition(def), id).toEqual([]);
    const refs = [
      "45101a",
      "45103a",
      HEART,
      CITADEL,
      THRONE,
      NLW,
      CYBERPATHY,
      BIOMORPHING,
      MOLECULAR,
      FITTEST,
      WOLF,
      "45111",
    ].flatMap((code) => {
      const card = dataOf(code) as {
        abilities?: { id: string }[];
        stages?: { abilities?: { id: string }[]; aSide?: { abilities?: { id: string }[] } }[];
        sides?: { stages: { abilities?: { id: string }[] }[] }[];
      };
      return [
        ...(card.abilities ?? []),
        ...(card.stages ?? []).flatMap((s) => [...(s.abilities ?? []), ...(s.aSide?.abilities ?? [])]),
        ...(card.sides ?? []).flatMap((side) => side.stages.flatMap((s) => s.abilities ?? [])),
      ].map((a) => a.id);
    });
    for (const id of refs) expect(id in APOCALYPSE || id in APOCALYPSE_SKIPPED, id).toBe(true);
    for (const id of Object.keys(APOCALYPSE_SKIPPED)) expect(refs, id).toContain(id);
    expect(Object.keys(APOCALYPSE_SKIPPED).sort()).toEqual([
      "45101a.apocalypse-forced-interrupt",
      "45101b.apocalypse-forced-interrupt",
      "45102a.apocalypse-forced-interrupt",
      "45103b.the-age-of-apocalypse-forced-interrupt",
      "45105b.no-longer-worthy-constant-2",
      "45111.when-defeated",
    ]);
  });
});

describe("The Age of Apocalypse: target threat and Setup", () => {
  it("1 player, stage II (9 hit points): target threat 9", () => {
    const s = setupGame();
    expect(mainSchemeValue(s, "targetThreat", DEPS)).toBe(9);
  });

  it("3 players: stage II 27, stage III 30 (his printed hit points scaled per player)", () => {
    expect(mainSchemeValue(setupGame({ players: 3 }), "targetThreat", DEPS)).toBe(27);
    expect(mainSchemeValue(setupGame({ players: 3, stage: 2 }), "targetThreat", DEPS)).toBe(30);
  });

  it("SETUP: Heart of the Empire is in play with 2 threat and the first player has a tough, engaged Prelate; four stay aside", () => {
    const s = setupGame();
    const heart = inVillainArea(s, HEART);
    expect(heart).toHaveLength(1);
    expect(inst(s, heart[0]!).threat).toBe(2);
    const prelates = prelatesInPlay(s);
    expect(prelates).toHaveLength(1);
    expect(inst(s, prelates[0]!).engagedWith).toBe(P1);
    expect(inst(s, prelates[0]!).statuses.tough).toBe(1);
    expect(prelatesAside(s)).toHaveLength(4);
    expect(byCode(s, THRONE)).toHaveLength(1);
    expect(inVillainArea(s, THRONE)).toHaveLength(0);
  });

  it("the same seed reveals the same Prelate", () => {
    const a = codeOf(setupGame(), prelatesInPlay(setupGame())[0]!);
    const b = codeOf(setupGame(), prelatesInPlay(setupGame())[0]!);
    expect(a).toBe(b);
  });
});

describe("the side scheme chain (45104a, 45104b, 45105a)", () => {
  /** A scheme with 2 threat is thwarted in one go by the hero's basic thwart. */
  const thwartOut = (s: GameState, scheme: InstanceId, player = P1) => {
    const hero = readied(asHero(s), player);
    return drive(hero, thwart(hero, scheme, player));
  };
  /** Every Prelate in play defeated by a real attack (the victory display, never picked again). */
  const defeatPrelates = (s: GameState): GameState => {
    let cur = asHero(s);
    for (const id of prelatesInPlay(s)) {
      cur = patchInstance(cur, id, { statuses: { stunned: 0, confused: 0, tough: 0 } });
      cur = defeatWithAttack(DEPS, readied(cur), id);
    }
    return cur;
  };

  it("threat cannot be removed from Heart of the Empire while a Prelate is in play", () => {
    const s = setupGame({ players: 3 });
    const heart = inVillainArea(s, HEART)[0]!;
    const run = thwartOut(s, heart);
    expect(inst(run.state, heart).threat).toBe(2);
    expect(inVillainArea(run.state, HEART)).toHaveLength(1);
  });

  it("Heart defeated: a second Prelate is revealed, players 2 and 3 are dealt 1 facedown card each, Heart flips to The Towering Citadel (3 threat)", () => {
    const s = defeatPrelates(setupGame({ players: 3 }));
    const heart = inVillainArea(s, HEART)[0]!;
    const run = thwartOut(patchInstance(s, heart, { threat: 1 }), heart);
    expect(prelatesInPlay(run.state)).toHaveLength(1);
    expect(prelatesAside(run.state)).toHaveLength(3);
    expect(playerOf(run.state, P2).dealtEncounter).toHaveLength(1);
    expect(playerOf(run.state, "p3" as never).dealtEncounter).toHaveLength(1);
    expect(playerOf(run.state, P1).dealtEncounter).toHaveLength(0);
    const citadel = inVillainArea(run.state, CITADEL);
    expect(citadel).toHaveLength(1);
    expect(inst(run.state, citadel[0]!).threat).toBe(3);
    expect(inst(run.state, prelatesInPlay(run.state)[0]!).engagedWith).toBe(P1);
  });

  it("Citadel defeated: a third Prelate, cards dealt, The Tyrant's Throne in play with 4 threat, the Citadel removed from the game", () => {
    const s0 = defeatPrelates(setupGame({ players: 3 }));
    const afterHeart = defeatPrelates(
      thwartOut(patchInstance(s0, inVillainArea(s0, HEART)[0]!, { threat: 1 }), inVillainArea(s0, HEART)[0]!).state,
    );
    const citadel = inVillainArea(afterHeart, CITADEL)[0]!;
    const run = thwartOut(patchInstance(afterHeart, citadel, { threat: 1 }), citadel);
    expect(prelatesInPlay(run.state)).toHaveLength(1);
    expect(prelatesAside(run.state)).toHaveLength(2);
    const throne = inVillainArea(run.state, THRONE);
    expect(throne).toHaveLength(1);
    expect(inst(run.state, throne[0]!).threat).toBe(4);
    expect(inVillainArea(run.state, CITADEL)).toHaveLength(0);
    expect(run.state.removedFromGame).toContain(citadel);
  });

  it("Throne defeated: a fourth Prelate (one still aside) and No Longer Worthy attached to Apocalypse, healing 5", () => {
    const s0 = defeatPrelates(setupGame({ players: 3 }));
    const s1 = defeatPrelates(
      thwartOut(patchInstance(s0, inVillainArea(s0, HEART)[0]!, { threat: 1 }), inVillainArea(s0, HEART)[0]!).state,
    );
    const s2 = defeatPrelates(
      thwartOut(patchInstance(s1, inVillainArea(s1, CITADEL)[0]!, { threat: 1 }), inVillainArea(s1, CITADEL)[0]!).state,
    );
    const hurt = patchInstance(s2, villain(s2), { damage: 20 });
    const throne = inVillainArea(hurt, THRONE)[0]!;
    const run = thwartOut(patchInstance(hurt, throne, { threat: 1 }), throne);
    expect(prelatesInPlay(run.state)).toHaveLength(1);
    expect(prelatesAside(run.state)).toHaveLength(1);
    expect(inst(run.state, villain(run.state)).attachments.map((id) => codeOf(run.state, id))).toContain(NLW);
    // 5 per player icon, 3 players: 15 healed.
    expect(inst(run.state, villain(run.state)).damage).toBe(5);
  });
});

describe("Apocalypse's attachments (45106 to 45109)", () => {
  /** Attaches `code` (from the encounter deck) to `host` by surgery, no reveal. */
  const attach = (s: GameState, code: string, host: InstanceId) => attachToHost(s, code, host).state;
  const attachedTo = (s: GameState, host: InstanceId, code: string) =>
    inst(s, host).attachments.some((id) => codeOf(s, id) === code);

  it("Cyberpathy: after Apocalypse schemes, 1 threat on each side scheme", () => {
    const s = setupGame();
    const withCyber = attach(s, CYBERPATHY, villain(s));
    const heart = inVillainArea(withCyber, HEART)[0]!;
    const before = inst(withCyber, heart).threat;
    const run = drive(withForm(stackBlank(withCyber), "alterEgo"), { type: "endTurn", playerId: P1 });
    // Step one adds acceleration to the main scheme only; the Heart gains 1 from Cyberpathy per Apocalypse scheme.
    expect(inst(run.state, heart).threat - before).toBe(
      events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villain(run.state)).length,
    );
    expect(events(run.events, "schemeResolved").length).toBeGreaterThan(0);
  });

  it("Biomorphing gives Apocalypse overkill on its own, as does stage IV", () => {
    const s = setupGame();
    expect(hasKeyword(s, villain(s), "overkill", DEPS)).toBe(false);
    expect(hasKeyword(attach(s, BIOMORPHING, villain(s)), villain(s), "overkill", DEPS)).toBe(true);
    const iv = setupGame({ stage: STAGE_IV });
    expect(hasKeyword(iv, villain(iv), "overkill", DEPS)).toBe(true);
  });

  it("Molecular Control gives retaliate 1 and stalwart", () => {
    const s = setupGame();
    const mc = attach(s, MOLECULAR, villain(s));
    expect(keywordTotal(s, villain(s), "retaliate", DEPS)).toBe(0);
    expect(keywordTotal(mc, villain(mc), "retaliate", DEPS)).toBe(1);
    expect(hasKeyword(mc, villain(mc), "stalwart", DEPS)).toBe(true);
  });

  it("the boost on all three attaches the card to Apocalypse", () => {
    for (const code of [CYBERPATHY, BIOMORPHING, MOLECULAR]) {
      const s = setupGame();
      const run = drive(withForm(stackBlankAfter(s, code), "alterEgo"), { type: "endTurn", playerId: P1 });
      expect(attachedTo(run.state, villain(run.state), code), code).toBe(true);
    }
  });

  it("The Fittest attaches to the minion with the highest printed hit points, gives it a tough card and 5 more hit points", () => {
    const s = setupGame();
    const prelate = prelatesInPlay(s)[0]!;
    const noTough = patchInstance(s, prelate, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const base = maxHitPoints(noTough, prelate, DEPS)!;
    const run = drive(withForm(stackBlank(noTough, FITTEST), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(attachedTo(run.state, prelate, FITTEST)).toBe(true);
    expect(inst(run.state, prelate).statuses.tough).toBe(1);
    // Abyss also gains 2 for each facedown card his own response attaches; count them.
    const facedown = inst(run.state, prelate).attachments.filter((id) => !inst(run.state, id).faceup).length;
    expect(maxHitPoints(run.state, prelate, DEPS)).toBe(base + 5 + 2 * facedown);
  });

  it("The Fittest with no minion in play gains surge (it is not attached)", () => {
    const s = defeatAll(setupGame());
    const run = drive(withForm(stackBlank(s, FITTEST), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(byCode(run.state, FITTEST).some((id) => run.state.villainArea.includes(id))).toBe(false);
    expect(events(run.events, "encounterCardRevealed").length).toBeGreaterThan(1);
  });
});

describe("Wolf Among Sheep (45110)", () => {
  it("WHEN REVEALED: the Prelate minion activates against you (alter-ego: it schemes)", () => {
    const s = setupGame();
    const prelate = prelatesInPlay(s)[0]!;
    const run = drive(withForm(stackBlank(s, WOLF), "alterEgo"), { type: "endTurn", playerId: P1 });
    const own = events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === prelate);
    // Once in the villain phase and once for the card.
    expect(own).toHaveLength(2);
  });

  it("with no Prelate in play Apocalypse activates against you instead", () => {
    const s = defeatAll(setupGame());
    const run = drive(withForm(stackBlank(s, WOLF), "alterEgo"), { type: "endTurn", playerId: P1 });
    const own = events(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villain(run.state));
    expect(own).toHaveLength(2);
  });

  it("BOOST: gives the Prelate a tough status card, otherwise Apocalypse", () => {
    const s = setupGame();
    const prelate = prelatesInPlay(s)[0]!;
    const bare = patchInstance(s, prelate, { statuses: { stunned: 0, confused: 0, tough: 0 } });
    const run = drive(withForm(stackBlankFirst(bare, WOLF), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(inst(run.state, prelate).statuses.tough).toBe(1);
  });
});

describe("No Longer Worthy (45105b) and Apocalypse IV", () => {
  const withNlw = (extraPrelate: boolean) => {
    const s = setupGame({ extra: [NLW] });
    const attached = attachToHost(s, NLW, villain(s));
    return extraPrelate ? attached.state : defeatAll(attached.state);
  };

  it("he cannot take damage while a Prelate minion is in play", () => {
    const s = asHero(withNlw(true));
    // The attack is not even a legal action: that enemy cannot take damage.
    expect(() => drive(s, attack(s, villain(s)))).toThrow(/cannot take damage/);
  });

  it("FORCED INTERRUPT: when he is defeated the players win", () => {
    const s = asHero(withNlw(false));
    expect(prelatesInPlay(s)).toHaveLength(0);
    const done = defeatWithAttack(
      DEPS,
      patchInstance(s, villain(s), { statuses: { stunned: 0, confused: 0, tough: 0 } }),
      villain(s),
    );
    expect(done.outcome).toMatchObject({ result: "win" });
  });

  it("Apocalypse IV: when the main scheme is completed the players lose", () => {
    const s = setupGame({ stage: STAGE_IV });
    const full = patchInstance(s, s.mainScheme.instanceId, { threat: mainSchemeValue(s, "targetThreat", DEPS) });
    const run = drive(withForm(stackBlank(full), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });
});

describe("skipped refs: proofs of the gaps (engine queue tasks 24 to 26)", () => {
  it.fails("task 24: stage II at its target threat reveals Apocalypse III instead of ending the game", () => {
    const s = setupGame();
    const full = patchInstance(s, s.mainScheme.instanceId, { threat: 9 });
    const run = drive(withForm(stackBlank(full), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(run.state.outcome).toBeUndefined();
    expect(events(run.events, "villainStageRevealed" as never)).toHaveLength(1);
  });

  it("today (companion): without the interrupt, completing the main scheme at stage II loses the game", () => {
    const s = setupGame();
    const full = patchInstance(s, s.mainScheme.instanceId, { threat: 9 });
    const run = drive(withForm(stackBlank(full), "alterEgo"), { type: "endTurn", playerId: P1 });
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });

  it("tasks 25 and 26 (companion): today damage that would defeat Apocalypse II defeats him, revealing stage III, with no heal instead", () => {
    const s = asHero(defeatAll(setupGame()));
    const done = defeatWithAttack(
      DEPS,
      patchInstance(s, villain(s), { statuses: { stunned: 0, confused: 0, tough: 0 } }),
      villain(s),
    );
    expect(maxHitPoints(s, villain(s), DEPS)).toBe(9);
    expect(maxHitPoints(done, villain(done), DEPS)).toBe(10);
  });
});
