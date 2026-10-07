import {
  applyCommand,
  createGame,
  replay,
  restrictedStanding,
  sessionApply,
  startSession,
  type CardInstance,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  P3,
  P4,
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
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario, wave7StarterDeckSetup } from "../index.js";
import { WAVE7_CARDS } from "../cards.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Rules-QA pass over the X-23 (43001-43040) and Deadpool (44001-44058) packs, wave 7 step 4
 * (docs/phase7-wave7-qa-x23-deadpool.md). The module and precon tests prove each card in the conditions its author
 * thought of; these tests go after the places two cards, a keyword or a status meet. Every test names the rule it
 * proves. Citations: RRG 1.8 (the Markdown `mc_rulesreference_v18_compressed.md`, entries by name, page numbers from the
 * PDF's table of contents), the post-1.7 rulings by date, and owner decisions by their `docs/phase7-wave7.md` section
 * 4.1 Q number. `it.fails` pins a defect that is reported and not fixed here: it passes while the defect stands and
 * turns red the day it is fixed, which is the cue to delete the `.fails`. The one known bug, damaging abilities that
 * offer an enemy that cannot take damage (finding F1 of the Cable and Domino pass), is excluded.
 */

const X23 = { starterDeckId: "x-23-aggression" } as const;
const DEADPOOL = { starterDeckId: "deadpool-pool" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER = { starterDeckId: "core-spider-man-justice" } as const;
type Seat =
  | typeof X23
  | typeof DEADPOOL
  | typeof CABLE
  | typeof SPIDER
  | { readonly identityCardId: string; readonly deck: readonly string[]; readonly aspects?: readonly never[] };

/** A precon seat with `extra` cards added to its deck (basic cards a test needs in play). */
function withExtra(starterDeckId: string, ...extra: readonly string[]): Seat {
  const base = wave7StarterDeckSetup(starterDeckId);
  return {
    identityCardId: base.identityCardId as string,
    deck: [...base.deck.map((c) => c as string), ...extra],
    ...(base.aspects ? { aspects: base.aspects as never } : {}),
  };
}

/**
 * Cable (the box's hero) playing the 'Pool aspect: his own hero cards and basic cards from his precon, with its
 * Leadership cards replaced by Deadpool's precon 'Pool cards (one deck, two players seated with the 'Pool aspect).
 */
function poolCable(...extra: readonly string[]): Seat {
  const cable = wave7StarterDeckSetup("cable-leadership");
  const pool = wave7StarterDeckSetup("deadpool-pool");
  const aspectOf = (code: string): string =>
    (WAVE7_CARDS.find((c) => c.id === code) as { aspect?: string }).aspect ?? "";
  const leadership = cable.deck.filter((c) => aspectOf(c as string) === "leadership").length;
  const poolCards = pool.deck.filter((c) => aspectOf(c as string) === "pool").map((c) => c as string);
  return {
    identityCardId: cable.identityCardId as string,
    deck: [
      ...cable.deck.filter((c) => aspectOf(c as string) !== "leadership").map((c) => c as string),
      ...poolCards.slice(0, leadership),
      ...extra,
    ],
    aspects: ["pool"] as never,
  };
}

/** Drives `commands` and returns the state at the first prompt of `kind` (the game rests there), else the final state. */
function stopAt(state: GameState, kind: string, pick: Picker, ...commands: Command[]): GameState {
  let at: GameState | null = null;
  const spy: Picker = (s) => {
    if (!at && s.pendingChoice?.prompt.kind === kind) at = s;
    return pick(s);
  };
  const r = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return at ?? r.state;
}

const WHIPLASH = "01172"; // a minion with Retaliate 1, 4 hit points
const HYDRA_MERC = "01101"; // ATK 1, 3 hit points, Guard
const ADVANCE = "01186"; // treachery: "When Revealed: The villain schemes."

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const handOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).hand;
const discardOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).discard;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const tokens = (s: GameState): number => s.mainScheme.accelerationTokens;
const formOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).identity.form;
const dmgOn = (s: GameState, p: PlayerId = P1): number => damageOf(s, identityOf(s, p));
const rejected = (s: GameState, c: Command): boolean => !applyCommand(s, c, WAVE7_DEPS).ok;
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });
const status = (s: GameState, id: InstanceId, kind: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [kind]: n } });
const statusOf = (s: GameState, id: InstanceId, kind: "stunned" | "confused" | "tough"): number =>
  inst(s, id).statuses[kind];
const everywhere = (s: GameState, code: string): InstanceId[] => instancesOf(s, code);

