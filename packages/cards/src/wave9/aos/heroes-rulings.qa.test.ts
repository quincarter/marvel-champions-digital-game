/**
 * Rules QA for the Agents of S.H.I.E.L.D. box's two heroes and its player cards (`aos`: Maria Hill 50001a/b to 50011,
 * Nick Fury 50034a/b to 50046, `aspect-basic.ts` 50012 to 50028 and 50047 to 50058; the scenarios and encounter sets
 * are a later audit): the interactions the module tests do not assert, each tied to an RRG 1.8 section
 * (`mc_rulesreference_v18_compressed.pdf`), an FFG ruling by its date heading (marvel-champions-rulings-post-rrg-1-7.md)
 * or an owner answer (docs/phase7-wave9.md section 4.1). A `FINDING` comment marks a case where the game and its
 * source disagree: the expected behavior is an `it.fails`, with a passing companion that pins today's behavior.
 * Findings are tabled in docs/phase7-wave9-qa.md.
 */
import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
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
  patchInstance,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { AOS_ABILITIES } from "./index.js";

vi.setConfig({ testTimeout: 180_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, AOS_ABILITIES) };

const HILL_ALLY = "50036";
const SUPPORT_STAFF = "50008";
const SPECIAL_FUNDING = "50007";
const HARD_CALL = "50006";
const APB = "50003";
const AGENTS = "50015";
const COMMAND_TEAM = "50016";
const SKY_DESTROYER = "50057";
const JEMMA = "50055";
const LMD = "50010";
const EM_SHIELD = "50042";
const EYEPATCH = "50043";
const ANALYSIS = "50045";
const SECRET_AGENT = "50046";
const PRISM_DUST = "50052";
const INFORMANT = "50050";
const FIRE = "50037";
const SURVEIL = "50038";
const SPRAY = "50039";
const BLACK_CAT = "01002"; // a Core ally, not S.H.I.E.L.D.
const MERCENARY = "01101"; // Hydra Mercenary: minion ATK 1, SCH 0, 3 hit points, 1 boost icon
const SHOCKER = "01103"; // minion, 3 hit points
const FILLER = "01098"; // Armored Rhino Suit: 0 boost icons
const KREE = "01178"; // Kree Manipulator: "Surge. When Revealed: Place 1 threat on the main scheme."
const CROWD_CONTROL = "01108"; // a side scheme with the crisis icon

const ASSAULT = "assault-interrupt";
const GATHER_INTEL = "50034a.star-gather-intel";
const SECRET_AGENT_RESPONSE = "50046.secret-agent-response";

// ---------------------------------------------------------------------------------------------------------------------
// Staging
// ---------------------------------------------------------------------------------------------------------------------

type Deck = "nick-fury-justice" | "maria-hill-leadership";

/** The printed precon (and optionally Core's Spider-Man precon as the second seat) against Rhino, past setup. */
function game(
  deck: Deck,
  opts: { readonly twoPlayers?: boolean; readonly seed?: number; readonly second?: Deck } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const seats = [wave9StarterDeckSetup(deck)];
  if (opts.second) seats.push(wave9StarterDeckSetup(opts.second));
  else if (opts.twoPlayers) seats.push(wave9StarterDeckSetup("core-spider-man-justice"));
  const created = createGame({ ...base, requireLegalDecks: false, players: seats }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const fury = (opts: Parameters<typeof game>[1] = {}): GameState =>
  withForm(game("nick-fury-justice", opts), { heroForm: 0 });
const hill = (opts: Parameters<typeof game>[1] = {}): GameState =>
  withForm(game("maria-hill-leadership", opts), { heroForm: 0 });

/**
 * Staging surgery: a copy of `code` in `player`'s hand (the first one found in hand, deck or discard, else the bottom
 * deck card relabeled), skipping the instances in `exclude`.
 */
function give(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  exclude: readonly InstanceId[] = [],
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !exclude.includes(id);
  const found = owner.hand.find(wanted) ?? owner.deck.find(wanted) ?? owner.discard.find(wanted);
  const used = (id: InstanceId) => exclude.includes(id);
  const id = found ?? [...owner.deck].reverse().find((i) => !used(i))!;
  const relabeled = found ? state : patchInstance(state, id, { cardId: cardId(code) });
  const moved: GameState = {
    ...relabeled,
    players: relabeled.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            deck: p.deck.filter((i) => i !== id),
            discard: p.discard.filter((i) => i !== id),
            hand: p.hand.includes(id) ? p.hand : [...p.hand, id],
          }
        : p,
    ),
  };
  return { state: moved, id };
}

