import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  cardsInPlay,
  createGame,
  hasKeyword,
  mainSchemeStage,
  villainOf,
  villainStageOf,
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
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { EN_SABAH_NUR, EN_SABAH_NUR_SKIPPED } from "./en-sabah-nur.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The En Sabah Nur scenario's villain, main scheme and set (45184a with its nine faces, 45147a with stages 1 and 2,
 * 45149 to 45155), docs/phase7-wave8.md section 2.9, 3.26, 3.27, 4.1 Q16. There is no wave 8 scenario builder yet, so the
 * game is Core's Rhino config with the villain, main scheme, stage range and the set swapped in by hand. Setup runs for
 * real: Apocalypse starts in Biomorph (the villain's starting side) and each player is dealt a facedown encounter
 * card, which `calm` sets aside so a villain phase reveals only what a test stacks.
 */
const BIOMORPH_BLAST = "45150";
const INTERFACE = "45151";
const DESPOT = "45152";
const STRENGTH = "45149";
const SOURCE = "45153";
const PLUGGED = "45154";
const GROWTH = "45155";
const BLANK = "01186";
const BLANK_2 = "01187";
const SET = [STRENGTH, BIOMORPH_BLAST, INTERFACE, DESPOT, SOURCE, PLUGGED, GROWTH];
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, EN_SABAH_NUR) };

const REFS = [
  "45184a.apocalypse-constant",
  "45184a.apocalypse-forced-response",
  "45185a.apocalypse-constant",
  "45185a.apocalypse-forced-response",
  "45186a.apocalypse-constant",
  "45186a.apocalypse-forced-response",
  "45184b.apocalypse-forced-response",
  "45185b.apocalypse-forced-response",
  "45186b.apocalypse-forced-response",
  "45184c.apocalypse-forced-response",
  "45185c.apocalypse-forced-response",
  "45186c.apocalypse-forced-response",
  "45147a.setup",
  "45147b.en-sabah-nurs-pyramid-forced-response",
  "45148a.when-revealed",
  "45148b.the-rise-of-apocalypse-forced-response",
  "45149.staggering-strength-constant",
  "45149.staggering-strength-forced-interrupt",
  "45149.boost",
  "45150.when-revealed",
  "45150.boost",
  "45151.when-revealed",
  "45151.boost",
  "45152.when-revealed",
  "45152.boost",
  "45153.when-defeated",
  "45154.when-defeated",
  "45155.when-defeated",
];

const DECKS = ["core-spider-man-justice", "core-captain-marvel-leadership"];
interface Opts {
  readonly players?: number;
  /** 0 is stage I, 1 stage II. */
  readonly stage?: number;
  readonly side?: "A" | "B" | "C";
  readonly extra?: readonly string[];
}

