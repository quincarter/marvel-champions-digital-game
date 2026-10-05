import {
  activeVillain,
  applyCommand,
  characterProfile,
  createGame,
  hasKeyword,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";
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
  resourceAbility,
  settle,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { PSYLOCKE_SUPPORT_UPGRADES_ALLIES } from "../psylocke/support-upgrades-allies.js";
import { X23_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * X-23's Claws, allies, supports and upgrades (43002-43027), docs/phase7-wave7.md §7.3, §3.55, §3.85. Her precon
 * (`x-23-aggression`) against Stryfe through `wave7Scenario` with the real registry (the Claws are in play from her
 * Setup). X-23: THW 2, ATK 1, DEF 2, 10 hit points, hand size 5; Laura Kinney (alter ego) 6 hand size.
 */
const CLAWS_ACTION = "43002.x-23s-claws-action";
const HONEY_BADGER_RESPONSE = "43003.honey-badger-response";
const SISTERHOOD = "43008.sisterhood-action";
const LACING_HP = "43009.adamantium-lacing-constant";
const LACING_KEYWORDS = "43009.adamantium-lacing-constant-2";
const GRIM_RESOLVE = "43010.grim-resolve-resource";
const PAIN_TOLERANCE = "43011.pain-tolerance-response";
const PUNCTURE_CONSTANT = "43012.puncture-wound-constant";
const PUNCTURE_FORCED = "43012.puncture-wound-forced-response";
const BOOM_BOOM = "43013.boom-boom-action";
const RICTOR = "43014.rictor-response";
const SHATTERSTAR = "43015.shatterstar-interrupt";
const NOW_IM_MAD = "43019.now-im-mad-constant";
const DIRECT_APPROACH = "43020.the-direct-approach-constant";
const IPAC = "43025.ipac-action";
const X_BUNKER = "43026.x-bunker-action";
const ENDURANCE = "43027.endurance-constant";
const LIVING_WEAPON = "43001a.living-weapon";
const ALL_REFS = [
  CLAWS_ACTION,
  HONEY_BADGER_RESPONSE,
  SISTERHOOD,
  LACING_HP,
  LACING_KEYWORDS,
  GRIM_RESOLVE,
  PAIN_TOLERANCE,
  PUNCTURE_CONSTANT,
  PUNCTURE_FORCED,
  BOOM_BOOM,
  RICTOR,
  SHATTERSTAR,
  NOW_IM_MAD,
  DIRECT_APPROACH,
  IPAC,
  X_BUNKER,
  ENDURANCE,
];

const X23 = { starterDeckId: "x-23-aggression" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof X23 | typeof SPIDER_MAN;
const CLAWS = "43002";
const HONEY_BADGER = "43003";
const CLAW_MASTERY = "43005"; // an X-23 event, to discard to Sisterhood
const CRITICAL_HIT = "43016"; // an Aggression card: not an X-23 card
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme (3 threat per player)
const HYDRA_MERCENARY = "01101"; // ATK 1, 3 hit points, Guard

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
function heroGame(players: readonly Seat[] = [X23], seed = 1, heroSeat = P1): GameState {
  const config = wave7Scenario("stryfe", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
  return withForm(s, { heroForm: 0 }, heroSeat);
}
function alterEgoGame(players: readonly Seat[] = [X23]): GameState {
  const config = wave7Scenario("stryfe", { players, seed: 1, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
}
const handOf = (s: GameState, p = P1) => playerOf(s, p).hand;
const handCodes = (s: GameState, p = P1): string[] => handOf(s, p).map((id) => codeOf(s, id));
const deckCodes = (s: GameState, p = P1): string[] => playerOf(s, p).deck.map((id) => codeOf(s, id));
const discardCodes = (s: GameState, p = P1): string[] => playerOf(s, p).discard.map((id) => codeOf(s, id));
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const profileOf = (s: GameState, id: InstanceId = identityOf(s)) => characterProfile(s, id, WAVE7_DEPS)!;
const stryfe = (s: GameState): InstanceId => activeVillain(s).instanceId;
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
const exhaust = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: true });
const clawsOf = (s: GameState): InstanceId => instancesOf(s, CLAWS)[0]!;

const basicAttack = (s: GameState, target: InstanceId, who = identityOf(s), p = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who,
  targetInstanceId: target,
});
const basicThwart = (s: GameState, scheme: InstanceId, who = identityOf(s), p = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who,
  schemeInstanceId: scheme,
});

/** Plays `code` from hand (an upgrade attached to `attach`), paying with other hand cards. */
function put(
  state: GameState,
  code: string,
  cost: number,
  opts: { attach?: InstanceId; player?: typeof P1; pick?: Picker; controller?: typeof P1 } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const driven = driveEventsPicking(WAVE7_DEPS, given.state, opts.pick ?? firstLegal, {
    ...play(
      player,
      id,
      payWith(given.state, player, cost, [id]),
      opts.attach ? { attachToInstanceId: opts.attach } : {},
    ),
    ...(opts.controller ? { controllerId: opts.controller } : {}),
  });
  return { state: driven.state, id };
}
/** Puts `code` into play attached to `host` (default the identity) by surgery (no cost, no windows). */
function attached(state: GameState, code: string, player = P1, host?: InstanceId) {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const target = host ?? identityOf(state, player);
  const s = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id) } : p,
    ),
  };
  const withCard = patchInstance(s, id, {
    home: { kind: "player" },
    attachedTo: target,
    controllerId: player,
    faceup: true,
  });
  return { state: patchInstance(withCard, target, { attachments: [...inst(withCard, target).attachments, id] }), id };
}
/** Puts an ally into play by surgery (ready, undamaged). */
function inPlay(state: GameState, code: string, player = P1): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const s = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player ? { ...p, hand: p.hand.filter((x) => x !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return {
    state: patchInstance(s, id, { home: { kind: "player" }, controllerId: player, faceup: true }),
    id,
  };
}
/** An enemy minion in `player`'s play area, engaged with `engaged` (default the same player), or with nobody. */
function withMinion(
  state: GameState,
  code: string,
  opts: { player?: typeof P1; damage?: number; engaged?: typeof P1 | null; tough?: boolean } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const engaged = opts.engaged === undefined ? player : opts.engaged;
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = {
    instanceId: id,
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: engaged ? { kind: "playArea", playerId: engaged } : { kind: "villainArea" },
    faceup: true,
    exhausted: false,
    damage: opts.damage ?? 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: opts.tough ? 1 : 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: engaged,
    flipped: false,
  } as unknown as CardInstance;
  return {
    id,
    state: {
      ...state,
      villainArea: engaged ? state.villainArea : [...state.villainArea, id],
      players: engaged
        ? state.players.map((p) => (p.playerId === engaged ? { ...p, playArea: [...p.playArea, id] } : p))
        : state.players,
      instances: { ...state.instances, [id]: instance },
    },
  };
}
/** No side scheme in play (Stryfe's setup leaves one with a crisis icon). */
const withoutSideSchemes = (s: GameState, mainThreat = 6): GameState =>
  patchInstance({ ...s, villainArea: [] }, s.mainScheme.instanceId, { threat: mainThreat });
/** Replaces the hand by exactly these cards (the old hand goes to the bottom of the deck). */
function withHand(state: GameState, ...codes: string[]): GameState {
  const old = playerOf(state, P1).hand;
  const cleared = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [], deck: [...p.deck.filter((x) => !old.includes(x)), ...old] } : p,
    ),
  };
  return codes.length === 0 ? cleared : moveToHand(cleared, P1, ...codes).state;
}
/** Accepts every optional response whose id contains one of `wanted`; other prompts take the first option. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    return firstLegal(state);
  };
/** Every response id offered while `pick` drives `commands`. */
function driveOffers(state: GameState, pick: Picker, ...commands: Command[]) {
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  const result = driveEventsPicking(WAVE7_DEPS, state, spy, ...commands);
  return { ...result, offered };
}
const hasOffer = (offered: Set<string>, ref: string): boolean => [...offered].some((o) => o.includes(ref));
describe("X-23 supports, upgrades and allies registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(X23_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly its refs", () => {
    expect(Object.keys(X23_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
  it("IPAC 43025, X-Bunker 43026 and Endurance 43027 are the same definition objects as their earlier printings", () => {
    expect(X23_SUPPORT_UPGRADES_ALLIES[IPAC]).toBe(PSYLOCKE_SUPPORT_UPGRADES_ALLIES["41022.ipac-action"]);
    expect(X23_SUPPORT_UPGRADES_ALLIES[X_BUNKER]).toBe(PSYLOCKE_SUPPORT_UPGRADES_ALLIES["41023.x-bunker-action"]);
    expect(X23_SUPPORT_UPGRADES_ALLIES[ENDURANCE]).toBe(MSM_PACK_CARDS["05023.endurance-constant"]);
  });
});

describe("X-23's Claws (43002)", () => {
  const useClaws = (s: GameState) => use(P1, clawsOf(s), CLAWS_ACTION);
  it("exhausts the Claws and X-23 takes 2 damage: ATK 1 becomes 3 until the end of the round", () => {
    const s = heroGame();
    expect(profileOf(s).atk).toBe(1);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, useClaws(s));
    expect(inst(state, clawsOf(state)).exhausted).toBe(true);
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(profileOf(state).atk).toBe(3);
  });
  it("the +2 ATK is real: a basic attack for 3 defeats a 3-hit-point minion", () => {
    const s0 = heroGame();
    const m = withMinion(s0, HYDRA_MERCENARY);
    const { state: s1 } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, useClaws(m.state));
    const { state } = driveEventsPicking(WAVE7_DEPS, s1, firstLegal, basicAttack(s1, m.id));
    expect(playerOf(state, P1).playArea).not.toContain(m.id);
  });
  it("the bonus ends with the round: X-23's ATK is 1 again in the next player phase", () => {
    const s = heroGame();
    const { state: used } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, useClaws(s));
    const next = settle(
      driveEventsPicking(WAVE7_DEPS, used, firstLegal, endTurn(P1)).state,
      firstLegal,
      (x) => x.step.phase === "player" && x.round > s.round,
      WAVE7_DEPS,
    );
    expect(profileOf(next, identityOf(next)).atk).toBe(1);
  });
  it("Living Weapon readies her after the 2 damage paid as a cost, once", () => {
    const s = exhaust(heroGame(), identityOf(heroGame()));
    const { state, offered } = driveOffers(s, accepting(LIVING_WEAPON), useClaws(s));
    expect(hasOffer(offered, LIVING_WEAPON)).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
    expect(damageOn(state, identityOf(state))).toBe(2);
    expect(inst(state, clawsOf(state)).exhausted).toBe(true);
  });
  it("is refused while the Claws are exhausted (one use a round)", () => {
    const s = heroGame();
    const used = driveEventsPicking(WAVE7_DEPS, s, firstLegal, useClaws(s)).state;
    expect(rejected(used, useClaws(used))).toBe(true);
  });
  it("is a hero Action: refused in alter-ego form", () => {
    expect(rejected(alterEgoGame(), useClaws(alterEgoGame()))).toBe(true);
  });
  it("a tough status card on X-23 would prevent the damage, so the cost cannot be paid", () => {
    const s0 = heroGame();
    const s = patchInstance(s0, identityOf(s0), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    expect(rejected(s, useClaws(s))).toBe(true);
  });
  it("the damage is a cost paid in full: with 1 hit point left it still pays and she is defeated", () => {
    const s0 = heroGame();
    const s = withDamage(s0, identityOf(s0), 9);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, useClaws(s));
    expect(state.outcome).toBeTruthy();
  });
  it("two players: only the Claws' owner's identity takes the damage", () => {
    const s = heroGame([X23, SPIDER_MAN]);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, useClaws(s));
    expect(damageOn(state, identityOf(state, P1))).toBe(2);
    expect(damageOn(state, identityOf(state, P2))).toBe(0);
  });
});

