import { cardId, ICEMAN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { coreScenario } from "../../../core/setup.js";
import { cards, defineAbilities, forcedResponse, mergeRegistries, moveCards, on, self } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { ICEMAN_EVENTS, ICEMAN_EVENTS_SKIPPED } from "./events.js";
import { ICEMAN_IDENTITY } from "./identity.js";
import { ICEMAN_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iceman's signature events (46009 Arctic Attack, 46010 Ice Blast, 46011 Chill Out!), docs/phase7-wave8.md section 7.2,
 * 3.61, 3.67; Q35 = A, Q38 = A. Real commands in a real game: his starter deck (`iceman-aggression`) against Rhino.
 * Hero face: THW 1, ATK 2, DEF 2, 11 hit points. Rhino (stage 1): ATK 2, SCH 1, 14 hit points per hero. Sandman
 * (01102, relabeled from an encounter card): ATK 3, SCH 2, 4 hit points; Mercenary (01101): 3 hit points.
 *
 * Frostbite's Forced Response is not registered (the supports module pins the gap, section 3.61): the engine here runs
 * `HALF`, its activation half, as the supports tests do. A defeated Frostbitten enemy leaves its copy unattached in the
 * play area rather than set aside, so no test asserts where that copy ends up, and none reads "Frostbite attached" after
 * a defeating attack. A copy that was never attached (the host was defeated before the attach step) stays set aside.
 */
const FROSTBITE_CODE = "46002";
const ARCTIC = "46009";
const BLAST = "46010";
const CHILL = "46011";
const KIT = new Set([ARCTIC, BLAST, CHILL]);
const FREEZE = "46001a.freeze";
const REFS = ["46009.arctic-attack-action", "46010.ice-blast-action", "46011.chill-out-action"];

const HALF = defineAbilities({
  "46002.frostbite-forced-response": forcedResponse(on.enemyActivates("host"), moveCards(cards(self), "setAside")),
});
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, ICEMAN_IDENTITY, ICEMAN_SUPPORT_UPGRADES_ALLIES, ICEMAN_EVENTS, HALF),
};
const POOL: readonly AnyCard[] = [...WAVE8_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_DECK = ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = { readonly kind: "iceman" | "core"; readonly extra: readonly string[] };
const ICE = (...extra: string[]): Seat => ({ kind: "iceman", extra });
/** Spider-Man (Justice precon), given Iceman cards by name (`requireLegalDecks: false`). */
const SM = (...extra: string[]): Seat => ({ kind: "core", extra });

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const setAsideCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).setAside.map((id) => codeOf(s, id));
const supply = (s: GameState, p: PlayerId = P1): number =>
  setAsideCodes(s, p).filter((c) => c === FROSTBITE_CODE).length;
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE_CODE).filter((id) => inst(s, id).attachedTo === host).length;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const inPlay = (s: GameState, id: InstanceId): boolean =>
  s.players.some((p) => p.playArea.includes(id)) || s.activeVillainId === id;
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));

function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const players = seats.map((seat) => {
    const base =
      seat.kind === "iceman"
        ? { identityCardId: ICEMAN.identityCardId, aspects: ICEMAN.aspects, deck: ICEMAN_DECK }
        : coreScenario("rhino", { players: [SPIDER_MAN], seed, modularSetIds: [] }).players[0]!;
    return { ...base, deck: [...base.deck, ...seat.extra.map((code) => cardId(code))] };
  });
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
/** Hero form for every seat. */
const heroGame = (seats: readonly Seat[] = [ICE()]): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats));
/** Iceman is seat 1, Spider-Man seat 2. */
const TWO: readonly Seat[] = [ICE(), SM()];

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const ready = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: false });
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;

/** A minion relabeled from the next spare encounter card, engaged with `to` and faceup (no printed text of its own is under test). */
function withMinion(
  s: GameState,
  to: PlayerId = P1,
  code = "01102",
): { readonly state: GameState; readonly id: InstanceId } {
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
/** `n` more minions in a row, each engaged with `to`. */
function withMinions(s: GameState, to: PlayerId, ...codes: readonly string[]) {
  let state = s;
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const next = withMinion(state, to, code);
    state = next.state;
    ids.push(next.id);
  }
  return { state, ids };
}