function setupGame(opts: Opts = {}): GameState {
  const config = coreScenario("rhino", {
    players: DECKS.slice(0, opts.players ?? 1).map((starterDeckId) => ({ starterDeckId })),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const copies = AOA_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      c.encounterSetIds.includes(encounterSetId("en_sabah_nur")) &&
      SET.includes(c.id as string),
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: "45184a" as typeof config.villainCardId,
      villainSide: opts.side ?? "A",
      villainStartStageIndex: opts.stage ?? 0,
      villainLastStageIndex: 1,
      mainSchemeCardId: "45147a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies, ...((opts.extra ?? []) as never[])],
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
const apoc = (s: GameState): InstanceId => s.activeVillainId!;
const side = (s: GameState) => villainOf(s, apoc(s))!.side;
const stage = (s: GameState): number => villainStageOf(s, apoc(s)).stageNumber;
const damage = (s: GameState) => inst(s, apoc(s)).damage;
const toughOf = (s: GameState) => inst(s, apoc(s)).statuses.tough ?? 0;
const inPlayCards = (s: GameState, code: string) => cardsInPlay(s).filter((id) => codeOf(s, id) === code);
const powerOn = (s: GameState) => inst(s, s.mainScheme.instanceId).counters.power ?? 0;
const threatOn = (s: GameState, id: InstanceId) => inst(s, id).threat;

/** Round state: the dealt facedown cards set aside under the deck, the main scheme at `threat`, the villain damaged. */
function calm(state: GameState, opts: { threat?: number; damage?: number } = {}): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const dealt = state.players.flatMap((p) => p.dealtEncounter);
  const pile = state.encounterDecks[deckId]!;
  const cleared: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, dealtEncounter: [] })),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck, ...dealt] } },
  };
  const damaged = patchInstance(cleared, apoc(cleared), { damage: opts.damage ?? 0 });
  return patchInstance(damaged, damaged.mainScheme.instanceId, { threat: opts.threat ?? 0 });
}
const asHero = (s: GameState) => withForm(s, { heroForm: 0 });
function drive(state: GameState, ...commands: Command[]) {
  return driveEventsPicking(DEPS, state, firstLegal, ...commands);
}
/** One round with player 1 as they are: a boost card, then `reveals`; every player ends their turn. */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: boolean } = {},
) {
  const players = state.players.length;
  const boosts = opts.boosts ?? Array.from({ length: players }, (_, i) => (i === 0 ? BLANK : BLANK_2));
  // Blank boost cards after the reveals, for the activations a revealed card causes.
  const named = [...boosts, ...(opts.reveals ?? [])];
  const spare = [BLANK, BLANK_2].filter((code) => !named.includes(code));
  const stacked = stackEncounterDeck(state, ...named, ...spare);
  const ids = state.players.map((p) => p.playerId);
  const commands: Command[] = ids.flatMap((id) => [...(opts.hero && id === P1 ? [toHero(P1)] : []), endTurn(id)]);
  return drive(stacked, ...commands);
}

describe("registry", () => {
  it("registers every ref the card data names, each a valid definition; nothing is skipped", () => {
    expect(Object.keys(EN_SABAH_NUR).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(EN_SABAH_NUR)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(EN_SABAH_NUR_SKIPPED)).toEqual([]);
  });

  it("the data names exactly these refs for the villain, the main scheme and the set", () => {
    const cards = ["45184a", "45147a", ...SET].map((code) => JSON.stringify(dataOf(code)));
    const named = new Set(
      cards.flatMap((text) => [...text.matchAll(/"id":"([0-9]+[a-c]?\.[a-z0-9-]+)"/g)].map((m) => m[1]!)),
    );
    expect([...named].filter((id) => /^\d{5}[a-c]?\./.test(id)).sort()).toEqual([...REFS].sort());
  });
});

describe("setup", () => {
  it("Apocalypse begins in Biomorph form, stage I, with nothing resolved for the form: no damage, 1 threat, no counter", () => {
    const s = setupGame();
    expect(side(s)).toBe("A");
    expect(stage(s)).toBe(1);
    expect(damage(s)).toBe(0);
    expect(mainThreat(s)).toBe(1);
    expect(powerOn(s)).toBe(0);
    expect(inst(s, identityOf(s, P1)).damage).toBe(0);
  });

  it("each player is dealt a facedown encounter card by 1A's Setup", () => {
    const s = setupGame({ players: 2 });
    expect(s.players.map((p) => p.dealtEncounter.length)).toEqual([1, 1]);
  });
});

describe("the faces", () => {
  it("Biomorph has overkill; Cyberpath retaliate 1; Giant stalwart", () => {
    const s = setupGame();
    expect(hasKeyword(s, apoc(s), "overkill", DEPS)).toBe(true);
    const cyber = setupGame({ side: "B" });
    expect(hasKeyword(cyber, apoc(cyber), "retaliate", DEPS)).toBe(true);
    expect(hasKeyword(cyber, apoc(cyber), "overkill", DEPS)).toBe(false);
    const giant = setupGame({ side: "C" });
    expect(hasKeyword(giant, apoc(giant), "stalwart", DEPS)).toBe(true);
  });

  it("stat boxes by face on stage I: Biomorph 2 ATK 1 SCH, Cyberpath 1 and 2, Giant 2 and 2", () => {
    const stats = (side: "A" | "B" | "C") => {
      const s = setupGame({ side });
      const st = villainStageOf(s, apoc(s));
      return [st.atk, st.sch];
    };
    expect([stats("A"), stats("B"), stats("C")]).toEqual([
      [2, 1],
      [1, 2],
      [2, 2],
    ]);
  });
});

