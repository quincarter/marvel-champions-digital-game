import { AOS_CARDS, cardId, type AllyCard, type SupportCard, type UpgradeCard } from "@mc/content";
import {
  applyCommand,
  createGame,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withDamage, withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { WAVE9_CARDS } from "../../cards.js";
import { wave9StarterDeckSetup } from "../../setup.js";
import { MARIA_HILL_IDENTITY } from "./identity.js";
import { inPlay, mariaGame, mariaHeroGame } from "./testing.js";
import {
  MARIA_HILL_SUPPORT_UPGRADES_ALLIES as REGISTRY,
  MARIA_HILL_SUPPORT_UPGRADES_ALLIES_SKIPPED as SKIPPED,
} from "./support-upgrades-allies.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Maria Hill's ally, supports and upgrades (50002, 50008 to 50011), docs/phase7-wave9.md sections 3.6 and 3.35. The
 * printed precon `maria-hill-leadership` against Rhino. Cards that only need to be in play are staged there with their
 * counters; every card is also played from hand once, for its cost and its Uses counters.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MARIA_HILL_IDENTITY, REGISTRY) };

const FURY = "50002";
const STAFF = "50008";
const ILIAD = "50009";
const DECOY = "50010";
const DIRECTOR = "50011";
const COMMAND_TEAM = "50016"; // a S.H.I.E.L.D. support, uses 3 command, cost 2
const FRONT_ORG = "50028"; // a support without the S.H.I.E.L.D. trait

const FURY_RESPONSE = "50002.nick-fury-response";
const STAFF_RESOURCE = "50008.support-staff-resource";
const ILIAD_ACTION = "50009.the-iliad-action";
const DECOY_INTERRUPT = "50010.life-model-decoy-interrupt";
const DIRECTOR_ACTION = "50011.shield-director-action";

const card = <T>(code: string): T => AOS_CARDS.find((c) => c.id === cardId(code)) as T;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const schemeOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const counters = (s: GameState, id: InstanceId) => inst(s, id).counters;
const inPlayArea = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).playArea.includes(id);
const inDiscard = (s: GameState, id: InstanceId): boolean => playerOf(s, P1).discard.includes(id);
const run = (s: GameState, ...c: Parameters<typeof runWith>[2][]): GameState => runWith(DEPS, s, ...c);

/** Answers target prompts with the named instance when offered, trigger prompts with an id ending `respond`. */
const picker =
  (opts: { readonly target?: InstanceId; readonly respond?: string; readonly option?: string } = {}): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const offered = choice.options.map((o) => o.optionId as string);
    if (choice.prompt.kind === "chooseTriggers" && opts.respond) {
      const hit = offered.find((o) => o.endsWith(opts.respond!));
      return hit ? [hit] : firstLegal(s);
    }
    if (choice.prompt.kind === "chooseTarget" && opts.target && offered.includes(opts.target)) return [opts.target];
    if (choice.prompt.kind === "chooseOption" && opts.option) {
      const hit = choice.options.find((o) => o.label.startsWith(opts.option!));
      return hit ? [hit.optionId] : firstLegal(s);
    }
    return firstLegal(s);
  };
const drive = (s: GameState, opts?: Parameters<typeof picker>[0]): GameState =>
  settle(s, picker(opts), undefined, DEPS);

/** An upgrade of P1's `code` attached to P1's identity, faceup (staging surgery). */
function attach(state: GameState, code: string): { state: GameState; id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const host = identityOf(given.state);
  const s = given.state;
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
      instances: {
        ...s.instances,
        [id]: { ...s.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...s.instances[host]!, attachments: [...s.instances[host]!.attachments, id] },
      },
    },
  };
}

