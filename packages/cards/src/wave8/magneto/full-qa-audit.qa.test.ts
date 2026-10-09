import { CORE_CARDS, WAVE8_CARDS, WAVE8_STARTER_DECKS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  keywordsOf,
  statBonus,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";
import { NIGHTCRAWLER_OBLIGATION_NEMESIS } from "../ncrawler/nightcrawler/obligation-nemesis.js";
import { MAGNETO_ABILITIES } from "./index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA audit of the Magneto pack (wave 8, 2026-10-09): gaps the pack's own tests leave. Every test names its source.
 * Sources: the printed card text (`packages/content/src/data/magneto/cards.ts`), RRG 1.8 (`mc_rulesreference_v18_compressed.md`,
 * entries "Retaliate X", "Stun, Stunned", "Steady", "Attack (Enemy Activation)", "Blank"), FFG rulings in
 * `marvel-champions-rulings-post-rrg-1-7.md` (December 17, 2025 - Ruling 3; January 17, 2026 - Ruling 5) and the owner
 * decisions of docs/phase7-wave8.md section 4.1 (rows 41, 42, 81, 86).
 *
 * Magneto's real `magneto-leadership` deck against Rhino; a second seat is Spider-Man (Justice precon) when a card says
 * "each", "any player", "another" or "the defeating player". Hydra Mercenary 01101 is engaged and relabeled to the
 * minion a test needs.
 */
const POOL: readonly AnyCard[] = [...CORE_CARDS, ...WAVE8_CARDS];
const BY_ID = new Map(POOL.map((c) => [c.id as string, c]));
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_ABILITIES) };

const MG_DECK = WAVE8_STARTER_DECKS.find((d) => d.id === "magneto-leadership")!;
const MG_SEAT = {
  identityCardId: MG_DECK.identityCardId,
  aspects: MG_DECK.aspects,
  deck: MG_DECK.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};

const PULL = "49001a.magnetic-pull";
const WRAPPED = "49007";
const MISSILE = "49010";
const SHARDS = "49009";
const HELMET = "49003";
const ARMOR = "49004";
const BUBBLE = "49006";
const MASTER = "49011";
const SQUARED_OFF = "49017";
const KID_OMEGA = "49013";
const M_ALLY = "49012";
const WHITE_QUEEN = "49021";
const MARTYR = "49029";
const FABIAN = "49030";
const FRENZY = "49031";
const ACOLYTE_TREACHERY = "49032";
const SHAW = "49038";
const MERCENARY = "01101";
const SANDMAN = "01102";
const ADVANCE = "01186";

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const discardOf = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((i) => codeOf(s, i));
const handOf = (s: GameState, p: PlayerId = P1): InstanceId[] => [...playerOf(s, p).hand];
const iconsOf = (s: GameState, id: InstanceId): number => {
  const card = BY_ID.get(codeOf(s, id)) as {
    resourceIcons?: Record<string, number>;
    producesIcons?: Record<string, number>;
  };
  return Object.values(card.resourceIcons ?? card.producesIcons ?? {}).reduce((a, b) => a + b, 0);
};
const accepted = (s: GameState, c: Command): boolean => applyCommand(s, c, DEPS).ok;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