describe("the treacheries (45150 to 45152)", () => {
  it("Technological Interface while Biomorph: Cyberpath, 1 threat on each scheme, a power counter; damage kept, no healing", () => {
    const s = calm(setupGame(), { damage: 7 });
    const r = round(s, { reveals: [INTERFACE] });
    expect(side(r.state)).toBe("B");
    expect(damage(r.state)).toBe(7);
    // Step one's counter, then the treachery's.
    expect(powerOn(r.state)).toBe(2);
    // Acceleration 1, the villain's own scheme (Biomorph SCH 1), then the Cyberpath face: 1 on the main scheme.
    expect(mainThreat(r.state)).toBe(3);
    expect(events(r.events, "villainFlipped").map((e) => [e.from, e.to])).toEqual([["A", "B"]]);
  });

  it("Technological Interface while Cyberpath: he activates against the player; no change, no extra counter, no face threat", () => {
    const s = calm(setupGame({ side: "B" }), { damage: 7 });
    const r = round(s, { reveals: [INTERFACE] });
    expect(side(r.state)).toBe("B");
    expect(powerOn(r.state)).toBe(1);
    expect(events(r.events, "villainFlipped")).toHaveLength(0);
    // Acceleration 1, then two schemes (the villain phase's, then the treachery's) of SCH 2.
    expect(mainThreat(r.state)).toBe(5);
  });

  it("Giant-Sized Despot as the boost card of a Cyberpath attack: the attack is 1; afterward he is Giant and heals 1", () => {
    const s = calm(asHero(setupGame({ side: "B" })), { damage: 7 });
    const r = round(s, { boosts: [DESPOT] });
    expect(side(r.state)).toBe("C");
    expect(damage(r.state)).toBe(6);
    const attack = events(r.events, "attackResolved")[0]!;
    expect([attack.baseAtk, attack.boostIcons]).toEqual([1, 0]);
  });

  it("Biomorphic Blast while Giant, 2 players: Biomorph, a power counter, 1 indirect damage to each player", () => {
    const s = calm(setupGame({ players: 2, side: "C" }));
    const r = round(s, { reveals: [BIOMORPH_BLAST, BLANK] });
    expect(side(r.state)).toBe("A");
    expect(powerOn(r.state)).toBe(2);
    expect(hasKeyword(r.state, apoc(r.state), "overkill", DEPS)).toBe(true);
    expect(r.state.players.map((p) => inst(r.state, p.identity.instanceId).damage)).toEqual([1, 1]);
  });

  it("a treachery for the form he is already in changes nothing: Biomorphic Blast while Biomorph is an activation", () => {
    const s = calm(setupGame(), { damage: 3 });
    const r = round(s, { reveals: [BIOMORPH_BLAST] });
    expect(events(r.events, "villainFlipped")).toHaveLength(0);
    expect(powerOn(r.state)).toBe(1);
    // Acceleration 1 and two Biomorph schemes of SCH 1.
    expect(mainThreat(r.state)).toBe(3);
    expect(inst(r.state, identityOf(r.state, P1)).damage).toBe(0);
  });
});

const FILLER = "01100";
const AMPLIFIED_BOOST = "01188";
/** Core's Caught Off Guard: a boost card of 1 icon with no Boost ability. */
const attack = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s, P1),
  targetInstanceId: target,
});
const thwart = (s: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: identityOf(s, P1),
  schemeInstanceId: scheme,
});

