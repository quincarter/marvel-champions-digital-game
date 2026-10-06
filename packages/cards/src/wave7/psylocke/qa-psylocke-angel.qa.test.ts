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
  resourceAbility,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { driveEventsPicking, encounterCardInVillainArea, stackSetAside, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Rules-QA pass over the Psylocke (41001-41033) and Angel (42001-42032) hero packs, wave 7 step 4
 * (docs/phase7-wave7-qa-psylocke-angel.md). The module tests and precon games prove each card where its author looked;
 * these tests go after the places a status card, a keyword, a form change or a second seat meets a card. Citations: RRG
 * 1.8 (the Markdown `mc_rulesreference_v18_compressed.md`, entries by name), the post-1.7 rulings by date, and owner
 * decisions by their `docs/phase7-wave7.md` section 4.1 Q number. `it.fails` pins a defect that is reported and not
 * fixed here: it passes while the defect stands and turns red the day it is fixed, the cue to delete the `.fails`.
 */

const PSYLOCKE = { starterDeckId: "psylocke-justice" } as const;
const ANGEL = { starterDeckId: "angel-protection" } as const;
type Seat = typeof PSYLOCKE | typeof ANGEL;

const STRYFE_ID = "stryfe";
const ARCLIGHT = "40094"; // a minion with Retaliate 1 (set mutant_slayers)

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const typeOf = (s: GameState, id: InstanceId): string => s.cardPool[s.instances[id]!.cardId]!.type;
const stryfe = (s: GameState): InstanceId => s.activeVillainId!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const statusOf = (s: GameState, id: InstanceId, kind: "confused" | "stunned" | "tough"): number =>
  inst(s, id).statuses[kind] ?? 0;
const handCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).hand.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p: PlayerId = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const bladesOf = (s: GameState, p: PlayerId = P1): InstanceId[] =>
  inst(s, identityOf(s, p)).attachments.filter((id) => codeOf(s, id) === "41002a");
const rejected = (s: GameState, c: Command): boolean => !applyCommand(s, c, WAVE7_DEPS).ok;
const give = (s: GameState, id: InstanceId, kind: "confused" | "stunned" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [kind]: n } });

type Face = "warren" | "angel" | "archangel" | "betsy" | "psylocke";
const FORM: Record<Face, { alterEgo: true } | { heroForm: number }> = {
  warren: { alterEgo: true },
  betsy: { alterEgo: true },
  angel: { heroForm: 0 },
  psylocke: { heroForm: 0 },
  archangel: { heroForm: 1 },
};

interface GameOpts {
  readonly scenario?: string;
  readonly seed?: number;
  readonly difficulty?: "standard" | "expert";
  readonly modular?: string[];
  /** Per seat: the face to start in (surgery); the main scheme is given headroom and Stryfe loses his tough card. */
  readonly faces?: readonly Face[];
  readonly keepTough?: boolean;
  readonly keepScheme?: boolean;
}

/** A game after setup with every seat in the face asked for; the scenario's start-up toughness is removed. */
function game(players: readonly Seat[], opts: GameOpts = {}): GameState {
  const config = wave7Scenario(opts.scenario ?? STRYFE_ID, {
    players,
    seed: opts.seed ?? 1,
    difficulty: opts.difficulty ?? "standard",
    modularSetIds: opts.modular ?? ["mutant_slayers"],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  (opts.faces ?? []).forEach((face, i) => {
    const to = FORM[face];
    if (!("alterEgo" in to)) s = withForm(s, to, i === 0 ? P1 : P2);
  });
  if (!opts.keepScheme) s = patchInstance({ ...s, villainArea: [] }, mainOf(s), { threat: 4 });
  if (!opts.keepTough && stryfe(s))
    s = patchInstance(s, stryfe(s), { statuses: { ...inst(s, stryfe(s)).statuses, tough: 0 } });
  return s;
}

/** A fresh instance of `code` (not in the player's deck) cloned from one of their own cards, put in their hand. */
let conjured = 9100;
function conjure(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const template = inst(state, owner.deck[0]!);
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: cardId(code),
    exhausted: false,
    flipped: false,
    attachments: [],
    attachedTo: null,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    damage: 0,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => (p.playerId === player ? { ...p, hand: [...p.hand, id] } : p)),
    },
  };
}
/** `code` in the player's hand, from their deck or discard if it is there, else conjured. */
function inHand(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  try {
    const given = moveToHand(state, player, code);
    return { state: given.state, id: given.ids[0]! };
  } catch {
    return conjure(state, player, code);
  }
}

/** A minion (Arclight by default, Retaliate 1) fabricated into `player`'s play area, engaged with them. */
let minionN = 9500;
function withMinion(state: GameState, player: PlayerId, code = ARCLIGHT): { state: GameState; id: InstanceId } {
  const id = `i${minionN++}` as InstanceId;
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

/** `code` attached to the player's identity as if played earlier (surgery: no cost, no windows). */
function attached(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = conjure(state, player, code);
  const identity = identityOf(state, player);
  const s: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== given.id) } : p,
    ),
  };
  const withCard = patchInstance(s, given.id, {
    home: { kind: "player" },
    attachedTo: identity,
    controllerId: player,
    faceup: true,
  } as unknown as Partial<CardInstance>);
  return {
    id: given.id,
    state: patchInstance(withCard, identity, { attachments: [...inst(withCard, identity).attachments, given.id] }),
  };
}

/** An ally of the player's own in play, ready (surgery: no cost, no windows). */
function allyInPlay(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const given = conjure(state, player, code);
  const s: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: p.hand.filter((x) => x !== given.id), playArea: [...p.playArea, given.id] }
        : p,
    ),
  };
  return {
    id: given.id,
    state: patchInstance(s, given.id, {
      home: { kind: "playArea", playerId: player },
      controllerId: player,
      faceup: true,
    } as unknown as Partial<CardInstance>),
  };
}

/** Puts the encounter card `id` behind the `n` cards now on top of the active encounter deck. */
function behind(state: GameState, id: InstanceId, n: number): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const rest = pile.deck.filter((x) => x !== id);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...rest.slice(0, n), id, ...rest.slice(n)] },
    },
  };
}
const endPhase = (state: GameState): Command[] => state.players.map((p) => endTurn(p.playerId));
/** Reveals set-aside nemesis `code` (owned by `owner`) in the villain phase, behind one boost card per player. */
function revealNemesis(state: GameState, code: string, pick: Picker = firstLegal, owner: PlayerId = P1) {
  const id = playerOf(state, owner).setAside.find((i) => codeOf(state, i) === code)!;
  const set = stackSetAside(state, code, owner);
  const driven = driveEventsPicking(WAVE7_DEPS, behind(set, id, set.players.length), pick, ...endPhase(set));
  return { ...driven, id };
}

