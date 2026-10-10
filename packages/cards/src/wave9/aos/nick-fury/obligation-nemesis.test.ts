import { AOS_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { cardId } from "@mc/content";
import { abilityRefIds } from "../../../ability-refs.js";
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
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { NICK_FURY_IDENTITY } from "./identity.js";
import {
  NICK_FURY_OBLIGATION_NEMESIS as REGISTRY,
  NICK_FURY_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";
import { furyGame, furyHeroGame, suitOf } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nick Fury's obligation and nemesis set (50059 Discovered; 50060 Orion, 50061 Acquire Infinity Formula, 50062 Leviathan
 * Soldier, 50063 Cold Storage), docs/phase7-wave9.md section 8.4, 3.7, 3.8, 3.33. The real precon `nick-fury-justice`
 * against Core's Rhino (stage 1: ATK 2, SCH 1). Assault / Stealth (50035a/b) abilities are not scripted yet, so only the
 * threat on the suit and the face it shows are asserted. Cards are revealed through the villain phase behind Advance
 * fillers (0 boost icons).
 */
const DISCOVERED = "50059";
const ORION = "50060";
const ACQUIRE = "50061";
const SOLDIER = "50062";
const COLD_STORAGE = "50063";
const FILLER = "01186"; // Advance: 0 boost icons
const REFS = [
  "50059.discovered-constant",
  "50059.when-revealed",
  "50060.orion-constant",
  "50060.orion-forced-response",
  "50061.acquire-infinity-formula-forced-response",
  "50062.leviathan-soldier-forced-response",
  "50063.when-revealed",
  "50063.boost",
];

const DEPS = { abilities: mergeRegistries(WAVE8_ABILITIES, NICK_FURY_IDENTITY, REGISTRY) };
const data = (code: string) => AOS_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const encounterCodes = (s: GameState, zone: "deck" | "discard"): string[] =>
  Object.values(s.encounterDecks).flatMap((d) => d[zone].map((i) => codeOf(s, i)));
const setAsideCodes = (s: GameState): string[] => playerOf(s, P1).setAside.map((id) => codeOf(s, id));
const tough = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough;
const inPlayIds = (s: GameState, code: string): InstanceId[] =>
  instancesOf(s, code).filter((i) => cardsInPlay(s).includes(i));
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));

const picker =
  (choose?: (s: GameState) => string[] | undefined): Picker =>
  (s) => {
    const prompt = s.pendingChoice!.prompt;
    if (prompt.kind === "declareDefender") return ["decline"];
    return choose?.(s) ?? firstLegal(s);
  };
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);

/** The first instance of `code`: Fury's set-aside copy, else the encounter deck's. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;
const removeFromZones = (s: GameState, id: InstanceId): GameState => ({
  ...s,
  players: s.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
  encounterDecks: Object.fromEntries(
    Object.entries(s.encounterDecks).map(([k, d]) => [
      k,
      { deck: d.deck.filter((i) => i !== id), discard: d.discard.filter((i) => i !== id) },
    ]),
  ),
});
/** `id` on top of the encounter deck behind `boosts` fillers, so it is revealed to P1 in the next villain phase. */
function stagedForReveal(s: GameState, id: InstanceId, boosts: number): GameState {
  const deckId = activeEncounterDeckId(s);
  const stripped = removeFromZones(s, id);
  const pile = stripped.encounterDecks[deckId]!;
  const fillers = pile.deck.slice(0, boosts);
  const staged: GameState = {
    ...stripped,
    encounterDecks: {
      ...stripped.encounterDecks,
      [deckId]: { ...pile, deck: [...fillers, id, ...pile.deck.slice(boosts)] },
    },
  };
  return fillers.reduce((acc, f) => relabel(acc, f, FILLER), staged);
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
  const stripped = removeFromZones(s, id);
  const deckId = activeEncounterDeckId(stripped);
  const pile = stripped.encounterDecks[deckId]!;
  const staged: GameState = {
    ...stripped,
    encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
  return { ...run(staged, pick, ...endPhase(staged)), id };
}
/** A set-aside minion put into play engaged with P1 by surgery (no reveal). */
function engaged(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      players: stripped.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, engagedWith: P1 } },
    },
  };
}
/** The set-aside side scheme `code` put into the villain area by surgery. */
function sideScheme(s: GameState, code: string): { state: GameState; id: InstanceId } {
  const id = findCard(s, code);
  const stripped = removeFromZones(s, id);
  return {
    id,
    state: {
      ...stripped,
      villainArea: [...stripped.villainArea, id],
      instances: { ...stripped.instances, [id]: { ...stripped.instances[id]!, faceup: true, threat: 5 } },
    },
  };
}
/** Fury (hero form) with a staged suit: `threat` on it, showing Stealth or Assault. */
function withSuit(s: GameState, patch: { threat?: number; flipped?: boolean }): GameState {
  return patchInstance(s, suitOf(s)!, patch);
}
/** Rhino's attack on hero-form Fury in the next villain phase (a real hit), behind two fillers. */
function rhinoHits(s: GameState) {
  const deckId = activeEncounterDeckId(s);
  const filled = s.encounterDecks[deckId]!.deck.slice(0, 6).reduce((acc, id) => relabel(acc, id, FILLER), s);
  return run(
    filled,
    (st) => (st.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(st)),
    ...endPhase(filled),
  );
}
const pickLabel = (label: string) =>
  picker((s) => {
    const match = s.pendingChoice!.options.find((o) => o.label.includes(label));
    return match ? [match.optionId] : undefined;
  });