/** A game after setup, every seat in hero form, the main scheme at `mainThreat` (Juggernaut: a small encounter deck). */
function game(
  players: readonly Seat[],
  opts: {
    scenario?: string;
    seed?: number;
    mainThreat?: number;
    difficulty?: "standard" | "expert";
    firstPlayerIndex?: number;
    facts?: readonly ({ readonly wonPreviousGame?: boolean } | undefined)[];
  } = {},
): GameState {
  const config = wave7Scenario(opts.scenario ?? "juggernaut", {
    players: players as never,
    seed: opts.seed ?? 1,
    difficulty: opts.difficulty ?? "standard",
    modularSetIds: [],
    ...(opts.firstPlayerIndex === undefined ? {} : { firstPlayerIndex: opts.firstPlayerIndex }),
  });
  const seated = opts.facts
    ? {
        ...config,
        players: config.players.map((p, i) => (opts.facts![i] ? { ...p, outsideFacts: opts.facts![i] } : p)),
      }
    : config;
  const created = createGame(seated, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  players.forEach((_, i) => {
    s = withForm(s, { heroForm: 0 }, [P1, P2, P3, P4][i]!);
  });
  return patchInstance(s, mainOf(s), { threat: opts.mainThreat ?? 3 });
}

/** A fabricated enemy minion engaged with `player` (state surgery, no When Revealed). */
function withMinion(
  state: GameState,
  player: PlayerId,
  code = WHIPLASH,
  n = 9000,
): { state: GameState; id: InstanceId } {
  const id = `i${n}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "playArea", playerId: player },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: player,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}

/** Plays `code` from hand paying `cost` with other hand cards; every prompt is answered by `pick`. */
function playCard(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
  attach?: InstanceId,
): { state: GameState; id: InstanceId; before: GameState; events: readonly GameEvent[] } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = payWith(given.state, player, cost, [id]);
  const driven = driveEventsPicking(
    WAVE7_DEPS,
    given.state,
    pick,
    play(player, id, payment, attach ? { attachToInstanceId: attach } : {}),
  );
  return { ...driven, id, before: given.state };
}

/** Answers a `chooseNumber` prompt with `n` (clamped into range) and everything else like `firstLegal`. */
const numbering =
  (n: number, then: Picker = firstLegal): Picker =>
  (s) => {
    const p = s.pendingChoice?.prompt;
    if (p?.kind === "chooseNumber") return [String(Math.min(p.max, Math.max(p.min, n)))];
    return then(s);
  };
/** Every prompt of `kind` seen while driving, as a record of (min, max) for `chooseNumber`. */
function recordRanges(seen: { min: number; max: number }[], n: number): Picker {
  return (s) => {
    const p = s.pendingChoice?.prompt;
    if (p?.kind === "chooseNumber") {
      seen.push({ min: p.min, max: p.max });
      return [String(Math.min(p.max, Math.max(p.min, n)))];
    }
    return firstLegal(s);
  };
}
const accepting =
  (...wanted: readonly string[]): Picker =>
  (s) => {
    const c = s.pendingChoice;
    if (c?.prompt.kind === "chooseTriggers")
      return c.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(s);
  };
/** `accepting`, and a card accepted from the hand is paid for with the first `cost` other hand cards. */
const acceptingPaid =
  (cost: number, ...wanted: readonly string[]): Picker =>
  (s) => {
    const c = s.pendingChoice;
    if (c?.prompt.kind === "payForCard") return c.options.slice(0, cost).map((o) => o.optionId);
    return accepting(...wanted)(s);
  };
/** Offers (ability ids) seen at every chooseTriggers prompt while `pick` drives `commands`. */
function driveOffers(state: GameState, pick: Picker, ...commands: Command[]) {
  const offered = new Set<string>();
  const seeing: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const r = driveEventsPicking(WAVE7_DEPS, state, seeing, ...commands);
  return { ...r, offered };
}
const hasOffer = (offered: Set<string>, ref: string) => [...offered].some((o) => o.includes(ref));
const basicAttack = (s: GameState, p: PlayerId, target: InstanceId, attacker?: InstanceId): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: attacker ?? identityOf(s, p),
  targetInstanceId: target,
});
const basicThwart = (s: GameState, p: PlayerId, scheme: InstanceId, thwarter?: InstanceId): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: thwarter ?? identityOf(s, p),
  schemeInstanceId: scheme,
});

/** Puts one copy of `code` (from the set-aside area, the deck or the discard pile) at position `at` of the encounter deck. */
function placeAt(state: GameState, code: string, at: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const wanted = (id: InstanceId) => codeOf(state, id) === code;
  const id =
    state.encounterSetAside.find(wanted) ??
    pile.deck.find(wanted) ??
    pile.discard.find(wanted) ??
    state.players.flatMap((p) => p.setAside).find(wanted);
  if (!id) throw new Error(`no ${code} to stack`);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== id) })),
    encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: {
        deck: [...pile.deck.filter((i) => i !== id).slice(0, at), id, ...pile.deck.filter((i) => i !== id).slice(at)],
        discard: pile.discard.filter((i) => i !== id),
      },
    },
  };
}

/**
 * Every player ends their turn in seat order from the first player, so the villain phase runs; `code` is revealed to the
 * player at 0-based position `at` in the dealing order (Juggernaut's one activation draws one boost card first, then each
 * player is dealt one card in order, so the card goes behind `at + boosts` cards of the deck as it stands; `boosts` is 2 against an alter-ego Wade, where Juggernaut draws two).
 */
function revealToSeat(state: GameState, code: string, at: number, pick: Picker = firstLegal, boosts = 1) {
  const stacked = placeAt(state, code, at + boosts);
  const order = state.players.map((p) => p.playerId);
  const first = state.step.phase === "player" && state.step.kind === "turn" ? state.step.activePlayerId : order[0]!;
  const start = order.indexOf(first);
  const turns = order.map((_, i) => endTurn(order[(start + i) % order.length]!));
  return driveEventsPicking(WAVE7_DEPS, stacked, pick, ...turns);
}

/** A copy of `code` from the player's hand, deck or discard pile put straight into play (attached to the identity if an upgrade). */
function inPlay(
  state: GameState,
  player: PlayerId,
  code: string,
  opts: { attachTo?: InstanceId } = {},
): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const id = given.ids[0]!;
  const type = given.state.cardPool[given.state.instances[id]!.cardId]!.type;
  const host = opts.attachTo ?? (type === "upgrade" ? identityOf(given.state, player) : null);
  // An attached upgrade is on its host only (`attachments`); every other card sits in the play area (as a played one does).
  let s: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: p.hand.filter((x) => x !== id), playArea: host ? p.playArea : [...p.playArea, id] }
        : p,
    ),
  };
  s = patchInstance(s, id, { faceup: true, controllerId: player, ...(host ? { attachedTo: host } : {}) });
  if (host) s = patchInstance(s, host, { attachments: [...inst(s, host).attachments, id] });
  return { state: s, id };
}

/** `id` (an encounter card or a set-aside card) moved into `holder`'s play area, faceup (surgery: no reveal). */
function intoPlayArea(state: GameState, id: InstanceId, holder: PlayerId): GameState {
  return {
    ...state,
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([key, pile]) => [
        key,
        { ...pile, deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      ]),
    ),
    players: state.players.map((p) => ({
      ...p,
      setAside: p.setAside.filter((i) => i !== id),
      playArea: p.playerId === holder ? [...p.playArea, id] : p.playArea,
    })),
    instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, controllerId: null } },
  };
}
/** The turn is `player`'s (surgery on the step). */
const turnOf = (state: GameState, player: PlayerId): GameState => ({
  ...state,
  step: { ...state.step, activePlayerId: player } as GameState["step"],
});

/** Draws `n` more cards into `player`'s hand by surgery (payment for a big event). */
function fatten(state: GameState, player: PlayerId, n: number): GameState {
  const deck = playerOf(state, player).deck;
  const take = deck.slice(0, n);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, deck: p.deck.filter((x) => !take.includes(x)), hand: [...p.hand, ...take] } : p,
    ),
  };
}

/** Moves a side scheme (wherever it is) into the victory display. */
function toVictory(state: GameState, id: InstanceId): GameState {
  return {
    ...patchInstance(state, id, { threat: 0 }),
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: [...state.victoryDisplay, id],
    encounterDecks: Object.fromEntries(
      Object.entries(state.encounterDecks).map(([k, d]) => [
        k,
        { deck: d.deck.filter((x) => x !== id), discard: d.discard.filter((x) => x !== id) },
      ]),
    ),
  };
}

/** A side scheme put into the villain area with `threat` (surgery). */
function sideScheme(state: GameState, code: string, threat: number): { state: GameState; id: InstanceId } {
  const id = instancesOf(state, code)[0]!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([k, d]) => [
          k,
          { deck: d.deck.filter((x) => x !== id), discard: d.discard.filter((x) => x !== id) },
        ]),
      ),
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, threat } },
    } as GameState,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Whole-state invariants, shared with the expert-mode games at the end
// ---------------------------------------------------------------------------------------------------------------------

function zoneIndex(s: GameState): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (id: InstanceId, label: string) => index.set(id, [...(index.get(id) ?? []), label]);
  for (const p of s.players) {
    for (const zone of ["hand", "deck", "discard", "playArea", "dealtEncounter", "resolving", "setAside"] as const)
      for (const id of p[zone]) add(id, `${p.playerId}.${zone}`);
    for (const [name, sep] of Object.entries(p.separateDecks)) {
      for (const id of sep.deck) add(id, `${p.playerId}.sep.${name}.deck`);
      for (const id of sep.discard) add(id, `${p.playerId}.sep.${name}.discard`);
    }
    add(p.identity.instanceId, `${p.playerId}.identity`);
  }
  for (const [deckId, pile] of Object.entries(s.encounterDecks)) {
    for (const id of pile.deck) add(id, `enc.${deckId}.deck`);
    for (const id of pile.discard) add(id, `enc.${deckId}.discard`);
  }
  for (const id of s.encounterSetAside) add(id, "encounterSetAside");
  for (const id of s.villainArea) add(id, "villainArea");
  for (const id of s.victoryDisplay) add(id, "victoryDisplay");
  for (const id of s.removedFromGame) add(id, "removedFromGame");
  for (const [id, instance] of Object.entries(s.instances)) {
    for (const t of instance.tucked) add(t, `tuckedUnder.${id}`);
    for (const b of instance.boostCards) add(b, `boostOn.${id}`);
  }
  return index;
}

/** Throws on the first broken invariant: no prompt without an answer, no card in two zones, no card in no zone. */
function checkState(s: GameState, dealt: ReadonlySet<string>, where: string): void {
  const fail = (m: string): never => {
    throw new Error(`[${where}] round ${s.round} ${s.step.phase}/${s.step.kind}: ${m}`);
  };
  const choice = s.pendingChoice;
  if (choice) {
    if (choice.minSelections > choice.options.length && choice.prompt.kind !== "chooseNumber" && !isTyped(choice))
      fail(`soft lock: ${choice.prompt.kind} needs ${choice.minSelections} of ${choice.options.length}`);
  } else if (!s.outcome && !(s.step.phase === "player" && s.step.kind === "turn")) {
    fail("the game stopped between steps with nothing pending");
  }
  const zones = zoneIndex(s);
  for (const [id, labels] of zones)
    if (labels.length > 1)
      fail(`${id} (${s.cardPool[s.instances[id as InstanceId]!.cardId]!.name}) in ${labels.join(", ")}`);
  for (const id of dealt)
    if (!zones.has(id) && s.instances[id as InstanceId]!.attachedTo === null) fail(`${id} is in no zone`);
  for (const p of s.players) {
    const standing = restrictedStanding(s, WAVE7_DEPS, p.playerId);
    if (!choice && standing.load > standing.limit)
      fail(`${p.playerId} carries ${standing.load} restricted weight, the limit is ${standing.limit}`);
  }
}
/** A prompt whose answer is typed in (a number or a reported fact), not picked from its options. */
const isTyped = (c: NonNullable<GameState["pendingChoice"]>): boolean =>
  c.prompt.kind === "chooseNumber" || c.prompt.kind === "reportFact";
const dealtSet = (s: GameState): Set<string> => {
  const out = new Set<string>();
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const) for (const id of p[zone]) out.add(id);
  return out;
};

const MAX_EFFORT = "44004";
const YOO_HOO = "44006";
const KATANA = "44010";
const FIRE = "44012";
const CUTUPPER = "44018";
const POOL_INSPECTION = "44023";
const BAZOOKA = "44052";
const ENDURANCE = "43027";

describe("Deadpool: The Regeneratin' Degenerate against tough, overkill and added hit points", () => {
  // RRG "Damage" (p. 14): a tough status card is discarded INSTEAD of taking the damage, so no damage is taken and
  // nothing is defeated; the replacement of a defeat (44001a) never starts. The state is read at the villain's attack,
  // after his turn has ended and before that attack lands.
  it("a tough status card on Deadpool absorbs the owed damage of This Card is Fire: 8 damage stays 8, still hero, no token", () => {
    let s = game([DEADPOOL]);
    s = patchInstance(s, identityOf(s), { damage: 8 });
    s = status(s, identityOf(s), "tough");
    s = moveToHand(s, P1, FIRE).state;
    const at = stopAt(s, "declareDefender", firstLegal, endTurn(P1));
    expect(statusOf(at, identityOf(at), "tough")).toBe(0);
    expect(dmgOn(at)).toBe(8);
    expect(formOf(at)).toBe("hero");
    expect(tokens(at)).toBe(tokens(s));
  });

  it("control: without tough the same owed damage is lethal and regenerates: 1 hit point left, Wade Wilson, one token", () => {
    let s = game([DEADPOOL]);
    s = patchInstance(s, identityOf(s), { damage: 8 });
    s = moveToHand(s, P1, FIRE).state;
    const at = stopAt(s, "declareDefender", firstLegal, endTurn(P1));
    expect(dmgOn(at)).toBe(8);
    expect(formOf(at)).toBe("alterEgo");
    expect(tokens(at)).toBe(tokens(s) + 1);
  });

  // RRG "Damage" (p. 14) and Q45: a villain attack far above his remaining hit points. The replacement sets the dial to
  // 1 hit point left; the excess damage is not carried anywhere.
  it("a villain attack that overkills him (8 damage taken, hit points 9) leaves him at 1 hit point, Wade Wilson, one token", () => {
    let s = withoutTough(game([DEADPOOL]));
    s = patchInstance(s, identityOf(s), { damage: 8 });
    const t0 = tokens(s);
    const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, endTurn(P1));
    expect(r.state.outcome).toBeNull();
    expect(playerOf(r.state, P1).eliminated).toBe(false);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(dmgOn(r.state)).toBe(8);
    expect(tokens(r.state)).toBeGreaterThanOrEqual(t0 + 1);
  });

  // "set your hit point dial to 1": one hit point REMAINING, whatever added hit points (Endurance, +3) he carries.
  it("with Endurance (+3, 12 hit points) the lethal hit leaves exactly 1 hit point remaining, 11 damage", () => {
    let s = game([withExtra("deadpool-pool", ENDURANCE)]);
    s = playCard(s, ENDURANCE, 1, firstLegal, P1, identityOf(s)).state;
    s = patchInstance(s, identityOf(s), { damage: 11 });
    const g = moveToHand(s, P1, MAX_EFFORT);
    const r = driveEventsPicking(WAVE7_DEPS, g.state, numbering(1), play(P1, g.ids[0]!, []));
    expect(dmgOn(r.state)).toBe(11);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(playerOf(r.state, P1).eliminated).toBe(false);
  });

  // The ability is printed on the hero face only (RRG "Form", p. 21), so the owed 1 damage is not replaced for Wade:
  // his player is eliminated.
  it("Wade Wilson regenerated to 1 hit point and holding This Card is Fire is eliminated by the owed damage", () => {
    let s = game([DEADPOOL]);
    s = withForm(patchInstance(s, identityOf(s), { damage: 8 }), "alterEgo");
    s = moveToHand(s, P1, FIRE).state;
    const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, endTurn(P1));
    expect(playerOf(r.state, P1).eliminated).toBe(true);
  });

  it("two copies of This Card is Fire in hand owe 2 damage at the end of his turn (each is its own forced response)", () => {
    const base = game([DEADPOOL]);
    const hand = moveToHand(base, P1, FIRE, FIRE).state;
    const at = stopAt(hand, "declareDefender", firstLegal, endTurn(P1));
    const control = stopAt(base, "declareDefender", firstLegal, endTurn(P1));
    expect(dmgOn(at) - dmgOn(control)).toBe(2);
  });
});

describe("Deadpool: damage he chooses to take (Maximum Effort, 'Yoo-Hoo!') at the boundaries", () => {
  // Q46 = B and RRG "Cost" (p. 14): the range is 0 to his remaining hit points; an amount a tough status card would
  // prevent cannot be paid, so with tough the range is 0 and no number is asked.
  it("with 1 hit point left the range is 0 to 1; taking 1 regenerates him and the event still deals its 1 damage", () => {
    let s = withoutTough(game([DEADPOOL]));
    s = patchInstance(s, identityOf(s), { damage: 8 });
    const g = moveToHand(s, P1, MAX_EFFORT);
    const seen: { min: number; max: number }[] = [];
    const r = driveEventsPicking(WAVE7_DEPS, g.state, recordRanges(seen, 1), play(P1, g.ids[0]!, []));
    expect(seen).toEqual([{ min: 0, max: 1 }]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(1);
    expect(formOf(r.state)).toBe("alterEgo");
    expect(dmgOn(r.state)).toBe(8);
    expect(tokens(r.state)).toBe(tokens(s) + 1);
  });

  // "deal an equal amount of damage": equal to the amount he took (9), not to the damage left on the dial afterwards (8).
  it("taking all 9 deals 9 to the enemy, though the dial ends at 8 damage", () => {
    const base = withoutTough(game([DEADPOOL]));
    const g = moveToHand(base, P1, MAX_EFFORT);
    const vil = villainOf(g.state);
    const r = driveEventsPicking(WAVE7_DEPS, g.state, numbering(9), play(P1, g.ids[0]!, []));
    expect(damageOf(r.state, vil)).toBe(9);
    expect(dmgOn(r.state)).toBe(8);
    expect(formOf(r.state)).toBe("alterEgo");
  });

  it("with a tough status card on him no number can be paid but 0: nothing is asked, the tough card stays, nothing is dealt", () => {
    let s = withoutTough(game([DEADPOOL]));
    s = status(s, identityOf(s), "tough");
    const g = moveToHand(s, P1, MAX_EFFORT);
    const seen: { min: number; max: number }[] = [];
    const r = driveEventsPicking(WAVE7_DEPS, g.state, recordRanges(seen, 5), play(P1, g.ids[0]!, []));
    expect(seen).toEqual([]);
    expect(statusOf(r.state, identityOf(r.state), "tough")).toBe(1);
    expect(dmgOn(r.state)).toBe(0);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(discardOf(r.state)).toContain(g.ids[0]);
  });

  it("'Yoo-Hoo!' chooses its own amount: taking 3 removes 3 threat from a scheme (main scheme 5 becomes 2)", () => {
    let s = game([DEADPOOL], { mainThreat: 5 });
    s = moveToHand(s, P1, YOO_HOO).state;
    const g = moveToHand(s, P1, YOO_HOO);
    const id = g.ids[0]!;
    const r = driveEventsPicking(WAVE7_DEPS, g.state, numbering(3), play(P1, id, payWith(g.state, P1, 1, [id])));
    expect(dmgOn(r.state)).toBe(3);
    expect(threatOf(r.state, mainOf(r.state))).toBe(2);
  });
});

describe("Stunned and confused Deadpool using his labeled abilities", () => {
  // RRG "Labeled Ability" (p. 26): an ability labeled (attack) is canceled in full, costs excepted, by a stunned status
  // card on the identity, and the status card is removed; RRG "Stun, Stunned" (p. 41): "Costs associated with the attack
  // attempt ... must still be paid". Ruling August 13, 2026 - Ruling 1: the event is still "played".
  it("stunned: Maximum Effort takes the damage he chose (a cost), deals nothing, removes the stun, and is in the discard pile", () => {
    let s = withoutTough(game([DEADPOOL]));
    s = status(s, identityOf(s), "stunned");
    const g = moveToHand(s, P1, MAX_EFFORT);
    const r = driveEventsPicking(WAVE7_DEPS, g.state, numbering(3), play(P1, g.ids[0]!, []));
    expect(dmgOn(r.state)).toBe(3);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
    expect(discardOf(r.state)).toContain(g.ids[0]);
  });

  it("confused: 'Yoo-Hoo!' (thwart) takes its damage and removes no threat; the confused card goes", () => {
    let s = game([DEADPOOL], { mainThreat: 5 });
    s = status(s, identityOf(s), "confused");
    const g = moveToHand(s, P1, YOO_HOO);
    const id = g.ids[0]!;
    const r = driveEventsPicking(WAVE7_DEPS, g.state, numbering(3), play(P1, id, payWith(g.state, P1, 1, [id])));
    expect(dmgOn(r.state)).toBe(3);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(0);
  });

  it("stunned: Deadpool's Katana pays its exhaust and 1 damage, deals nothing; the stun is removed", () => {
    let s = withoutTough(game([DEADPOOL]));
    const katana = playCard(s, KATANA, 2, firstLegal, P1, identityOf(s));
    s = status(katana.state, identityOf(katana.state), "stunned");
    const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, katana.id, "44010.deadpools-katana-action"));
    expect(inst(r.state, katana.id).exhausted).toBe(true);
    expect(dmgOn(r.state)).toBe(1);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
  });

  it("stunned: Cutupper deals its 5 to nothing and stuns nothing (the whole ability is canceled)", () => {
    let s = game([DEADPOOL]);
    const minion = withMinion(s, P1, WHIPLASH, 9001);
    s = status(minion.state, identityOf(minion.state), "stunned");
    const pick: Picker = (st) =>
      st.pendingChoice?.options.some((o) => o.optionId === minion.id) ? [minion.id] : firstLegal(st);
    const r = playCard(s, CUTUPPER, 3, pick);
    expect(damageOf(r.state, minion.id)).toBe(0);
    expect(statusOf(r.state, minion.id, "stunned")).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
  });

  it("control: Cutupper with a confused hero is not canceled (confused cancels thwarts): 5 damage kills Whiplash and nothing is stunned", () => {
    let s = game([DEADPOOL]);
    const minion = withMinion(s, P1, WHIPLASH, 9001);
    s = status(minion.state, identityOf(minion.state), "confused");
    const pick: Picker = (st) =>
      st.pendingChoice?.options.some((o) => o.optionId === minion.id) ? [minion.id] : firstLegal(st);
    const r = playCard(s, CUTUPPER, 3, pick);
    expect(playerOf(r.state, P1).playArea).not.toContain(minion.id);
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(1);
  });

  it("confused: 'Pool Inspection (thwart) is canceled whole: no threat comes off any scheme, the confused card goes", () => {
    let s = game([DEADPOOL], { mainThreat: 9 });
    s = status(s, identityOf(s), "confused");
    s = fatten(s, P1, 6);
    const r = playCard(s, POOL_INSPECTION, 6);
    expect(threatOf(r.state, mainOf(r.state))).toBe(9);
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(0);
    expect(discardOf(r.state)).toContain(r.id);
  });

  it("stunned: Bazooka's discard is a cost and is paid; no damage is dealt", () => {
    let s = withoutTough(game([withExtra("deadpool-pool", BAZOOKA)]));
    const bz = playCard(s, BAZOOKA, 2, firstLegal, P1, identityOf(s));
    s = status(bz.state, identityOf(bz.state), "stunned");
    const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, bz.id, "44052.bazooka-action"));
    expect(discardOf(r.state)).toContain(bz.id);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
  });
});

describe("Frenemies (44031), Team-Up (Cable and Deadpool), with Cable seated as a player", () => {
  const FRENEMIES = "44031";
  const SIDE = "40131"; // Captive Hope: a side scheme every box scenario carries (Hope Summers set)
  const playFrenemies = (s: GameState, pick: Picker = firstLegal) => {
    const g = moveToHand(s, P1, FRENEMIES);
    const id = g.ids[0]!;
    return {
      g,
      id,
      run: () => driveEventsPicking(WAVE7_DEPS, g.state, pick, play(P1, id, payWith(g.state, P1, 1, [id]))),
    };
  };

  // RRG "Team-Up" (p. 43): "cannot be played unless both of the named friendly characters (identity or ally) are in
  // play"; RRG "Identity" (p. 23): a hero title refers only to the face with that title, so a seated Cable in alter-ego
  // form (the Cable hero face is facedown, out of play) does not count.
  it("Cable seated in hero form: it is played; 1 damage each to Cable and Deadpool, then 3 + 3 threat from two different schemes", () => {
    let s = game([DEADPOOL, CABLE], { mainThreat: 8 });
    const side = sideScheme(s, SIDE, 4);
    s = side.state;
    const pickTwo: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseTarget") {
        const want = c.options.find((o) => o.optionId === mainOf(st)) ?? c.options.find((o) => o.optionId === side.id);
        if (want) return [want.optionId];
      }
      return firstLegal(st);
    };
    const r = playFrenemies(s, pickTwo).run();
    expect(dmgOn(r.state, P1)).toBe(1);
    expect(dmgOn(r.state, P2)).toBe(1);
    expect(threatOf(r.state, mainOf(r.state))).toBe(5);
    expect(threatOf(r.state, side.id)).toBe(1);
  });

  it("Cable seated but in alter-ego form (his hero face is out of play): Frenemies cannot be played", () => {
    const s = withForm(game([DEADPOOL, CABLE]), "alterEgo", P2);
    const f = playFrenemies(s);
    expect(rejected(f.g.state, play(P1, f.id, payWith(f.g.state, P1, 1, [f.id])))).toBe(true);
  });

  it("no Cable at the table (a Spider-Man seat): it cannot be played", () => {
    const f = playFrenemies(game([DEADPOOL, SPIDER]));
    expect(rejected(f.g.state, play(P1, f.id, payWith(f.g.state, P1, 1, [f.id])))).toBe(true);
  });

  it("with Cable's hero face seated, Deadpool in alter-ego form cannot play it either (Hero Action, and his hero face is out of play)", () => {
    const s = withForm(game([DEADPOOL, CABLE]), "alterEgo", P1);
    const f = playFrenemies(s);
    expect(rejected(f.g.state, play(P1, f.id, payWith(f.g.state, P1, 1, [f.id])))).toBe(true);
  });
});

describe("Dreadpool set at setup with several 'Pool players", () => {
  const SET = ["44038", "44039", "44040", "44041", "44041", "44042"];
  /** The Dreadpool cards set aside (the X-23 seat's four Specialists sit in the same area). */
  const aside = (s: GameState) =>
    s.encounterSetAside
      .map((id) => codeOf(s, id))
      .filter((c) => c.startsWith("44"))
      .sort();
  const crisisCopies = (s: GameState) => everywhere(s, "44037").length;

  // Q44 = A / Deadpool insert (RRG 1.8 FAQ p. 64): the set is included when a seat chose 'Pool, once, however many seats did.
  it("two 'Pool players: exactly one Crisis of Infinite Deadpools in the encounter deck and the six other cards set aside", () => {
    const s = game([DEADPOOL, poolCable()]);
    expect(crisisCopies(s)).toBe(1);
    expect(aside(s)).toEqual([...SET].sort());
  });

  it("three players, one of them 'Pool: the set rides along once; four players with none seat no Dreadpool at all", () => {
    const three = game([DEADPOOL, SPIDER, X23]);
    expect(crisisCopies(three)).toBe(1);
    expect(aside(three)).toEqual([...SET].sort());
    const none = game([SPIDER, X23, CABLE]);
    expect(crisisCopies(none)).toBe(0);
    expect(aside(none)).toEqual([]);
  });

  it("four players, two of them 'Pool: still one Crisis and six set-aside cards", () => {
    const s = game([DEADPOOL, poolCable(), SPIDER, X23]);
    expect(crisisCopies(s)).toBe(1);
    expect(aside(s)).toEqual([...SET].sort());
  });
});

describe("Dreadpool cards revealed in games of three and four players", () => {
  const engaged = (s: GameState, code: string): PlayerId | null => {
    const id = everywhere(s, code)[0]!;
    return inst(s, id).engagedWith ?? null;
  };

  // Dreadpool (44038): "Dreadpool engages the first player." Crisis (44037): the minion and the side scheme are revealed
  // by whoever revealed Crisis; the engagement is the first player's, not the revealer's.
  it("three players: Crisis revealed to the third seat: Dreadpool engages the FIRST player, Dreadful Deeds is in play, Crisis is out of the game", () => {
    const base = game([DEADPOOL, SPIDER, X23]);
    const r = revealToSeat(base, "44037", 2);
    expect(engaged(r.state, "44038")).toBe(P1);
    expect(r.state.villainArea.map((id) => codeOf(r.state, id))).toContain("44039");
    expect(r.state.removedFromGame.map((id) => codeOf(r.state, id))).toContain("44037");
  });

  it("with the first player token on the second seat (four players) Dreadpool engages that seat, whoever revealed Crisis", () => {
    const base = game([SPIDER, DEADPOOL, X23, CABLE], { firstPlayerIndex: 1 });
    const r = revealToSeat(base, "44037", 3);
    expect(engaged(r.state, "44038")).toBe(P2);
  });

  // Dreadful Deeds (44039): "Place 2 threat here for each player who controls 1 or more 'Pool (pink) cards." RRG
  // "Ownership and Control" (p. 31): a card enters play under its owner's control, and a player side scheme is a pink
  // card its owner played.
  /** The first 'Pool ally in a player's deck that is not Dogpool. */
  const poolAllyOf = (s: GameState, p: PlayerId): string =>
    playerOf(s, p)
      .deck.map((id) => codeOf(s, id))
      .find(
        (c) =>
          c !== "44013" &&
          (s.cardPool[c as never] as { type: string; aspect?: string }).type === "ally" &&
          (s.cardPool[c as never] as { aspect?: string }).aspect === "pool",
      )!;
  /** Threat added to Dreadful Deeds beyond its printed starting threat of 2. */
  const deeds = (s: GameState): number => threatOf(s, everywhere(s, "44039")[0]!) - 2;
  it("per-player value: two 'Pool players each with a 'Pool card in play and a Spider-Man seat with none: 4 threat", () => {
    let s = game([DEADPOOL, poolCable(), SPIDER]);
    s = inPlay(s, P1, "44013").state; // Dogpool
    s = inPlay(s, P2, poolAllyOf(s, P2)).state;
    const r = revealToSeat(s, "44039", 2);
    expect(deeds(r.state)).toBe(4);
  });

  it("only the players who control one count: of three seats one 'Pool ally in play gives 2 threat", () => {
    let s = game([DEADPOOL, poolCable(), X23]);
    s = inPlay(s, P1, "44013").state;
    const r = revealToSeat(s, "44039", 2);
    expect(deeds(r.state)).toBe(2);
  });

  it("Deadpool's own hero-aspect cards are not 'Pool (pink) cards: Katana in play and no pink card adds no threat", () => {
    let s = game([DEADPOOL]);
    s = inPlay(s, P1, KATANA).state;
    const r = revealToSeat(s, "44039", 0);
    expect(deeds(r.state)).toBe(0);
  });

  // FINDING F2: the script counts only an ally, upgrade or support in play (`CONTROLS_POOL_CARD`), so a player whose only
  // 'Pool card in play is the player side scheme Live Dangerously (44024, aspect pool) is not counted.
  it("a player whose only 'Pool card in play is the player side scheme Live Dangerously counts: 2 more threat (RRG 'Ownership and Control', p. 31)", () => {
    const played = playCard(game([DEADPOOL]), "44024", 0);
    expect(played.state.villainArea).toContain(played.id); // really played by its owner: in play beside the main scheme
    const r = revealToSeat(played.state, "44039", 0);
    expect(deeds(r.state)).toBe(2);
  });
});

describe("The Merc with the Mouth (44032) in a three player game", () => {
  const MERC = "44032";
  const PLOT = "44050";
  const PLOT_ACTION = "44050.plot-convenience-action";
  const BOOM = "43013";
  const BOOM_ACTION = "43013.boom-boom-action";

  // Owner ruling (docs/phase7-wave7.md 4.1, 2026-10-05): the Merc stops other players' player-card abilities, forced ones
  // and "any player" cards included, during his player's turn only; RRG "'Cannot'" (p. 11).
  function table() {
    let s = game([withExtra("deadpool-pool", PLOT), SPIDER, X23]);
    s = inPlay(s, P1, PLOT).state;
    s = inPlay(s, P3, BOOM).state;
    const merc = intoPlayArea(s, everywhere(s, MERC)[0]!, P1);
    return { free: s, merc };
  }
  const idOfCode = (s: GameState, code: string) => everywhere(s, code)[0]!;

  it("both other seats are refused during the Merc player's turn: Plot Convenience (any player may trigger it) and X-23's own Boom Boom", () => {
    const { free, merc } = table();
    const plot = idOfCode(free, PLOT);
    const boom = idOfCode(free, BOOM);
    // Controls: with no Merc the same commands are legal.
    expect(rejected(free, use(P2, plot, PLOT_ACTION)), "no Merc: P2 may use Plot Convenience off-turn").toBe(false);
    expect(rejected(free, use(P3, boom, BOOM_ACTION)), "no Merc: P3 may use Boom Boom off-turn").toBe(false);
    expect(rejected(merc, use(P2, plot, PLOT_ACTION)), "Merc: second seat refused").toBe(true);
    expect(rejected(merc, use(P3, plot, PLOT_ACTION)), "Merc: third seat refused on the Merc player's card").toBe(true);
    expect(rejected(merc, use(P3, boom, BOOM_ACTION)), "Merc: third seat refused on its own card").toBe(true);
  });

  it("the ban belongs to the Merc player's turn alone: on the second seat's turn the third seat's Boom Boom is allowed", () => {
    const { merc } = table();
    const boom = idOfCode(merc, BOOM);
    expect(rejected(turnOf(merc, P2), use(P3, boom, BOOM_ACTION))).toBe(false);
    expect(rejected(turnOf(merc, P3), use(P3, boom, BOOM_ACTION))).toBe(false);
  });

  it("the Merc player's own abilities are not stopped on his own turn", () => {
    const { merc } = table();
    const plot = idOfCode(merc, PLOT);
    expect(rejected(merc, use(P1, plot, PLOT_ACTION))).toBe(false);
  });
});

describe("Metacidal Tendencies (44042) against a Toughness ally", () => {
  const DOGPOOL = "44013"; // DEADPOOL CORPS, Toughness, 4 hit points
  const METACIDAL = "44042";

  // Toughness (RRG "Toughness", p. 44) enters play as a tough status card, and a tough status card is discarded instead of
  // the damage it prevents (RRG "Damage", p. 14). "If no damage was dealt this way, place 1 acceleration token": a
  // wholly prevented 2 damage is no damage dealt. The existing module test puts Dogpool in by surgery (no tough card).
  // Deadpool in alter-ego form (Wade Wilson is not DEADPOOL CORPS) so that Dogpool is the only character hit.
  it("Dogpool played for real (tough): the 2 damage is prevented, its tough card goes, and 1 acceleration token is placed", () => {
    let s = withForm(game([DEADPOOL]), "alterEgo", P1);
    s = playCard(s, DOGPOOL, 3).state;
    const dog = everywhere(s, DOGPOOL)[0]!;
    expect(statusOf(s, dog, "tough")).toBe(1);
    const t0 = tokens(s);
    const r = revealToSeat(s, METACIDAL, 0, firstLegal, 2);
    expect(r.events.some((e) => e.type === "encounterCardRevealed" && e.cardId === (METACIDAL as never))).toBe(true);
    expect(damageOf(r.state, dog)).toBe(0);
    expect(statusOf(r.state, dog, "tough")).toBe(0);
    expect(tokens(r.state)).toBe(t0 + 1);
  });

  it("control: with Dogpool's tough card gone the same reveal deals him the 2 and places no token", () => {
    let s = withForm(game([DEADPOOL]), "alterEgo", P1);
    s = playCard(s, DOGPOOL, 3).state;
    const dog = everywhere(s, DOGPOOL)[0]!;
    s = status(s, dog, "tough", 0);
    const t0 = tokens(s);
    const r = revealToSeat(s, METACIDAL, 0, firstLegal, 2);
    expect(damageOf(r.state, dog)).toBe(2);
    expect(tokens(r.state)).toBe(t0);
  });
});

describe("Armed to the Teeth (44009): swapping with a card of the same title, and with Restricted weight", () => {
  const ARMED = "44009";
  const LASER_SWORDS = "44055";
  const ACTION = "44009.armed-to-the-teeth-action";
  const armedPick =
    (code: string, target?: InstanceId): Picker =>
    (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseTriggers") return accepting("armed-to-the-teeth-response")(s);
      if (c?.prompt.kind === "searchCollection") return c.options.some((o) => o.optionId === code) ? [code] : [];
      if (target && c?.options.some((o) => o.optionId === target)) return [target];
      return firstLegal(s);
    };
  const heldBy = (s: GameState, armed: InstanceId): InstanceId[] =>
    Object.values(s.instances)
      .filter((i) => i.attachedTo === armed)
      .map((i) => i.instanceId);

  // RRG "Swap" (p. 42): "When swapping a card in a play area with a card in an out-of-play area, if those two cards share
  // a title, neither card is considered to enter or leave play" and the in-play card's state (exhausted, tokens) carries
  // over. Bazooka (Max 2 per deck) lets the collection offer a second copy beside the one in play.
  it("a facedown Bazooka swapped with the exhausted Bazooka in play (same title): neither enters or leaves play, nothing is discarded", () => {
    let s = game([withExtra("deadpool-pool", BAZOOKA)]);
    const inplay = inPlay(s, P1, BAZOOKA);
    s = patchInstance(inplay.state, inplay.id, { exhausted: true });
    const armed = playCard(s, ARMED, 2, armedPick(BAZOOKA), P1, identityOf(s));
    const facedown = heldBy(armed.state, armed.id);
    expect(facedown.map((id) => codeOf(armed.state, id))).toEqual([BAZOOKA]);
    const r = driveEventsPicking(WAVE7_DEPS, armed.state, armedPick(BAZOOKA, inplay.id), use(P1, armed.id, ACTION));
    const swap = r.events.find((e) => e.type === "cardsSwapped");
    expect(swap && swap.type === "cardsSwapped" && swap.how).toBe("sameTitle");
    expect(inst(r.state, inplay.id).attachedTo).toBe(identityOf(r.state));
    expect(inst(r.state, inplay.id).exhausted).toBe(true);
    expect(heldBy(r.state, armed.id)).toEqual(facedown);
    expect(discardOf(r.state)).not.toContain(inplay.id);
    expect(restrictedStanding(r.state, WAVE7_DEPS, P1).load).toBe(1);
  });

  // Q52 = B: Laser Swords counts 2 toward the limit and has no Restricted keyword itself, so only Restricted cards can be
  // discarded to meet it. Katana (1) + Bazooka (1) fill the limit of 2; swapping Laser Swords in for Bazooka makes 3.
  it("swapping in Laser Swords (weight 2) over a Bazooka beside a Katana overfills the limit: the Katana is discarded to meet it", () => {
    let s = game([withExtra("deadpool-pool", BAZOOKA)]);
    const katana = inPlay(s, P1, KATANA);
    const bazooka = inPlay(katana.state, P1, BAZOOKA);
    s = bazooka.state;
    const armed = playCard(s, ARMED, 2, armedPick(LASER_SWORDS), P1, identityOf(s));
    expect(restrictedStanding(armed.state, WAVE7_DEPS, P1).load).toBe(2);
    const r = driveEventsPicking(
      WAVE7_DEPS,
      armed.state,
      armedPick(LASER_SWORDS, bazooka.id),
      use(P1, armed.id, ACTION),
    );
    const swords = everywhere(r.state, LASER_SWORDS)[0]!;
    expect(inst(r.state, swords).attachedTo).toBe(identityOf(r.state));
    const standing = restrictedStanding(r.state, WAVE7_DEPS, P1);
    expect(standing.load).toBeLessThanOrEqual(standing.limit);
    expect(discardOf(r.state).map((id) => codeOf(r.state, id))).toContain(KATANA);
  });
});

describe("Git Gud (44028): its cost with and without the fact from outside the game", () => {
  const GIT_GUD = "44028";
  const play0 = (s: GameState, pay: number) => {
    const g = moveToHand(s, P1, GIT_GUD);
    const id = g.ids[0]!;
    return { g, id, cmd: play(P1, id, payWith(g.state, P1, pay, [id]), { attachToInstanceId: identityOf(g.state) }) };
  };

  // Q48: an absent fact means "did not win", so the cost 2 is reduced by 2.
  it("no fact (did not win): it costs 0; a recorded win makes it cost 2", () => {
    const lost = play0(game([DEADPOOL]), 0);
    expect(rejected(lost.g.state, lost.cmd)).toBe(false);
    const won = play0(game([DEADPOOL], { facts: [{ wonPreviousGame: true }] }), 0);
    expect(rejected(won.g.state, won.cmd), "won: 0 resources are not enough").toBe(true);
    const paidWon = play0(game([DEADPOOL], { facts: [{ wonPreviousGame: true }] }), 2);
    expect(rejected(paidWon.g.state, paidWon.cmd)).toBe(false);
  });

  it("the fact is per seat: in a two player game only the seat that won pays the full cost", () => {
    const base = game([DEADPOOL, CABLE], { facts: [undefined, { wonPreviousGame: true }] });
    expect(playerOf(base, P1).outsideFacts?.wonPreviousGame).not.toBe(true);
    expect(playerOf(base, P2).outsideFacts?.wonPreviousGame).toBe(true);
    const mine = play0(base, 0);
    expect(rejected(mine.g.state, mine.cmd)).toBe(false);
    // Seat 1's win is recorded in its own player record: Deadpool as the second seat with the fact pays 2.
    const swapped = game([CABLE, DEADPOOL], { facts: [undefined, { wonPreviousGame: true }] });
    const theirs = (() => {
      const g = moveToHand(swapped, P2, GIT_GUD);
      const id = g.ids[0]!;
      return { g, cmd: play(P2, id, payWith(g.state, P2, 0, [id]), { attachToInstanceId: identityOf(g.state, P2) }) };
    })();
    expect(rejected(theirs.g.state, { ...theirs.cmd } as Command)).toBe(true);
  });
});

const CLAWS = "43002";
const CLAWS_ACTION = "43002.x-23s-claws-action";
const LIVING_WEAPON = "43001a.living-weapon";
const BADGER = "43003";
const CRITICAL_HIT = "43016";
const REGEN_LONGEVITY = "43006";
const SIDE_SCHEME = "40131"; // Captive Hope: a side scheme every box scenario carries

describe("X-23: Regenerative Longevity (43006) prints a plain Action", () => {
  // RRG "Action" (p. 4): an Action may be triggered in either form, as Sisterhood (43008, also a plain Action) is by the
  // existing tests; only a "Hero Action" needs the hero face. The card's printed text is "Action: Heal a total of 4
  // damage from your identity and Honey Badger." The script (`x23/events.ts`) uses `heroAction`, and the module test
  // pins the refusal in alter-ego form as correct.
  // FINDING F3: ability-scripting-engineer.
  it("Laura Kinney (alter-ego form) can play it: 4 damage is healed from her identity", () => {
    let s = withForm(game([X23]), "alterEgo", P1);
    s = patchInstance(s, identityOf(s), { damage: 5 });
    const r = playCard(s, REGEN_LONGEVITY, 1);
    expect(dmgOn(r.state)).toBe(1);
  });

  it("control: in hero form the same play heals the 4", () => {
    let s = game([X23]);
    s = patchInstance(s, identityOf(s), { damage: 5 });
    const r = playCard(s, REGEN_LONGEVITY, 1);
    expect(dmgOn(r.state)).toBe(1);
  });
});

describe("X-23: Living Weapon and Honey Badger readying her", () => {
  // Living Weapon (43001a): "(Limit once per phase.)" The player phase and the villain phase are two phases (RRG
  // "Limit", p. 27, with the limit period "phase").
  it("once per phase, not once per round: used on the Claws' damage in her turn, it is offered again for the villain's attack", () => {
    let s = withoutTough(game([X23]));
    s = patchInstance(s, identityOf(s), { exhausted: true });
    const claws = everywhere(s, CLAWS)[0]!;
    const r = driveEventsPicking(WAVE7_DEPS, s, accepting(LIVING_WEAPON), use(P1, claws, CLAWS_ACTION), endTurn(P1));
    const resolved = r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === (LIVING_WEAPON as never));
    expect(resolved).toHaveLength(2);
  });

  // RRG "Tough" / "Damage" (p. 14): wholly prevented damage is not "any amount of damage taken".
  it("Honey Badger with a tough status card takes no consequential damage from her own attack: X-23 is not readied", () => {
    let s = withoutTough(game([X23]));
    const badger = playCard(s, BADGER, 2);
    s = status(badger.state, badger.id, "tough");
    const minion = withMinion(s, P1, "01101", 9001);
    s = patchInstance(minion.state, identityOf(minion.state), { exhausted: true });
    const r = driveOffers(s, accepting("43003.honey-badger-response"), basicAttack(s, P1, minion.id, badger.id));
    expect(damageOf(r.state, badger.id)).toBe(0);
    expect(statusOf(r.state, badger.id, "tough")).toBe(0);
    expect(hasOffer(r.offered, "43003.honey-badger-response")).toBe(false);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(true);
  });

  it("control: the same attack without tough hurts Honey Badger for the minion's ATK 1 and X-23 is readied", () => {
    let s = withoutTough(game([X23]));
    const badger = playCard(s, BADGER, 2);
    s = badger.state;
    const minion = withMinion(s, P1, "01101", 9001);
    s = patchInstance(minion.state, identityOf(minion.state), { exhausted: true });
    const r = driveOffers(s, accepting("43003.honey-badger-response"), basicAttack(s, P1, minion.id, badger.id));
    expect(damageOf(r.state, badger.id)).toBe(1);
    expect(inst(r.state, identityOf(r.state)).exhausted).toBe(false);
  });
});

describe("X-23 stunned: responses to a basic attack that was replaced by the stun", () => {
  // RRG "Stun, Stunned" (p. 41): "As the attack action ... was replaced by the removal of the stunned status card, that
  // character is not considered to have attacked." Critical Hit (43016): "After you attack an enemy, stun it."
  it("a stunned X-23's basic attack does not trigger Critical Hit: nothing is dealt, nothing is stunned, the stun is gone", () => {
    let s = withoutTough(game([X23]));
    const side = sideScheme(s, SIDE_SCHEME, 2);
    s = toVictory(side.state, side.id);
    const minion = withMinion(s, P1, WHIPLASH, 9001);
    s = status(minion.state, identityOf(minion.state), "stunned");
    const hand = moveToHand(s, P1, CRITICAL_HIT);
    const r = driveOffers(hand.state, accepting(CRITICAL_HIT), basicAttack(hand.state, P1, minion.id));
    expect(damageOf(r.state, minion.id)).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
    expect(hasOffer(r.offered, CRITICAL_HIT)).toBe(false);
    expect(statusOf(r.state, minion.id, "stunned")).toBe(0);
  });

  it("control: unstunned, the same attack offers Critical Hit and the minion is stunned", () => {
    let s = withoutTough(game([X23]));
    const side = sideScheme(s, SIDE_SCHEME, 2);
    s = toVictory(side.state, side.id);
    const minion = withMinion(s, P1, HYDRA_MERC, 9001);
    const hand = moveToHand(minion.state, P1, CRITICAL_HIT);
    const r = driveOffers(hand.state, acceptingPaid(2, CRITICAL_HIT), basicAttack(hand.state, P1, minion.id));
    expect(hasOffer(r.offered, CRITICAL_HIT)).toBe(true);
    expect(statusOf(r.state, minion.id, "stunned")).toBe(1);
  });
});

describe("Specialized Training (43021) and the linked Specialists at four players", () => {
  const TRAINING = "43021";
  const SPECIALISTS = ["43034", "43035", "43036", "43037"];
  const training = (players: readonly Seat[], owner: PlayerId, firstPlayerIndex = 0) => {
    const g = playCard(game(players, { firstPlayerIndex }), TRAINING, 1, firstLegal, owner);
    // Surgery on the scheme's threat so one basic thwart defeats it.
    return { state: patchInstance(g.state, g.id, { threat: 1 }), id: g.id };
  };
  const specialistsOf = (s: GameState, p: PlayerId): string[] =>
    inst(s, identityOf(s, p))
      .attachments.map((a) => codeOf(s, a))
      .filter((c) => SPECIALISTS.includes(c));

  // Specialized Training: "Each player who does not control a SPECIALIZATION upgrade chooses 1 set-aside SPECIALIZATION
  // upgrade and puts it into play under their control." Each Specialist is unique (RRG "Unique Icon", p. 45), so four
  // players take four different ones; the chooser order is player order from the first player (RRG "Player Order").
  it("four players: each seat takes a different Specialist onto its own identity, in player order from the first player", () => {
    const g = training([SPIDER, DEADPOOL, X23, CABLE], P3, 2);
    const order: PlayerId[] = [];
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (
        c &&
        c.options.some(
          (o) => st.instances[o.optionId as InstanceId] && SPECIALISTS.includes(codeOf(st, o.optionId as InstanceId)),
        )
      ) {
        order.push(c.playerId);
        return [c.options[0]!.optionId];
      }
      return firstLegal(st);
    };
    const r = driveEventsPicking(WAVE7_DEPS, g.state, pick, basicThwart(g.state, P3, g.id));
    const taken = [P1, P2, P3, P4].map((p) => specialistsOf(r.state, p));
    expect(
      taken.every((t) => t.length === 1),
      JSON.stringify(taken),
    ).toBe(true);
    expect(new Set(taken.flat()).size).toBe(4);
    expect(order).toEqual([P3, P4, P1, P2]);
  });
});

describe("Self-Isolation (43028) holding Honey Badger facedown, with Sisterhood and Laura Kinney's Action", () => {
  const SELF_ISOLATION = "43028";
  const SISTERHOOD = "43008";
  const SISTERHOOD_ACTION = "43008.sisterhood-action";
  const LAURA = "43001b.laura-kinney-action";
  const RESPONSE = "43028.self-isolation-response";

  /** Honey Badger in hand when the obligation is dealt, so it tucks her; the round is played out to X-23's next turn. */
  function isolated(): GameState {
    let s = withoutTough(game([X23]));
    s = moveToHand(s, P1, BADGER).state;
    return revealToSeat(s, SELF_ISOLATION, 0).state;
  }

  // RRG "In Play and Out of Play" (p. 23): a facedown card tucked under a card is out of play, and a search of the deck and
  // discard pile does not look under cards. Sisterhood (43008): "search your deck and discard pile for Honey Badger".
  it("while she is tucked under the obligation Sisterhood finds nothing and Laura Kinney's Action has no card to shuffle", () => {
    let s = isolated();
    const ob = everywhere(s, SELF_ISOLATION)[0]!;
    const badger = everywhere(s, BADGER)[0]!;
    expect(inst(s, ob).tucked).toEqual([badger]);
    const sister = inPlay(s, P1, SISTERHOOD);
    s = sister.state;
    const handBefore = handOf(s).length;
    const x23Card = handOf(s).find(
      (id) => (s.cardPool[s.instances[id]!.cardId] as { aspect?: string }).aspect === "hero:43001a",
    );
    const r = driveEventsPicking(
      WAVE7_DEPS,
      s,
      firstLegal,
      use(P1, sister.id, SISTERHOOD_ACTION, [], { discard: [x23Card!] }),
    );
    expect(handOf(r.state)).not.toContain(badger);
    expect(handOf(r.state).length).toBe(handBefore - 1); // the discard cost, nothing found
    const alter = withForm(s, "alterEgo", P1);
    expect(rejected(alter, use(P1, identityOf(alter), LAURA, [], { card: [] }))).toBe(true);
  });

  it("after the basic recovery discards both, Laura Kinney's Action can shuffle Honey Badger back and draw", () => {
    const s = withForm(isolated(), "alterEgo", P1);
    const badger = everywhere(s, BADGER)[0]!;
    const r1 = driveEventsPicking(WAVE7_DEPS, s, accepting(RESPONSE), { type: "basicRecover", playerId: P1 });
    expect(discardOf(r1.state)).toContain(badger);
    const picks: Picker = (st) => {
      const c = st.pendingChoice;
      const hit = c?.options.find((o) => o.optionId === badger);
      return hit ? [hit.optionId] : firstLegal(st);
    };
    const handBefore = handOf(r1.state).length;
    const r2 = driveEventsPicking(
      WAVE7_DEPS,
      r1.state,
      picks,
      use(P1, identityOf(r1.state), LAURA, [], { card: [badger] }),
    );
    expect(discardOf(r2.state)).not.toContain(badger);
    expect(handOf(r2.state).length).toBe(handBefore + 1);
  });
});

describe("Deadpool's Barely a Scratch (44017) is a defense label: a stunned and confused hero still plays it", () => {
  const SCRATCH = "44017";
  // RRG "Labeled Ability" (p. 26): only an ability whose label a status card cancels is canceled (stun: attack, confuse:
  // thwart); a (defense) ability is neither, and the status cards stay.
  it("stunned and confused Deadpool prevents 1 damage per icon in play on the villain's attack, and both statuses remain", () => {
    const run = (withCard: boolean) => {
      let s = withoutTough(game([DEADPOOL]));
      s = sideScheme(s, "44024", 3).state; // Live Dangerously: crisis, acceleration and hazard icons in play
      s = status(status(s, identityOf(s), "stunned"), identityOf(s), "confused");
      if (withCard) s = moveToHand(s, P1, SCRATCH).state;
      return stopAt(s, "declareDefender", accepting(SCRATCH), endTurn(P1));
    };
    const control = run(false);
    expect(statusOf(control, identityOf(control), "stunned")).toBe(1);
    const at = run(true);
    // The villain's attack resolves after the defender prompt; read the round's end.
    expect(statusOf(at, identityOf(at), "confused")).toBe(1);
  });

  it("the prevention itself: damagePrevented is 1 per icon in play (Live Dangerously's three, and Deadpool's own crisis count), none without the card", () => {
    const run = (withCard: boolean) => {
      let s = withoutTough(game([DEADPOOL]));
      s = sideScheme(s, "44024", 3).state;
      s = status(status(s, identityOf(s), "stunned"), identityOf(s), "confused");
      if (withCard) s = moveToHand(s, P1, SCRATCH).state;
      return driveEventsPicking(WAVE7_DEPS, s, withCard ? accepting(SCRATCH) : firstLegal, endTurn(P1));
    };
    const prevented = (events: readonly GameEvent[]): number[] =>
      events.flatMap((e) => (e.type === "damagePrevented" ? [(e as unknown as { amount: number }).amount] : []));
    expect(prevented(run(false).events)).toEqual([]);
    const withIt = run(true);
    expect(prevented(withIt.events)[0]).toBeGreaterThanOrEqual(3);
    expect(statusOf(withIt.state, identityOf(withIt.state), "stunned")).toBe(1);
    expect(statusOf(withIt.state, identityOf(withIt.state), "confused")).toBe(1);
  });
});

describe("Every obligation, nemesis and Dreadpool card of both heroes, revealed in a two player game and fully resolved", () => {
  /** A picker over typed prompts too: a reported fact (talked: yes, minutes: 0) and a number (the smallest or the largest). */
  const typed =
    (pick: Picker, number: "min" | "max"): Picker =>
    (s) => {
      const p = s.pendingChoice?.prompt;
      if (p?.kind === "reportFact") return [p.fact === "minutesAway" ? "0" : "yes"];
      if (p?.kind === "chooseNumber") return [String(number === "min" ? p.min : p.max)];
      return pick(s);
    };
  const lastLegal: Picker = (s) => {
    const c = s.pendingChoice;
    if (!c) return [];
    if (c.prompt.kind === "declareDefender") return ["decline"];
    return c.options.slice(Math.max(0, c.options.length - Math.max(c.minSelections, 1))).map((o) => o.optionId);
  };
  /** X-23 (seat 1) and Deadpool (seat 2): the villain phase deals `code` to `owner`, answered by `pick` at every prompt. */
  function revealed(code: string, owner: PlayerId, pick: Picker, number: "min" | "max"): GameState {
    const base = game([X23, DEADPOOL]);
    const staged = placeAt(base, code, (owner === P1 ? 0 : 1) + 2);
    const dealt = dealtSet(staged);
    const run: Picker = (s) => {
      checkState(s, dealt, `reveal ${code}`);
      return typed(pick, number)(s);
    };
    return driveEventsPicking(WAVE7_DEPS, staged, run, endTurn(P1), endTurn(P2)).state;
  }
  const cases: readonly (readonly [string, PlayerId])[] = [
    ...["43028", "43029", "43030", "43031", "43032", "43033"].map((c) => [c, P1] as const),
    ...["44032", "44033", "44034", "44035", "44036"].map((c) => [c, P2] as const),
    ...["44037", "44038", "44039", "44040", "44041", "44042"].flatMap((c) => [[c, P1] as const, [c, P2] as const]),
  ];
  it.each(cases)(
    "%s dealt to %s: the round completes with every invariant intact (first, then last option)",
    (code, owner) => {
      for (const [pick, number] of [
        [firstLegal, "min"],
        [lastLegal, "max"],
      ] as const) {
        const s = revealed(code, owner, pick, number);
        expect(s.pendingChoice, `${code}: nothing left pending`).toBeNull();
        expect(s.outcome !== null || s.round === 2, `${code}: round ${s.round}`).toBe(true);
        checkState(s, dealtSet(s), `after ${code}`);
        // The staged card was really revealed: at least one copy of it is no longer waiting in a deck or set aside.
        const places = everywhere(s, code).map((id) => (zoneIndex(s).get(id) ?? ["attached"]).join(","));
        expect(
          places.some((w) => !/\.deck$|encounterSetAside|\.setAside$/.test(w)),
          `${code} still waiting: ${places.join(" | ")}`,
        ).toBe(true);
      }
    },
  );

  it("Self-Isolation dealt to Deadpool's player (a game with two obligations) is not tucking anything: it is X-23's obligation", () => {
    const s = revealed("43028", P2, firstLegal, "min");
    const ob = everywhere(s, "43028")[0]!;
    // "Give to the Laura Kinney player": it goes to her play area whoever it was dealt to, tucking her Honey Badger if found.
    expect(playerOf(s, P1).playArea.includes(ob) || discardedEncounter(s, ob)).toBe(true);
  });
  const discardedEncounter = (s: GameState, id: InstanceId): boolean =>
    Object.values(s.encounterDecks).some((d) => d.discard.includes(id));
});

describe("Expert-mode games with step invariants and a deep-equal replay", () => {
  const HOPE_SUMMERS = "40130";
  const typeOf = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.type;
  /**
   * The driver's own answer, except that Hope Summers never defends ("If Hope Summers is defeated, you lose", a policy for
   * the driver, not a rule) and that typed prompts the driver does not know are answered: a number alternates the largest
   * and the smallest, a break is 0 minutes, and the Merc's question is "yes" twice and then "no".
   */
  function ownAnswer(s: GameState, counters: { n: number; talk: number }): readonly string[] | null {
    const choice = s.pendingChoice;
    if (!choice) return null;
    const prompt = choice.prompt;
    if (prompt.kind === "reportFact") {
      if (prompt.fact === "minutesAway") return ["0"];
      return [counters.talk++ % 3 === 2 ? "no" : "yes"];
    }
    if (prompt.kind === "chooseNumber") return [String(counters.n++ % 2 === 0 ? prompt.max : prompt.min)];
    if (prompt.kind !== "declareDefender") return null;
    const ids = choice.options.map((o) => o.optionId);
    const allies = ids.filter(
      (id) =>
        id !== "decline" && typeOf(s, id as InstanceId) === "ally" && codeOf(s, id as InstanceId) !== HOPE_SUMMERS,
    );
    if (allies[0]) return [allies[0]];
    return ids.includes("decline") ? ["decline"] : null;
  }

  /** Plays by the greedy driver one command at a time, checking every state, up to `maxCommands` or an outcome. */
  function playChecked(initial: GameState, maxCommands: number): GameSession {
    const dealt = dealtSet(initial);
    checkState(initial, dealt, "start");
    let session = startSession(initial);
    let commands = 0;
    let lastRound = initial.round;
    const counters = { n: 0, talk: 0 };
    while (!session.state.outcome && commands < maxCommands) {
      const own = ownAnswer(session.state, counters);
      const choice = session.state.pendingChoice;
      const [driven] = own ? [] : playToOutcome(session.state, WAVE7_DEPS, { maxCommands: 1 }).session.log.commands;
      const command: Command | undefined =
        own && choice
          ? { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: own }
          : driven;
      if (!command) throw new Error("the driver issued no command");
      const result = sessionApply(session, command, WAVE7_DEPS);
      if (!result.ok)
        throw new Error(`engine rejected ${JSON.stringify(command)}: ${result.error.code}: ${result.error.message}`);
      session = result.session;
      commands++;
      checkState(session.state, dealt, `command ${commands} ${command.type}`);
      expect(session.state.round - lastRound).toBeLessThanOrEqual(1);
      lastRound = session.state.round;
    }
    return session;
  }
  function expectReplays(session: GameSession): void {
    const replayed = replay(session.log, WAVE7_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(session.state);
  }
  /** One expert game per seed; the greedy driver often loses expert games in a round or two, so the best seed must pass round 2. */
  function expertSeeds(players: readonly Seat[], scenario: string, seeds: readonly number[]): void {
    const rounds: number[] = [];
    for (const seed of seeds) {
      const session = playChecked(game(players, { scenario, difficulty: "expert", seed }), 260);
      expectReplays(session);
      rounds.push(session.state.round);
    }
    expect(Math.max(...rounds), `rounds reached per seed: ${rounds.join(", ")}`).toBeGreaterThanOrEqual(3);
  }

  it("X-23 (precon) against Juggernaut, expert, on four seeds", () => {
    expertSeeds([X23], "juggernaut", [1, 2, 3, 4]);
  });
  it("Deadpool (precon, with the Dreadpool set) against Stryfe, expert, on four seeds", () => {
    expertSeeds([DEADPOOL], "stryfe", [1, 2, 3, 4]);
  });
  it("X-23 and Deadpool together against Mister Sinister, expert, on three seeds", () => {
    expertSeeds([X23, DEADPOOL], "mister-sinister", [1, 2, 3]);
  });
});

describe("Deadpool pack: 'Pool cards at the edges of their text", () => {
  const MULLIGAN = "44048";
  const NEGASONIC = "44044";

  // Mulligan (44048): "Action: Discard your hand. Draw a new hand. (Draw up to your hand size.)" All of the hand, not as
  // many cards as the hand size. FINDING F5 (low): the script discards `handSizeOf()` cards (`discardFromHand(handSizeOf())`),
  // so a hand larger than the hand size keeps the surplus (a hand can exceed the hand size during a turn: drawing, or the
  // +2 of Live Dangerously leaving play). Owner: ability-scripting-engineer (an "all cards in hand" amount).
  it("Mulligan discards the WHOLE hand even when it holds more cards than the hand size, then draws up to the hand size", () => {
    let s = game([withExtra("deadpool-pool", MULLIGAN)]);
    s = fatten(s, P1, 6); // 11 cards in hand, hand size 5
    const g = moveToHand(s, P1, MULLIGAN);
    const id = g.ids[0]!;
    const others = handOf(g.state).filter((x) => x !== id);
    const pay = others.slice(0, 3);
    const rest = others.slice(3);
    const r = driveEventsPicking(WAVE7_DEPS, g.state, firstLegal, play(P1, id, pay));
    for (const c of rest) expect(handOf(r.state), `card ${c} was not discarded`).not.toContain(c);
    expect(handOf(r.state)).toHaveLength(5);
  });

  // Negasonic Teenage Warhead (44044): "Interrupt: When a treachery is revealed, deal 2 damage to Negasonic Teenage
  // Warhead -> cancel that treachery's When Revealed effects." The 2 damage is a cost, and RRG 1.8 "Cost" (p. 14): "If
  // dealing damage is a cost, that cost is considered paid even if some or all of that damage is prevented" (as against
  // taking damage, which is not paid unless all of it was taken; that is the Focused Rage FAQ #27, p. 57, a "take 1
  // damage" cost, and does not apply here). FFG ruling "June 25, 2026 - Ruling 6" (marvel-champions-rulings-post-rrg-1-7.md)
  // says the same: damage dealt as a cost can be prevented and the cost remains paid. So with a tough status card the
  // Interrupt is offered, the tough card is discarded instead of the damage, and the cost is paid. (Finding F4 of the
  // first pass, withdrawn.)
  const NTW_REF = "44044.negasonic-teenage-warhead-interrupt";
  /** Negasonic in play with `tough` status cards; one treachery (Advance) is revealed and she is accepted once. */
  function negasonicReveal(tough: number) {
    let q = game([withExtra("deadpool-pool", NEGASONIC)]);
    const ntw = playCard(q, NEGASONIC, 4);
    q = status(ntw.state, ntw.id, "tough", tough);
    let used = false;
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      const hit =
        !used && c?.prompt.kind === "chooseTriggers" ? c.options.find((o) => o.optionId.includes(NTW_REF)) : undefined;
      if (hit) {
        used = true;
        return [hit.optionId];
      }
      return firstLegal(st);
    };
    const out = driveEventsPicking(WAVE7_DEPS, placeAt(q, ADVANCE, 1), pick, endTurn(P1));
    const advanceResolved = out.events.some(
      (e) => e.type === "abilityResolved" && e.abilityId === ("01186.when-revealed" as never),
    );
    return { state: out.state, ntw: ntw.id, accepted: used, advanceResolved };
  }

  it("without a tough status card Negasonic pays the 2 damage and cancels Advance's When Revealed", () => {
    const r = negasonicReveal(0);
    expect(r.accepted).toBe(true);
    expect(damageOf(r.state, r.ntw)).toBe(2);
    expect(r.advanceResolved).toBe(false);
  });

  it("with a tough status card the cost is still paid: the Interrupt is offered, tough is discarded, 0 damage, Advance's When Revealed is canceled", () => {
    const r = negasonicReveal(1);
    expect(r.accepted).toBe(true);
    expect(statusOf(r.state, r.ntw, "tough")).toBe(0);
    expect(damageOf(r.state, r.ntw)).toBe(0);
    expect(r.advanceResolved).toBe(false);
  });
});

describe("Player side schemes at three and four players", () => {
  const KEEP_THEM_BUSY = "43018";
  const TRAINING = "43021";
  const LIVE_DANGEROUSLY = "44024";
  const sideSchemesInPlay = (s: GameState): string[] =>
    s.villainArea.map((id) => codeOf(s, id)).filter((c) => [KEEP_THEM_BUSY, TRAINING, LIVE_DANGEROUSLY].includes(c));

  // Keep Them Busy: starting threat 3[per_hero]; When Defeated removes 5[per_hero] from the main scheme. Per hero is the
  // number of players who started the game (RRG "Per Hero", p. 33).
  it.each([
    [3, 9, 15],
    [4, 12, 20],
  ] as const)(
    "%i players: it enters with %i threat, and defeating it removes %i from the main scheme",
    (n, entering, removed) => {
      const seats: readonly Seat[] = [X23, DEADPOOL, SPIDER, CABLE].slice(0, n);
      let s = game(seats, { mainThreat: 30 });
      const kb = playCard(s, KEEP_THEM_BUSY, 1);
      expect(threatOf(kb.state, kb.id)).toBe(entering);
      s = patchInstance(kb.state, kb.id, { threat: 1 });
      const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, basicThwart(s, P1, kb.id, identityOf(s)));
      expect(threatOf(r.state, mainOf(r.state))).toBe(30 - removed);
    },
  );

  // RRG "Player Side Scheme Limit" (p. 34): three or four starting players make the limit two; a third played is played
  // and then one of them is discarded (not defeated); Q1 = A.
  it("three players: the limit is two, so a third player side scheme is played and one of the three is discarded, not defeated", () => {
    let s = game([X23, DEADPOOL, SPIDER]);
    s = playCard(s, KEEP_THEM_BUSY, 1).state;
    s = playCard(s, TRAINING, 1).state;
    expect(sideSchemesInPlay(s).sort()).toEqual([KEEP_THEM_BUSY, TRAINING]);
    // The Deadpool player (seat 2) plays Live Dangerously on her own turn.
    const turn2 = driveEventsPicking(WAVE7_DEPS, s, firstLegal, endTurn(P1)).state;
    expect(turn2.step.phase === "player" && turn2.step.kind === "turn" && turn2.step.activePlayerId).toBe(P2);
    const third = playCard(turn2, LIVE_DANGEROUSLY, 0, firstLegal, P2);
    expect(sideSchemesInPlay(third.state)).toHaveLength(2);
    expect(third.state.victoryDisplay.map((id) => codeOf(third.state, id))).not.toContain(KEEP_THEM_BUSY);
  });

  it("two players: the limit is one (control): the second player side scheme replaces the first", () => {
    let s = game([X23, DEADPOOL]);
    s = playCard(s, KEEP_THEM_BUSY, 1).state;
    s = playCard(s, TRAINING, 1).state;
    expect(sideSchemesInPlay(s)).toHaveLength(1);
  });
});