/** Plays `code` for `cost`, paying with other hand cards; every prompt is answered by `pick`. */
function playCard(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
  keep: readonly string[] = [],
): { state: GameState; id: InstanceId; before: GameState; events: readonly GameEvent[] } {
  const given = inHand(state, player, code);
  const kept = playerOf(given.state, player).hand.filter((id) => keep.includes(codeOf(given.state, id)));
  const payment = payWith(given.state, player, cost, [given.id, ...kept]);
  const driven = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(player, given.id, payment));
  return { ...driven, id: given.id, before: given.state };
}
const refusedPlay = (state: GameState, code: string, cost: number, player: PlayerId = P1): boolean => {
  const given = inHand(state, player, code);
  return rejected(given.state, play(player, given.id, payWith(given.state, player, cost, [given.id])));
};

/** Picks these ids, one per prompt that offers the next one; other prompts as `firstLegal`. */
function queue(...ids: readonly InstanceId[]): Picker {
  const left = [...ids];
  return (s) => {
    const offered = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
    if (left.length > 0 && offered.includes(left[0]!)) return [left.shift()!];
    return firstLegal(s);
  };
}
/** Accepts the optional trigger whose id contains one of `abilities`, paying a hand-card cost; the rest as `inner`. */
const accepting =
  (abilities: string | readonly string[], inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (choice?.prompt.kind === "chooseTriggers") {
      const wanted = typeof abilities === "string" ? [abilities] : abilities;
      const hit = choice.options.find((o) => wanted.some((w) => o.optionId.includes(w)));
      return hit ? [hit.optionId] : [];
    }
    return inner(s);
  };
/** The identity is the one that defends when asked; other prompts as `inner`. */
const defending =
  (inner: Picker): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") return [identityOf(s, choice.playerId)];
    return inner(s);
  };
/** Every ability id offered at any trigger prompt while `pick` drives `commands`. */
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
/** Picks the face "0" (Angel), "1" (Archangel) or "alterEgo" when Metamorphosis asks; other prompts as `inner`. */
const changingTo =
  (to: string, inner: Picker = firstLegal): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind === "chooseOption" && choice.options.some((o) => o.optionId === to)) return [to];
    return inner(s);
  };
/** End-of-turn discard down to hand size that never discards these cards (by printed number). */
const keeping =
  (inner: Picker, ...codes: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice?.prompt.kind !== "discardDownToHandSize") return inner(s);
    return choice.options
      .filter((o) => !codes.includes(codeOf(s, o.optionId as InstanceId)))
      .slice(0, choice.minSelections)
      .map((o) => o.optionId);
  };

const basicAttack = (s: GameState, target: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: identityOf(s, p),
  targetInstanceId: target,
});

/** The blades' faces by play order: `true` is Psi-Katana, `false` Psi-Knife. */
function blades(state: GameState, faces: readonly [boolean, boolean], player: PlayerId = P1): GameState {
  return bladesOf(state, player).reduce((s, id, i) => patchInstance(s, id, { flipped: faces[i]! }), state);
}
const KATANAS = [true, true] as const;

// Event ids named in offers.
const REDIRECT = "41006.psionic-redirect-interrupt";
const FORCE = "41019.directed-force-interrupt";
const FLAIL = "41032.psi-flail-strike-response";
const INTERVENTION = "42014.aerial-intervention-interrupt";
const DEATH = "42001c.angel-of-death";

describe("Stunned and confused heroes using Psylocke's and Angel's labeled abilities", () => {
  // RRG "Labeled Ability" (p. 26): when a labeled ability is triggered while the identity has a status card that cancels
  // one of its types, the entire ability, costs excepted, is canceled, the identity is not considered to have attacked,
  // and each status card that cancels any of its types is removed. RRG "Stun, Stunned" (p. 41): costs must still be paid.
  it("stunned Psylocke: Flurry of Blades with two Psi-Katanas is paid for and canceled whole, the stun is removed", () => {
    const s0 = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const s = give(s0, identityOf(s0), "stunned");
    const r = playCard(s, "41004", 3, queue(stryfe(s)));
    expect(damageOf(r.state, stryfe(r.state))).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
    expect(discardCodes(r.state)).toContain("41004");
    expect(handCodes(r.state)).toHaveLength(handCodes(r.before).length - 1 - 3);
  });

  it("confused Psylocke: Mental Detection (thwart) removes no threat and draws nothing, the confused card goes", () => {
    const s0 = blades(game([PSYLOCKE], { faces: ["psylocke"] }), [false, true]);
    const s = give(s0, identityOf(s0), "confused");
    const r = playCard(s, "41005", 2);
    expect(threat(r.state, mainOf(r.state))).toBe(threat(s, mainOf(s)));
    expect(handCodes(r.state)).toHaveLength(handCodes(r.before).length - 1 - 2); // no Katana draw
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(0);
  });

  it("confused Psylocke: Flurry of Blades (an attack) is not canceled and the confused card stays (RRG p. 26)", () => {
    const s0 = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const s = give(s0, identityOf(s0), "confused");
    const r = playCard(s, "41004", 3, queue(stryfe(s)));
    expect(damageOf(r.state, stryfe(r.state))).toBe(2 + 2 + 2);
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(1);
  });

  it("stunned Psylocke defending: Psi-Flail Strike is paid for and canceled, so Stryfe takes nothing and is not stunned", () => {
    const base = game([PSYLOCKE], { faces: ["psylocke"] });
    const stunned = give(base, identityOf(base), "stunned");
    const given = inHand(stunned, P1, "41032");
    const staged = stackEncounterDeck(given.state, "01186");
    const run = driveEventsPicking(WAVE7_DEPS, staged, keeping(defending(accepting(FLAIL)), "41032"), endTurn(P1));
    expect(damageOf(run.state, stryfe(run.state))).toBe(0);
    expect(statusOf(run.state, stryfe(run.state), "stunned")).toBe(0);
    expect(statusOf(run.state, identityOf(run.state), "stunned")).toBe(0);
    expect(discardCodes(run.state)).toContain("41032");
  });

  it("stunned Psylocke: Psi-Bow Attack costs its 2 and is canceled; a Psi-Katana's +1 ATK never mattered", () => {
    const s0 = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const s = give(s0, identityOf(s0), "stunned");
    const r = playCard(s, "41030", 2, queue(stryfe(s)));
    expect(damageOf(r.state, stryfe(r.state))).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
    expect(discardCodes(r.state)).toContain("41030");
  });

  // Ruling August 13, 2026 - Ruling 1: a stunned Attack event was still "played", so play-triggered Responses resolve.
  it("stunned Archangel: Razor Dive is canceled, yet Angel of Death still answers the play for its printed cost 3", () => {
    const s0 = game([ANGEL], { faces: ["archangel"] });
    const s = give(s0, identityOf(s0), "stunned");
    const r = playCard(s, "42007", 3, accepting(DEATH, queue(stryfe(s))));
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
    // The attack did nothing (Razor Dive's 6 never landed): only the response's 3.
    expect(damageOf(r.state, stryfe(r.state))).toBe(3);
  });

  it("stunned Archangel: Adaptive Plumage (attack) is canceled whole, so Stryfe is neither damaged nor stunned", () => {
    const s0 = game([ANGEL], { faces: ["archangel"] });
    const s = give(s0, identityOf(s0), "stunned");
    const r = playCard(s, "42003", 3, queue(stryfe(s)));
    expect(damageOf(r.state, stryfe(r.state))).toBe(0);
    expect(statusOf(r.state, stryfe(r.state), "stunned")).toBe(0);
    expect(statusOf(r.state, identityOf(r.state), "stunned")).toBe(0);
  });

  it("confused Angel: Adaptive Plumage (thwart) removes no threat and confuses no enemy; Natural Flight likewise", () => {
    const s0 = game([ANGEL], { faces: ["angel"] });
    const s = give(s0, identityOf(s0), "confused");
    const a = playCard(s, "42003", 3, queue(mainOf(s), stryfe(s)));
    expect(threat(a.state, mainOf(a.state))).toBe(threat(s, mainOf(s)));
    expect(statusOf(a.state, stryfe(a.state), "confused")).toBe(0);
    expect(statusOf(a.state, identityOf(a.state), "confused")).toBe(0);
    const b = playCard(s, "42006", 2, queue(mainOf(s)));
    expect(threat(b.state, mainOf(b.state))).toBe(threat(s, mainOf(s)));
    expect(statusOf(b.state, identityOf(b.state), "confused")).toBe(0);
  });

  it("confused Archangel: Metamorphosis (an unlabeled Action) still resolves; the form change keeps the confused card", () => {
    const s0 = game([ANGEL], { faces: ["archangel"] });
    const s = give(s0, identityOf(s0), "confused");
    // To Angel (the face asked for by its form index): remove 2 threat from a scheme.
    const r = playCard(s, "42005", 2, changingTo("0", queue(mainOf(s))));
    expect(playerOf(r.state, P1).identity.heroFormIndex).toBe(0);
    expect(threat(r.state, mainOf(r.state))).toBe(2);
    expect(statusOf(r.state, identityOf(r.state), "confused")).toBe(1);
  });
});

