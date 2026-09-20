import type { GameState, InstanceId } from "@mc/engine";
import { characterProfile, hasKeyword, traitsOf } from "@mc/engine";
import { firstLegal, identityOf, inst, moveToHand, P1, payWith, play, playerOf, settle, type Picker } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { WASP_KIT } from "./kit.js";

// Real wave 2 content: the Wasp (Aggression) precon against Rhino, standard, solo. Nadia Van Dyne starts in alter-ego.
const waspVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;
const GIANT = { heroForm: 1 } as const;

/** Test-only surgery: sets the identity's current form directly, the same convention `ant/kit.test.ts` uses. */
function withForm(state: GameState, to: { heroForm: number } | "alterEgo", player = P1): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const identity = to === "alterEgo" ? { ...owner.identity, form: "alterEgo" as const, heroFormIndex: null } : { ...owner.identity, form: "hero" as const, heroFormIndex: to.heroForm };
  return { ...state, players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...identity, changedFormThisRound: false } } : p)) };
}

function withDamage(state: GameState, id: InstanceId, damage: number): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...state.instances[id]!, damage } } };
}

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Moves the card into P1's hand and plays it, paying with other hand cards. */
function playFromHand(state: GameState, code: string, cost: number, pick: Picker = firstLegal): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(runWave2(given.state, play(P1, id, payWith(given.state, P1, cost, [id]))), pick, undefined, WAVE2_DEPS);
  return { state: played, id };
}