describe("registry", () => {
  it("every registered script validates", () => {
    for (const [id, def] of Object.entries(REGISTRY)) expect(validateDefinition(def), id).toEqual([]);
  });
  it("registers exactly the five printed refs and skips none", () => {
    const printed = [FURY, STAFF, ILIAD, DECOY, DIRECTOR].flatMap((code) =>
      (AOS_CARDS.find((c) => c.id === cardId(code)) as unknown as { abilities: { id: string }[] }).abilities.map(
        (a) => a.id,
      ),
    );
    expect(Object.keys(REGISTRY).sort()).toEqual([...printed].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it("trigger kinds and costs", () => {
    expect(REGISTRY[FURY_RESPONSE]!.trigger).toMatchObject({ kind: "response", forced: false });
    expect(REGISTRY[STAFF_RESOURCE]!.trigger).toMatchObject({ kind: "resource", forAnyPlayer: true });
    expect(REGISTRY[STAFF_RESOURCE]!.cost).toEqual({
      exhaustSelf: true,
      spendCounters: { counterType: "staff", amount: 1 },
    });
    expect(REGISTRY[ILIAD_ACTION]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[DECOY_INTERRUPT]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY[DECOY_INTERRUPT]!.cost).toEqual({ discardSelf: true });
    expect(REGISTRY[DIRECTOR_ACTION]!.trigger).toMatchObject({ kind: "action" });
    expect(REGISTRY[DIRECTOR_ACTION]!.cost).toEqual({ exhaustSelf: true });
  });
});

describe("printed data", () => {
  it("Nick Fury: unique ally, cost 4, ATK 2, THW 2, 3 hit points, consequential damage 1 and 1, S.H.I.E.L.D.", () => {
    const c = card<AllyCard>(FURY);
    expect([c.cost, c.atk, c.thw, c.hp]).toEqual([4, 2, 2, 3]);
    expect(c.unique).toBe(true);
    expect(c.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D."]);
  });
  it("Support Staff: cost 1, Uses (3 staff counters), PERSONA and S.H.I.E.L.D.", () => {
    const c = card<SupportCard>(STAFF);
    expect(c.cost).toBe(1);
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "staff" }]);
    expect(c.traits.map(String)).toEqual(["PERSONA", "S.H.I.E.L.D."]);
  });
  it("The Iliad: unique, cost 6, Uses (3 mission counters), S.H.I.E.L.D. and VEHICLE", () => {
    const c = card<SupportCard>(ILIAD);
    expect([c.cost, c.unique]).toEqual([6, true]);
    expect(c.keywords).toEqual([{ name: "uses", count: 3, counterType: "mission" }]);
    expect(c.traits.map(String)).toEqual(["S.H.I.E.L.D.", "VEHICLE"]);
  });
  it("Life Model Decoy: upgrade, cost 2, PREPARATION and TECH", () => {
    const c = card<UpgradeCard>(DECOY);
    expect(c.cost).toBe(2);
    expect(c.traits.map(String)).toEqual(["PREPARATION", "TECH"]);
  });
  it("S.H.I.E.L.D. Director: unique upgrade, cost 2, TITLE", () => {
    const c = card<UpgradeCard>(DIRECTOR);
    expect([c.cost, c.unique]).toEqual([2, true]);
    expect(c.traits.map(String)).toEqual(["TITLE"]);
  });
});

describe("playing the cards from hand", () => {
  /** Plays `code` from hand paying with `pay` other hand cards, answering prompts by default. */
  const playIt = (
    state: GameState,
    code: string,
    pay: number,
    extra: { readonly attachToInstanceId?: InstanceId } = {},
  ) => {
    const given = moveToHand(state, P1, code);
    const id = given.ids[0]!;
    const hand = playerOf(given.state, P1).hand.length;
    const after = drive(run(given.state, play(P1, id, payWith(given.state, P1, pay, [id]), extra)));
    return { state: after, id, handBefore: hand };
  };

  it("Support Staff costs 1 and enters play with 3 staff counters, ready", () => {
    const { state, id, handBefore } = playIt(mariaGame(), STAFF, 1);
    expect(inPlayArea(state, id)).toBe(true);
    expect(counters(state, id)).toEqual({ staff: 3 });
    expect(inst(state, id).exhausted).toBe(false);
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 2); // the card itself and 1 paid
  });
  it("The Iliad costs 6 and enters play with 3 mission counters", () => {
    const { state, id } = playIt(mariaGame(), ILIAD, 6);
    expect(inPlayArea(state, id)).toBe(true);
    expect(counters(state, id)).toEqual({ mission: 3 });
  });
  it("Nick Fury costs 4 and enters play as an ally with no counters", () => {
    const { state, id, handBefore } = playIt(mariaGame(), FURY, 4);
    expect(inPlayArea(state, id)).toBe(true);
    expect(counters(state, id)).toEqual({});
    expect(playerOf(state, P1).hand).toHaveLength(handBefore - 5);
  });
  it("S.H.I.E.L.D. Director costs 2 and attaches to the chosen character", () => {
    const start = mariaGame();
    const { state, id } = playIt(start, DIRECTOR, 2, { attachToInstanceId: identityOf(start) });
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
    expect(inst(state, identityOf(state)).attachments).toContain(id);
  });
  it("Life Model Decoy costs 2 and attaches to the chosen character", () => {
    const start = mariaGame();
    const { state, id } = playIt(start, DECOY, 2, { attachToInstanceId: identityOf(start) });
    expect(inst(state, id).attachedTo).toBe(identityOf(state));
  });
});

