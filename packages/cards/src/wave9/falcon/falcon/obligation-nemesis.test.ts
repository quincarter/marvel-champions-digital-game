import { FALCON_CARDS, cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  characterProfile,
  hasKeyword,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { encounterCardInVillainArea, stackSetAside } from "../../../testing/staging.js";
import { BP_ABILITIES } from "../../bp/index.js";
import { FALCON_DEPS, falconGame, falconHeroGame } from "../testing.js";
import {
  FALCON_OBLIGATION_NEMESIS as REGISTRY,
  FALCON_OBLIGATION_NEMESIS_SKIPPED as SKIPPED,
} from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Falcon's obligation and nemesis set (53029 Harlem's Protector; 53030 Viper, 53031 Serpent Solutions, 53032 Serpent
 * Soldier, 53033 Adder-tisement), docs/phase7-wave9.md section 8.4, 3.43 (b). The printed precon `falcon-leadership`
 * against Core's Rhino (stage 1: ATK 2, SCH 1). Falcon hero face: DEF 2; Eagle-Eyed (53001a) discards the top card of
 * the encounter deck after an Aerial card is played, which is how Serpent Solutions is made to hear a discard by an
 * effect; Infiltration 51015 (Black Panther's pack, borrowed through a swap) is a discard by a cost.
 */
const PROTECTOR = "53029";
const VIPER = "53030";
const SOLUTIONS = "53031";
const SOLDIER = "53032";
const ADDER = "53033";
const FILLER = "01186"; // Advance: 0 boost icons
const CHARGE = "01099"; // Rhino attachment, 2 boost icons
const MERCENARY = "01101"; // minion without the Serpent Society trait, 1 boost icon
const FLOCK = "53006"; // Aerial support, cost 2 (another module's card: only that it is played is used here)
const INFILTRATION = "51015";
const EAGLE = "53001a.eagle-eyed";
const ACTION = "53029.harlems-protector-action";
const REFS = [
  "53029.harlems-protector-constant",
  ACTION,
  "53030.viper-forced-response",
  "53031.serpent-solutions-forced-response",
  "53032.boost",
  "53033.when-revealed",
];

const DEPS: EngineDeps = { abilities: mergeRegistries(FALCON_DEPS.abilities, BP_ABILITIES) };
const data = (code: string) => FALCON_CARDS.find((c) => (c.id as string) === code)! as any;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const deckCodes = (s: GameState, n = 99): string[] =>
  piles(s)
    .deck.slice(0, n)
    .map((i) => codeOf(s, i));
const discardCodes = (s: GameState): string[] => piles(s).discard.map((i) => codeOf(s, i));
const dealtCodes = (s: GameState): string[] => playerOf(s, P1).dealtEncounter.map((i) => codeOf(s, i));
const setAsideCodes = (s: GameState): string[] => playerOf(s, P1).setAside.map((i) => codeOf(s, i));
const emergency = (s: GameState, id: InstanceId): number => inst(s, id).counters.emergency ?? 0;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const mainThreat = (s: GameState): number => inst(s, s.mainScheme.instanceId).threat;
const endPhase = (s: GameState): Command[] => s.players.map((p) => endTurn(p.playerId));
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);
const picker =
  (choose?: (s: GameState) => readonly string[] | undefined): Picker =>
  (s) => {
    const prompt = s.pendingChoice!.prompt;
    if (prompt.kind === "declareDefender") return ["decline"];
    return choose?.(s) ?? firstLegal(s);
  };
/** Takes every Eagle-Eyed response offered. */
const takeEagle = picker((s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind !== "chooseTriggers") return undefined;
  const mine = choice.options.find((o) => o.optionId.endsWith(EAGLE));
  return mine ? [mine.optionId] : undefined;
});

/** The first instance of `code`, the set-aside copy before any other. */
const findCard = (s: GameState, code: string): InstanceId =>
  playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code) ?? instancesOf(s, code)[0]!;

/**
 * The encounter deck stacked, top first, with `codes`: a set-aside copy for a nemesis card, else a plain deck card
 * (not the obligation) relabeled to that code (the Core deck holds few copies of each), the rest of the deck behind.
 */
