import {
  activeEncounterDeckId,
  applyCommand,
  characterProfile,
  createGame,
  handCardResources,
  handSize,
  mainSchemeValue,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { action, dealDamage, discard, each, query, yourIdentity } from "../../dsl/index.js";
import { defineAbilities, validateDefinition } from "../../dsl/validate.js";
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
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { WAVE7_ABILITIES, wave7Scenario } from "../index.js";
import { DEADPOOL_SUPPORT_UPGRADES_ALLIES } from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadpool's allies, support, upgrades, resources and player side scheme (44002, 44007-44011, 44013-44016, 44024-44030),
 * docs/phase7-wave7.md §7.3, §3.76, §3.78-§3.81, §3.83. Every game is Juggernaut (a villain with a tough status card)
 * with the 'Pool precon (`deadpool-pool`) in seat 1, past setup, in hero form, no threat on the main scheme. Seating
 * that deck brings Crisis of Infinite Deadpools 44037 into the encounter deck: no test here reveals an encounter card.
 *
 * Hands are set by surgery (`withHand`) so a payment is exactly `cost` one-icon filler cards (44021 x3, 44012 x2).
 * Fixtures from his own kit by printed id (this file's `DEPS` replaces their refs; they are other modules' cards, and
 * every one is cost 0 unless noted): 44003 deals 20 to your identity, 44004 deals 20 to every Dogpool, 44017 deals 20
 * to every Lady Deadpool, 44006 (cost 1) deals 20 to every other player's identity, and 44018 (cost 3) discards Armed
 * to the Teeth.
 */
const CABLE_CONSTANT = "44002.cable-constant";
const MONTAGE = "44007.montage-constant";
const CHIMICHANGA = "44008.chimichanga-truck-response";
const ARMED_RESPONSE = "44009.armed-to-the-teeth-response";
const ARMED_ACTION = "44009.armed-to-the-teeth-action";
const KATANA = "44010.deadpools-katana-action";
const IT_AINT_OVER = "44011.it-aint-over-constant";
const DOGPOOL_DEFEATED = "44013.when-defeated";
const HEADPOOL = "44014.headpool-response";
const KIDPOOL = "44015.kidpool-constant";
const LADY_DEFEATED = "44016.when-defeated";
const LIVE_DANGEROUSLY = "44024.live-dangerously-constant";
const SELF_CONFIDENCE = "44025.self-confidence-constant";
const SELF_CONTROL = "44026.self-control-constant";
const SELF_PRESERVATION = "44027.self-preservation-constant";
const GIT_GUD_COST = "44028.git-gud-constant";
const GIT_GUD_INTERRUPT = "44028.git-gud-forced-interrupt";
const HEALING_FACTOR = "44029.healing-factor-response";
const STICK = "44030.stick-to-itiveness-action";
const ALL_REFS = [
  CABLE_CONSTANT,
  MONTAGE,
  CHIMICHANGA,
  ARMED_RESPONSE,
  ARMED_ACTION,
  KATANA,
  IT_AINT_OVER,
  DOGPOOL_DEFEATED,
  HEADPOOL,
  KIDPOOL,
  LADY_DEFEATED,
  LIVE_DANGEROUSLY,
  SELF_CONFIDENCE,
  SELF_CONTROL,
  SELF_PRESERVATION,
  GIT_GUD_COST,
  GIT_GUD_INTERRUPT,
  HEALING_FACTOR,
  STICK,
];

const CABLE = "44002";
const MONTAGE_CARD = "44007";
const TRUCK = "44008";
const ARMED = "44009";
const KATANA_CARD = "44010";
const IT_AINT_OVER_CARD = "44011";
const DOGPOOL = "44013";
const HEADPOOL_CARD = "44014";
const KIDPOOL_CARD = "44015";
const LADY = "44016";
const LIVE_CARD = "44024";
const SELF_CONFIDENCE_CARD = "44025";
const SELF_CONTROL_CARD = "44026";
const SELF_PRESERVATION_CARD = "44027";
const GIT_GUD = "44028";
const HEALING_CARD = "44029";
const STICK_CARD = "44030";

const HURT_SELF = "44003";
const KILL_DOGPOOL = "44004";
const KILL_LADY = "44017";
const HURT_OTHERS = "44006";
const DISCARD_ARMED = "44018"; // fixture: discards Armed to the Teeth (cost 3)
const BOMBER = "01110"; // Hydra Bomber: ATK 1, SCH 1, 2 hit points
const SHOCKER = "01103"; // ATK 2, SCH 1, 3 hit points
const SANDMAN = "01102"; // ATK 3, 4 hit points, ELITE, Toughness

const FIXTURES = defineAbilities({
  "44003.exhausting-personality-action": action(dealDamage(20, yourIdentity)),
  "44004.maximum-effort-action": action(dealDamage(20, each(query("ally", { name: "Dogpool" })))),
  "44017.barely-a-scratch-interrupt": action(dealDamage(20, each(query("ally", { name: "Lady Deadpool" })))),
  "44018.cutupper-action": action(discard(each(query("upgrade", { name: "Armed to the Teeth" })))),
  "44006.yoo-hoo-action": action(dealDamage(20, each(query("identity", { controller: "other" })))),
});
const DEPS: EngineDeps = { abilities: { ...WAVE7_ABILITIES, ...FIXTURES } };

const DEADPOOL_SEAT = { starterDeckId: "deadpool-pool" } as const;
const SPIDER_SEAT = { starterDeckId: "core-spider-man-justice" } as const;
type Seat = typeof DEADPOOL_SEAT | typeof SPIDER_SEAT;
type Facts = readonly ({ readonly wonPreviousGame?: boolean } | undefined)[];

const cache = new Map<string, GameState>();
/** Juggernaut past setup, every seat in hero form, no threat on the main scheme. Cached: states are immutable. */
function baseGame(players: readonly Seat[] = [DEADPOOL_SEAT], facts?: Facts): GameState {
  const key = players.map((p) => p.starterDeckId).join("+") + JSON.stringify(facts ?? null);
  const hit = cache.get(key);
  if (hit) return hit;
  const config = wave7Scenario("juggernaut", { players, seed: 1, difficulty: "standard", modularSetIds: [] });
  const seated = facts
    ? { ...config, players: config.players.map((p, i) => (facts[i] ? { ...p, outsideFacts: facts[i] } : p)) }
    : config;
  const created = createGame(seated, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (x) => x.step.phase === "player", DEPS);
  s = patchInstance(s, s.mainScheme.instanceId, { threat: 0 });
  for (const p of s.players) s = withForm(s, { heroForm: 0 }, p.playerId);
  cache.set(key, s);
  return s;
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const myDamage = (s: GameState, p = P1): number => damageOf(s, identityOf(s, p));
const tokens = (s: GameState): number => s.mainScheme.accelerationTokens;
const formOf = (s: GameState, p = P1) => playerOf(s, p).identity.form;
const withTokens = (s: GameState, accelerationTokens: number): GameState => ({
  ...s,
  mainScheme: { ...s.mainScheme, accelerationTokens },
});
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, DEPS)!;
const inPlay = (s: GameState, p: PlayerId = P1) => codes(s, playerOf(s, p).playArea);
const attachedTo = (s: GameState, id: InstanceId): InstanceId[] => [...inst(s, id).attachments];
const removed = (s: GameState): string[] => codes(s, s.removedFromGame);
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const resolved = (run: readonly GameEvent[], card: InstanceId, ability: string): boolean =>
  run.some((e) => e.type === "abilityResolved" && e.instanceId === card && e.abilityId === ability);
const refused = (s: GameState, command: Command): boolean => !applyCommand(s, command, DEPS).ok;
const sum = (pool: object): number => (Object.values(pool) as number[]).reduce((a, b) => a + b, 0);

const FILLERS = ["44021", "44021", "44021", "44012", "44012"];

/** Replaces `player`'s hand with copies of `wanted` (their old hand goes to the discard pile). */
function withHand(state: GameState, player: PlayerId, ...wanted: readonly string[]) {
  const owner = playerOf(state, player);
  const cleared: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [], discard: [...p.discard, ...owner.hand] } : p,
    ),
  };
  return moveToHand(cleared, player, ...wanted);
}

/** Rules for a picker: the first one that answers the open prompt wins; anything else is `firstLegal` (declines options). */
type Rule = (s: GameState, choice: PendingChoice) => readonly string[] | undefined;
const answering =
  (...rules: readonly Rule[]): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    if (choice)
      for (const rule of rules) {
        const picked = rule(s, choice);
        if (picked) return picked;
      }
    return firstLegal(s);
  };