describe(`${FURY_RESPONSE}: after Nick Fury uses a basic power, place 1 all-purpose counter on a S.H.I.E.L.D. support`, () => {
  const stage = (supports: Readonly<Record<string, Record<string, number>>>) => {
    const hero = mariaHeroGame();
    let state = patchInstance(hero, schemeOf(hero), { threat: 5 });
    const fury = inPlay(state, FURY);
    state = fury.state;
    const ids: Record<string, InstanceId> = {};
    for (const [code, c] of Object.entries(supports)) {
      const put = inPlay(state, code, c);
      state = put.state;
      ids[code] = put.id;
    }
    return { state, fury: fury.id, ids };
  };
  const thwart = (s: GameState, fury: InstanceId) =>
    ({ type: "basicThwart", playerId: P1, thwarterInstanceId: fury, schemeInstanceId: schemeOf(s) }) as const;
  const attack = (s: GameState, fury: InstanceId) =>
    ({ type: "basicAttack", playerId: P1, attackerInstanceId: fury, targetInstanceId: villainOf(s) }) as const;

  it("after his basic thwart, a counter lands on The Iliad as a mission counter: 3 to 4", () => {
    const { state, fury, ids } = stage({ [ILIAD]: { mission: 3 } });
    const threatBefore = inst(state, schemeOf(state)).threat;
    const after = drive(run(state, thwart(state, fury)), { respond: FURY_RESPONSE, target: ids[ILIAD]! });
    expect(counters(after, ids[ILIAD]!)).toEqual({ mission: 4 });
    expect(inst(after, schemeOf(after)).threat).toBe(threatBefore - 2);
  });
  it("after his basic attack as well", () => {
    const { state, fury, ids } = stage({ [STAFF]: { staff: 1 } });
    const after = drive(run(state, attack(state, fury)), { respond: FURY_RESPONSE, target: ids[STAFF]! });
    expect(counters(after, ids[STAFF]!)).toEqual({ staff: 2 });
    expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 2);
  });
  it("the counter takes the destination's type: Support Staff with 3 staff counters gets a fourth", () => {
    const { state, fury, ids } = stage({ [STAFF]: { staff: 3 }, [ILIAD]: { mission: 3 } });
    const after = drive(run(state, thwart(state, fury)), { respond: FURY_RESPONSE, target: ids[STAFF]! });
    expect(counters(after, ids[STAFF]!)).toEqual({ staff: 4 });
    expect(counters(after, ids[ILIAD]!)).toEqual({ mission: 3 });
  });
  it("a support that is not S.H.I.E.L.D. is not a target", () => {
    const { state, fury, ids } = stage({ [FRONT_ORG]: {}, [ILIAD]: { mission: 3 } });
    const asked = settle(
      run(state, thwart(state, fury)),
      picker({ respond: FURY_RESPONSE }),
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    expect(asked.pendingChoice!.options.map((o) => o.optionId)).toEqual([ids[ILIAD]!]);
  });
  it("the response is optional: declining places nothing", () => {
    const { state, fury, ids } = stage({ [ILIAD]: { mission: 3 } });
    const after = drive(run(state, thwart(state, fury)));
    expect(counters(after, ids[ILIAD]!)).toEqual({ mission: 3 });
  });
  it("with no S.H.I.E.L.D. support in play nothing is placed (no card gains a counter)", () => {
    const { state, fury, ids } = stage({ [FRONT_ORG]: {} });
    const after = drive(run(state, thwart(state, fury)), { respond: FURY_RESPONSE });
    expect(counters(after, ids[FRONT_ORG]!)).toEqual({});
    expect(counters(after, fury)).toEqual({});
  });
  it("Maria's own basic power does not trigger him", () => {
    const { state, ids } = stage({ [ILIAD]: { mission: 3 } });
    const after = drive(
      run(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: schemeOf(state),
      }),
      { respond: FURY_RESPONSE, target: ids[ILIAD]! },
    );
    expect(counters(after, ids[ILIAD]!)).toEqual({ mission: 3 });
  });
});

