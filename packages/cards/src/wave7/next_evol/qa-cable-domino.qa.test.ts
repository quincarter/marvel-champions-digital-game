import {
  applyCommand,
  createGame,
  replay,
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
  putOnTopOfDeck,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import {
  driveEventsPicking,
  encounterCardInVillainArea,
  stackSetAside,
  stageNemesisCardForReveal,
  withForm,
} from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Rules-QA pass over Cable (40001-40036) and Domino (40037-40069), wave 7 step 4 (docs/phase7-wave7-qa-cable-domino.md).
 * The module and precon tests prove each card in the conditions its author thought of; these tests go after the
 * places two cards, a keyword or a status meet. Every test names the rule it proves. Citations: RRG 1.8 (the
 * Markdown `mc_rulesreference_v18_compressed.md`, entries by name), the post-1.7 rulings by date, and owner decisions
 * by their `docs/phase7-wave7.md` section 4.1 Q number. `it.fails` pins a defect that is reported and not fixed here:
 * it passes while the defect stands and turns red the day it is fixed, which is the cue to delete the `.fails`.
 */

const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
type Seat = typeof CABLE | typeof DOMINO;

const PURGE = "40006";
const BTTF = "40033";
const WHIPLASH = "01172"; // a minion with Retaliate 1, 4 hit points
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const typeOf = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.type;
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const handOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).hand;
const deckOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).deck;
const discardOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).discard;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const purgeOf = (s: GameState): InstanceId => instancesOf(s, PURGE)[0]!;
const rejected = (s: GameState, c: Command): boolean => !applyCommand(s, c, WAVE7_DEPS).ok;
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });

const choosingPurge: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseCards") {
    const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === PURGE);
    if (hit) return [hit.optionId];
  }
  return firstLegal(state);
};

/**
 * A game after setup, every seat in hero form (Soldier X put Technovirus Purge into play for Cable), the main scheme at
 * `mainThreat`. Juggernaut keeps the encounter deck small and its main scheme free of a Forced Interrupt.
 */
function game(
  players: readonly Seat[],
  opts: {
    scenario?: string;
    seed?: number;
    mainThreat?: number;
    modularSetIds?: string[];
    difficulty?: "standard" | "expert";
  } = {},
): GameState {
  const config = wave7Scenario(opts.scenario ?? "juggernaut", {
    players,
    seed: opts.seed ?? 1,
    difficulty: opts.difficulty ?? "standard",
    modularSetIds: opts.modularSetIds ?? [],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, choosingPurge, (x) => x.step.phase === "player", WAVE7_DEPS);
  players.forEach((_, i) => {
    s = withForm(s, { heroForm: 0 }, i === 0 ? P1 : P2);
  });
  return patchInstance(s, mainOf(s), { threat: opts.mainThreat ?? 3 });
}

/** A minion (Whiplash by default) fabricated into `player`'s play area, engaged with them. */
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

/** Back to the Future in play with 4 threat (surgery: the nemesis card sits in the owner's set-aside area). */
function withBttf(state: GameState): { state: GameState; id: InstanceId } {
  const staged = stackSetAside(state, BTTF, P1);
  const id = instancesOf(staged, BTTF)[0]!;
  return {
    id,
    state: {
      ...staged,
      encounterDecks: Object.fromEntries(
        Object.entries(staged.encounterDecks).map(([k, d]) => [k, { ...d, deck: d.deck.filter((x) => x !== id) }]),
      ),
      villainArea: [...staged.villainArea, id],
      instances: { ...staged.instances, [id]: { ...staged.instances[id]!, faceup: true, threat: 4 } },
    } as GameState,
  };
}

/** Moves a side scheme (wherever it is) into the victory display. */
function toVictory(state: GameState, id: InstanceId): GameState {
  return {
    ...patchInstance(state, id, { threat: 0 }),
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: [...state.victoryDisplay, id],
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((x) => x !== id),
      hand: p.hand.filter((x) => x !== id),
      discard: p.discard.filter((x) => x !== id),
    })),
  };
}

const status = (s: GameState, id: InstanceId, kind: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [kind]: n } });

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

/** A picker that records every option list of a prompt kind, then answers like `pick`. */
function spy(kind: string, seen: string[][], pick: Picker = firstLegal): Picker {
  return (s) => {
    if (s.pendingChoice?.prompt.kind === kind) seen.push(s.pendingChoice.options.map((o) => o.optionId));
    return pick(s);
  };
}
/** Every card id offered at any prompt that lists in-play cards while `pick` drives `commands`. */
const recordOffers =
  (seen: string[][], pick: Picker = firstLegal): Picker =>
  (st) => {
    if (st.pendingChoice && st.pendingChoice.options.some((o) => st.instances[o.optionId as InstanceId]))
      seen.push(st.pendingChoice.options.map((o) => o.optionId));
    return pick(st);
  };
const accepting =
  (...wanted: readonly string[]): Picker =>
  (s) => {
    const c = s.pendingChoice;
    if (c?.prompt.kind === "chooseTriggers")
      return c.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(s);
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

const basicThwart = (s: GameState, p: PlayerId, scheme: InstanceId, thwarter?: InstanceId): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: thwarter ?? identityOf(s, p),
  schemeInstanceId: scheme,
});