/** Accepts the optional abilities whose id contains `sub`. */
const accept =
  (...subs: readonly string[]): Rule =>
  (_s, c) =>
    c.prompt.kind === "chooseTriggers"
      ? c.options.filter((o) => subs.some((sub) => o.optionId.includes(sub))).map((o) => o.optionId)
      : undefined;
/** Picks `ids` at a target prompt when it offers them. */
const target =
  (...ids: readonly InstanceId[]): Rule =>
  (_s, c) => {
    if (c.prompt.kind !== "chooseTarget" && c.prompt.kind !== "chooseCards") return undefined;
    const hits = ids.filter((id) => c.options.some((o) => o.optionId === id));
    return hits.length ? hits.slice(0, c.maxSelections) : undefined;
  };
/** Orders simultaneous forced abilities: those whose id contains each of `subs` first, in this order. */
const order =
  (...subs: readonly string[]): Rule =>
  (_s, c) => {
    if (c.prompt.kind !== "orderTriggers") return undefined;
    const first = subs.flatMap((sub) => c.options.filter((o) => o.optionId.includes(sub)).map((o) => o.optionId));
    return [...first, ...c.options.map((o) => o.optionId).filter((id) => !first.includes(id))];
  };
/** The prompts met while driving, for asserting what was offered. */
interface Seen {
  readonly kind: string;
  readonly player: PlayerId;
  readonly options: readonly string[];
}
function drive(state: GameState, pick: Picker, ...commands: readonly Command[]) {
  const seen: Seen[] = [];
  const spy: Picker = (s) => {
    const c = s.pendingChoice!;
    seen.push({ kind: c.prompt.kind, player: c.playerId, options: c.options.map((o) => o.optionId) });
    return pick(s);
  };
  const driven = driveEventsPicking(DEPS, state, spy, ...commands);
  return { ...driven, seen };
}

/** Plays `code` from a fresh hand of it plus `cost` fillers, as `player`; `attach` names an upgrade's host. */
function put(
  state: GameState,
  code: string,
  cost: number,
  o: { attach?: InstanceId; pick?: Picker; player?: PlayerId } = {},
) {
  const player = o.player ?? P1;
  const given = withHand(state, player, code, ...FILLERS.slice(0, cost));
  const [id, ...pay] = given.ids as [InstanceId, ...InstanceId[]];
  const driven = drive(
    given.state,
    o.pick ?? firstLegal,
    play(player, id, pay, o.attach ? { attachToInstanceId: o.attach } : {}),
  );
  return { ...driven, id, before: given.state };
}

/** Takes an engine-seated instance of `code` already in play: a minion engaged with `player`, in their play area. */
function minion(state: GameState, code: string, o: { player?: PlayerId; tough?: boolean } = {}) {
  const player = o.player ?? P1;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const spare = pile.deck.find((id) => codeOf(state, id) !== "44037")!;
  const patched = patchInstance(state, spare, {
    cardId: code as never,
    faceup: true,
    engagedWith: player,
    exhausted: false,
    statuses: { ...inst(state, spare).statuses, tough: o.tough ? 1 : 0 },
  });
  return {
    id: spare,
    state: {
      ...patched,
      encounterDecks: {
        ...patched.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== spare), discard: pile.discard },
      },
      players: patched.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, spare] } : p)),
    },
  };
}
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const withoutTough = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, tough: 0 } });

const basicAttack = (player: PlayerId, attacker: InstanceId, targetId: InstanceId): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: targetId,
});
const basicThwart = (player: PlayerId, thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});
const basicRecover = (player: PlayerId): Command => ({ type: "basicRecover", playerId: player });

describe("Deadpool supports, upgrades, allies and resources registry", () => {
  it.each(ALL_REFS)("%s validates", (id) => {
    expect(validateDefinition(DEADPOOL_SUPPORT_UPGRADES_ALLIES[id]!)).toEqual([]);
  });
  it("holds exactly the nineteen refs of this group", () => {
    expect(Object.keys(DEADPOOL_SUPPORT_UPGRADES_ALLIES).sort()).toEqual([...ALL_REFS].sort());
  });
  it("every filler card yields exactly one resource", () => {
    const s = baseGame();
    for (const code of new Set(FILLERS)) {
      const given = withHand(s, P1, code);
      expect(sum(handCardResources(given.state, DEPS, given.ids[0]!, P1, null))).toBe(1);
    }
  });
});

describe("Cable (44002): +1 THW and +1 ATK per acceleration token on the main scheme, to +3", () => {
  const stats = (s: GameState, id: InstanceId) => [profile(s, id).thw, profile(s, id).atk];
  it("costs 3 and enters play with printed THW 1, ATK 2, 3 hit points and no token bonus", () => {
    const { state, id } = put(baseGame(), CABLE, 3);
    expect(inPlay(state)).toContain(CABLE);
    expect(stats(state, id)).toEqual([1, 2]);
    expect(profile(state, id).maxHp).toBe(3);
    expect(playerOf(state, P1).hand).toHaveLength(0);
  });
  it.each([
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
    [3, 4, 5],
    [4, 4, 5],
    [9, 4, 5],
  ])("with %i token(s): THW %i and ATK %i (capped at +3 each)", (n, thw, atk) => {
    const { state, id } = put(withTokens(baseGame(), n), CABLE, 3);
    expect(stats(state, id)).toEqual([thw, atk]);
  });
  it("is live: a token added after Cable is in play counts at once, and tokens are not icons", () => {
    const { state, id } = put(baseGame(), CABLE, 3);
    expect(stats(state, id)).toEqual([1, 2]);
    expect(stats(withTokens(state, 2), id)).toEqual([3, 4]);
  });
  it("its basic attack deals the boosted ATK to a minion: 3 tokens, ATK 5, a 4-hit-point minion is defeated", () => {
    const { state, id } = put(withTokens(baseGame(), 3), CABLE, 3);
    const staged = minion(state, SANDMAN);
    const { state: after } = drive(staged.state, firstLegal, basicAttack(P1, id, staged.id));
    expect(codes(after, [...after.encounterDecks[activeEncounterDeckId(after)]!.discard])).toContain(SANDMAN);
  });
  it("its basic thwart removes the boosted THW: 2 tokens, THW 3", () => {
    const { state, id } = put(withTokens(baseGame(), 2), CABLE, 3);
    const loaded = patchInstance(state, state.mainScheme.instanceId, { threat: 10 });
    const { state: after } = drive(loaded, firstLegal, basicThwart(P1, id, loaded.mainScheme.instanceId));
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(7);
  });
  it("its own thwart damages it with consequential damage 1: at 2 damage of 3 it is defeated and discarded", () => {
    const { state, id } = put(baseGame(), CABLE, 3);
    const hurt = patchInstance(withDamage(state, id, 2), state.mainScheme.instanceId, { threat: 5 });
    const { state: after } = drive(hurt, firstLegal, basicThwart(P1, id, hurt.mainScheme.instanceId));
    expect(inPlay(after)).not.toContain(CABLE);
    expect(codes(after, playerOf(after, P1).discard)).toContain(CABLE);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(4);
  });
  it("two players: the tokens are the shared main scheme's, and the ally is the controller's alone", () => {
    const base = withTokens(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), 2);
    const { state, id } = put(base, CABLE, 3);
    expect(stats(state, id)).toEqual([3, 4]);
    expect(inPlay(state, P2)).not.toContain(CABLE);
    expect(profile(state, identityOf(state, P2)).thw).toBe(profile(base, identityOf(base, P2)).thw);
  });
});

describe("Montage (44007): 1 additional [wild] per acceleration token on the main scheme, to 3", () => {
  const yieldOf = (s: GameState, payingFor: InstanceId | null = null) => {
    const given = withHand(s, P1, MONTAGE_CARD);
    return handCardResources(given.state, DEPS, given.ids[0]!, P1, payingFor);
  };
  it.each([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 4],
    [7, 4],
  ])("with %i token(s) it generates %i [wild]", (n, wild) => {
    expect(yieldOf(withTokens(baseGame(), n))).toEqual({ physical: 0, mental: 0, energy: 0, wild });
  });
  it("pays for a cost-4 card alone with 3 tokens (Lady Deadpool), and is a resource only: it cannot be played", () => {
    const s = withTokens(baseGame(), 3);
    const given = withHand(s, P1, LADY, MONTAGE_CARD);
    const [lady, montage] = given.ids as [InstanceId, InstanceId];
    const { state } = drive(given.state, firstLegal, play(P1, lady, [montage]));
    expect(inPlay(state)).toContain(LADY);
    expect(codes(state, playerOf(state, P1).discard)).toContain(MONTAGE_CARD);
  });
  it("with 2 tokens it generates 3, one short of a cost-4 card: the play is refused and nothing is spent", () => {
    const s = withTokens(baseGame(), 2);
    const given = withHand(s, P1, LADY, MONTAGE_CARD);
    const [lady, montage] = given.ids as [InstanceId, InstanceId];
    expect(refused(given.state, play(P1, lady, [montage]))).toBe(true);
  });
  it("the printed resource stays 1 [wild] for a card that counts printed resources", () => {
    const s = withTokens(baseGame(), 3);
    const given = withHand(s, P1, MONTAGE_CARD);
    const card = given.state.cardPool[MONTAGE_CARD as never] as unknown as { producesIcons: Record<string, number> };
    expect(card.producesIcons).toEqual({ wild: 1 });
  });
  it("is read for the spending player's table: another player's Montage counts the same shared tokens", () => {
    const base = withTokens(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), 2);
    const given = withHand(base, P1, MONTAGE_CARD);
    expect(handCardResources(given.state, DEPS, given.ids[0]!, P1, null).wild).toBe(3);
  });
});