function stacked(s: GameState, ...codes: readonly string[]): GameState {
  let cur = s;
  const used: InstanceId[] = [];
  for (const code of codes) {
    const aside = playerOf(cur, P1).setAside.find((i) => codeOf(cur, i) === code && !used.includes(i));
    if (aside) {
      used.push(aside);
      continue;
    }
    const pool = [...piles(cur).deck, ...piles(cur).discard];
    const existing = code === PROTECTOR ? pool.find((i) => codeOf(cur, i) === code) : undefined;
    if (existing) {
      used.push(existing);
      continue;
    }
    const plain = pool.find(
      (i) => !used.includes(i) && ![PROTECTOR, VIPER, SOLUTIONS, SOLDIER, ADDER].includes(codeOf(cur, i)),
    );
    if (!plain) throw new Error(`no plain card to stack as ${code}`);
    cur = relabel(cur, plain, code);
    used.push(plain);
  }
  const deckId = activeEncounterDeckId(cur);
  const pile = piles(cur);
  return {
    ...cur,
    players: cur.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !used.includes(i)) })),
    encounterDecks: {
      ...cur.encounterDecks,
      [deckId]: {
        deck: [...used, ...pile.deck.filter((i) => !used.includes(i))],
        discard: pile.discard.filter((i) => !used.includes(i)),
      },
    },
  };
}
/** Fillers (Advance, 0 boost icons) over the cards from position `from` to `to` of the deck. */
function filled(s: GameState, from: number, to: number): GameState {
  return piles(s)
    .deck.slice(from, to)
    .reduce((acc, id) => relabel(acc, id, FILLER), s);
}
/** `code` revealed to P1 in the next villain phase, behind one filler for Rhino's boost card. */
function reveal(s: GameState, code: string, pick: Picker = picker(), after: readonly string[] = []) {
  const withFiller = stacked(s, FILLER, code, ...after);
  const { state, events } = run(withFiller, pick, ...endPhase(withFiller));
  return { state, events, id: findCard(withFiller, code) };
}
/** `code` (a set-aside copy) put straight into play engaged with P1. */
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
/** Serpent Solutions put into the villain area with its 6 threat, as a revealed side scheme sits. */
function withSolutions(s: GameState): { state: GameState; id: InstanceId } {
  return encounterCardInVillainArea(stackSetAside(s, SOLUTIONS), SOLUTIONS, 6);
}
/** Falcon in hero form, Serpent Solutions in play, the deck stacked with `top`. */
function table(...top: readonly string[]): { state: GameState; solutions: InstanceId } {
  const { state, id } = withSolutions(falconHeroGame());
  return { state: stacked(state, ...top), solutions: id };
}
/** Plays Flock (Aerial) from hand, answering Eagle-Eyed. */
function playFlock(s: GameState, pick: Picker = takeEagle) {
  const given = moveToHand(s, P1, FLOCK);
  const id = given.ids[0]!;
  return run(given.state, pick, play(P1, id, payWith(given.state, P1, 2, [id])));
}