function setupGame(two = false, seed = 1): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  } as never);
  const spider = config.players[0]!;
  const created = createGame({ ...config, players: two ? [MG_SEAT, spider] : [MG_SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  // Headroom on the main scheme (staging): a villain phase schemes and accelerates without ending the game.
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}
const heroGame = (two = false, seed = 1): GameState => {
  const s = withForm(setupGame(two, seed), { heroForm: 0 }, P1);
  return two ? withForm(s, { heroForm: 0 }, P2) : s;
};

/** Hand cards of `p` (not in `except`) whose printed icons add up to exactly `cost`. */
function payers(s: GameState, p: PlayerId, cost: number, except: readonly InstanceId[]): InstanceId[] {
  const out: InstanceId[] = [];
  let left = cost;
  for (const h of handOf(s, p)) {
    if (left === 0) break;
    const n = iconsOf(s, h);
    if (except.includes(h) || n === 0 || n > left) continue;
    out.push(h);
    left -= n;
  }
  if (left > 0) throw new Error(`cannot pay ${cost}`);
  return out;
}
/** Plays `code` from the hand of `p` (cost paid by other hand cards), answering prompts with `pick`. */
function cast(
  s: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  o: { p?: PlayerId; attach?: InstanceId; hold?: readonly InstanceId[] } = {},
) {
  const p = o.p ?? P1;
  const given = moveToHand(s, p, code);
  const id = given.ids[0]!;
  const pay = payers(given.state, p, cost, [id, ...(o.hold ?? [])]);
  const run = driveEventsPicking(
    DEPS,
    given.state,
    pick,
    play(p, id, pay, o.attach ? { attachToInstanceId: o.attach } : {}),
  );
  return { ...run, id, before: given.state };
}

/** Engages a Hydra Mercenary with `p`, relabeled `code`. */
function withMinion(s: GameState, code: string, p: PlayerId = P1): { state: GameState; minion: InstanceId } {
  const { state, id } = engageMinion(s, MERCENARY, p);
  return { state: patchInstance(state, id, { cardId: cardId(code) }), minion: id };
}
/** Takes a copy of `code` out of the hand and attaches it to `host` by surgery (no play, no cost). */
function attachFromHand(s: GameState, code: string, host: InstanceId, p: PlayerId = P1) {
  const { state: staged, ids } = moveToHand(s, p, code);
  const id = ids[0]!;
  const removed: GameState = {
    ...staged,
    players: staged.players.map((pl) => (pl.playerId === p ? { ...pl, hand: pl.hand.filter((i) => i !== id) } : pl)),
  };
  const attached = patchInstance(removed, id, { attachedTo: host });
  return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
}
/** Relabels the first cards of the active encounter deck as `codes`, in order. */
function stageTop(s: GameState, ...wanted: readonly string[]): GameState {
  const deck = s.encounterDecks[activeEncounterDeckId(s)]!.deck;
  return wanted.reduce<GameState>(
    (st, code, n) => patchInstance(st, deck[n]!, { cardId: cardId(code), faceup: false }),
    s,
  );
}
/** Surgery: the top of `p`'s deck, in order, above the rest. */
function stackDeck(s: GameState, p: PlayerId, ...wanted: readonly string[]): GameState {
  const owner = playerOf(s, p);
  const used: InstanceId[] = [];
  for (const code of wanted) {
    const id = [...owner.deck, ...owner.discard, ...owner.hand].find((c) => codeOf(s, c) === code && !used.includes(c));
    if (!id) throw new Error(`no ${code}`);
    used.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((i) => !used.includes(i));
  const takenFromHand = owner.hand.length - strip(owner.hand).length;
  const rest = [...strip(owner.deck), ...strip(owner.discard)];
  const refill = rest.slice(rest.length - takenFromHand);
  return {
    ...s,
    players: s.players.map((pl) =>
      pl.playerId === p
        ? {
            ...pl,
            deck: [...used, ...rest.slice(0, rest.length - takenFromHand)],
            discard: [],
            hand: [...strip(owner.hand), ...refill],
          }
        : pl,
    ),
  };
}
const basicAttack = (s: GameState, target: InstanceId, p: PlayerId = P1): Command =>
  ({ type: "basicAttack", playerId: p, attackerInstanceId: identityOf(s, p), targetInstanceId: target }) as never;
const basicThwart = (s: GameState, scheme: InstanceId, p: PlayerId = P1): Command =>
  ({ type: "basicThwart", playerId: p, thwarterInstanceId: identityOf(s, p), schemeInstanceId: scheme }) as never;
const readied = (s: GameState, p: PlayerId = P1): GameState => patchInstance(s, identityOf(s, p), { exhausted: false });

/** Accepts the offered optional triggers of these cards (by card code) or ability ids; else the first legal answer. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id.endsWith(w) || s.instances[id.split(":")[0]!]?.cardId === w));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(s);
  };
/** Chooses these targets or cards whenever they are offered. */
const taking =
  (...ids: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    const hits = choice ? ids.filter((id) => choice.options.some((o) => o.optionId === id)) : [];
    return choice && hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(s);
  };
/** Chooses `option` by label text, spends these hand cards, else defers to `inner`. */
const answering =
  (inner: Picker, o: { label?: string; spend?: readonly InstanceId[] }): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption" && o.label) {
      const hit = choice.options.find((x) => x.label.includes(o.label!));
      if (hit) return [hit.optionId];
    }
    if (choice?.prompt.kind === "spendResources" && o.spend) {
      const hits = o.spend.map((id) => `hand:${id}`).filter((id) => choice.options.some((x) => x.optionId === id));
      if (hits.length > 0) return hits;
    }
    return inner(s);
  };
/** Declines every defense except the `n`th prompt (1-based), where `who` defends. */
const defendOnPrompt = (n: number, who: InstanceId): Picker => {
  let seen = 0;
  return (s) => {
    if (s.pendingChoice?.prompt.kind !== "declareDefender") return firstLegal(s);
    seen += 1;
    return seen === n ? [who] : ["decline"];
  };
};
const declineDefender: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);

