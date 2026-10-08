import { cardId, ICEMAN_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  countSchemeIcons,
  createGame,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { ICEMAN_EVENTS } from "./iceman/events.js";
import { ICEMAN_IDENTITY } from "./iceman/identity.js";
import { ICEMAN_SUPPORT_UPGRADES_ALLIES } from "./iceman/support-upgrades-allies.js";
import { ICEMAN_ASPECT_BASIC, ICEMAN_ASPECT_BASIC_DRAFTS, ICEMAN_ASPECT_BASIC_SKIPPED } from "./aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Iceman pack aspect and basic cards (46012 to 46023), docs/phase7-wave8.md section 7.2, 3.67, 3.68, 3.70. Real
 * commands in a real game: Iceman's starter deck (`iceman-aggression`) against Rhino, with the cards under test added to
 * the deck by code (`requireLegalDecks: false`). A frostbitten enemy is made by Iceman's real "Freeze!" attack.
 * Shark-Girl and Keep Up the Pressure are skipped in the module; their sections prove where each fails.
 */
const GLOB = "46013";
const FIRE = "46014";
const MOVE = "46015";
const THAT = "46016";
const SHADOWCAT = "46019";
const BEAK = "46020";
const STAGED = new Set([GLOB, FIRE, MOVE, THAT, SHADOWCAT, BEAK, "46009", "46010", "46011"]);
const FREEZE = "46001a.freeze";
const FROSTBITE_CODE = "46002";
const REFS = [
  "46013.glob-response",
  "46014.suppressing-fire-interrupt",
  "46015.surprise-move-interrupt",
  "46016.take-that-action",
  "46017.looking-for-trouble-action",
  "46019.shadowcat-response",
  "46020.beak-response",
  "46021.team-building-exercise-action",
  "46022.recuperation-action",
  "46023.the-power-in-all-of-us-constant",
];

// Frostbite's Forced Response ships as its activation half (section 3.61 gap: leaves play), enough for these tests.
const DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    ICEMAN_IDENTITY,
    ICEMAN_SUPPORT_UPGRADES_ALLIES,
    ICEMAN_EVENTS,
    ICEMAN_ASPECT_BASIC,
  ),
};
const POOL: readonly AnyCard[] = [...WAVE8_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const ICEMAN = WAVE8_STARTER_DECKS.find((d) => d.id === "iceman-aggression")!;
const ICEMAN_DECK = ICEMAN.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = { readonly kind: "iceman" | "core"; readonly extra: readonly string[] };
const ICE = (...extra: string[]): Seat => ({ kind: "iceman", extra });
const SM = (...extra: string[]): Seat => ({ kind: "core", extra });

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const inPlay = (s: GameState, id: InstanceId): boolean =>
  s.players.some((p) => p.playArea.includes(id)) || s.activeVillainId === id;
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};
const damageTo = (events: readonly GameEvent[], target: InstanceId): number[] =>
  events.flatMap((e) => (e.type === "damageDealt" && e.targetInstanceId === target ? [e.amount] : []));
const frostbiteOn = (s: GameState, host: InstanceId): number =>
  instancesOf(s, FROSTBITE_CODE).filter((id) => inst(s, id).attachedTo === host).length;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

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
const heroGame = (seats: readonly Seat[] = [ICE()]): GameState =>
  seats.reduce<GameState>((s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2), setupGame(seats));

/** A minion relabeled from the next spare encounter card, engaged with `to` and faceup. */
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
/** Hit points left on a minion: its printed hit points less damage. */
const ready = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: false });

/**
 * Answers by prompt. `accept`: the first chooseTriggers option whose id contains one of these (in order), else none;
 * `pick`: the first of these ids among targets and cards; `option`: chooseOption index; `pay`: payForCard takes the first
 * `pay` offered cards.
 */
const picker =
  (
    opts: {
      accept?: readonly string[];
      pick?: readonly string[];
      option?: number;
      pay?: number;
      defend?: boolean;
    } = {},
  ): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers") {
      for (const ref of opts.accept ?? []) {
        const hit = ids.find((id) => id.includes(ref));
        if (hit) return [hit];
      }
      return [];
    }
    if (choice.prompt.kind === "payForCard") return ids.slice(0, opts.pay ?? 0);
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseOption") return [ids[opts.option ?? 0]!];
    const wanted = (opts.pick ?? []).filter((w) => ids.includes(w));
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections) : firstLegal(s);
  };