describe("registry", () => {
  it("registers every ref the five cards list; nothing is skipped", () => {
    const refs = FALCON_CARDS.filter((c) => (c.id as string) >= PROTECTOR && (c.id as string) <= ADDER).flatMap(
      abilityRefIds,
    );
    expect([...refs].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (id) => {
    expect(validateDefinition(REGISTRY[id as never]!)).toEqual([]);
  });
  it("timing: the Protector a constant and an alter-ego action, Viper and Solutions forced responses, the Soldier a boost, Adder-tisement a When Revealed", () => {
    expect(REGISTRY["53029.harlems-protector-constant" as never]!.trigger).toMatchObject({ kind: "constant" });
    expect(REGISTRY[ACTION as never]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
    expect(REGISTRY["53030.viper-forced-response" as never]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY["53031.serpent-solutions-forced-response" as never]!.trigger).toMatchObject({
      kind: "response",
      forced: true,
    });
    expect(REGISTRY["53032.boost" as never]!.trigger).toMatchObject({ kind: "boost" });
    expect(REGISTRY["53033.when-revealed" as never]!.trigger).toMatchObject({ kind: "whenRevealed" });
  });
});

describe("the printed cards and setup", () => {
  it("Harlem's Protector: obligation, 2 boost icons, Uses 3 emergency counters, Victory 0, in no encounter set", () => {
    expect(data(PROTECTOR)).toMatchObject({ type: "obligation", boostIcons: 2, encounterSetIds: [] });
    expect(data(PROTECTOR).keywords).toEqual([
      { name: "uses", count: 3, counterType: "emergency" },
      { name: "victory", value: 0 },
    ]);
  });
  it("Viper: unique minion ATK 2 SCH 2 HP 5, 2 boost icons and a star, Quickstrike, Serpent Society", () => {
    expect(data(VIPER)).toMatchObject({ type: "minion", atk: 2, sch: 2, hp: 5, boostIcons: 2, unique: true });
    expect(data(VIPER).keywords).toEqual([{ name: "quickstrike" }]);
    expect(data(VIPER).traits).toEqual(["SERPENT SOCIETY"]);
    expect(data(VIPER).nemesisMinion).toBe(true);
  });
  it("Serpent Solutions: side scheme with 6 threat however many players, no icons, 1 boost icon", () => {
    expect(data(SOLUTIONS)).toMatchObject({
      type: "side_scheme",
      startingThreat: { base: 6, perPlayer: 0 },
      icons: [],
      boostIcons: 1,
    });
  });
  it("Serpent Soldier: minion ATK 2 SCH 1 HP 3, Quickstrike, no boost icons and a star, two copies", () => {
    expect(data(SOLDIER)).toMatchObject({
      type: "minion",
      atk: 2,
      sch: 1,
      hp: 3,
      boostIcons: 0,
      starIcon: true,
      quantityInSet: 2,
      unique: false,
    });
    expect(data(SOLDIER).keywords).toEqual([{ name: "quickstrike" }]);
    expect(data(SOLDIER).traits).toEqual(["SERPENT SOCIETY"]);
  });
  it("Adder-tisement: treachery with Surge and 1 boost icon", () => {
    expect(data(ADDER)).toMatchObject({ type: "treachery", boostIcons: 1 });
    expect(data(ADDER).keywords).toEqual([{ name: "surge" }]);
  });
  it("the nemesis set (Viper, Solutions, two Soldiers, Adder-tisement) is set aside; the obligation is in the encounter deck once", () => {
    const s = falconGame();
    const aside = setAsideCodes(s);
    expect([...aside].sort()).toEqual([VIPER, SOLUTIONS, SOLDIER, SOLDIER, ADDER].sort());
    const all = Object.values(s.encounterDecks).flatMap((d) => d.deck.map((i) => codeOf(s, i)));
    expect(all.filter((c) => c === PROTECTOR)).toHaveLength(1);
    expect(all.some((c) => [VIPER, SOLUTIONS, SOLDIER, ADDER].includes(c))).toBe(false);
  });
});

describe("53029 Harlem's Protector", () => {
  /** Revealed in the villain phase: it stays in the Sam Wilson player's play area. */
  const holding = () => {
    const { state, id } = reveal(falconGame(), PROTECTOR);
    return { state: patchInstance(state, identityOf(state), { damage: 0 }), id };
  };
  const spendOne = (s: GameState, id: InstanceId) => {
    const hand = playerOf(s, P1).hand;
    return run(s, picker(), use(P1, id, ACTION, [{ fromHand: hand[0]! }]));
  };

  it("revealed it is given to the Sam Wilson player with 3 emergency counters, and is not discarded", () => {
    const { state, id } = holding();
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(discardCodes(state)).not.toContain(PROTECTOR);
    expect(emergency(state, id)).toBe(3);
  });
  it("Alter-Ego Action: spending 1 resource (a card from hand, whatever its type) removes 1 counter: 3, 2, 1, 0", () => {
    let { state, id } = holding();
    expect(state.players[0]!.identity.form).toBe("alterEgo");
    const seen: number[] = [];
    for (let i = 0; i < 3; i++) {
      const handBefore = playerOf(state, P1).hand.length;
      const hand0 = playerOf(state, P1).hand[0]!;
      state = spendOne(state, id).state;
      seen.push(emergency(state, id));
      expect(playerOf(state, P1).hand).toHaveLength(handBefore - 1);
      expect(playerOf(state, P1).hand).not.toContain(hand0);
    }
    expect(seen).toEqual([2, 1, 0]);
  });
  it("it is an alter-ego action only: in hero form it cannot be used", () => {
    const { state, id } = holding();
    const hero = withForm(state, { heroForm: 0 });
    const hand = playerOf(hero, P1).hand;
    expect(() => run(hero, picker(), use(P1, id, ACTION, [{ fromHand: hand[0]! }]))).toThrow();
  });
  it("the cost is required in full: with no payment the action is refused and the counters stay", () => {
    const { state, id } = holding();
    expect(() => run(state, picker(), use(P1, id, ACTION, []))).toThrow();
    expect(emergency(state, id)).toBe(3);
  });
  it("the last counter removed: Uses (RRG 1.8 p. 46) leaves play after the third use, not before (to the victory display, Victory 0), and nothing else happens", () => {
    let { state, id } = holding();
    const mainBefore = mainThreat(state);
    const damageBefore = damageOf(state, identityOf(state));
    for (let i = 0; i < 2; i++) state = spendOne(state, id).state;
    expect(playerOf(state, P1).playArea).toContain(id);
    expect(emergency(state, id)).toBe(1);
    state = spendOne(state, id).state;
    expect(playerOf(state, P1).playArea).not.toContain(id);
    // Victory 0: a card with a Victory keyword that leaves play goes to the victory display, worth 0.
    expect(state.victoryDisplay).toContain(id);
    expect(discardCodes(state)).not.toContain(PROTECTOR);
    expect(mainThreat(state)).toBe(mainBefore);
    expect(damageOf(state, identityOf(state))).toBe(damageBefore);
  });
});

describe("53030 Viper in a real villain phase", () => {
  /** Viper engaged with the hero in hero form, undefended; Rhino's boost card and the deck behind it are fillers. */
  function attackedByViper(stack: readonly string[], opts: { alterEgo?: boolean } = {}) {
    const base = opts.alterEgo ? falconGame() : withForm(falconGame(), { heroForm: 0 });
    const { state: s, id } = engaged(base, VIPER);
    const staged = filled(stacked(s, FILLER, ...stack), 0, 14);
    const restaged = stacked(staged, FILLER, ...stack);
    const { state, events } = run(restaged, picker(), ...endPhase(restaged));
    return { state, events, id, before: restaged };
  }
  it("stats and keyword from the game: ATK 2, SCH 2, 5 hit points, Quickstrike", () => {
    const { state: s, id } = engaged(falconGame(), VIPER);
    const p = characterProfile(s, id, DEPS)!;
    expect([p.atk, p.sch, p.maxHp]).toEqual([2, 2, 5]);
    expect(hasKeyword(s, id, "quickstrike", DEPS)).toBe(true);
  });
  it("hero form, undefended: Viper hits for 2, then discards the top 5 cards of the encounter deck", () => {
    const stack = [CHARGE, CHARGE, CHARGE, CHARGE, CHARGE, FILLER];
    const { state, events, id, before } = attackedByViper(stack);
    const hit = ofType(events, "attackResolved").find((e) => e.enemyInstanceId === id)!;
    expect([hit.baseAtk, hit.boostIcons, hit.damageDealt]).toEqual([2, 0, 2]);
    // The five cards under Rhino's boost card were discarded after Viper's attack: 5 Charge cards.
    expect(discardCodes(state).filter((c) => c === CHARGE)).toHaveLength(5);
    expect(deckCodes(before, 1)).toEqual([FILLER]);
  });
  it("alter-ego form: Viper schemes for 2 and then discards the top 5", () => {
    const stack = [CHARGE, CHARGE, CHARGE, CHARGE, CHARGE, FILLER];
    const { state, events, id, before } = attackedByViper(stack, { alterEgo: true });
    void before;
    const schemes = ofType(events, "schemeResolved");
    const viperScheme = schemes.find((e) => e.enemyInstanceId === id)!;
    expect([viperScheme.baseSch, viperScheme.boostIcons, viperScheme.threatPlaced]).toEqual([2, 0, 2]);
    expect(discardCodes(state).filter((c) => c === CHARGE)).toHaveLength(5);
  });
  it("a stunned Viper does not activate, so nothing is discarded", () => {
    const { state: s, id } = engaged(withForm(falconGame(), { heroForm: 0 }), VIPER);
    const stunned = patchInstance(s, id, { statuses: { ...inst(s, id).statuses, stunned: 1 } });
    const staged = stacked(stunned, FILLER, CHARGE, CHARGE, CHARGE, CHARGE, CHARGE, FILLER);
    const { state } = run(staged, picker(), ...endPhase(staged));
    expect(discardCodes(state).filter((c) => c === CHARGE)).toHaveLength(0);
  });
});

describe("53031 Serpent Solutions hears a Serpent Society minion discarded from the top of the encounter deck", () => {
  it("Eagle-Eyed (an effect) discards a Serpent Soldier: it is dealt to the first player facedown, not left in the discard pile", () => {
    const { state: s } = table(SOLDIER, CHARGE, FILLER);
    const { state } = playFlock(s);
    expect(dealtCodes(state)).toEqual([SOLDIER]);
    expect(discardCodes(state)).not.toContain(SOLDIER);
    expect(deckCodes(state, 2)).toEqual([CHARGE, FILLER]);
    const dealt = playerOf(state, P1).dealtEncounter[0]!;
    expect(inst(state, dealt).faceup).toBe(false);
  });
  it("the dealt Soldier is revealed in the next villain phase and engages the first player", () => {
    const { state: s } = table(SOLDIER, FILLER, FILLER, FILLER);
    const played = playFlock(s).state;
    const { state } = run(played, picker(), ...endPhase(played));
    const soldiers = instancesOf(state, SOLDIER).filter((i) => inst(state, i).engagedWith === P1);
    expect(soldiers).toHaveLength(1);
  });
  it("a card that is not a Serpent Society minion (a treachery, a minion without the trait) is discarded as usual", () => {
    for (const code of [CHARGE, MERCENARY]) {
      const { state: s } = table(code, FILLER);
      const { state } = playFlock(s);
      expect(dealtCodes(state)).toEqual([]);
      expect(discardCodes(state)).toContain(code);
    }
  });
  it("without Serpent Solutions in play the Soldier is simply discarded", () => {
    const s = stacked(falconHeroGame(), SOLDIER, FILLER);
    const { state } = playFlock(s);
    expect(dealtCodes(state)).toEqual([]);
    expect(discardCodes(state)).toContain(SOLDIER);
  });
  it("Eagle-Eyed declined: nothing is discarded, nothing dealt", () => {
    const { state: s } = table(SOLDIER, FILLER);
    const { state } = playFlock(s, picker());
    expect(dealtCodes(state)).toEqual([]);
    expect(deckCodes(state, 1)).toEqual([SOLDIER]);
  });
  it("the deal is a forced response: no choice is offered to the player for it", () => {
    const { state: s } = table(SOLDIER, FILLER);
    const kinds: string[] = [];
    playFlock(
      s,
      picker((st) => {
        kinds.push(st.pendingChoice!.prompt.kind);
        return takeEagle(st);
      }),
    );
    expect(kinds.filter((k) => k === "chooseTriggers")).toHaveLength(1);
  });
  it("Viper's discard of 5 with two Soldiers among them: both are dealt facedown to the first player", () => {
    const { state: s } = withSolutions(withForm(falconGame(), { heroForm: 0 }));
    const { state: withViper } = engaged(s, VIPER);
    const staged = stacked(withViper, FILLER, SOLDIER, CHARGE, SOLDIER, CHARGE, CHARGE, FILLER, FILLER);
    const { state } = run(staged, picker(), ...endPhase(staged));
    const soldiersDealtOrRevealed = instancesOf(state, SOLDIER).filter(
      (i) => inst(state, i).engagedWith === P1 || playerOf(state, P1).dealtEncounter.includes(i),
    );
    expect(soldiersDealtOrRevealed).toHaveLength(2);
    expect(discardCodes(state)).not.toContain(SOLDIER);
    expect(discardCodes(state).filter((c) => c === CHARGE)).toHaveLength(3);
  });
  it("a cost that discards (Infiltration, choosing 3) with two Soldiers: both dealt, and only the one other card counts for threat", () => {
    const base = falconHeroGame({ swap: { "53007": INFILTRATION } });
    const { state: sol } = withSolutions(patchInstance(base, base.mainScheme.instanceId, { threat: 6 }));
    const staged = stacked(sol, SOLDIER, CHARGE, SOLDIER, FILLER, FILLER);
    const given = moveToHand(staged, P1, INFILTRATION);
    const id = given.ids[0]!;
    const { state } = run(
      given.state,
      picker(),
      play(P1, id, payWith(given.state, P1, 1, [id]), { costSelection: { discardFromEncounterDeck: 3 } }),
    );
    expect(dealtCodes(state).sort()).toEqual([SOLDIER, SOLDIER]);
    expect(discardCodes(state)).toContain(CHARGE);
    expect(discardCodes(state)).not.toContain(SOLDIER);
    // Only the Charge card is "discarded this way" once the Soldiers are dealt away (wave 7 Q32).
    expect(mainThreat(state)).toBe(5);
    // And no minion remains to be put into play engaged with the player.
    expect(instancesOf(state, SOLDIER).filter((i) => inst(state, i).engagedWith === P1)).toEqual([]);
  });
  it("a boost card discarded after an activation is not heard: a Soldier given to Rhino as his boost card stays in the discard pile", () => {
    const { state: s } = table(SOLDIER, FILLER, FILLER);
    const { state } = run(s, picker(), ...endPhase(s));
    expect(dealtCodes(state)).toEqual([]);
    expect(discardCodes(state)).toContain(SOLDIER);
  });
  it("a revealed card is not a discard: a Soldier revealed behind Rhino's boost card engages, and nothing is dealt", () => {
    const { state: s } = table(FILLER, SOLDIER, FILLER);
    const { state } = run(s, picker(), ...endPhase(s));
    expect(instancesOf(state, SOLDIER).filter((i) => inst(state, i).engagedWith === P1)).toHaveLength(1);
    expect(dealtCodes(state)).toEqual([]);
  });
  it("the discard that empties the deck: the Soldier is taken from the new deck (reset) and dealt", () => {
    const { state: s } = table(SOLDIER);
    const deckId = activeEncounterDeckId(s);
    const pile = piles(s);
    const soldier = pile.deck[0]!;
    const emptied: GameState = {
      ...s,
      encounterDecks: {
        ...s.encounterDecks,
        [deckId]: { deck: [soldier], discard: [...pile.deck.slice(1), ...pile.discard] },
      },
    };
    const { state } = playFlock(emptied);
    expect(dealtCodes(state)).toEqual([SOLDIER]);
    // The reset shuffled the old discard pile into a new deck: the Soldier is in neither pile.
    expect(piles(state).deck).not.toContain(soldier);
    expect(piles(state).discard).not.toContain(soldier);
    expect(piles(state).deck.length).toBeGreaterThan(0);
  });
});

describe("53032 Serpent Soldier as a boost card and in play", () => {
  it("in play: ATK 2, SCH 1, 3 hit points, Quickstrike", () => {
    const { state: s, id } = engaged(falconGame(), SOLDIER);
    const p = characterProfile(s, id, DEPS)!;
    expect([p.atk, p.sch, p.maxHp]).toEqual([2, 1, 3]);
    expect(hasKeyword(s, id, "quickstrike", DEPS)).toBe(true);
  });
  /** The boost cards Rhino was given before his first attack resolved, by card code, and that attack's boost icons. */
  function rhinoFirstAttack(...top: readonly string[]) {
    const base = withForm(falconGame(), { heroForm: 0 });
    const staged = stacked(filled(base, 0, 10), ...top);
    const { events } = run(staged, picker(), ...endPhase(staged));
    const rhino = staged.activeVillainId!;
    const upTo = events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === rhino);
    const first = events.slice(0, upTo + 1);
    const dealt = ofType(first, "boostCardDealt")
      .filter((e) => e.enemyInstanceId === rhino)
      .map((e) => codeOf(staged, e.instanceId));
    return { dealt, hit: ofType(first, "attackResolved").find((e) => e.enemyInstanceId === rhino)! };
  }
  it("Boost: Rhino's attack gets one additional boost card for this activation, and its icons count", () => {
    const { dealt, hit } = rhinoFirstAttack(SOLDIER, MERCENARY, FILLER, FILLER);
    expect(dealt).toEqual([SOLDIER, MERCENARY]);
    // Rhino ATK 2 + the Soldier's 0 icons + the Mercenary's 1 icon (a star is not a boost icon).
    expect([hit.baseAtk, hit.boostIcons]).toEqual([2, 1]);
  });
  it("any other boost card (Mercenary) gives no additional boost card", () => {
    const { dealt, hit } = rhinoFirstAttack(MERCENARY, SOLDIER, FILLER, FILLER);
    expect(dealt).toEqual([MERCENARY]);
    expect([hit.baseAtk, hit.boostIcons]).toEqual([2, 1]);
  });
});

describe("53033 Adder-tisement", () => {
  /** Revealed in the villain phase with the given codes already in the encounter discard pile. */
  function revealedWith(inDiscard: readonly string[]) {
    const s = falconGame();
    const deckId = activeEncounterDeckId(s);
    let cur = s;
    const moved: InstanceId[] = [];
    for (const code of inDiscard) {
      const id = playerOf(cur, P1).setAside.find((i) => codeOf(cur, i) === code && !moved.includes(i))!;
      moved.push(id);
    }
    cur = {
      ...cur,
      players: cur.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => !moved.includes(i)) })),
      encounterDecks: {
        ...cur.encounterDecks,
        [deckId]: { deck: piles(cur).deck, discard: [...moved, ...piles(cur).discard] },
      },
    };
    return reveal(cur, ADDER, picker(), [FILLER, FILLER]);
  }
  it("shuffles each Serpent Society minion from the discard pile into the deck; other discards stay", () => {
    const { state } = revealedWith([VIPER, SOLDIER, SOLDIER]);
    const deck = piles(state).deck.map((i) => codeOf(state, i));
    expect(deck.filter((c) => c === VIPER)).toHaveLength(1);
    expect(deck.filter((c) => c === SOLDIER)).toHaveLength(2);
    const disc = discardCodes(state);
    expect(disc).not.toContain(VIPER);
    expect(disc).not.toContain(SOLDIER);
    // Rhino's boost card and Adder-tisement itself stay discarded.
    expect(disc).toContain(FILLER);
    expect(disc).toContain(ADDER);
  });
  it("Surge: Adder-tisement reveals the next card as well", () => {
    const { events } = revealedWith([SOLDIER]);
    expect(ofType(events, "encounterCardRevealed").length).toBeGreaterThanOrEqual(2);
  });
  it("with no Serpent Society minion in the discard pile the deck's cards are unchanged in number and nothing is moved", () => {
    const { state } = revealedWith([]);
    expect(discardCodes(state)).not.toContain(SOLDIER);
    expect(piles(state).deck.map((i) => codeOf(state, i))).not.toContain(VIPER);
  });
  it("with Serpent Solutions in play a minion shuffled back in is not dealt: a shuffle is not a discard from the top", () => {
    const { state: sol } = withSolutions(falconGame());
    const deckId = activeEncounterDeckId(sol);
    const soldier = playerOf(sol, P1).setAside.find((i) => codeOf(sol, i) === SOLDIER)!;
    const withDiscard: GameState = {
      ...sol,
      players: sol.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== soldier) })),
      encounterDecks: { ...sol.encounterDecks, [deckId]: { deck: piles(sol).deck, discard: [soldier] } },
    };
    const { state } = reveal(withDiscard, ADDER, picker(), [FILLER, FILLER]);
    expect(dealtCodes(state)).toEqual([]);
    expect(piles(state).deck).toContain(soldier);
  });
});