describe("A stunned or confused hero's canceled attack or thwart is not an attack or thwart (RRG p. 26, p. 41)", () => {
  // RRG "Stun, Stunned" (p. 41): "that character is not considered to have attacked", so "After Psylocke attacks"
  // responses do not trigger; RRG "Labeled Ability" (p. 26) says the same of a canceled thwart for a confused identity.
  it("stunned Psylocke's basic attack: Weapons Training and Upside the Head are not offered, the stun goes", () => {
    let s = game([PSYLOCKE], { faces: ["psylocke"] });
    s = give(attached(s, P1, "41011").state, identityOf(s), "stunned");
    const training = instancesOf(s, "41011").find((id) => inst(s, id).attachedTo)!;
    expect(training).toBeDefined();
    const given = inHand(s, P1, "41015");
    const run = driveOffers(given.state, accepting(["41011", "41015"]), basicAttack(given.state, stryfe(given.state)));
    expect(hasOffer(run.offered, "41011")).toBe(false);
    expect(hasOffer(run.offered, "41015")).toBe(false);
    expect(damageOf(run.state, stryfe(run.state))).toBe(0);
    expect(statusOf(run.state, identityOf(run.state), "stunned")).toBe(0);
    expect(inst(run.state, training).attachedTo).toBe(identityOf(run.state));
  });

  it("control: with no status card the same basic attack offers Weapons Training and Upside the Head", () => {
    let s = game([PSYLOCKE], { faces: ["psylocke"] });
    s = attached(s, P1, "41011").state;
    const given = inHand(s, P1, "41015");
    const run = driveOffers(given.state, firstLegal, basicAttack(given.state, stryfe(given.state)));
    expect(hasOffer(run.offered, "41011")).toBe(true);
    expect(hasOffer(run.offered, "41015")).toBe(true);
  });

  it("confused Psylocke's basic thwart: Psionic Training's response is not offered, the confused card goes", () => {
    let s = game([PSYLOCKE], { faces: ["psylocke"] });
    s = attached(s, P1, "41010").state;
    s = give(s, identityOf(s), "confused");
    const run = driveOffers(s, accepting("41010"), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(s),
      schemeInstanceId: mainOf(s),
    });
    expect(hasOffer(run.offered, "41010")).toBe(false);
    expect(threat(run.state, mainOf(run.state))).toBe(threat(s, mainOf(s)));
    expect(statusOf(run.state, identityOf(run.state), "confused")).toBe(0);
  });
});

describe("Psi-Katana, Directed Force and attacks that are not basic attacks", () => {
  // Psi-Katana (41002b): "her basic attacks gain piercing" and +1 ATK; an event's "deal N damage" is neither.
  it("Psi-Bow Attack against a tough Stryfe with two Psi-Katanas: no piercing, the tough card absorbs the 4", () => {
    const s0 = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const s = give(s0, stryfe(s0), "tough");
    const r = playCard(s, "41030", 2, queue(stryfe(s)));
    expect(damageOf(r.state, stryfe(r.state))).toBe(0);
    expect(statusOf(r.state, stryfe(r.state), "tough")).toBe(0);
  });

  // Directed Force (41019): "When your hero makes an attack that has a keyword (overkill, piercing, or ranged), that
  // attack deals 2 additional damage." Psi-Bow Attack "gains ranged": the event's attack has a keyword.
  it("Directed Force answers Psi-Bow Attack (it gains ranged): 4 + 2 = 6", () => {
    const s = game([PSYLOCKE], { faces: ["psylocke"] });
    const given = inHand(s, P1, "41019");
    const r = playCard(given.state, "41030", 2, accepting(FORCE, queue(stryfe(s))), P1, ["41019"]);
    expect(damageOf(r.state, stryfe(r.state))).toBe(6);
    expect(discardCodes(r.state)).toContain("41019");
  });

  it("Directed Force on Razor Dive: offered to Archangel (overkill, piercing) for 6 + 2 through a tough card, not to Angel", () => {
    const arch = give(game([ANGEL], { faces: ["archangel"] }), stryfe(game([ANGEL])), "tough");
    const ga = inHand(arch, P1, "41019");
    const r = playCard(ga.state, "42007", 3, accepting(FORCE, queue(stryfe(arch))), P1, ["41019"]);
    expect(damageOf(r.state, stryfe(r.state))).toBe(8);
    const ang = game([ANGEL], { faces: ["angel"] });
    const gb = inHand(ang, P1, "41019");
    const offers = new Set<string>();
    const seeing: Picker = (st) => {
      if (st.pendingChoice?.prompt.kind === "chooseTriggers")
        for (const o of st.pendingChoice.options) offers.add(o.optionId);
      return queue(stryfe(ang))(st);
    };
    const given = moveToHand(gb.state, P1, "42007");
    const driven = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      seeing,
      play(P1, given.ids[0]!, payWith(given.state, P1, 3, [given.ids[0]!, gb.id])),
    );
    expect(hasOffer(offers, "41019")).toBe(false);
    expect(damageOf(driven.state, stryfe(driven.state))).toBe(6);
  });
});