/** Drives the commands, answering with `pick`; `seen` holds every prompt the picker was shown. */
function run(s: GameState, pick: Picker, ...commands: readonly Command[]) {
  const seen: { kind: string; options: string[] }[] = [];
  const spying: Picker = (st) => {
    const c = st.pendingChoice!;
    seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId as string) });
    return pick(st);
  };
  return { ...driveEventsPicking(DEPS, s, spying, ...commands), seen };
}
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const attack = (s: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: target,
});

/** `times` real "Freeze!" attacks on `target` (the villain by default); Iceman is readied and the damage cleared after each. */
function freeze(s: GameState, times: number, target?: InstanceId): GameState {
  let current = s;
  for (let i = 0; i < times; i++) {
    const to = target ?? villainOf(current);
    const { state } = run(current, picker({ accept: [FREEZE] }), attack(current, to));
    current = patchInstance(ready(state, identityOf(state)), to, { damage: 0 });
  }
  return current;
}

/** Adds resource cards to the hand so a test can pay for a card. */
function withResources(s: GameState, n: number, p: PlayerId = P1): GameState {
  const owner = playerOf(s, p);
  const fill = owner.deck
    .filter(
      (id) =>
        iconsOf(s, id) > 0 &&
        !STAGED.has(codeOf(s, id)) &&
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
/** Resource cards in hand that pay `cost`, never a card staged by name. */
function payers(s: GameState, p: PlayerId, cost: number, not: readonly InstanceId[] = []): InstanceId[] {
  const out: InstanceId[] = [];
  let paid = 0;
  for (const h of playerOf(s, p).hand) {
    if (paid >= cost) break;
    if (not.includes(h) || STAGED.has(codeOf(s, h)) || iconsOf(s, h) === 0) continue;
    out.push(h);
    paid += iconsOf(s, h);
  }
  if (paid < cost) throw new Error(`not enough resource cards in hand to pay ${cost}`);
  return out;
}
/** A card in hand with its exact payers (and plenty of other resource cards left in hand). */
function inHand(s: GameState, code: string, p: PlayerId = P1) {
  const given = moveToHand(withResources(s, 6, p), p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  return { state: given.state, id, pay: payers(given.state, p, cost, [id]) };
}
type Staged = ReturnType<typeof inHand>;
function playStaged(staged: Staged, pick: Picker = picker(), extra: { attach?: InstanceId; p?: PlayerId } = {}) {
  const seen: { kind: string; options: string[] }[] = [];
  const spying: Picker = (s) => {
    const c = s.pendingChoice!;
    seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId as string) });
    return pick(s);
  };
  const result = driveEventsPicking(
    DEPS,
    staged.state,
    spying,
    play(extra.p ?? P1, staged.id, staged.pay, extra.attach ? { attachToInstanceId: extra.attach } : {}),
  );
  return { ...result, seen };
}
const playCommand = (staged: Staged): Command => play(P1, staged.id, staged.pay);
const offered = (seen: readonly { kind: string; options: string[] }[], ref: string): boolean =>
  seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref)));

