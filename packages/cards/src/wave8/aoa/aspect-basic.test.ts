import { AOA_CARDS, AOA_STARTER_DECKS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  maxHitPoints,
  shownDeckTop,
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
import { host, heal, mergeRegistries, on, query, response } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { BISHOP_IDENTITY } from "./bishop/identity.js";
import { MAGIK_IDENTITY } from "./magik/identity.js";
import { AOA_ASPECT_BASIC, AOA_ASPECT_BASIC_DRAFTS, AOA_ASPECT_BASIC_SKIPPED } from "./aspect-basic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Age of Apocalypse aspect and basic cards (45011 to 45024, 45041 to 45052), docs/phase7-wave8.md section 7.1, 3.52 to
 * 3.60. Real commands in a real game: Bishop's (Leadership, `bishop-leadership`) or Magik's (Aggression,
 * `magik-aggression`) precon against Rhino (Core, standard, no modular set), with the cards under test added to the
 * deck by code (`requireLegalDecks: false`). Advanced Suit is the one card still skipped in the module; its section
 * proves where the draft fails.
 */
const CABLE = "45011";
const X23 = "45012";
const SUIT = "45014";
const SIDEKICK = "45015";
const LEGION = "45020";
const MARROW = "45021";
const GOLDBALLS = "45041";
const TEMPUS = "45042";
const BLOOD_RAGE = "45043";
const TEST_DEFENSE = "45044";
const CHARGE = "45045";
const TRIAGE = "45048";
const CUCKOOS = "45049";
const BLOODGEM = "45050";
const SPELL = "45051";
const SIDE_BY_SIDE = "45016";
const SUIT_UP = "45017";
const HAYMAKER = "01087";
const BREAKIN = "01107";
const TOUGH = "01105";
const ADVANCE = "01186";
const STAGED = new Set([
  CABLE,
  X23,
  SUIT,
  SIDEKICK,
  LEGION,
  MARROW,
  GOLDBALLS,
  TEMPUS,
  BLOOD_RAGE,
  TEST_DEFENSE,
  CHARGE,
  TRIAGE,
  CUCKOOS,
  BLOODGEM,
  SPELL,
  SIDE_BY_SIDE,
  SUIT_UP,
  HAYMAKER,
  "45004",
]);
const REFS = [
  "45011.cable-response",
  "45012.x-23-response",
  "45013.team-training-constant",
  "45015.sidekick-constant",
  "45015.sidekick-response",
  "45016.side-by-side-action",
  "45017.suit-up-action",
  "45018.lead-from-the-front-action",
  "45019.the-power-of-leadership-constant",
  "45020.legion-response",
  "45021.marrow-constant",
  "45021.marrow-response",
  "45041.goldballs-interrupt",
  "45042.tempus-interrupt",
  "45043.blood-rage-response",
  "45044.test-the-defense-response",
  "45045.full-body-charge-action",
  "45046.clobber-action",
  "45047.the-power-of-aggression-constant",
  "45048.triage-response",
  "45049.stepford-cuckoos-interrupt",
  "45050.bloodgem-resource",
  "45051.basic-spell-action",
  "45052.spiritual-meditation-action",
];

const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_IDENTITY, MAGIK_IDENTITY, AOA_ASPECT_BASIC),
};
const DRAFT_DEPS: EngineDeps = {
  abilities: mergeRegistries(
    WAVE7_ABILITIES,
    BISHOP_IDENTITY,
    MAGIK_IDENTITY,
    AOA_ASPECT_BASIC,
    AOA_ASPECT_BASIC_DRAFTS,
  ),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...AOA_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));

const deckOf = (id: string) => {
  const d = AOA_STARTER_DECKS.find((x) => x.id === id)!;
  return { d, deck: d.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)) };
};
const BISHOP_DECK = deckOf("bishop-leadership");
const MAGIK_DECK = deckOf("magik-aggression");
type Seat = { readonly kind: "bishop" | "magik" | "core"; readonly extra: readonly string[] };
const BISHOP = (...extra: string[]): Seat => ({ kind: "bishop", extra });
const MAGIK = (...extra: string[]): Seat => ({ kind: "magik", extra });
const SM = (...extra: string[]): Seat => ({ kind: "core", extra });

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const inPlay = (s: GameState, id: InstanceId): boolean =>
  s.players.some((p) => p.playArea.includes(id)) || s.activeVillainId === id;
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as { resourceIcons?: Record<string, number> };
  return Object.values(card.resourceIcons ?? {}).reduce((a, b) => a + b, 0);
};
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const attachedTo = (s: GameState, code: string, host: InstanceId): InstanceId | undefined =>
  instancesOf(s, code).find((i) => inst(s, i).attachedTo === host);
/** A card of this code in play, as a card in a play area or one attached to another. */
const played = (s: GameState, code: string): InstanceId =>
  instancesOf(s, code).find((i) => inPlay(s, i) || inst(s, i).attachedTo)!;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

function setupGame(seats: readonly Seat[], seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = seats.map((seat) => {
    const base =
      seat.kind === "bishop"
        ? { identityCardId: BISHOP_DECK.d.identityCardId, aspects: BISHOP_DECK.d.aspects, deck: BISHOP_DECK.deck }
        : seat.kind === "magik"
          ? { identityCardId: MAGIK_DECK.d.identityCardId, aspects: MAGIK_DECK.d.aspects, deck: MAGIK_DECK.deck }
          : coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed, modularSetIds: [] })
              .players[0]!;
    return {
      ...base,
      deck: [...base.deck, ...[...STAGED, "01070", "45002", ...seat.extra].map((code) => cardId(code))],
    };
  });
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (seats: readonly Seat[]): GameState =>
  seats.reduce<GameState>(
    (s, _seat, i) => withForm(s, { heroForm: 0 }, i === 0 ? P1 : ("p2" as PlayerId)),
    setupGame(seats),
  );
const alterEgoGame = (seats: readonly Seat[]): GameState => setupGame(seats);

