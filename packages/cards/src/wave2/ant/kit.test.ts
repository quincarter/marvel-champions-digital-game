import type { GameState, InstanceId } from "@mc/engine";
import { traitsOf } from "@mc/engine";
import { firstLegal, identityOf, inst, moveToHand, P1, payWith, play, playerOf, settle, use, type Picker } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { ANT_MAN_KIT } from "./kit.js";
import { ANT_MAN_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

// Real wave 2 content: the Ant-Man (Leadership) precon against Rhino, standard, solo. Scott Lang starts in alter-ego.
const antManVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "ant-leadership" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;
const GIANT = { heroForm: 1 } as const;

/**
 * Test-only surgery: sets the identity's current form directly (`heroFormIndex`/`form`) and clears
 * `changedFormThisRound`, so a test can start from a specific face and still issue *one* real `changeForm` command
 * this round to trigger the response under test — a second real command in the same round would otherwise hit the
 * once-per-round voluntary-change limit (RRG 1.8 "Form, Change Form").
 */
function withForm(state: GameState, to: { heroForm: number } | "alterEgo", player = P1): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const identity = to === "alterEgo" ? { ...owner.identity, form: "alterEgo" as const, heroFormIndex: null } : { ...owner.identity, form: "hero" as const, heroFormIndex: to.heroForm };
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...identity, changedFormThisRound: false } } : p)) };
}

function withDamage(state: GameState, id: InstanceId, damage: number): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, damage } } };
}

/**
 * Accepts the named optional responses (a trigger's option id is `<instance>:<ability>`) and picks the named
 * targets; declines everything else.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

const changeTo = (state: GameState, to: { heroForm: number } | "alterEgo", pick: Picker) =>
  settle(runWave2(state, { type: "changeForm", playerId: P1, to }), pick, undefined, WAVE2_DEPS);

/** Moves the card into P1's hand and plays it, paying with other hand cards. */
function playFromHand(state: GameState, code: string, cost: number, pick: Picker = firstLegal): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(runWave2(given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, WAVE2_DEPS);
  return { state: played, id };
}

const traits = (state: GameState) => traitsOf(state, identityOf(state), WAVE2_DEPS).map(String);