describe("Self Confidence, Self Control, Self Preservation (44025-44027): triple undamaged, double under 5 damage", () => {
  const cases: readonly [string, string, string][] = [
    [SELF_CONFIDENCE_CARD, "physical", SELF_CONFIDENCE],
    [SELF_CONTROL_CARD, "mental", SELF_CONTROL],
    [SELF_PRESERVATION_CARD, "energy", SELF_PRESERVATION],
  ];
  const yieldOf = (s: GameState, code: string) => {
    const given = withHand(s, P1, code);
    return handCardResources(given.state, DEPS, given.ids[0]!, P1, null);
  };
  it.each(cases)("%s generates 1 icon of its type; the ref %s is on it", (code, type) => {
    const s = baseGame();
    expect(yieldOf(s, code)[type as "physical"]).toBe(3);
  });
  describe.each(cases)("%s", (code, type) => {
    it.each([
      [0, 3],
      [1, 2],
      [3, 2],
      [4, 2],
      [5, 1],
      [8, 1],
    ])("with %i damage sustained it generates %i", (damage, amount) => {
      const s = withDamage(baseGame(), identityOf(baseGame()), damage);
      expect(yieldOf(s, code)).toEqual({ physical: 0, mental: 0, energy: 0, wild: 0, [type]: amount });
    });
  });
  it("sustained damage is the identity's now: healing back to none triples again", () => {
    const hurt = withDamage(baseGame(), identityOf(baseGame()), 4);
    expect(yieldOf(hurt, SELF_CONFIDENCE_CARD).physical).toBe(2);
    expect(yieldOf(withDamage(hurt, identityOf(hurt), 0), SELF_CONFIDENCE_CARD).physical).toBe(3);
  });
  it("undamaged, one card and a filler pay for a cost-4 card; with 1 damage they do not", () => {
    const s = baseGame();
    const given = withHand(s, P1, LADY, SELF_CONFIDENCE_CARD, FILLERS[0]!);
    const [lady, self, filler] = given.ids as [InstanceId, InstanceId, InstanceId];
    const { state } = drive(given.state, firstLegal, play(P1, lady, [self, filler]));
    expect(inPlay(state)).toContain(LADY);
    const hurt = withDamage(given.state, identityOf(given.state), 1);
    expect(refused(hurt, play(P1, lady, [self, filler]))).toBe(true);
  });
  it("two players: it reads the damage on its own player's identity, not another's", () => {
    const base = baseGame([DEADPOOL_SEAT, SPIDER_SEAT]);
    const hurtOther = withDamage(base, identityOf(base, P2), 6);
    expect(yieldOf(hurtOther, SELF_CONFIDENCE_CARD).physical).toBe(3);
    const hurtMine = withDamage(base, identityOf(base, P1), 6);
    expect(yieldOf(hurtMine, SELF_CONFIDENCE_CARD).physical).toBe(1);
  });
});

describe("It Ain't Over... (44011): +2 target threat per acceleration token on the attached main scheme", () => {
  const target = (s: GameState) => mainSchemeValue(s, "targetThreat", DEPS);
  it("attaches to the main scheme for 1 (cost 1 card), and 0 tokens add nothing", () => {
    const base = baseGame();
    const t0 = target(base);
    const { state, id } = put(base, IT_AINT_OVER_CARD, 1, { attach: base.mainScheme.instanceId });
    expect(attachedTo(state, state.mainScheme.instanceId)).toContain(id);
    expect(target(state)).toBe(t0);
  });
  it.each([1, 2, 3, 5])("with %i token(s) the target threat is +2 for each (no cap)", (n) => {
    const base = baseGame();
    const t0 = target(base);
    const { state } = put(withTokens(base, n), IT_AINT_OVER_CARD, 1, { attach: base.mainScheme.instanceId });
    expect(target(state)).toBe(t0 + 2 * n);
  });
  it("is live: a token added after it is attached raises the target threat by 2 each", () => {
    const base = baseGame();
    const t0 = target(base);
    const { state } = put(base, IT_AINT_OVER_CARD, 1, { attach: base.mainScheme.instanceId });
    expect(target(withTokens(state, 1))).toBe(t0 + 2);
    expect(target(withTokens(state, 4))).toBe(t0 + 8);
  });
  it("can only attach to the main scheme: attaching to a character is refused", () => {
    const base = baseGame();
    const given = withHand(base, P1, IT_AINT_OVER_CARD, FILLERS[0]!);
    const [card, filler] = given.ids as [InstanceId, InstanceId];
    expect(refused(given.state, play(P1, card, [filler], { attachToInstanceId: identityOf(given.state) }))).toBe(true);
  });
  it("two players: one attachment on the shared scheme, its tokens the shared ones", () => {
    const base = withTokens(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), 2);
    const t0 = target(base);
    const { state } = put(base, IT_AINT_OVER_CARD, 1, { attach: base.mainScheme.instanceId });
    expect(target(state)).toBe(t0 + 4);
  });
});

describe("Live Dangerously (44024): each identity gets +2 hand size", () => {
  it("a player side scheme with 3 threat per player: Deadpool's hand size 5 becomes 7 and Wade's 6 becomes 8", () => {
    const base = baseGame();
    expect(handSize(base, P1, DEPS)).toBe(5);
    const { state, id } = put(base, LIVE_CARD, 0);
    expect(codes(state, state.villainArea)).toContain(LIVE_CARD);
    expect(inst(state, id).threat).toBe(3);
    expect(handSize(state, P1, DEPS)).toBe(7);
    const wade = withForm(state, "alterEgo");
    expect(handSize(wade, P1, DEPS)).toBe(8);
  });
  it("two players: every identity gets it, the other player's included, and each side scheme has 6 threat", () => {
    const base = baseGame([DEADPOOL_SEAT, SPIDER_SEAT]);
    const before = [handSize(base, P1, DEPS), handSize(base, P2, DEPS)];
    const { state, id } = put(base, LIVE_CARD, 0);
    expect(inst(state, id).threat).toBe(6);
    expect([handSize(state, P1, DEPS), handSize(state, P2, DEPS)]).toEqual([before[0]! + 2, before[1]! + 2]);
  });
  it("the bonus ends when the scheme leaves play", () => {
    const base = baseGame();
    const { state, id } = put(base, LIVE_CARD, 0);
    const gone = {
      ...state,
      villainArea: state.villainArea.filter((x) => x !== id),
      victoryDisplay: [...state.victoryDisplay, id],
    };
    expect(handSize(gone, P1, DEPS)).toBe(5);
  });
  it("it has Victory 0 and no When Defeated: it is simply removed to the victory display", () => {
    const base = baseGame();
    const card = base.cardPool[LIVE_CARD as never] as unknown as { keywords: { name: string; value?: number }[] };
    expect(card.keywords).toEqual([{ name: "victory", value: 0 }]);
  });
});

/** The villain's Juggernaut-side discard pile, as card codes. */
const encounterDiscard = (s: GameState): string[] => codes(s, s.encounterDecks[activeEncounterDeckId(s)]!.discard);
const inEncounterDiscard = (s: GameState, code: string): boolean => encounterDiscard(s).includes(code);
const exhausted = (s: GameState, id: InstanceId): boolean => inst(s, id).exhausted;
const hitsOf = (s: GameState, id: InstanceId): number => damageOf(s, id);