describe("Upgrade abilities with a spend cost under a status card (RRG 'Labeled Ability', p. 26; 'Stun, Stunned', p. 41)", () => {
  const KINESIS = "41033.telekinesis-action";
  const TELEPATHY = "41024.telepathy-action";
  const knifeCosts = (s: GameState) => bladesOf(s).map((id) => resourceAbility(id, "41002a.psi-knife-resource"));
  it("stunned Psylocke: Telekinesis's exhaust and [mental][mental] are paid, no damage is dealt, the stun goes", () => {
    let s = game([PSYLOCKE], { faces: ["psylocke"] });
    const kinesis = attached(s, P1, "41033");
    s = give(kinesis.state, identityOf(s), "stunned");
    const run = driveEventsPicking(WAVE7_DEPS, s, queue(stryfe(s)), use(P1, kinesis.id, KINESIS, knifeCosts(s)));
    expect(inst(run.state, kinesis.id).exhausted).toBe(true);
    expect(bladesOf(run.state).every((id) => inst(run.state, id).exhausted)).toBe(true);
    expect(damageOf(run.state, stryfe(run.state))).toBe(0);
    expect(statusOf(run.state, identityOf(run.state), "stunned")).toBe(0);
  });
  it("confused Psylocke: Telepathy is paid for and canceled, no threat is removed, the confused card goes", () => {
    let s = game([PSYLOCKE], { faces: ["psylocke"] });
    const telepathy = attached(s, P1, "41024");
    s = give(telepathy.state, identityOf(s), "confused");
    const run = driveEventsPicking(WAVE7_DEPS, s, queue(mainOf(s)), use(P1, telepathy.id, TELEPATHY, knifeCosts(s)));
    expect(inst(run.state, telepathy.id).exhausted).toBe(true);
    expect(threat(run.state, mainOf(run.state))).toBe(threat(s, mainOf(s)));
    expect(statusOf(run.state, identityOf(run.state), "confused")).toBe(0);
  });
  it("control: unconfused, the same Telepathy removes its 2 threat", () => {
    const s0 = game([PSYLOCKE], { faces: ["psylocke"] });
    const telepathy = attached(s0, P1, "41024");
    const run = driveEventsPicking(
      WAVE7_DEPS,
      telepathy.state,
      queue(mainOf(s0)),
      use(P1, telepathy.id, TELEPATHY, knifeCosts(telepathy.state)),
    );
    expect(threat(run.state, mainOf(run.state))).toBe(threat(s0, mainOf(s0)) - 2);
  });
});

describe("Taunt (42016) against a stunned villain", () => {
  // RRG "Stun, Stunned" (p. 41): "If a stunned villain or minion would attack, discard the stunned status card instead."
  // Taunt's "The villain attacks you" is replaced by the stun's removal; its draw of 3 is a separate effect.
  it("the stun is removed, Angel takes no damage and the 3 cards are still drawn", () => {
    const s0 = game([ANGEL], { faces: ["angel"] });
    const s = give(s0, stryfe(s0), "stunned");
    const r = playCard(s, "42016", 1);
    expect(statusOf(r.state, stryfe(r.state), "stunned")).toBe(0);
    expect(damageOf(r.state, identityOf(r.state))).toBe(0);
    expect(handCodes(r.state)).toHaveLength(handCodes(r.before).length - 1 - 1 + 3);
  });
});

describe("Body Swapped canceled by Telepathic Suggestion", () => {
  // Telepathic Suggestion (41007) cancels "When Revealed" effects; Body Swapped's constant (no flipping a Psi-Katana) and
  // its place in Betsy's play area are not When Revealed, so they stand while the flips and exhausts are lost.
  it("the obligation enters her play area, the blades are neither flipped nor exhausted, the constant still applies", () => {
    const s0 = game([PSYLOCKE], { faces: ["psylocke"] });
    const given = inHand(s0, P1, "41007");
    const obligation = instancesOf(given.state, "41025")[0]!;
    const pick = keeping(accepting("41007.telepathic-suggestion-interrupt", queue(stryfe(s0), stryfe(s0))), "41007");
    const run = driveEventsPicking(WAVE7_DEPS, behind(given.state, obligation, 1), pick, endTurn(P1));
    expect(discardCodes(run.state)).toContain("41007");
    expect(playerOf(run.state, P1).playArea).toContain(obligation);
    expect(bladesOf(run.state).map((id) => inst(run.state, id).flipped)).toEqual([false, false]);
    expect(damageOf(run.state, stryfe(run.state))).toBe(0); // two Knives: no Katana damage, only schemes lose threat
  });
});

describe("Retaliate damage is not an enemy attack (RRG 'Retaliate X', p. 38)", () => {
  // Retaliate is a Forced Response that deals damage after the character is attacked; the damage is not an attack by
  // the enemy, so "damage from an attack" interrupts do not hear it.
  it("Psylocke's basic attack on Arclight: she takes the 1 retaliate damage, Psionic Redirect is not offered", () => {
    const s = game([PSYLOCKE], { faces: ["psylocke"] });
    const m = withMinion(s, P1);
    const given = inHand(m.state, P1, "41006");
    const run = driveOffers(given.state, accepting(REDIRECT), basicAttack(given.state, m.id));
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
    expect(hasOffer(run.offered, "41006")).toBe(false);
    expect(handCodes(run.state)).toContain("41006");
  });

  it("Angel's basic attack on Arclight: Aerial Intervention is not offered for the retaliate damage", () => {
    const s = game([ANGEL], { faces: ["angel"] });
    const m = withMinion(s, P1);
    const given = inHand(m.state, P1, "42014");
    const run = driveOffers(given.state, accepting(INTERVENTION), basicAttack(given.state, m.id));
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
    expect(hasOffer(run.offered, "42014")).toBe(false);
  });

  // RRG "Consequential Damage" (p. 13): dealt to an ally after it thwarts, not by an enemy attack. (Elixir thwarts, so
  // no attack damage is dealt to anything and the only damage in the scene is the ally's own.)
  it("Aerial Intervention is not offered for an ally's consequential damage (Elixir takes 1 after her thwart)", () => {
    const s = game([ANGEL], { faces: ["angel"] });
    const elixir = playCard(s, "42011", 4);
    const given = inHand(elixir.state, P1, "42014");
    const thwart: Command = {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: elixir.id,
      schemeInstanceId: mainOf(given.state),
    };
    const run = driveOffers(given.state, accepting(INTERVENTION), thwart);
    expect(damageOf(run.state, elixir.id)).toBe(1);
    expect(hasOffer(run.offered, "42014")).toBe(false);
  });
});