/** A minion relabeled from the next spare encounter card, engaged with the first player and faceup. */
function withMinion(s: GameState, code = "01102"): { readonly state: GameState; readonly id: InstanceId } {
  const minion = s.cardPool[cardId(code)];
  if (minion?.type !== "minion") throw new Error(`no minion ${code} in the pool`);
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  const relabeled: GameState = {
    ...patchInstance(s, spare, { cardId: minion.id, faceup: true, engagedWith: P1, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    players: s.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, spare] } : p)),
  };
  return { state: relabeled, id: spare };
}
/** A side scheme (Breakin' & Takin') in the villain's area with `threat` on it. */
function withSideScheme(s: GameState, threat: number): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(s);
  const pile = s.encounterDecks[deckId]!;
  const spare = pile.deck[0]!;
  const state: GameState = {
    ...patchInstance(s, spare, { cardId: cardId(BREAKIN), faceup: true, threat, engagedWith: null, damage: 0 }),
    encounterDecks: {
      ...s.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
    },
    villainArea: [...s.villainArea, spare],
  };
  return { state, id: spare };
}
const hitPointsOf = (code: string): number => (BY_ID.get(code) as { hp: number }).hp;

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
function inHand(s: GameState, code: string, p: PlayerId = P1) {
  const given = moveToHand(withResources(s, 8, p), p, code);
  const id = given.ids[0]!;
  const cost = (BY_ID.get(code) as { cost: number }).cost;
  return { state: given.state, id, pay: payers(given.state, p, cost, [id]) };
}
type Staged = ReturnType<typeof inHand>;