/** Magneto ends his turn; it becomes the other player's turn (hero form, staging). */
function secondPlayersTurn(s: GameState): GameState {
  const next = driveEventsPicking(DEPS, s, firstLegal, endTurn(P1)).state;
  return withForm(next, { heroForm: 0 }, P2);
}
/** Every player ends their turn in order; the villain phase runs with the picker. */
function villainPhase(s: GameState, pick: Picker = declineDefender) {
  const ids = s.players.map((p) => p.playerId);
  const first = s.step.phase === "player" && s.step.kind === "turn" ? s.step.activePlayerId : ids[0]!;
  const at = ids.indexOf(first);
  const order = [...ids.slice(at), ...ids.slice(0, at)];
  return driveEventsPicking(DEPS, s, pick, ...order.map((id) => endTurn(id)));
}
const activations = (events: readonly GameEvent[], minion: InstanceId): number =>
  events.filter((e) => e.type === "enemyActivated" && e.enemyInstanceId === minion).length;
const hitsBy = (events: readonly GameEvent[], source: InstanceId): number =>
  events.filter((e) => e.type === "damageDealt" && e.sourceInstanceId === source).length;

// ---------------------------------------------------------------------------
// Wrapped in Metal (49007)
// ---------------------------------------------------------------------------
describe("Wrapped in Metal (49007): Hero form only. Attach to a non-ELITE minion. Cannot activate; printed text box blank", () => {
  it("played for real: a non-ELITE minion takes it; an ELITE minion, the villain and alter-ego form are refused (card data enforced by the engine)", () => {
    const base = withMinion(heroGame(), MERCENARY);
    const elite = withMinion(base.state, SANDMAN);
    const given = moveToHand(elite.state, P1, WRAPPED);
    const id = given.ids[0]!;
    const pay = payers(given.state, P1, 2, [id]);
    const onTo = (target: InstanceId, s = given.state) =>
      accepted(s, play(P1, id, pay, { attachToInstanceId: target }));
    expect(onTo(base.minion)).toBe(true);
    expect(onTo(elite.minion)).toBe(false);
    expect(onTo(villainOf(given.state))).toBe(false);
    expect(onTo(base.minion, withForm(given.state, "alterEgo"))).toBe(false);
  });

  it("blank text box: Fabian Cortez loses Guard (the villain can be attacked) and his When Defeated; both return when Wrapped leaves", () => {
    const { state, minion } = withMinion(heroGame(), FABIAN);
    const villain = villainOf(state);
    expect(accepted(state, basicAttack(state, villain))).toBe(false); // Guard
    const wrapped = attachFromHand(state, WRAPPED, minion);
    expect(keywordsOf(wrapped.state, minion, DEPS).map((k) => k.name)).toEqual([]);
    expect(accepted(wrapped.state, basicAttack(wrapped.state, villain))).toBe(true);
    // Defeated while wrapped: no When Defeated, so the only card in the discard pile is Wrapped in Metal itself.
    const dead = defeatWithAttack(DEPS, wrapped.state, minion);
    expect(discardOf(dead)).toEqual([WRAPPED]);
    // Wrapped leaves play (surgery): the printed text is back, Guard included.
    const freed = patchInstance(patchInstance(wrapped.state, wrapped.id, { attachedTo: null }), minion, {
      attachments: [],
    });
    expect(keywordsOf(freed, minion, DEPS).map((k) => k.name)).toEqual(["guard"]);
    expect(accepted(freed, basicAttack(freed, villain))).toBe(false);
    const freedDead = defeatWithAttack(DEPS, freed, minion);
    expect(discardOf(freedDead)).toHaveLength(4);
  });

  it("blank text box: Sebastian Shaw's Forced Response is gone, so an attack on him gives no boost card and does not bar a second attack", () => {
    const { state, minion } = withMinion(heroGame(), SHAW);
    const control = driveEventsPicking(DEPS, state, firstLegal, basicAttack(state, minion)).state;
    expect(inst(control, minion).boostCards).toHaveLength(1); // unwrapped: the response works
    expect(accepted(readied(control), basicAttack(control, minion))).toBe(false);
    const wrapped = attachFromHand(state, WRAPPED, minion);
    const hit = driveEventsPicking(DEPS, wrapped.state, firstLegal, basicAttack(wrapped.state, minion)).state;
    expect(inst(hit, minion).damage).toBe(2);
    expect(inst(hit, minion).boostCards).toHaveLength(0);
    expect(accepted(readied(hit), basicAttack(hit, minion))).toBe(true);
  });

  it("cannot activate: a wrapped minion skips its activation and resumes it after Wrapped leaves", () => {
    const { state, minion } = withMinion(heroGame(), MERCENARY);
    const wrapped = attachFromHand(state, WRAPPED, minion);
    expect(activations(villainPhase(wrapped.state).events, minion)).toBe(0);
    const freed = patchInstance(patchInstance(wrapped.state, wrapped.id, { attachedTo: null }), minion, {
      attachments: [],
    });
    expect(activations(villainPhase(freed).events, minion)).toBeGreaterThan(0);
  });

  it("two players: Wrapped on a minion engaged with the other player stops its activation against that player", () => {
    const { state, minion } = withMinion(heroGame(true), MERCENARY, P2);
    const wrapped = attachFromHand(state, WRAPPED, minion);
    expect(activations(villainPhase(wrapped.state).events, minion)).toBe(0);
    expect(activations(villainPhase(state).events, minion)).toBeGreaterThan(0);
  });

  it("Angry Acolyte: a wrapped Acolyte minion does not activate, so the 'none activated' branch finds and reveals another", () => {
    const base = withMinion(heroGame(), FRENZY);
    const wrapped = attachFromHand(base.state, WRAPPED, base.minion);
    // Villain boost card, Frenzy is wrapped (no boost card), the player's reveal, then fillers and Fabian Cortez.
    const s0 = stageTop(wrapped.state, ADVANCE, ACOLYTE_TREACHERY, ADVANCE, FABIAN);
    const result = villainPhase(s0);
    const inPlay = playerOf(result.state, P1).playArea.map((i) => codeOf(result.state, i));
    expect(hitsBy(result.events, base.minion)).toBe(0);
    expect(inPlay).toContain(FABIAN);
  });
});