/** Staging surgery: `code` straight into `player`'s play area (or attached to their identity), faceup and ready. */
function put(
  state: GameState,
  code: string,
  opts: {
    readonly player?: PlayerId;
    readonly attach?: boolean;
    readonly counters?: Readonly<Record<string, number>>;
    readonly exclude?: readonly InstanceId[];
  } = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const player = opts.player ?? P1;
  const given = give(state, code, player, opts.exclude);
  const id = given.id;
  const host = identityOf(given.state, player);
  const base: GameState = {
    ...given.state,
    players: given.state.players.map((p) => {
      if (p.playerId !== player) return p;
      const hand = p.hand.filter((i) => i !== id);
      return opts.attach ? { ...p, hand } : { ...p, hand, playArea: [...p.playArea, id] };
    }),
  };
  const placed = patchInstance(base, id, {
    faceup: true,
    controllerId: player,
    counters: { ...opts.counters },
    ...(opts.attach ? { attachedTo: host } : {}),
  });
  return {
    id,
    state: opts.attach
      ? patchInstance(placed, host, { attachments: [...placed.instances[host]!.attachments, id] })
      : placed,
  };
}

/** A Core minion put straight into play engaged with `player` under the instance id `slot` (no reveal). */
function engage(state: GameState, code: string, slot: string, player: PlayerId = P1): GameState {
  const id = slot as InstanceId;
  const instance = {
    instanceId: id,
    cardId: code,
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
  } as never;
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...state.instances, [id]: instance },
  };
}

const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const mainThreat = (s: GameState): number => inst(s, schemeOf(s)).threat;
const suitOf = (s: GameState, player: PlayerId = P1): InstanceId =>
  cardsInPlay(s).find(
    (id) => (s.instances[id]!.cardId as string) === "50035a" && s.instances[id]!.controllerId === player,
  )!;
const suitThreat = (s: GameState): number => inst(s, suitOf(s)).threat;
const showsStealth = (s: GameState): boolean => inst(s, suitOf(s)).flipped;
const withSuit = (s: GameState, patch: { threat?: number; flipped?: boolean }): GameState =>
  patchInstance(s, suitOf(s), patch);
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: n } });
const inDiscard = (s: GameState, id: InstanceId, player: PlayerId = P1): boolean =>
  playerOf(s, player).discard.includes(id);
const myDamage = (s: GameState, player: PlayerId = P1): number => inst(s, identityOf(s, player)).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

interface Plan {
  /** Ability-id suffixes to take when a trigger is offered; everything else is declined. */
  readonly take?: readonly string[];
  readonly number?: number;
  /** An option label prefix to answer a chooseOption with. */
  readonly option?: string;
  readonly target?: InstanceId;
  readonly defender?: InstanceId;
  /** The hand card to discard first when the hand-size discard is asked. */
  readonly discard?: InstanceId;
  /** Records every trigger id offered, every option label and every number range asked. */
  readonly seen?: string[];
}
const planned =
  (plan: Plan = {}): Picker =>
  (s) => {
    const c = s.pendingChoice!;
    const ids = c.options.map((o) => o.optionId as string);
    switch (c.prompt.kind) {
      case "chooseTriggers": {
        plan.seen?.push(...ids);
        const hit = ids.find((id) => plan.take?.some((t) => id.endsWith(t)));
        return hit ? [hit] : [];
      }
      case "chooseNumber":
        plan.seen?.push(`number:${c.prompt.min}-${c.prompt.max}`);
        return [String(plan.number ?? c.prompt.max)];
      case "declareDefender":
        return [plan.defender !== undefined && ids.includes(plan.defender) ? plan.defender : "decline"];
      case "discardDownToHandSize":
        return [
          ...(plan.discard !== undefined && ids.includes(plan.discard) ? [plan.discard] : []),
          ...ids.filter((id) => id !== plan.discard),
        ].slice(0, c.minSelections);
      case "chooseOption": {
        plan.seen?.push(...c.options.map((o) => `option:${o.label}`));
        const hit = plan.option ? c.options.find((o) => o.label.startsWith(plan.option!)) : undefined;
        return hit ? [hit.optionId as string] : firstLegal(s);
      }
      case "chooseTarget":
        plan.seen?.push(...ids.map((id) => `target:${id}`));
        return plan.target !== undefined && ids.includes(plan.target) ? [plan.target] : firstLegal(s);
      default:
        return firstLegal(s);
    }
  };
const run = (s: GameState, plan: Plan, ...commands: readonly Command[]) =>
  driveEventsPicking(DEPS, s, planned(plan), ...commands);
const offered = (seen: readonly string[], suffix: string): boolean => seen.some((id) => id.endsWith(suffix));

const basicAttack = (s: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(s),
  targetInstanceId: villainOf(s),
});
const basicThwart = (s: GameState, thwarter: InstanceId = identityOf(s)): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: schemeOf(s),
});