describe("registry", () => {
  it("registers every ref of the five cards; nothing is skipped", () => {
    const refs = AOS_CARDS.filter((c) => (c.id as string) >= DISCOVERED && (c.id as string) <= COLD_STORAGE).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id as never]!)).toEqual([]);
  });
  it("timing: the Orion, Acquire and Soldier abilities are forced responses; Cold Storage's boost is a boost", () => {
    for (const ref of [REFS[3], REFS[4], REFS[5]]) {
      expect(REGISTRY[ref as never]!.trigger).toMatchObject({ kind: "response", forced: true });
    }
    expect(REGISTRY["50063.boost" as never]!.trigger).toMatchObject({ kind: "boost" });
    expect(REGISTRY["50060.orion-constant" as never]!.trigger).toMatchObject({ kind: "constant" });
  });
});

describe("the printed cards and setup", () => {
  it("Discovered: an obligation with 2 boost icons in no encounter set", () => {
    expect(data(DISCOVERED)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
  });
  it("Orion: unique minion ATK 2 SCH 2 HP 6, 3 boost icons, Toughness, Leviathan", () => {
    expect(data(ORION)).toMatchObject({ type: "minion", atk: 2, sch: 2, hp: 6, boostIcons: 3, unique: true });
    expect(data(ORION).keywords).toEqual([{ name: "toughness" }]);
    expect(data(ORION).traits).toEqual(["LEVIATHAN"]);
    expect(data(ORION).nemesisMinion).toBe(true);
  });
  it("Acquire Infinity Formula: a side scheme with 5 threat flat (nothing per player), 1 acceleration icon, 3 boost icons", () => {
    expect(data(ACQUIRE)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 5, perPlayer: 0 },
      amplifyIcons: 1,
      boostIcons: 3,
    });
    expect(data(ACQUIRE).icons).toEqual([]);
  });
  it("Leviathan Soldier: minion ATK 2 SCH 0 HP 4, 1 boost icon, Toughness, two copies", () => {
    expect(data(SOLDIER)).toMatchObject({ type: "minion", atk: 2, sch: 0, hp: 4, boostIcons: 1, quantityInSet: 2 });
    expect(data(SOLDIER).keywords).toEqual([{ name: "toughness" }]);
  });
  it("Cold Storage: a treachery with 1 boost icon and a star", () => {
    expect(data(COLD_STORAGE)).toMatchObject({ type: "treachery", boostIcons: 1, starIcon: true });
  });
  it("the nemesis set is set aside and the obligation is in the encounter deck once", () => {
    const s = furyGame();
    const aside = setAsideCodes(s);
    for (const code of [ORION, ACQUIRE, COLD_STORAGE]) expect(aside.filter((c) => c === code)).toHaveLength(1);
    expect(aside.filter((c) => c === SOLDIER)).toHaveLength(2);
    expect(encounterCodes(s, "deck").filter((c) => c === DISCOVERED)).toHaveLength(1);
  });
});