type Seen = { kind: string; options: string[] };
const picker =
  (
    opts: {
      accept?: readonly string[];
      pick?: readonly InstanceId[];
      pickKinds?: readonly string[];
      option?: number;
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
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseOption") return [ids[opts.option ?? 0]!];
    const wanted = (opts.pick ?? []).filter((w) => ids.includes(w));
    return wanted.length > 0 ? wanted.slice(0, choice.maxSelections) : firstLegal(s);
  };
function run(s: GameState, pick: Picker, deps: EngineDeps, ...commands: readonly Command[]) {
  const seen: Seen[] = [];
  const spying: Picker = (st) => {
    const c = st.pendingChoice!;
    seen.push({ kind: c.prompt.kind, options: c.options.map((o) => o.optionId as string) });
    return pick(st);
  };
  return { ...driveEventsPicking(deps, s, spying, ...commands), seen };
}
const go = (s: GameState, pick: Picker, ...commands: readonly Command[]) => run(s, pick, DEPS, ...commands);
const accepted = (s: GameState, c: Command, deps: EngineDeps = DEPS): boolean => applyCommand(s, c, deps).ok;
const offered = (seen: readonly Seen[], ref: string): boolean =>
  seen.some((p) => p.kind === "chooseTriggers" && p.options.some((o) => o.includes(ref)));
function playStaged(staged: Staged, pick: Picker = picker(), extra: { attach?: InstanceId } = {}, deps = DEPS) {
  return run(
    staged.state,
    pick,
    deps,
    play(P1, staged.id, staged.pay, extra.attach ? { attachToInstanceId: extra.attach } : {}),
  );
}
const attackCmd = (s: GameState, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const thwartCmd = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
/** An ally played for real, then readied (it has just entered play, so it is not exhausted, but be sure). */
function withAlly(s: GameState, code: string, damage = 0): { state: GameState; id: InstanceId } {
  const { state } = playStaged(inHand(s, code), picker());
  const id = instancesOf(state, code).find((i) => inPlay(state, i))!;
  return { state: patchInstance(state, id, { exhausted: false, damage }), id };
}
const relabel = (s: GameState, id: InstanceId, code: string): GameState =>
  patchInstance(s, id, { cardId: cardId(code) });

describe("registry", () => {
  it("holds the registered refs; the skipped ones are not registered", () => {
    expect(Object.keys(AOA_ASPECT_BASIC).sort()).toEqual([...REFS].sort());
  });
  it("every ability ref of the group is registered or skipped with a reason, and nothing else", () => {
    const ids = new Set([
      ...Array.from({ length: 14 }, (_, i) => String(45011 + i)),
      ...Array.from({ length: 12 }, (_, i) => String(45041 + i)),
    ]);
    const refs = AOA_CARDS.filter((c) => ids.has(c.id as string)).flatMap(abilityRefIds);
    expect(refs.sort()).toEqual([...REFS, ...Object.keys(AOA_ASPECT_BASIC_SKIPPED)].sort());
    for (const reason of Object.values(AOA_ASPECT_BASIC_SKIPPED)) expect(reason.length).toBeGreaterThan(20);
  });
  it("the drafts are exactly the skipped refs and are not registered", () => {
    expect(Object.keys(AOA_ASPECT_BASIC_DRAFTS).sort()).toEqual(Object.keys(AOA_ASPECT_BASIC_SKIPPED).sort());
    for (const ref of Object.keys(AOA_ASPECT_BASIC_DRAFTS)) expect(ref in AOA_ASPECT_BASIC).toBe(false);
  });
  it.each(REFS)("%s validates", (id) => {
    expect(validateDefinition(AOA_ASPECT_BASIC[id]!)).toEqual([]);
  });
  it("the six reprints are the earlier cards' own scripts", () => {
    const pairs: readonly [string, string][] = [
      ["45013.team-training-constant", "04016.team-training-constant"],
      ["45018.lead-from-the-front-action", "01070.lead-from-the-front-action"],
      ["45019.the-power-of-leadership-constant", "01072.the-power-of-leadership-constant"],
      ["45046.clobber-action", "18012.clobber-action"],
      ["45047.the-power-of-aggression-constant", "01055.the-power-of-aggression-constant"],
      ["45052.spiritual-meditation-action", "15019.spiritual-meditation-action"],
    ];
    for (const [mine, theirs] of pairs) expect(AOA_ASPECT_BASIC[mine]).toBe(WAVE7_ABILITIES[theirs]);
  });
});

describe("Cable (45011): Response after he thwarts and defeats a side scheme, draw 1", () => {
  it("his thwart (THW 2) removes the last 2 threat: he draws 1", () => {
    const g = withSideScheme(withAlly(heroGame([BISHOP()]), CABLE).state, 2);
    const cable = instancesOf(g.state, CABLE).find((i) => inPlay(g.state, i))!;
    const before = playerOf(g.state, P1).hand.length;
    const { state, seen } = go(g.state, picker({ accept: ["cable-response"] }), thwartCmd(cable, g.id));
    expect(offered(seen, "cable-response")).toBe(true);
    expect(playerOf(state, P1).hand.length).toBe(before + 1);
  });
  it("a thwart that leaves threat on the side scheme draws nothing", () => {
    const g = withSideScheme(withAlly(heroGame([BISHOP()]), CABLE).state, 3);
    const cable = instancesOf(g.state, CABLE).find((i) => inPlay(g.state, i))!;
    const before = playerOf(g.state, P1).hand.length;
    const { state, seen } = go(g.state, picker({ accept: ["cable-response"] }), thwartCmd(cable, g.id));
    expect(offered(seen, "cable-response")).toBe(false);
    expect(playerOf(state, P1).hand.length).toBe(before);
  });
  it("the hero's thwart that defeats the side scheme is not his: nothing is offered", () => {
    const g = withSideScheme(withAlly(heroGame([BISHOP()]), CABLE).state, 2);
    const { seen } = go(g.state, picker({ accept: ["cable-response"] }), thwartCmd(identityOf(g.state), g.id));
    expect(offered(seen, "cable-response")).toBe(false);
  });
});

describe("X-23 (45012): Response after she attacks and defeats an enemy, ready her", () => {
  it("ATK 3 defeats a minion with 3 hit points left: she readies", () => {
    const m = withMinion(withAlly(heroGame([BISHOP()]), X23).state);
    const x23 = instancesOf(m.state, X23).find((i) => inPlay(m.state, i))!;
    const hurt = patchInstance(m.state, m.id, { damage: hitPointsOf("01102") - 3 });
    const { state, seen } = go(hurt, picker({ accept: ["x-23-response"] }), attackCmd(hurt, x23, m.id));
    expect(offered(seen, "x-23-response")).toBe(true);
    expect(inPlay(state, m.id)).toBe(false);
    expect(inst(state, x23).exhausted).toBe(false);
  });
  it("an attack that does not defeat the enemy leaves her exhausted", () => {
    const m = withMinion(withAlly(heroGame([BISHOP()]), X23).state);
    const x23 = instancesOf(m.state, X23).find((i) => inPlay(m.state, i))!;
    const { state, seen } = go(m.state, picker({ accept: ["x-23-response"] }), attackCmd(m.state, x23, m.id));
    expect(offered(seen, "x-23-response")).toBe(false);
    expect(inst(state, x23).exhausted).toBe(true);
  });
});

describe("Advanced Suit (45014), skipped: where the draft fails", () => {
  /** X-23 (3 hit points, 1 damage) with Advanced Suit beside a minion her ATK 3 attack defeats. */
  function suited(deps: EngineDeps) {
    const ally = withAlly(heroGame([BISHOP()]), X23);
    const attached = playStaged(inHand(ally.state, SUIT), picker(), { attach: ally.id }, deps).state;
    const m = withMinion(patchInstance(attached, ally.id, { damage: 1 }));
    const hurt = patchInstance(m.state, m.id, { damage: hitPointsOf("01102") - 3 });
    return { hurt, ally: ally.id, minion: m.id };
  }
  const answer = (deps: EngineDeps) => {
    const s = suited(deps);
    return run(s.hurt, picker({ accept: ["advanced-suit-response"] }), deps, attackCmd(s.hurt, s.ally, s.minion));
  };
  it("the draft validates and attaches to the X-FORCE ally", () => {
    expect(validateDefinition(AOA_ASPECT_BASIC_DRAFTS["45014.advanced-suit-response"]!)).toEqual([]);
    const s = suited(DRAFT_DEPS);
    expect(attachedTo(s.hurt, SUIT, s.ally)).toBeDefined();
  });
  it.fails("registered as printed, the Response is offered after the ally defeats the minion", () => {
    expect(offered(answer(DRAFT_DEPS).seen, "advanced-suit-response")).toBe(true);
  });
  it("pins today: registered as printed it is never offered (the hand-discard cost is not planned in a trigger window)", () => {
    expect(offered(answer(DRAFT_DEPS).seen, "advanced-suit-response")).toBe(false);
  });
  it("the pattern is right: the same Response without the cost is offered and heals", () => {
    const costless: EngineDeps = {
      abilities: {
        ...DRAFT_DEPS.abilities,
        "45014.advanced-suit-response": response(
          { ...on.defeats(query("ally", { hostOfSelf: true })), targetIs: query(["minion", "sideScheme"]) },
          heal(1, host),
        ),
      },
    };
    const s = suited(costless);
    const { state, seen } = run(
      s.hurt,
      picker({ accept: ["advanced-suit-response"] }),
      costless,
      attackCmd(s.hurt, s.ally, s.minion),
    );
    expect(offered(seen, "advanced-suit-response")).toBe(true);
    // 1 damage + 1 consequential - 1 healed
    expect(damageOf(state, s.ally)).toBe(1);
  });
  it("the hero's own defeat of a minion is not the ally's: not offered even without the cost", () => {
    const costless: EngineDeps = {
      abilities: {
        ...DRAFT_DEPS.abilities,
        "45014.advanced-suit-response": response(
          { ...on.defeats(query("ally", { hostOfSelf: true })), targetIs: query(["minion", "sideScheme"]) },
          heal(1, host),
        ),
      },
    };
    const s = suited(costless);
    const { seen } = run(
      s.hurt,
      picker({ accept: ["advanced-suit-response"] }),
      costless,
      attackCmd(s.hurt, identityOf(s.hurt), s.minion),
    );
    expect(offered(seen, "advanced-suit-response")).toBe(false);
  });
});

describe("Sidekick (45015): an identity-specific ally you control; +2 hit points; after your basic recovery, heal 2", () => {
  const MALCOLM = "45002"; // Bishop's own ally (identity-specific), 3 hit points
  const COLOSSUS = "45031"; // Magik's ally: identity-specific, of another identity's set
  const TRAINING = "45013";
  /** Sidekick staged in the hand with its payment, and the command that plays it on `host`. */
  function sidekickOn(s: GameState, host: InstanceId | undefined) {
    const staged = inHand(s, SIDEKICK);
    return { state: staged.state, command: play(P1, staged.id, staged.pay, host ? { attachToInstanceId: host } : {}) };
  }
  /** Sidekick played for real on Malcolm, who has `damage` on him. */
  function sidekicked(damage: number, game = alterEgoGame([BISHOP()])) {
    const ally = withAlly(game, MALCOLM, damage);
    const { state, command } = sidekickOn(ally.state, ally.id);
    return { ...ally, state: run(state, picker(), DEPS, command).state };
  }
  it("Bishop controls Malcolm and X-23: Malcolm is a host, X-23 (a Leadership ally) is refused", () => {
    const malcolm = withAlly(alterEgoGame([BISHOP()]), MALCOLM);
    const x23 = withAlly(malcolm.state, X23);
    const refused = sidekickOn(x23.state, x23.id);
    expect(accepted(refused.state, refused.command)).toBe(false);
    const allowed = sidekickOn(x23.state, malcolm.id);
    expect(accepted(allowed.state, allowed.command)).toBe(true);
  });
  it("with X-23 alone there is no valid host: Sidekick cannot be played, on her or on nothing", () => {
    const x23 = withAlly(alterEgoGame([BISHOP()]), X23);
    for (const host of [x23.id, undefined, identityOf(x23.state)]) {
      const attempt = sidekickOn(x23.state, host);
      expect(accepted(attempt.state, attempt.command)).toBe(false);
    }
  });
  it("another identity's ally under Bishop's control (Magik's Colossus) is a legal host", () => {
    const colossus = withAlly(alterEgoGame([BISHOP(COLOSSUS)]), COLOSSUS);
    const { state, command } = sidekickOn(colossus.state, colossus.id);
    const after = run(state, picker(), DEPS, command).state;
    expect(attachedTo(after, SIDEKICK, colossus.id)).toBeDefined();
  });
  it("hit points 3 become 5, and 6 with Team Training", () => {
    const { state, id } = sidekicked(0);
    expect(attachedTo(state, SIDEKICK, id)).toBeDefined();
    expect(maxHitPoints(state, id, DEPS)).toBe(5);
    const trained = playStaged(inHand(state, TRAINING), picker()).state;
    expect(maxHitPoints(trained, id, DEPS)).toBe(6);
  });
  it("with 4 damage on him Malcolm lives on his 5 hit points", () => {
    const { state, id } = sidekicked(4);
    expect(inPlay(state, id)).toBe(true);
    expect(damageOf(state, id)).toBe(4);
  });
  // RRG "Hit Points" (p. 22): "+X hit points" that ceases to be in effect with damage on the ally equal to or greater
  // than its hit points defeats it (the engine's `checkHitPointsFell`). Caught Off Guard (Core 01188, "discard an
  // upgrade or support you control") is the discard; Advance (01186) is the villain's boost card.
  it("section 3.53 test 2: Sidekick discarded with 4 damage on him: Malcolm has 3 hit points again and is defeated", () => {
    const { state, id } = sidekicked(4);
    const run = driveEventsPicking(DEPS, stackEncounterDeck(state, "01186", "01188"), picker(), endTurn(P1));
    expect(attachedTo(run.state, SIDEKICK, id)).toBeUndefined();
    expect(run.events.filter((e) => e.type === "hitPointsFell")).toMatchObject([
      { instanceId: id, from: 5, to: 3, damage: 4 },
    ]);
    expect(inPlay(run.state, id)).toBe(false);
    expect(playerOf(run.state, P1).discard).toContain(id);
  });
  it("section 3.53 test 2, the control: with 2 damage on him the same discard leaves him in play on 3 hit points", () => {
    const { state, id } = sidekicked(2);
    const run = driveEventsPicking(DEPS, stackEncounterDeck(state, "01186", "01188"), picker(), endTurn(P1));
    expect(attachedTo(run.state, SIDEKICK, id)).toBeUndefined();
    expect(inPlay(run.state, id)).toBe(true);
    expect(maxHitPoints(run.state, id, DEPS)).toBe(3);
  });
  it("a basic recovery (REC 4 on Lucas Bishop) heals 4 from him, then 2 from the sidekick", () => {
    const { state: s, id } = sidekicked(3);
    const hurt = withDamage(s, identityOf(s), 4);
    const { state, seen } = go(hurt, picker({ accept: ["sidekick-response"] }), { type: "basicRecover", playerId: P1 });
    expect(offered(seen, "sidekick-response")).toBe(true);
    expect(damageOf(state, identityOf(state))).toBe(0);
    expect(damageOf(state, id)).toBe(1);
  });
});

describe("Legion (45020): Response after he uses a basic power, discard the top card; the printed resource decides", () => {
  /** Legion (1 damage on him), the top card of Bishop's deck relabeled `top`; he attacks the villain. */
  function legion(top: string) {
    const ally = withAlly(heroGame([BISHOP()]), LEGION, 1);
    const topId = playerOf(ally.state, P1).deck[0]!;
    const s = patchInstance(relabel(ally.state, topId, top), ally.state.mainScheme.instanceId, { threat: 6 });
    const { state, seen, events } = go(
      s,
      picker({ accept: ["legion-response"], pick: [villainOf(s), s.mainScheme.instanceId, ally.id] }),
      attackCmd(s, ally.id, villainOf(s)),
    );
    return { state, seen, events, ally: ally.id, villain: villainOf(s), topId, before: s };
  }
  it("an [energy] card: 1 attack damage plus 2 damage to an enemy", () => {
    const r = legion("01088");
    expect(damageOf(r.state, r.villain)).toBe(damageOf(r.before, r.villain) + 1 + 2);
    expect(playerOf(r.state, P1).discard).toContain(r.topId);
  });
  it("a [mental] card: 2 threat removed from a scheme", () => {
    const r = legion("01089");
    expect(inst(r.state, r.before.mainScheme.instanceId).threat).toBe(4);
  });
  it("a [physical] card: heals 2 from Legion (1 + 1 consequential - 2 = 0); a wild resolves nothing", () => {
    const heal = legion("01090");
    expect(damageOf(heal.state, heal.ally)).toBe(0);
    const wild = legion("45019");
    expect(damageOf(wild.state, wild.ally)).toBe(2);
    expect(damageOf(wild.state, wild.villain)).toBe(damageOf(wild.before, wild.villain) + 1);
    expect(inst(wild.state, wild.before.mainScheme.instanceId).threat).toBe(6);
  });
  it("a card with no resource at all resolves no line", () => {
    const none = legion("01104");
    expect(damageOf(none.state, none.ally)).toBe(2);
  });
});

describe("Marrow (45021): play only with the X-FORCE or X-MEN trait; after she enters play, 2 damage to an enemy", () => {
  it("Bishop (X-MEN) plays her: 2 damage to the chosen enemy", () => {
    const s = heroGame([BISHOP()]);
    const { state, seen } = playStaged(
      inHand(s, MARROW),
      picker({ accept: ["marrow-response"], pick: [villainOf(s)] }),
    );
    expect(offered(seen, "marrow-response")).toBe(true);
    expect(damageOf(state, villainOf(state))).toBe(2);
  });
  it("Spider-Man (no X trait) cannot play her", () => {
    const staged = inHand(heroGame([SM(MARROW)]), MARROW);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay))).toBe(false);
  });
});