describe(`${STAFF_RESOURCE}: Resource, exhaust and remove 1 staff counter, generate a wild resource`, () => {
  /** Plays Command Team (cost 2) paying with Support Staff's resource ability and `others` hand cards. */
  const payWithStaff = (state: GameState, staff: InstanceId, others: number) => {
    const given = moveToHand(state, P1, COMMAND_TEAM);
    const team = given.ids[0]!;
    return {
      team,
      handBefore: playerOf(given.state, P1).hand.length, // Command Team already counted
      after: drive(
        run(
          given.state,
          play(P1, team, payWith(given.state, P1, others, [team]), {
            abilities: [resourceAbility(staff, STAFF_RESOURCE)],
          }),
        ),
      ),
    };
  };

  it("pays 1 of Command Team's cost 2: exhausts Staff, 3 staff to 2, and 1 hand card pays the rest", () => {
    const staged = inPlay(mariaHeroGame(), STAFF, { staff: 3 });
    const { after, team, handBefore } = payWithStaff(staged.state, staged.id, 1);
    expect(inPlayArea(after, team)).toBe(true);
    expect(inst(after, staged.id).exhausted).toBe(true);
    expect(counters(after, staged.id)).toEqual({ staff: 2 });
    expect(playerOf(after, P1).hand).toHaveLength(handBefore - 2); // Command Team and 1 paid card leave
  });
  it("the last staff counter removed discards Support Staff (Uses, RRG 1.8 p. 46)", () => {
    const staged = inPlay(mariaHeroGame(), STAFF, { staff: 1 });
    const { after, team } = payWithStaff(staged.state, staged.id, 1);
    expect(inPlayArea(after, team)).toBe(true);
    expect(inDiscard(after, staged.id)).toBe(true);
    expect(inPlayArea(after, staged.id)).toBe(false);
  });
  it("works in alter-ego form too (no form restriction)", () => {
    const staged = inPlay(mariaGame(), STAFF, { staff: 3 });
    const { after, team } = payWithStaff(staged.state, staged.id, 1);
    expect(inPlayArea(after, team)).toBe(true);
    expect(counters(after, staged.id)).toEqual({ staff: 2 });
  });
  it("an exhausted Support Staff cannot pay", () => {
    const staged = inPlay(mariaHeroGame(), STAFF, { staff: 3 });
    const tired = patchInstance(staged.state, staged.id, { exhausted: true });
    const given = moveToHand(tired, P1, COMMAND_TEAM);
    const team = given.ids[0]!;
    const result = applyCommand(
      given.state,
      play(P1, team, payWith(given.state, P1, 1, [team]), { abilities: [resourceAbility(staged.id, STAFF_RESOURCE)] }),
      DEPS,
    );
    expect(result.ok).toBe(false);
  });
  it("with no staff counter left it cannot pay", () => {
    const staged = inPlay(mariaHeroGame(), STAFF, {});
    const given = moveToHand(staged.state, P1, COMMAND_TEAM);
    const team = given.ids[0]!;
    const result = applyCommand(
      given.state,
      play(P1, team, payWith(given.state, P1, 1, [team]), { abilities: [resourceAbility(staged.id, STAFF_RESOURCE)] }),
      DEPS,
    );
    expect(result.ok).toBe(false);
  });

  describe("for a player whose identity has the S.H.I.E.L.D. trait", () => {
    /** Maria Hill (P1) and Spider-Man (P2, no S.H.I.E.L.D.) at one table. */
    function twoPlayers(): GameState {
      const base = coreScenario("rhino", {
        players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        difficulty: "standard",
        modularSetIds: [],
        cardPool: WAVE9_CARDS,
      } as never);
      const maria: PlayerSetup = wave9StarterDeckSetup("maria-hill-leadership");
      const created = createGame({ ...base, players: [maria, base.players[1]!], requireLegalDecks: false }, DEPS);
      if (!created.ok) throw new Error(created.error.message);
      return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
    }

    it("a Spider-Man player (no S.H.I.E.L.D. trait) cannot pay with Maria's Support Staff: the gate is the spender's identity", () => {
      const placed = inPlay(twoPlayers(), STAFF, { staff: 3 });
      // Maria's turn ends so that it is P2's: a play needs the active player.
      const staged = { id: placed.id, state: settle(run(placed.state, endTurn(P1)), firstLegal, undefined, DEPS) };
      const p2 = playerOf(staged.state, P2);
      const cheap = p2.hand.find(
        (id) => (card<{ cost?: number }>(staged.state.instances[id]!.cardId as string)?.cost ?? 9) <= 1,
      );
      const target = cheap ?? p2.hand[0]!;
      const refused = applyCommand(
        staged.state,
        play(P2, target, [], { abilities: [resourceAbility(staged.id, STAFF_RESOURCE)] }),
        DEPS,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.message).toMatch(/condition is not met/);
      expect(counters(staged.state, staged.id)).toEqual({ staff: 3 });
    });
  });
});