describe("Psionic Illusion against an attack that is not a basic attack", () => {
  /** Hero form, Psionic Illusion revealed onto her identity by a real villain phase, Flurry of Blades on top of the deck. */
  function illusion(players: readonly Seat[] = [PSYLOCKE]) {
    const base = game(players, { faces: players.map(() => "psylocke" as const) });
    const revealed = revealNemesis(base, "41028", firstLegal, P1);
    const hero =
      players.length === 2 ? withForm(withForm(revealed.state, { heroForm: 0 }), { heroForm: 0 }, P2) : revealed.state;
    return { id: revealed.id, state: putTop(hero) };
  }
  const putTop = (s: GameState): GameState => {
    const owner = playerOf(s, P1);
    const flurry = [...owner.deck, ...owner.hand, ...owner.discard].find((i) => codeOf(s, i) === "41004")!;
    const strip = (z: readonly InstanceId[]) => z.filter((i) => i !== flurry);
    return {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1
          ? { ...p, deck: [flurry, ...strip(p.deck)], hand: strip(p.hand), discard: strip(p.discard) }
          : p,
      ),
    };
  };
  const choosing =
    (label: string, inner: Picker = firstLegal): Picker =>
    (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseOption") {
        const hit = c.options.find((o) => o.label.startsWith(label));
        if (hit) return [hit.optionId];
      }
      return inner(st);
    };

  // Psionic Illusion (41028): "When you attack an enemy" - an attack by her identity, whichever card makes it. Naming
  // [mental] with Flurry of Blades (an [energy] card) on top changes the target of this attack to a friendly character.
  it("Psi-Bow Attack: the forced interrupt triggers and redirects the event's 4 damage onto her own identity", () => {
    const { state, id } = illusion();
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    const r = playCard(state, "41030", 2, choosing("Name mental", queue(stryfe(state))));
    expect(discardCodes(r.state)).toContain("41004"); // the top card was discarded by the interrupt
    expect(damageOf(r.state, stryfe(r.state))).toBe(damageOf(r.before, stryfe(r.before)));
    expect(damageOf(r.state, identityOf(r.state)) - damageOf(r.before, identityOf(r.before))).toBe(4);
    expect(Object.values(r.state.encounterDecks).flatMap((d) => d.discard)).toContain(id);
  });

  it("an ally's attack does not trigger it: the deck stays (RRG 'Identity' vs ally, the card says 'you attack')", () => {
    const { state } = illusion();
    const given = inHand(state, P1, "41003"); // Angel, ally
    const ally = playCard(given.state, "41003", 3);
    const deckBefore = playerOf(ally.state, P1).deck.length;
    const run = driveEventsPicking(WAVE7_DEPS, ally.state, choosing("Name mental"), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally.id,
      targetInstanceId: stryfe(ally.state),
    });
    expect(playerOf(run.state, P1).deck.length).toBe(deckBefore);
    expect(damageOf(run.state, stryfe(run.state))).toBe(2);
  });
});

describe("Concussive Blow paid with a Psi-Katana's [physical] resource", () => {
  // Concussive Blow (41014, the 05031 definition): "If you paid for this card using a [physical] resource, deal 3 damage."
  // Ruling January 11, 2026 - Ruling 3: a resource generated by an ability is a "printed resource" when paying a cost.
  it("two Psi-Katanas and one card pay its 3: the confuse and the 3 damage both land", () => {
    const s = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const given = inHand(s, P1, "41014");
    const [k1, k2] = bladesOf(given.state) as [InstanceId, InstanceId];
    const one = payWith(given.state, P1, 1, [given.id]);
    const run = driveEventsPicking(
      WAVE7_DEPS,
      given.state,
      queue(stryfe(s)),
      play(P1, given.id, one, {
        abilities: [
          resourceAbility(k1, "41002b.psi-katana-resource"),
          resourceAbility(k2, "41002b.psi-katana-resource"),
        ],
      }),
    );
    expect(statusOf(run.state, stryfe(run.state), "confused")).toBe(1);
    expect(damageOf(run.state, stryfe(run.state))).toBe(3);
  });
});

describe("Soaring Hearts (Team-Up Angel and Psylocke) across the two seats", () => {
  const BOTH = [ANGEL, PSYLOCKE] as const;
  const exhaust = (s: GameState, p: PlayerId) => patchInstance(s, identityOf(s, p), { exhausted: true });

  // RRG "Team-Up" (p. 43): both named friendly characters must be in play, matched by title or subtitle; RRG "Form,
  // Change Form" (p. 21): while a player is in alter-ego form their hero does not interact with their identity.
  it("Angel plays it while the Psylocke player is Betsy Braddock (alter-ego): refused; as Psylocke: both are readied", () => {
    const betsy = game(BOTH, { faces: ["angel", "betsy"] });
    expect(refusedPlay(betsy, "42021", 2)).toBe(true);
    const psy = exhaust(exhaust(game(BOTH, { faces: ["angel", "psylocke"] }), P1), P2);
    const r = playCard(psy, "42021", 2);
    expect(inst(r.state, identityOf(r.state, P1)).exhausted).toBe(false);
    expect(inst(r.state, identityOf(r.state, P2)).exhausted).toBe(false);
    expect(discardCodes(r.state)).toContain("42021");
  });

  it("the Psylocke player plays it (41020) while Angel's player is Warren: refused; Angel in hero form: allowed", () => {
    expect(refusedPlay(game(BOTH, { faces: ["warren", "psylocke"] }), "41020", 2, P2)).toBe(true);
    const ok = playCard(game(BOTH, { faces: ["angel", "psylocke"] }), "41020", 2, firstLegal, P2);
    expect(discardCodes(ok.state, P2)).toContain("41020");
  });

  // Soaring Hearts: "Search your discard pile for an identity-specific event": the hero set's own events only.
  it("the discard-pile search offers the hero set's events only, not an aspect event of her deck", () => {
    const base = game(BOTH, { faces: ["angel", "psylocke"] });
    const flurry = moveToHand(base, P2, "41004");
    const upside = moveToHand(flurry.state, P2, "41015");
    const toDiscard = (s: GameState, ids: readonly InstanceId[]): GameState => ({
      ...s,
      players: s.players.map((p) =>
        p.playerId === P2 ? { ...p, hand: p.hand.filter((i) => !ids.includes(i)), discard: [...p.discard, ...ids] } : p,
      ),
    });
    const staged = toDiscard(upside.state, [flurry.ids[0]!, upside.ids[0]!]);
    const offers: string[][] = [];
    const seeing: Picker = (st) => {
      if (st.pendingChoice?.prompt.kind === "chooseCards") offers.push(st.pendingChoice.options.map((o) => o.optionId));
      return firstLegal(st);
    };
    playCard(staged, "41020", 2, seeing, P2);
    const found = offers.find((o) => o.includes(flurry.ids[0]!));
    expect(found).toBeDefined();
    expect(found).not.toContain(upside.ids[0]!);
  });
});