describe("Triage (45048): Response after he enters play, heal 2 damage from an X-MEN character", () => {
  it("heals 2 from Bishop (X-MEN)", () => {
    const s = withDamage(heroGame([BISHOP()]), identityOf(heroGame([BISHOP()])), 0);
    const hurt = withDamage(s, identityOf(s), 3);
    const { state, seen } = playStaged(
      inHand(hurt, TRIAGE),
      picker({ accept: ["triage-response"], pick: [identityOf(hurt)] }),
    );
    expect(offered(seen, "triage-response")).toBe(true);
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
  it("the target must carry the X-MEN trait: Spider-Man is not offered", () => {
    const s = heroGame([BISHOP(), SM()]);
    const spider = identityOf(s, "p2" as PlayerId);
    const { seen } = playStaged(inHand(s, TRIAGE), picker({ accept: ["triage-response"] }));
    const target = seen.find((p) => p.kind === "chooseTarget");
    expect(target?.options).not.toContain(spider);
  });
});

describe("Tempus (45042): Interrupt when the villain would scheme, discard her: cancel it, deal yourself 1 facedown encounter card", () => {
  const villainPhase = (s: GameState, accept: boolean) =>
    go(s, picker({ accept: accept ? ["tempus-interrupt"] : [] }), endTurn(P1));
  it("accepted: the scheme does not happen, Tempus is discarded and the player is dealt an extra card", () => {
    const base = withAlly(heroGame([BISHOP()]), TEMPUS);
    const s0 = withForm(base.state, "alterEgo");
    // Headroom on the main scheme (a negative count, surgery): the villain phase accelerates it.
    const s = patchInstance(s0, s0.mainScheme.instanceId, { threat: -30 });
    const control = villainPhase(s, false);
    const taken = villainPhase(s, true);
    expect(ofType(control.events, "schemeResolved")).toHaveLength(1);
    expect(ofType(taken.events, "schemeResolved")).toHaveLength(0);
    expect(playerOf(taken.state, P1).discard).toContain(base.id);
    expect(playerOf(control.state, P1).discard).not.toContain(base.id);
    expect(ofType(taken.events, "encounterCardRevealed")).toHaveLength(
      ofType(control.events, "encounterCardRevealed").length + 1,
    );
  });
  it("she is offered when the villain schemes", () => {
    const base = withAlly(heroGame([BISHOP()]), TEMPUS);
    const { seen } = villainPhase(withForm(base.state, "alterEgo"), false);
    expect(offered(seen, "tempus-interrupt")).toBe(true);
  });
});

describe("Blood Rage (45043): Response after you defeat an enemy with a basic attack, exhaust it and take 1 damage, draw 1", () => {
  function raged() {
    const g = heroGame([BISHOP()]);
    const { state } = playStaged(inHand(g, BLOOD_RAGE), picker());
    const rage = played(state, BLOOD_RAGE);
    const m = withMinion(state);
    return { rage, ...m };
  }
  it("a basic attack that defeats the minion: draws 1, takes 1, Blood Rage exhausts", () => {
    const r = raged();
    const hurt = patchInstance(r.state, r.id, { damage: hitPointsOf("01102") - 2 });
    const hand = playerOf(hurt, P1).hand.length;
    const { state, seen } = go(
      hurt,
      picker({ accept: ["blood-rage-response"] }),
      attackCmd(hurt, identityOf(hurt), r.id),
    );
    expect(offered(seen, "blood-rage-response")).toBe(true);
    expect(playerOf(state, P1).hand.length).toBe(hand + 1);
    expect(damageOf(state, identityOf(state))).toBe(1);
    expect(inst(state, r.rage).exhausted).toBe(true);
  });
  it("a basic attack that does not defeat: nothing is offered", () => {
    const r = raged();
    const { seen } = go(
      r.state,
      picker({ accept: ["blood-rage-response"] }),
      attackCmd(r.state, identityOf(r.state), r.id),
    );
    expect(offered(seen, "blood-rage-response")).toBe(false);
  });
  it("an exhausted Blood Rage cannot pay", () => {
    const r = raged();
    const hurt = patchInstance(patchInstance(r.state, r.id, { damage: hitPointsOf("01102") - 2 }), r.rage, {
      exhausted: true,
    });
    const { seen } = go(hurt, picker({ accept: ["blood-rage-response"] }), attackCmd(hurt, identityOf(hurt), r.id));
    expect(offered(seen, "blood-rage-response")).toBe(false);
  });
});

describe("Test the Defense (45044): Response after you play an ATTACK event, 1 test counter; at 5, discard it for 5 damage", () => {
  function defended(counters: number) {
    const g = heroGame([BISHOP()]);
    const { state } = playStaged(inHand(g, TEST_DEFENSE), picker());
    const card = played(state, TEST_DEFENSE);
    return { card, state: patchInstance(state, card, { counters: { test: counters } }) };
  }
  it("playing Haymaker places a counter", () => {
    const d = defended(0);
    const { state, seen } = playStaged(
      inHand(d.state, HAYMAKER),
      picker({ accept: ["test-the-defense-response"], pick: [villainOf(d.state)] }),
    );
    expect(offered(seen, "test-the-defense-response")).toBe(true);
    expect(inst(state, d.card).counters.test).toBe(1);
  });
  it("the fifth counter discards it and deals 5 damage to an enemy", () => {
    const d = defended(4);
    const villain = villainOf(d.state);
    const { state } = playStaged(
      inHand(d.state, HAYMAKER),
      picker({ accept: ["test-the-defense-response"], pick: [villain] }),
    );
    expect(playerOf(state, P1).discard).toContain(d.card);
    // Haymaker's 3 and the 5
    expect(damageOf(state, villain)).toBe(3 + 5);
  });
  it("a non-attack event adds nothing", () => {
    const d = defended(0);
    const staged = inHand(d.state, "01070");
    const { state, seen } = playStaged(staged, picker({ accept: ["test-the-defense-response"] }));
    expect(offered(seen, "test-the-defense-response")).toBe(false);
    expect(inst(state, d.card).counters.test ?? 0).toBe(0);
  });
});

describe("Full-Body Charge (45045): Hero Action (attack), 8 damage; overkill below half the hero's starting hit points", () => {
  /** Magik (10 starting hit points) with `hurt` damage and a 3-hit-point minion; the charge targets the minion. */
  function charge(hurt: number) {
    const g = withMinion(withDamage(heroGame([MAGIK()]), identityOf(heroGame([MAGIK()])), 0));
    const s = withDamage(g.state, identityOf(g.state), hurt);
    const villain = villainOf(s);
    const result = playStaged(inHand(s, CHARGE), picker({ pick: [g.id] }));
    return { ...result, minion: g.id, villain, before: s };
  }
  it("full health: the minion dies, no excess reaches the villain", () => {
    const r = charge(0);
    expect(inPlay(r.state, r.minion)).toBe(false);
    expect(damageOf(r.state, r.villain)).toBe(damageOf(r.before, r.villain));
  });
  it("5 remaining of 10 is not less than half: no overkill", () => {
    const r = charge(5);
    expect(damageOf(r.state, r.villain)).toBe(damageOf(r.before, r.villain));
  });
  it("4 remaining of 10: overkill, the excess 8 - 3 reaches the villain", () => {
    const r = charge(6);
    expect(damageOf(r.state, r.villain)).toBe(damageOf(r.before, r.villain) + (8 - hitPointsOf("01102")));
  });
});

describe("Stepford Cuckoos (45049): Interrupt when a player reveals a treachery, exhaust and spend a psi counter: cancel it", () => {
  /** The villain phase with a treachery staged as the first card dealt to Bishop. */
  function revealed(accept: boolean) {
    const ally = playStaged(inHand(heroGame([BISHOP()]), CUCKOOS), picker());
    const cuckoos = instancesOf(ally.state, CUCKOOS).find((i) => inPlay(ally.state, i))!;
    const s = ally.state;
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const ids = pile.deck.slice(0, 12);
    let next = s;
    // boost card for Rhino's attack (Advance, 0 icons), then the treachery, then spare Advance cards.
    ids.forEach((id, n) => {
      next = relabel(next, id, n === 1 ? TOUGH : ADVANCE);
    });
    const result = go(next, picker({ accept: accept ? ["stepford-cuckoos"] : [] }), endTurn(P1));
    return { ...result, cuckoos, treachery: ids[1]! };
  }
  it("accepted: the treachery is canceled and discarded, Cuckoos exhausts and keeps 2 psi counters", () => {
    const r = revealed(true);
    expect(offered(r.seen, "stepford-cuckoos")).toBe(true);
    expect(inst(r.state, r.cuckoos).exhausted).toBe(true);
    expect(inst(r.state, r.cuckoos).counters.psi).toBe(2);
    expect(inst(r.state, villainOf(r.state)).statuses.tough).toBe(0);
  });
  it("declined: the treachery resolves (Rhino gets a tough status card)", () => {
    const r = revealed(false);
    expect(inst(r.state, r.cuckoos).counters.psi).toBe(3);
    expect(inst(r.state, villainOf(r.state)).statuses.tough).toBe(1);
  });
  it("accepted: another encounter card is revealed in its place", () => {
    const accepted_ = revealed(true);
    const declined = revealed(false);
    expect(ofType(accepted_.events, "encounterCardRevealed").length).toBe(
      ofType(declined.events, "encounterCardRevealed").length + 1,
    );
  });
});

describe("Bloodgem (45050): Resource, exhaust it and take 2 damage: generate a wild resource", () => {
  it("Magik (MYSTIC) pays a 1-cost card with it: 2 damage to her, Bloodgem exhausted", () => {
    const g = heroGame([MAGIK()]);
    const gem = playStaged(inHand(g, BLOODGEM), picker());
    const id = played(gem.state, BLOODGEM);
    const staged = moveToHand(withResources(gem.state, 4), P1, HAYMAKER);
    const { state } = run(
      staged.state,
      picker({ pick: [villainOf(staged.state)] }),
      DEPS,
      play(P1, staged.ids[0]!, payers(staged.state, P1, 1, [staged.ids[0]!]), {
        abilities: [resourceAbility(id, "45050.bloodgem-resource")],
      }),
    );
    expect(damageOf(state, identityOf(state))).toBe(2);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("Bishop (no MYSTIC trait) cannot play it", () => {
    const staged = inHand(heroGame([BISHOP(BLOODGEM)]), BLOODGEM);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay))).toBe(false);
  });
});

describe("Basic Spell (45051): Hero Action, choose one: heal 3 from an identity, remove 3 threat, 3 damage to an enemy", () => {
  it("option 1 heals 3 from the chosen identity", () => {
    const g = heroGame([MAGIK()]);
    const hurt = withDamage(g, identityOf(g), 4);
    const { state } = playStaged(inHand(hurt, SPELL), picker({ option: 0, pick: [identityOf(hurt)] }));
    expect(damageOf(state, identityOf(state))).toBe(1);
  });
  it("option 2 removes 3 threat from the main scheme", () => {
    const g = heroGame([MAGIK()]);
    const s = patchInstance(g, g.mainScheme.instanceId, { threat: 5 });
    const { state } = playStaged(inHand(s, SPELL), picker({ option: 1, pick: [s.mainScheme.instanceId] }));
    expect(inst(state, s.mainScheme.instanceId).threat).toBe(2);
  });
  it("option 3 deals 3 damage to the chosen enemy", () => {
    const g = heroGame([MAGIK()]);
    const { state } = playStaged(inHand(g, SPELL), picker({ option: 2, pick: [villainOf(g)] }));
    expect(damageOf(state, villainOf(state))).toBe(3);
  });
  it("Bishop (no MYSTIC trait) cannot play it", () => {
    const staged = inHand(heroGame([BISHOP(SPELL)]), SPELL);
    expect(accepted(staged.state, play(P1, staged.id, staged.pay))).toBe(false);
  });
});

describe("Goldballs (45041): when he attacks, discard up to 3 cards from the top of your deck -> +X ATK for this attack", () => {
  /** Goldballs (ATK 1) in play under Magik, ready; `deck` cuts her deck to that many cards (the rest to the discard pile). */
  function staged(deck?: number) {
    const ally = withAlly(heroGame([MAGIK()]), GOLDBALLS);
    const s = ally.state;
    if (deck === undefined) return { s, ally: ally.id };
    const cut: GameState = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.slice(0, deck), discard: [...p.discard, ...p.deck.slice(deck)] } : p,
      ),
    };
    return { s: cut, ally: ally.id };
  }
  /** He attacks the villain: the Interrupt is used and `count` chosen, or (null) it is declined. */
  function attack(s: GameState, ally: InstanceId, count: number | null) {
    const numbers: string[][] = [];
    const base = picker({ accept: count === null ? [] : ["goldballs-interrupt"] });
    const pick: Picker = (st) => {
      const choice = st.pendingChoice!;
      if (choice.prompt.kind !== "chooseNumber") return base(st);
      numbers.push(choice.options.map((o) => o.optionId as string));
      return [String(count)];
    };
    const result = run(s, pick, DEPS, attackCmd(s, ally, villainOf(s)));
    return { ...result, numbers, dealt: damageOf(result.state, villainOf(s)) - damageOf(s, villainOf(s)) };
  }

  it("the registered script validates", () => {
    expect(validateDefinition(AOA_ASPECT_BASIC["45041.goldballs-interrupt"]!)).toEqual([]);
  });
  it("3 discarded: 1 + 3 = 4 damage, and 1 consequential damage to him", () => {
    const { s, ally } = staged();
    const top = playerOf(s, P1).deck.slice(0, 3);
    const { state, numbers, dealt, seen } = attack(s, ally, 3);
    expect(offered(seen, "goldballs-interrupt")).toBe(true);
    expect(numbers).toEqual([["1", "2", "3"]]);
    expect(dealt).toBe(4);
    expect(damageOf(state, ally)).toBe(1);
    expect(playerOf(state, P1).discard).toEqual(expect.arrayContaining(top));
    expect(playerOf(state, P1).deck.length).toBe(playerOf(s, P1).deck.length - 3);
  });
  it("1 discarded: 2 damage; the bonus is for that attack only (ATK 1 again afterward)", () => {
    const { s, ally } = staged();
    const { state, dealt } = attack(s, ally, 1);
    expect(dealt).toBe(2);
    expect(characterProfile(state, ally, DEPS)!.atk).toBe(1);
  });
  it("declined: his printed ATK 1, nothing discarded; zero is never offered as a payment", () => {
    const { s, ally } = staged();
    const { state, numbers, dealt } = attack(s, ally, null);
    expect(numbers).toEqual([]);
    expect(dealt).toBe(1);
    expect(playerOf(state, P1).deck.length).toBe(playerOf(s, P1).deck.length);
  });
  it("a deck of 2: 1 or 2 may be chosen; with 2 the deck resets, 1 facedown encounter card is dealt, +2 ATK", () => {
    const { s, ally } = staged(2);
    const dealtBefore = playerOf(s, P1).dealtEncounter.length;
    const { state, numbers, dealt, events } = attack(s, ally, 2);
    expect(numbers).toEqual([["1", "2"]]);
    expect(dealt).toBe(3);
    expect(ofType(events, "deckShuffled").length).toBeGreaterThanOrEqual(1);
    expect(playerOf(state, P1).deck.length).toBeGreaterThan(0);
    expect(playerOf(state, P1).dealtEncounter.length).toBe(dealtBefore + 1);
  });
  it("in Magik's deck the new top card is shown after the discards (section 3.48)", () => {
    const { s, ally } = staged();
    const { state } = attack(s, ally, 3);
    const top = playerOf(state, P1).deck[0]!;
    expect(top).not.toBe(playerOf(s, P1).deck[0]);
    expect(shownDeckTop(state, DEPS, P1)).toBe(top);
  });
});