/** Picks by prompt: "Freeze!" is taken when `freeze`; targets and players by the ordered `wanted` ids; else the first option. */
const picker =
  (opts: { freeze?: boolean; pick?: readonly string[]; option?: number } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      const freeze = opts.freeze ? choice.options.find((o) => o.optionId.endsWith(FREEZE)) : undefined;
      return freeze ? [freeze.optionId] : [];
    }
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseOption") {
      return [ids[opts.option ?? 0]!];
    }
    const wanted = (opts.pick ?? []).filter((w) => ids.includes(w));
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections) : firstLegal(s);
  };
const takeFreeze = picker({ freeze: true });
const run = (s: GameState, pick: Picker, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, pick, ...commands);
const attack = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});

/** `times` real "Freeze!" attacks on `target` (the villain by default); Iceman is readied and the target's damage cleared after each. */
function freeze(s: GameState, times: number, target?: InstanceId): GameState {
  let current = s;
  for (let i = 0; i < times; i++) {
    const to = target ?? villainOf(current);
    const { state } = run(current, takeFreeze, attack(current, to));
    current = patchInstance(ready(state, identityOf(state)), to, { damage: 0 });
  }
  return current;
}

/** Resource cards in hand that pay `cost` (exact icons), never a card the tests stage by name. */
function payers(s: GameState, p: PlayerId, cost: number, not: readonly InstanceId[] = []): InstanceId[] {
  const out: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(s, p).hand) {
    if (paid >= cost) break;
    if (not.includes(h) || KIT.has(codeOf(s, h)) || iconsOf(s, h) === 0) continue;
    out.push(h);
    paid += iconsOf(s, h);
  }
  if (paid < cost) throw new Error(`not enough resource cards in hand to pay ${cost}`);
  return out;
}
/** Adds resource cards to the hand so a test can pay for a card (hand size is only enforced at turn end). */
function withResources(s: GameState, n: number, p: PlayerId = P1): GameState {
  const owner = playerOf(s, p);
  const fill = owner.deck
    .filter(
      (id) =>
        iconsOf(s, id) > 0 &&
        !KIT.has(codeOf(s, id)) &&
        !(BY_ID.get(codeOf(s, id)) as { type: string }).type.startsWith("hero"),
    )
    .slice(0, n);
  return {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p ? { ...pl, deck: pl.deck.filter((id) => !fill.includes(id)), hand: [...pl.hand, ...fill] } : pl,
    ),
  };
}
/** An event in hand: the state, the card, and the exact cards that pay for it. */
function inHand(s: GameState, code: string, p: PlayerId = P1) {
  const given = moveToHand(withResources(s, 4, p), p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  return { state: given.state, id, pay: payers(given.state, p, cost, [id]) };
}
type Staged = ReturnType<typeof inHand>;
/** Plays the staged event with `pick` answering its choices, and the prompts it put (kind, then option labels). */
function playStaged(staged: Staged, pick: Picker = picker(), p: PlayerId = P1) {
  const seen: { kind: string; player: string; options: string[] }[] = [];
  const spying: Picker = (s) => {
    const c = s.pendingChoice!;
    seen.push({
      kind: c.prompt.kind,
      player: c.playerId as string,
      options: c.options.map((o) => o.optionId as string),
    });
    return pick(s);
  };
  const result = driveEventsPicking(DEPS, staged.state, spying, play(p, staged.id, staged.pay));
  return { ...result, seen };
}
const playCommand = (staged: Staged, p: PlayerId = P1): Command => play(p, staged.id, staged.pay);

describe("registry", () => {
  it("registers the three events' three refs and skips none", () => {
    const refs = ICEMAN_CARDS.filter((c) => (c.id as string) >= ARCTIC && (c.id as string) <= CHILL).flatMap(
      abilityRefIds,
    );
    expect(refs.sort()).toEqual(REFS);
    expect(Object.keys(ICEMAN_EVENTS).sort()).toEqual(REFS);
    expect(Object.keys(ICEMAN_EVENTS_SKIPPED)).toEqual([]);
  });
  it.each(REFS)("%s validates and is a Hero Action", (id) => {
    expect(validateDefinition(ICEMAN_EVENTS[id]!)).toEqual([]);
    expect(ICEMAN_EVENTS[id]!.trigger).toMatchObject({ kind: "action", form: "hero" });
  });
  it("Arctic Attack is labeled attack, Chill Out! thwart and Ice Blast neither", () => {
    expect(ICEMAN_EVENTS["46009.arctic-attack-action"]!.label).toEqual(["attack"]);
    expect(ICEMAN_EVENTS["46011.chill-out-action"]!.label).toEqual(["thwart"]);
    expect(ICEMAN_EVENTS["46010.ice-blast-action"]!.label ?? []).toEqual([]);
  });
  it("starting state: six copies set aside, three kit events listed in the starter deck (x2, x2, x3)", () => {
    const s = heroGame();
    expect(supply(s)).toBe(6);
    const listed = (code: string) => ICEMAN.cards.find((c) => (c.cardId as string) === code)!.quantity;
    expect([listed(ARCTIC), listed(BLAST), listed(CHILL)]).toEqual([2, 2, 3]);
  });
});

describe("Arctic Attack (46009)", () => {
  it("option 1 on Rhino: costs 2, deals 4 damage and attaches one set-aside copy (5 left); the event is discarded", () => {
    const s = heroGame();
    const staged = inHand(s, ARCTIC);
    expect(staged.pay.reduce((n, id) => n + iconsOf(staged.state, id), 0)).toBeGreaterThanOrEqual(2);
    const handBefore = playerOf(staged.state, P1).hand.length;
    const { state, events, seen } = playStaged(staged);
    // Only one option is possible, so the player is asked for the target alone.
    expect(seen.map((p) => p.kind)).toEqual(["chooseTarget"]);
    expect(damageTo(events, villainOf(state))).toEqual([4]);
    expect(damageOf(state, villainOf(state))).toBe(4);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
    expect(discardCodes(state)).toContain(ARCTIC);
    expect(playerOf(state, P1).hand.length).toBe(handBefore - 1 - staged.pay.length);
    // An (attack) ability does not exhaust the hero.
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("it is an attack (the (attack) label): guard applies, so a guard minion (Hydra Mercenary) keeps Rhino from being a target", () => {
    const { state: s, id: guard } = withMinion(heroGame(), P1, "01101");
    const { seen, state } = playStaged(inHand(s, ARCTIC));
    expect(seen.find((p) => p.kind === "chooseTarget")!.options).toEqual([guard]);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("does not raise the 'freeze' moment or offer Freeze!", () => {
    const { events, seen } = playStaged(inHand(heroGame(), ARCTIC));
    expect(events.some((e) => e.type === "momentRaised")).toBe(false);
    expect(seen.some((p) => p.kind === "chooseTriggers")).toBe(false);
  });
  it("with a copy already on Rhino both options are offered: option 1 adds a second copy (2 on Rhino, 4 set aside)", () => {
    const staged = inHand(freeze(heroGame(), 1), ARCTIC);
    const { state, seen } = playStaged(staged, picker({ option: 0 }));
    expect(seen.map((p) => p.kind)).toEqual(["chooseOption", "chooseTarget"]);
    expect(seen[0]!.options).toHaveLength(2);
    expect(damageOf(state, villainOf(state))).toBe(4);
    expect(frostbiteOn(state, villainOf(state))).toBe(2);
    expect(supply(state)).toBe(4);
  });
  it("option 2 on the frostbitten Rhino: 6 damage and no further copy (1 on Rhino, 5 set aside)", () => {
    const staged = inHand(freeze(heroGame(), 1), ARCTIC);
    const { state, events, seen } = playStaged(staged, picker({ option: 1 }));
    expect(seen.map((p) => p.kind)).toEqual(["chooseOption", "chooseTarget"]);
    expect(damageTo(events, villainOf(state))).toEqual([6]);
    expect(damageOf(state, villainOf(state))).toBe(6);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
  });
  it("option 2 offers only enemies with a copy: a copy on a minion, none on the villain, and the villain is not a choice", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const staged = inHand(freeze(s, 1, minion), ARCTIC);
    const { state, events, seen } = playStaged(staged, picker({ option: 1 }));
    const targetPrompt = seen.find((p) => p.kind === "chooseTarget")!;
    expect(targetPrompt.options).toEqual([minion]);
    // Sandman has 4 hit points: 6 damage defeats him.
    expect(damageTo(events, minion)).toEqual([6]);
    expect(inPlay(state, minion)).toBe(false);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("the condition is read for the target, not the board: a copy on the villain does not make a bare minion a target of option 2", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const staged = inHand(freeze(s, 1), ARCTIC);
    const { seen } = playStaged(staged, picker({ option: 1 }));
    expect(seen.find((p) => p.kind === "chooseTarget")!.options).toEqual([villainOf(staged.state)]);
    expect(seen.find((p) => p.kind === "chooseTarget")!.options).not.toContain(minion);
  });
  it("without any copy on an enemy only option 1 exists: the choice of option is not put to the player", () => {
    const { seen } = playStaged(inHand(heroGame(), ARCTIC));
    expect(seen.some((p) => p.kind === "chooseOption")).toBe(false);
  });
  it("option 1 on a minion: 4 damage defeats Sandman (4 hit points) before the copy is attached, and the copy stays set aside", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const staged = inHand(s, ARCTIC);
    const { state } = playStaged(staged, picker({ pick: [minion] }));
    expect(inPlay(state, minion)).toBe(false);
    expect(supply(state)).toBe(6);
  });
  it("option 1 puts the copy on the enemy it attacked and on no other: Rhino chosen beside a Sandman", () => {
    const { state: s, id: minion } = withMinion(heroGame());
    const { state } = playStaged(inHand(s, ARCTIC), picker({ pick: [villainOf(s)] }));
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(frostbiteOn(state, minion)).toBe(0);
    expect(damageOf(state, minion)).toBe(0);
    expect(supply(state)).toBe(5);
  });
  it("no copy set aside: option 1 still deals its 4 damage and attaches nothing", () => {
    const frozen = freeze(heroGame(), 6);
    expect(supply(frozen)).toBe(0);
    const { state, events } = playStaged(inHand(frozen, ARCTIC), picker({ option: 0 }));
    expect(damageTo(events, villainOf(state))).toEqual([4]);
    expect(frostbiteOn(state, villainOf(state))).toBe(6);
    expect(supply(state)).toBe(0);
  });
  it("is refused in alter-ego form, with too little to pay, and after his turn has ended", () => {
    const s = heroGame();
    const staged = inHand(s, ARCTIC);
    expect(accepted(staged.state, playCommand(staged))).toBe(true);
    const alterEgo = withForm(staged.state, "alterEgo");
    expect(accepted(alterEgo, playCommand(staged))).toBe(false);
    expect(accepted(staged.state, play(P1, staged.id, []))).toBe(false);
    const ended = run(staged.state, picker(), endTurn()).state;
    expect(accepted(ended, playCommand(staged))).toBe(false);
  });
  it("2 players: the minion engaged with player 2 is a legal target and the copy comes from player 1's set-aside area", () => {
    const { state: s, id: minion } = withMinion(heroGame(TWO), P2, "01101");
    const staged = inHand(s, ARCTIC);
    const { state, seen } = playStaged(staged, picker({ pick: [minion], option: 0 }));
    expect(seen.find((p) => p.kind === "chooseTarget")!.options).toContain(minion);
    // Mercenary (3 hit points) is defeated by 4: the copy was never attached and is still player 1's.
    expect(inPlay(state, minion)).toBe(false);
    expect(supply(state, P1)).toBe(6);
    expect(supply(state, P2)).toBe(0);
  });
  it("2 players: option 2 reads 'Frostbite attached', not engagement: a copy on player 2's minion makes it the only target", () => {
    const { state: s, id: minion } = withMinion(heroGame(TWO), P2);
    const staged = inHand(freeze(s, 1, minion), ARCTIC);
    const { seen, state } = playStaged(staged, picker({ option: 1 }));
    expect(seen.find((p) => p.kind === "chooseTarget")!.options).toEqual([minion]);
    expect(inPlay(state, minion)).toBe(false);
  });
  it("played from a Core hero's seat (Spider-Man): no Frostbite is set aside for him, so option 1 is 4 damage and no copy", () => {
    const s = heroGame([SM(ARCTIC, ARCTIC)]);
    expect(supply(s)).toBe(0);
    const staged = inHand(s, ARCTIC);
    const { state, events } = playStaged(staged);
    expect(damageTo(events, villainOf(state))).toEqual([4]);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
  });
});

describe("Ice Blast (46010)", () => {
  it("alone with Rhino: costs 3, one copy on the villain (5 left) and 3 damage to it; the event is discarded", () => {
    const staged = inHand(heroGame(), BLAST);
    expect(staged.pay.reduce((n, id) => n + iconsOf(staged.state, id), 0)).toBeGreaterThanOrEqual(3);
    const { state, events, seen } = playStaged(staged);
    expect(seen.map((p) => p.kind)).toEqual(["choosePlayer", "chooseTarget"]);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
    expect(damageTo(events, villainOf(state))).toEqual([3]);
    expect(damageOf(state, villainOf(state))).toBe(3);
    expect(discardCodes(state)).toContain(BLAST);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("the villain and each minion engaged with the chosen player: 3 copies (3 left), 3 damage to each, one copy each", () => {
    const { state: s, ids } = withMinions(heroGame(), P1, "01102", "01102");
    const [a, b] = ids as [InstanceId, InstanceId];
    const { state, events, seen } = playStaged(inHand(s, BLAST));
    expect(seen.map((p) => p.kind)).toEqual(["choosePlayer", "chooseTarget", "chooseTarget", "chooseTarget"]);
    for (const enemy of [villainOf(s), a, b]) {
      expect(frostbiteOn(state, enemy)).toBe(1);
      expect(damageTo(events, enemy)).toEqual([3]);
      expect(damageOf(state, enemy)).toBe(3);
    }
    expect(supply(state)).toBe(3);
  });
  it("a minion that the 3 damage defeats (Hydra Mercenary, 3 hit points) leaves play; the others are unaffected by that", () => {
    const { state: s, ids } = withMinions(heroGame(), P1, "01101", "01102");
    const [merc, sandman] = ids as [InstanceId, InstanceId];
    const { state } = playStaged(inHand(s, BLAST));
    expect(inPlay(state, merc)).toBe(false);
    expect(inPlay(state, sandman)).toBe(true);
    expect(damageOf(state, sandman)).toBe(3);
    expect(frostbiteOn(state, sandman)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
  });
  it("is not an attack: a guard minion does not stop it and Rhino is still given a copy and takes 3", () => {
    const { state: s, id: guard } = withMinion(heroGame(), P1, "01101");
    const { state, events } = playStaged(inHand(s, BLAST));
    expect(damageTo(events, villainOf(state))).toEqual([3]);
    expect(inPlay(state, guard)).toBe(false);
  });
  it("does not raise the 'freeze' moment and offers no Freeze!", () => {
    const { events, seen } = playStaged(inHand(heroGame(), BLAST));
    expect(events.some((e) => e.type === "momentRaised")).toBe(false);
    expect(seen.some((p) => p.kind === "chooseTriggers")).toBe(false);
  });
  it("2 players, player 1 chosen: the villain and player 1's minion are frozen; player 2's minion is untouched", () => {
    const { state: s1, id: mine } = withMinion(heroGame(TWO), P1);
    const { state: s, id: theirs } = withMinion(s1, P2, "01101");
    const { state, events, seen } = playStaged(inHand(s, BLAST), picker({ pick: ["p1"] }));
    expect(seen[0]).toMatchObject({ kind: "choosePlayer", options: ["p1", "p2"] });
    expect(seen.slice(1).every((p) => !p.options.includes(theirs))).toBe(true);
    expect(frostbiteOn(state, mine)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(frostbiteOn(state, theirs)).toBe(0);
    expect(damageTo(events, theirs)).toEqual([]);
    expect(damageOf(state, theirs)).toBe(0);
    expect(supply(state, P1)).toBe(4);
  });
  it("2 players, player 2 chosen: player 2's minion is frozen and damaged, player 1's is not; the villain is in both cases", () => {
    const { state: s1, id: mine } = withMinion(heroGame(TWO), P1);
    const { state: s, id: theirs } = withMinion(s1, P2);
    const { state, events } = playStaged(inHand(s, BLAST), picker({ pick: ["p2"] }));
    expect(frostbiteOn(state, theirs)).toBe(1);
    expect(damageTo(events, theirs)).toEqual([3]);
    expect(frostbiteOn(state, mine)).toBe(0);
    expect(damageOf(state, mine)).toBe(0);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(damageOf(state, villainOf(state))).toBe(3);
    expect(supply(state, P1)).toBe(4);
    expect(supply(state, P2)).toBe(0);
  });
  it("the 3 damage reaches every enemy with a copy, engaged with the chosen player or not: a minion frozen earlier takes it", () => {
    const { state: s1, id: theirs } = withMinion(heroGame(TWO), P2);
    const { state: s2, id: mine } = withMinion(s1, P1);
    const s = freeze(s2, 1, theirs);
    expect(supply(s)).toBe(5);
    const { state, events } = playStaged(inHand(s, BLAST), picker({ pick: ["p1"] }));
    expect(damageTo(events, theirs)).toEqual([3]);
    expect(frostbiteOn(state, theirs)).toBe(1);
    expect(frostbiteOn(state, mine)).toBe(1);
    expect(supply(state)).toBe(3);
  });
  it("an enemy that already has two copies takes 3 once, and gets its third copy", () => {
    const s = freeze(heroGame(), 2);
    const { state, events } = playStaged(inHand(s, BLAST));
    expect(frostbiteOn(state, villainOf(state))).toBe(3);
    expect(damageTo(events, villainOf(state))).toEqual([3]);
    expect(supply(state)).toBe(3);
  });
  it("fewer copies than enemies: with 2 copies set aside for the villain and two minions, the player picks the two that get one", () => {
    // Player 2's minion carries 4 copies, so 2 are left for player 1's Ice Blast naming the villain and two minions.
    const { state: s0, id: other } = withMinion(heroGame(TWO), P2);
    const { state: s1, ids } = withMinions(s0, P1, "01102", "01102");
    const [a, b] = ids as [InstanceId, InstanceId];
    const s = freeze(s1, 4, other);
    expect(supply(s)).toBe(2);
    const { state, events, seen } = playStaged(inHand(s, BLAST), picker({ pick: ["p1", a, b] }));
    expect(seen.filter((p) => p.kind === "chooseTarget").map((p) => p.options.length)).toEqual([3, 2]);
    expect(frostbiteOn(state, a)).toBe(1);
    expect(frostbiteOn(state, b)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(supply(state)).toBe(0);
    // Damage goes to the enemies with a copy, not to the named enemies: the villain took none.
    expect(damageTo(events, villainOf(state))).toEqual([]);
    expect(damageTo(events, a)).toEqual([3]);
    expect(damageTo(events, b)).toEqual([3]);
    expect(damageTo(events, other)).toEqual([3]);
  });
  it("one copy left and a villain with two minions: the player may give it to a minion and leave the villain bare", () => {
    const { state: s0, id: other } = withMinion(heroGame(TWO), P2);
    const { state: s1, id: mine } = withMinion(s0, P1);
    const s = freeze(s1, 5, other);
    expect(supply(s)).toBe(1);
    const { state } = playStaged(inHand(s, BLAST), picker({ pick: ["p1", mine] }));
    expect(frostbiteOn(state, mine)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(damageOf(state, villainOf(state))).toBe(0);
    expect(supply(state)).toBe(0);
  });
  it("no copy set aside: nothing is attached and no enemy is asked for; the 3 damage still goes to the enemy that has copies", () => {
    const s = freeze(heroGame(), 6);
    const { state, events, seen } = playStaged(inHand(s, BLAST));
    expect(seen.map((p) => p.kind)).toEqual(["choosePlayer"]);
    expect(frostbiteOn(state, villainOf(state))).toBe(6);
    expect(damageTo(events, villainOf(state))).toEqual([3]);
  });
  it("no copy set aside and no enemy with one (a Core hero's seat): no damage at all", () => {
    const s = heroGame([SM(BLAST, BLAST)]);
    expect(supply(s)).toBe(0);
    const { state, events } = playStaged(inHand(s, BLAST));
    expect(damageTo(events, villainOf(state))).toEqual([]);
    expect(damageOf(state, villainOf(state))).toBe(0);
    expect(discardCodes(state)).toContain(BLAST);
  });
  it("is refused in alter-ego form, with too little to pay, and after his turn has ended", () => {
    const staged = inHand(heroGame(), BLAST);
    expect(accepted(staged.state, playCommand(staged))).toBe(true);
    expect(accepted(withForm(staged.state, "alterEgo"), playCommand(staged))).toBe(false);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay.slice(0, 2)))).toBe(false);
    expect(accepted(run(staged.state, picker(), endTurn()).state, playCommand(staged))).toBe(false);
  });
  it("a copy attached by Ice Blast is set aside after the enemy's next activation (Rhino attacks at ATK 1, not 2)", () => {
    const { state: after } = playStaged(inHand(heroGame(), BLAST));
    const { state, events } = run(stackEncounterDeck(after, "01107", "01108"), picker(), endTurn());
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(supply(state)).toBe(6);
    // Undefended (the picker declines): Rhino's ATK 2 is 1 with the copy, plus 2 boost icons is 3 (4 without the copy).
    expect(damageTo(events, identityOf(state))).toEqual([3]);
  });
});

describe("Chill Out! (46011)", () => {
  /** The main scheme given 7 threat: the thwart's targets are it and any side scheme. */
  const withThreat = (s: GameState, threat = 7): GameState => patchInstance(s, s.mainScheme.instanceId, { threat });

  it("removes 3 threat from the scheme (7 to 4), then attaches one copy to the chosen enemy (5 left); costs 2", () => {
    const s = withThreat(heroGame());
    const staged = inHand(s, CHILL);
    expect(staged.pay.reduce((n, id) => n + iconsOf(staged.state, id), 0)).toBeGreaterThanOrEqual(2);
    const { state, seen } = playStaged(staged);
    expect(seen.map((p) => p.kind)).toEqual(["chooseTarget", "chooseTarget"]);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(supply(state)).toBe(5);
    expect(discardCodes(state)).toContain(CHILL);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("any enemy, engaged with him or not: a minion engaged with player 2 gets the copy from player 1's supply", () => {
    const { state: s0, id: minion } = withMinion(heroGame(TWO), P2);
    const staged = inHand(withThreat(s0), CHILL);
    const { state, seen } = playStaged(staged, picker({ pick: [minion] }));
    const enemyPrompt = seen[seen.length - 1]!;
    expect(enemyPrompt.options).toContain(minion);
    expect(enemyPrompt.options).toContain(villainOf(state));
    expect(frostbiteOn(state, minion)).toBe(1);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(supply(state, P1)).toBe(5);
    expect(supply(state, P2)).toBe(0);
  });
  it("a guard minion does not matter: Rhino may be chosen for the copy while Hydra Mercenary guards", () => {
    const { state: s0, id: guard } = withMinion(heroGame(), P1, "01101");
    const { state, seen } = playStaged(inHand(withThreat(s0), CHILL), picker({ pick: [villainOf(s0)] }));
    expect(seen[seen.length - 1]!.options).toEqual(expect.arrayContaining([guard, villainOf(state)]));
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
    expect(frostbiteOn(state, guard)).toBe(0);
  });
  it("the scheme is a choice: with a side scheme (Breakin' & Takin', 4 threat) in play both are offered; the chosen one loses the 3", () => {
    const base = withThreat(heroGame());
    const { state: s, id: side } = encounterCardInVillainArea(base, "01107", 4);
    const main = s.mainScheme.instanceId;
    const onSide = playStaged(inHand(s, CHILL), picker({ pick: [side] }));
    expect(onSide.seen[0]!.options.slice().sort()).toEqual([main, side].sort());
    expect(inst(onSide.state, side).threat).toBe(1);
    expect(inst(onSide.state, main).threat).toBe(7);
    const onMain = playStaged(inHand(s, CHILL), picker({ pick: [main] }));
    expect(inst(onMain.state, main).threat).toBe(4);
    expect(inst(onMain.state, side).threat).toBe(4);
  });
  it("no copy set aside: the 3 threat is removed and no enemy is asked for", () => {
    const s = withThreat(freeze(heroGame(), 6));
    const { state, seen } = playStaged(inHand(s, CHILL));
    expect(seen.map((p) => p.kind)).toEqual(["chooseTarget"]);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
    expect(frostbiteOn(state, villainOf(state))).toBe(6);
    expect(supply(state)).toBe(0);
  });
  it("a second copy on an enemy that has one stacks (2 on Rhino, 4 set aside)", () => {
    const s = withThreat(freeze(heroGame(), 1));
    const { state } = playStaged(inHand(s, CHILL));
    expect(frostbiteOn(state, villainOf(state))).toBe(2);
    expect(supply(state)).toBe(4);
  });
  it("with 2 threat on the scheme it removes only 2 and still attaches", () => {
    const s = withThreat(heroGame(), 2);
    const { state } = playStaged(inHand(s, CHILL));
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(0);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
  });
  it("is refused in alter-ego form, with too little to pay, and after his turn has ended", () => {
    const staged = inHand(withThreat(heroGame()), CHILL);
    expect(accepted(staged.state, playCommand(staged))).toBe(true);
    expect(accepted(withForm(staged.state, "alterEgo"), playCommand(staged))).toBe(false);
    expect(accepted(staged.state, play(P1, staged.id, []))).toBe(false);
    expect(accepted(run(staged.state, picker(), endTurn()).state, playCommand(staged))).toBe(false);
  });
  it("a scheme with no threat is still a legal choice: nothing is removed and the copy is still attached", () => {
    const staged = inHand(heroGame(), CHILL);
    const s = patchInstance(staged.state, staged.state.mainScheme.instanceId, { threat: 0 });
    const { state, seen } = playStaged({ ...staged, state: s });
    expect(seen.map((p) => p.kind)).toEqual(["chooseTarget", "chooseTarget"]);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(0);
    expect(frostbiteOn(state, villainOf(state))).toBe(1);
  });
  it("played from a Core hero's seat (no copy set aside): the thwart and nothing else", () => {
    const s = withThreat(heroGame([SM(CHILL, CHILL)]));
    const { state, seen } = playStaged(inHand(s, CHILL));
    expect(seen.map((p) => p.kind)).toEqual(["chooseTarget"]);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(4);
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
  });
  it("the copy is set aside after Rhino's next activation, which is weakened by it", () => {
    const { state: after } = playStaged(inHand(withThreat(heroGame()), CHILL));
    const { state, events } = run(stackEncounterDeck(after, "01107", "01108"), picker(), endTurn());
    expect(frostbiteOn(state, villainOf(state))).toBe(0);
    expect(supply(state)).toBe(6);
    // Undefended: ATK 2 less the copy's 1, plus 2 boost icons (4 without the copy).
    expect(damageTo(events, identityOf(state))).toEqual([3]);
  });
});
