import { PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario, encounterCardsOf } from "../../../core/index.js";
import { each, heroAction, placeThreat, query } from "../../../dsl/index.js";
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
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_MODULAR_DRIVE as REGISTRY, FNE_MODULAR_DRIVE_SKIPPED as SKIPPED } from "./drive.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Drive modular set (60186 Sports Car, 60187 Motorcycle, 60188 Utility Van, 60189 Traffic Jam, 60190 Carjacking),
 * docs/phase7-wave11-scenarios.md section S6. Each game is Core's Spider-Man (Justice) in hero form against Rhino with
 * the Drive cards added to the Core encounter deck; Advance (01186) and Assault (01187) print no boost icon and no
 * boost ability, so they are the blank fillers.
 */
const SPORTS_CAR = "60186";
const MOTORCYCLE = "60187";
const VAN = "60188";
const TRAFFIC_JAM = "60189";
const CARJACKING = "60190";
const ADVANCE = "01186";
const ASSAULT = "01187";
/** Core attachment (Rhino's own), not a Vehicle: Carjacking must discard past it. */
const CHARGE = "01099";
/** Core side scheme (Rhino's own set): a scheme the hero can thwart while Traffic Jam's crisis icon guards the main one. */
const BREAKIN = "01107";
/** Core Justice cards in Spider-Man's deck: an ally (THW 2), a "(thwart)" event, a support that removes threat. */
const DAREDEVIL = "01058";
const FOR_JUSTICE = "01060";
const SURVEILLANCE_TEAM = "01064";
/** Core minions: Hydra Mercenary ATK 1 / SCH 0 / HP 3; Sandman ATK 3 / SCH 2 / HP 4. */
const HYDRA = "01101";
const SANDMAN = "01102";
const SCRIPTED = [
  "60186.sports-car-constant",
  "60186.sports-car-forced-interrupt",
  "60187.motorcycle-constant",
  "60187.motorcycle-forced-interrupt",
  "60188.utility-van-constant",
  "60188.utility-van-forced-interrupt",
  "60189.traffic-jam-forced-interrupt",
  "60190.when-revealed",
];
const VEHICLES = [SPORTS_CAR, MOTORCYCLE, VAN];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const inDiscard = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));
const inDeck = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const idOf = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
/** What `host` has attached, by code. */
const attachedCodes = (s: GameState, host: InstanceId): string[] => inst(s, host).attachments.map((i) => codeOf(s, i));
/** The damage the events placed on `id`. */
const placedOn = (events: readonly GameEvent[], id: InstanceId): number =>
  ofType(events, "damagePlaced")
    .filter((e) => e.targetInstanceId === id)
    .reduce((n, e) => n + e.amount, 0);
const printed = (code: string) => (PLAYABLE_CARDS.find((c) => c.id === cardId(code)) as any).resourceIcons ?? {};

/** Core's Spider-Man (hero form), plus Captain Marvel with `players: 2`, against Rhino with the Drive set shuffled in. */
function newGame(players = 1): GameState {
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = coreScenario("rhino", {
    players: seats.slice(0, players),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    { ...base, encounterDeck: [...base.encounterDeck, ...encounterCardsOf(["drive"], PLAYABLE_CARDS)] },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  const first = withForm(settled, { heroForm: 0 });
  return players > 1 ? withForm(first, { heroForm: 0 }, P2) : first;
}

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Answers a choice with the option whose label starts with `label`; a defender prompt is declined. */
const labeled =
  (label: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    const option = choice.options.find((o) => o.label.startsWith(label));
    return option ? [option.optionId] : firstLegal(s);
  };

/** P1 ends the turn; the villain phase runs on the encounter deck stacked as `stack` (boost cards first, then the deal). */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = declines) {
  return driveEventsPicking(WAVE11_DEPS, stackEncounterDeck(state, ...stack), pick, endTurn(P1));
}

/** Surgery: the first copy of `code` taken out of the encounter deck and discard, then attached faceup to `host`. */
function attachedTo(state: GameState, code: string, host: InstanceId = villainOf(state)) {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const taken: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
  };
  const placed = patchInstance(taken, id, { faceup: true, attachedTo: host, controllerId: null });
  return { id, state: patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] }) };
}