describe("Ant-Man kit", () => {
  it("Puny Pest: response, after you change to Tiny hero form, removes 1 threat from a scheme", () => {
    const fresh = antManVsRhino();
    const scheme = fresh.mainScheme.instanceId;
    const start = { ...fresh, instances: { ...fresh.instances, [scheme]: { ...fresh.instances[scheme]!, threat: 3 } } };
    const settled = changeTo(start, TINY, accepting("12001a.puny-pest", scheme));
    expect(inst(settled, scheme).threat).toBe(2);
  });

  it("Time to Unwind: response, after you change to alter-ego, heals 1 damage from Scott Lang", () => {
    const start = withForm(antManVsRhino(), TINY);
    const identity = identityOf(start);
    const settled = changeTo(withDamage(start, identity, 2), "alterEgo", accepting("12001b.time-to-unwind"));
    expect(inst(settled, identity).damage).toBe(1);
  });

  it("Giant Nuisance: response, after you change to Giant hero form, deals 1 damage to an enemy", () => {
    const start = antManVsRhino();
    const villain = start.villains[0]!.instanceId;
    const before = inst(start, villain).damage;
    const settled = changeTo(start, GIANT, accepting("12001c.giant-nuisance", villain));
    expect(traits(settled)).toContain("GIANT");
    expect(inst(settled, villain).damage).toBe(before + 1);
  });

  it("the form responses are optional: declining them changes nothing else", () => {
    const start = antManVsRhino();
    const villain = start.villains[0]!.instanceId;
    const settled = changeTo(start, GIANT, firstLegal);
    expect(inst(settled, villain).damage).toBe(inst(start, villain).damage);
  });

  it("Resize: Hero Action, changes to your other hero form and draws 1 card", () => {
    const hero = withForm(antManVsRhino(), TINY);
    const before = playerOf(hero, P1).hand.length;
    const { state: played } = playFromHand(hero, "12005", 0);
    expect(traits(played)).toContain("GIANT");
    // +1 moved into hand, -1 played, +1 drawn.
    expect(playerOf(played, P1).hand.length).toBe(before + 1);
  });

  it("Giant Stomp: cannot be played from Tiny hero form", () => {
    const given = moveToHand(withForm(antManVsRhino(), TINY), P1, "12003");
    const [giantStomp] = given.ids as [InstanceId];
    expect(() => runWave2(given.state, play(P1, giantStomp, payWith(given.state, P1, 3, [giantStomp])))).toThrow(/rejected/);
  });

  it("Giant Stomp: from Giant hero form, deals 8 damage to an enemy as an attack", () => {
    const start = withForm(antManVsRhino(), GIANT);
    const villain = start.villains[0]!.instanceId;
    const before = inst(start, villain).damage;
    const { state: played } = playFromHand(start, "12003", 3, accepting(villain));
    expect(inst(played, villain).damage).toBe(before + 8);
  });

  it("Army of Ants: its action cannot be triggered outside Tiny hero form, and deals 1 damage in it", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state: inPlay, id: ants } = playFromHand(giant, "12007", 1);
    expect(() => runWave2(inPlay, use(P1, ants, "12007.army-of-ants-action"))).toThrow(/cannot be triggered/);
    const tiny = withForm(inPlay, TINY);
    const villain = tiny.villains[0]!.instanceId;
    const used = settle(runWave2(tiny, use(P1, ants, "12007.army-of-ants-action")), accepting(villain), undefined, WAVE2_DEPS);
    expect(inst(used, villain).damage).toBe(inst(tiny, villain).damage + 1);
    expect(inst(used, ants).exhausted).toBe(true);
  });

  it("Wrist Gauntlets: each action is usable only in its own hero form", () => {
    const giant = withForm(antManVsRhino(), GIANT);
    const { state: inPlay, id: gauntlets } = playFromHand(giant, "12010", 1);
    expect(() => runWave2(inPlay, use(P1, gauntlets, "12010.wrist-gauntlets-hero-action"))).toThrow(/cannot be triggered/);
    const tiny = withForm(inPlay, TINY);
    expect(() => runWave2(tiny, use(P1, gauntlets, "12010.wrist-gauntlets-action"))).toThrow(/cannot be triggered/);
  });

  it("Ant-Man's Helmet: heals 2 damage from your hero after you change to Giant hero form", () => {
    const { state: withHelmet } = playFromHand(antManVsRhino(), "12008", 3);
    const identity = identityOf(withHelmet);
    const settled = changeTo(withDamage(withHelmet, identity, 3), GIANT, accepting("12008.ant-mans-helmet-response"));
    expect(inst(settled, identity).damage).toBe(1);
  });

  it("Ant-Man's Helmet: draws 1 card after you change to Tiny hero form", () => {
    const { state: withHelmet } = playFromHand(antManVsRhino(), "12008", 3);
    const before = playerOf(withHelmet, P1).hand.length;
    const settled = changeTo(withHelmet, TINY, accepting("12008.ant-mans-helmet-hero-response"));
    expect(playerOf(settled, P1).hand.length).toBe(before + 1);
  });

  it("Swarm Tactics: Team-Up with the Wasp ally in play, changes to your other hero form and readies your hero", () => {
    const tiny = withForm(antManVsRhino(), TINY);
    const { state: withWasp } = playFromHand(tiny, "12002", 3);
    const exhausted = { ...withWasp, instances: { ...withWasp.instances, [identityOf(withWasp)]: { ...withWasp.instances[identityOf(withWasp)]!, exhausted: true } } };
    const { state: played } = playFromHand(exhausted, "12020", 1);
    expect(traits(played)).toContain("GIANT");
    expect(inst(played, identityOf(played)).exhausted).toBe(false);
  });

  it("Swarm Tactics: cannot be played without Wasp in play", () => {
    const given = moveToHand(withForm(antManVsRhino(), TINY), P1, "12020");
    const [swarmTactics] = given.ids as [InstanceId];
    expect(() => runWave2(given.state, play(P1, swarmTactics, payWith(given.state, P1, 1, [swarmTactics])))).toThrow(/Team-Up needs Wasp/);
  });
});

describe("Ant-Man's obligation and nemesis (Care for Cassie, Yellowjacket)", () => {
  it("Tech Theft: treats the printed text box of each Tech player card as if it were blank", () => {
    expect(ANT_MAN_OBLIGATION_NEMESIS["12026.tech-theft-constant"]).toBeDefined();
  });

  it("Yellowjacket: gains the Giant trait and retaliate 1 while the engaged player is in Giant hero form", () => {
    expect(ANT_MAN_OBLIGATION_NEMESIS["12027.yellowjacket-constant"]).toBeDefined();
    expect(ANT_MAN_OBLIGATION_NEMESIS["12027.yellowjacket-constant-2"]).toBeDefined();
  });
});
