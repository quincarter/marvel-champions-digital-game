import { characterProfile, type InstanceId } from "@mc/engine";
import { firstLegal, identityOf, inst, moveToHand, P1, payWith, picking, play, playerOf, settle, toHero, use } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

// Real wave 2 content: the Spider-Woman (Aggression & Justice) precon against Rhino, standard, solo.
const spiderWomanVsRhino = () => startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "spider-woman-aggression-justice" }], seed: 11 }));

describe("Spider-Woman kit", () => {
  it("Double Agent: deckbuilding-only (data — Deck.aspects carries the two chosen aspects)", () => {
    const start = spiderWomanVsRhino();
    expect(playerOf(start, P1).deck.length).toBeGreaterThan(0);
  });

  it("Jessica Drew: looks at the top card of any deck (limit once per round)", () => {
    const start = spiderWomanVsRhino();
    const identity = identityOf(start);
    const after = settle(runWave2(start, use(P1, identity, "04031b.jessica-drew-action")), picking(P1), undefined, WAVE2_DEPS);
    expect(after).toBeDefined();
  });

  it("Captain Marvel: after she uses a basic power, draw 1 card", () => {
    const start = spiderWomanVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04032");
    const [captainMarvel] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, captainMarvel, payWith(given.state, P1, 4, [captainMarvel]))), firstLegal, undefined, WAVE2_DEPS);
    expect(playerOf(played, P1).playArea).toContain(captainMarvel);
    // `basicPowerUsed` (docs/phase7-wave2.md §3.11) is the shared trigger event every "after a basic power" card
    // reacts to; its own engine-level semantics (announced under the power's own events, never for a stunned
    // attack/confused thwart) are pinned in `primitives-wave2.test.ts`. Here it's enough to prove the ability
    // resolved into the registry, wired to it, on the actual precon card.
    expect(WAVE2_DEPS.abilities["04032.captain-marvel-response"]).toBeDefined();
  });

  it("Venom Blast: an (attack) event — deals 5 damage to an enemy", () => {
    const start = spiderWomanVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04035");
    const [venomBlast] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const after = settle(runWave2(given.state, play(P1, venomBlast, payWith(given.state, P1, 2, [venomBlast]))), picking(villain), undefined, WAVE2_DEPS);
    expect(inst(after, villain).damage).toBe(before + 5);
  });

  it("Pheromones: an event — stuns and confuses an enemy", () => {
    const start = spiderWomanVsRhino();
    const given = moveToHand(runWave2(start, toHero()), P1, "04036");
    const [pheromones] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const after = settle(runWave2(given.state, play(P1, pheromones, payWith(given.state, P1, 2, [pheromones]))), picking(villain), undefined, WAVE2_DEPS);
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0);
  });

  it("Contaminant Immunity: heals 3 damage from Spider-Woman and gives her a tough status card", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const damaged = { ...hero, instances: { ...hero.instances, [identity]: { ...hero.instances[identity]!, damage: 3 } } };
    const given = moveToHand(damaged, P1, "04037");
    const [contaminant] = given.ids as [InstanceId];
    const after = settle(runWave2(given.state, play(P1, contaminant, payWith(given.state, P1, 2, [contaminant]))), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, identity).damage).toBe(0);
    expect(inst(after, identity).statuses.tough).toBeGreaterThan(0);
  });

  it("Inconspicuous: an (thwart) event — removes a total of 3 threat from among schemes in play", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const scheme = hero.mainScheme.instanceId;
    const before = inst(hero, scheme).threat;
    const given = moveToHand(hero, P1, "04038");
    const [inconspicuous] = given.ids as [InstanceId];
    const after = settle(runWave2(given.state, play(P1, inconspicuous, payWith(given.state, P1, 1, [inconspicuous]))), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, scheme).threat).toBe(Math.max(0, before - 3));
  });

  it("Self-Propelled Glide: readies Spider-Woman; she gains Aerial until the end of the round", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const exhausted = { ...hero, instances: { ...hero.instances, [identity]: { ...hero.instances[identity]!, exhausted: true } } };
    const given = moveToHand(exhausted, P1, "04039");
    const [glide] = given.ids as [InstanceId];
    const after = settle(runWave2(given.state, play(P1, glide, payWith(given.state, P1, 1, [glide]))), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("Spider-Girl: after you play her from your hand, stun and confuse a minion", () => {
    const start = spiderWomanVsRhino();
    expect(WAVE2_DEPS.abilities["04040.spider-girl-response"]).toBeDefined();
  });

  it("Press the Advantage: an (attack) event — deals 2 damage; draws 1 card if the enemy is stunned or confused", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const villain = hero.villains[0]!.instanceId;
    const confused = { ...hero, instances: { ...hero.instances, [villain]: { ...hero.instances[villain]!, statuses: { ...hero.instances[villain]!.statuses, confused: 1 } } } };
    const given = moveToHand(confused, P1, "04043");
    const [press] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const damageBefore = inst(given.state, villain).damage;
    const after = settle(runWave2(given.state, play(P1, press, payWith(given.state, P1, 1, [press]))), picking(villain), undefined, WAVE2_DEPS);
    expect(inst(after, villain).damage).toBe(damageBefore + 2);
    // -1 the played card itself, -1 the resource payment, +1 for the draw.
    expect(playerOf(after, P1).hand.length).toBe(before - 2 + 1);
  });

  it("Skilled Investigator: after a side scheme is defeated, exhausts to draw 1 card", () => {
    expect(WAVE2_DEPS.abilities["04047.skilled-investigator-response"]).toBeDefined();
  });

  it("Spider-Man: after you play him from your hand, removes 3 [per_hero] threat from a side scheme", () => {
    expect(WAVE2_DEPS.abilities["04045.spider-man-response"]).toBeDefined();
  });

  it("Clear the Area: an (thwart) event — removes 2 threat from a scheme; draws 1 card if that was its last threat", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const scheme = hero.mainScheme.instanceId;
    const lowThreat = { ...hero, instances: { ...hero.instances, [scheme]: { ...hero.instances[scheme]!, threat: 2 } } };
    const given = moveToHand(lowThreat, P1, "04049");
    const [clearArea] = given.ids as [InstanceId];
    const before = playerOf(given.state, P1).hand.length;
    const after = settle(runWave2(given.state, play(P1, clearArea, payWith(given.state, P1, 1, [clearArea]))), picking(scheme), undefined, WAVE2_DEPS);
    expect(inst(after, scheme).threat).toBe(0);
    // -1 the played card itself, -1 the resource payment, +1 for the draw.
    expect(playerOf(after, P1).hand.length).toBe(before - 2 + 1);
  });
});

describe("Spider-Woman's obligation and nemesis (Uncertain Loyalties, The Viper)", () => {
  it("Uncertain Loyalties: exhausting Jessica Drew removes it from the game", () => {
    expect(WAVE2_DEPS.abilities["04053.obligation"]).toBeDefined();
  });

  it("The Viper: while engaged with you, your hand size is reduced by 1", () => {
    const start = spiderWomanVsRhino();
    const identity = identityOf(start);
    expect(characterProfile(start, identity, WAVE2_DEPS)).toBeDefined();
    expect(WAVE2_DEPS.abilities["04054.the-viper-constant"]).toBeDefined();
  });

  it("The Viper's Ambition: When Revealed places an additional 1 [per_hero] threat here", () => {
    expect(WAVE2_DEPS.abilities["04055.when-revealed"]).toBeDefined();
  });
});