describe(`${ILIAD_ACTION}: exhaust, remove 1 mission counter, then choose one mode`, () => {
  const iliad = (mission = 3) => {
    const staged = inPlay(mariaHeroGame(), ILIAD, { mission });
    return { state: staged.state, id: staged.id };
  };
  const useIliad = (s: GameState, id: InstanceId, opts: Parameters<typeof picker>[0]) =>
    drive(run(s, use(P1, id, ILIAD_ACTION)), opts);

  it("cost: exhausts The Iliad and removes 1 mission counter (3 to 2) whatever the mode", () => {
    const { state, id } = iliad();
    const after = useIliad(state, id, { option: "Deal 5" });
    expect(inst(after, id).exhausted).toBe(true);
    expect(counters(after, id)).toEqual({ mission: 2 });
  });
  it("Deal 5 damage to an enemy: the villain takes exactly 5 (not an attack: no retaliate, no stun check)", () => {
    const { state, id } = iliad();
    const after = useIliad(state, id, { option: "Deal 5", target: villainOf(state) });
    expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 5);
    expect(inst(after, identityOf(after)).damage).toBe(inst(state, identityOf(state)).damage);
  });
  it("Remove 4 threat from a scheme: the main scheme drops by 4", () => {
    const { state, id } = iliad();
    const loaded = patchInstance(state, schemeOf(state), { threat: 9 });
    const after = useIliad(loaded, id, { option: "Remove 4", target: schemeOf(loaded) });
    expect(inst(after, schemeOf(after)).threat).toBe(5);
  });
  it("Remove 4 threat does not go below 0", () => {
    const { state, id } = iliad();
    const loaded = patchInstance(state, schemeOf(state), { threat: 3 });
    const after = useIliad(loaded, id, { option: "Remove 4", target: schemeOf(loaded) });
    expect(inst(after, schemeOf(after)).threat).toBe(0);
  });
  it("Heal 3 damage from an identity: Maria at 5 damage goes to 2", () => {
    const { state, id } = iliad();
    const hurt = withDamage(state, identityOf(state), 5);
    const after = useIliad(hurt, id, { option: "Heal 3", target: identityOf(hurt) });
    expect(inst(after, identityOf(after)).damage).toBe(2);
  });
  it("Heal 3 stops at 0 damage", () => {
    const { state, id } = iliad();
    const hurt = withDamage(state, identityOf(state), 2);
    const after = useIliad(hurt, id, { option: "Heal 3", target: identityOf(hurt) });
    expect(inst(after, identityOf(after)).damage).toBe(0);
  });
  it("the last mission counter removed discards The Iliad, and the chosen mode still resolves (RRG p. 46)", () => {
    const { state, id } = iliad(1);
    const after = useIliad(state, id, { option: "Deal 5", target: villainOf(state) });
    expect(inDiscard(after, id)).toBe(true);
    expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage + 5);
  });
  it("cannot be used while exhausted, or with no mission counter", () => {
    const { state, id } = iliad();
    expect(applyCommand(patchInstance(state, id, { exhausted: true }), use(P1, id, ILIAD_ACTION), DEPS).ok).toBe(false);
    const empty = inPlay(mariaHeroGame(), ILIAD, {});
    expect(applyCommand(empty.state, use(P1, empty.id, ILIAD_ACTION), DEPS).ok).toBe(false);
  });
  it("is an action usable in alter-ego form too", () => {
    const staged = inPlay(mariaGame(), ILIAD, { mission: 3 });
    expect(applyCommand(staged.state, use(P1, staged.id, ILIAD_ACTION), DEPS).ok).toBe(true);
  });
});