/** Surgery: `code` (a Core minion) engaged with P1 under the id `mini`, without a reveal. */
const withMinion = (state: GameState, code: string): GameState => engageMinion(state, code, "mini");
const MINI = "mini" as InstanceId;

/** Surgery: `player`'s hand is exactly `ids`; the rest of the hand goes to the top of the deck. */
function withHand(state: GameState, player: PlayerId, ids: readonly InstanceId[]): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: [...ids], deck: [...p.hand, ...p.deck].filter((i) => !ids.includes(i)) }
        : p,
    ),
  };
}
/** Up to `count` cards of `player` printing exactly one resource icon, all of `type` (or, with no type, of one type each). */
function singles(state: GameState, player: PlayerId, count: number, type?: string): InstanceId[] {
  const owner = playerOf(state, player);
  const picked: InstanceId[] = [];
  const seen = new Set<string>();
  for (const id of [...owner.hand, ...owner.deck]) {
    const icons = Object.entries(printed(codeOf(state, id))).filter(([, n]) => (n as number) > 0);
    if (icons.length !== 1 || icons[0]![1] !== 1) continue;
    const t = icons[0]![0];
    if (type !== undefined ? t !== type : seen.has(t)) continue;
    seen.add(t);
    picked.push(id);
    if (picked.length === count) break;
  }
  return picked;
}
/** The type of which `player` has at least 3 single-icon cards. */
function typeWithThree(state: GameState, player: PlayerId): string {
  for (const type of ["physical", "mental", "energy"]) if (singles(state, player, 3, type).length === 3) return type;
  throw new Error("no resource type with three single-icon cards");
}