describe("Dogpool (44013): Retaliate 1, Toughness, and When Defeated: deal 1 damage to an enemy", () => {
  it("is data: Retaliate 1 and Toughness, and it enters play with a tough status card", () => {
    const { state, id } = put(baseGame(), DOGPOOL, 3);
    const card = state.cardPool[DOGPOOL as never] as unknown as { keywords: { name: string; value?: number }[] };
    expect(card.keywords).toEqual([{ name: "retaliate", value: 1 }, { name: "toughness" }]);
    expect(inst(state, id).statuses.tough).toBe(1);
  });
  it("20 damage on a tough Dogpool only discards the status card: he stays in play and nothing is dealt", () => {
    const dog = put(baseGame(), DOGPOOL, 3);
    const staged = minion(dog.state, SHOCKER);
    const { state } = put(staged.state, KILL_DOGPOOL, 0);
    expect(inPlay(state)).toContain(DOGPOOL);
    expect(inst(state, dog.id).statuses.tough).toBe(0);
    expect(hitsOf(state, staged.id)).toBe(0);
  });
  it("defeated, he goes to the discard pile and deals 1 damage to the minion chosen", () => {
    const base = baseGame();
    const dog = put(base, DOGPOOL, 3);
    const staged = minion(withoutTough(dog.state, dog.id), SHOCKER);
    const { state } = put(staged.state, KILL_DOGPOOL, 0, { pick: answering(target(staged.id)) });
    expect(inPlay(state)).not.toContain(DOGPOOL);
    expect(codes(state, playerOf(state, P1).discard)).toContain(DOGPOOL);
    expect(hitsOf(state, staged.id)).toBe(1);
  });
  it("any enemy may be chosen, the villain included (its tough status card gone, it takes 1)", () => {
    const dog = put(baseGame(), DOGPOOL, 3);
    const villain = villainOf(dog.state);
    const ready = withoutTough(withoutTough(dog.state, dog.id), villain);
    const { state, seen } = put(ready, KILL_DOGPOOL, 0, { pick: answering(target(villain)) });
    expect(hitsOf(state, villain)).toBe(1);
    expect(seen.find((s) => s.kind === "chooseTarget")!.options).toContain(villain);
  });
  it("the choice offers every enemy in play: the villain and each minion, and only enemies", () => {
    const dog = put(baseGame(), DOGPOOL, 3);
    const one = minion(withoutTough(dog.state, dog.id), SHOCKER);
    const two = minion(one.state, BOMBER);
    const { seen } = put(two.state, KILL_DOGPOOL, 0);
    const offered = seen.find((s) => s.kind === "chooseTarget")!.options;
    expect([...offered].sort()).toEqual([villainOf(two.state), one.id, two.id].sort());
  });
  it("the damage can defeat a minion: a 2-hit-point minion at 1 damage is discarded", () => {
    const dog = put(baseGame(), DOGPOOL, 3);
    const staged = minion(withoutTough(dog.state, dog.id), BOMBER);
    const hurt = withDamage(staged.state, staged.id, 1);
    const { state } = put(hurt, KILL_DOGPOOL, 0, { pick: answering(target(staged.id)) });
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
  });
  it("two players: a minion engaged with the other player is a legal choice and takes the damage", () => {
    const dog = put(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), DOGPOOL, 3);
    const theirs = minion(withoutTough(dog.state, dog.id), SHOCKER, { player: P2 });
    const { state } = put(theirs.state, KILL_DOGPOOL, 0, { pick: answering(target(theirs.id)) });
    expect(hitsOf(state, theirs.id)).toBe(1);
    expect(inPlay(state, P2)).toContain(SHOCKER);
  });
  it("the ref is a When Defeated ability", () => {
    expect(DEADPOOL_SUPPORT_UPGRADES_ALLIES[DOGPOOL_DEFEATED]!.trigger).toEqual({ kind: "whenDefeated" });
  });
});

describe("Lady Deadpool (44016): When Defeated: defeat a non-ELITE minion", () => {
  const withLady = (players?: readonly Seat[]) => put(baseGame(players), LADY, 4);
  it("defeats the chosen non-ELITE minion: Shocker goes to the encounter discard pile", () => {
    const lady = withLady();
    const staged = minion(lady.state, SHOCKER);
    const { state } = put(staged.state, KILL_LADY, 0, { pick: answering(target(staged.id)) });
    expect(inPlay(state)).not.toContain(LADY);
    expect(codes(state, playerOf(state, P1).discard)).toContain(LADY);
    expect(inEncounterDiscard(state, SHOCKER)).toBe(true);
  });
  it("offers only non-ELITE minions: Sandman (ELITE) and the villain are not offered", () => {
    const lady = withLady();
    const shocker = minion(lady.state, SHOCKER);
    const bomber = minion(shocker.state, BOMBER);
    const sandman = minion(bomber.state, SANDMAN);
    const { state, seen } = put(sandman.state, KILL_LADY, 0);
    const offered = seen.find((s) => s.kind === "chooseTarget")!.options;
    expect([...offered].sort()).toEqual([shocker.id, bomber.id].sort());
    expect(inPlay(state, P1)).toContain(SANDMAN);
  });
  it("with only an ELITE minion in play there is nothing to defeat: no prompt, Sandman stays", () => {
    const lady = withLady();
    const sandman = minion(lady.state, SANDMAN);
    const { state, seen } = put(sandman.state, KILL_LADY, 0);
    expect(seen.some((s) => s.kind === "chooseTarget")).toBe(false);
    expect(inPlay(state)).toContain(SANDMAN);
    expect(codes(state, playerOf(state, P1).discard)).toContain(LADY);
  });
  it("with no minion at all she is simply defeated", () => {
    const { state } = put(withLady().state, KILL_LADY, 0);
    expect(codes(state, playerOf(state, P1).discard)).toContain(LADY);
  });
  it("a tough minion is defeated outright (it is not damage)", () => {
    const lady = withLady();
    const staged = minion(lady.state, SHOCKER, { tough: true });
    const { state } = put(staged.state, KILL_LADY, 0, { pick: answering(target(staged.id)) });
    expect(inEncounterDiscard(state, SHOCKER)).toBe(true);
  });
  it("two players: a minion engaged with the other player may be defeated", () => {
    const lady = withLady([DEADPOOL_SEAT, SPIDER_SEAT]);
    const theirs = minion(lady.state, BOMBER, { player: P2 });
    const { state } = put(theirs.state, KILL_LADY, 0, { pick: answering(target(theirs.id)) });
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
    expect(inPlay(state, P2)).not.toContain(BOMBER);
  });
  it("her 4-cost, THW 2 / ATK 2 / 3 hit points are data: she cannot be played with 3 resources", () => {
    const given = withHand(baseGame(), P1, LADY, ...FILLERS.slice(0, 3));
    const [lady, ...pay] = given.ids as [InstanceId, ...InstanceId[]];
    expect(refused(given.state, play(P1, lady, pay))).toBe(true);
    expect(profile(put(baseGame(), LADY, 4).state, put(baseGame(), LADY, 4).id).maxHp).toBe(3);
  });
});

describe("Headpool (44014): after he attacks and damages a minion, that minion attacks another enemy of your choice", () => {
  const setup = (players?: readonly Seat[]) => {
    const head = put(baseGame(players), HEADPOOL_CARD, 3);
    const shocker = minion(head.state, SHOCKER);
    const bomber = minion(shocker.state, BOMBER);
    return { head: head.id, shocker: shocker.id, bomber: bomber.id, state: bomber.state };
  };
  it("accepted: Shocker (ATK 2) attacks the Bomber he chose and defeats it (2 hit points)", () => {
    const g = setup();
    const { state, events: run } = drive(
      g.state,
      answering(accept("headpool-response"), target(g.bomber)),
      basicAttack(P1, g.head, g.shocker),
    );
    expect(hitsOf(state, g.shocker)).toBe(1);
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
    expect(inPlay(state)).toContain(SHOCKER);
    expect(resolved(run, g.head, HEADPOOL)).toBe(true);
  });
  it("'another enemy': the damaged minion is not offered, the villain and other minions are", () => {
    const g = setup();
    const { seen } = drive(g.state, answering(accept("headpool-response")), basicAttack(P1, g.head, g.shocker));
    const offered = seen.find((s) => s.kind === "chooseTarget")!.options;
    expect([...offered].sort()).toEqual([villainOf(g.state), g.bomber].sort());
  });
  it("the minion may attack the villain: with its tough status gone Juggernaut takes 2", () => {
    const g = setup();
    const villain = villainOf(g.state);
    const { state } = drive(
      withoutTough(g.state, villain),
      answering(accept("headpool-response"), target(villain)),
      basicAttack(P1, g.head, g.shocker),
    );
    expect(hitsOf(state, villain)).toBe(2);
  });
  it("declined: the minion does not attack", () => {
    const g = setup();
    const { state } = drive(g.state, firstLegal, basicAttack(P1, g.head, g.shocker));
    expect(hitsOf(state, g.bomber)).toBe(0);
    expect(inPlay(state)).toContain(BOMBER);
  });
  it("not offered when he defeats the minion (a 2-hit-point Bomber at 1 damage)", () => {
    const g = setup();
    const { seen, state } = drive(
      withDamage(g.state, g.bomber, 1),
      answering(accept("headpool-response")),
      basicAttack(P1, g.head, g.bomber),
    );
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
    expect(seen.some((s) => s.kind === "chooseTriggers")).toBe(false);
  });
  it("not offered when a tough status card absorbs all his damage", () => {
    const g = setup();
    const tough = patchInstance(g.state, g.shocker, { statuses: { ...inst(g.state, g.shocker).statuses, tough: 1 } });
    const { seen, state } = drive(tough, answering(accept("headpool-response")), basicAttack(P1, g.head, g.shocker));
    expect(hitsOf(state, g.shocker)).toBe(0);
    expect(seen.some((s) => s.kind === "chooseTriggers")).toBe(false);
  });
  it("not offered when he attacks the villain (not a minion)", () => {
    const g = setup();
    const villain = villainOf(g.state);
    const { seen } = drive(
      withoutTough(g.state, villain),
      answering(accept("headpool-response")),
      basicAttack(P1, g.head, villain),
    );
    expect(hitsOf(drive(g.state, firstLegal).state, g.shocker)).toBe(0);
    expect(seen.some((s) => s.kind === "chooseTriggers")).toBe(false);
  });
  it("his own attack is an ordinary one: 1 ATK, 1 hit point and no consequential damage", () => {
    const g = setup();
    const { state } = drive(g.state, firstLegal, basicAttack(P1, g.head, g.shocker));
    expect(hitsOf(state, g.head)).toBe(0);
    expect(profile(state, g.head).atk).toBe(1);
    expect(profile(state, g.head).maxHp).toBe(1);
  });
  it("two players: he may hit a minion engaged with the other player, and that minion may attack the first player's", () => {
    const head = put(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), HEADPOOL_CARD, 3);
    const theirs = minion(head.state, SHOCKER, { player: P2 });
    const mine = minion(theirs.state, BOMBER, { player: P1 });
    const { state } = drive(
      mine.state,
      answering(accept("headpool-response"), target(mine.id)),
      basicAttack(P1, head.id, theirs.id),
    );
    expect(hitsOf(state, theirs.id)).toBe(1);
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
  });
});

