import { BP_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../../testing/staging.js";
import { BP_DEPS, bpGame, bpHeroGame, putInPlay } from "../testing.js";
import {
  BLACK_PANTHER_OBLIGATION_NEMESIS as REGISTRY,
  BLACK_PANTHER_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Black Panther's obligation and nemesis set (51031 T'Challa's Shadow; 51032 Klaw, 51033 Manipulated M.U.S.I.C.,
 * 51034 M.U.S.I.C., 51035 The Scream), docs/phase7-wave9.md section 7, 3.52. The real precon `bp-justice` against
 * Rhino (stage 1: ATK 2, SCH 1). Black Panther hero face: THW 2, ATK 2 (basic attack deals 2), DEF 1. The cards are
 * revealed through the engine's villain phase: the card under test is placed behind Advance fillers (0 boost icons).
 */
const SHADOW = "51031";
const KLAW = "51032";
const MANIPULATED = "51033";
const MUSIC = "51034";
const SCREAM = "51035";
const NEMESIS = [KLAW, MANIPULATED, MUSIC, SCREAM, SCREAM];
const BOOST_FILLER = "01186"; // Advance: 0 boost icons
const REFS = [
  "51031.tchallas-shadow-constant",
  "51031.tchallas-shadow-forced-response",
  "51032.klaw-forced-interrupt",
  "51033.when-revealed",
  "51033.when-defeated",
  "51034.when-revealed",
  "51034.when-defeated",
  "51035.when-revealed",
  "51035.boost",
];

const card = (code: string) => BP_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const setAsideCodes = (s: GameState): string[] => playerOf(s, P1).setAside.map((id) => codeOf(s, id));
const encounterCodes = (s: GameState, zone: "deck" | "discard"): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d[zone].map((i) => codeOf(s, i)));
const stunned = (s: GameState, id: InstanceId): number => inst(s, id).statuses.stunned;
const doubt = (s: GameState, id: InstanceId): number => inst(s, id).counters.doubt ?? 0;

const picker =
  (opts: { readonly seen?: string[] } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    opts.seen?.push(choice.prompt.kind);
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    return firstLegal(s);
  };
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(BP_DEPS, s, pick, ...commands);
const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));

/** The card `code`: Black Panther's set-aside copy, else the first in the encounter deck. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;

/** The card `id` (set aside or in the deck) behind `boosts` fillers, so it is revealed to P1 in the next villain phase. */
function stagedForReveal(s: GameState, id: InstanceId, boosts: number): GameState {
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const rest = pile.deck.filter((i) => i !== id);
  const fillers = rest.slice(0, boosts);
  const stripped: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: [...fillers, id, ...rest.slice(boosts)] } },
  };
  return fillers.reduce((acc, f) => relabel(acc, f, BOOST_FILLER), stripped);
}
/** `code` revealed to P1 in the next villain phase (after Rhino's boost card). */
function reveal(s: GameState, code: string, pick: Picker = picker()) {
  const id = findCard(s, code);
  const staged = stagedForReveal(s, id, 1);
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
/** `code` as the next villain boost card. */
function asBoost(s: GameState, code: string, pick: Picker = picker()) {
  const id = findCard(s, code);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const staged: GameState = {
    ...s,
    players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
    encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck.filter((i) => i !== id)] } },
  };
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
/** A set-aside card put into play engaged with P1 (a minion) by surgery. */
function engaged(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        setAside: p.setAside.filter((i) => i !== id),
        playArea: p.playerId === P1 ? [...p.playArea, id] : p.playArea,
      })),
      instances: { ...s.instances, [id]: { ...s.instances[id]!, faceup: true, controllerId: null, engagedWith: P1 } },
    },
  };
}
/** Fillers (0 boost icons) over the first `n` cards of the encounter deck. */
function filled(s: GameState, n: number): GameState {
  const pile = s.encounterDecks[activeEncounterDeckId(s)]!;
  return pile.deck.slice(0, n).reduce((acc, id) => relabel(acc, id, BOOST_FILLER), s);
}
/** Staging: the obligation in P1's play area with 4 doubt counters, as revealing it leaves it. */
function holding(s: GameState): { state: GameState; id: InstanceId } {
  const { state, id } = reveal(s, SHADOW);
  return { state: patchInstance(state, identityOf(state), { damage: 0 }), id };
}