describe("Staggering Strength (45149)", () => {
  it("revealed while Cyberpath: attached, Giant, heals 1; his next attack stuns the player first and is ATK 2 + 2", () => {
    const s = calm(setupGame({ side: "B" }), { damage: 7 });
    const first = round(s, { reveals: [STRENGTH] });
    expect(side(first.state)).toBe("C");
    expect(damage(first.state)).toBe(6);
    const strength = inPlayCards(first.state, STRENGTH);
    expect(strength).toHaveLength(1);
    expect(inst(first.state, strength[0]!).attachedTo).toBe(apoc(first.state));
    // Round 2: the player is a hero, so the villain attacks.
    const hero = calm(asHero(first.state), { damage: 6 });
    const second = round(hero, { hero: false });
    const hit = events(second.events, "attackResolved")[0]!;
    expect([hit.baseAtk, hit.boostIcons]).toEqual([4, 0]);
    expect(inst(second.state, identityOf(second.state, P1)).statuses.stunned ?? 0).toBe(1);
    expect(inPlayCards(second.state, STRENGTH)).toHaveLength(0);
    // Round 3: ATK 2 without it.
    const third = round(calm(asHero(second.state), { damage: 6 }));
    expect(events(third.events, "attackResolved")[0]!.baseAtk).toBe(2);
  });

  it("revealed while Giant: it attaches and nothing else (no heal, no counter, no flip)", () => {
    const s = calm(setupGame({ side: "C" }), { damage: 7 });
    const r = round(s, { reveals: [STRENGTH] });
    expect(inPlayCards(r.state, STRENGTH)).toHaveLength(1);
    expect(damage(r.state)).toBe(7);
    expect(powerOn(r.state)).toBe(1);
    expect(events(r.events, "villainFlipped")).toHaveLength(0);
  });

  it("[star] BOOST: after the activation it is revealed (attached, he is Giant) and the attack did not use its ATK", () => {
    const s = calm(asHero(setupGame({ side: "B" })), { damage: 7 });
    const r = round(s, { boosts: [STRENGTH] });
    const hit = events(r.events, "attackResolved")[0]!;
    expect(hit.baseAtk).toBe(1);
    expect(side(r.state)).toBe("C");
    expect(inPlayCards(r.state, STRENGTH)).toHaveLength(1);
  });
});

describe("the side schemes (45153 to 45155)", () => {
  /** Round 1 reveals the scheme; round 2 the player, as a hero with a boost of `boostCode`, thwarts it. */
  function thwarted(code: string, side: "A" | "B" | "C", boostCode = BLANK) {
    const s = calm(setupGame({ side }), { damage: 7 });
    const first = round(s, { reveals: [code] });
    const scheme = inPlayCards(first.state, code)[0]!;
    const ready = stackEncounterDeck(
      patchInstance(withForm(first.state, { heroForm: 0 }), scheme, { threat: 1 }),
      boostCode,
      BLANK_2,
    );
    return { start: ready, scheme, ...drive(ready, thwart(ready, scheme)) };
  }

  it("Source of Power while Biomorph: he activates against the defeating hero; his boost card still gains 1 icon (amplify)", () => {
    const r = thwarted(SOURCE, "A", AMPLIFIED_BOOST);
    expect(side(r.state)).toBe("A");
    const hit = events(r.events, "attackResolved")[0]!;
    // Ruling January 11, 2026 (1): the scheme's amplify icon still counts when its When Defeated causes the activation.
    expect([hit.baseAtk, hit.boostIcons]).toEqual([2, 2]);
    expect(toughOf(r.state)).toBe(0);
  });

  it("Source of Power while Cyberpath: he becomes Biomorph with a tough status card and 1 indirect damage; no activation", () => {
    const r = thwarted(SOURCE, "B");
    expect(side(r.state)).toBe("A");
    expect(toughOf(r.state)).toBe(1);
    expect(events(r.events, "attackResolved")).toHaveLength(0);
    expect(inst(r.state, identityOf(r.state, P1)).damage).toBe(1);
  });

  it("Plugged In while Giant: Cyberpath, tough, 1 threat on each scheme, no activation", () => {
    const r = thwarted(PLUGGED, "C");
    expect(side(r.state)).toBe("B");
    expect(toughOf(r.state)).toBe(1);
    expect(events(r.events, "attackResolved")).toHaveLength(0);
  });

  it("Plugged In while Cyberpath: he activates against the defeating hero (retaliate stays), no change", () => {
    const r = thwarted(PLUGGED, "B");
    expect(side(r.state)).toBe("B");
    expect(toughOf(r.state)).toBe(0);
    expect(events(r.events, "attackResolved")).toHaveLength(1);
  });

  it("Giant Growth while Biomorph: Giant, tough, healed 1; while Giant he activates", () => {
    const changed = thwarted(GROWTH, "A");
    expect(side(changed.state)).toBe("C");
    expect(toughOf(changed.state)).toBe(1);
    expect(damage(changed.state)).toBe(6);
    expect(events(changed.events, "attackResolved")).toHaveLength(0);
    const same = thwarted(GROWTH, "C");
    expect(side(same.state)).toBe("C");
    expect(toughOf(same.state)).toBe(0);
    expect(events(same.events, "attackResolved")).toHaveLength(1);
  });
});