describe("Kidpool (44015): his attacks gain piercing", () => {
  it("his basic attack discards the tough status card first and then deals its 2 damage", () => {
    const kid = put(baseGame(), KIDPOOL_CARD, 3);
    const staged = minion(kid.state, SHOCKER, { tough: true });
    const { state } = drive(staged.state, firstLegal, basicAttack(P1, kid.id, staged.id));
    expect(inst(state, staged.id).statuses.tough).toBe(0);
    expect(hitsOf(state, staged.id)).toBe(2);
  });
  it("without piercing the same tough minion takes nothing: Deadpool's own attack only discards the status", () => {
    const kid = put(baseGame(), KIDPOOL_CARD, 3);
    const staged = minion(kid.state, SHOCKER, { tough: true });
    const { state } = drive(staged.state, firstLegal, basicAttack(P1, identityOf(staged.state), staged.id));
    expect(inst(state, staged.id).statuses.tough).toBe(0);
    expect(hitsOf(state, staged.id)).toBe(0);
  });
  it("an ally with no Kidpool text (Headpool) does not pierce either, even beside him", () => {
    const kid = put(baseGame(), KIDPOOL_CARD, 3);
    const head = put(kid.state, HEADPOOL_CARD, 3);
    const staged = minion(head.state, SHOCKER, { tough: true });
    const { state } = drive(staged.state, firstLegal, basicAttack(P1, head.id, staged.id));
    expect(hitsOf(state, staged.id)).toBe(0);
  });
  it("it pierces the villain's tough status card too: Juggernaut takes the 2 damage", () => {
    const kid = put(baseGame(), KIDPOOL_CARD, 3);
    const villain = villainOf(kid.state);
    expect(inst(kid.state, villain).statuses.tough).toBe(1);
    const { state } = drive(kid.state, firstLegal, basicAttack(P1, kid.id, villain));
    expect(inst(state, villain).statuses.tough).toBe(0);
    expect(hitsOf(state, villain)).toBe(2);
  });
  it("his own 2 hit points: his consequential damage is 0, so attacking never hurts him", () => {
    const kid = put(baseGame(), KIDPOOL_CARD, 3);
    const staged = minion(kid.state, SHOCKER);
    const { state } = drive(staged.state, firstLegal, basicAttack(P1, kid.id, staged.id));
    expect(hitsOf(state, kid.id)).toBe(0);
    expect(profile(state, kid.id).maxHp).toBe(2);
  });
  it("two players: Kidpool's piercing is his controller's ally's alone", () => {
    const kid = put(baseGame([DEADPOOL_SEAT, SPIDER_SEAT]), KIDPOOL_CARD, 3);
    const staged = minion(kid.state, SHOCKER, { tough: true, player: P2 });
    const { state } = drive(staged.state, firstLegal, basicAttack(P1, kid.id, staged.id));
    expect(hitsOf(state, staged.id)).toBe(2);
  });
});

describe("Chimichanga Truck (44008): after an identity makes a basic recovery, exhaust it -> ready that identity", () => {
  /** The truck in play, then Wade Wilson with `damage` damage (alter-ego form, where recovery is possible). */
  const wade = (damage: number, players?: readonly Seat[]) => {
    const truck = put(baseGame(players), TRUCK, 2);
    const asWade = withForm(withDamage(truck.state, identityOf(truck.state), damage), "alterEgo");
    return { truck: truck.id, state: asWade };
  };
  it("accepted: Wade recovers 8, is ready again, and the truck is exhausted", () => {
    const g = wade(5);
    const { state, events: run } = drive(g.state, answering(accept("chimichanga")), basicRecover(P1));
    expect(myDamage(state)).toBe(0);
    expect(exhausted(state, identityOf(state))).toBe(false);
    expect(exhausted(state, g.truck)).toBe(true);
    expect(resolved(run, g.truck, CHIMICHANGA)).toBe(true);
  });
  it("it is a Response: the recovery has healed before the identity is readied (damage 12 of 9 hit points is not a thing, 8 is)", () => {
    const g = wade(8);
    const { state } = drive(g.state, answering(accept("chimichanga")), basicRecover(P1));
    expect(myDamage(state)).toBe(0);
  });
  it("declined: the identity stays exhausted by the recovery and the truck stays ready", () => {
    const g = wade(5);
    const { state } = drive(g.state, firstLegal, basicRecover(P1));
    expect(myDamage(state)).toBe(0);
    expect(exhausted(state, identityOf(state))).toBe(true);
    expect(exhausted(state, g.truck)).toBe(false);
  });
  it("an exhausted truck cannot respond: it is not offered", () => {
    const g = wade(5);
    const tired = patchInstance(g.state, g.truck, { exhausted: true });
    const { seen, state } = drive(tired, answering(accept("chimichanga")), basicRecover(P1));
    expect(seen.some((s) => s.kind === "chooseTriggers")).toBe(false);
    expect(exhausted(state, identityOf(state))).toBe(true);
  });
  it("an identity with no damage cannot make a basic recovery, so the truck has nothing to answer", () => {
    const g = wade(0);
    expect(refused(g.state, basicRecover(P1))).toBe(true);
  });
  it("readying lets him recover again the same turn: a second recovery is accepted afterwards", () => {
    const g = wade(5);
    const first = drive(g.state, answering(accept("chimichanga")), basicRecover(P1)).state;
    const hurt = withDamage(first, identityOf(first), 3);
    expect(refused(hurt, basicRecover(P1))).toBe(false);
  });
  it("two players: another player's recovery is answered by the truck's controller, who readies THAT identity", () => {
    const g = wade(0, [DEADPOOL_SEAT, SPIDER_SEAT]);
    const peter = withForm(withDamage(g.state, identityOf(g.state, P2), 2), "alterEgo", P2);
    const turn = drive(peter, firstLegal, endTurn(P1)).state;
    const { state, seen } = drive(turn, answering(accept("chimichanga")), basicRecover(P2));
    expect(seen.find((s) => s.kind === "chooseTriggers")!.player).toBe(P1);
    expect(exhausted(state, identityOf(state, P2))).toBe(false);
    expect(exhausted(state, g.truck)).toBe(true);
  });
});