describe(`${DIRECTOR_ACTION}: exhaust S.H.I.E.L.D. Director, place 1 all-purpose counter on a S.H.I.E.L.D. support`, () => {
  const stage = (form: "hero" | "alterEgo" = "hero") => {
    const base = form === "hero" ? mariaHeroGame() : mariaGame();
    const iliad = inPlay(base, ILIAD, { mission: 3 });
    const staff = inPlay(iliad.state, STAFF, { staff: 2 });
    const director = attach(staff.state, DIRECTOR);
    return { state: director.state, director: director.id, iliad: iliad.id, staff: staff.id };
  };

  it("exhausts the Director and puts a counter on The Iliad as a mission counter: 3 to 4", () => {
    const { state, director, iliad, staff } = stage();
    const after = drive(run(state, use(P1, director, DIRECTOR_ACTION)), { target: iliad });
    expect(inst(after, director).exhausted).toBe(true);
    expect(counters(after, iliad)).toEqual({ mission: 4 });
    expect(counters(after, staff)).toEqual({ staff: 2 });
  });
  it("on Support Staff the counter is a staff counter: 2 to 3", () => {
    const { state, director, staff } = stage();
    const after = drive(run(state, use(P1, director, DIRECTOR_ACTION)), { target: staff });
    expect(counters(after, staff)).toEqual({ staff: 3 });
  });
  it("a support without the S.H.I.E.L.D. trait is not offered", () => {
    const { state, director, iliad, staff } = stage();
    const front = inPlay(state, FRONT_ORG);
    const asked = settle(
      run(front.state, use(P1, director, DIRECTOR_ACTION)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "chooseTarget",
      DEPS,
    );
    const offered = asked.pendingChoice!.options.map((o) => o.optionId);
    expect(offered.sort()).toEqual([iliad, staff].sort());
    expect(offered).not.toContain(front.id);
  });
  it("cannot be used while exhausted", () => {
    const { state, director } = stage();
    expect(
      applyCommand(patchInstance(state, director, { exhausted: true }), use(P1, director, DIRECTOR_ACTION), DEPS).ok,
    ).toBe(false);
  });
  it("with no S.H.I.E.L.D. support in play it has no target and cannot be used (the Director stays ready)", () => {
    const only = attach(inPlay(mariaHeroGame(), FRONT_ORG).state, DIRECTOR);
    const result = applyCommand(only.state, use(P1, only.id, DIRECTOR_ACTION), DEPS);
    expect(result.ok).toBe(false);
    expect(inst(only.state, only.id).exhausted).toBe(false);
  });
  it("is an action usable in alter-ego form", () => {
    const { state, director, iliad } = stage("alterEgo");
    const after = drive(run(state, use(P1, director, DIRECTOR_ACTION)), { target: iliad });
    expect(counters(after, iliad)).toEqual({ mission: 4 });
  });
});

describe(`${DECOY_INTERRUPT}: when an enemy attacks you, discard Life Model Decoy, prevent all damage from that attack`, () => {
  /** Hero form with Rhino attacking at the villain phase; `decoy` attaches Life Model Decoy first. */
  const villainPhase = (decoy: boolean) => {
    let state = mariaHeroGame();
    let id: InstanceId | null = null;
    if (decoy) {
      const put = attach(state, DECOY);
      state = put.state;
      id = put.id;
    }
    return { state, id };
  };
  /**
   * The first attack of the villain phase, resolved: stops at the next defender prompt (Rhino activates twice in this
   * seed's villain phase: a second attack follows) or the end of the phase. A Decoy used on the first attack is
   * gone for the second, which is why the check stops here.
   */
  const throughAttack = (state: GameState, opts: Parameters<typeof picker>[0]): GameState => {
    let defenders = 0;
    return settle(
      run(state, endTurn(P1)),
      (s) => {
        if (s.pendingChoice?.prompt.kind === "declareDefender") {
          defenders++;
          return ["decline"];
        }
        return picker(opts)(s);
      },
      (s) =>
        (s.step.phase === "player" && s.round > state.round) ||
        (defenders >= 1 && s.pendingChoice?.prompt.kind === "declareDefender"),
      DEPS,
    );
  };

  it("baseline: without the Decoy the villain's attack damages Maria", () => {
    const { state } = villainPhase(false);
    const after = throughAttack(state, {});
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
  });
  it("with the Decoy used: Maria takes no damage and the Decoy is in the discard pile", () => {
    const { state, id } = villainPhase(true);
    const after = throughAttack(state, { respond: DECOY_INTERRUPT });
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(inDiscard(after, id!)).toBe(true);
    expect(inst(after, identityOf(after)).attachments).not.toContain(id);
  });
  it("it is optional: declining keeps the Decoy and the attack deals its damage", () => {
    const { state, id } = villainPhase(true);
    const after = throughAttack(state, {});
    expect(inst(after, identityOf(after)).damage).toBeGreaterThan(0);
    expect(inst(after, id!).attachedTo).toBe(identityOf(after));
  });
  it("the prevented attack still counts as made: the villain is not stunned or hurt by it", () => {
    const { state, id } = villainPhase(true);
    const after = throughAttack(state, { respond: DECOY_INTERRUPT });
    expect(inst(after, villainOf(after)).damage).toBe(inst(state, villainOf(state)).damage);
    expect(id).not.toBeNull();
  });
});

describe("hero-form and alter-ego restrictions", () => {
  it("none of the five cards is restricted to a form", () => {
    for (const ref of Object.keys(REGISTRY)) {
      const trigger = REGISTRY[ref]!.trigger as { form?: string };
      expect(trigger.form, ref).toBeUndefined();
    }
  });
  it("a stunned or exhausted Maria (identity exhausted) does not stop the Iliad", () => {
    const staged = inPlay(withForm(mariaGame(), { heroForm: 0 }), ILIAD, { mission: 3 });
    const tired = patchInstance(staged.state, identityOf(staged.state), { exhausted: true });
    expect(applyCommand(tired, use(P1, staged.id, ILIAD_ACTION), DEPS).ok).toBe(true);
  });
});