describe("registry", () => {
  it("registers every ref of the five cards; nothing is skipped", () => {
    const refs = BP_CARDS.filter((c) => (c.id as string) >= SHADOW && (c.id as string) <= SCREAM).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id as never]!)).toEqual([]);
  });
  it("timing: Shadow a forced response, Klaw a forced interrupt, the When Defeated and Boost abilities as printed", () => {
    expect(REGISTRY["51031.tchallas-shadow-forced-response" as never]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["51032.klaw-forced-interrupt" as never]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
    });
    expect(REGISTRY["51035.boost" as never]!.trigger).toMatchObject({ kind: "boost" });
  });
});

describe("the printed cards and setup", () => {
  it("T'Challa's Shadow: obligation, 2 boost icons, Uses 4 doubt, Victory 0, in no encounter set", () => {
    expect(card(SHADOW)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
    expect(card(SHADOW).keywords).toEqual([
      { name: "uses", count: 4, counterType: "doubt" },
      { name: "victory", value: 0 },
    ]);
  });
  it("Klaw ATK 0 SCH 2 HP 6, 3 boost icons; M.U.S.I.C. ATK 0 SCH 0 HP 1; Manipulated M.U.S.I.C. 5 threat flat; Scream 0 icons with a star", () => {
    expect(card(KLAW)).toMatchObject({ type: "minion", atk: 0, sch: 2, hp: 6, boostIcons: 3, unique: true });
    expect(card(MUSIC)).toMatchObject({ type: "minion", atk: 0, sch: 0, hp: 1, boostIcons: 1 });
    expect(card(MANIPULATED)).toMatchObject({ type: "side_scheme", startingThreat: { base: 5, perPlayer: 0 } });
    expect(card(SCREAM)).toMatchObject({ type: "treachery", boostIcons: 0, starIcon: true });
  });
  it("the nemesis set (Klaw, both M.U.S.I.C. cards, two Screams) is set aside; the obligation is in the encounter deck once", () => {
    const s = bpGame();
    const aside = setAsideCodes(s);
    for (const code of NEMESIS) expect(aside.filter((c) => c === code).length).toBe(code === SCREAM ? 2 : 1);
    expect(encounterCodes(s, "deck").filter((c) => c === SHADOW)).toHaveLength(1);
    expect(encounterCodes(s, "deck").some((c) => NEMESIS.includes(c))).toBe(false);
  });
});

describe("51031.tchallas-shadow-constant and forced response (T'Challa's Shadow)", () => {
  it("revealed in the villain phase it stays in the Black Panther player's play area with 4 doubt counters", () => {
    const { state, id } = holding(bpGame());
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(encounterCodes(state, "discard")).not.toContain(SHADOW);
    expect(doubt(state, id)).toBe(4);
  });
  it("each card played costs 1 more: Clawed Strike (cost 2) is refused with 2 resources, played with 3", () => {
    const hero = withForm(holding(bpHeroGame()).state, { heroForm: 0 });
    const given = moveToHand(hero, P1, "51003");
    const event = given.ids[0]!;
    const short = applyCommand(given.state, play(P1, event, payWith(given.state, P1, 2, [event])), BP_DEPS);
    expect(short.ok).toBe(false);
    const paid = run(given.state, picker(), play(P1, event, payWith(given.state, P1, 3, [event])));
    expect(playerOf(paid.state, P1).hand).not.toContain(event);
    expect(damageOf(paid.state, villainOf(paid.state))).toBe(4);
  });
  it("after a basic thwart, then a basic attack, then a defense, one doubt counter each: 4, 3, 2, 1", () => {
    const base = withForm(holding(bpGame()).state, { heroForm: 0 });
    const shadow = playerOf(base, P1).playArea.find((i) => codeOf(base, i) === SHADOW)!;
    const thwart = run(base, picker(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(base),
      schemeInstanceId: schemeOf(base),
    });
    expect(doubt(thwart.state, shadow)).toBe(3);
    const ready = patchInstance(thwart.state, identityOf(thwart.state), { exhausted: false });
    const attack = run(ready, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(ready),
      targetInstanceId: villainOf(ready),
    });
    expect(doubt(attack.state, shadow)).toBe(2);
    const ready2 = patchInstance(attack.state, identityOf(attack.state), { exhausted: false });
    const defend = run(
      filled(ready2, 3),
      (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s)),
      ...endPhase(ready2),
    );
    expect(doubt(defend.state, shadow)).toBe(1);
  });
  it("an ally's attack is not 'you': T'Challa attacking leaves the doubt counters at 4", () => {
    const base = withForm(holding(bpGame()).state, { heroForm: 0 });
    const shadow = playerOf(base, P1).playArea.find((i) => codeOf(base, i) === SHADOW)!;
    const { state: staged, id: ally } = putInPlay(base, "51002");
    const { state } = run(staged, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally,
      targetInstanceId: villainOf(staged),
    });
    expect(damageOf(state, villainOf(state))).toBe(2);
    expect(doubt(state, shadow)).toBe(4);
  });
  it("turned up as a boost card it counts its 2 boost icons (Rhino attacks at 2 + 2 = 4) and is discarded, not kept", () => {
    const base = withForm(bpGame(), { heroForm: 0 });
    const { state, events, id } = asBoost(base, SHADOW);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === villainOf(state))!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 2, 4]);
    expect(playerOf(state, P1).playArea).not.toContain(id);
    expect(encounterCodes(state, "discard")).toContain(SHADOW);
  });
});