describe("registry", () => {
  it("registers every printed ref of the five cards and skips none", () => {
    const printedRefs = [SPORTS_CAR, MOTORCYCLE, VAN, TRAFFIC_JAM, CARJACKING].flatMap((c) => abilityRefIds(data(c)));
    expect([...printedRefs].sort()).toEqual([...SCRIPTED].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...SCRIPTED].sort());
    expect(SKIPPED).toEqual({});
  });
  it.each(SCRIPTED)("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
  it("carries the printed timing", () => {
    for (const ref of SCRIPTED.filter((r) => r.endsWith("forced-interrupt")))
      expect(REGISTRY[ref]!.trigger, ref).toMatchObject({ kind: "interrupt", forced: true });
    expect(REGISTRY["60190.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    // "When … would": the higher interrupt priority (RRG 1.8 "'Would'", p. 48).
    expect(REGISTRY["60189.traffic-jam-forced-interrupt"]!.trigger).toMatchObject({ would: true });
  });
  it("the data prints the hosts, the stat bonuses and Traffic Jam's Hinder", () => {
    for (const code of VEHICLES)
      expect(data(code).attachesTo).toMatchObject({ kind: "superlative", withoutAttachmentTrait: "VEHICLE" });
    expect(data(SPORTS_CAR)).toMatchObject({ statModifiers: { atk: 1 }, attachesTo: { measure: "atk" } });
    expect(data(MOTORCYCLE)).toMatchObject({ statModifiers: { sch: 1 }, attachesTo: { measure: "sch" } });
    expect(data(VAN).attachesTo).toMatchObject({ order: "lowest", measure: "remainingHp" });
    expect(data(TRAFFIC_JAM).keywords).toContainEqual({ name: "hinder", value: 0, perPlayer: 2 });
  });
});

describe("Sports Car 60186, Motorcycle 60187, Utility Van 60188: the host and the surge", () => {
  // Rhino stage I: ATK 2, SCH 1, 14 HP. The minion beats him at the car's measure (Sandman: ATK 3, SCH 2) or, for the
  // Van, has the fewest hit points (Hydra Mercenary, 3).
  const CASES = [
    { code: SPORTS_CAR, minion: SANDMAN, ref: "60186.sports-car-constant" },
    { code: MOTORCYCLE, minion: SANDMAN, ref: "60187.motorcycle-constant" },
    { code: VAN, minion: HYDRA, ref: "60188.utility-van-constant" },
  ];
  /** Rhino activates (a blank boost card), the card is dealt to the hero, then each minion activates (a blank boost card apiece). */
  const reveal = (state: GameState, code: string, enemies: number) =>
    villainPhase(state, [ADVANCE, code, ...Array.from({ length: enemies - 1 }, () => ASSAULT), ASSAULT]);

  for (const c of CASES) {
    it(`${c.ref}: with only the villain in play it attaches to the villain`, () => {
      const run = reveal(newGame(), c.code, 1);
      expect(attachedCodes(run.state, villainOf(run.state))).toContain(c.code);
    });

    it(`${c.ref}: it attaches to the enemy that is highest / lowest at its measure, not the villain`, () => {
      const s = withMinion(newGame(), c.minion);
      const run = reveal(s, c.code, 2);
      expect(attachedCodes(run.state, MINI)).toEqual([c.code]);
      expect(attachedCodes(run.state, villainOf(run.state))).not.toContain(c.code);
    });

    it(`${c.ref}: an enemy that already has a Vehicle attachment is skipped`, () => {
      // The other Vehicle sits on the enemy this one would pick, so this one goes to the other enemy.
      const other = VEHICLES.find((v) => v !== c.code)!;
      const s = attachedTo(withMinion(newGame(), c.minion), other, MINI);
      const run = reveal(s.state, c.code, 2);
      expect(attachedCodes(run.state, villainOf(run.state))).toContain(c.code);
      expect(attachedCodes(run.state, MINI)).toEqual([other]);
    });

    it(`${c.ref}: when every enemy has a Vehicle attachment, it gains surge and the next card is revealed`, () => {
      const others = VEHICLES.filter((v) => v !== c.code);
      const first = attachedTo(newGame(), others[0]!, villainOf(newGame()));
      const run = reveal(first.state, c.code, 1);
      // No host: the card is discarded (RRG 1.8 "Attach To", p. 8) and surges, so the card behind it is revealed too.
      expect(inDiscard(run.state)).toContain(c.code);
      expect(attachedCodes(run.state, villainOf(run.state))).toEqual([others[0]]);
      const revealed = ofType(run.events, "encounterCardRevealed" as never).map((e: any) =>
        codeOf(run.state, e.instanceId),
      );
      expect(revealed.slice(0, 2)).toEqual([c.code, ASSAULT]);
    });
  }

  it("the stat bonus is data: +1 ATK (Sports Car), +1 SCH (Motorcycle) on the attached enemy", () => {
    const base = newGame();
    const before = characterProfile(base, villainOf(base), WAVE11_DEPS)!;
    const car = attachedTo(base, SPORTS_CAR);
    const bike = attachedTo(base, MOTORCYCLE);
    const van = attachedTo(base, VAN);
    expect(characterProfile(car.state, villainOf(base), WAVE11_DEPS)!.atk).toBe(before.atk + 1);
    expect(characterProfile(bike.state, villainOf(base), WAVE11_DEPS)!.sch).toBe(before.sch + 1);
    expect(characterProfile(van.state, villainOf(base), WAVE11_DEPS)).toMatchObject({
      atk: before.atk,
      sch: before.sch,
    });
  });
});

describe("the Vehicles' Forced Interrupt: damage to the attached character is placed on the Vehicle", () => {
  const LIMITS = [
    { code: SPORTS_CAR, limit: 4, ref: "60186.sports-car-forced-interrupt" },
    { code: MOTORCYCLE, limit: 3, ref: "60187.motorcycle-forced-interrupt" },
    { code: VAN, limit: 6, ref: "60188.utility-van-forced-interrupt" },
  ];
  const attack = (state: GameState) =>
    driveEventsPicking(WAVE11_DEPS, state, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(state),
      targetInstanceId: villainOf(state),
    } as never);
  /** The Vehicle on the villain, holding `damage` already. */
  const staged = (code: string, damage: number, tough = false) => {
    const base = newGame();
    const car = attachedTo(base, code);
    const withDamage = patchInstance(car.state, car.id, { damage });
    const s = tough
      ? patchInstance(withDamage, villainOf(base), {
          statuses: { ...inst(withDamage, villainOf(base)).statuses, tough: 1 },
        })
      : withDamage;
    return { state: s, id: car.id };
  };

  for (const c of LIMITS) {
    // The hero's basic attack deals `dealt` damage (read from a probe run with an empty Vehicle).
    const probe = () => {
      const s = staged(c.code, 0);
      const run = attack(s.state);
      const dealt = inst(run.state, s.id).damage;
      return { dealt, villainDamage: inst(run.state, villainOf(run.state)).damage };
    };

    it(`${c.ref}: the damage is placed on the card, none on the attached enemy`, () => {
      const { dealt, villainDamage } = probe();
      expect(dealt).toBeGreaterThan(0);
      expect(dealt).toBeLessThan(c.limit);
      expect(villainDamage).toBe(0);
    });

    it(`${c.ref}: it stays at ${c.limit - 1} damage and is discarded at ${c.limit}`, () => {
      const { dealt } = probe();
      const below = staged(c.code, c.limit - 1 - dealt);
      const stays = attack(below.state);
      expect(inst(stays.state, below.id).damage).toBe(c.limit - 1);
      expect(inst(stays.state, below.id).attachedTo).toBe(villainOf(stays.state));
      const exact = staged(c.code, c.limit - dealt);
      const gone = attack(exact.state);
      expect(inst(gone.state, exact.id).attachedTo).toBeNull();
      expect(inDiscard(gone.state)).toContain(c.code);
      expect(attachedCodes(gone.state, villainOf(gone.state))).toEqual([]);
      // The damage that filled it was still placed on the Vehicle, not carried over to the enemy.
      expect(inst(gone.state, villainOf(gone.state)).damage).toBe(0);
    });

    it(`${c.ref}: a tough status card on the attached enemy absorbs the damage first (it "would take" it)`, () => {
      const s = staged(c.code, 0, true);
      const run = attack(s.state);
      expect(inst(run.state, villainOf(run.state)).statuses.tough).toBe(0);
      expect(inst(run.state, s.id).damage).toBe(0);
      expect(inst(run.state, villainOf(run.state)).damage).toBe(0);
    });
  }

  it("damage to a character without a Vehicle is dealt normally", () => {
    const s = newGame();
    const run = driveEventsPicking(WAVE11_DEPS, s, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(s),
      targetInstanceId: villainOf(s),
    } as never);
    expect(inst(run.state, villainOf(run.state)).damage).toBeGreaterThan(0);
  });

  it("damage to another enemy is not redirected to a Vehicle on the villain", () => {
    const s = attachedTo(withMinion(newGame(), SANDMAN), SPORTS_CAR);
    const run = driveEventsPicking(WAVE11_DEPS, s.state, declines, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(s.state),
      targetInstanceId: MINI,
    } as never);
    expect(inst(run.state, MINI).damage).toBeGreaterThan(0);
    expect(inst(run.state, s.id).damage).toBe(0);
  });

  it("the Vehicle attached to a hero soaks the hero's damage too (an attached character, not only an enemy)", () => {
    const s = attachedTo(newGame(), SPORTS_CAR, hero(newGame()));
    const run = villainPhase(s.state, [ADVANCE, ASSAULT]);
    // Enough damage lands on it to fill and discard it, so read the placements, not the card's final damage.
    expect(placedOn(run.events, s.id)).toBeGreaterThan(0);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
  });
});