describe("Deadpool's Katana (44010): Restricted. Hero Action (attack): exhaust it and take 1 damage -> deal 2 damage to an enemy, piercing", () => {
  const armed = (players?: readonly Seat[]) => {
    const katana = put(baseGame(players), KATANA_CARD, 2);
    return { katana: katana.id, state: katana.state };
  };
  it("costs 2, is attached to Deadpool, and is Restricted (data)", () => {
    const g = armed();
    expect(attachedTo(g.state, identityOf(g.state))).toContain(g.katana);
    const card = g.state.cardPool[KATANA_CARD as never] as unknown as { keywords: { name: string }[] };
    expect(card.keywords).toEqual([{ name: "restricted" }]);
  });
  it("deals 2 damage to the enemy chosen, costs Deadpool 1 damage, and exhausts the Katana", () => {
    const g = armed();
    const staged = minion(g.state, SHOCKER);
    const { state, events: run } = drive(staged.state, answering(target(staged.id)), use(P1, g.katana, KATANA));
    expect(hitsOf(state, staged.id)).toBe(2);
    expect(myDamage(state)).toBe(1);
    expect(exhausted(state, g.katana)).toBe(true);
    expect(resolved(run, g.katana, KATANA)).toBe(true);
  });
  it("it is an attack: it defeats a 2-hit-point Hydra Bomber", () => {
    const g = armed();
    const staged = minion(g.state, BOMBER);
    const { state } = drive(staged.state, answering(target(staged.id)), use(P1, g.katana, KATANA));
    expect(inEncounterDiscard(state, BOMBER)).toBe(true);
  });
  it("it gains piercing: a tough minion loses its status card and takes the 2 damage", () => {
    const g = armed();
    const staged = minion(g.state, SHOCKER, { tough: true });
    const { state } = drive(staged.state, answering(target(staged.id)), use(P1, g.katana, KATANA));
    expect(inst(state, staged.id).statuses.tough).toBe(0);
    expect(hitsOf(state, staged.id)).toBe(2);
  });
  it("it pierces Juggernaut's tough status card too", () => {
    const g = armed();
    const villain = villainOf(g.state);
    const { state } = drive(g.state, answering(target(villain)), use(P1, g.katana, KATANA));
    expect(inst(state, villain).statuses.tough).toBe(0);
    expect(hitsOf(state, villain)).toBe(2);
  });
  it("an exhausted Katana cannot be used again, and a ready one can in the same turn after readying", () => {
    const g = armed();
    const after = drive(g.state, firstLegal, use(P1, g.katana, KATANA)).state;
    expect(refused(after, use(P1, g.katana, KATANA))).toBe(true);
    expect(refused(patchInstance(after, g.katana, { exhausted: false }), use(P1, g.katana, KATANA))).toBe(false);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const g = armed();
    expect(refused(withForm(g.state, "alterEgo"), use(P1, g.katana, KATANA))).toBe(true);
  });
  it("the damage is a cost: a tough status card on Deadpool would prevent it, so the ability cannot start", () => {
    const g = armed();
    const shielded = patchInstance(g.state, identityOf(g.state), {
      statuses: { ...inst(g.state, identityOf(g.state)).statuses, tough: 1 },
    });
    expect(refused(shielded, use(P1, g.katana, KATANA))).toBe(true);
  });
  it("at 1 hit point the cost's damage defeats him: his Regeneratin' interrupt replaces it (Wade, 1 hit point, a token) and the attack still resolves", () => {
    const g = armed();
    const staged = minion(withDamage(g.state, identityOf(g.state), 8), SHOCKER);
    const { state, events: run } = drive(staged.state, answering(target(staged.id)), use(P1, g.katana, KATANA));
    expect(formOf(state)).toBe("alterEgo");
    expect(myDamage(state)).toBe(8);
    expect(tokens(state)).toBe(tokens(staged.state) + 1);
    expect(playerOf(state, P1).eliminated).toBe(false);
    expect(exhausted(state, g.katana)).toBe(true);
    expect(resolved(run, g.katana, KATANA)).toBe(true);
    expect(hitsOf(state, staged.id)).toBe(2);
  });
  it("two Katanas can both be in play (the Restricted limit is 2) and each swings once", () => {
    const one = armed();
    const two = put(one.state, KATANA_CARD, 2);
    const staged = minion(two.state, SANDMAN);
    const { state } = drive(
      staged.state,
      answering(target(staged.id)),
      use(P1, one.katana, KATANA),
      use(P1, two.id, KATANA),
    );
    expect(myDamage(state)).toBe(2);
    expect(inEncounterDiscard(state, SANDMAN)).toBe(true);
  });
  it("two players: only its owner takes the damage, and a minion engaged with the other player may be the target", () => {
    const g = armed([DEADPOOL_SEAT, SPIDER_SEAT]);
    const theirs = minion(g.state, SHOCKER, { player: P2 });
    const { state } = drive(theirs.state, answering(target(theirs.id)), use(P1, g.katana, KATANA));
    expect(myDamage(state, P1)).toBe(1);
    expect(myDamage(state, P2)).toBe(0);
    expect(hitsOf(state, theirs.id)).toBe(2);
  });
});

describe("Stick-To-Itiveness (44030): Hero Action: spend a [physical] resource and exhaust it -> ready your hero", () => {
  const tired = (players?: readonly Seat[]) => {
    const stick = put(baseGame(players), STICK_CARD, 2);
    const exhaustedHero = patchInstance(stick.state, identityOf(stick.state), { exhausted: true });
    return { stick: stick.id, state: exhaustedHero };
  };
  /** Gives P1 a hand of `wanted` and uses the ability paying with the first card. */
  const useWith = (g: { stick: InstanceId; state: GameState }, ...wanted: readonly string[]) => {
    const given = withHand(g.state, P1, ...wanted);
    return { given, command: use(P1, g.stick, STICK, [{ fromHand: given.ids[0]! }]) };
  };
  it("pays a [physical] card, exhausts the upgrade and readies the exhausted hero", () => {
    const g = tired();
    const { given, command } = useWith(g, "44012");
    const { state, events: run } = drive(given.state, firstLegal, command);
    expect(exhausted(state, identityOf(state))).toBe(false);
    expect(exhausted(state, g.stick)).toBe(true);
    expect(codes(state, playerOf(state, P1).discard)).toContain("44012");
    expect(resolved(run, g.stick, STICK)).toBe(true);
  });
  it("a [wild] card pays it too (Frenemies, 44031)", () => {
    const g = tired();
    const { given, command } = useWith(g, "44031");
    expect(refused(given.state, command)).toBe(false);
  });
  it("an [energy] or [mental] card does not: the ability is refused", () => {
    const g = tired();
    const energy = useWith(g, "44021");
    expect(refused(energy.given.state, energy.command)).toBe(true);
    const mental = useWith(g, "44017");
    expect(refused(mental.given.state, mental.command)).toBe(true);
  });
  it("Self Confidence (triple [physical]) pays with the extra wasted: one card, one ability", () => {
    const g = tired();
    const { given, command } = useWith(g, SELF_CONFIDENCE_CARD);
    const { state } = drive(given.state, firstLegal, command);
    expect(exhausted(state, identityOf(state))).toBe(false);
  });
  it("with no payment it is refused", () => {
    const g = tired();
    expect(refused(g.state, use(P1, g.stick, STICK, []))).toBe(true);
  });
  it("an already-ready hero: the ability can still be used and nothing changes but the cost", () => {
    const g = tired();
    const ready = patchInstance(g.state, identityOf(g.state), { exhausted: false });
    const { given, command } = useWith({ stick: g.stick, state: ready }, "44012");
    const { state } = drive(given.state, firstLegal, command);
    expect(exhausted(state, identityOf(state))).toBe(false);
    expect(exhausted(state, g.stick)).toBe(true);
  });
  it("an exhausted Stick-To-Itiveness cannot be used", () => {
    const g = tired();
    const { given, command } = useWith(
      { stick: g.stick, state: patchInstance(g.state, g.stick, { exhausted: true }) },
      "44012",
    );
    expect(refused(given.state, command)).toBe(true);
  });
  it("it is a Hero Action: refused in alter-ego form", () => {
    const g = tired();
    const { given, command } = useWith({ stick: g.stick, state: withForm(g.state, "alterEgo") }, "44012");
    expect(refused(given.state, command)).toBe(true);
  });
  it("two players: it readies its own hero and leaves the other identity exhausted", () => {
    const g = tired([DEADPOOL_SEAT, SPIDER_SEAT]);
    const both = patchInstance(g.state, identityOf(g.state, P2), { exhausted: true });
    const { given, command } = useWith({ stick: g.stick, state: both }, "44012");
    const { state } = drive(given.state, firstLegal, command);
    expect(exhausted(state, identityOf(state, P1))).toBe(false);
    expect(exhausted(state, identityOf(state, P2))).toBe(true);
  });
});

/** Crisis of Infinite Deadpools (44037) to the bottom of the encounter deck, so no villain phase here reveals it. */
function crisisAtBottom(state: GameState): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const crisis = pile.deck.filter((id) => codeOf(state, id) === "44037");
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...pile, deck: [...pile.deck.filter((id) => !crisis.includes(id)), ...crisis] },
    },
  };
}