describe("Angel's three faces and a character that carries state across them", () => {
  const faceOf = (s: GameState, p: PlayerId = P1) => playerOf(s, p).identity;
  const change = (s: GameState, to: { alterEgo: true } | { heroForm: number }): GameState => {
    const r = applyCommand(s, { type: "changeForm", playerId: P1, to: "alterEgo" in to ? "alterEgo" : to }, WAVE7_DEPS);
    if (!r.ok) throw new Error(r.error.message);
    return r.state;
  };

  // RRG "Form, Change Form" (p. 21): "the character retains their sustained damage, status cards, ... attached cards, ...
  // and current state (ready or exhausted)."
  it("Warren to Angel to Archangel to Warren keeps damage, all three status cards, exhaustion and an attached upgrade", () => {
    let s = game([ANGEL], { faces: ["warren"] });
    s = attached(s, P1, "42010").state; // Techno-Organic Wings
    const id = identityOf(s);
    s = patchInstance(give(give(give(s, id, "stunned"), id, "confused"), id, "tough"), id, {
      damage: 5,
      exhausted: true,
    });
    const wings = inst(s, id).attachments;
    for (const to of [{ heroForm: 0 }, { heroForm: 1 }, { alterEgo: true }] as const) {
      // A new round's change of form: the once-per-round flag is cleared by surgery, nothing else is touched.
      s = { ...s, players: s.players.map((p) => ({ ...p, identity: { ...p.identity, changedFormThisRound: false } })) };
      s = change(s, to);
      expect(damageOf(s, id), JSON.stringify(to)).toBe(5);
      expect(statusOf(s, id, "stunned")).toBe(1);
      expect(statusOf(s, id, "confused")).toBe(1);
      expect(statusOf(s, id, "tough")).toBe(1);
      expect(inst(s, id).exhausted).toBe(true);
      expect(inst(s, id).attachments).toEqual(wings);
    }
    expect(faceOf(s).form).toBe("alterEgo");
  });

  // Apocalyptic Influence (42024) is a card ability: RRG "Form, Change Form" says an ability-caused change does not count
  // against the one voluntary change, so it resolves in a round where Warren already changed form himself.
  it("Apocalyptic Influence turns Angel into Archangel in a round where he already changed form by choice", () => {
    let s = game([ANGEL], { faces: ["warren"] });
    s = change(s, { heroForm: 0 });
    expect(faceOf(s).changedFormThisRound).toBe(true);
    s = give(s, identityOf(s), "stunned");
    const obligation = instancesOf(s, "42024")[0]!;
    const run = driveEventsPicking(WAVE7_DEPS, behind(s, obligation, 1), firstLegal, endTurn(P1));
    expect(faceOf(run.state)).toMatchObject({ form: "hero", heroFormIndex: 1 });
    expect(statusOf(run.state, identityOf(run.state), "stunned")).toBe(1);
    expect(playerOf(run.state, P1).playArea).toContain(obligation);
  });

  it("Archangel's Aerial Agility (a defense) is a defense for Angel's Aerie too: the fatigue counter is placed", () => {
    // RRG "Labeled Ability" (p. 26): initiated during an attack, the identity becomes the defender of that attack.
    let s = game([ANGEL], { faces: ["archangel"] });
    s = attached(s, P1, "42018").state;
    const aerie = instancesOf(s, "42018").find((i) => inst(s, i).attachedTo)!;
    const given = inHand(s, P1, "42004");
    const staged = stackEncounterDeck(given.state, "01186");
    const run = driveEventsPicking(WAVE7_DEPS, staged, keeping(accepting(["42004", "42018"]), "42004"), endTurn(P1));
    expect(discardCodes(run.state)).toContain("42004");
    expect(inst(run.state, aerie).counters.fatigue ?? 0).toBe(1);
  });
});

describe("Avian Anatomy, the once-per-phase faces and Eyes in the Sky", () => {
  it("Razor Dive returned by Avian Anatomy and played again: Angel of Death answers the first play only (Jan 26, 2026 - 6)", () => {
    const s = game([ANGEL], { faces: ["archangel"] });
    const given = moveToHand(s, P1, "42007", "42008", "42016", "42016");
    const [dive, anatomy, t1, t2] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const first = driveOffers(
      given.state,
      accepting(["42008", DEATH], queue(stryfe(s))),
      play(P1, dive, [anatomy, t1, t2]),
    );
    expect(hasOffer(first.offered, DEATH)).toBe(true);
    expect(playerOf(first.state, P1).hand).toContain(dive); // Avian Anatomy returned it
    expect(damageOf(first.state, stryfe(first.state))).toBe(6 + 3);
    const second = driveOffers(
      first.state,
      accepting(DEATH, queue(stryfe(s))),
      play(P1, dive, payWith(first.state, P1, 3, [dive])),
    );
    expect(hasOffer(second.offered, DEATH)).toBe(false);
    expect(discardCodes(second.state)).toContain("42007"); // played a second time, nothing returned it
  });

  /**
   * Eyes in the Sky attached by surgery, then Harpoon (a non-ELITE minion) revealed to Angel in the villain phase.
   * Angel is readied at the end of his turn (RRG "Player Phase", p. 34), so he is exhausted at the reveal only by having
   * defended Stryfe's activation (`defends`), which comes first in the villain phase.
   */
  function revealingHarpoon(defends: boolean) {
    let s = game([ANGEL], { faces: ["angel"] });
    s = attached(s, P1, "42030").state;
    const eyes = instancesOf(s, "42030").find((i) => inst(s, i).attachedTo)!;
    const staged = stackSetAside(s, "42025", P1);
    const pick = accepting("42030", defends ? (st) => defending(firstLegal)(st) : firstLegal);
    const out = driveOffers(behind(staged, instancesOf(staged, "42025")[0]!, 1), pick, endTurn(P1));
    return { ...out, eyes };
  }
  it("control: with Angel ready the interrupt is offered, and its exhaust and discard are paid", () => {
    const ready = revealingHarpoon(false);
    expect(hasOffer(ready.offered, "42030")).toBe(true);
    expect(discardCodes(ready.state)).toContain("42030"); // the discard is part of the cost
  });

  // RRG "Exhausted" (p. 19): a cost that must exhaust a card cannot be paid by an exhausted one. Eyes in the Sky's cost is
  // "exhaust an AERIAL character you control and discard this card"; Angel, exhausted by defending, is the only AERIAL
  // character.
  it("with Angel exhausted from defending, Eyes in the Sky is not offered: no AERIAL character can pay its exhaust cost", () => {
    const tired = revealingHarpoon(true);
    expect(inst(tired.state, identityOf(tired.state)).exhausted).toBe(true);
    expect(hasOffer(tired.offered, "42030")).toBe(false);
    expect(discardCodes(tired.state)).not.toContain("42030");
  });

  // Aerial Intervention (42014): "exhaust an AERIAL character you control -> prevent up to 3 of that damage."
  it("Angel exhausted by defending cannot pay Aerial Intervention for the damage he is about to take", () => {
    const s = game([ANGEL], { faces: ["angel"] });
    const given = inHand(s, P1, "42014");
    const run = driveOffers(
      stackEncounterDeck(given.state, "01186"),
      keeping(defending(accepting(INTERVENTION)), "42014"),
      endTurn(P1),
    );
    expect(hasOffer(run.offered, "42014")).toBe(false);
    expect(damageOf(run.state, identityOf(run.state))).toBeGreaterThan(0);
    expect(handCodes(run.state)).toContain("42014");
  });
});