describe("Cable: Back to the Future and Temporal Leap", () => {
  /** Morlock Siege (its main scheme has no Forced Interrupt), Temporal Leap on Cable, Purge in the display. */
  function leapUnderBttf(withScheme: boolean) {
    let s = game([CABLE], { scenario: "morlock-siege" });
    s = toVictory(s, purgeOf(s));
    if (withScheme) s = withBttf(s).state;
    const played = playCard(s, "40013", 2, firstLegal, P1, identityOf(s));
    s = patchInstance(played.state, mainOf(played.state), { threat: 5 });
    return { state: s, leap: played.id };
  }
  function runVillainPhase(state: GameState, pick: Picker) {
    const snapshots: GameState[] = [];
    const seeing: Picker = (s) => {
      snapshots.push(s);
      return pick(s);
    };
    const r = driveEventsPicking(WAVE7_DEPS, state, seeing, ...state.players.map((p) => endTurn(p.playerId)));
    return { ...r, snapshots };
  }
  const leapPick: Picker = (s) => {
    const c = s.pendingChoice;
    if (c?.prompt.kind === "chooseCards") {
      const hit = c.options.find((o) => codeOf(s, o.optionId as InstanceId) === PURGE);
      if (hit) return [hit.optionId];
    }
    return accepting("40013.temporal-leap-interrupt")(s);
  };

  // RRG "Move" (p. 32, "If threat is moved off a scheme, the moved threat is considered to be removed from that scheme")
  // with Back to the Future (40033): "The Cable player cannot remove threat from schemes other than Back to the Future."
  // Temporal Leap's cost (removed from the game, a side scheme put into play) is paid, and the move it then makes is
  // barred, so the stage completes anyway and the revived scheme gets no threat from it.
  it("Temporal Leap cannot move threat off the main scheme while Back to the Future bars the Cable player (RRG 'Move')", () => {
    const { state, leap } = leapUnderBttf(true);
    const run = runVillainPhase(state, leapPick);
    const afterLeap = run.snapshots.find((s) => s.pendingChoice?.prompt.kind === "declareDefender")!;
    expect(afterLeap.removedFromGame).toContain(leap); // the cost was paid
    expect(afterLeap.villainArea.map((id) => codeOf(afterLeap, id))).toContain(PURGE);
    expect(threat(afterLeap, purgeOf(afterLeap))).toBe(5); // no 4 threat arrived
    expect(afterLeap.mainScheme.stageIndex).toBe(1); // the completion went ahead
  });

  // Owner ruling 2026-10-05 (docs/phase7-wave7.md 4.1, amending Q30) and RRG "Hinder X" (p. 22): a side scheme returning
  // from the victory display enters with its starting threat plus its hinder, not revealed; then 4 threat moves onto it.
  it("Temporal Leap returns Making Green (2 threat, Hinder 2 per hero) with 2 + 2 threat, then the 4 moved: 8", () => {
    let s = game([CABLE], { scenario: "morlock-siege", modularSetIds: ["black_tom_cassidy"] });
    const making = encounterCardInVillainArea(s, "40134", 2);
    s = toVictory(making.state, making.id);
    const played = playCard(s, "40013", 2, firstLegal, P1, identityOf(s));
    s = patchInstance(played.state, mainOf(played.state), { threat: 5 });
    const pickMaking: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCards" && c.options.some((o) => o.optionId === making.id)) return [making.id];
      return accepting("40013.temporal-leap-interrupt")(st);
    };
    const run = runVillainPhase(s, pickMaking);
    const afterLeap = run.snapshots.find((st) => st.pendingChoice?.prompt.kind === "declareDefender")!;
    expect(afterLeap.villainArea).toContain(making.id);
    expect(threat(afterLeap, making.id)).toBe(8);
    expect(threat(afterLeap, mainOf(afterLeap))).toBe(2);
    expect(run.events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === making.id)).toBe(false);
  });

  it("control: without Back to the Future the same Temporal Leap moves 4 threat off the main scheme", () => {
    const { state, leap } = leapUnderBttf(false);
    const run = runVillainPhase(state, leapPick);
    const afterLeap = run.snapshots.find((s) => s.pendingChoice?.prompt.kind === "declareDefender")!;
    expect(threat(afterLeap, mainOf(afterLeap))).toBe(2);
    expect(afterLeap.removedFromGame).toContain(leap);
  });
});

describe("Stunned and confused heroes using the box's labeled abilities", () => {
  // RRG "Labeled Ability" (p. 26): a triggered ability labeled (attack) or (thwart) is canceled in full, costs excepted,
  // when the identity has a status card that cancels it, and "each status card ... that cancels any of the labeled
  // ability's types is removed". RRG "Stun, Stunned" (p. 41): "Costs associated with the attack attempt ... must still
  // be paid." Ruling August 13, 2026 - Ruling 1: the event was still "played".
  it("stunned Cable: Telekinetic Blast is played and paid for, the attack is canceled, the stun is removed", () => {
    const base = withoutTough(game([CABLE]));
    const cable = identityOf(base);
    const staged = status(base, cable, "stunned");
    const r = playCard(staged, "40005", 3);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, cable).statuses.stunned).toBe(0);
    expect(discardOf(r.state)).toContain(r.id);
    expect(handOf(r.state)).toHaveLength(handOf(r.before).length - 4); // the event and its cost of 3 left the hand
  });

  it("confused Cable: Mind Scan removes no threat and the confused card goes", () => {
    const base = game([CABLE]);
    const cable = identityOf(base);
    const r = playCard(status(base, cable, "confused"), "40003", 2);
    expect(threat(r.state, mainOf(r.state))).toBe(3);
    expect(threat(r.state, purgeOf(r.state))).toBe(5);
    expect(inst(r.state, cable).statuses.confused).toBe(0);
    expect(discardOf(r.state)).toContain(r.id);
  });

  it("stunned Cable: Plasma Rifle's exhaust and energy cost are paid and nothing is dealt", () => {
    let s = withoutTough(game([CABLE]));
    const rifle = playCard(s, "40011", 2, firstLegal, P1, identityOf(s));
    s = status(rifle.state, identityOf(rifle.state), "stunned");
    s = putEnergyInHand(s);
    const before = s;
    const energy = handOf(s).find((id) => printedEnergy(s, id))!;
    const r = driveEventsPicking(
      WAVE7_DEPS,
      s,
      firstLegal,
      use(P1, rifle.id, "40011.plasma-rifle-action", [{ fromHand: energy }]),
    );
    expect(inst(r.state, rifle.id).exhausted).toBe(true);
    expect(handOf(r.state)).not.toContain(energy);
    expect(damageOf(r.state, villainOf(r.state))).toBe(damageOf(before, villainOf(before)));
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });

  it("stunned Domino: A Good Workout is canceled whole, so the top card of the deck is not discarded (RRG p. 26)", () => {
    const base = withoutTough(game([DOMINO]));
    const stack = putOnTopOfDeck(base, P1, "40053");
    const s = status(stack.state, identityOf(stack.state), "stunned");
    const r = playCard(s, "40040", 2);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(deckOf(r.state)[0]).toBe(stack.ids[0]);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });

  it("confused Domino: Right Place, Right Time is canceled whole, so no card is discarded and no threat removed", () => {
    const base = game([DOMINO]);
    const stack = putOnTopOfDeck(base, P1, "40053");
    const s = status(stack.state, identityOf(stack.state), "confused");
    const r = playCard(s, "40042", 2);
    expect(threat(r.state, mainOf(r.state))).toBe(3);
    expect(deckOf(r.state)[0]).toBe(stack.ids[0]);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
  });

  it("stunned Domino: Domino's Pistol pays its exhaust and top-of-deck discard (a cost), then deals nothing", () => {
    const base = withoutTough(game([DOMINO]));
    const stack = putOnTopOfDeck(base, P1, "40053");
    const rifle = playCard(stack.state, "40046", 2, firstLegal, P1, identityOf(stack.state));
    const s = status(rifle.state, identityOf(rifle.state), "stunned");
    const top = deckOf(s)[0]!;
    const r = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, rifle.id, "40046.dominos-pistol-action"));
    expect(inst(r.state, rifle.id).exhausted).toBe(true);
    expect(discardOf(r.state)).toContain(top);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });
});