describe("Honey Badger (43003)", () => {
  const ally = (s: GameState) => put(s, HONEY_BADGER, 2);
  it("after she takes consequential damage from her own attack and survives, ready X-23", () => {
    const base = heroGame();
    const { state: s0, id } = ally(exhaust(base, identityOf(base)));
    const s = patchInstance(s0, id, { exhausted: false });
    const { state, offered } = driveOffers(s, accepting(HONEY_BADGER_RESPONSE), basicAttack(s, stryfe(s), id));
    expect(hasOffer(offered, HONEY_BADGER_RESPONSE)).toBe(true);
    expect(damageOn(state, id)).toBe(1);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("it is optional: declined, X-23 stays exhausted", () => {
    const base = heroGame();
    const { state: s0, id } = ally(exhaust(base, identityOf(base)));
    const s = patchInstance(s0, id, { exhausted: false });
    const { state } = driveOffers(s, accepting(), basicAttack(s, stryfe(s), id));
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("her thwart's consequential damage answers the same way", () => {
    const base = withoutSideSchemes(heroGame());
    const { state: s0, id } = ally(exhaust(base, identityOf(base)));
    const s = patchInstance(s0, id, { exhausted: false });
    const { state, offered } = driveOffers(
      s,
      accepting(HONEY_BADGER_RESPONSE),
      basicThwart(s, s.mainScheme.instanceId, id),
    );
    expect(hasOffer(offered, HONEY_BADGER_RESPONSE)).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("lethal damage means no response: she is gone by the time it would trigger (RRG p. 14 steps 8-9, FAQ p. 64)", () => {
    const base = heroGame();
    const { state: s0, id } = ally(exhaust(base, identityOf(base)));
    const s = withDamage(patchInstance(s0, id, { exhausted: false }), id, 1);
    const { state, offered } = driveOffers(s, accepting(HONEY_BADGER_RESPONSE), basicAttack(s, stryfe(s), id));
    expect(hasOffer(offered, HONEY_BADGER_RESPONSE)).toBe(false);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("is a Hero Response: in alter-ego form it is not offered", () => {
    const base = alterEgoGame();
    const { state: s0, id } = ally(exhaust(base, identityOf(base)));
    const s = patchInstance(s0, id, { exhausted: false });
    const { state, offered } = driveOffers(s, accepting(HONEY_BADGER_RESPONSE), basicAttack(s, stryfe(s), id));
    expect(hasOffer(offered, HONEY_BADGER_RESPONSE)).toBe(false);
    expect(inst(state, identityOf(state)).exhausted).toBe(true);
  });
  it("two players: only X-23 is readied, not the other hero", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const { state: s0, id } = ally(exhaust(exhaust(base, identityOf(base, P1)), identityOf(base, P2)));
    const s = patchInstance(s0, id, { exhausted: false });
    const { state } = driveOffers(s, accepting(HONEY_BADGER_RESPONSE), basicAttack(s, stryfe(s), id));
    expect(inst(state, identityOf(state, P1)).exhausted).toBe(false);
    expect(inst(state, identityOf(state, P2)).exhausted).toBe(true);
  });
});

describe("Sisterhood (43008)", () => {
  /** Takes the first card a search offers. */
  const finding: Picker = (st) =>
    st.pendingChoice?.prompt.kind === "chooseCards" ? [st.pendingChoice.options[0]!.optionId] : firstLegal(st);
  const act = (s: GameState, id: InstanceId, discardId: InstanceId, pick: Picker = finding) =>
    driveEventsPicking(WAVE7_DEPS, s, pick, use(P1, id, SISTERHOOD, [], { discard: [discardId] }));
  const ready = (codes: string[], base = heroGame()) => {
    const given = inPlay(withHand(base, ...codes), "43008");
    return { ...given, discardId: (id: InstanceId) => id };
  };
  const handId = (s: GameState, code: string) => handOf(s).find((x) => codeOf(s, x) === code)!;
  it("exhaust and discard an X-23 card from hand: Honey Badger from the deck goes to hand, the deck is shuffled", () => {
    const { state: s, id } = ready([CLAW_MASTERY]);
    expect(deckCodes(s)).toContain(HONEY_BADGER);
    const { state } = act(s, id, handId(s, CLAW_MASTERY));
    expect(handCodes(state)).toEqual([HONEY_BADGER]);
    expect(discardCodes(state)).toEqual([CLAW_MASTERY]);
    expect(deckCodes(state)).not.toContain(HONEY_BADGER);
    expect(playerOf(state, P1).deck).toHaveLength(playerOf(s, P1).deck.length - 1);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("she may come from the discard pile instead", () => {
    const base = heroGame();
    const staged = moveToDiscardPile(base, HONEY_BADGER);
    const { state: s, id } = ready([CLAW_MASTERY], staged);
    expect(deckCodes(s)).not.toContain(HONEY_BADGER);
    const { state } = act(s, id, handId(s, CLAW_MASTERY));
    expect(handCodes(state)).toEqual([HONEY_BADGER]);
    expect(discardCodes(state)).toEqual([CLAW_MASTERY]);
  });
  it("the card discarded as the cost may be Honey Badger herself: she is then found in the discard pile", () => {
    const { state: s, id } = ready([HONEY_BADGER]);
    const { state } = act(s, id, handId(s, HONEY_BADGER));
    expect(handCodes(state)).toEqual([HONEY_BADGER]);
    expect(discardCodes(state)).toEqual([]);
  });
  it("searching is optional: declining the search still pays the cost and shuffles", () => {
    const { state: s, id } = ready([CLAW_MASTERY]);
    const none: Picker = (st) => (st.pendingChoice?.prompt.kind === "chooseCards" ? [] : firstLegal(st));
    const { state } = act(s, id, handId(s, CLAW_MASTERY), none);
    expect(handCodes(state)).toEqual([]);
    expect(discardCodes(state)).toEqual([CLAW_MASTERY]);
    expect(deckCodes(state)).toContain(HONEY_BADGER);
  });
  it("with Honey Badger in play there is nothing to find: the cost is paid and the hand does not grow", () => {
    const base = inPlay(heroGame(), HONEY_BADGER).state;
    const { state: s, id } = ready([CLAW_MASTERY], base);
    const { state } = act(s, id, handId(s, CLAW_MASTERY));
    expect(handCodes(state)).toEqual([]);
    expect(discardCodes(state)).toEqual([CLAW_MASTERY]);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("an Aggression card (Critical Hit) is not an X-23 card: it cannot pay, and an empty hand cannot either", () => {
    const { state: s, id } = ready([CRITICAL_HIT]);
    expect(rejected(s, use(P1, id, SISTERHOOD, [], { discard: [handId(s, CRITICAL_HIT)] }))).toBe(true);
    const { state: empty, id: id2 } = ready([]);
    expect(rejected(empty, use(P1, id2, SISTERHOOD, [], { discard: [] }))).toBe(true);
  });
  it("is refused while exhausted", () => {
    const { state: s, id } = ready([CLAW_MASTERY]);
    expect(rejected(exhaust(s, id), use(P1, id, SISTERHOOD, [], { discard: [handId(s, CLAW_MASTERY)] }))).toBe(true);
  });
  it("works in alter-ego form too (a plain Action)", () => {
    const { state: s, id } = ready([CLAW_MASTERY], alterEgoGame());
    const { state } = act(s, id, handId(s, CLAW_MASTERY));
    expect(handCodes(state)).toEqual([HONEY_BADGER]);
  });
  it("two players: only X-23's own deck is searched and the other hand and deck do not change", () => {
    const { state: s, id } = ready([CLAW_MASTERY], heroGame([X23, SPIDER_MAN]));
    const { state } = act(s, id, handId(s, CLAW_MASTERY));
    expect(handOf(state, P2)).toEqual(handOf(s, P2));
    expect(playerOf(state, P2).deck).toHaveLength(playerOf(s, P2).deck.length);
  });
});

/** Moves a copy of `code` from the deck to the discard pile of P1. */
function moveToDiscardPile(state: GameState, code: string): GameState {
  const id = playerOf(state, P1).deck.find((x) => codeOf(state, x) === code)!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, deck: p.deck.filter((x) => x !== id), discard: [...p.discard, id] } : p,
    ),
  };
}

const SANDMAN = "01102"; // ATK 3, 4 hit points, no Guard
/** Answers a `chooseOne` with its last option (the "do not" branch of a "you may"). */
const lastOption: Picker = (st) => {
  const c = st.pendingChoice;
  return c?.prompt.kind === "chooseOption" ? [c.options[c.options.length - 1]!.optionId] : firstLegal(st);
};
const inPlayArea = (s: GameState, id: InstanceId, p = P1): boolean => playerOf(s, p).playArea.includes(id);
/** Ends P1's turn and settles to the next player phase (the villain phase in between). */
const nextRound = (s: GameState, pick: Picker = firstLegal): GameState =>
  settle(
    driveEventsPicking(WAVE7_DEPS, s, pick, endTurn(P1)).state,
    pick,
    (x) => x.step.phase === "player" && x.round > s.round,
    WAVE7_DEPS,
  );

describe("Adamantium Lacing (43009)", () => {
  const lacing = (s: GameState) => put(s, "43009", 1);
  it("costs 1 and attaches to X-23: +2 hit points (10 becomes 12)", () => {
    const s = heroGame();
    expect(profileOf(s).maxHp).toBe(10);
    const { state, id } = lacing(s);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(profileOf(state).maxHp).toBe(12);
  });
  it("X-23 gains retaliate 1 (a minion attacking her takes 1 damage)", () => {
    const s = heroGame();
    expect(hasKeyword(s, identityOf(s), "retaliate", WAVE7_DEPS)).toBe(false);
    const { state } = lacing(s);
    expect(hasKeyword(state, identityOf(state), "retaliate", WAVE7_DEPS)).toBe(true);
  });
  it("only on her hero face: Laura Kinney has no retaliate", () => {
    const { state } = lacing(heroGame());
    expect(hasKeyword(withForm(state, "alterEgo"), identityOf(state), "retaliate", WAVE7_DEPS)).toBe(false);
  });
  it("her basic attacks gain piercing: the tough status card is discarded and the 1 damage is still dealt", () => {
    const s0 = heroGame();
    const plain = withMinion(s0, SANDMAN, { tough: true });
    const { state: without } = driveEventsPicking(
      WAVE7_DEPS,
      plain.state,
      firstLegal,
      basicAttack(plain.state, plain.id),
    );
    expect(damageOn(without, plain.id)).toBe(0);
    expect(inst(without, plain.id).statuses.tough).toBe(0);
    const { state: s1 } = lacing(s0);
    const m = withMinion(s1, SANDMAN, { tough: true });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    expect(damageOn(state, m.id)).toBe(1);
    expect(inst(state, m.id).statuses.tough).toBe(0);
  });
  it("two players: the +2 hit points and retaliate are only X-23's", () => {
    const { state } = lacing(heroGame([X23, SPIDER_MAN]));
    expect(profileOf(state, identityOf(state, P2)).maxHp).toBe(10);
    expect(hasKeyword(state, identityOf(state, P2), "retaliate", WAVE7_DEPS)).toBe(false);
  });
});

describe("Grim Resolve (43010)", () => {
  /** Plays Honey Badger (cost 2) paying with Grim Resolve's [wild] and 1 hand card. */
  const payWithGrim = (s: GameState, grim: InstanceId, pick: Picker = firstLegal, player = P1) => {
    const given = moveToHand(s, player, HONEY_BADGER);
    const [hb] = given.ids as [InstanceId];
    const other = payWith(given.state, player, 1, [hb]);
    return {
      hb,
      ...driveEventsPicking(
        WAVE7_DEPS,
        given.state,
        pick,
        play(player, hb, other, { abilities: [resourceAbility(grim, GRIM_RESOLVE)] }),
      ),
    };
  };
  it("exhaust and take 1 damage: generates a [wild] resource that helps pay for Honey Badger (cost 2)", () => {
    const { state: s, id } = attached(heroGame(), "43010");
    const { state, hb } = payWithGrim(s, id);
    expect(inst(state, id).exhausted).toBe(true);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(inPlayArea(state, hb)).toBe(true);
    expect(handOf(state)).toHaveLength(handOf(s).length - 1);
  });
  it("Living Weapon readies her after the 1 damage paid as a cost", () => {
    const { state: s0, id } = attached(heroGame(), "43010");
    const s = exhaust(s0, identityOf(s0));
    const { state, offered } = (() => {
      const given = moveToHand(s, P1, HONEY_BADGER);
      const [hb] = given.ids as [InstanceId];
      return driveOffers(
        given.state,
        accepting(LIVING_WEAPON),
        play(P1, hb, payWith(given.state, P1, 1, [hb]), { abilities: [resourceAbility(id, GRIM_RESOLVE)] }),
      );
    })();
    expect(hasOffer(offered, LIVING_WEAPON)).toBe(true);
    expect(inst(state, identityOf(state)).exhausted).toBe(false);
  });
  it("a Resource, not a Hero Resource: Laura Kinney in alter-ego form can use it and takes the 1 damage", () => {
    const { state: s, id } = attached(alterEgoGame(), "43010");
    const { state, hb } = payWithGrim(s, id);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(inPlayArea(state, hb)).toBe(true);
  });
  it("a tough status card on her would prevent the damage: the cost cannot be paid, so the play is refused", () => {
    const { state: s0, id } = attached(heroGame(), "43010");
    const s = patchInstance(s0, identityOf(s0), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const given = moveToHand(s, P1, HONEY_BADGER);
    const [hb] = given.ids as [InstanceId];
    expect(
      rejected(
        given.state,
        play(P1, hb, payWith(given.state, P1, 1, [hb]), { abilities: [resourceAbility(id, GRIM_RESOLVE)] }),
      ),
    ).toBe(true);
  });
  it("an exhausted Grim Resolve cannot be used", () => {
    const { state: s0, id } = attached(heroGame(), "43010");
    const s = exhaust(s0, id);
    const given = moveToHand(s, P1, HONEY_BADGER);
    const [hb] = given.ids as [InstanceId];
    expect(
      rejected(
        given.state,
        play(P1, hb, payWith(given.state, P1, 1, [hb]), { abilities: [resourceAbility(id, GRIM_RESOLVE)] }),
      ),
    ).toBe(true);
  });
  it("two players: she may pay for her own card only and the other hero takes nothing", () => {
    const { state: s, id } = attached(heroGame([X23, SPIDER_MAN]), "43010");
    const { state } = payWithGrim(s, id);
    expect(damageOn(state, identityOf(state, P2))).toBe(0);
    expect(damageOn(state, identityOf(state, P1))).toBe(1);
  });
});

describe("Pain Tolerance (43011)", () => {
  const hurt = (n: number, base = heroGame()) => withDamage(base, identityOf(base), n);
  it("after you play it (it counts itself): heal 1 damage from your identity (3 becomes 2)", () => {
    const { state } = put(hurt(3), "43011", 2, { pick: accepting(PAIN_TOLERANCE) });
    expect(damageOn(state, identityOf(state))).toBe(2);
  });
  it("after you play another X-23 card (Honey Badger): heal 1 more", () => {
    const { state: s } = put(hurt(3), "43011", 2, { pick: accepting(PAIN_TOLERANCE) });
    const { state } = put(s, HONEY_BADGER, 2, { pick: accepting(PAIN_TOLERANCE) });
    expect(damageOn(state, identityOf(state))).toBe(1);
  });
  it("a card that is not an X-23 card (Rictor, Aggression) does not trigger it", () => {
    const { state: s } = put(hurt(3), "43011", 2, { pick: accepting(PAIN_TOLERANCE) });
    const { state } = put(s, "43014", 3, { pick: accepting(PAIN_TOLERANCE) });
    expect(damageOn(state, identityOf(state))).toBe(2);
  });
  it("is optional: declined, the damage stays", () => {
    const { state } = put(hurt(3), "43011", 2, { pick: accepting() });
    expect(damageOn(state, identityOf(state))).toBe(3);
  });
  it("two players: it heals its own player's identity, not the other hero", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const s = withDamage(hurt(3, base), identityOf(base, P2), 3);
    const { state } = put(s, "43011", 2, { pick: accepting(PAIN_TOLERANCE) });
    expect(damageOn(state, identityOf(state, P1))).toBe(2);
    expect(damageOn(state, identityOf(state, P2))).toBe(3);
  });
});

describe("Puncture Wound (43012)", () => {
  const attackedMinion = () => {
    const m = withMinion(heroGame(), SANDMAN);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    return { state, id: m.id };
  };
  it("attaches (cost 0) to an enemy X-23 attacked this turn: -1 ATK (Sandman 3 becomes 2)", () => {
    const { state: s, id: m } = attackedMinion();
    const { state, id } = put(s, "43012", 0, { attach: m });
    expect(inst(state, id).attachedTo).toBe(m);
    expect(profileOf(state, m).atk).toBe(2);
  });
  it("is refused on an enemy X-23 did not attack this turn", () => {
    const { state: s, id: m } = attackedMinion();
    const given = moveToHand(s, P1, "43012");
    const other = withMinion(given.state, SANDMAN);
    expect(rejected(other.state, play(P1, given.ids[0]!, [], { attachToInstanceId: other.id }))).toBe(true);
    expect(rejected(given.state, play(P1, given.ids[0]!, [], { attachToInstanceId: stryfe(given.state) }))).toBe(true);
    expect(m).toBeTruthy();
  });
  it("an enemy Honey Badger attacked counts too", () => {
    const s0 = heroGame();
    const { state: s1, id: hb } = inPlay(s0, HONEY_BADGER);
    const m = withMinion(s1, SANDMAN);
    const { state: s } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id, hb));
    const { state, id } = put(s, "43012", 0, { attach: m.id });
    expect(inst(state, id).attachedTo).toBe(m.id);
  });
  it("two players: an enemy engaged with the other hero qualifies once X-23 attacked it", () => {
    const s0 = heroGame([X23, SPIDER_MAN]);
    const m = withMinion(s0, SANDMAN, { player: P2 });
    const { state: s } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    const { state, id } = put(s, "43012", 0, { attach: m.id });
    expect(inst(state, id).attachedTo).toBe(m.id);
    expect(profileOf(state, m.id).atk).toBe(2);
  });
  it("Forced Response: as the next player phase begins, discard it and deal 3 damage to the attached enemy", () => {
    // A tough status card absorbs X-23's attack, so the minion (4 hit points) has no damage and survives the 3.
    const m = withMinion(heroGame(), SANDMAN, { tough: true });
    const { state: s } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    expect(damageOn(s, m.id)).toBe(0);
    const { state: attachedState, id } = put(s, "43012", 0, { attach: m.id });
    const next = nextRound(attachedState);
    expect(damageOn(next, m.id)).toBe(3);
    expect(playerOf(next, P1).discard).toContain(id);
    expect(inst(next, m.id).attachments).not.toContain(id);
  });
  it("3 damage can defeat the attached minion (1 + 3 on 4 hit points)", () => {
    const m = withMinion(heroGame(), SANDMAN);
    const { state: s } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, basicAttack(m.state, m.id));
    const { state: attachedState, id } = put(s, "43012", 0, { attach: m.id });
    const next = nextRound(attachedState);
    expect(playerOf(next, P1).playArea).not.toContain(m.id);
    expect(playerOf(next, P1).discard).toContain(id);
  });
});

describe("Boom Boom (43013)", () => {
  const boom = (base = heroGame()) => put(base, "43013", 3);
  const boomUse = (id: InstanceId) => use(P1, id, BOOM_BOOM);
  it("exhaust: 1 boom counter; kept (the 'you may' declined), nothing is damaged", () => {
    const { state: s, id } = boom();
    const { state } = driveEventsPicking(WAVE7_DEPS, s, lastOption, boomUse(id));
    expect(inst(state, id).exhausted).toBe(true);
    expect(inst(state, id).counters.boom).toBe(1);
    expect(inPlayArea(state, id)).toBe(true);
    expect(damageOn(state, stryfe(state))).toBe(0);
  });
  it("discarding her with 1 counter deals 1 damage to each enemy: the villain and a 4-hit-point minion", () => {
    const { state: s0, id } = boom();
    const m = withMinion(s0, SANDMAN);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, boomUse(id));
    expect(damageOn(state, stryfe(state))).toBe(1);
    expect(damageOn(state, m.id)).toBe(1);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(inPlayArea(state, id)).toBe(false);
  });
  it("the damage is 1 per counter she holds: a second use after a kept first one deals 2 to each enemy", () => {
    const { state: s0, id } = boom();
    const m = withMinion(s0, SANDMAN);
    const kept = driveEventsPicking(WAVE7_DEPS, m.state, lastOption, boomUse(id)).state;
    const again = patchInstance(kept, id, { exhausted: false });
    const { state } = driveEventsPicking(WAVE7_DEPS, again, firstLegal, boomUse(id));
    expect(damageOn(state, stryfe(state))).toBe(2);
    expect(damageOn(state, m.id)).toBe(2);
    expect(playerOf(state, P1).discard).toContain(id);
  });
  it("it can defeat a minion: a minion with 3 damage on 4 hit points dies to the 1", () => {
    const { state: s0, id } = boom();
    const m = withMinion(s0, SANDMAN, { damage: 3 });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, boomUse(id));
    expect(playerOf(state, P1).playArea).not.toContain(m.id);
  });
  it("is refused while she is exhausted", () => {
    const { state: s, id } = boom();
    expect(rejected(exhaust(s, id), boomUse(id))).toBe(true);
  });
  it("works in alter-ego form too (a plain Action)", () => {
    const { state: s, id } = boom(alterEgoGame());
    const { state } = driveEventsPicking(WAVE7_DEPS, s, lastOption, boomUse(id));
    expect(inst(state, id).counters.boom).toBe(1);
  });
  it("two players: each enemy is dealt the damage, including one engaged with the other hero, and no hero or ally is", () => {
    const { state: s0, id } = boom(heroGame([X23, SPIDER_MAN]));
    const m = withMinion(s0, SANDMAN, { player: P2 });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, firstLegal, boomUse(id));
    expect(damageOn(state, m.id)).toBe(1);
    expect(damageOn(state, identityOf(state, P1))).toBe(0);
    expect(damageOn(state, identityOf(state, P2))).toBe(0);
  });
});

describe("Rictor (43014)", () => {
  const rictor = (base = heroGame()) => put(base, "43014", 3);
  /** Rictor attacks the villain with `top` (a card swapped in for the top of the deck) discarded. */
  function attackWith(base: GameState, id: InstanceId, topCode: string | null, pick: Picker = accepting(RICTOR)) {
    const stacked = putOnTopOfDeck(base, P1, CRITICAL_HIT);
    const top = stacked.ids[0]!;
    const s = topCode ? patchInstance(stacked.state, top, { cardId: cardId(topCode) }) : stacked.state;
    return { top, s, ...driveOffers(s, pick, basicAttack(s, stryfe(s), id)) };
  }
  it("after Rictor attacks: discards the top card (1 printed resource) and deals 1 damage to a minion engaged with you", () => {
    const { state: s0, id } = rictor();
    const m = withMinion(s0, SANDMAN);
    const { state, top, offered } = attackWith(m.state, id, null);
    expect(hasOffer(offered, RICTOR)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(top);
    expect(damageOn(state, m.id)).toBe(1);
  });
  it("2 printed resources deal 2 damage to each such minion", () => {
    const { state: s0, id } = rictor();
    const m = withMinion(s0, SANDMAN);
    const m2 = withMinion(m.state, SANDMAN);
    const { state } = attackWith(m2.state, id, "27008");
    expect(damageOn(state, m.id)).toBe(2);
    expect(damageOn(state, m2.id)).toBe(2);
  });
  it("a card with no printed resources deals 0 damage but is still discarded", () => {
    const { state: s0, id } = rictor();
    const m = withMinion(s0, SANDMAN);
    const { state, top } = attackWith(m.state, id, "25002");
    expect(playerOf(state, P1).discard).toContain(top);
    expect(damageOn(state, m.id)).toBe(0);
  });
  it("only minions engaged with you: the villain (hit by the attack's 2 only) and another hero's minion are untouched", () => {
    const { state: s0, id } = rictor(heroGame([X23, SPIDER_MAN]));
    const mine = withMinion(s0, SANDMAN);
    const theirs = withMinion(mine.state, SANDMAN, { player: P2 });
    const { state } = attackWith(theirs.state, id, null);
    expect(damageOn(state, mine.id)).toBe(1);
    expect(damageOn(state, theirs.id)).toBe(0);
    expect(damageOn(state, stryfe(state))).toBe(2);
  });
  it("it is optional: declined, nothing is discarded", () => {
    const { state: s0, id } = rictor();
    const m = withMinion(s0, SANDMAN);
    const { state, top } = attackWith(m.state, id, null, accepting());
    expect(playerOf(state, P1).discard).not.toContain(top);
    expect(damageOn(state, m.id)).toBe(0);
  });
  it("his response resolves before his consequential damage (RRG p. 13), so it works even when that damage then defeats him", () => {
    const { state: s0, id } = rictor();
    const m = withMinion(s0, SANDMAN);
    const { state, top, offered } = attackWith(withDamage(m.state, id, 2), id, null);
    expect(hasOffer(offered, RICTOR)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(top);
    expect(damageOn(state, m.id)).toBe(1);
    expect(playerOf(state, P1).discard).toContain(id);
  });
});

describe("Shatterstar (43015)", () => {
  const star = (base = heroGame()) => put(base, "43015", 4);
  it("attacks a minion engaged with someone else: engages it, ATK 2 only, and no +1", () => {
    const { state: s0, id } = star(heroGame([X23, SPIDER_MAN]));
    const m = withMinion(s0, SANDMAN, { player: P2 });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(SHATTERSTAR), basicAttack(m.state, m.id, id));
    expect(inst(state, m.id).engagedWith).toBe(P1);
    expect(playerOf(state, P1).playArea).toContain(m.id);
    expect(damageOn(state, m.id)).toBe(2);
  });
  it("attacks an unengaged minion: engages it with you and deals 2", () => {
    const { state: s0, id } = star();
    const m = withMinion(s0, SANDMAN, { engaged: null });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(SHATTERSTAR), basicAttack(m.state, m.id, id));
    expect(inst(state, m.id).engagedWith).toBe(P1);
    expect(damageOn(state, m.id)).toBe(2);
  });
  it("already engaged with you: +1 ATK for this attack, so 3 damage", () => {
    const { state: s0, id } = star();
    const m = withMinion(s0, SANDMAN);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(SHATTERSTAR), basicAttack(m.state, m.id, id));
    expect(damageOn(state, m.id)).toBe(3);
    expect(inst(state, m.id).engagedWith).toBe(P1);
    expect(profileOf(state, id).atk).toBe(2);
  });
  it("attacking the villain is not an attack on a minion: 2 damage, no bonus", () => {
    const { state: s, id } = star();
    const { state } = driveEventsPicking(WAVE7_DEPS, s, accepting(SHATTERSTAR), basicAttack(s, stryfe(s), id));
    expect(damageOn(state, stryfe(state))).toBe(2);
  });
  it("his consequential damage still applies: 1 from the attack", () => {
    const { state: s0, id } = star();
    const m = withMinion(s0, SANDMAN);
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(SHATTERSTAR), basicAttack(m.state, m.id, id));
    expect(damageOn(state, id)).toBe(1);
  });
  it("is optional: declined, a minion engaged with someone else stays so and the attack is ATK 2", () => {
    const { state: s0, id } = star(heroGame([X23, SPIDER_MAN]));
    const m = withMinion(s0, SANDMAN, { player: P2 });
    const { state } = driveEventsPicking(WAVE7_DEPS, m.state, accepting(), basicAttack(m.state, m.id, id));
    expect(inst(state, m.id).engagedWith).toBe(P2);
    expect(damageOn(state, m.id)).toBe(2);
  });
});

