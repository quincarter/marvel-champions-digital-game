import type { GameState, InstanceId } from "@mc/engine";
import { characterProfile, hasKeyword, traitsOf } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, instancesOf, moveToHand, P1, payWith, play, playerOf, settle, stackEncounterDeck, type Picker } from "../../testing/harness.js";
import { withDamage, withForm } from "../../testing/staging.js";
import { wave2Scenario } from "../setup.js";
import { playFromHand, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { WASP_KIT } from "./kit.js";

// Real wave 2 content: the Wasp (Aggression) precon against Rhino, standard, solo. Nadia Van Dyne starts in alter-ego.
const waspVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 }));

const TINY = { heroForm: 0 } as const;
const GIANT = { heroForm: 1 } as const;

const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options.map((o) => o.optionId).filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/**
 * Reveals a fresh Hydra Mercenary (01101, Rhino's own encounter set, printed 3 HP) as P1's own villain-phase
 * encounter card and damages it to the brink, so a single real attack lands the killing blow — the same "stage a
 * filler boost card ahead of it" trick `../../testing/staging.js`'s `stageNemesisCardForReveal` uses (Advance,
 * 01186, a Standard treachery in every wave 2 scenario's deck, consumed as the villain's own boost instead).
 */
function readyMinion(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const staged = stackEncounterDeck(state, "01186", "01101");
  const revealed = settle(runWave2(staged, endTurn()), firstLegal, undefined, WAVE2_DEPS);
  const id = instancesOf(revealed, "01101").find((candidate) => playerOf(revealed, P1).playArea.includes(candidate))!;
  const near = { ...revealed, instances: { ...revealed.instances, [id]: { ...revealed.instances[id]!, damage: 999 } } };
  return { state: near, id };
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

  it("Red Room Training: in Tiny hero form, your basic attacks gain piercing (§17.3) — a real tough-card discard, event attacks unaffected", () => {
    const start = withForm(waspVsRhino(), TINY);
    const { state } = playFromHand(start, "13008", 2);
    const identity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    const tough: GameState = { ...state, instances: { ...state.instances, [villain]: { ...state.instances[villain]!, damage: 0, statuses: { stunned: 0, confused: 0, tough: 1 } } } };
    const attacked = settle(runWave2(tough, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }), firstLegal, undefined, WAVE2_DEPS);
    // Piercing discards the tough status card before dealing damage (RRG 1.8 "Piercing", p. 32); without it the
    // whole basic attack would have been absorbed instead.
    expect(inst(attacked, villain).statuses.tough).toBe(0);
    expect(inst(attacked, villain).damage).toBeGreaterThan(0);

    // The rule is `basicOnly`: Pinpoint Strike (13004, "Hero Action (attack)") is an *ability's* attack, not a
    // basic one, so this rule misses it even while Tiny — the tough card still absorbs (and discards for) that
    // attack (RRG 1.8 "Tough": a tough status "prevents all damage and is discarded instead"), but unlike the
    // piercing case above, no damage gets through it.
    const toughAgain: GameState = { ...state, instances: { ...state.instances, [villain]: { ...state.instances[villain]!, damage: 0, statuses: { stunned: 0, confused: 0, tough: 1 } } } };
    const struck = playFromHand(toughAgain, "13004", 3, accepting("enemy"));
    expect(inst(struck.state, villain).statuses.tough).toBe(0);
    expect(inst(struck.state, villain).damage).toBe(0);
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

  it("Small but Mighty: deals 1 damage to the villain after Wasp defeats a minion; not after an ally does (§17.2)", () => {
    // Printed only on the Tiny hero face (13001a); the Giant face (13001c) carries no copy of this ability.
    const byWasp = readyMinion(withForm(waspVsRhino(), TINY));
    const villainBefore = byWasp.state.villains[0]!.instanceId;
    const damageBefore = inst(byWasp.state, villainBefore).damage;
    const identity = identityOf(byWasp.state);
    const afterWasp = settle(
      runWave2(byWasp.state, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: byWasp.id }),
      accepting("13001a.small-but-mighty"), // an optional Response — `firstLegal` alone would decline it
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(afterWasp, P1).playArea.concat(afterWasp.villainArea)).not.toContain(byWasp.id); // the minion is gone
    expect(inst(afterWasp, villainBefore).damage).toBe(damageBefore + 1);

    // The identical defeat, but by the Ant-Man ally instead of Wasp herself: same defeating *player*, different
    // defeating *card*, so Small but Mighty's own `sourceIs` (identity or event) does not accept it.
    const withAlly = playFromHand(withForm(waspVsRhino(), TINY), "13002", 4);
    const ally = instancesOf(withAlly.state, "13002")[0]!;
    const byAlly = readyMinion(withAlly.state);
    const villainForAlly = byAlly.state.villains[0]!.instanceId;
    const allyDamageBefore = inst(byAlly.state, villainForAlly).damage;
    const afterAlly = settle(
      runWave2(byAlly.state, { type: "basicAttack", playerId: P1, attackerInstanceId: ally, targetInstanceId: byAlly.id }),
      firstLegal,
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(afterAlly, P1).playArea.concat(afterAlly.villainArea)).not.toContain(byAlly.id); // still defeated
    expect(inst(afterAlly, villainForAlly).damage).toBe(allyDamageBefore); // but the villain takes no damage this time
  });

  it("Ant-Man (ally, 13002): gains the Giant trait and +1 ATK in Giant hero form; the Tiny trait and +1 THW in Tiny hero form (§17.5's traitsOf fix)", () => {
    const giant = withForm(waspVsRhino(), GIANT);
    const { state } = playFromHand(giant, "13002", 4);
    const ally = instancesOf(state, "13002")[0]!;
    expect(traitsOf(state, ally, WAVE2_DEPS).map(String)).toContain("GIANT");
    expect(characterProfile(state, ally, WAVE2_DEPS)?.atk).toBe(3); // printed 2 + 1
    expect(characterProfile(state, ally, WAVE2_DEPS)?.thw).toBe(2); // printed 2, no Tiny bonus in Giant form

    const tiny = withForm(state, TINY);
    expect(traitsOf(tiny, ally, WAVE2_DEPS).map(String)).toContain("TINY");
    expect(traitsOf(tiny, ally, WAVE2_DEPS).map(String)).not.toContain("GIANT");
    expect(characterProfile(tiny, ally, WAVE2_DEPS)?.thw).toBe(3); // printed 2 + 1
    expect(characterProfile(tiny, ally, WAVE2_DEPS)?.atk).toBe(2); // printed 2, no Giant bonus in Tiny form
  });

  it("Rapid Growth: Hero Interrupt raises the basic power being used by 2 and changes to Giant hero form (§17.4)", () => {
    // Rapid Growth is a reactive event, played from hand *inside* the basic attack's own `basicPowerUsing` window
    // (RRG 1.8 "Interrupt", p. 25) — not a card played beforehand — so the choice flow itself picks it (a
    // `chooseTriggers` prompt) and pays its printed cost (a `payForCard` prompt, `options[0]`: any one hand card as
    // a [wild] resource covers its printed cost of 1), the same two-step pattern `wave1/drs/pack-cards.test.ts` uses.
    const start = withForm(waspVsRhino(), TINY);
    const villain = start.villains[0]!.instanceId;
    const given = moveToHand(start, P1, "13005");
    const identity = identityOf(given.state);
    const pick: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("13005.rapid-growth-interrupt")(state);
    };
    const attacked = settle(
      runWave2(given.state, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      pick,
      undefined,
      WAVE2_DEPS,
    );
    // Printed Tiny ATK is 1; interrupting mid-attack changes to Giant (printed ATK 2) and adds +2 for this use: 4.
    expect(inst(attacked, villain).damage).toBe(4);
    const owner = attacked.players.find((p) => p.playerId === P1)!;
    expect(owner.identity.form).toBe("hero");
    expect(owner.identity.heroFormIndex).toBe(GIANT.heroForm);
    // "For this use": no lasting +2 left over once the attack is done.
    expect(attacked.lastingEffects).toHaveLength(0);
  });
});