describe("Regrowth's limit, hand size and Containment Strategy across form changes and prevention", () => {
  // Ruling January 26, 2026 - Ruling 6.2: "Limits apply to cards. An identity never leaves play when flipping; limits
  // applied to its abilities persist across flips." Warren uses Regrowth, flips to Angel by choice, and Metamorphosis
  // (an effect: no once-per-round change spent) flips him back to Warren in the same round.
  it("Regrowth used, then Angel and back to Warren through Metamorphosis in one round: a second Regrowth is refused", () => {
    let s = game([ANGEL], { faces: ["warren"] });
    s = patchInstance(s, identityOf(s), { damage: 5 });
    const regrow = (st: GameState): Command => use(P1, identityOf(st), "42001b.regrowth");
    s = driveEventsPicking(WAVE7_DEPS, s, firstLegal, regrow(s)).state;
    expect(damageOf(s, identityOf(s))).toBe(4);
    s = driveEventsPicking(WAVE7_DEPS, s, firstLegal, { type: "changeForm", playerId: P1, to: { heroForm: 0 } }).state;
    const back = playCard(s, "42005", 2, changingTo("alterEgo")).state;
    expect(playerOf(back, P1).identity.form).toBe("alterEgo");
    expect(rejected(back, regrow(back))).toBe(true);
  });

  // Hand size is the face showing's (Warren 6, Angel 5): the end-of-turn discard after a change to Angel is down to 5.
  it("Warren with a full hand of 6 changes to Angel and ends his turn: he must discard down to 5", () => {
    let s = game([ANGEL], { faces: ["warren"] });
    expect(playerOf(s, P1).hand).toHaveLength(6);
    s = driveEventsPicking(WAVE7_DEPS, s, firstLegal, { type: "changeForm", playerId: P1, to: { heroForm: 0 } }).state;
    const sizes: number[] = [];
    const seeing: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "discardDownToHandSize") sizes.push(c.prompt.handSize);
      return firstLegal(st);
    };
    driveEventsPicking(WAVE7_DEPS, s, seeing, endTurn(P1));
    expect(sizes[0]).toBe(5);
  });

  // Containment Strategy (42019): "2 threat instead if that hero took no damage from that attack". Damage Aerial
  // Intervention prevents is damage the hero did not take.
  it("a defense whose damage Aerial Intervention fully prevents removes 2 threat, not 1", () => {
    let s = game([ANGEL], { faces: ["angel"] });
    const siryn = allyInPlay(s, P1, "42012");
    s = siryn.state;
    const scheme = encounterCardInVillainArea(s, "40131", 5);
    s = scheme.state;
    const containment = conjure(s, P1, "42019");
    s = patchInstance(
      {
        ...containment.state,
        players: containment.state.players.map((p) => ({ ...p, hand: p.hand.filter((x) => x !== containment.id) })),
      },
      containment.id,
      { home: { kind: "player" }, attachedTo: scheme.id, controllerId: P1, faceup: true } as Partial<CardInstance>,
    );
    s = patchInstance(s, scheme.id, { attachments: [...inst(s, scheme.id).attachments, containment.id] });
    const given = inHand(s, P1, "42014");
    const pick: Picker = (st) => {
      const c = st.pendingChoice;
      if (c?.prompt.kind === "chooseCostCards") return [siryn.id];
      return defending(accepting(["42014", "42019"]))(st);
    };
    const run = driveOffers(stackEncounterDeck(given.state, "01186"), keeping(pick, "42014"), endTurn(P1));
    expect(hasOffer(run.offered, "42014")).toBe(true);
    expect(damageOf(run.state, identityOf(run.state))).toBe(0);
    expect(inst(run.state, siryn.id).exhausted).toBe(true);
    expect(threat(run.state, scheme.id)).toBe(5 - 2);
  });
});

describe("X-FORCE play restrictions on the two forms of one identity", () => {
  // Pete Wisdom (41018) and IPAC (41022): "Play only if your identity has the X-FORCE trait." Betsy Braddock's alter-ego
  // is MUTANT and PSIONIC, Psylocke's hero face PSIONIC and X-FORCE; Warren is MUTANT only, Angel and Archangel X-FORCE.
  it.each([
    ["41018", 4, "betsy", true],
    ["41018", 4, "psylocke", false],
    ["41022", 1, "betsy", true],
    ["41022", 1, "psylocke", false],
  ] as const)("%s as %s: refused is %s", (code, cost, face, refused) => {
    const s = game([PSYLOCKE], { faces: [face] });
    expect(refusedPlay(s, code, cost)).toBe(refused);
  });
  it.each([
    ["41018", 4, "warren", true],
    ["41018", 4, "angel", false],
    ["41018", 4, "archangel", false],
  ] as const)("Angel's player: %s as %s: refused is %s", (code, cost, face, refused) => {
    expect(refusedPlay(game([ANGEL], { faces: [face] }), code, cost)).toBe(refused);
  });
});