describe('"Now I\'m Mad" (43019)', () => {
  const mad = (base: GameState, host = identityOf(base), player = P1) =>
    put(base, "43019", 1, { attach: host, player });
  const stats = (s: GameState, p = P1) => {
    const x = profileOf(s, identityOf(s, p));
    return [x.atk, x.thw];
  };
  it("at exactly half (5 of 10 remaining) nothing changes: ATK 1, THW 2", () => {
    const { state } = mad(heroGame());
    expect(stats(withDamage(state, identityOf(state), 5))).toEqual([1, 2]);
  });
  it("below half (4 of 10 remaining): +1 ATK and -1 THW", () => {
    const { state } = mad(heroGame());
    expect(stats(withDamage(state, identityOf(state), 6))).toEqual([2, 1]);
  });
  it("with full hit points nothing changes and healing back above half removes it again", () => {
    const { state } = mad(heroGame());
    expect(stats(state)).toEqual([1, 2]);
    const low = withDamage(state, identityOf(state), 9);
    expect(stats(low)).toEqual([2, 1]);
    expect(stats(withDamage(low, identityOf(low), 2))).toEqual([1, 2]);
  });
  it("'starting' hit points are the printed 10: with Endurance (13) 7 remaining is not below half, 4 is", () => {
    const { state: s0 } = put(heroGame(), "43027", 1);
    const { state } = mad(s0);
    expect(profileOf(state).maxHp).toBe(13);
    expect(stats(withDamage(state, identityOf(state), 6))).toEqual([1, 2]);
    expect(stats(withDamage(state, identityOf(state), 9))).toEqual([2, 1]);
  });
  it("play under any player's control: X-23's player puts it on Spider-Man, who gets the bonus", () => {
    const base = withForm(heroGame([X23, SPIDER_MAN]), { heroForm: 0 }, P2);
    const before = stats(base, P2);
    const { state } = put(base, "43019", 1, { controller: P2 });
    const low = withDamage(state, identityOf(state, P2), 6);
    expect(stats(low, P2)).toEqual([before[0]! + 1, before[1]! - 1]);
    expect(stats(withDamage(low, identityOf(low, P1), 6), P1)).toEqual([1, 2]);
  });
  it("Max 1 per player: a second copy on the same hero is refused", () => {
    const { state } = mad(heroGame());
    const given = moveToHand(state, P1, "43019");
    expect(
      rejected(
        given.state,
        play(P1, given.ids[0]!, payWith(given.state, P1, 1, [given.ids[0]!]), {
          attachToInstanceId: identityOf(state),
        }),
      ),
    ).toBe(true);
  });
});