describe("Side-by-Side (45016): ready your sidekick -> ready your hero and choose one", () => {
  const MALCOLM = "45002"; // ATK 2, THW 1, 3 hit points (5 with Sidekick)
  /** Bishop (hero form, exhausted, 3 damage) with Malcolm as his sidekick (2 damage), exhausted or ready. */
  function staged(sidekickReady: boolean) {
    const ally = withAlly(heroGame([BISHOP()]), MALCOLM);
    const sidekick = inHand(ally.state, SIDEKICK);
    const withSidekick = run(
      sidekick.state,
      picker(),
      DEPS,
      play(P1, sidekick.id, sidekick.pay, { attachToInstanceId: ally.id }),
    ).state;
    const hero = identityOf(withSidekick);
    const s = patchInstance(patchInstance(withSidekick, ally.id, { exhausted: !sidekickReady, damage: 2 }), hero, {
      exhausted: true,
      damage: 3,
    });
    return { s, ally: ally.id, hero, card: inHand(s, SIDE_BY_SIDE) };
  }
  const stats = (s: GameState, id: InstanceId) => {
    const profile = characterProfile(s, id, DEPS)!;
    return { thw: profile.thw, atk: profile.atk };
  };

  it("printed: a cost 2 Leadership event; the registered script validates", () => {
    const d = BY_ID.get(SIDE_BY_SIDE) as { type: string; cost: number; aspect: string };
    expect([d.type, d.cost, d.aspect]).toEqual(["event", 2, "leadership"]);
    expect(validateDefinition(AOA_ASPECT_BASIC["45016.side-by-side-action"]!)).toEqual([]);
  });
  it("first option: both ready; 1 damage healed from each (Malcolm 2 -> 1, Bishop 3 -> 2)", () => {
    const { card, ally, hero } = staged(false);
    const { state } = playStaged(card, picker({ option: 0 }));
    expect(inst(state, ally).exhausted).toBe(false);
    expect(inst(state, hero).exhausted).toBe(false);
    expect(damageOf(state, ally)).toBe(1);
    expect(damageOf(state, hero)).toBe(2);
  });
  it("second option: Malcolm THW 2, ATK 3 and Bishop THW 3, ATK 3 until the end of the phase, then printed again", () => {
    const { card, ally, hero, s } = staged(false);
    expect(stats(s, ally)).toEqual({ thw: 1, atk: 2 });
    expect(stats(s, hero)).toEqual({ thw: 2, atk: 2 });
    const { state } = playStaged(card, picker({ option: 1 }));
    expect(inst(state, ally).exhausted).toBe(false);
    expect(inst(state, hero).exhausted).toBe(false);
    expect(stats(state, ally)).toEqual({ thw: 2, atk: 3 });
    expect(stats(state, hero)).toEqual({ thw: 3, atk: 3 });
    expect(damageOf(state, ally)).toBe(2);
    const villainPhase = settle(
      go(state, picker(), endTurn(P1)).state,
      picker(),
      (st) => st.step.phase !== "player",
      DEPS,
    );
    expect(stats(villainPhase, ally)).toEqual({ thw: 1, atk: 2 });
    expect(stats(villainPhase, hero)).toEqual({ thw: 2, atk: 2 });
  });
  it("a ready hero: the sidekick still readies and the option still resolves", () => {
    const { card, ally, hero } = staged(false);
    const rested = patchInstance(card.state, hero, { exhausted: false });
    const { state } = run(rested, picker({ option: 0 }), DEPS, play(P1, card.id, card.pay));
    expect(inst(state, ally).exhausted).toBe(false);
    expect(damageOf(state, hero)).toBe(2);
  });
  it("Q29 = A: with the sidekick ready the event cannot be played (the ready is the cost)", () => {
    const { card } = staged(true);
    expect(accepted(card.state, play(P1, card.id, card.pay))).toBe(false);
  });
  it("with no Sidekick in play (an exhausted Malcolm alone) it cannot be played", () => {
    const ally = withAlly(heroGame([BISHOP()]), MALCOLM);
    const s = patchInstance(ally.state, ally.id, { exhausted: true });
    const card = inHand(s, SIDE_BY_SIDE);
    expect(accepted(card.state, play(P1, card.id, card.pay))).toBe(false);
  });
  it("in alter-ego form it cannot be played (Hero Action)", () => {
    const { card } = staged(false);
    const lucas = withForm(card.state, "alterEgo");
    expect(accepted(lucas, play(P1, card.id, card.pay))).toBe(false);
  });
});