describe("Telepathic Suggestion against each kind of nemesis card", () => {
  const SUGGESTION = "41007.telepathic-suggestion-interrupt";
  // Telepathic Suggestion (41007): "cancel its When Revealed effects". A side scheme still enters play with its printed
  // starting threat (RRG "Cancel": only the canceled effects are lost); Interdimensional Plunder's per-upgrade threat is
  // its When Revealed, so it is lost; the two Katanas' damage and Knives' threat removal are the event's own.
  function reveal(cancel: boolean) {
    const s = blades(game([PSYLOCKE], { faces: ["psylocke"] }), KATANAS);
    const given = inHand(s, P1, "41007");
    const pick = cancel ? keeping(accepting(SUGGESTION, queue(stryfe(s), stryfe(s))), "41007") : firstLegal;
    const run = revealNemesis(given.state, "41027", pick, P1);
    return { ...run, plunder: run.id };
  }
  it("Interdimensional Plunder: canceled it keeps its starting threat only; revealed normally it adds 1 per upgrade (2 blades)", () => {
    const control = reveal(false);
    const canceled = reveal(true);
    expect(threat(control.state, control.plunder)).toBeGreaterThanOrEqual(2 + 2);
    expect(threat(canceled.state, canceled.plunder)).toBe(threat(control.state, control.plunder) - 2);
    expect(discardCodes(canceled.state)).toContain("41007");
    // Two Psi-Katanas: 2 damage twice to the chosen enemy.
    expect(damageOf(canceled.state, stryfe(canceled.state))).toBe(4);
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
  // A Permanent blade never sits in a hand, deck or discard pile (RRG "Permanent", p. 32) while the game goes on (an
  // eliminated player's cards are all discarded at the end).
  if (!s.outcome)
    for (const p of s.players)
      for (const zone of ["hand", "deck", "discard"] as const)
        for (const id of p[zone])
          if (codeOf(s, id) === "41002a" || codeOf(s, id) === "41002b") fail(`a Permanent blade in ${zone}`);
}
const dealtSet = (s: GameState): Set<string> => {
  const out = new Set<string>();
  for (const p of s.players)
    for (const zone of ["hand", "deck", "discard", "playArea"] as const) for (const id of p[zone]) out.add(id);
  return out;
};

const HOPE_SUMMERS = "40130";
/** The driver's own answer, except that Hope Summers never defends ("If Hope Summers is defeated, you lose"): a policy. */
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
    expect(session.state.round - lastRound).toBeLessThanOrEqual(1); // the villain phase completes into the next round
    lastRound = session.state.round;
  }
  return { session, commands };
}
function expectReplays(session: GameSession): void {
  const replayed = replay(session.log, WAVE7_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

describe("Every card of both nemesis sets and both obligations, revealed and fully resolved in a two-player game", () => {
  const BOTH = [PSYLOCKE, ANGEL] as const;
  /** Reveals `code` to `owner` (Psylocke is seat 1, Angel seat 2), answering prompts with `pick`, through the round's end. */
  function revealed(code: string, owner: PlayerId, pick: Picker, setAside: boolean) {
    const base = game(BOTH, { scenario: "juggernaut", faces: ["psylocke", "angel"], modular: [] });
    const set = setAside ? stackSetAside(base, code, owner) : base;
    const id = instancesOf(set, code)[0]!;
    const deckId = Object.keys(set.encounterDecks)[0]!;
    const pile = set.encounterDecks[deckId]!;
    const rest = pile.deck.filter((x) => x !== id);
    // One boost card per activation (two seats), then each seat is dealt a card in turn order.
    const at = owner === P1 ? 2 : 3;
    const staged: GameState = {
      ...set,
      encounterDecks: {
        ...set.encounterDecks,
        [deckId]: { ...pile, deck: [...rest.slice(0, at), id, ...rest.slice(at)] },
      },
    };
    const dealt = dealtSet(staged);
    const run: Picker = (s) => {
      checkState(s, dealt, `reveal ${code}`);
      return pick(s);
    };
    const r = driveEventsPicking(WAVE7_DEPS, staged, run, endTurn(P1));
    const done = driveEventsPicking(WAVE7_DEPS, r.state, run, endTurn(P2));
    return { state: done.state, id, events: [...r.events, ...done.events] };
  }
  /** Never assigns damage to or picks Hope Summers ("If Hope Summers is defeated, you lose"): a policy, not a rule. */
  const sparingHope =
    (inner: Picker): Picker =>
    (s) => {
      const out = inner(s);
      const c = s.pendingChoice;
      const isHope = (id: string) =>
        s.instances[id as InstanceId] !== undefined && codeOf(s, id as InstanceId) === HOPE_SUMMERS;
      if (!c || !out.some(isHope)) return out;
      return c.options
        .map((o) => o.optionId)
        .filter((id) => !isHope(id))
        .slice(0, Math.max(c.minSelections, 1));
    };
  const lastLegal: Picker = (s) => {
    const c = s.pendingChoice;
    if (!c) return [];
    if (c.prompt.kind === "declareDefender") return ["decline"];
    return c.options.slice(Math.max(0, c.options.length - Math.max(c.minSelections, 1))).map((o) => o.optionId);
  };
  const cases = [
    ...["41026", "41027", "41028", "41029"].map((c) => [c, P1, true] as const),
    ...["42025", "42026", "42027", "42028"].map((c) => [c, P2, true] as const),
    ["41025", P1, false] as const,
    ["42024", P2, false] as const,
  ];
  it.each(cases)(
    "%s revealed to its own hero: the round completes with every invariant intact (first and last options)",
    (code, owner, setAside) => {
      for (const pick of [sparingHope(firstLegal), sparingHope(lastLegal)]) {
        const r = revealed(code, owner, pick, setAside);
        expect(r.state.pendingChoice, `${code}: nothing left pending`).toBeNull();
        // Telekinetic Dragon's X counts hand, deck and discard (Q39 = C): a full deck is a dozen or more [mental] icons,
        // enough indirect damage (RRG "Indirect Damage", p. 24: capped at each character's hit points) to defeat the
        // identity and Hope Summers together, which is a loss by the rules, not a stall.
        if (code === "41029" && r.state.outcome) {
          expect(r.state.outcome).toMatchObject({ result: "loss" });
          continue;
        }
        expect(r.state.round, `${code}: ${JSON.stringify(r.state.outcome)}`).toBe(2);
        checkState(r.state, dealtSet(r.state), `after ${code}`);
      }
    },
  );

  it("the obligations stay with their own seat: Body Swapped in Betsy's play area, Apocalyptic Influence in Warren's", () => {
    for (const [code, owner] of [
      ["41025", P1],
      ["42024", P2],
    ] as const) {
      const r = revealed(code, owner, firstLegal, false);
      expect(zoneIndex(r.state).get(r.id)).toEqual([`${owner}.playArea`]);
    }
  });

  it("each nemesis card is in play, or discarded by its own text, never left in a deck", () => {
    for (const [code, owner] of [
      ["41026", P1],
      ["41028", P1],
      ["42025", P2],
      ["42027", P2],
    ] as const) {
      const r = revealed(code, owner, firstLegal, true);
      const zones = zoneIndex(r.state).get(r.id) ?? [];
      expect(zones.length, code).toBeLessThanOrEqual(1);
      for (const z of zones) expect(z, code).not.toMatch(/\.deck$/);
    }
  });
});

describe("Expert-mode games with step invariants and a deep-equal replay", () => {
  /**
   * Plays one expert game per seed (every state checked, every log replayed to a deep-equal state). The greedy driver
   * often loses expert games in a round or two, so several seeds run and the best one must get past round 2.
   */
  function expertSeeds(
    players: readonly Seat[],
    scenario: string,
    seeds: readonly number[],
    faces: readonly Face[],
  ): void {
    const rounds: number[] = [];
    for (const seed of seeds) {
      const initial = game(players, {
        scenario,
        difficulty: "expert",
        seed,
        modular: [],
        faces,
        keepScheme: true,
        keepTough: true,
      });
      const r = playChecked(initial, 300);
      expectReplays(r.session);
      rounds.push(r.session.state.round);
    }
    expect(Math.max(...rounds), `rounds reached per seed: ${rounds.join(", ")}`).toBeGreaterThanOrEqual(3);
  }

  it("Psylocke (precon) against Juggernaut, expert, on five seeds", () => {
    expertSeeds([PSYLOCKE], "juggernaut", [1, 2, 3, 4, 5], ["psylocke"]);
  });

  it("Angel (precon, starting as Angel) against Mister Sinister, expert, on five seeds", () => {
    expertSeeds([ANGEL], "mister-sinister", [1, 2, 3, 4, 5], ["angel"]);
  });

  it("Psylocke and Angel together against Morlock Siege, expert, on four seeds", () => {
    expertSeeds([PSYLOCKE, ANGEL], "morlock-siege", [1, 2, 3, 4], ["psylocke", "angel"]);
  });
});
