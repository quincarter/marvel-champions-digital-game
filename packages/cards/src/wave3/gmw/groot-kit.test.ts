import { cardsInPlay, hasKeyword, maxHitPoints, type GameState, type InstanceId } from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

// Real wave 3 content: the Groot (Protection) precon against Rhino (a Core scenario, seated with wave 3 content —
// `wave3Scenario`'s fallback), standard, solo. Groot starts in alter-ego.
const grootVsRhino = () =>
  startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }));

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `../scw/kit.test.ts`. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Drives a `basicAttack`/`basicThwart`/villain-phase-attack up to the point right before it resolves, so a test
 * can accept the offered interrupt with a real trigger window rather than invoking the ability directly. */
const toDeclareDefender = (state: GameState) =>
  settle(runWave3(state, endTurn()), firstLegal, (s) => s.pendingChoice?.prompt.kind === "declareDefender", WAVE3_DEPS);

describe("Groot kit", () => {
  it("Fruition: places 2 growth counters on Groot (to a maximum of 10) (16002.fruition-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const { state } = playFromHand(hero, "16002", 0);
    const identity = identityOf(state);
    expect(inst(state, identity).counters.growth).toBe(2);
  });

  it("Fruition: capped at 10 growth counters (16002.fruition-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const near = patchInstance(hero, identity, { counters: { growth: 9 } });
    const { state } = playFromHand(near, "16002", 0);
    expect(inst(state, identity).counters.growth).toBe(10);
  });

  it('"I am Groot": removes threat from a scheme equal to the number of growth counters on Groot (16003.i-am-groot-action)', () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 3 } });
    const withThreat = patchInstance(withCounters, withCounters.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    const { state } = playFromHand(withThreat, "16003", 3);
    expect(mainThreat(state)).toBe(before - 3);
    expect(inst(state, identity).counters.growth).toBe(3); // reading the counters didn't spend them
  });

  it('"I. AM. GROOT!": deals damage to an enemy equal to the number of growth counters on Groot (16004.i-am-groot-action)', () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 4 } });
    const villain = withCounters.villains[0]!.instanceId;
    const before = inst(withCounters, villain).damage;
    const { state } = playFromHand(withCounters, "16004", 2);
    expect(inst(state, villain).damage).toBe(before + 4);
  });

  it("Root Stomp: deals 5 damage to an enemy, placing 1 growth counter on Groot if that attack defeats it (16005.root-stomp-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, identity).counters.growth ?? 0;
    // Prime Rhino to exactly 5 remaining hit points, so this attack defeats him. A defeated villain stage's own
    // damage dial resets to 0 (there is nothing left to have taken damage), which is what confirms the defeat
    // actually happened here, rather than merely that 5 damage was dealt.
    const max = maxHitPoints(hero, villain, WAVE3_DEPS) ?? 5;
    const primed = patchInstance(hero, villain, { damage: Math.max(0, max - 5) });
    const { state } = playFromHand(primed, "16005", 2);
    expect(inst(state, villain).damage).toBe(0);
    expect(inst(state, identity).counters.growth ?? 0).toBe(before + 1);
  });

  it("Root Stomp: places no growth counter when the attack doesn't defeat its target (16005.root-stomp-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, identity).counters.growth ?? 0;
    const undamaged = patchInstance(hero, villain, { damage: 0 }); // Rhino's hit points are well above 5
    const { state } = playFromHand(undamaged, "16005", 2);
    expect(inst(state, villain).damage).toBe(5);
    expect(inst(state, identity).counters.growth ?? 0).toBe(before);
  });

  it("Flora Colossus: Forced Interrupt prevents damage to Groot by removing that many growth counters (16001a.flora-colossus)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const withCounters = patchInstance(hero, identity, { counters: { growth: 5 }, damage: 0 });
    const villain = withCounters.villains[0]!.instanceId;
    const villainDamageBefore = inst(withCounters, villain).damage;
    // Undefended villain phase attack: Rhino's ATK is small (well under 5), so it's fully prevented and every
    // point of damage removes one growth counter 1-for-1.
    const attacked = settle(runWave3(withCounters, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(attacked, identity).damage).toBe(0);
    expect(inst(attacked, identity).counters.growth).toBeLessThan(5);
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore);
  });

  it("Fighting Fit: deals 2 damage to the villain (5 instead if Groot is undamaged) (16014.fighting-fit-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const undamaged = patchInstance(hero, identity, { damage: 0 });
    const villain = undamaged.villains[0]!.instanceId;
    const before = inst(undamaged, villain).damage;
    const { state } = playFromHand(undamaged, "16014", 2);
    expect(inst(state, villain).damage).toBe(before + 5);
  });

  it("Fighting Fit: deals only 2 damage to the villain once Groot has taken damage (16014.fighting-fit-action)", () => {
    const hero = runWave3(grootVsRhino(), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 1 });
    const villain = damaged.villains[0]!.instanceId;
    const before = inst(damaged, villain).damage;
    const { state } = playFromHand(damaged, "16014", 2);
    expect(inst(state, villain).damage).toBe(before + 2);
  });

  it("Fertile Ground: Alter-Ego Action, exhaust it to place 1 growth counter and draw 1 card", () => {
    const { state: withFertileGround, id: fertileGround } = playFromHand(grootVsRhino(), "16007", 1);
    const identity = identityOf(withFertileGround);
    const handBefore = playerOf(withFertileGround, P1).hand.length;
    const used = runWave3(withFertileGround, use(P1, fertileGround, "16007.fertile-ground-action"));
    expect(inst(used, identity).counters.growth).toBe(1);
    expect(playerOf(used, P1).hand.length).toBe(handBefore + 1);
    expect(inst(used, fertileGround).exhausted).toBe(true);
  });

  it("Dauntless: your hero gains retaliate 1 while undamaged, loses it once damaged (16016.dauntless-constant)", () => {
    const { state: withDauntless } = playFromHand(runWave3(grootVsRhino(), toHero()), "16016", 1);
    const identity = identityOf(withDauntless);
    const undamaged = patchInstance(withDauntless, identity, { damage: 0 });
    expect(hasKeyword(undamaged, identity, "retaliate", WAVE3_DEPS)).toBe(true);
    const damaged = patchInstance(withDauntless, identity, { damage: 1 });
    expect(hasKeyword(damaged, identity, "retaliate", WAVE3_DEPS)).toBe(false);
  });

  it("Growth Spurt: Action (Groot's own alter-ego face), places 2 growth counters on Groot (limit once per round)", () => {
    const state = grootVsRhino(); // starts in alter-ego, where this ability lives
    const identity = identityOf(state);
    const used = runWave3(state, use(P1, identity, "16001b.growth-spurt"));
    expect(inst(used, identity).counters.growth).toBe(2);
  });

  it("Entangling Vines: Hero Interrupt, when Groot makes a basic thwart, remove a growth counter and exhaust it → +2 THW for that thwart", () => {
    const { state: withCard, id: entanglingVines } = playFromHand(runWave3(grootVsRhino(), toHero()), "16008", 1);
    const identity = identityOf(withCard);
    const withCounters = patchInstance(withCard, identity, { counters: { growth: 3 } });
    const withThreat = patchInstance(withCounters, withCounters.mainScheme.instanceId, { threat: 10 });
    const before = mainThreat(withThreat);
    const thwarted = settle(
      runWave3(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: withThreat.mainScheme.instanceId,
      }),
      accepting("16008.entangling-vines-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    // Groot's printed THW is 1; +2 from Entangling Vines removes 3 threat.
    expect(mainThreat(thwarted)).toBe(before - 3);
    expect(inst(thwarted, identity).counters.growth).toBe(2); // one growth counter spent as the cost
    expect(inst(thwarted, entanglingVines).exhausted).toBe(true);
  });

  it("Vine Spikes: Hero Interrupt, when Groot makes a basic attack, remove a growth counter and exhaust it → +2 ATK for that attack", () => {
    const { state: withCard, id: vineSpikes } = playFromHand(runWave3(grootVsRhino(), toHero()), "16011", 1);
    const identity = identityOf(withCard);
    const withCounters = patchInstance(withCard, identity, { counters: { growth: 3 } });
    const villain = withCounters.villains[0]!.instanceId;
    const before = inst(withCounters, villain).damage;
    const attacked = settle(
      runWave3(withCounters, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("16011.vine-spikes-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    // Groot's printed ATK is 2; +2 from Vine Spikes deals 4.
    expect(inst(attacked, villain).damage).toBe(before + 4);
    expect(inst(attacked, identity).counters.growth).toBe(2);
    expect(inst(attacked, vineSpikes).exhausted).toBe(true);
  });

  it("Vine Shield: Hero Interrupt, when Groot defends, remove a growth counter and exhaust it → +3 DEF for that attack", () => {
    const { state: withCard, id: vineShield } = playFromHand(runWave3(grootVsRhino(), toHero()), "16010", 1);
    const identity = identityOf(withCard);
    const withCounters = patchInstance(withCard, identity, { counters: { growth: 3 }, damage: 0 });
    const stacked = { ...withCounters }; // Rhino's ATK (2) is already well under Groot's printed DEF (3)
    const reached = toDeclareDefender(stacked);
    expect(reached.pendingChoice?.prompt.kind).toBe("declareDefender");
    const damageBefore = inst(reached, identity).damage;
    const offered = answer(reached, [identity], WAVE3_DEPS); // declares Groot as the defender
    const after = settle(offered, accepting("16010.vine-shield-interrupt"), undefined, WAVE3_DEPS);
    expect(inst(after, identity).damage).toBe(damageBefore); // fully prevented either way; counters/exhaust prove it fired
    expect(inst(after, identity).counters.growth).toBe(2);
    expect(inst(after, vineShield).exhausted).toBe(true);
  });

  it("Hard to Ignore: Hero Response, after your hero defends and takes no damage, exhaust it → remove 1 threat from the main scheme", () => {
    const { state: withCard, id: hardToIgnore } = playFromHand(runWave3(grootVsRhino(), toHero()), "16017", 1);
    const identity = identityOf(withCard);
    // Step one of the villain phase places threat on the main scheme naturally before any attack, so there's
    // something for the response to remove without risking completing the scheme by patching threat too high.
    const reached = toDeclareDefender(withCard);
    const before = mainThreat(reached);
    const offered = answer(reached, [identity], WAVE3_DEPS); // Groot's DEF (3) > Rhino's ATK (2): no damage taken
    const after = settle(offered, accepting("16017.hard-to-ignore-response"), undefined, WAVE3_DEPS);
    expect(mainThreat(after)).toBe(before - 1);
    expect(inst(after, hardToIgnore).exhausted).toBe(true);
  });

  it("Starhawk: Interrupt, when he takes damage exactly equal to his remaining hit points, return him to your hand", () => {
    const { state: withStarhawk } = playFromHand(runWave3(grootVsRhino(), toHero()), "16012", 2);
    const starhawk = instancesOf(withStarhawk, "16012").find((id) => cardsInPlay(withStarhawk).includes(id))!;
    // Starhawk prints 3 hit points and no DEF, so a defended attack lands for the attacker's full ATK. Rhino's
    // printed ATK is 2 (kept exact via a 0-boost-icon encounter card on top): 1 damage already present leaves
    // exactly 2 remaining hit points, matching the incoming 2 damage precisely.
    const primed = patchInstance(withStarhawk, starhawk, { damage: 1 });
    const handBefore = playerOf(primed, P1).hand.length;
    const reached = toDeclareDefender(primed);
    const offered = answer(reached, [starhawk], WAVE3_DEPS);
    const after = settle(offered, accepting("16012.starhawk-interrupt"), undefined, WAVE3_DEPS);
    expect(cardsInPlay(after)).not.toContain(starhawk);
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1);
  });

  it("Rocket Raccoon (ally): Interrupt, when he attacks a minion, +3 ATK for that attack; that attack gains overkill", () => {
    const { state: withRocket } = playFromHand(runWave3(grootVsRhino(), toHero()), "16019", 3);
    const rocket = instancesOf(withRocket, "16019").find((id) => cardsInPlay(withRocket).includes(id))!;
    // Hydra Mercenary (01101, 3 hit points), a real minion in Rhino's own encounter set, engaged directly by
    // state surgery rather than navigated to via an encounter-deck reveal — the same convention
    // `../scw/pack-cards.test.ts`'s own "Turn the Tide" test uses for a synthetic side scheme. The attack itself
    // (below) is still a real `basicAttack` command, so Rocket Raccoon's interrupt fires through its real window.
    const minion = "hydra-mercenary-for-test" as InstanceId;
    // Engaged enemies live in the engaged player's own `playArea` (not `villainArea`, which is the villain/side
    // schemes only) — `resolve/defeat.ts`'s ally/minion defeat sweep scans exactly `player.playArea`, so a minion
    // placed in `villainArea` instead is invisible to it.
    const withMinion: GameState = {
      ...withRocket,
      players: withRocket.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
      instances: {
        ...withRocket.instances,
        [minion]: {
          instanceId: minion,
          cardId: "01101" as never,
          ownerId: null,
          controllerId: null,
          home: { kind: "playArea", playerId: P1 },
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
          engagedWith: P1,
          flipped: false,
        } as never,
      },
    };
    const attacked = settle(
      runWave3(withMinion, { type: "basicAttack", playerId: P1, attackerInstanceId: rocket, targetInstanceId: minion }),
      accepting("16019.rocket-raccoon-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    // Rocket Raccoon's printed ATK is 1; +3 from his own interrupt deals 4 to a 3-hit-point minion — overkill
    // carries the extra point of damage past its defeat rather than wasting it, so it's gone rather than damaged.
    expect(instancesOf(attacked, "01101").some((id) => cardsInPlay(attacked).includes(id))).toBe(false);
  });
});