function printedEnergy(s: GameState, id: InstanceId): boolean {
  const card = s.cardPool[s.instances[id]!.cardId] as unknown as { resourceIcons?: { energy?: number; wild?: number } };
  return (card.resourceIcons?.energy ?? 0) + (card.resourceIcons?.wild ?? 0) > 0;
}
/** Makes sure the hand holds an energy card besides the others (surgery). */
function putEnergyInHand(s: GameState): GameState {
  if (handOf(s).some((id) => printedEnergy(s, id))) return s;
  return moveToHand(s, P1, "40002").state; // Bodyslide prints one energy icon
}

describe("Technovirus Purge and Back to the Future with two heroes", () => {
  // Technovirus Purge (40006) and §4.1 Q29: only Cable removes threat from it. Another hero's event is that hero (RRG
  // "You, Your": a player's card is that player's identity), exactly as Cable's own events count as Cable.
  it("Domino's Right Place, Right Time cannot be aimed at Technovirus Purge (Q29), Cable's Mind Scan can", () => {
    const base = game([CABLE, DOMINO]);
    // The scheme choice lists the schemes the event may take: Purge must not be among them.
    const seen: string[][] = [];
    playCard(base, "40042", 2, recordOffers(seen), P2);
    expect(seen.flat()).toContain(mainOf(base)); // a scheme prompt was seen at all
    expect(seen.flat()).not.toContain(purgeOf(base));
    // Control: Cable's Mind Scan may take the same scheme.
    const cableSeen: string[][] = [];
    playCard(base, "40003", 2, recordOffers(cableSeen), P1);
    expect(cableSeen.flat()).toContain(purgeOf(base));
  });

  it("Domino's basic thwart is refused on Technovirus Purge and works on the main scheme (Q29)", () => {
    const base = driveEventsPicking(WAVE7_DEPS, game([CABLE, DOMINO]), firstLegal, endTurn(P1)).state;
    expect(base.step.kind === "turn" && base.step.activePlayerId).toBe(P2);
    expect(rejected(base, basicThwart(base, P2, purgeOf(base)))).toBe(true);
    expect(rejected(base, basicThwart(base, P2, mainOf(base)))).toBe(false);
  });

  // Back to the Future (40033): "Other players cannot damage minions engaged with the Cable player." Diamondback's
  // "1 damage to each enemy" is Domino's, not an attack, so the villain and Domino's minion take it and Cable's minion
  // does not.
  it("Diamondback's damage to each enemy skips a minion engaged with the Cable player (Back to the Future)", () => {
    let s = withBttf(game([CABLE, DOMINO])).state;
    s = withoutTough(s);
    const cableMinion = withMinion(s, P1, WHIPLASH, 9001);
    const dominoMinion = withMinion(cableMinion.state, P2, WHIPLASH, 9002);
    s = putOnTopOfDeck(dominoMinion.state, P2, "40053").state; // one mental icon on top: 1 damage
    const turn = driveEventsPicking(WAVE7_DEPS, s, firstLegal, endTurn(P1)).state;
    const ally = playCard(turn, "40038", 2, firstLegal, P2);
    const r = driveEventsPicking(WAVE7_DEPS, ally.state, firstLegal, use(P2, ally.id, "40038.diamondback-action"));
    expect(damageOf(r.state, ally.id)).toBe(1); // her own cost
    expect(damageOf(r.state, villainOf(r.state))).toBe(1);
    expect(damageOf(r.state, dominoMinion.id)).toBe(1);
    expect(damageOf(r.state, cableMinion.id)).toBe(0);
  });

  /** Two minions (Cable's and Domino's), Domino active, Back to the Future in play, Cable's player cannot hurt either. */
  function dominoTurnUnderBttf(): { state: GameState; cableMinion: InstanceId; dominoMinion: InstanceId } {
    const s = withoutTough(withBttf(game([CABLE, DOMINO])).state);
    const cableMinion = withMinion(s, P1, WHIPLASH, 9001);
    const dominoMinion = withMinion(cableMinion.state, P2, WHIPLASH, 9002);
    const turn = driveEventsPicking(WAVE7_DEPS, dominoMinion.state, firstLegal, endTurn(P1)).state;
    return { state: turn, cableMinion: cableMinion.id, dominoMinion: dominoMinion.id };
  }

  // Back to the Future: "Other players cannot damage minions engaged with the Cable player." RRG "Target" (p. 42/43) and
  // the owner's 2026-10-05 ruling (docs/phase7-wave7.md 4.1, "A basic attack against a character that cannot take its
  // damage"): a character that cannot take damage is not a valid target for an ability whose only effect on it is damage,
  // so an attack that would only hurt that minion must not offer it. Damage itself is correctly barred (0 dealt, below).
  it("A Good Workout: damage to a minion engaged with the Cable player is barred (the effect does nothing to it)", () => {
    const g = dominoTurnUnderBttf();
    const choose: Picker = (st) =>
      st.pendingChoice?.options.some((o) => o.optionId === g.cableMinion) ? [g.cableMinion] : firstLegal(st);
    const r = playCard(g.state, "40040", 2, choose, P2);
    expect(damageOf(r.state, g.cableMinion)).toBe(0);
  });

  // FINDING F1 (A Good Workout 40040, Domino's Pistol 40046, Plasma Rifle 40011): the enemy prompt of `anAttackableEnemy()` still
  // lists a character that cannot take the damage. RRG "Target" (p. 42): "A target that 'cannot take damage' is not a valid
  // target for an ability or game function whose only effect on that target is to deal it damage." Telekinetic Blast
  // (`attackAnEnemy`) already refuses such a target (cable/obligation-nemesis.test.ts). Owner: game-rules-architect.
  it.fails("A Good Workout does not offer a minion engaged with the Cable player as its enemy (RRG 'Target', owner ruling 2026-10-05)", () => {
    const g = dominoTurnUnderBttf();
    const seen: string[][] = [];
    playCard(g.state, "40040", 2, recordOffers(seen), P2);
    expect(seen.flat()).toContain(g.dominoMinion);
    expect(seen.flat()).not.toContain(g.cableMinion);
  });

  it.fails("Domino's Pistol does not offer a minion engaged with the Cable player (F1)", () => {
    const g = dominoTurnUnderBttf();
    const pistol = playCard(g.state, "40046", 2, firstLegal, P2, identityOf(g.state, P2));
    const seen: string[][] = [];
    driveEventsPicking(WAVE7_DEPS, pistol.state, recordOffers(seen), use(P2, pistol.id, "40046.dominos-pistol-action"));
    expect(seen.flat()).toContain(g.dominoMinion);
    expect(seen.flat()).not.toContain(g.cableMinion);
  });

  it.fails("Cable's Plasma Rifle does not offer the villain (engaged with nobody, Q36) under Back to the Future (F1)", () => {
    let s = withoutTough(withBttf(game([CABLE])).state);
    const rifle = playCard(s, "40011", 2, firstLegal, P1, identityOf(s));
    s = putEnergyInHand(rifle.state);
    const energy = handOf(s).find((id) => printedEnergy(s, id))!;
    const seen: string[][] = [];
    const r = driveEventsPicking(
      WAVE7_DEPS,
      s,
      recordOffers(seen),
      use(P1, rifle.id, "40011.plasma-rifle-action", [{ fromHand: energy }]),
    );
    expect(seen.flat()).not.toContain(villainOf(s));
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });

  it.fails("Cable's Telekinetic Blast does not offer the villain under Back to the Future (F1: the existing module test only proves the damage is barred)", () => {
    const { state } = withBttf(withoutTough(game([CABLE])));
    const seen: string[][] = [];
    const r = playCard(state, "40005", 3, recordOffers(seen));
    expect(seen.flat()).not.toContain(villainOf(state));
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });

  it("the Cable player can thwart only Back to the Future: Mind Scan is not offered the main scheme or Purge", () => {
    const { state, id } = withBttf(game([CABLE]));
    const seen: string[][] = [];
    const record: Picker = (st) => {
      if (st.pendingChoice && st.pendingChoice.options.some((o) => st.instances[o.optionId as InstanceId]))
        seen.push(st.pendingChoice.options.map((o) => o.optionId));
      return firstLegal(st);
    };
    const r = playCard(state, "40003", 2, record);
    expect(seen.flat()).not.toContain(mainOf(state));
    expect(seen.flat()).not.toContain(purgeOf(state));
    expect(threat(r.state, id)).toBe(1);
  });
});