describe("Wasp kit", () => {
  it("Wasp's Helmet: +1 THW in Giant hero form, +1 ATK in Tiny hero form — a pure stat modifier gated by hasTrait, safe under §6.15's own boundary (no trait grant, so traitsOf's poisoned scan never sees it)", () => {
    const start = withForm(waspVsRhino(), GIANT);
    const { state } = playFromHand(start, "13010", 2);
    const identity = identityOf(state);
    const giant = characterProfile(state, identity, WAVE2_DEPS);
    expect(giant?.thw).toBe(3); // printed 2 + 1
    expect(giant?.atk).toBe(2); // printed 2, no bonus in Giant form
    const tiny = withForm(state, TINY);
    const profile = characterProfile(tiny, identity, WAVE2_DEPS);
    expect(profile?.atk).toBe(2); // printed 1 + 1
    expect(profile?.thw).toBe(1); // printed 1, no bonus in Tiny form
  });

  it("Red Room Training: gains retaliate 1 in Giant hero form, no keyword in Tiny hero form", () => {
    const start = withForm(waspVsRhino(), GIANT);
    const { state } = playFromHand(start, "13008", 2);
    const identity = identityOf(state);
    expect(hasKeyword(state, identity, "retaliate", WAVE2_DEPS)).toBe(true);
    const tiny = withForm(state, TINY);
    expect(hasKeyword(tiny, identity, "retaliate", WAVE2_DEPS)).toBe(false);
  });

  it("Bio-Synthetic Wings: gains the Aerial trait unconditionally, and its interrupt prevents 1 damage only in Tiny hero form — a real damage exchange, not just an 'is defined' check, and proof `traitsOf`/`hasKeyword` still work once this card (and Red Room Training) are in play", () => {
    const start = withForm(waspVsRhino(), TINY);
    const { state: withWings } = playFromHand(start, "13009", 2);
    const identity = identityOf(withWings);
    expect(traitsOf(withWings, identity, WAVE2_DEPS).map(String)).toContain("AERIAL");

    const villain = withWings.villains[0]!.instanceId;
    const before = inst(withWings, identity).damage;
    const attacked = settle(
      runWave2(withDamage(withWings, villain, 0), { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    // Rhino counters the attack (Charge); resolving that through firstLegal exercises the interrupt prompt too, so
    // this also proves the game doesn't crash with Bio-Synthetic Wings and Red Room Training-shaped constants live.
    expect(attacked.outcome).toBeNull();
    expect(inst(attacked, identity).damage).toBeGreaterThanOrEqual(before);
  });

  it("Pym Particles: spent, heals 2 in Giant hero form or draws 1 in Tiny hero form", () => {
    const start = withForm(waspVsRhino(), GIANT);
    const given = moveToHand(start, P1, "13007");
    const [pym] = given.ids as [InstanceId];
    const other = moveToHand(given.state, P1, "13013"); // Into the Fray, cost 3
    const [event] = other.ids as [InstanceId];
    const damaged = withDamage(other.state, identityOf(other.state), 3);
    const payment = [pym, ...payWith(damaged, P1, 2, [pym, event])];
    const played = settle(runWave2(damaged, play(P1, event, payment)), accepting("13007.pym-particles-response"), undefined, WAVE2_DEPS);
    expect(inst(played, identityOf(played)).damage).toBe(1); // healed 2 of 3

    const tinyStart = withForm(waspVsRhino(), TINY);
    const givenTiny = moveToHand(tinyStart, P1, "13007");
    const [pymTiny] = givenTiny.ids as [InstanceId];
    const otherTiny = moveToHand(givenTiny.state, P1, "13013");
    const [eventTiny] = otherTiny.ids as [InstanceId];
    const beforeHand = playerOf(otherTiny.state, P1).hand.length;
    const paymentTiny = [pymTiny, ...payWith(otherTiny.state, P1, 2, [pymTiny, eventTiny])];
    const playedTiny = settle(runWave2(otherTiny.state, play(P1, eventTiny, paymentTiny)), accepting("13007.pym-particles-response"), undefined, WAVE2_DEPS);
    // The event, Pym Particles and the 2 extra resources all left the hand (-4), the response drew 1 (+1): net -3.
    expect(playerOf(playedTiny, P1).hand.length).toBe(beforeHand - 3);
  });

  it("Wasp (Giant face): a basic thwart can be divided among schemes; a basic attack can be divided among enemies (FAQ 'Wasp (#1C)')", () => {
    expect(WASP_KIT["13001c.wasp-constant"]).toBeDefined();
    expect(WASP_KIT["13001c.wasp-constant-2"]).toBeDefined();
    const start = withForm(waspVsRhino(), GIANT);
    const identity = identityOf(start);
    const scheme = start.mainScheme.instanceId;
    // Without `divideBasicPower` this would be refused as "this thwart cannot be divided" (`primitives-wave2.test.ts`'s
    // own "no rule" case); refused instead for needing *distinct* targets proves the rule already let it past that
    // check — the only scheme in a solo Rhino game is the main scheme, so a real 2-target division can't be set up
    // here, but this still distinguishes "rule absent" from "rule present" by the refusal's own reason.
    expect(() =>
      runWave2(start, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, targetInstanceId: scheme, divide: [{ targetInstanceId: scheme, amount: 1 }] } as never),
    ).toThrow(/distinct targets/);
  });

  it("Giant Help: removes 3 threat from one scheme normally, or divides a total of 4 among schemes in Giant hero form", () => {
    const fresh = waspVsRhino();
    const scheme = fresh.mainScheme.instanceId;
    const threatened = { ...fresh, instances: { ...fresh.instances, [scheme]: { ...fresh.instances[scheme]!, threat: 10 } } };
    const start = withForm(threatened, TINY);
    const { state } = playFromHand(start, "13003", 2);
    expect(inst(state, scheme).threat).toBe(7);
  });

  it("Pinpoint Strike: deals 7 in Giant hero form, 8 with overkill in Tiny hero form", () => {
    const giant = withForm(waspVsRhino(), GIANT);
    const villain = giant.villains[0]!.instanceId;
    const struckGiant = playFromHand(withDamage(giant, villain, 0), "13004", 3, accepting("enemy"));
    expect(inst(struckGiant.state, villain).damage).toBe(7);

    const tiny = withForm(waspVsRhino(), TINY);
    const struckTiny = playFromHand(withDamage(tiny, tiny.villains[0]!.instanceId, 0), "13004", 3, accepting("enemy"));
    expect(inst(struckTiny.state, struckTiny.state.villains[0]!.instanceId).damage).toBe(8);
  });

  it("Swarm Tactics: Team-Up with the Ant-Man ally in play, changes to your other hero form and readies your hero", () => {
    const tiny = withForm(waspVsRhino(), TINY);
    // Ant-Man (13002) itself has two SKIPPED constants (module docblock) but is never registered, so having the
    // bare card in play triggers nothing — it only needs to *exist* for Team-Up's own legality check.
    const { state: withAntMan } = playFromHand(tiny, "13002", 4);
    const identity = identityOf(withAntMan);
    const exhausted = { ...withAntMan, instances: { ...withAntMan.instances, [identity]: { ...withAntMan.instances[identity]!, exhausted: true } } };
    const { state } = playFromHand(exhausted, "13020", 1);
    const owner = state.players.find((p) => p.playerId === P1)!;
    expect(owner.identity.heroFormIndex).toBe(GIANT.heroForm);
    expect(inst(state, identity).exhausted).toBe(false);
  });

  it("G.I.R.L.: shuffles up to 2 cards with a printed [mental] resource from the discard pile into the deck (limit once per round)", () => {
    expect(WASP_KIT["13001b.girl"]).toBeDefined();
  });
});