describe("Traffic Jam 60189: threat a character with a Vehicle adds or removes goes here instead", () => {
  const MAIN = (s: GameState): InstanceId => s.mainScheme.instanceId;
  const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
  /**
   * Traffic Jam in play with `jam` threat, Breakin' & Takin' (Rhino's side scheme, 01107) with 4 and the main scheme at
   * 1 (room for a villain phase); with `vehicle`, it is attached to `host`. Traffic Jam's crisis icon keeps players off
   * the main scheme, so the hero's thwarts go to Breakin' & Takin'.
   */
  function staged(jam: number, vehicle?: { readonly code: string; readonly host: (s: GameState) => InstanceId }) {
    const base = newGame();
    const withMain = patchInstance(base, MAIN(base), { threat: 1 });
    const tj = encounterCardInVillainArea(withMain, TRAFFIC_JAM, jam);
    const other = encounterCardInVillainArea(tj.state, BREAKIN, 4);
    const state = vehicle ? attachedTo(other.state, vehicle.code, vehicle.host(other.state)).state : other.state;
    return { state, jam: tj.id, other: other.id };
  }
  const thwart = (state: GameState, scheme: InstanceId) =>
    driveEventsPicking(WAVE11_DEPS, state, declines, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: scheme,
    } as never);
  /** The hero's THW, the threat a basic thwart removes. */
  const thw = (s: GameState): number => characterProfile(s, hero(s), WAVE11_DEPS)!.thw;
  const onHero = { code: SPORTS_CAR, host: (s: GameState) => hero(s) };

  it("a hero with a Vehicle thwarts another scheme: the threat is removed from Traffic Jam instead", () => {
    const s = staged(3, onHero);
    const run = thwart(s.state, s.other);
    const n = thw(s.state);
    expect(n).toBeGreaterThan(0);
    expect(threat(run.state, s.other)).toBe(4);
    expect(threat(run.state, s.jam)).toBe(3 - n);
  });

  it("a hero without a Vehicle thwarts as usual", () => {
    const s = staged(3);
    const run = thwart(s.state, s.other);
    expect(threat(run.state, s.other)).toBe(4 - thw(s.state));
    expect(threat(run.state, s.jam)).toBe(3);
  });

  it("a Vehicle on the villain does not redirect the hero's thwart", () => {
    const s = staged(3, { code: SPORTS_CAR, host: villainOf });
    const run = thwart(s.state, s.other);
    expect(threat(run.state, s.other)).toBe(4 - thw(s.state));
    expect(threat(run.state, s.jam)).toBe(3);
  });

  it("threat removed from Traffic Jam itself is removed once, as usual, and not replaced", () => {
    const s = staged(3, onHero);
    const run = thwart(s.state, s.jam);
    expect(threat(run.state, s.jam)).toBe(3 - thw(s.state));
    expect(threat(run.state, s.other)).toBe(4);
  });

  it("removing the last threat here instead defeats Traffic Jam; the thwarted scheme keeps its threat", () => {
    const s = staged(1, onHero);
    const run = thwart(s.state, s.other);
    expect(threat(run.state, s.other)).toBe(4);
    expect(run.state.villainArea).not.toContain(s.jam);
    expect(inDiscard(run.state)).toContain(TRAFFIC_JAM);
    // With Traffic Jam gone, the next thwart is not replaced.
    const ready = patchInstance(run.state, hero(run.state), { exhausted: false });
    const again = thwart(ready, s.other);
    expect(threat(again.state, s.other)).toBe(4 - thw(ready));
  });

  it("Traffic Jam at 0 threat still replaces the removal: nothing is removed from either scheme", () => {
    // RRG 1.8 "Replacement Effect" (p. 37): the removal is replaced, and the replacement removes what is here. Not
    // reachable in play (a side scheme with no threat is defeated), so this pins the engine reading.
    const s = staged(0, onHero);
    const run = thwart(s.state, s.other);
    expect(threat(run.state, s.other)).toBe(4);
    expect(threat(run.state, s.jam)).toBe(0);
  });

  /** The resolved trigger events of `kind` the run logged, with their results. */
  const resolved = <K extends string>(events: readonly GameEvent[], kind: K): any[] =>
    events.flatMap((e: any) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === kind ? [e.event] : [],
    );

  it("the redirected removal still belongs to the thwart: it reports the threat and its player defeats Traffic Jam", () => {
    // RRG 1.8 "Replacement Effect" (p. 37): "that threat is removed from here instead", still the thwart's threat.
    const s = staged(1, onHero);
    const run = thwart(s.state, s.other);
    const [made] = resolved(run.events, "thwart");
    expect(made.results).toMatchObject({ threatRemoved: 1 });
    const [defeat] = resolved(run.events, "schemeDefeated");
    expect(defeat).toMatchObject({ instanceId: s.jam, defeatedByPlayerId: P1, sourceInstanceId: hero(s.state) });
  });

  it("an ally with a Vehicle thwarts: the threat is removed from Traffic Jam instead", () => {
    const s = staged(3);
    const played = playFromHand(WAVE11_DEPS, s.state, DAREDEVIL, 4, declines);
    const state = attachedTo(played.state, SPORTS_CAR, played.id).state;
    const thw = characterProfile(state, played.id, WAVE11_DEPS)!.thw;
    const run = driveEventsPicking(WAVE11_DEPS, state, declines, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: played.id,
      schemeInstanceId: s.other,
    } as never);
    expect(threat(run.state, s.other)).toBe(4);
    expect(threat(run.state, s.jam)).toBe(3 - thw);
  });

  it('a "(thwart)" event (For Justice!) by a hero with a Vehicle is the hero\'s thwart, so it is redirected', () => {
    const s = staged(5, onHero);
    const run = playFromHand(WAVE11_DEPS, s.state, FOR_JUSTICE, 2, labeled("Breakin"));
    expect(threat(run.state, s.other)).toBe(4);
    // 3 threat, or 4 if a mental resource paid for it.
    expect(5 - threat(run.state, s.jam)).toBeGreaterThanOrEqual(3);
  });

  it("an unlabeled removal by a card that is not a character (Surveillance Team) is not redirected", () => {
    // Engine interpretation (authority step 5): the removal is the support's, not the identity's; only a "(thwart)"
    // ability is made by the identity (RRG 1.8 "Labeled Ability", p. 26). An event card's "remove N threat" reads the
    // same way.
    const s = staged(3, onHero);
    const team = playFromHand(WAVE11_DEPS, s.state, SURVEILLANCE_TEAM, 2, declines);
    const run = driveEventsPicking(
      WAVE11_DEPS,
      team.state,
      labeled("Breakin"),
      use(P1, team.id, "01064.surveillance-team-action"),
    );
    expect(threat(run.state, s.other)).toBe(3);
    expect(threat(run.state, s.jam)).toBe(3);
  });

  /** P1 in alter-ego form ends the turn: Rhino (and an engaged minion) scheme. */
  const schemes = (state: GameState) => villainPhase(withForm(state, "alterEgo"), [ADVANCE, ASSAULT]);
  const schOf = (s: GameState, id: InstanceId): number => characterProfile(s, id, WAVE11_DEPS)!.sch;

  it("the villain with a Vehicle schemes: the threat is added to Traffic Jam instead of the main scheme", () => {
    const control = staged(3);
    const plain = schemes(control.state);
    const s = staged(3, { code: SPORTS_CAR, host: villainOf });
    const run = schemes(s.state);
    const sch = schOf(s.state, villainOf(s.state));
    expect(sch).toBeGreaterThan(0);
    expect(threat(plain.state, control.jam)).toBe(3);
    expect(threat(run.state, s.jam)).toBe(3 + sch);
    // The placement on Traffic Jam is still the activation's (RRG 1.8 "Replacement Effect", p. 37).
    const activation = resolved(run.events, "enemyScheme").find((e) => e.enemyInstanceId === villainOf(s.state));
    expect(activation.results).toMatchObject({ threatPlaced: sch });
    // Step one's acceleration and the dealt card's threat (neither placed by a character) still land on the main scheme.
    expect(threat(run.state, MAIN(run.state))).toBe(threat(plain.state, MAIN(plain.state)) - sch);
  });

  it("a hero with a Vehicle places threat on a minion: it is not a scheme, so the threat is not redirected", () => {
    // Test only: "Hero Action: place 1 threat on each minion", on Spider-Man's identity (threat on a minion: Black Cat
    // 60169, docs/phase7-wave11-scenarios.md §S3.8).
    const ON_MINION = "test.place-threat-on-each-minion";
    const deps = {
      abilities: { ...WAVE11_DEPS.abilities, [ON_MINION]: heroAction(placeThreat(1, each(query("minion")))) },
    };
    const s = staged(3, onHero);
    const card = s.state.cardPool[playerOf(s.state, P1).identity.cardId]!;
    if (card.type !== "hero_identity") throw new Error("no identity card");
    const withAbility: GameState = {
      ...withMinion(s.state, SANDMAN),
      cardPool: {
        ...s.state.cardPool,
        [card.id]: { ...card, hero: { ...card.hero, abilities: [...card.hero.abilities, { id: ON_MINION as never }] } },
      },
    };
    const run = driveEventsPicking(deps, withAbility, declines, use(P1, hero(withAbility), ON_MINION));
    expect(threat(run.state, MINI)).toBe(1);
    expect(threat(run.state, s.jam)).toBe(3);
  });

  it("only the enemy with the Vehicle is redirected: a minion with one, beside a villain without", () => {
    const control = staged(3);
    const plain = schemes(withMinion(control.state, SANDMAN));
    const s = staged(3);
    const state = attachedTo(withMinion(s.state, SANDMAN), SPORTS_CAR, MINI).state;
    const run = schemes(state);
    const sch = schOf(state, MINI);
    expect(sch).toBeGreaterThan(0);
    expect(threat(run.state, s.jam)).toBe(3 + sch);
    expect(threat(run.state, MAIN(run.state))).toBe(threat(plain.state, MAIN(plain.state)) - sch);
  });
});