describe("Suit Up (45017, errata): search your deck and discard pile for an ally and an upgrade that can be attached to an ally", () => {
  const MALCOLM = "45002";
  const RIFLE = "45004"; // Bishop's Rifle: no "attach to" text, it goes by the identity
  const typeOf = (s: GameState, id: string): string =>
    (BY_ID.get(codeOf(s, id as InstanceId)) as { type: string }).type;
  const cardPrompts = (seen: readonly Seen[]) => seen.filter((p) => p.kind === "chooseCards");
  /** Lucas Bishop with Suit Up in hand, and no Malcolm, Sidekick, Advanced Suit or Rifle in hand. */
  function staged(edit: (s: GameState) => GameState = (s) => s) {
    const base = alterEgoGame([BISHOP(RIFLE)]);
    const kept = new Set([MALCOLM, SIDEKICK, SUIT, RIFLE]);
    const back: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        hand: p.hand.filter((id) => !kept.has(codeOf(base, id))),
        deck: [...p.hand.filter((id) => kept.has(codeOf(base, id))), ...p.deck],
      })),
    };
    return inHand(edit(back), SUIT_UP);
  }

  it("printed data carries the erratum; the registered script validates", () => {
    const text = (BY_ID.get(SUIT_UP) as { text: { printed: string; current: string } }).text;
    expect(text.current).toContain("an upgrade that can be attached to an ally");
    expect(text.current).not.toBe(text.printed);
    expect(validateDefinition(AOA_ASPECT_BASIC["45017.suit-up-action"]!)).toEqual([]);
  });
  it("the ally pick offers allies (Malcolm among them); the upgrade pick offers Sidekick and Advanced Suit, not the Rifle", () => {
    const card = staged();
    const one = (code: string) => instancesOf(card.state, code).find((i) => playerOf(card.state, P1).deck.includes(i))!;
    const [malcolm, sidekick, suit, rifle] = [one(MALCOLM), one(SIDEKICK), one(SUIT), one(RIFLE)];
    const { state, seen, events } = playStaged(card, picker({ pick: [malcolm, sidekick] }));
    const [allies, upgrades] = cardPrompts(seen);
    expect(cardPrompts(seen)).toHaveLength(2);
    expect(allies!.options).toContain(malcolm);
    expect(new Set(allies!.options.map((o) => typeOf(card.state, o)))).toEqual(new Set(["ally"]));
    expect(upgrades!.options).toEqual(expect.arrayContaining([sidekick, suit]));
    expect(upgrades!.options).not.toContain(rifle);
    expect(new Set(upgrades!.options.map((o) => typeOf(card.state, o)))).toEqual(new Set(["upgrade"]));
    // Every upgrade offered prints an "attach to"; none goes by the identity.
    for (const o of upgrades!.options)
      expect((BY_ID.get(codeOf(card.state, o as InstanceId)) as { attachesTo?: unknown }).attachesTo).toBeDefined();
    expect(playerOf(state, P1).hand).toEqual(expect.arrayContaining([malcolm, sidekick]));
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
  });
  it("Q30 = A: Sidekick is offered with no ally in play at all", () => {
    const card = staged();
    expect(card.state.players[0]!.playArea.some((id) => typeOf(card.state, id) === "ally")).toBe(false);
    const { seen } = playStaged(card, picker());
    const sidekicks = instancesOf(card.state, SIDEKICK);
    expect(cardPrompts(seen)[1]!.options.some((o) => sidekicks.includes(o as InstanceId))).toBe(true);
  });
  it("no ally in the deck or discard pile, Advanced Suit in the discard pile: Advanced Suit to hand", () => {
    const card = staged((s) => {
      const suit = instancesOf(s, SUIT).find((i) => playerOf(s, P1).deck.includes(i))!;
      return {
        ...s,
        players: s.players.map((p) => ({
          ...p,
          // The allies leave the deck and discard pile for nowhere (surgery); Advanced Suit goes to the discard pile.
          deck: p.deck.filter((id) => typeOf(s, id) !== "ally" && id !== suit),
          discard: [...p.discard.filter((id) => typeOf(s, id) !== "ally"), suit],
        })),
      };
    });
    const suit = playerOf(card.state, P1).discard.find((i) => codeOf(card.state, i) === SUIT)!;
    const { state, seen, events } = playStaged(card, picker({ pick: [suit] }));
    expect(cardPrompts(seen).every((p) => p.options.every((o) => typeOf(card.state, o) === "upgrade"))).toBe(true);
    expect(playerOf(state, P1).hand).toContain(suit);
    expect(playerOf(state, P1).discard).not.toContain(suit);
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
  });
  it("both picks are optional: taking neither still shuffles the deck once", () => {
    const card = staged();
    const none: Picker = (s) => (s.pendingChoice!.prompt.kind === "chooseCards" ? [] : firstLegal(s));
    const before = playerOf(card.state, P1).hand.length;
    const { state, events } = playStaged(card, none);
    expect(playerOf(state, P1).hand.length).toBe(before - 1 - card.pay.length);
    expect(ofType(events, "deckShuffled")).toHaveLength(1);
  });
  it("in hero form it cannot be played (Alter-Ego Action)", () => {
    const card = staged();
    expect(accepted(withForm(card.state, { heroForm: 0 }), play(P1, card.id, card.pay))).toBe(false);
  });
});