describe("The Direct Approach (43020)", () => {
  const scheme = (base = heroGame()) => {
    const s = patchInstance({ ...base, villainArea: [] }, base.mainScheme.instanceId, { threat: 6 });
    return encounterCardInVillainArea(s, BREAKIN, 3);
  };
  const thwartBy = (s: GameState, id: InstanceId) =>
    driveEventsPicking(WAVE7_DEPS, s, firstLegal, basicThwart(s, id)).state;
  it("attaches (cost 1) to a non-permanent side scheme and gives it assault", () => {
    const staged = scheme();
    expect(hasKeyword(staged.state, staged.id, "assault", WAVE7_DEPS)).toBe(false);
    const { state, id } = put(staged.state, "43020", 1, { attach: staged.id });
    expect(inst(state, id).attachedTo).toBe(staged.id);
    expect(hasKeyword(state, staged.id, "assault", WAVE7_DEPS)).toBe(true);
  });
  it("a basic thwart against it uses ATK (1) instead of THW (2): 3 threat becomes 2, not 1", () => {
    const staged = scheme();
    expect(threatOf(thwartBy(staged.state, staged.id), staged.id)).toBe(1);
    const { state } = put(staged.state, "43020", 1, { attach: staged.id });
    expect(threatOf(thwartBy(state, staged.id), staged.id)).toBe(2);
  });
  it("is refused on the main scheme and on a hero", () => {
    const staged = scheme();
    const given = moveToHand(staged.state, P1, "43020");
    const pay = payWith(given.state, P1, 1, [given.ids[0]!]);
    expect(
      rejected(given.state, play(P1, given.ids[0]!, pay, { attachToInstanceId: given.state.mainScheme.instanceId })),
    ).toBe(true);
    expect(rejected(given.state, play(P1, given.ids[0]!, pay, { attachToInstanceId: identityOf(given.state) }))).toBe(
      true,
    );
  });
  it("Limit 1 per side scheme: a second copy cannot be attached to the same scheme", () => {
    const staged = scheme();
    const { state } = put(staged.state, "43020", 1, { attach: staged.id });
    const given = moveToHand(state, P1, "43020");
    expect(
      rejected(
        given.state,
        play(P1, given.ids[0]!, payWith(given.state, P1, 1, [given.ids[0]!]), { attachToInstanceId: staged.id }),
      ),
    ).toBe(true);
  });
});
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;