describe("50059.when-revealed (Discovered)", () => {
  const revealWith = (threat: number, flipped: boolean, pick: Picker) => {
    const base = withSuit(furyGame(), { threat, flipped });
    return reveal(base, DISCOVERED, pick);
  };
  it("with no threat on the suit it changes to Assault (from Stealth) and gains surge: one more encounter card", () => {
    const { state, events, id } = revealWith(0, true, picker());
    expect(inst(state, suitOf(state)!).flipped).toBe(false);
    expect(ofType(events, "surgeTriggered").some((e) => e.instanceId === id)).toBe(true);
    // "In either case, discard this card" covers this branch too: the card still surges, then leaves play.
    expect(encounterCodes(state, "discard")).toContain(DISCOVERED);
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
  it("with 3 threat, choosing damage: Fury takes 3, the suit keeps its 3 threat and shows Assault, the card is discarded", () => {
    const { state, events, id } = revealWith(3, true, pickLabel("Take 1 damage"));
    expect(damageOf(state, identityOf(state))).toBe(3);
    expect(inst(state, suitOf(state)!).threat).toBe(3);
    expect(inst(state, suitOf(state)!).flipped).toBe(false);
    expect(encounterCodes(state, "discard")).toContain(DISCOVERED);
    expect(playerOf(state, P1).playArea).not.toContain(id);
    expect(ofType(events, "surgeTriggered").some((e) => e.instanceId === id)).toBe(false);
  });
  it("with 3 threat, choosing removal: the suit has 0 threat, Fury takes no damage, the card is discarded", () => {
    const { state, id } = revealWith(3, true, pickLabel("Remove each threat"));
    expect(inst(state, suitOf(state)!).threat).toBe(0);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(encounterCodes(state, "discard")).toContain(DISCOVERED);
    expect(playerOf(state, P1).playArea).not.toContain(id);
  });
  it("with 1 threat the damage is exactly 1", () => {
    const { state } = revealWith(1, false, pickLabel("Take 1 damage"));
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
  it("the choice is offered as two options only when there is threat", () => {
    const seen: string[][] = [];
    revealWith(
      2,
      false,
      picker((s) => {
        seen.push(s.pendingChoice!.options.map((o) => o.label));
        return undefined;
      }),
    );
    expect(seen.some((labels) => labels.length === 2 && labels[0]!.startsWith("Take 1 damage"))).toBe(true);
  });
});

describe("50060 Orion", () => {
  it("50060.orion-forced-response: damage that lands gives him a tough status card", () => {
    const { state: staged, id } = engaged(furyHeroGame(), ORION);
    expect(tough(staged, id)).toBe(0);
    const { state } = run(staged, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: id,
    });
    expect(damageOf(state, id)).toBe(2);
    expect(tough(state, id)).toBe(1);
  });
  it("a tough status card absorbs the hit: no damage is taken, so no new tough status card is given", () => {
    const { state: staged, id } = engaged(furyHeroGame(), ORION);
    const held = patchInstance(staged, id, { statuses: { ...inst(staged, id).statuses, tough: 1 } });
    const { state } = run(held, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(held),
      targetInstanceId: id,
    });
    expect(damageOf(state, id)).toBe(0);
    expect(tough(state, id)).toBe(0);
  });
  it("50060.orion-constant: he can hold more than one tough status card (1 held, then Rhino's and Orion's hits: 3)", () => {
    const { state: withScheme, id: scheme } = sideScheme(furyHeroGame(), ACQUIRE);
    const { state: staged, id } = engaged(withScheme, ORION);
    const held = patchInstance(staged, id, { statuses: { ...inst(staged, id).statuses, tough: 1 } });
    const { state } = rhinoHits(held);
    expect(inPlayIds(state, ACQUIRE)).toEqual([scheme]);
    expect(tough(state, id)).toBe(3);
  });
});

describe("50061.acquire-infinity-formula-forced-response (Acquire Infinity Formula)", () => {
  it("after Nick Fury takes damage Orion in play gets a tough status card, once per hit: Rhino and Orion hit, so 2, then 4", () => {
    const { state: withScheme } = sideScheme(furyHeroGame(), ACQUIRE);
    const { state: staged, id } = engaged(withScheme, ORION);
    const first = rhinoHits(staged);
    expect(
      ofType(first.events, "damageDealt").filter((e) => e.targetInstanceId === identityOf(first.state)),
    ).toHaveLength(2);
    expect(tough(first.state, id)).toBe(2);
    const second = rhinoHits(patchInstance(first.state, identityOf(first.state), { damage: 0 }));
    expect(tough(second.state, id)).toBe(4);
  });
  it("with Orion not in play, he is found in the set-aside area and put into play engaged with Fury, with his Toughness card", () => {
    const { state: staged } = sideScheme(furyHeroGame(), ACQUIRE);
    expect(inPlayIds(staged, ORION)).toEqual([]);
    const { state } = rhinoHits(staged);
    const orion = inPlayIds(state, ORION);
    expect(orion).toHaveLength(1);
    expect(inst(state, orion[0]!).engagedWith).toBe(P1);
    // Toughness gives him one as he enters; he then attacks Fury in the same phase (a second hit), so Acquire adds one.
    expect(tough(state, orion[0]!)).toBe(2);
    expect(setAsideCodes(state)).not.toContain(ORION);
  });
  it("with Orion in the encounter discard pile he is found there and put into play", () => {
    const { state: s0 } = sideScheme(furyHeroGame(), ACQUIRE);
    const id = findCard(s0, ORION);
    const deckId = activeEncounterDeckId(s0);
    const stripped = removeFromZones(s0, id);
    const pile = stripped.encounterDecks[deckId]!;
    const staged: GameState = {
      ...stripped,
      encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, id] } },
    };
    const { state } = rhinoHits(staged);
    expect(inPlayIds(state, ORION)).toEqual([id]);
    expect(encounterCodes(state, "discard")).not.toContain(ORION);
  });
  it("damage to a character other than Nick Fury (a minion) does nothing", () => {
    const { state: withScheme } = sideScheme(furyHeroGame(), ACQUIRE);
    const { state: staged, id } = engaged(withScheme, SOLDIER);
    const { state } = run(staged, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(staged),
      targetInstanceId: id,
    });
    expect(inPlayIds(state, ORION)).toEqual([]);
  });
});