describe("Cable's responses answering the same side scheme", () => {
  const BREAKIN = "40131"; // Captive Hope, an encounter side scheme
  const RESPONSES = ["40001a.cable-response", "40007.graymalkin-response", "40010.forced-amnesia-response"] as const;

  /** Cable, with Graymalkin (exhausted) and Forced Amnesia in play, exhausted himself, and a 2-threat encounter scheme. */
  function setup() {
    let s = game([CABLE]);
    const gray = playCard(s, "40007", 2);
    s = gray.state;
    const amnesia = playCard(s, "40010", 1, firstLegal, P1, identityOf(s));
    s = amnesia.state;
    const scheme = encounterCardInVillainArea(s, BREAKIN, 2);
    s = scheme.state;
    s = patchInstance(s, gray.id, { exhausted: true });
    s = patchInstance(s, identityOf(s), { exhausted: false });
    return { state: s, gray: gray.id, amnesia: amnesia.id, scheme: scheme.id };
  }

  // Three Responses hear one `schemeDefeated`: Cable's own (once per phase), Graymalkin (any side scheme) and Forced
  // Amnesia (a non-permanent side scheme). All three are optional and independent; each must resolve exactly once.
  it("Cable's response, Graymalkin and Forced Amnesia all answer one defeat, each once, and the scheme lands in the display once", () => {
    const g = setup();
    const cable = identityOf(g.state);
    const r = driveOffers(g.state, accepting(...RESPONSES), basicThwart(g.state, P1, g.scheme));
    // Cable exhausts to thwart (his basic thwart) and is readied by his own response.
    for (const ref of RESPONSES) expect(hasOffer(r.offered, ref), ref).toBe(true);
    const resolved = (ref: string) =>
      r.events.filter((e) => e.type === "abilityResolved" && e.abilityId === ref).length;
    for (const ref of RESPONSES) expect(resolved(ref), ref).toBe(1);
    expect(inst(r.state, g.gray).exhausted).toBe(false);
    expect(inst(r.state, cable).exhausted).toBe(false);
    expect(r.state.victoryDisplay.filter((id) => id === g.scheme)).toHaveLength(1);
    expect(r.state.victoryDisplay).toContain(g.amnesia);
    expect(inst(r.state, g.amnesia).attachedTo).toBeNull();
    // Only the scheme counts as "a side scheme in the victory display": Mind Scan reads 1, not 2.
    const given = moveToHand(r.state, P1, "40003");
    const staged = { ...given, state: patchInstance(given.state, mainOf(given.state), { threat: 20 }) };
    const [scan] = staged.ids as [InstanceId];
    const before = threat(staged.state, mainOf(staged.state));
    const scanned = driveEventsPicking(
      WAVE7_DEPS,
      staged.state,
      (st) => {
        const c = st.pendingChoice;
        return c?.options.some((o) => o.optionId === mainOf(st)) ? [mainOf(st)] : firstLegal(st);
      },
      play(P1, scan, payWith(staged.state, P1, 2, [scan])),
    );
    expect(before - threat(scanned.state, mainOf(scanned.state))).toBe(3 + 1);
  });

  it("each can be declined on its own: refusing Forced Amnesia leaves the scheme to be discarded and the upgrade attached", () => {
    const g = setup();
    const r = driveOffers(g.state, accepting("40007.graymalkin-response"), basicThwart(g.state, P1, g.scheme));
    expect(inst(r.state, g.amnesia).attachedTo).toBe(identityOf(r.state));
    expect(r.state.victoryDisplay).not.toContain(g.scheme);
    expect(inst(r.state, g.gray).exhausted).toBe(false);
  });
});