describe("Endurance (43027)", () => {
  it("costs 1, attaches to your identity: +3 hit points (10 becomes 13)", () => {
    const { state, id } = put(heroGame(), "43027", 1);
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(profileOf(state).maxHp).toBe(13);
  });
  it("play under any player's control: it can go on Spider-Man instead", () => {
    const base = heroGame([X23, SPIDER_MAN]);
    const before = profileOf(base, identityOf(base, P2)).maxHp;
    const { state } = put(base, "43027", 1, { controller: P2 });
    expect(profileOf(state, identityOf(state, P2)).maxHp).toBe(before + 3);
    expect(profileOf(state, identityOf(state, P1)).maxHp).toBe(10);
  });
  it("Max 1 per player: a second copy on the same hero is refused", () => {
    const { state } = put(heroGame(), "43027", 1);
    const given = moveToHand(state, P1, "43027");
    expect(
      rejected(
        given.state,
        play(P1, given.ids[0]!, payWith(given.state, P1, 1, [given.ids[0]!]), {
          attachToInstanceId: identityOf(state),
        }),
      ),
    ).toBe(true);
  });
});

describe("IPAC (43025)", () => {
  it("X-23 has the X-FORCE trait: playable for 1, then a hero Action deals her a facedown encounter card and she draws 2", () => {
    const { state: s, id } = put(heroGame(), "43025", 1);
    expect(inPlayArea(s, id)).toBe(true);
    const { state } = driveEventsPicking(WAVE7_DEPS, s, firstLegal, use(P1, id, IPAC));
    expect(inst(state, id).exhausted).toBe(true);
    expect(handOf(state)).toHaveLength(handOf(s).length + 2);
    expect(playerOf(state, P1).dealtEncounter).toHaveLength(playerOf(s, P1).dealtEncounter.length + 1);
  });
  it("two players: she may deal it to Spider-Man, who then draws the 2 cards", () => {
    const { state: s, id } = put(heroGame([X23, SPIDER_MAN]), "43025", 1);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) => (st.pendingChoice?.prompt.kind === "choosePlayer" ? [P2] : firstLegal(st)),
      use(P1, id, IPAC),
    );
    expect(handOf(state, P2)).toHaveLength(handOf(s, P2).length + 2);
    expect(handOf(state, P1)).toHaveLength(handOf(s, P1).length);
  });
  it("it is a hero action: refused in alter-ego form", () => {
    const { state: s, id } = put(heroGame(), "43025", 1);
    expect(rejected(withForm(s, "alterEgo"), use(P1, id, IPAC))).toBe(true);
  });
});