describe("Healing Factor (44029): Max 1 per player. Response: after the player phase begins, exhaust it -> heal 2 damage from your identity", () => {
  const withFactor = (players?: readonly Seat[]) => put(baseGame(players), HEALING_CARD, 3);
  /** Ends P1's turn and lets the villain phase run; `answers` plays the prompts, `seen` records identity damage at each Healing Factor offer. */
  function roundTrip(state: GameState, take: boolean) {
    const offered: { damage: number; round: number }[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers" && c.options.some((o) => o.optionId.includes("healing-factor"))) {
        offered.push({ damage: myDamage(s), round: s.round });
        return take ? c.options.filter((o) => o.optionId.includes("healing-factor")).map((o) => o.optionId) : [];
      }
      return firstLegal(s);
    };
    const start = crisisAtBottom(state);
    const { state: end } = driveEventsPicking(DEPS, start, pick, endTurn(P1));
    const next = settle(end, pick, (s) => s.step.phase === "player" && s.round > start.round, DEPS);
    return { start, next, offered };
  }
  it("costs 3 and attaches to the identity", () => {
    const f = withFactor();
    expect(attachedTo(f.state, identityOf(f.state))).toContain(f.id);
  });
  it("Max 1 per player: a second copy cannot be played while the first is in play", () => {
    const f = withFactor();
    const given = withHand(f.state, P1, HEALING_CARD, ...FILLERS.slice(0, 3));
    const [second, ...pay] = given.ids as [InstanceId, ...InstanceId[]];
    expect(refused(given.state, play(P1, second, pay))).toBe(true);
  });
  it("two players: each player may have one", () => {
    const f = withFactor([DEADPOOL_SEAT, SPIDER_SEAT]);
    const turn = drive(f.state, firstLegal, endTurn(P1)).state;
    const [spare, ...pay] = playerOf(turn, P2).deck.slice(0, 4) as [InstanceId, ...InstanceId[]];
    const fed = patchInstance(turn, spare, { cardId: HEALING_CARD as never });
    const hand = {
      ...fed,
      players: fed.players.map((p) =>
        p.playerId === P2
          ? { ...p, hand: [spare, ...pay], deck: p.deck.filter((id) => ![spare, ...pay].includes(id)) }
          : p,
      ),
    };
    expect(refused(hand, play(P2, spare, pay))).toBe(false);
  });
  it("accepted at the start of the next player phase: 2 damage healed, Healing Factor exhausted", () => {
    const f = withFactor();
    const hurt = withDamage(f.state, identityOf(f.state), 5);
    const { next, offered } = roundTrip(hurt, true);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.round).toBe(next.round);
    expect(myDamage(next)).toBe(offered[0]!.damage - 2);
    expect(exhausted(next, f.id)).toBe(true);
  });
  it("declined: no healing and it stays ready", () => {
    const f = withFactor();
    const hurt = withDamage(f.state, identityOf(f.state), 5);
    const { next, offered } = roundTrip(hurt, false);
    expect(offered).toHaveLength(1);
    expect(myDamage(next)).toBe(offered[0]!.damage);
    expect(exhausted(next, f.id)).toBe(false);
  });
  it("with 1 damage it heals only that 1", () => {
    const f = withFactor();
    const hurt = withDamage(f.state, identityOf(f.state), 1);
    const { next, offered } = roundTrip(hurt, true);
    expect(myDamage(next)).toBe(Math.max(0, offered[0]!.damage - 2));
  });
  it("it is not a basic recovery: Chimichanga Truck beside it is not offered when it heals", () => {
    const f = withFactor();
    const truck = put(withDamage(f.state, identityOf(f.state), 5), TRUCK, 2);
    const offers: string[] = [];
    const pick: Picker = (s) => {
      const c = s.pendingChoice!;
      if (c.prompt.kind === "chooseTriggers") offers.push(...c.options.map((o) => o.optionId));
      return c.prompt.kind === "chooseTriggers"
        ? c.options.filter((o) => o.optionId.includes("healing-factor")).map((o) => o.optionId)
        : firstLegal(s);
    };
    const start = crisisAtBottom(truck.state);
    const { state: end } = driveEventsPicking(DEPS, start, pick, endTurn(P1));
    settle(end, pick, (s) => s.step.phase === "player" && s.round > start.round, DEPS);
    expect(offers.some((o) => o.includes("chimichanga"))).toBe(false);
  });
});

describe("Git Gud (44028): reduce its cost by 2 if you did not win your previous game; Forced Interrupt: a defeated player is set to 1 hit point in alter-ego form instead, and it is removed from the game", () => {
  const gitGud = (players?: readonly Seat[], facts?: Facts) => put(baseGame(players, facts), GIT_GUD, 0);
  const maxHp = (s: GameState, p = P1): number => profile(s, identityOf(s, p)).maxHp;
  const cost = (facts: Facts | undefined, pay: number) => {
    const given = withHand(baseGame([DEADPOOL_SEAT], facts), P1, GIT_GUD, ...FILLERS.slice(0, pay));
    const [card, ...paid] = given.ids as [InstanceId, ...InstanceId[]];
    return { given, command: play(P1, card, paid) };
  };

  describe("the cost reduction (spec Q48: no recorded win means you did not win)", () => {
    it("with no outside fact recorded it costs 0: played with no payment", () => {
      const { given, command } = cost(undefined, 0);
      const { state } = drive(given.state, firstLegal, command);
      expect(attachedTo(state, identityOf(state))).toHaveLength(1);
      expect(playerOf(state, P1).hand).toHaveLength(0);
    });
    it("a recorded loss costs 0 as well", () => {
      const { given, command } = cost([{ wonPreviousGame: false }], 0);
      expect(refused(given.state, command)).toBe(false);
    });
    it("a recorded win leaves the printed cost of 2: no payment is refused, 2 resources play it", () => {
      const none = cost([{ wonPreviousGame: true }], 0);
      expect(refused(none.given.state, none.command)).toBe(true);
      const two = cost([{ wonPreviousGame: true }], 2);
      const { state } = drive(two.given.state, firstLegal, two.command);
      expect(attachedTo(state, identityOf(state))).toHaveLength(1);
    });
    it("two players: the fact is the player's own - another seat's win does not change P1's cost", () => {
      const players = [DEADPOOL_SEAT, SPIDER_SEAT];
      const given = withHand(baseGame(players, [undefined, { wonPreviousGame: true }]), P1, GIT_GUD);
      expect(refused(given.state, play(P1, given.ids[0]!, []))).toBe(false);
      const mine = withHand(baseGame(players, [{ wonPreviousGame: true }, undefined]), P1, GIT_GUD);
      expect(refused(mine.state, play(P1, mine.ids[0]!, []))).toBe(true);
    });
  });

  describe("the forced interrupt", () => {
    it("Wade Wilson at 0 hit points: set to 1 hit point, still alter-ego, Git Gud removed from the game, not eliminated", () => {
      const g = gitGud();
      const wade = withForm(g.state, "alterEgo");
      const { state } = put(wade, HURT_SELF, 0);
      expect(playerOf(state, P1).eliminated).toBe(false);
      expect(formOf(state)).toBe("alterEgo");
      expect(myDamage(state)).toBe(maxHp(state) - 1);
      expect(removed(state)).toContain(GIT_GUD);
      expect(attachedTo(state, identityOf(state))).not.toContain(g.id);
      expect(tokens(state)).toBe(tokens(wade));
      expect(state.outcome).toBeNull();
    });
    it("it works once: the second lethal damage to Wade eliminates him", () => {
      const g = gitGud();
      const wade = withForm(g.state, "alterEgo");
      const once = put(wade, HURT_SELF, 0).state;
      const twice = put(once, HURT_SELF, 0).state;
      expect(playerOf(twice, P1).eliminated).toBe(true);
    });
    it("below lethal nothing is replaced: the card stays in play", () => {
      const g = gitGud();
      const hurt = withDamage(g.state, identityOf(g.state), 3);
      expect(attachedTo(hurt, identityOf(hurt))).toContain(g.id);
      expect(removed(hurt)).not.toContain(GIT_GUD);
    });
    it("Deadpool's own interrupt and Git Gud are both pending on his defeat: Git Gud first replaces it, so no token is added and Git Gud is spent", () => {
      const g = gitGud();
      const { state } = put(g.state, HURT_SELF, 0, { pick: answering(order("git-gud", "regeneratin")) });
      expect(formOf(state)).toBe("alterEgo");
      expect(myDamage(state)).toBe(maxHp(state) - 1);
      expect(tokens(state)).toBe(tokens(g.state));
      expect(removed(state)).toContain(GIT_GUD);
      expect(playerOf(state, P1).eliminated).toBe(false);
    });
    it("Deadpool's first: a token is added and Git Gud stays in play for the next defeat", () => {
      const g = gitGud();
      const { state } = put(g.state, HURT_SELF, 0, { pick: answering(order("regeneratin", "git-gud")) });
      expect(formOf(state)).toBe("alterEgo");
      expect(myDamage(state)).toBe(maxHp(state) - 1);
      expect(tokens(state)).toBe(tokens(g.state) + 1);
      expect(removed(state)).not.toContain(GIT_GUD);
      expect(attachedTo(state, identityOf(state))).toContain(g.id);
    });
    it("the first player is asked to order them: the prompt lists both forced interrupts", () => {
      const g = gitGud();
      const { seen } = put(g.state, HURT_SELF, 0, { pick: answering(order("regeneratin", "git-gud")) });
      const ordering = seen.find((s) => s.kind === "orderTriggers");
      expect(ordering?.options.some((o) => o.includes("git-gud"))).toBe(true);
      expect(ordering?.options.some((o) => o.includes("regeneratin"))).toBe(true);
    });
    it("two players: it saves ANOTHER player's identity too - Spider-Man (P2) is set to 1 hit point as alter-ego and Git Gud is gone", () => {
      const g = gitGud([DEADPOOL_SEAT, SPIDER_SEAT]);
      const { state } = put(g.state, HURT_OTHERS, 1);
      expect(playerOf(state, P2).eliminated).toBe(false);
      expect(formOf(state, P2)).toBe("alterEgo");
      expect(myDamage(state, P2)).toBe(maxHp(state, P2) - 1);
      expect(removed(state)).toContain(GIT_GUD);
      expect(formOf(state, P1)).toBe("hero");
      expect(myDamage(state, P1)).toBe(0);
      expect(tokens(state)).toBe(tokens(g.state));
    });
    it("a defeated ally is not a player: Dogpool is defeated normally and Git Gud stays", () => {
      const g = gitGud();
      const dog = put(g.state, DOGPOOL, 3);
      const { state } = put(withoutTough(dog.state, dog.id), KILL_DOGPOOL, 0);
      expect(codes(state, playerOf(state, P1).discard)).toContain(DOGPOOL);
      expect(removed(state)).not.toContain(GIT_GUD);
      expect(attachedTo(state, identityOf(state))).toContain(g.id);
    });
  });
});