describe("51032.klaw-forced-interrupt (Klaw)", () => {
  /**
   * Klaw engaged with the hero in hero form, undefended. Villain phase order: Rhino activates first (the first card of
   * the encounter deck is his boost card), then Klaw (the second). `second` is that second card's code.
   */
  function attackedByKlaw(second: string, stun = false) {
    const { state: s, id } = engaged(withForm(bpGame(), { heroForm: 0 }), KLAW);
    const pile = s.encounterDecks[activeEncounterDeckId(s)]!;
    const prepared = relabel(filled(s, 6), pile.deck[1]!, second);
    const staged = stun ? patchInstance(prepared, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } }) : prepared;
    const { state, events } = run(staged, picker(), ...endPhase(staged));
    return { state, events, id };
  }
  it("Klaw is not villainous, so his attack is given exactly 1 boost card, by this interrupt", () => {
    const { events, id } = attackedByKlaw(BOOST_FILLER);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === id)).toHaveLength(1);
  });
  it("the card counts: a 2-boost-icon card (T'Challa's Shadow) makes ATK 0 + 2 = 2 damage to the hero", () => {
    const { events, id, state } = attackedByKlaw(SHADOW);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === id)!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([0, 2, 2]);
    expect(damageOf(state, identityOf(state))).toBe(4);
  });
  it("a 0-icon boost card means ATK 0: Klaw's attack deals nothing (only Rhino's 2)", () => {
    const { events, id, state } = attackedByKlaw(BOOST_FILLER);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === id)!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([0, 0, 0]);
    expect(damageOf(state, identityOf(state))).toBe(2);
  });
  it("a stunned Klaw does not attack, so no boost card is given to him", () => {
    const { events, id } = attackedByKlaw(BOOST_FILLER, true);
    expect(ofType(events, "boostCardDealt").filter((e) => e.enemyInstanceId === id)).toEqual([]);
  });
});

describe("51033 / 51034 (Manipulated M.U.S.I.C. and M.U.S.I.C.)", () => {
  it("51033.when-revealed: M.U.S.I.C. is found in the set-aside area and put into play engaged with the revealer", () => {
    const { state, id } = reveal(bpGame(), MANIPULATED);
    const music = instancesOf(state, MUSIC)[0]!;
    expect(inst(state, music).engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain(music);
    expect(setAsideCodes(state)).not.toContain(MUSIC);
    expect(inst(state, id).threat).toBe(5);
  });
  it("51034.when-revealed: Manipulated M.U.S.I.C. is found and put into play with its 5 starting threat", () => {
    const { state, id } = reveal(bpGame(), MUSIC);
    const scheme = instancesOf(state, MANIPULATED)[0]!;
    expect(setAsideCodes(state)).not.toContain(MANIPULATED);
    expect(inst(state, scheme).threat).toBe(5);
    expect(inst(state, id).engagedWith).toBe(P1);
  });
  it("51033.when-defeated: removing all 5 threat discards M.U.S.I.C. from play; the main scheme is unchanged", () => {
    const revealed = reveal(bpGame(), MANIPULATED);
    const music = instancesOf(revealed.state, MUSIC)[0]!;
    const base = withForm(patchInstance(revealed.state, identityOf(revealed.state), { damage: 0 }), { heroForm: 0 });
    const before = inst(base, schemeOf(base)).threat;
    const scheme = revealed.id;
    const s = patchInstance(base, identityOf(base), { exhausted: false });
    const { state } = run(patchInstance(s, scheme, { threat: 2 }), picker(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: scheme,
    });
    expect(playerOf(state, P1).playArea).not.toContain(music);
    expect(encounterCodes(state, "discard")).toContain(MUSIC);
    expect(inst(state, schemeOf(state)).threat).toBe(before);
  });
  it("51034.when-defeated: defeating M.U.S.I.C. moves the 3 threat on Manipulated M.U.S.I.C. to the main scheme", () => {
    const revealed = reveal(bpGame(), MANIPULATED);
    const music = instancesOf(revealed.state, MUSIC)[0]!;
    const scheme = revealed.id;
    const base = withForm(patchInstance(revealed.state, scheme, { threat: 3 }), { heroForm: 0 });
    const ready = patchInstance(base, identityOf(base), { exhausted: false, damage: 0 });
    const before = inst(ready, schemeOf(ready)).threat;
    const { state } = run(ready, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(ready),
      targetInstanceId: music,
    });
    expect(playerOf(state, P1).playArea).not.toContain(music);
    expect(inst(state, schemeOf(state)).threat).toBe(before + 3);
    expect(inst(state, scheme).threat).toBe(0);
  });
});