describe("Magnetic Missile (49010) with Wrapped in Metal on another player's minion", () => {
  it("any player's wrapped minion will do: it is discarded, the villain takes 5 and is stunned", () => {
    const { state, minion } = withMinion(heroGame(true), MERCENARY, P2);
    const wrapped = attachFromHand(state, WRAPPED, minion, P1);
    const villain = villainOf(state);
    const run = cast(wrapped.state, MISSILE, 1, taking(minion, villain));
    expect(run.state.players.some((p) => p.playArea.includes(minion))).toBe(false);
    expect(inst(run.state, villain).damage).toBe(5);
    expect(inst(run.state, villain).statuses.stunned).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Magneto's Armor (49004), Bubble (49006), Helmet (49003)
// ---------------------------------------------------------------------------
describe("Magneto's Armor (49004): icons of a resource card discarded by the Pull", () => {
  it("Master of Magnetism (energy and mental) found by the Pull counts for both: +1 THW and +1 DEF, no ATK", () => {
    const s0 = heroGame();
    const armed = attachFromHand(s0, ARMOR, identityOf(s0)).state;
    const s1 = stackDeck(armed, P1, MASTER);
    const hero = identityOf(s1);
    const { state } = driveEventsPicking(DEPS, s1, accepting(ARMOR), use(P1, hero, PULL));
    expect(statBonus(state, DEPS, hero, "thw")).toBe(1);
    expect(statBonus(state, DEPS, hero, "def")).toBe(1);
    expect(statBonus(state, DEPS, hero, "atk")).toBe(0);
  });
});

describe("Magnetic Bubble (49006): Magneto gains retaliate 1", () => {
  it("RRG 'Retaliate X': an enemy that attacks Magneto takes 1 damage even though the Bubble absorbed all of its damage", () => {
    const s0 = heroGame();
    const { state: armed, id: bubble } = attachFromHand(s0, BUBBLE, identityOf(s0));
    const { state, minion } = withMinion(armed, MERCENARY);
    const result = villainPhase(state);
    expect(inst(result.state, bubble).damage).toBeGreaterThan(0);
    expect(inst(result.state, identityOf(result.state)).damage).toBe(0);
    expect(inst(result.state, minion).damage).toBe(1);
  });

  it("RRG Q&A (Black Panther): when an ally defends, Magneto himself was not attacked, so there is no retaliate from him", () => {
    const s0 = heroGame();
    const { state: armed } = attachFromHand(s0, BUBBLE, identityOf(s0));
    const withAlly = cast(armed, KID_OMEGA, 2).state;
    const ally = playerOf(withAlly, P1).playArea.find((i) => codeOf(withAlly, i) === KID_OMEGA)!;
    const { state, minion } = withMinion(withAlly, MERCENARY);
    // Rhino attacks first (undefended), then the minion: the ally defends the second attack.
    const result = villainPhase(state, defendOnPrompt(2, ally));
    expect(hitsBy(result.events, minion)).toBe(1);
    expect(inst(result.state, minion).damage).toBe(0);
  });
});

describe("Magneto's Helmet (49003): Magneto gains steady; Stun, Stunned (RRG 1.8)", () => {
  const withStun = (s: GameState, n: number) =>
    patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, stunned: n } });
  it("control: one stunned card cancels a Metal Shards attack, is discarded, and the event is spent", () => {
    const s0 = withStun(heroGame(), 1);
    const villain = villainOf(s0);
    const run = cast(s0, SHARDS, 3, taking(villain));
    expect(inst(run.state, villain).damage).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
    expect(discardOf(run.state)).toContain(SHARDS);
  });
  it("steady: one stunned card does not resolve, so the Shards attack goes through and the card stays", () => {
    const s0 = heroGame();
    const armed = withStun(attachFromHand(s0, HELMET, identityOf(s0)).state, 1);
    const villain = villainOf(armed);
    const run = cast(armed, SHARDS, 3, taking(villain));
    expect(inst(run.state, villain).damage).toBe(7);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(1);
  });
  it("steady: two stunned cards resolve, the attack is canceled and each stunned card is removed", () => {
    const s0 = heroGame();
    const armed = withStun(attachFromHand(s0, HELMET, identityOf(s0)).state, 2);
    const villain = villainOf(armed);
    const run = cast(armed, SHARDS, 3, taking(villain));
    expect(inst(run.state, villain).damage).toBe(0);
    expect(inst(run.state, identityOf(run.state)).statuses.stunned).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Nemesis set, two players
// ---------------------------------------------------------------------------
describe("Nemesis set with two players: 'the defeating player' and 'you' are the player concerned, not Magneto's", () => {
  it("Fabian Cortez defeated by the other player: that player's deck loses the top 4, Magneto's is untouched", () => {
    const base = withMinion(heroGame(true), FABIAN, P2);
    const state = secondPlayersTurn(base.state);
    const minion = base.minion;
    const before = discardOf(state, P1).length;
    const top4 = playerOf(state, P2).deck.slice(0, 4);
    const after = defeatWithAttack(DEPS, state, minion, P2);
    expect(playerOf(after, P2).discard).toEqual(expect.arrayContaining(top4));
    expect(discardOf(after, P2)).toHaveLength(4);
    expect(discardOf(after, P1)).toHaveLength(before);
  });

  it("Martyr for Mutants defeated by the other player's thwart: that player discards the top 9", () => {
    const s0 = heroGame(true);
    const id = s0.players.flatMap((p) => p.setAside).find((i) => codeOf(s0, i) === MARTYR);
    if (!id) throw new Error("Martyr is not set aside");
    const placed = patchInstance(
      {
        ...s0,
        players: s0.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
        villainArea: [...s0.villainArea, id],
      },
      id,
      { faceup: true, threat: 1 },
    );
    const turn2 = secondPlayersTurn(placed);
    const top9 = playerOf(turn2, P2).deck.slice(0, 9);
    const after = driveEventsPicking(DEPS, turn2, firstLegal, basicThwart(turn2, id, P2)).state;
    expect(discardOf(after, P2)).toHaveLength(9);
    expect(playerOf(after, P2).discard).toEqual(expect.arrayContaining(top9));
    expect(discardOf(after, P1)).toHaveLength(0);
  });

  it("Frenzy engaged with the other player: her Forced Response discards 2 from that player's deck only", () => {
    const control = withMinion(heroGame(true), MERCENARY, P2);
    const frenzy = withMinion(heroGame(true), FRENZY, P2);
    const stack = (s: GameState) => stageTop(s, ADVANCE, ADVANCE, ADVANCE, ADVANCE, ADVANCE);
    const a = villainPhase(stack(control.state)).state;
    const b = villainPhase(stack(frenzy.state)).state;
    expect(discardOf(b, P2).length - discardOf(a, P2).length).toBe(2);
    expect(discardOf(b, P1).length - discardOf(a, P1).length).toBe(0);
  });

  it("Frenzy's Forced Response is 'after Frenzy attacks you': it still triggers when an ally defends (December 17, 2025 - Ruling 3)", () => {
    const s0 = heroGame();
    const withAlly = cast(s0, KID_OMEGA, 2).state;
    const ally = playerOf(withAlly, P1).playArea.find((i) => codeOf(withAlly, i) === KID_OMEGA)!;
    const stage = (s: GameState) => stageTop(s, ADVANCE, ADVANCE, ADVANCE, ADVANCE);
    // Rhino attacks first (undefended), then the minion: the ally defends the second attack. A Hydra Mercenary stands in
    // as the control (no Forced Response); the deck is 2 cards shorter with Frenzy.
    const frenzy = villainPhase(stage(withMinion(withAlly, FRENZY).state), defendOnPrompt(2, ally)).state;
    const control = villainPhase(stage(withMinion(withAlly, MERCENARY).state), defendOnPrompt(2, ally)).state;
    expect(playerOf(control, P1).deck.length - playerOf(frenzy, P1).deck.length).toBe(2);
  });

  it("Angry Acolyte: an ACOLYTE engaged with the other player activates against that player (Frenzy hits twice, 2+2 cards)", () => {
    const frenzy = withMinion(heroGame(true), FRENZY, P2);
    const control = withMinion(heroGame(true), MERCENARY, P2);
    // Villain boosts (two activations), Frenzy's boost, then P1's reveal (Acolyte) and P2's reveal, a Fabian to stay put.
    const stack = (s: GameState) => stageTop(s, ADVANCE, ADVANCE, ADVANCE, ACOLYTE_TREACHERY, ADVANCE, FABIAN);
    const result = villainPhase(stack(frenzy.state));
    const base = villainPhase(stack(control.state));
    expect(hitsBy(result.events, frenzy.minion)).toBe(2);
    expect(discardOf(result.state, P2).length - discardOf(base.state, P2).length).toBe(4);
    expect(playerOf(result.state, P1).playArea.map((i) => codeOf(result.state, i))).not.toContain(FABIAN);
  });
});

// ---------------------------------------------------------------------------
// Aspect and basic cards with "each", "any player", "another"
// ---------------------------------------------------------------------------
describe("Aspect and basic cards, two players", () => {
  it("Kid Omega (energy): 1 damage to each enemy, a minion engaged with the other player included", () => {
    const s0 = heroGame(true);
    const { state, minion } = withMinion(s0, MERCENARY, P2);
    const staged = moveToHand(state, P1, KID_OMEGA, "49024").state;
    const energy = playerOf(staged, P1).hand.find((i) => codeOf(staged, i) === "49024")!;
    const pick = answering(accepting("kid-omega-response"), { label: "energy", spend: [energy] });
    const run = cast(staged, KID_OMEGA, 2, pick, { hold: [energy] });
    expect(inst(run.state, minion).damage).toBe(1);
    expect(inst(run.state, villainOf(run.state)).damage).toBe(1);
  });

  it("Kid Omega (mental): 1 threat from each scheme, the main scheme and a side scheme alike", () => {
    const s0 = patchInstance(heroGame(true), heroGame(true).mainScheme.instanceId, { threat: 6 });
    const staged = moveToHand(s0, P1, KID_OMEGA, "49025").state;
    const mental = playerOf(staged, P1).hand.find((i) => codeOf(staged, i) === "49025")!;
    const pick = answering(accepting("kid-omega-response"), { label: "mental", spend: [mental] });
    const run = cast(staged, KID_OMEGA, 2, pick, { hold: [mental] });
    expect(inst(run.state, run.state.mainScheme.instanceId).threat).toBe(5);
  });

  it("M: may defeat a minion engaged with the other player (fewer remaining hit points than her 4)", () => {
    const { state, minion } = withMinion(heroGame(true), MERCENARY, P2);
    const run = cast(state, M_ALLY, 4, accepting("m-response"));
    expect(run.state.players.some((p) => p.playArea.includes(minion))).toBe(false);
  });

  it("White Queen: may discard a status card from the other player's hero", () => {
    const s0 = heroGame(true);
    const spider = identityOf(s0, P2);
    const stunned = patchInstance(s0, spider, { statuses: { ...inst(s0, spider).statuses, stunned: 1 } });
    const run = cast(stunned, WHITE_QUEEN, 3, accepting("white-queen-response"));
    // Magneto is MUTANT/X-MEN: he may play her. The Response offers the other hero's stunned card.
    expect(inst(run.state, spider).statuses.stunned).toBe(0);
  });

  it("Squared Off: the discarded minion is put into play engaged with Magneto, not with the other player", () => {
    const s0 = heroGame(true);
    const staged = stageTop(s0, FRENZY);
    const hand = moveToHand(staged, P1, KID_OMEGA);
    const run = cast(hand.state, SQUARED_OFF, 0, firstLegal, { hold: hand.ids });
    const frenzy = Object.values(run.state.instances).find(
      (i) => i.cardId === cardId(FRENZY) && i.engagedWith !== null,
    );
    expect(frenzy?.engagedWith).toBe(P1);
  });
});

// ---------------------------------------------------------------------------
// Electromagnetic Blast (49008): which attachments
// ---------------------------------------------------------------------------
describe("Electromagnetic Blast (49008): 'an attachment' is an encounter attachment, wherever it is attached", () => {
  const SUIT = "01098"; // Armored Rhino Suit, relabeled below
  const SWORD = "48029"; // Azazel's Sword: a Hero Response (scripted with Nightcrawler's nemesis set)
  const deps: EngineDeps = {
    abilities: mergeRegistries(WAVE7_ABILITIES, MAGNETO_ABILITIES, NIGHTCRAWLER_OBLIGATION_NEMESIS),
  };
  /** An encounter-deck copy of Armored Rhino Suit relabeled as the Sword, attached to `host` by surgery. */
  function sword(s: GameState, host: InstanceId): { state: GameState; id: InstanceId } {
    const deckId = activeEncounterDeckId(s);
    const pile = s.encounterDecks[deckId]!;
    const id = pile.deck.find((i) => codeOf(s, i) === SUIT)!;
    const moved: GameState = {
      ...s,
      encounterDecks: { ...s.encounterDecks, [deckId]: { ...pile, deck: pile.deck.filter((i) => i !== id) } },
    };
    const attached = patchInstance(moved, id, { attachedTo: host, faceup: true, cardId: cardId(SWORD) });
    return { state: patchInstance(attached, host, { attachments: [...inst(attached, host).attachments, id] }), id };
  }
  const blastAt = (s: GameState, host: InstanceId) => {
    const scheme = patchInstance(s, s.mainScheme.instanceId, { threat: 3 });
    const armed = sword(scheme, host);
    const given = moveToHand(armed.state, P1, "49008");
    const pay = payers(given.state, P1, 2, given.ids);
    const pick: Picker = taking(armed.id);
    const run = driveEventsPicking(deps, given.state, pick, play(P1, given.ids[0]!, pay));
    return { ...run, sword: armed.id };
  };
  it("the Sword attached to a minion is discarded", () => {
    const { state, minion } = withMinion(heroGame(), MERCENARY);
    const run = blastAt(state, minion);
    expect(inst(run.state, run.sword).attachedTo).toBeNull();
  });
  it("the Sword attached to a hero is discarded too (a hero's own Hero Action or Response attachment is a legal choice)", () => {
    const s = heroGame();
    const run = blastAt(s, identityOf(s));
    expect(inst(run.state, run.sword).attachedTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Face the Past (49022), Metal Shards (49009), Old Grievances (49027): other players
// ---------------------------------------------------------------------------
describe("Face the Past (49022) with two players: 'you cannot attack the villain this phase' binds only you", () => {
  it("Magneto is refused the villain; after his turn the other hero may attack it in the same phase", () => {
    const s0 = heroGame(true);
    const run = cast(s0, "49022", 0);
    expect(accepted(readied(run.state), basicAttack(run.state, villainOf(run.state)))).toBe(false);
    const turn2 = secondPlayersTurn(run.state);
    expect(accepted(turn2, basicAttack(turn2, villainOf(turn2), P2))).toBe(true);
  });
});

describe("Metal Shards (49009) against Sebastian Shaw (49038): a labeled attack is an attack on him", () => {
  it("his tough card absorbs the 7, he is given a boost card, and he cannot be attacked again this phase", () => {
    const { state, minion } = withMinion(heroGame(), SHAW);
    const toughened = patchInstance(state, minion, { statuses: { ...inst(state, minion).statuses, tough: 1 } });
    const run = cast(toughened, SHARDS, 3, taking(minion));
    expect(inst(run.state, minion).damage).toBe(0);
    expect(inst(run.state, minion).boostCards).toHaveLength(1);
    expect(accepted(readied(run.state), basicAttack(run.state, minion))).toBe(false);
  });
});

describe("Old Grievances (49027) with two players: 'Give to the Erik Lehnsherr player'", () => {
  it("revealed by the other player, it goes to Magneto's player and stays in his play area", () => {
    const s0 = heroGame(true);
    const id = Object.values(s0.instances).find((i) => i.cardId === cardId("49027"))?.instanceId;
    if (!id) throw new Error("no Old Grievances in the game");
    const deckId = activeEncounterDeckId(s0);
    const pile = s0.encounterDecks[deckId]!;
    const rest = pile.deck.filter((i) => i !== id);
    // Villain boost for each activation, then P1's card, then P2's: the obligation is the one dealt to P2.
    const ordered: GameState = {
      ...s0,
      encounterDecks: {
        ...s0.encounterDecks,
        [deckId]: { ...pile, deck: [...rest.slice(0, 3), id, ...rest.slice(3)] },
      },
    };
    const staged = stageTop(ordered, ADVANCE, ADVANCE, ADVANCE);
    const result = villainPhase(staged);
    const revealedBy = result.events.find((e) => e.type === "encounterCardRevealed" && e.instanceId === id);
    expect(revealedBy).toMatchObject({ playerId: P2 });
    expect(playerOf(result.state, P1).playArea).toContain(id);
    expect(playerOf(result.state, P2).playArea).not.toContain(id);
  });
});