describe("registry", () => {
  it("holds exactly the ten registered refs; the two skipped ones are not registered", () => {
    expect(Object.keys(ICEMAN_ASPECT_BASIC).sort()).toEqual([...REFS].sort());
  });
  it("every ability ref of 46012 to 46023 is registered or skipped with a reason, and nothing else", () => {
    const refs = ICEMAN_CARDS.filter((c) => (c.id as string) >= "46012" && (c.id as string) <= "46023").flatMap(
      abilityRefIds,
    );
    expect(refs.sort()).toEqual([...REFS, ...Object.keys(ICEMAN_ASPECT_BASIC_SKIPPED)].sort());
    for (const reason of Object.values(ICEMAN_ASPECT_BASIC_SKIPPED)) expect(reason.length).toBeGreaterThan(20);
  });
  it("the drafts are exactly the skipped refs and are not registered", () => {
    expect(Object.keys(ICEMAN_ASPECT_BASIC_DRAFTS).sort()).toEqual(Object.keys(ICEMAN_ASPECT_BASIC_SKIPPED).sort());
    for (const ref of Object.keys(ICEMAN_ASPECT_BASIC_DRAFTS)) expect(ref in ICEMAN_ASPECT_BASIC).toBe(false);
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(ICEMAN_ASPECT_BASIC[id]!)).toEqual([]);
  });
  it("Keep Up the Pressure's draft (the search half) validates", () => {
    expect(validateDefinition(ICEMAN_ASPECT_BASIC_DRAFTS["46018.when-defeated"]!)).toEqual([]);
  });
  it("the four reprints are the earlier cards' own scripts", () => {
    const pairs: readonly [string, string][] = [
      ["46017.looking-for-trouble-action", "16043.looking-for-trouble-action"],
      ["46021.team-building-exercise-action", "12024.team-building-exercise-action"],
      ["46022.recuperation-action", "15031.recuperation-action"],
      ["46023.the-power-in-all-of-us-constant", "13024.the-power-in-all-of-us-constant"],
    ];
    for (const [mine, theirs] of pairs) expect(ICEMAN_ASPECT_BASIC[mine]).toBe(WAVE7_ABILITIES[theirs]);
  });
});

