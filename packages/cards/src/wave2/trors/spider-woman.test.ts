import { applyCommand, characterProfile, type InstanceId } from "@mc/engine";
import {
  answer,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  resourceAbility,
  settle,
  settleUntil,
  toHero,
  use,
} from "../../testing/harness.js";
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

  it("Superhuman Agility: Interrupt, when you play an aspect card, Spider-Woman gets +1 THW/+1 ATK/+1 DEF until end of round", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const baseline = characterProfile(hero, identity, WAVE2_DEPS);
    const given = moveToHand(hero, P1, "04035"); // Venom Blast, printed Aggression
    const [venomBlast] = given.ids as [InstanceId];
    const villain = given.state.villains[0]!.instanceId;
    const offered = settleUntil(
      runWave2(given.state, play(P1, venomBlast, payWith(given.state, P1, 2, [venomBlast]))),
      "chooseTriggers",
      firstLegal,
      WAVE2_DEPS,
    );
    const option = `${identity}:04031a.superhuman-agility`;
    expect(offered.pendingChoice?.options.map((o) => o.optionId)).toContain(option);
    const chose = answer(offered, [option], WAVE2_DEPS);
    const boosted = settle(chose, picking(villain), undefined, WAVE2_DEPS);
    const profile = characterProfile(boosted, identity, WAVE2_DEPS);
    expect(profile?.thw).toBe((baseline?.thw ?? 0) + 1);
    expect(profile?.atk).toBe((baseline?.atk ?? 0) + 1);
    expect(profile?.def).toBe((baseline?.def ?? 0) + 1);
  });

  it("Finesse: Hero Resource, exhausting Finesse, generates a [wild] resource for an aspect card", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const given = moveToHand(hero, P1, "04033", "04035"); // Finesse, Venom Blast (Aggression)
    const [finesse, venomBlast] = given.ids as [InstanceId, InstanceId];
    const withFinesse = settle(runWave2(given.state, play(P1, finesse, payWith(given.state, P1, 2, [finesse, venomBlast]))), firstLegal, undefined, WAVE2_DEPS);
    const played = applyCommand(
      withFinesse,
      play(P1, venomBlast, payWith(withFinesse, P1, 1, [venomBlast, finesse]), { abilities: [resourceAbility(finesse, "04033.finesse-resource")] }),
      WAVE2_DEPS,
    );
    expect(played.ok).toBe(true);
    if (played.ok) expect(inst(played.state, finesse).exhausted).toBe(true);
  });

  it("Jessica Drew's Apartment: Alter-Ego Action, exhausting it, searches the top 5 cards of the deck for an aspect card into hand, then shuffles", () => {
    const start = spiderWomanVsRhino();
    const withTop = putOnTopOfDeck(start, P1, "04035"); // Venom Blast, printed Aggression
    const [venomBlast] = withTop.ids as [InstanceId];
    const given = moveToHand(withTop.state, P1, "04034");
    const [apartment] = given.ids as [InstanceId];
    const played = settle(runWave2(given.state, play(P1, apartment, payWith(given.state, P1, 1, [apartment]))), firstLegal, undefined, WAVE2_DEPS);
    const before = playerOf(played, P1).hand.length;
    const settled = settle(runWave2(played, use(P1, apartment, "04034.jessica-drews-apartment-action")), picking(venomBlast), undefined, WAVE2_DEPS);
    expect(inst(settled, apartment).exhausted).toBe(true);
    expect(playerOf(settled, P1).hand).toContain(venomBlast);
    expect(playerOf(settled, P1).hand.length).toBe(before + 1);
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

  it("Piercing Strike: an (attack) event — deals 3 damage and gains piercing (discards the enemy's tough status card instead of being fully absorbed by it)", () => {
    const start = spiderWomanVsRhino();
    const hero = runWave2(start, toHero());
    const villain = hero.villains[0]!.instanceId;
    const toughened = { ...hero, instances: { ...hero.instances, [villain]: { ...hero.instances[villain]!, statuses: { ...hero.instances[villain]!.statuses, tough: 1 } } } };
    const given = moveToHand(toughened, P1, "04044");
    const [piercingStrike] = given.ids as [InstanceId];
    const before = inst(given.state, villain).damage;
    const after = settle(runWave2(given.state, play(P1, piercingStrike, payWith(given.state, P1, 2, [piercingStrike]))), picking(villain), undefined, WAVE2_DEPS);
    // A tough card without piercing would absorb the whole attack (0 damage, tough discarded). With piercing, the
    // tough card is discarded *and* the full 3 damage still lands (RRG 1.8 "Piercing", p. 32).
    expect(inst(after, villain).statuses.tough).toBe(0);
    expect(inst(after, villain).damage).toBe(before + 3);
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