describe("Stryfe's cancel at the edge of his hit points", () => {
  const STRYFE = "40032";
  // Stryfe (40032): "cancel the effects of that event and deal 1 damage to Stryfe." Stryfe has 5 hit points (data).
  it("a PSIONIC event played with Stryfe at 4 damage still resolves its cancel: Stryfe is defeated and the event does nothing", () => {
    const base = game([CABLE]);
    const minion = withMinion(base, P1, STRYFE, 9100);
    const hurt = patchInstance(minion.state, minion.id, { damage: 4 });
    const r = playCard(hurt, "40003", 2);
    expect(threat(r.state, mainOf(r.state))).toBe(3); // Mind Scan canceled
    expect(discardOf(r.state)).toContain(r.id);
    expect(r.state.players[0]!.playArea).not.toContain(minion.id); // Stryfe is gone
    const encounterDiscards = Object.values(r.state.encounterDecks).flatMap((d) => d.discard);
    expect([...encounterDiscards, ...r.state.removedFromGame, ...r.state.victoryDisplay]).toContain(minion.id);
  });
});

describe("Domino: two responses to the same top-of-deck discard", () => {
  const JACKPOT = "40043";
  const LADY_RESPONSE = "40045.the-painted-lady-response";
  const JACKPOT_RESPONSE = "40043.jackpot-response";

  /** Domino with The Painted Lady and Domino's Pistol in play, Jackpot! (3 icons) on top of the deck, Juggernaut untough. */
  function setup() {
    let s = withoutTough(game([DOMINO]));
    const lady = playCard(s, "40045", 1);
    s = lady.state;
    const pistol = playCard(s, "40046", 2, firstLegal, P1, identityOf(s));
    s = putOnTopOfDeck(pistol.state, P1, JACKPOT).state;
    const jackpot = deckOf(s)[0]!;
    return { state: s, lady: lady.id, pistol: pistol.id, jackpot };
  }
  const fire = (g: ReturnType<typeof setup>, ...accept: string[]) =>
    driveOffers(g.state, accepting(...accept), use(P1, g.pistol, "40046.dominos-pistol-action"));
  /** Where an instance is, among the zones this test can reach. */
  function whereIs(s: GameState, id: InstanceId): string[] {
    const p = playerOf(s, P1);
    const zones: [string, readonly InstanceId[]][] = [
      ["deck", p.deck],
      ["hand", p.hand],
      ["discard", p.discard],
      ["playArea", p.playArea],
    ];
    const found = zones.filter(([, ids]) => ids.includes(id)).map(([name]) => name);
    if (s.instances[id]!.attachedTo !== null) found.push(`attached:${codeOf(s, s.instances[id]!.attachedTo!)}`);
    return found;
  }

  // Q31 (any deck discard counts), Q32 = B (a card a response took away is not counted by the ability that discarded it)
  // and Q33. Jackpot! (shuffle itself back) and The Painted Lady (attach it) both want the same card.
  it("control: with both responses declined Jackpot! lies in the discard pile and Pistol counts its 3 icons", () => {
    const g = setup();
    const r = fire(g);
    expect(whereIs(r.state, g.jackpot)).toEqual(["discard"]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(3);
  });

  it("Jackpot! alone shuffles itself back into the deck; Pistol then counts nothing (Q32 = B)", () => {
    const g = setup();
    const r = fire(g, JACKPOT_RESPONSE);
    expect(whereIs(r.state, g.jackpot)).toEqual(["deck"]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });

  it("The Painted Lady alone attaches it facedown; Pistol then counts nothing (Q32 = B)", () => {
    const g = setup();
    const r = fire(g, LADY_RESPONSE);
    expect(whereIs(r.state, g.jackpot)).toEqual(["attached:40045"]);
    expect(damageOf(r.state, villainOf(r.state))).toBe(0);
  });

  it("both accepted: the card ends up in exactly one place, and the response that lost it is not resolved on it", () => {
    const g = setup();
    const r = fire(g, JACKPOT_RESPONSE, LADY_RESPONSE);
    expect(whereIs(r.state, g.jackpot)).toHaveLength(1);
    const resolved = r.events.filter(
      (e) => e.type === "abilityResolved" && [JACKPOT_RESPONSE, LADY_RESPONSE].includes(String(e.abilityId)),
    );
    expect(resolved).toHaveLength(1);
    expect(hasOffer(r.offered, LADY_RESPONSE) || hasOffer(r.offered, JACKPOT_RESPONSE)).toBe(true);
  });

  it("The Painted Lady stops at 3 cards, and is offered again once her action has taken one off her", () => {
    let s = withoutTough(game([DOMINO]));
    const lady = playCard(s, "40045", 1);
    const pistol = playCard(lady.state, "40046", 2, firstLegal, P1, identityOf(lady.state));
    s = pistol.state;
    const fireOnce = (st: GameState) => {
      const stacked = patchInstance(st, pistol.id, { exhausted: false });
      return driveOffers(stacked, accepting(LADY_RESPONSE), use(P1, pistol.id, "40046.dominos-pistol-action"));
    };
    const attachedToLady = (st: GameState) =>
      Object.values(st.instances).filter((i) => i.attachedTo === lady.id).length;
    for (let n = 1; n <= 3; n++) {
      const r = fireOnce(s);
      expect(hasOffer(r.offered, LADY_RESPONSE), `discard ${n}`).toBe(true);
      s = r.state;
    }
    expect(attachedToLady(s)).toBe(3);
    const full = fireOnce(s);
    expect(hasOffer(full.offered, LADY_RESPONSE), "a fourth card").toBe(false);
    expect(attachedToLady(full.state)).toBe(3);
    // Alter-ego Action: take one card into hand; then, in hero form again, the next discard is answered.
    const alter = withForm(full.state, "alterEgo");
    const taken = driveEventsPicking(WAVE7_DEPS, alter, firstLegal, use(P1, lady.id, "40045.the-painted-lady-action"));
    expect(attachedToLady(taken.state)).toBe(2);
    const again = fireOnce(withForm(taken.state, { heroForm: 0 }));
    expect(hasOffer(again.offered, LADY_RESPONSE)).toBe(true);
    expect(attachedToLady(again.state)).toBe(3);
  });
});

describe("Lucky Break (40048) against each kind of encounter card", () => {
  const LUCKY_BREAK = "40048.lucky-break-interrupt";
  /** Domino with Lucky Break attached; `code` is revealed to her in the villain phase and Lucky Break is accepted. */
  function revealUnderLuckyBreak(code: string) {
    const base = game([DOMINO]);
    const lb = playCard(base, "40048", 0, firstLegal, P1, identityOf(base));
    const staged = stageNemesisCardForReveal(lb.state, code, P1, 1);
    const id = instancesOf(staged, code)[0]!;
    const r = driveOffers(staged, accepting(LUCKY_BREAK), endTurn(P1));
    return { ...r, id, lb: lb.id, staged };
  }
  const encounterDiscard = (s: GameState): InstanceId[] =>
    Object.values(s.encounterDecks).flatMap((d) => [...d.discard]);

  // Lucky Break: "When you reveal an encounter card ... cancel the effects of that card and discard it. Reveal another
  // card from the encounter deck." RRG "Cancel" (p. 11): a canceled revealed card's effects do not happen.
  it("a revealed minion (Topaz) is canceled and discarded: not in play, no Superpower Feedback fetched", () => {
    const r = revealUnderLuckyBreak("40066");
    expect(hasOffer(r.offered, LUCKY_BREAK)).toBe(true);
    expect(r.state.players[0]!.playArea).not.toContain(r.id);
    expect(encounterDiscard(r.state)).toContain(r.id);
    expect(instancesOf(r.state, "40069").filter((id) => inst(r.state, id).attachedTo !== null)).toEqual([]);
    expect(r.state.removedFromGame).not.toContain(r.lb);
    expect(discardOf(r.state)).toContain(r.lb);
  });

  it("a revealed side scheme (Not My Lucky Day) is canceled and discarded: not in play, no damage, no threat", () => {
    const r = revealUnderLuckyBreak("40067");
    expect(hasOffer(r.offered, LUCKY_BREAK)).toBe(true);
    expect(r.state.villainArea).not.toContain(r.id);
    expect(encounterDiscard(r.state)).toContain(r.id);
    // Juggernaut's own attack hurts Domino in this phase; what must be absent is the card's When Revealed.
    expect(r.events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === "40067.when-revealed")).toBe(
      false,
    );
    const control = driveOffers(r.staged, firstLegal, endTurn(P1));
    expect(
      control.events.some((e) => e.type === "abilityResolved" && String(e.abilityId) === "40067.when-revealed"),
    ).toBe(true);
  });

  it("declined: the minion resolves its When Revealed (Topaz fetches Superpower Feedback), Lucky Break stays", () => {
    const base = game([DOMINO]);
    const lb = playCard(base, "40048", 0, firstLegal, P1, identityOf(base));
    const staged = stageNemesisCardForReveal(lb.state, "40066", P1, 1);
    const topaz = instancesOf(staged, "40066")[0]!;
    const r = driveOffers(staged, firstLegal, endTurn(P1));
    expect(r.state.players[0]!.playArea).toContain(topaz);
    expect(inst(r.state, lb.id).attachedTo).toBe(identityOf(r.state));
    expect(instancesOf(r.state, "40069").some((id) => inst(r.state, id).attachedTo === identityOf(r.state))).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Whole-state invariants, the nemesis sweep and expert games
// ---------------------------------------------------------------------------------------------------------------------

/** Every list an instance can sit in, labeled; attachments and boost cards are listed under their host. */
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
    if (choice.minSelections > choice.options.length)
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
}
const dealtSet = (s: GameState): Set<string> => {
  const out = new Set<string>();
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const) for (const id of p[zone]) out.add(id);
  return out;
};

const HOPE_SUMMERS = "40130";
/**
 * The driver's own answer, except that Hope Summers never defends: "If Hope Summers is defeated, you lose" (the Hope
 * Summers set, auto-included in every box scenario), and the greedy driver, which defends with any ally, loses round 1
 * that way. A policy for the driver, not a rule.
 */
function ownAnswer(s: GameState): readonly string[] | null {
  const choice = s.pendingChoice;
  if (choice?.prompt.kind !== "declareDefender") return null;
  const ids = choice.options.map((o) => o.optionId);
  const allies = ids.filter(
    (id) => id !== "decline" && typeOf(s, id as InstanceId) === "ally" && codeOf(s, id as InstanceId) !== HOPE_SUMMERS,
  );
  if (allies[0]) return [allies[0]];
  return ids.includes("decline") ? ["decline"] : null;
}

/** Plays by the greedy driver one command at a time, checking every state, up to `maxCommands` or an outcome. */
function playChecked(initial: GameState, maxCommands: number): { session: GameSession; commands: number } {
  const dealt = dealtSet(initial);
  checkState(initial, dealt, "start");
  let session = startSession(initial);
  let commands = 0;
  let lastRound = initial.round;
  while (!session.state.outcome && commands < maxCommands) {
    const own = ownAnswer(session.state);
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
    // The villain phase always completes into exactly the next round.
    expect(session.state.round - lastRound).toBeLessThanOrEqual(1);
    lastRound = session.state.round;
  }
  return { session, commands };
}
function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

describe("Every card of both nemesis sets and both obligations, revealed and fully resolved", () => {
  /** Reveals `code` (set aside for `owner`) in a Cable + Domino game, answering prompts with `pick`, then to the next round. */
  function revealed(code: string, owner: PlayerId, pick: Picker) {
    const base = game([CABLE, DOMINO]);
    // The card goes behind the boost cards of the villain's two activations and the cards dealt to earlier seats; a
    // Juggernaut deck holds too few copies of any one filler, so the cards on top are whatever they are.
    const set = stackSetAside(base, code, owner);
    const id = instancesOf(set, code)[0]!;
    const deckId = Object.keys(set.encounterDecks)[0]!;
    const pile = set.encounterDecks[deckId]!;
    const rest = pile.deck.filter((x) => x !== id);
    const at = owner === P1 ? 2 : 3;
    const staged: GameState = {
      ...set,
      encounterDecks: {
        ...set.encounterDecks,
        [deckId]: { ...pile, deck: [...rest.slice(0, at), id, ...rest.slice(at)] },
      },
    };
    const seen = new Set<string>();
    const dealt = dealtSet(staged);
    const run: Picker = (s) => {
      checkState(s, dealt, `reveal ${code}`);
      for (const o of s.pendingChoice?.options ?? []) seen.add(o.optionId);
      return pick(s);
    };
    const r = driveEventsPicking(WAVE7_DEPS, staged, run, endTurn(P1));
    const done = driveEventsPicking(WAVE7_DEPS, r.state, run, endTurn(P2));
    return { state: done.state, id, events: [...r.events, ...done.events] };
  }
  const lastLegal: Picker = (s) => {
    const c = s.pendingChoice;
    if (!c) return [];
    if (c.prompt.kind === "declareDefender") return ["decline"];
    return c.options.slice(Math.max(0, c.options.length - Math.max(c.minSelections, 1))).map((o) => o.optionId);
  };

  const CABLE_SET: readonly string[] = ["40032", "40033", "40034", "40035", "40036"];
  const DOMINO_SET: readonly string[] = ["40066", "40067", "40068"];
  const cases = [...CABLE_SET.map((c) => [c, P1] as const), ...DOMINO_SET.map((c) => [c, P2] as const)];
  it.each(cases)(
    "%s revealed to its own hero: the round completes with every invariant intact (first and last options)",
    (code, owner) => {
      for (const pick of [firstLegal, lastLegal]) {
        const r = revealed(code, owner, pick);
        expect(r.state.pendingChoice, `${code}: nothing left pending`).toBeNull();
        expect(r.state.round).toBe(2);
        checkState(r.state, dealtSet(r.state), `after ${code}`);
      }
    },
  );

  it("Stryfe, Prototype and Topaz are each in play (or discarded by their own text) after a reveal, never left in the deck", () => {
    for (const [code, owner] of [
      ["40032", P1],
      ["40066", P2],
      ["40068", P2],
    ] as const) {
      const r = revealed(code, owner, firstLegal);
      const zones = zoneIndex(r.state).get(r.id)!;
      expect(zones.length, code).toBe(1);
      expect(zones[0], code).not.toMatch(/\.deck$/);
    }
  });

  it("the obligations: Technovirus Resurgence and Memories of Armageddon resolve for their own hero in a two hero game", () => {
    const base = game([CABLE, DOMINO]);
    for (const [code, owner] of [
      ["40031", P1],
      ["40065", P2],
    ] as const) {
      const id = instancesOf(base, code)[0]!;
      const deckId = Object.keys(base.encounterDecks)[0]!;
      const pile = base.encounterDecks[deckId]!;
      const rest = pile.deck.filter((x) => x !== id);
      // Villain activations take one boost card per player, then each seat is dealt a card in turn order.
      const place = owner === P1 ? 2 : 3;
      const stacked: GameState = {
        ...base,
        encounterDecks: {
          ...base.encounterDecks,
          [deckId]: { ...pile, deck: [...rest.slice(0, place), id, ...rest.slice(place)] },
        },
      };
      const dealt = dealtSet(stacked);
      const run: Picker = (s) => {
        checkState(s, dealt, `obligation ${code}`);
        return firstLegal(s);
      };
      const r = driveEventsPicking(WAVE7_DEPS, stacked, run, endTurn(P1), endTurn(P2));
      expect(r.state.pendingChoice).toBeNull();
      const where = zoneIndex(r.state).get(id)!;
      // Memories stays in its player's play area; Resurgence attaches to Purge (host in play).
      if (code === "40065") expect(where).toEqual([`${owner}.playArea`]);
      else expect(inst(r.state, id).attachedTo).toBe(purgeOf(r.state));
    }
  });
});

describe("Cable and Domino playing into each other's board", () => {
  // Bodyslide (40002): "Change form. Each other player may change to the form you are in." RRG "Form, Change Form": the
  // once-per-round limit is for a player's own voluntary change; an effect is not counted against it (cable/events.ts).
  it("Bodyslide moves Domino to alter-ego form even when she has already used her change of the round", () => {
    const base = game([CABLE, DOMINO]);
    const tired = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P2 ? { ...p, identity: { ...p.identity, changedFormThisRound: true } } : p,
      ),
    } as GameState;
    const accept: Picker = (s) => {
      const c = s.pendingChoice;
      const yes = c?.options.find((o) => /alter/i.test(String((o as { label?: string }).label ?? o.optionId)));
      return yes ? [yes.optionId] : firstLegal(s);
    };
    const seen: string[][] = [];
    const r = playCard(tired, "40002", 0, spy("chooseOne", seen, accept));
    expect(playerOf(r.state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(r.state, P2).identity.form).toBe("alterEgo");
    expect(playerOf(r.state, P2).identity.changedFormThisRound).toBe(true); // unchanged: the effect did not spend it
  });

  // Luck Be a Lady (40041): [energy] "Heal 2 damage from a character", any character, including the other hero.
  it("Domino's Luck Be a Lady can heal Cable (a character another player controls)", () => {
    let s = game([CABLE, DOMINO]);
    s = patchInstance(s, identityOf(s, P1), { damage: 3 });
    s = putOnTopOfDeck(s, P2, "40052").state; // one energy icon
    const turn = driveEventsPicking(WAVE7_DEPS, s, firstLegal, endTurn(P1)).state;
    const aim: Picker = (st) => {
      const c = st.pendingChoice;
      return c?.options.some((o) => o.optionId === identityOf(st, P1)) ? [identityOf(st, P1)] : firstLegal(st);
    };
    const r = playCard(turn, "40041", 1, aim, P2);
    expect(damageOf(r.state, identityOf(r.state, P1))).toBe(1);
  });
});

describe("Technovirus Resurgence's printed acceleration icon", () => {
  // Data 40031: schemeIcons ["acceleration"]. RRG "Acceleration Icon" (p. 5): 1 more threat on the main scheme in step one of
  // the villain phase for each acceleration icon in play. Attached to Technovirus Purge the obligation is in play.
  it("adds 1 threat to the main scheme per villain phase while it is attached, and nothing once it is gone", () => {
    const base = game([CABLE]);
    const id = instancesOf(base, "40031")[0]!;
    const purge = purgeOf(base);
    // Surgery: the obligation attached to Purge (its When Revealed is proven in cable/obligation-nemesis.test.ts).
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const attached = patchInstance(
      {
        ...base,
        encounterDecks: {
          ...base.encounterDecks,
          [deckId]: {
            ...base.encounterDecks[deckId]!,
            deck: base.encounterDecks[deckId]!.deck.filter((x) => x !== id),
          },
        },
      } as GameState,
      id,
      { attachedTo: purge, faceup: true },
    );
    const withIt = patchInstance(attached, purge, { attachments: [id] });
    const without = patchInstance(
      {
        ...attached,
        encounterDecks: {
          ...attached.encounterDecks,
          [deckId]: { ...attached.encounterDecks[deckId]!, discard: [...attached.encounterDecks[deckId]!.discard, id] },
        },
      } as GameState,
      id,
      { attachedTo: null },
    );
    const phase = (st: GameState) => driveEventsPicking(WAVE7_DEPS, st, firstLegal, endTurn(P1)).state;
    const a = phase(withIt);
    const b = phase(without);
    expect(threat(a, mainOf(a)) - threat(b, mainOf(b))).toBe(1);
  });
});

describe("Expert-mode games with step invariants and a deep-equal replay", () => {
  /**
   * Plays one expert game per seed (every state checked, every log replayed to a deep-equal state). The greedy driver
   * often loses expert games in a round or two, so several seeds run and the best one must get past round 2.
   */
  function expertSeeds(players: readonly Seat[], scenario: string, seeds: readonly number[]): void {
    const rounds: number[] = [];
    for (const seed of seeds) {
      const r = playChecked(game(players, { scenario, difficulty: "expert", seed }), 300);
      expectReplays(r.session);
      rounds.push(r.session.state.round);
    }
    expect(Math.max(...rounds), `rounds reached per seed: ${rounds.join(", ")}`).toBeGreaterThanOrEqual(3);
  }

  it("Cable (precon) against Juggernaut, expert, on six seeds", () => {
    expertSeeds([CABLE], "juggernaut", [1, 2, 3, 4, 5, 6]);
  });

  it("Domino (precon) against Mister Sinister, expert, on six seeds", () => {
    expertSeeds([DOMINO], "mister-sinister", [1, 2, 3, 4, 5, 6]);
  });

  it("Cable and Domino together against Morlock Siege, expert (two seats, the box's two nemesis sets), on four seeds", () => {
    expertSeeds([CABLE, DOMINO], "morlock-siege", [1, 2, 3, 4]);
  });
});