/** The encounter deck's top cards relabeled to `codes` (the first is Rhino's boost card), the rest to harmless fillers. */
function stage(s: GameState, ...codes: readonly string[]): GameState {
  const pile = s.encounterDecks[activeEncounterDeckId(s)]!;
  return pile.deck
    .slice(0, codes.length + 8)
    .reduce((acc, id, index) => patchInstance(acc, id, { cardId: cardId(codes[index] ?? FILLER) }), s);
}
const villainPhase = (s: GameState, plan: Plan, ...codes: readonly string[]) =>
  run(stage(s, ...codes), plan, endTurn(P1), ...(s.players.length > 1 ? [endTurn(P2)] : []));

// ---------------------------------------------------------------------------------------------------------------------
// A replaced attack or thwart (stun, confuse)
// ---------------------------------------------------------------------------------------------------------------------

describe("a stunned or confused Nick Fury (RRG 1.8 'Stun' p. 41, 'Confuse' p. 13, 'Replacement Effect' p. 37, 'Interrupt' p. 25)", () => {
  // Stun: "When this character would attack, remove each stunned status card instead ... that character is not
  // considered to have attacked". Replacement Effect: "no further interrupts or responses to that effect can be
  // triggered". Break Cover and Assault are interrupts to "when you attack"; a replaced attack never happens.

  it("a stunned Fury in Stealth makes a basic attack: the stun is spent, Break Cover does not fire (still Stealth) and Assault is not offered", () => {
    const s = withStatus(withSuit(fury(), { threat: 4, flipped: true }), identityOf(fury()), "stunned");
    const seen: string[] = [];
    const r = run(s, { take: [ASSAULT], seen }, basicAttack(s));
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(offered(seen, ASSAULT)).toBe(false);
    expect(showsStealth(r.state)).toBe(true);
    expect(suitThreat(r.state)).toBe(4);
  });

  it("a stunned Fury in Stealth plays Concentrated Fire: the event is played and spent (ruling August 13, 2026 - Ruling 1 (1)), no damage, no choice, Break Cover does not fire", () => {
    const base = withSuit(fury(), { threat: 4, flipped: true });
    const stunned = withStatus(base, identityOf(base), "stunned");
    const given = give(stunned, FIRE);
    const seen: string[] = [];
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 2);
    const r = run(given.state, { seen }, play(P1, given.id, pay));
    expect(inDiscard(r.state, given.id)).toBe(true);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
    expect(seen.some((s) => s.startsWith("option:"))).toBe(false);
    expect(showsStealth(r.state)).toBe(true);
    expect(suitThreat(r.state)).toBe(4);
  });

  it("a stunned Fury plays Covert Surveillance (thwart): stun cancels only an attack, so the scheme loses 2 and the stun stays", () => {
    const base = withSuit(fury(), { flipped: true });
    const stunned = withStatus(patchInstance(base, schemeOf(base), { threat: 5 }), identityOf(base), "stunned");
    const given = give(stunned, SURVEIL);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 1);
    const r = run(given.state, { option: "Place that threat" }, play(P1, given.id, pay));
    expect(mainThreat(r.state)).toBe(3);
    expect(suitThreat(r.state)).toBe(2);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(1);
  });

  it("a confused Fury in Stealth plays Covert Surveillance: the whole labeled ability is canceled (RRG 'Labeled Ability' p. 26): nothing removed or placed, the confused card goes, the event is spent", () => {
    const base = withSuit(fury(), { flipped: true });
    const confused = withStatus(patchInstance(base, schemeOf(base), { threat: 5 }), identityOf(base), "confused");
    const given = give(confused, SURVEIL);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 1);
    const r = run(given.state, { option: "Place that threat" }, play(P1, given.id, pay));
    expect(mainThreat(r.state)).toBe(5);
    expect(suitThreat(r.state)).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
    expect(inDiscard(r.state, given.id)).toBe(true);
  });

  it("a confused Fury in Assault plays Covert Surveillance: the optional change to Stealth is part of the canceled ability, so the suit stays on Assault", () => {
    const base = withSuit(fury(), { flipped: false });
    const confused = withStatus(patchInstance(base, schemeOf(base), { threat: 5 }), identityOf(base), "confused");
    const given = give(confused, SURVEIL);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 1);
    const r = run(given.state, { option: "Change to Stealth" }, play(P1, given.id, pay));
    expect(mainThreat(r.state)).toBe(5);
    expect(showsStealth(r.state)).toBe(false);
  });

  it("a confused Fury's basic thwart is replaced: Gather Intel (a response to a basic thwart made) is not offered and the scheme keeps its threat", () => {
    const base = patchInstance(fury(), schemeOf(fury()), { threat: 5 });
    const confused = withStatus(base, identityOf(base), "confused");
    const seen: string[] = [];
    const r = run(confused, { take: [GATHER_INTEL], seen }, basicThwart(confused));
    expect(inst(r.state, identityOf(r.state)).statuses.confused).toBe(0);
    expect(mainThreat(r.state)).toBe(5);
    expect(offered(seen, GATHER_INTEL)).toBe(false);
    expect(suitThreat(r.state)).toBe(0);
  });

  it("a confused Maria Hill ally's basic thwart is replaced: 'When Maria Hill thwarts' does not fire and nothing is placed on the suit", () => {
    const staged = put(patchInstance(fury(), schemeOf(fury()), { threat: 5 }), HILL_ALLY);
    const confused = withStatus(staged.state, staged.id, "confused");
    const seen: string[] = [];
    const r = run(confused, { take: ["maria-hill-interrupt"], seen }, basicThwart(confused, staged.id));
    expect(inst(r.state, staged.id).statuses.confused).toBe(0);
    expect(mainThreat(r.state)).toBe(5);
    expect(offered(seen, "maria-hill-interrupt")).toBe(false);
    expect(suitThreat(r.state)).toBe(0);
  });

  it("a stunned Fury's Spray Fire (attack) is canceled too: neither the villain nor the engaged minion takes damage, and the stun is spent", () => {
    const base = engage(fury(), SHOCKER, "shock");
    const stunned = withStatus(base, identityOf(base), "stunned");
    const given = give(stunned, SPRAY);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 3);
    const r = run(given.state, {}, play(P1, given.id, pay));
    expect(inst(r.state, villainOf(r.state)).damage).toBe(0);
    expect(inst(r.state, "shock" as InstanceId).damage).toBe(0);
    expect(inst(r.state, identityOf(r.state)).statuses.stunned).toBe(0);
  });
});