describe("X-Bunker (43026)", () => {
  /** One encounter side scheme moved to the victory display by surgery. */
  function withVictory(state: GameState): GameState {
    const staged = encounterCardInVillainArea(state, BREAKIN, 0);
    return {
      ...staged.state,
      villainArea: staged.state.villainArea.filter((x) => x !== staged.id),
      victoryDisplay: [...staged.state.victoryDisplay, staged.id],
    };
  }
  it("Laura Kinney is MUTANT: with 1 side scheme in the victory display she searches the top 1 card and adds it to hand", () => {
    const { state: s0, id } = put(alterEgoGame(), "43026", 2);
    const s = withVictory(s0);
    const window = playerOf(s, P1).deck.slice(0, 1);
    const { state } = driveEventsPicking(
      WAVE7_DEPS,
      s,
      (st) =>
        st.pendingChoice?.prompt.kind === "chooseCards" ? [st.pendingChoice.options[0]!.optionId] : firstLegal(st),
      use(P1, id, X_BUNKER),
    );
    expect(handOf(state)).toContain(window[0]);
    expect(inst(state, id).exhausted).toBe(true);
  });
  it("X-23 herself (hero face, X-FORCE) has no MUTANT identity: nobody can be chosen, so it cannot be used", () => {
    const { state: s0, id } = put(heroGame(), "43026", 2);
    expect(rejected(withVictory(s0), use(P1, id, X_BUNKER))).toBe(true);
  });
});