describe("the faces' Forced Responses", () => {
  it("stage II Cyberpath places 2 threat on each scheme", () => {
    const s = calm(setupGame({ stage: 1 }), { damage: 7 });
    const r = round(s, { reveals: [INTERFACE] });
    expect(side(r.state)).toBe("B");
    // Acceleration 1, the stage II Biomorph scheme (SCH 1) and the face's 2.
    expect(mainThreat(r.state)).toBe(4);
  });

  it("Cyberpath's retaliate: a basic attack on him hurts the attacker for 1", () => {
    const s = asHero(calm(setupGame({ side: "B" })));
    const r = drive(s, attack(s, apoc(s)));
    expect(inst(r.state, identityOf(r.state, P1)).damage).toBe(1);
  });

  it("an ability of the starting face does not fire: Biomorph at setup dealt no indirect damage (see setup)", () => {
    const s = setupGame({ players: 2 });
    expect(s.players.map((p) => inst(s, p.identity.instanceId).damage)).toEqual([0, 0]);
  });
});

describe("the main scheme (45147a): power counters", () => {
  it("each villain phase's step one places 1 power counter: 1, 2, 3 after three rounds", () => {
    let s = calm(setupGame(), { threat: 0 });
    const counts: number[] = [];
    for (let i = 0; i < 3; i++) {
      s = calm(round(s, { reveals: [] }).state, { threat: 0 });
      counts.push(powerOn(s));
    }
    expect(counts).toEqual([1, 2, 3]);
  });

  const SUPERPOWER_CARDS = [SOURCE, PLUGGED, GROWTH];
  const revealedSchemes = (st: GameState) => SUPERPOWER_CARDS.filter((code) => inPlayCards(st, code).length > 0);
  const withPower = (st: GameState, n: number) =>
    patchInstance(st, st.mainScheme.instanceId, { counters: { power: n } });

  it("at 4 the first player removes all 4 and discards until a SUPERPOWER card, revealing it (Giant Growth, 5 threat)", () => {
    const s = withPower(calm(setupGame()), 3);
    // Step one's top two cards: a filler that is discarded, then the SUPERPOWER card; the next is the boost card.
    const r = round(s, { boosts: [FILLER, GROWTH, BLANK] });
    expect(powerOn(r.state)).toBe(0);
    expect(inPlayCards(r.state, GROWTH)).toHaveLength(1);
    expect(threatOn(r.state, inPlayCards(r.state, GROWTH)[0]!)).toBe(5);
    expect(
      r.state.encounterDecks[Object.keys(r.state.encounterDecks)[0]!]!.discard.map((id) => codeOf(r.state, id)),
    ).toContain(FILLER);
    expect(inPlayCards(r.state, FILLER)).toHaveLength(0);
  });

  it("at 5 (4 removed) one is left", () => {
    const s = withPower(calm(setupGame()), 4);
    const r = round(s, { boosts: [GROWTH, BLANK] });
    expect(powerOn(r.state)).toBe(1);
    expect(revealedSchemes(r.state)).toEqual([GROWTH]);
  });

  it("a treachery that brings the count to 4 reveals nothing until the next step one, which makes 5, removes 4 and leaves 1", () => {
    const s = withPower(calm(setupGame({ side: "C" })), 2);
    const first = round(s, { reveals: [BIOMORPH_BLAST] });
    expect(powerOn(first.state)).toBe(4);
    expect(revealedSchemes(first.state)).toEqual([]);
    const next = round(calm(first.state), { boosts: [SOURCE, BLANK] });
    expect(powerOn(next.state)).toBe(1);
    expect(revealedSchemes(next.state)).toEqual([SOURCE]);
  });

  it("completing 1B (8 threat for 1 player) advances to The Rise of Apocalypse: 2A reveals a SUPERPOWER card for the first player, 2B starts with 1 threat", () => {
    const s = withPower(calm(setupGame(), { threat: 7 }), 3);
    const r = round(s, { boosts: [FILLER, GROWTH, BLANK] });
    expect(mainSchemeStage(r.state).stageNumber).toBe(2);
    expect(events(r.events, "mainSchemeAdvanced")).toHaveLength(1);
    expect(inPlayCards(r.state, GROWTH)).toHaveLength(1);
    // The counters go back to the pool with the old stage (RRG p. 27); 2B's own step-one response then ran.
    expect(powerOn(r.state)).toBeLessThanOrEqual(1);
  });
});