describe("Concentrated Fire 50037 at a tough minion (RRG 1.8 'Tough' p. 44, 'Defeat' p. 15)", () => {
  it("4 damage is prevented in full and the tough card is spent: the minion is not defeated, so no choice follows and the suit is untouched", () => {
    const base = withStatus(engage(withSuit(fury(), { threat: 2 }), SHOCKER, "shock"), "shock" as InstanceId, "tough");
    const given = give(base, FIRE);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 2);
    const seen: string[] = [];
    const r = run(given.state, { seen, take: [ASSAULT], target: "shock" as InstanceId }, play(P1, given.id, pay));
    expect(inst(r.state, "shock" as InstanceId).damage).toBe(0);
    expect(inst(r.state, "shock" as InstanceId).statuses.tough).toBe(0);
    expect(cardsInPlay(r.state)).toContain("shock" as InstanceId);
    expect(seen.some((id) => id.startsWith("option:Place threat"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Crisis
// ---------------------------------------------------------------------------------------------------------------------

describe("the crisis icon and the threat-removing player cards (RRG 1.8 'Crisis Icon' p. 14)", () => {
  // "While at least one crisis icon is in play, threat cannot be removed from the main scheme by player cards."
  const crisis = (s: GameState, mainScheme = 5) => {
    const crowd = encounterCardInVillainArea(s, CROWD_CONTROL, 4);
    return { state: patchInstance(crowd.state, schemeOf(crowd.state), { threat: mainScheme }), crowd: crowd.id };
  };

  it("All-Points Bulletin with one S.H.I.E.L.D. support: the main scheme cannot lose threat while Crowd Control is in play, the side scheme can", () => {
    const staged = put(hill(), SUPPORT_STAFF);
    const { state, crowd } = crisis(staged.state);
    const given = give(state, APB);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 2);
    const r = run(given.state, { option: "Remove 1 threat", target: crowd }, play(P1, given.id, pay));
    expect(mainThreat(r.state)).toBe(5);
    expect(inst(r.state, crowd).threat).toBe(3);
  });

  it("Covert Surveillance cannot target the main scheme under crisis: only the side scheme is offered and the main scheme keeps its threat", () => {
    const base = withSuit(fury(), { flipped: true });
    const { state } = crisis(base);
    const given = give(state, SURVEIL);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 1);
    const seen: string[] = [];
    const r = run(given.state, { option: "Place that threat", seen }, play(P1, given.id, pay));
    // The main scheme is not a legal target while Crowd Control is in play: only the side scheme is offered.
    expect(seen).not.toContain(`target:${schemeOf(state)}`);
    expect(mainThreat(r.state)).toBe(5);
  });

  it("Secret Agent after a Preparation card resolves: the main scheme is not offered as the source under crisis (moving removes threat from it)", () => {
    const withShield = put(withSuit(fury(), {}), EM_SHIELD, { attach: true });
    const withAgent = put(withShield.state, SECRET_AGENT, { attach: true });
    const { state } = crisis(withAgent.state, 4);
    const seen: string[] = [];
    const r = villainPhase(state, { take: ["em-shield-interrupt", "secret-agent-response"], seen }, MERCENARY);
    // The main scheme only gains threat (the villain phase's own +1); the moved threat comes from the side scheme.
    expect(seen).not.toContain(`target:${schemeOf(state)}`);
    expect(mainThreat(r.state)).toBe(4 + 1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Stealth and the attack it replaces
// ---------------------------------------------------------------------------------------------------------------------

describe("Stealth 50035b replaces the attack (RRG 1.8 'Replacement Effect' p. 37, 'Interrupt' p. 25)", () => {
  // "If an interrupt changes (via a replacement effect) or cancels an imminent triggering condition, further interrupts to
  // the original triggering condition cannot be triggered."

  it("Life Model Decoy is not offered when Stealth turns Rhino's attack into a scheme: it stays attached", () => {
    const decoy = put(withSuit(fury(), { threat: 2, flipped: true }), LMD, { attach: true });
    const seen: string[] = [];
    const r = villainPhase(decoy.state, { take: ["life-model-decoy-interrupt"], seen }, MERCENARY);
    expect(offered(seen, "life-model-decoy-interrupt")).toBe(false);
    expect(inst(r.state, decoy.id).attachedTo).toBe(identityOf(r.state));
    expect(myDamage(r.state)).toBe(0);
  });

  it("Stealth then Eyepatch Camera on the same scheme: the camera is asked about the 1 threat Stealth left for the main scheme, not the full 2", () => {
    // Rhino SCH 1 + a 1-icon boost = 2 threat on the activation; Stealth diverts 1 to the suit, 1 would go on the main scheme.
    const camera = put(withSuit(fury(), { threat: 2, flipped: true }), EYEPATCH, { attach: true });
    const seen: string[] = [];
    const r = villainPhase(camera.state, { take: ["eyepatch-camera-interrupt"], number: 0, seen }, MERCENARY);
    const ranges = seen.filter((s) => s.startsWith("number:"));
    expect(ranges.length).toBeGreaterThan(0);
    // One range for the activation's remaining threat is 0-1; the villain phase's own threat is 0-1 as well.
    expect(ranges.every((s) => s === "number:0-1")).toBe(true);
    expect(suitThreat(r.state)).toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Two-player cases
// ---------------------------------------------------------------------------------------------------------------------

describe("Nick Fury beside a second player (ruling December 17, 2025 - Ruling 3; RRG 1.8 'Attack (Enemy Activation)' p. 8)", () => {
  // Ruling: Stealth Suit "triggers 'when' an enemy would attack ... Stealth Suit only triggers when Nick Fury would be
  // attacked". The villain activates once against each player; the attack on P2 is not an attack on Fury.

  it("Stealth: Rhino schemes against Fury but still attacks P2, whose hero takes the damage", () => {
    const s = withForm(withSuit(fury({ twoPlayers: true }), { threat: 2, flipped: true }), { heroForm: 0 }, P2);
    const r = villainPhase(s, {}, FILLER, FILLER, FILLER, FILLER);
    expect(ofType(r.events, "schemeResolved").length).toBe(1);
    expect(myDamage(r.state, P2)).toBeGreaterThan(0);
    expect(myDamage(r.state, P1)).toBe(0);
    expect(suitThreat(r.state)).toBe(3);
  });

  it("Life Model Decoy on Fury is not offered for the attack on P2", () => {
    const decoy = put(withSuit(fury({ twoPlayers: true }), { threat: 0, flipped: false }), LMD, { attach: true });
    const s = withForm(decoy.state, { heroForm: 0 }, P2);
    const seen: string[] = [];
    // Fury is in Assault, so Rhino attacks Fury first (Decoy offered, declined) and then P2 (not offered a second time).
    villainPhase(s, { seen }, FILLER, FILLER, FILLER, FILLER);
    expect(seen.filter((id) => id.endsWith("life-model-decoy-interrupt"))).toHaveLength(1);
  });

  it("Secret Agent hears only Preparation cards its own controller resolves: P2's Prism Dust (a Preparation upgrade) does not offer it to Fury", () => {
    const withAgent = put(fury({ twoPlayers: true }), SECRET_AGENT, { attach: true });
    const dust = put(withAgent.state, PRISM_DUST, { attach: true, player: P2 });
    const s = withForm(patchInstance(dust.state, schemeOf(dust.state), { threat: 4 }), { heroForm: 0 }, P2);
    const seen: string[] = [];
    // Two boost cards (one per activation), then the card dealt to P1 and the Mercenary dealt to P2: it enters play.
    const r = villainPhase(s, { take: ["prism-dust-response"], seen }, FILLER, FILLER, FILLER, MERCENARY);
    expect(offered(seen, "prism-dust-response")).toBe(true);
    expect(inDiscard(r.state, dust.id, P2)).toBe(true);
    expect(offered(seen, SECRET_AGENT_RESPONSE.split(".")[1]!)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Preparation cards with a label
// ---------------------------------------------------------------------------------------------------------------------

describe("Prism Dust 50052 is labeled (attack) (RRG 1.8 'Labeled Ability' p. 26, 'Stun' p. 41)", () => {
  it("a stunned Fury: the discard cost is paid but the whole ability is canceled, so the minion is neither confused nor damaged and the stun is spent", () => {
    const dust = put(fury(), PRISM_DUST, { attach: true });
    const stunned = withStatus(dust.state, identityOf(dust.state), "stunned");
    // Hydra Mercenary (third card) is dealt to Fury in the villain phase and enters play.
    const staged = stage(stunned, FILLER, MERCENARY);
    const r = run(staged, { take: ["prism-dust-response"] }, endTurn(P1));
    const entered = cardsInPlay(r.state).find((id) => (r.state.instances[id]!.cardId as string) === MERCENARY);
    expect(entered).toBeDefined();
    expect(inDiscard(r.state, dust.id)).toBe(true);
    expect(inst(r.state, entered!).damage).toBe(0);
    expect(inst(r.state, entered!).statuses.confused).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Cancel and keywords
// ---------------------------------------------------------------------------------------------------------------------

describe("Intelligence Analysis 50045 against a treachery with Surge (RRG 1.8 'Cancel' p. 11, 'Surge' p. 42; ruling August 3, 2026 - Ruling 3)", () => {
  // Cancel: "If the effects of a treachery card are canceled, the card is still regarded as revealed, and it is still
  // placed in the encounter discard pile." RRG 1.8 defines surge as "When Revealed: Deal yourself 1 facedown encounter
  // card"; the August 3, 2026 ruling: "Surge is treated as a When Revealed ability and can be cancelled". The FAQ for
  // Spider-Man Noir (RRG p. 63) reads surge as a keyword that still resolves when the When Revealed ability is canceled;
  // it predates the revised definition on p. 42 (flagged in docs/phase7-wave9-qa.md, not picked here).
  it("Kree Manipulator is canceled whole: no threat on the main scheme and its surge deals no further card", () => {
    const base = withSuit(fury(), { threat: 1 });
    const staged = stage(base, FILLER, KREE, FILLER, FILLER);
    const control = run(staged, {}, endTurn(P1));
    const analysis = put(staged, ANALYSIS, { attach: true });
    const r = run(analysis.state, { take: ["intelligence-analysis-interrupt"] }, endTurn(P1));
    // Control: Kree and then the surge's card are revealed. Canceled: only Kree is revealed, and the threat it would place is not.
    expect(ofType(control.events, "encounterCardRevealed")).toHaveLength(2);
    expect(ofType(r.events, "encounterCardRevealed")).toHaveLength(1);
    expect(mainThreat(r.state)).toBe(mainThreat(control.state) - 1);
    expect(suitThreat(r.state)).toBe(0);
  });
});

describe("Intelligence Analysis 50045 and what still happens when a treachery is canceled (RRG 1.8 'Cancel' p. 11, 'Resolve' p. 37)", () => {
  // Cancel: the ability "is still regarded as initiated, and any costs are still paid"; a canceled treachery "is still
  // regarded as revealed". So "after you reveal a treachery" and "after you resolve the ability of a Preparation card"
  // still happen.
  const WARD = "50022";
  const canceled = (extra: (s: GameState) => GameState, plan: Plan) => {
    const base = withSuit(fury(), { threat: 1 });
    const staged = extra(stage(base, FILLER, KREE, FILLER, FILLER));
    const analysis = put(staged, ANALYSIS, { attach: true });
    return {
      ...run(analysis.state, { ...plan, take: ["intelligence-analysis-interrupt", ...(plan.take ?? [])] }, endTurn(P1)),
      analysis: analysis.id,
    };
  };

  it("Grant Ward's Forced Response still answers the canceled treachery: the treachery was revealed, so not paying removes her and Fury takes her ATK (2)", () => {
    let ward: InstanceId | undefined;
    const r = canceled(
      (s) => {
        const w = put(s, WARD);
        ward = w.id;
        return w.state;
      },
      { option: "Do not spend" },
    );
    expect(cardsInPlay(r.state)).not.toContain(ward);
  });

  it("Secret Agent is offered after Intelligence Analysis resolves: the ability resolved (its effect was a cancel), so 1 threat moves from the main scheme to the suit", () => {
    const seen: string[] = [];
    const r = canceled((s) => put(s, SECRET_AGENT, { attach: true }).state, { take: ["secret-agent-response"], seen });
    expect(offered(seen, "secret-agent-response")).toBe(true);
    // Analysis removed 1 from the suit (1 -> 0); Secret Agent moves 1 back.
    expect(suitThreat(r.state)).toBe(1);
  });
});

describe("a confused minion's scheme is replaced (RRG 1.8 'Confuse' p. 13, 'Replacement Effect' p. 37)", () => {
  it("Informant and Quake hear nothing when a confused minion's scheme is replaced by removing the status card", () => {
    const base = game("nick-fury-justice");
    const informant = put(base, INFORMANT, { attach: true });
    const quake = put(informant.state, "50048");
    const sandy = withStatus(engage(quake.state, "01102", "sandy"), "sandy" as InstanceId, "confused");
    const seen: string[] = [];
    const r = villainPhase(sandy, { take: ["informant-interrupt", "quake-response"], seen }, FILLER, FILLER, FILLER);
    expect(inst(r.state, "sandy" as InstanceId).statuses.confused).toBe(0);
    expect(inst(r.state, "sandy" as InstanceId).damage).toBe(0);
    expect(inDiscard(r.state, informant.id)).toBe(false);
    // Rhino (the villain, not a minion) still schemes; neither card is offered for it either.
    expect(offered(seen, "informant-interrupt")).toBe(false);
    expect(offered(seen, "quake-response")).toBe(false);
  });
});

describe("Practiced Plan 50058 and a Preparation card discarded from hand (OPEN POINT; RRG 1.8 'Ownership and Control' p. 31; owner question 20 = B)", () => {
  // Question 20 reads "a card you control" as including the hand and deck (Front Organization). Practiced Plan says "After
  // you discard a Preparation card you control". The script hears only a Preparation card leaving play to the discard pile
  // (`cardLeavesPlay`), so a Preparation card discarded from the hand (here by the hand-size discard) is not heard. No
  // ruling says whether that discard is "you discard"; pinned as today's behavior, not an `it.fails`.
  it("Informant discarded from hand to the hand-size limit: Practiced Plan is not offered and Informant stays in the discard pile", () => {
    const plan = put(fury(), "50058", { attach: true });
    const informant = give(plan.state, INFORMANT);
    // Fill the hand beyond the hand size of 5 so that one card must go at the draw step.
    let s = informant.state;
    const extra = playerOf(s, P1).deck.slice(0, 4);
    s = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => !extra.includes(i)), hand: [...p.hand, ...extra] } : p,
      ),
    };
    const seen: string[] = [];
    const r = villainPhase(s, { take: ["practiced-plan-response"], seen, discard: informant.id }, FILLER, FILLER);
    expect(inDiscard(r.state, informant.id)).toBe(true);
    expect(offered(seen, "practiced-plan-response")).toBe(false);
  });
});

describe("Press Conference 50029 in a two-player game (card text: 'each support you control')", () => {
  it("only the Maria Hill player's supports lose a counter at the end of the player phase: the other player's Support Staff keeps its 3", () => {
    const duo = game("maria-hill-leadership", { second: "nick-fury-justice" });
    const mine = put(duo, SUPPORT_STAFF, { counters: { staff: 3 } });
    const theirs = put(mine.state, SUPPORT_STAFF, { player: P2, counters: { staff: 3 } });
    const conference = put(theirs.state, "50029");
    const r = villainPhase(conference.state, {}, FILLER, FILLER, FILLER, FILLER);
    expect(inst(r.state, mine.id).counters.staff).toBe(2);
    expect(inst(r.state, theirs.id).counters.staff).toBe(3);
  });
});

describe("Informant 50050 and Quake 50048 (card text; RRG 1.8 'Schemes' / 'Activation' p. 6)", () => {
  it("Informant turns a minion's scheme into threat removal, and 'after a minion schemes' still answers it: Quake deals 2 damage to that minion", () => {
    const base = game("nick-fury-justice");
    const informant = put(base, INFORMANT, { attach: true });
    const quake = put(informant.state, "50048");
    const withMinion = engage(quake.state, "01102", "sandy");
    const seen: string[] = [];
    const before = mainThreat(withMinion);
    const r = villainPhase(
      withMinion,
      { take: ["informant-interrupt", "quake-response"], seen },
      FILLER,
      FILLER,
      FILLER,
    );
    expect(offered(seen, "informant-interrupt")).toBe(true);
    expect(inDiscard(r.state, informant.id)).toBe(true);
    expect(offered(seen, "quake-response")).toBe(true);
    expect(inst(r.state, "sandy" as InstanceId).damage).toBe(2);
    expect(mainThreat(r.state)).toBeLessThan(before + 1 + 1 + 2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Maria Hill: trait grant, costs, printed values
// ---------------------------------------------------------------------------------------------------------------------

describe("Maria Hill's S.H.I.E.L.D. trait grant (card text 50001a; RRG 1.8 'Alter-Ego' / 'Form')", () => {
  it("Sky-Destroyer answers a Core ally (not S.H.I.E.L.D.) played in hero form: the ally has the trait by the time the response window opens", () => {
    const staged = put(hill(), SKY_DESTROYER);
    const cat = give(staged.state, BLACK_CAT);
    const pay = playerOf(cat.state, P1)
      .hand.filter((i) => i !== cat.id)
      .slice(0, 2);
    const seen: string[] = [];
    const r = run(cat.state, { take: ["sky-destroyer-response"], seen }, play(P1, cat.id, pay));
    expect(offered(seen, "sky-destroyer-response")).toBe(true);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(2);
  });

  it("the same ally played in alter-ego form does not offer Sky-Destroyer: the grant is printed on the hero face", () => {
    const base = withForm(hill(), "alterEgo");
    const staged = put(base, SKY_DESTROYER);
    const cat = give(staged.state, BLACK_CAT);
    const pay = playerOf(cat.state, P1)
      .hand.filter((i) => i !== cat.id)
      .slice(0, 2);
    const seen: string[] = [];
    run(cat.state, { take: ["sky-destroyer-response"], seen }, play(P1, cat.id, pay));
    expect(offered(seen, "sky-destroyer-response")).toBe(false);
  });

  it("Agents of S.H.I.E.L.D. is not offered to alter-ego Maria Hill who controls a Core ally: that ally lacks the trait without the hero face", () => {
    const agents = put(withForm(hill(), "alterEgo"), AGENTS);
    const cat = put(agents.state, BLACK_CAT);
    const seen: string[] = [];
    villainPhase(cat.state, { take: ["agents-of-shield-constant"], seen }, KREE, FILLER);
    expect(offered(seen, "agents-of-shield-constant")).toBe(false);
  });
});

describe("printed cost versus the cost paid (RRG 1.8 'Printed' p. 35)", () => {
  it("The Hard Call discarding Jemma Simmons deals 3 (her printed cost), not the 1 she cost to play with a S.H.I.E.L.D. identity", () => {
    const jemma = put(hill(), JEMMA);
    const given = give(jemma.state, HARD_CALL);
    const pay = playerOf(given.state, P1)
      .hand.filter((i) => i !== given.id)
      .slice(0, 2);
    const r = run(given.state, {}, play(P1, given.id, pay));
    expect(inDiscard(r.state, jemma.id)).toBe(true);
    expect(inst(r.state, villainOf(r.state)).damage).toBe(3);
  });

  it("On the Double sums printed costs: Jemma (3 printed, 1 paid) with Sky-Destroyer (3) is exactly 6 and accepted, with Command Team (2) added the 8 is refused", () => {
    const j = put(hill(), JEMMA);
    const c = put(j.state, COMMAND_TEAM, { counters: { command: 3 } });
    const k = put(c.state, SKY_DESTROYER);
    const exhausted = [j.id, c.id, k.id].reduce((acc, id) => patchInstance(acc, id, { exhausted: true }), k.state);
    const given = give(exhausted, "50004");
    const started = applyCommand(given.state, play(P1, given.id, []), DEPS);
    if (!started.ok) throw new Error(started.error.message);
    const choice = started.state.pendingChoice!;
    const answer = (ids: readonly InstanceId[]) =>
      applyCommand(
        started.state,
        { type: "resolveChoice", playerId: P1, choiceId: choice.choiceId, selectedOptionIds: [...ids] },
        DEPS,
      ).ok;
    expect(answer([j.id, k.id])).toBe(true);
    expect(answer([j.id, c.id, k.id])).toBe(false);
  });
});

describe("two Special Funding cards on one S.H.I.E.L.D. support (card text 50007; RRG 1.8 'Triggering Condition' p. 45)", () => {
  it("Sky-Destroyer (cost 3) paid with two Special Funding: each is its own response and each places a counter, 2 in all", () => {
    const base = hill();
    const first = give(base, SPECIAL_FUNDING);
    const second = give(first.state, SPECIAL_FUNDING, P1, [first.id]);
    const sky = give(second.state, SKY_DESTROYER);
    const seen: string[] = [];
    const r = run(sky.state, { take: ["special-funding-response"], seen }, play(P1, sky.id, [first.id, second.id]));
    const placedOn = playerOf(r.state, P1).playArea.find((id) => id === sky.id);
    expect(placedOn).toBeDefined();
    const counters = inst(r.state, sky.id).counters;
    expect(Object.values(counters).reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe("Life Model Decoy 50010 and an ally defender (RRG 1.8 'Attack (Enemy Activation)' p. 8)", () => {
  // The enemy "attacks you" when the attack initiates (before the defender is declared), so the Decoy is used on the
  // attack as initiated; "prevent all damage from that attack" then covers the damage the ally would take as defender.
  it("used with an ally declared as the defender afterwards: the ally takes no damage either", () => {
    const decoy = put(withSuit(fury(), { flipped: false }), LMD, { attach: true });
    const ally = put(decoy.state, HILL_ALLY);
    const r = villainPhase(ally.state, { take: ["life-model-decoy-interrupt"], defender: ally.id }, FILLER);
    expect(inDiscard(r.state, decoy.id)).toBe(true);
    expect(myDamage(r.state)).toBe(0);
    expect(inst(r.state, ally.id).damage).toBe(0);
  });
});