describe("50062.leviathan-soldier-forced-response (Leviathan Soldier)", () => {
  it("after he schemes against alter-ego Fury, Fury's identity takes 1 damage", () => {
    const { state: staged, id } = engaged(furyGame(), SOLDIER);
    const filled = staged.encounterDecks[activeEncounterDeckId(staged)]!.deck.slice(0, 4).reduce(
      (acc, i) => relabel(acc, i, FILLER),
      staged,
    );
    const { events, state } = run(filled, picker(), ...endPhase(filled));
    expect(ofType(events, "enemyActivated").some((e) => e.enemyInstanceId === id && e.activation === "scheme")).toBe(
      true,
    );
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
  it("he does not trigger when he attacks hero-form Fury", () => {
    const { state: staged, id } = engaged(furyHeroGame(), SOLDIER);
    const filled = staged.encounterDecks[activeEncounterDeckId(staged)]!.deck.slice(0, 4).reduce(
      (acc, i) => relabel(acc, i, FILLER),
      staged,
    );
    const { state } = run(filled, picker(), ...endPhase(filled));
    expect(inst(state, id).engagedWith).toBe(P1);
    // Rhino (2) and the Soldier (2) attack: exactly their 4 damage and no extra point.
    expect(damageOf(state, identityOf(state))).toBe(4);
  });
});

describe("50063.when-revealed (Cold Storage)", () => {
  const withSoldierInDeck = (s: GameState): { state: GameState; id: InstanceId } => {
    const id = findCard(s, SOLDIER);
    const stripped = removeFromZones(s, id);
    const deckId = activeEncounterDeckId(stripped);
    const pile = stripped.encounterDecks[deckId]!;
    return {
      id,
      state: {
        ...stripped,
        encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck, id] } },
      },
    };
  };
  it("with no Leviathan minion in the encounter deck or discard pile (the nemesis set is set aside) Fury takes 2 damage (plus Rhino's 2)", () => {
    const { state } = reveal(furyHeroGame(), COLD_STORAGE);
    expect(damageOf(state, identityOf(state))).toBe(4);
    expect(cardsInPlay(state).some((i) => codeOf(state, i) === SOLDIER)).toBe(false);
  });
  it("with a Leviathan Soldier in the deck it is put into play engaged with Fury and no damage is taken", () => {
    const { state: staged, id } = withSoldierInDeck(furyGame());
    const { state } = reveal(staged, COLD_STORAGE);
    expect(inPlayIds(state, SOLDIER)).toEqual([id]);
    expect(inst(state, id).engagedWith).toBe(P1);
    expect(tough(state, id)).toBe(1);
    expect(damageOf(state, identityOf(state))).toBe(0);
  });
  it("it also finds a Leviathan minion in the encounter discard pile", () => {
    const base = furyGame();
    const id = findCard(base, SOLDIER);
    const stripped = removeFromZones(base, id);
    const deckId = activeEncounterDeckId(stripped);
    const pile = stripped.encounterDecks[deckId]!;
    const staged: GameState = {
      ...stripped,
      encounterDecks: { ...stripped.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, id] } },
    };
    const { state } = reveal(staged, COLD_STORAGE);
    expect(inPlayIds(state, SOLDIER)).toEqual([id]);
    expect(damageOf(state, identityOf(state))).toBe(0);
  });
  it("it does not surge", () => {
    const { events, id } = reveal(furyHeroGame(), COLD_STORAGE);
    expect(ofType(events, "surgeTriggered").some((e) => e.instanceId === id)).toBe(false);
  });
});

describe("50063.boost (Cold Storage)", () => {
  it("as a boost card on Rhino's attack: 1 boost icon (2 + 1 = 3 damage) and then Fury takes 1 more", () => {
    const base = withForm(furyGame(), { heroForm: 0 });
    const { state, events } = asBoost(base, COLD_STORAGE);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === villainOf(state))!;
    expect([hit.baseAtk, hit.boostIcons]).toEqual([2, 1]);
    expect(damageOf(state, identityOf(state))).toBe(4);
  });
});