describe("stage changes keep the form (Q16 = A)", () => {
  /** Stage I at 15 damage, defeated by a hero's attack while in `side`. */
  function defeatedAs(side: "A" | "B" | "C") {
    const s = asHero(calm(setupGame({ side }), { damage: 15 }));
    return drive(s, attack(s, apoc(s)));
  }

  it("defeated as Cyberpath, stage II is Cyberpath: no face response, no threat on any scheme, no power counter", () => {
    const base = calm(asHero(setupGame({ side: "B" })), { damage: 15 });
    const r = drive(base, attack(base, apoc(base)));
    expect(stage(r.state)).toBe(2);
    expect(side(r.state)).toBe("B");
    expect(mainThreat(r.state)).toBe(0);
    expect(powerOn(r.state)).toBe(0);
    expect(events(r.events, "villainFlipped")).toHaveLength(0);
  });

  it("defeated as Giant, stage II is Giant with no heal; as Biomorph, Biomorph with no indirect damage", () => {
    const giant = defeatedAs("C");
    expect([stage(giant.state), side(giant.state), damage(giant.state)]).toEqual([2, "C", 0]);
    const biomorph = defeatedAs("A");
    expect([stage(biomorph.state), side(biomorph.state)]).toEqual([2, "A"]);
    expect(inst(biomorph.state, identityOf(biomorph.state, P1)).damage).toBe(0);
  });
});

describe("a change of form is not a reveal (MC45 p. 19; spec 3.26)", () => {
  const villainReveals = (run: readonly GameEvent[], st: GameState) =>
    events(run, "encounterCardRevealed").filter((e) => e.instanceId === apoc(st));

  function changeByTreachery() {
    const s = calm(setupGame(), { damage: 7 });
    return { s, ...round(s, { reveals: [INTERFACE] }) };
  }

  it("the log shows no reveal of the villain when a treachery changes his form: the face turns and its Forced Response resolves", () => {
    const r = changeByTreachery();
    expect(villainReveals(r.events, r.state)).toHaveLength(0);
    expect(side(r.state)).toBe("B");
    expect(events(r.events, "villainFlipped")).toMatchObject([{ instanceId: apoc(r.state), from: "A", to: "B" }]);
  });

  it("stalwart discards his stunned card when he turns Giant (Giant Growth defeated while he is Biomorph and stunned)", () => {
    const s0 = calm(setupGame(), { damage: 7 });
    const first = round(s0, { reveals: [GROWTH] });
    const scheme = inPlayCards(first.state, GROWTH)[0]!;
    const staged = stackEncounterDeck(
      patchInstance(patchInstance(withForm(first.state, { heroForm: 0 }), scheme, { threat: 1 }), apoc(first.state), {
        statuses: { stunned: 1, confused: 0, tough: 0 },
      }),
      BLANK,
    );
    expect(inst(staged, apoc(staged)).statuses.stunned).toBe(1);
    const r = drive(staged, thwart(staged, scheme));
    expect(side(r.state)).toBe("C");
    expect(inst(r.state, apoc(r.state)).statuses.stunned ?? 0).toBe(0);
  });
});