describe("Glob (46013): Response after he enters play, 2 damage to an enemy with an upgrade attached", () => {
  it("no upgrade on any enemy: no damage and he is in play", () => {
    const s = heroGame();
    const { state, events } = playStaged(inHand(s, GLOB), picker({ accept: ["glob-response"] }));
    expect(instancesOf(state, GLOB).some((id) => inPlay(state, id))).toBe(true);
    expect(events.filter((e) => e.type === "damageDealt")).toEqual([]);
  });
  it("Frostbite on the villain: 2 damage to Rhino", () => {
    const s = freeze(heroGame(), 1);
    const { state, events, seen } = playStaged(inHand(s, GLOB), picker({ accept: ["glob-response"] }));
    expect(offered(seen, "glob-response")).toBe(true);
    expect(damageTo(events, villainOf(state))).toEqual([2]);
  });
  it("Frostbite on a minion only: the minion is the single target; Rhino takes nothing", () => {
    const { state: s0, id: minion } = withMinion(heroGame(), P1, "01102");
    const s = freeze(s0, 1, minion);
    const { state, seen } = playStaged(inHand(s, GLOB), picker({ accept: ["glob-response"] }));
    const targetPrompt = seen.find((p) => p.kind === "chooseTarget");
    if (targetPrompt) expect(targetPrompt.options).toEqual([minion]);
    expect(damageOf(state, minion)).toBe(2);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("2 players: Frostbite on a minion engaged with player 2 is a legal target", () => {
    const { state: s0, id: minion } = withMinion(heroGame([ICE(), SM()]), P2, "01102");
    const s = freeze(s0, 1, minion);
    const { state } = playStaged(inHand(s, GLOB), picker({ accept: ["glob-response"] }));
    expect(damageOf(state, minion)).toBe(2);
  });
});

describe("Suppressing Fire (46014): Hero Interrupt, heal 2 from your hero when you attack and defeat the attached minion", () => {
  /** Suppressing Fire on a Hydra Mercenary (3 hit points) engaged with Iceman, who has taken `hurt` damage. */
  function fireOnMinion(hurt = 3) {
    const { state: s0, id: minion } = withMinion(heroGame(), P1, "01101");
    const { state } = playStaged(inHand(s0, FIRE), picker(), { attach: minion });
    const id = instancesOf(state, FIRE).find((i) => inst(state, i).attachedTo === minion)!;
    return { state: withDamage(state, identityOf(state), hurt), minion, id };
  }
  it("cost 0, attached to the minion", () => {
    const { state, minion, id } = fireOnMinion(0);
    expect(inst(state, id).attachedTo).toBe(minion);
  });
  it("the hero's basic attack defeats the minion (3 hit points, ATK 2 plus 1 damage): healed 2 from 3", () => {
    const { state: s, minion } = fireOnMinion(3);
    const hurt = patchInstance(s, minion, { damage: 1 });
    const { state, seen } = run(hurt, picker({ accept: ["suppressing-fire"] }), attack(hurt, minion));
    expect(offered(seen, "suppressing-fire")).toBe(true);
    expect(inPlay(state, minion)).toBe(false);
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
  it("heals nothing beyond the damage taken: 1 damage becomes 0", () => {
    const { state: s, minion } = fireOnMinion(1);
    const hurt = patchInstance(s, minion, { damage: 1 });
    const { state } = run(hurt, picker({ accept: ["suppressing-fire"] }), attack(hurt, minion));
    expect(damageOf(state, identityOf(state))).toBe(0);
  });
  it("an attack that does not defeat it (minion at full hit points) offers nothing and heals nothing", () => {
    const { state: s, minion } = fireOnMinion(3);
    const { state, seen } = run(s, picker({ accept: ["suppressing-fire"] }), attack(s, minion));
    expect(offered(seen, "suppressing-fire")).toBe(false);
    expect(inPlay(state, minion)).toBe(true);
    expect(damageOf(state, identityOf(state))).toBe(3);
  });
  it("another minion's defeat does not heal: only the attached minion counts", () => {
    const { state: s, minion } = fireOnMinion(3);
    const other = withMinion(s, P1, "01101");
    const hurt = patchInstance(other.state, other.id, { damage: 1 });
    const { state } = run(hurt, picker({ accept: ["suppressing-fire"] }), attack(hurt, other.id));
    expect(inPlay(state, other.id)).toBe(false);
    expect(inPlay(state, minion)).toBe(true);
    expect(damageOf(state, identityOf(state))).toBe(3);
  });
  it("max 1 per minion: a second copy is refused on the same minion", () => {
    const { state: s, minion } = fireOnMinion(0);
    const second = inHand(s, FIRE);
    expect(accepted(second.state, play(P1, second.id, second.pay, { attachToInstanceId: minion }))).toBe(false);
  });
  it("can only attach to a minion: the villain is refused", () => {
    const staged = inHand(heroGame(), FIRE);
    expect(
      accepted(staged.state, play(P1, staged.id, staged.pay, { attachToInstanceId: villainOf(staged.state) })),
    ).toBe(false);
  });
});

describe("Surprise Move (46015): Hero Interrupt, +2 ATK on a basic attack against an enemy with an upgrade; ready on a defeat", () => {
  it("not offered against an enemy with nothing attached", () => {
    const s = moveToHand(heroGame(), P1, MOVE).state;
    const { seen } = run(s, picker({ accept: ["surprise-move"], pay: 1 }), attack(s, villainOf(s)));
    expect(offered(seen, "surprise-move")).toBe(false);
  });
  it("Frostbite on Rhino: ATK 2 + 2 = 4 damage, and Iceman stays exhausted (no defeat)", () => {
    const frozen = freeze(heroGame(), 1);
    const s = withResources(moveToHand(frozen, P1, MOVE).state, 3);
    const { state, events, seen } = run(s, picker({ accept: ["surprise-move"], pay: 1 }), attack(s, villainOf(s)));
    expect(offered(seen, "surprise-move")).toBe(true);
    expect(damageTo(events, villainOf(state))).toEqual([4]);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("a defeat readies the hero: Frostbite on a Mercenary (3 hit points), ATK 4 defeats it and Iceman is ready", () => {
    const { state: s0, id: minion } = withMinion(heroGame(), P1, "01101");
    const frozen = freeze(s0, 1, minion);
    const s = withResources(moveToHand(frozen, P1, MOVE).state, 3);
    const { state } = run(s, picker({ accept: ["surprise-move"], pay: 1 }), attack(s, minion));
    expect(inPlay(state, minion)).toBe(false);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("no defeat: the hero stays exhausted (Rhino, 14 hit points)", () => {
    const frozen = freeze(heroGame(), 1);
    const s = withResources(moveToHand(frozen, P1, MOVE).state, 3);
    const { state } = run(s, picker({ accept: ["surprise-move"], pay: 1 }), attack(s, villainOf(s)));
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  /** Section 3.67 test 6: a Mercenary-sized minion (Sandman, 4 hit points) with nothing attached; "Freeze!" attaches a copy during the attack. */
  function freezeThenMove() {
    const { state: s0, id: minion } = withMinion(heroGame(), P1, "01102");
    const s = withResources(moveToHand(s0, P1, MOVE).state, 3);
    return { minion, ...run(s, picker({ accept: [FREEZE, "surprise-move"], pay: 1 }), attack(s, minion)) };
  }
  it.fails("section 3.67 test 6 (engine gap): after 'Freeze!' attaches a copy during the attack, Surprise Move is playable: ATK 4 defeats the 4-hit-point minion and Iceman readies", () => {
    const { state, seen, minion } = freezeThenMove();
    expect(offered(seen, "surprise-move")).toBe(true);
    expect(inPlay(state, minion)).toBe(false);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("pins today: the interrupt window offers only 'Freeze!' (Surprise Move's target condition is read when the window opens), so the minion survives on 2 damage", () => {
    const { state, seen, minion } = freezeThenMove();
    expect(seen.map((p) => p.options)).toEqual([[expect.stringContaining(FREEZE)]]);
    expect(frostbiteOn(state, minion)).toBe(1);
    expect(inPlay(state, minion)).toBe(true);
    expect(damageOf(state, minion)).toBe(2);
  });
});

describe("Take That! (46016): Hero Action (attack), 7 damage to an enemy with an upgrade attached", () => {
  it("no upgrade on any enemy: not playable", () => {
    const staged = inHand(heroGame(), THAT);
    expect(accepted(staged.state, playCommand(staged))).toBe(false);
  });
  it("Frostbite on Rhino: 7 damage to Rhino; Iceman is not exhausted", () => {
    const staged = inHand(freeze(heroGame(), 1), THAT);
    const { state, events } = playStaged(staged);
    expect(damageTo(events, villainOf(state))).toEqual([7]);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("only an enemy with an upgrade is a target: Frostbite on a minion leaves Rhino out", () => {
    const { state: s0, id: minion } = withMinion(heroGame(), P1, "01102");
    const staged = inHand(freeze(s0, 1, minion), THAT);
    const { seen, state } = playStaged(staged);
    const target = seen.find((p) => p.kind === "chooseTarget");
    if (target) expect(target.options).toEqual([minion]);
    expect(inPlay(state, minion)).toBe(false);
    expect(damageOf(state, villainOf(state))).toBe(0);
  });
  it("Q48 = A: the label makes it one attack by Iceman on the enemy, and its 7 damage is attack damage", () => {
    const { state, events } = playStaged(inHand(freeze(heroGame(), 1), THAT));
    const attacks = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "attack" ? [e.event] : [],
    );
    expect(attacks).toHaveLength(1);
    expect(attacks[0]).toMatchObject({ attackerInstanceId: identityOf(state), labeled: true });
    expect(attacks[0]!.attacked).toEqual([villainOf(state)]);
    expect(attacks[0]!.results?.damage).toBe(7);
    const dealt = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "dealDamage" ? [e.event] : [],
    );
    expect(dealt.map((d) => d.fromAttack)).toEqual([true]);
  });
});

describe("Shadowcat (46019): Response after you play her, a side scheme loses its four icons until the end of the round", () => {
  /** Breakin' & Takin' (hazard) in the villain area. */
  function withBreakin(s: GameState): { readonly state: GameState; readonly id: InstanceId } {
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const id = pile.deck.find((i) => codeOf(s, i) === "01107")!;
    return {
      id,
      state: {
        ...s,
        encounterDecks: {
          ...s.encounterDecks,
          [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
        },
        villainArea: [...s.villainArea, id],
        instances: { ...s.instances, [id]: { ...s.instances[id]!, threat: 2, faceup: true } },
      },
    };
  }
  const hazard = (s: GameState): number => countSchemeIcons(s, DEPS, "hazard");
  it("the chosen side scheme's hazard icon is gone", () => {
    const { state: s, id } = withBreakin(heroGame());
    const before = hazard(s);
    expect(before).toBeGreaterThanOrEqual(1);
    const { state } = playStaged(inHand(s, SHADOWCAT), picker({ accept: ["shadowcat-response"], pick: [id] }));
    expect(hazard(state)).toBe(before - 1);
  });
  it("the loss is recorded as a lasting rule (the clock is the round)", () => {
    const { state: s, id } = withBreakin(heroGame());
    const { state } = playStaged(inHand(s, SHADOWCAT), picker({ accept: ["shadowcat-response"], pick: [id] }));
    expect(state.lastingEffects.some((e) => e.kind === "ruleGrant")).toBe(true);
  });
  it("with no side scheme in play she enters and nothing else happens", () => {
    const { state } = playStaged(inHand(heroGame(), SHADOWCAT), picker({ accept: ["shadowcat-response"] }));
    expect(instancesOf(state, SHADOWCAT).some((id) => inPlay(state, id))).toBe(true);
    expect(state.lastingEffects.some((e) => e.kind === "ruleGrant")).toBe(false);
  });
  it("Spider-Man cannot play her (X-Men identity only)", () => {
    const staged = inHand(heroGame([SM(SHADOWCAT)]), SHADOWCAT);
    expect(accepted(staged.state, playCommand(staged))).toBe(false);
  });
});

describe("Beak (46020): Response after you play him, remove 1 threat from a scheme per X-Men ally you control", () => {
  it("alone (he is the one X-Men ally): 1 threat from the main scheme", () => {
    const s = patchInstance(heroGame(), heroGame().mainScheme.instanceId, { threat: 5 });
    const before = mainThreat(s);
    const { state } = playStaged(
      inHand(s, BEAK),
      picker({ accept: ["beak-response"], pick: [s.mainScheme.instanceId] }),
    );
    expect(mainThreat(state)).toBe(before - 1);
  });
  it("beside Glob: 2 threat", () => {
    const s = patchInstance(heroGame(), heroGame().mainScheme.instanceId, { threat: 5 });
    const withGlob = playStaged(inHand(s, GLOB), picker()).state;
    const before = mainThreat(withGlob);
    const { state } = playStaged(
      inHand(withGlob, BEAK),
      picker({ accept: ["beak-response"], pick: [withGlob.mainScheme.instanceId] }),
    );
    expect(mainThreat(state)).toBe(before - 2);
  });
});

describe("Shark-Girl (46012), skipped: where the draft fails", () => {
  const SHARK = "46012";
  /** Shark-Girl attacks a Sandman with two Frostbite attached; returns the damage she deals. */
  function sharkDamage(): number | undefined {
    const { state: s0, id: minion } = withMinion(heroGame([ICE(SHARK)]), P1, "01102");
    const frozen = freeze(s0, 2, minion);
    const given = moveToHand(withResources(frozen, 6), P1, SHARK);
    const id = given.ids[0]!;
    const played = driveEventsPicking(
      DEPS,
      given.state,
      picker(),
      play(P1, id, payers(given.state, P1, 2, [id])),
    ).state;
    const attacker = patchInstance(played, id, { exhausted: false });
    const result = driveEventsPicking(DEPS, attacker, picker(), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: id,
      targetInstanceId: minion,
    });
    return damageTo(result.events, minion)[0];
  }
  it.fails("draft: the constant validates (it does not: the attack's target slot is read before it is bound)", () => {
    expect(validateDefinition(ICEMAN_ASPECT_BASIC_DRAFTS["46012.shark-girl-constant"]!)).toEqual([]);
  });
  it("the validator's reason is the unbound slot", () => {
    expect(validateDefinition(ICEMAN_ASPECT_BASIC_DRAFTS["46012.shark-girl-constant"]!).join(" ")).toContain(
      "attack.target",
    );
  });
  it.fails("with two upgrades attached she should deal 2 + 2 = 4 damage", () => {
    expect(sharkDamage()).toBe(4);
  });
  it("pins today: unscripted she deals her printed 2", () => {
    expect(sharkDamage()).toBe(2);
  });
});

describe("Keep Up the Pressure (46018), skipped: where the draft fails", () => {
  it("the draft holds the search half only: it has no +1 damage effect", () => {
    const draft = JSON.stringify(ICEMAN_ASPECT_BASIC_DRAFTS["46018.when-defeated"]);
    expect(draft).not.toContain("cardEffectBonus");
    expect(draft).not.toContain("modifyCardEffect");
  });
  it.fails("documented gap: the draft should also give every Attack event +1 damage this phase (no primitive exists)", () => {
    expect(JSON.stringify(ICEMAN_ASPECT_BASIC_DRAFTS["46018.when-defeated"])).toContain("modifyCardEffect");
  });
});