describe("Carjacking 60190", () => {
  /** The stack for one activation (Rhino, a blank boost card) then Carjacking dealt, then `behind` for it to discard. */
  const stack = (...behind: string[]) => [ADVANCE, CARJACKING, ...behind];
  /** P1's hand is three cards of one resource type; returns the state, the cards and the type. */
  const withThree = (state: GameState, player: PlayerId = P1) => {
    const type = typeWithThree(state, player);
    const cards = singles(state, player, 3, type);
    return { state: withHand(state, player, cards), cards, type };
  };
  /** Chooses the "Spend 3 [type]" option when offered, pays with `cards`, and otherwise reveals. */
  const paying =
    (cards: readonly InstanceId[], type: string): Picker =>
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "declareDefender") return ["decline"];
      if (choice.prompt.kind === "spendResources") return cards.map((c) => `hand:${c}`);
      const option = choice.options.find((o) => o.label.startsWith(`Spend 3 [${type}]`));
      return option ? [option.optionId] : firstLegal(s);
    };

  it("60190.when-revealed: discards cards until a Vehicle attachment (past non-Vehicle attachments) and reveals it", () => {
    const run = villainPhase(newGame(), stack(ASSAULT, CHARGE, MOTORCYCLE, SPORTS_CAR), labeled("Reveal"));
    const discarded = inDiscard(run.state);
    expect(discarded).toContain(CARJACKING);
    expect(discarded).toContain(ASSAULT);
    expect(discarded).toContain(CHARGE);
    // The first Vehicle was found and revealed (Motorcycle: highest SCH, so Rhino); the one behind it is untouched.
    expect(attachedCodes(run.state, villainOf(run.state))).toContain(MOTORCYCLE);
    expect(inDeck(run.state)).toContain(SPORTS_CAR);
    expect(discarded).not.toContain(SPORTS_CAR);
  });

  it("60190.when-revealed: with 3 resources of one type the player may spend them to attach it to their identity instead", () => {
    const g = withThree(newGame());
    const run = villainPhase(g.state, stack(ASSAULT, SPORTS_CAR), paying(g.cards, g.type));
    expect(attachedCodes(run.state, hero(run.state))).toEqual([SPORTS_CAR]);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([]);
    for (const card of g.cards) expect(playerOf(run.state, P1).discard).toContain(card);
    expect(inDiscard(run.state)).toContain(CARJACKING);
  });

  it("60190.when-revealed: the attached Vehicle works on the hero (it takes the hero's damage)", () => {
    const g = withThree(newGame());
    const first = villainPhase(g.state, stack(ASSAULT, SPORTS_CAR), paying(g.cards, g.type));
    const car =
      attachedCodes(first.state, hero(first.state)).length === 1
        ? inst(first.state, hero(first.state)).attachments[0]!
        : null;
    expect(car).not.toBeNull();
    const second = villainPhase(first.state, [ADVANCE, ASSAULT]);
    expect(placedOn(second.events, car!)).toBeGreaterThan(0);
    // The hero took Rhino's first hit before the card came; the second phase's hits all went to the Vehicle.
    expect(inst(second.state, hero(second.state)).damage).toBe(inst(first.state, hero(first.state)).damage);
  });

  it("60190.when-revealed: the player may decline the offer and reveal the Vehicle as usual, keeping the resources", () => {
    const g = withThree(newGame());
    const run = villainPhase(g.state, stack(ASSAULT, SPORTS_CAR), labeled("Reveal"));
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([SPORTS_CAR]);
    expect(attachedCodes(run.state, hero(run.state))).toEqual([]);
    for (const card of g.cards) expect(playerOf(run.state, P1).hand).toContain(card);
  });

  it("60190.when-revealed: without 3 resources of one type there is no offer: the Vehicle is revealed", () => {
    // The turn ends with a refill to hand size, so the cards that will be drawn are set up too: at most two cards of
    // each resource type among the hand and the draws, never three of one.
    const base = newGame();
    const size = playerOf(base, P1).hand.length;
    const byType = new Map<string, InstanceId[]>();
    for (const id of [...playerOf(base, P1).hand, ...playerOf(base, P1).deck]) {
      const icons = Object.entries(printed(codeOf(base, id))).filter(([, n]) => (n as number) > 0);
      if (icons.length !== 1 || icons[0]![1] !== 1) continue;
      byType.set(icons[0]![0], [...(byType.get(icons[0]![0]) ?? []), id]);
    }
    const lanes = [...byType.values()].map((ids) => ids.slice(0, 2));
    const picked = [0, 1].flatMap((round) => lanes.flatMap((ids) => (ids[round] ? [ids[round]!] : [])));
    expect(lanes.length).toBeGreaterThanOrEqual(3);
    expect(picked.length).toBeGreaterThanOrEqual(size);
    const chosen = picked.slice(0, size);
    const owner = playerOf(base, P1);
    const state: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? {
              ...p,
              hand: chosen.slice(0, 3),
              deck: [...chosen.slice(3), ...[...owner.hand, ...owner.deck].filter((i) => !chosen.includes(i))],
            }
          : p,
      ),
    };
    const prompts: string[] = [];
    const pick: Picker = (s) => {
      prompts.push(...s.pendingChoice!.options.map((o) => o.label));
      return declines(s);
    };
    const run = villainPhase(state, stack(ASSAULT, SPORTS_CAR), pick);
    expect(prompts.some((l) => l.startsWith("Spend 3"))).toBe(false);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([SPORTS_CAR]);
  });

  it("60190.when-revealed: if the identity already has a Vehicle attachment there is no offer, even with the resources", () => {
    const base = newGame();
    const g = withThree(attachedTo(base, MOTORCYCLE, hero(base)).state);
    const prompts: string[] = [];
    const pick: Picker = (s) => {
      prompts.push(...s.pendingChoice!.options.map((o) => o.label));
      return declines(s);
    };
    const run = villainPhase(g.state, stack(ASSAULT, SPORTS_CAR), pick);
    expect(prompts.some((l) => l.startsWith("Spend 3"))).toBe(false);
    expect(attachedCodes(run.state, villainOf(run.state))).toEqual([SPORTS_CAR]);
    expect(attachedCodes(run.state, hero(run.state))).toEqual([MOTORCYCLE]);
  });

  it("60190.when-revealed: with no Vehicle attachment in the encounter deck or discard nothing is attached", () => {
    const s = newGame();
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const keep = (i: InstanceId) => !VEHICLES.includes(codeOf(s, i));
    const bare: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
      },
    };
    const g = withThree(bare);
    const run = villainPhase(g.state, stack(ASSAULT), paying(g.cards, g.type));
    for (const code of VEHICLES) expect(attachedCodes(run.state, hero(run.state))).not.toContain(code);
    expect(attachedCodes(run.state, villainOf(run.state)).filter((c) => VEHICLES.includes(c))).toEqual([]);
    for (const card of g.cards) expect(playerOf(run.state, P1).hand).toContain(card);
  });

  it("60190.when-revealed: two players, the player dealt it is the one asked, and their identity decides", () => {
    // P1's identity has a Vehicle, P2's does not: P2 is offered the attach (and pays with P2's cards).
    const base = newGame(2);
    const withBike = attachedTo(base, MOTORCYCLE, hero(base, P1));
    const g = withThree(withBike.state, P2);
    const asked: PlayerId[] = [];
    const inner = paying(g.cards, g.type);
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.options.some((o) => o.label.startsWith("Spend 3"))) asked.push(choice.playerId);
      return inner(s);
    };
    const order = g.state.firstPlayerId === P2 ? [endTurn(P2), endTurn(P1)] : [endTurn(P1), endTurn(P2)];
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(
        withForm(withForm(g.state, "alterEgo", P1), "alterEgo", P2),
        ADVANCE,
        ASSAULT,
        ADVANCE,
        CARJACKING,
        ASSAULT,
        SPORTS_CAR,
      ),
      pick,
      ...order,
    );
    expect(asked).toEqual([P2]);
    expect(attachedCodes(run.state, hero(run.state, P2))).toEqual([SPORTS_CAR]);
    expect(attachedCodes(run.state, hero(run.state, P1))).toEqual([MOTORCYCLE]);
    for (const card of g.cards) expect(playerOf(run.state, P2).discard).toContain(card);
  });

  it("is a treachery with no ability but its reveal", () => {
    expect(data(CARJACKING).abilities).toEqual([{ id: "60190.when-revealed" }]);
    expect(idOf(newGame(), CARJACKING)).toBeDefined();
  });
});