describe("Armed to the Teeth (44009): search your collection for a WEAPON upgrade and attach it facedown here; Action: swap it", () => {
  const search =
    (code: string | null): Rule =>
    (_s, c) => {
      if (c.prompt.kind !== "searchCollection") return undefined;
      if (code === null) return [];
      return c.options.some((o) => o.optionId === code) ? [code] : [];
    };
  const play44009 = (pick: Picker, state = baseGame()) => put(state, ARMED, 2, { pick });
  const taking = (code: string | null) => answering(accept("armed-to-the-teeth-response"), search(code));
  const poolCard = (s: GameState, code: string) =>
    s.cardPool[code as never] as unknown as { type: string; aspect: string; traits: string[]; specificTo?: unknown };
  const FIVE = ["aggression", "justice", "leadership", "protection", "pool"];

  it("costs 2, attaches to the identity, and after it is played the response offers a search", () => {
    const r = play44009(answering(accept("armed-to-the-teeth-response")));
    expect(r.seen.map((x) => x.kind)).toContain("chooseTriggers");
    expect(attachedTo(r.state, identityOf(r.state))).toContain(r.id);
    expect(playerOf(r.state, P1).hand).toHaveLength(0);
  });
  it("the search offers WEAPON upgrades of the five aspects only: no Deadpool's Katana (both copies are in the game), no basic or identity-specific card", () => {
    const r = play44009(taking(null));
    const offered = r.seen.find((x) => x.kind === "searchCollection")!.options;
    expect(offered.length).toBeGreaterThan(1);
    for (const code of offered) {
      const card = poolCard(r.state, code);
      expect(card.type).toBe("upgrade");
      expect(card.traits).toContain("WEAPON");
      expect(FIVE).toContain(card.aspect);
      expect(card.specificTo).toBeUndefined();
    }
    expect(offered).toContain("44055");
    expect(offered).not.toContain("44010");
  });
  it("taking Laser Swords (44055): a new card owned by Deadpool's player sits facedown attached to Armed to the Teeth", () => {
    const r = play44009(taking("44055"));
    const arm = r.state.players[0]!.playArea.find((id) => codeOf(r.state, id) === ARMED) ?? r.id;
    const held = attachedTo(r.state, arm).filter((id) => codeOf(r.state, id) === "44055");
    expect(held).toHaveLength(1);
    expect(inst(r.state, held[0]!).faceup).toBe(false);
    expect(inst(r.state, held[0]!).ownerId).toBe(P1);
    expect(inst(r.state, held[0]!).attachedTo).toBe(arm);
    expect(events(r.events, "cardAddedFromCollection")).toHaveLength(1);
    expect(codes(r.state, playerOf(r.state, P1).deck)).not.toContain("44055");
    expect(codes(r.state, playerOf(r.state, P1).hand)).not.toContain("44055");
  });
  it("the same card could be taken for any other WEAPON: Hawkeye's-style cards of other aspects are offered too", () => {
    const r = play44009(taking(null));
    const aspects = new Set(
      r.seen.find((x) => x.kind === "searchCollection")!.options.map((c) => poolCard(r.state, c).aspect),
    );
    expect(aspects.size).toBeGreaterThan(1);
  });
  it("declining the response, or finding nothing, attaches nothing and Armed to the Teeth stays in play", () => {
    const declined = put(baseGame(), ARMED, 2);
    expect(attachedTo(declined.state, declined.id)).toHaveLength(0);
    expect(events(declined.events, "cardAddedFromCollection")).toHaveLength(0);
    const empty = play44009(taking(null));
    expect(attachedTo(empty.state, empty.id)).toHaveLength(0);
    expect(attachedTo(empty.state, identityOf(empty.state))).toContain(empty.id);
  });
  it("the fetched card is a real facedown attachment, so it has no title and does not count as a WEAPON upgrade in play", () => {
    const r = play44009(taking("44055"));
    const held = attachedTo(r.state, r.id)[0]!;
    expect(inst(r.state, held).faceup).toBe(false);
    expect(inPlay(r.state)).not.toContain("44055");
  });
  it("two players: it is the player's own collection search and the card is theirs alone", () => {
    const r = play44009(taking("44055"), baseGame([DEADPOOL_SEAT, SPIDER_SEAT]));
    const held = attachedTo(r.state, r.id)[0]!;
    expect(inst(r.state, held).ownerId).toBe(P1);
    expect(r.seen.find((x) => x.kind === "searchCollection")!.player).toBe(P1);
  });
  it("when Armed to the Teeth leaves play the facedown card goes to its owner's discard pile", () => {
    const arm = play44009(taking("44055"));
    const held = attachedTo(arm.state, arm.id)[0]!;
    const { state } = put(arm.state, DISCARD_ARMED, 3);
    expect(codes(state, playerOf(state, P1).discard)).toEqual(expect.arrayContaining([ARMED, "44055"]));
    expect(playerOf(state, P1).discard).toContain(held);
    expect(attachedTo(state, identityOf(state))).not.toContain(arm.id);
  });
  it("the Action needs a WEAPON upgrade you control: with none in play it cannot be started", () => {
    const r = play44009(taking("44055"));
    expect(refused(r.state, use(P1, r.id, ARMED_ACTION))).toBe(true);
  });
  it("the facedown card is not itself a candidate for the swap: with Katana in play only Katana is offered", () => {
    const r = play44009(taking("44055"));
    const katana = put(r.state, KATANA_CARD, 2);
    const run = drive(katana.state, answering(target(katana.id)), use(P1, r.id, ARMED_ACTION));
    const offered = run.seen.find((x) => x.kind === "chooseTarget")?.options ?? [];
    expect(offered).toEqual(expect.arrayContaining([katana.id]));
    expect(offered).not.toContain(attachedTo(r.state, r.id)[0]);
  });
  // RRG 1.8 "In Play and Out of Play" (p. 23): "Facedown cards attached to in-play cards are out of play", so this is
  // "'Swap'" (p. 42) between a play area and an out-of-play area: the Katana leaves play, Laser Swords enters play.
  it("the Action swaps the facedown card with a WEAPON upgrade you control: the Katana goes facedown here, Laser Swords is put into play", () => {
    const r = play44009(taking("44055"));
    const katana = put(r.state, KATANA_CARD, 2);
    const run = drive(katana.state, answering(target(katana.id)), use(P1, r.id, ARMED_ACTION));
    expect(exhausted(run.state, r.id)).toBe(true);
    expect(attachedTo(run.state, r.id).map((id) => codeOf(run.state, id))).toEqual([KATANA_CARD]);
    expect(attachedTo(run.state, identityOf(run.state)).map((id) => codeOf(run.state, id))).toContain("44055");
  });
});