describe("51035.when-revealed and 51035.boost (The Scream)", () => {
  /** The damage the revealed Scream `id` dealt to `target`, event by event. */
  const dealtByScream = (events: readonly GameEvent[], id: InstanceId, target: InstanceId): number[] =>
    ofType(events, "damageDealt")
      .filter((e) => e.sourceInstanceId === id && e.targetInstanceId === target)
      .map((e) => e.amount);
  it("revealed against an unstunned hero: stunned, and The Scream deals no damage (Rhino's 2 is his own attack)", () => {
    const { state, events, id } = reveal(withForm(bpGame(), { heroForm: 0 }), SCREAM);
    expect(stunned(state, identityOf(state))).toBe(1);
    expect(dealtByScream(events, id, identityOf(state))).toEqual([]);
    expect(damageOf(state, identityOf(state))).toBe(2);
  });
  it("revealed against an already stunned hero: The Scream deals 1 damage and the hero is still stunned (one status card)", () => {
    const base = withForm(bpGame(), { heroForm: 0 });
    const hurt = patchInstance(base, identityOf(base), {
      statuses: { ...inst(base, identityOf(base)).statuses, stunned: 1 },
    });
    const { state, events, id } = reveal(hurt, SCREAM);
    expect(stunned(state, identityOf(state))).toBe(1);
    expect(dealtByScream(events, id, identityOf(state))).toEqual([1]);
    expect(damageOf(state, identityOf(state))).toBe(3);
  });
  it("stuns each character the player controls: both allies are stunned, and only the already stunned ally takes damage", () => {
    const base = withForm(bpGame({ swap: { "51006": "01011" } }), { heroForm: 0 });
    const a = putInPlay(base, "51002");
    const b = putInPlay(a.state, "01011");
    const second = patchInstance(b.state, b.id, { statuses: { ...inst(b.state, b.id).statuses, stunned: 1 } });
    const { state, events, id } = reveal(second, SCREAM);
    expect(stunned(state, a.id)).toBe(1);
    expect(dealtByScream(events, id, a.id)).toEqual([]);
    expect(stunned(state, b.id)).toBe(1);
    expect(dealtByScream(events, id, b.id)).toEqual([1]);
    expect(stunned(state, identityOf(state))).toBe(1);
  });
  it("as a boost card on a defended attack: the defender is stunned and takes no damage when not already stunned", () => {
    const base = withForm(bpGame(), { heroForm: 0 });
    const { state, events } = asBoost(base, SCREAM);
    expect(stunned(state, identityOf(state))).toBe(1);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === villainOf(state))!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 0, 2]);
  });
  it("as a boost card against an already stunned hero: 1 extra damage (Rhino's 2, then the boost's 1: 3 total)", () => {
    const base = withForm(bpGame(), { heroForm: 0 });
    const hurt = patchInstance(base, identityOf(base), {
      statuses: { ...inst(base, identityOf(base)).statuses, stunned: 1 },
    });
    const { state } = asBoost(withDamage(hurt, identityOf(hurt), 0), SCREAM, (s) =>
      s.pendingChoice!.prompt.kind === "declareDefender" ? [identityOf(s)] : firstLegal(s),
    );
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
});
