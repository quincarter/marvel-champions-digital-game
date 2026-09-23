import { cardsInPlay, excessDamageBonus, maxHitPoints, traitsOf, type GameState, type InstanceId } from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { playFromHand, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

// Real wave 3 content: the Rocket Raccoon (Aggression) precon against Rhino (a Core scenario, seated with wave 3
// content — `wave3Scenario`'s fallback), standard, solo. Rocket starts in alter-ego.
const rocketVsRhino = () =>
  startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "rocket-raccoon-aggression" }], seed: 2026 }));

/** Accepts the named optional response/interrupt; declines everything else. */
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

/** Adds a real minion (Hydra Mercenary, 01101 — a minion in Rhino's own set) engaged with P1, by state surgery,
 * the same convention `groot-kit.test.ts`'s own Rocket Raccoon interrupt test uses (an engaged enemy's `home` is
 * the engaged player's `playArea`, not `villainArea` — `resolve/defeat.ts`'s ally/minion defeat sweep scans
 * exactly `player.playArea`). */
function withEngagedMinion(state: GameState, damage = 0): { readonly state: GameState; readonly id: InstanceId } {
  const minion = `minion-${Object.keys(state.instances).length}` as InstanceId;
  const withMinion: GameState = {
    ...state,
    players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
    instances: {
      ...state.instances,
      [minion]: {
        instanceId: minion,
        cardId: "01101" as never,
        ownerId: null,
        controllerId: null,
        home: { kind: "playArea", playerId: P1 },
        faceup: true,
        exhausted: false,
        damage,
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
  return { state: withMinion, id: minion };
}

describe("Rocket Raccoon kit", () => {
  it('"Murdered You!": Response, after you deal excess damage to an enemy, draw 1 card', () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const identity = identityOf(hero);
    // Hydra Mercenary has 3 printed hit points; 1 damage already present plus Rocket's own printed 1 ATK deals
    // exactly the 1 excess this card needs (2 - (3 - 1) = 0? use a lower hp minion instead: damage it to 2, so 1
    // remaining, and Rocket's 1 ATK is exactly lethal with 0 excess) — prime to leave exactly 0 remaining hit
    // points before the attack, so any positive ATK is entirely excess.
    const { state: withMinion, id: minion } = withEngagedMinion(hero, 3); // 0 remaining: fully excess already
    const handBefore = playerOf(withMinion, P1).hand.length;
    const attacked = settle(
      runWave3(withMinion, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: minion,
      }),
      accepting("16029a.murdered-you"),
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(attacked, P1).hand.length).toBe(handBefore + 1);
  });

  it("Tinkering: Alter-Ego Action, discard a tech upgrade you control to draw 2 cards (limit once per round)", () => {
    const { state: withBattery } = playFromHand(rocketVsRhino(), "16034", 1); // Battery Pack, a [TECH] upgrade
    const identity = identityOf(withBattery);
    const battery = instancesOf(withBattery, "16034").find((id) => cardsInPlay(withBattery).includes(id))!;
    const handBefore = playerOf(withBattery, P1).hand.length;
    const used = settle(
      runWave3(withBattery, use(P1, identity, "16029b.tinkering")),
      accepting(":") /* the single chooseTarget candidate is auto-picked by firstLegal */,
      undefined,
      WAVE3_DEPS,
    );
    expect(cardsInPlay(used)).not.toContain(battery);
    // Battery Pack was discarded from play, not from hand: the discard is not a hand card leaving, only the 2
    // drawn cards change the hand's size.
    expect(playerOf(used, P1).hand.length).toBe(handBefore + 2);
  });

  it("I've Got a Plan: Hero Response, after a basic thwart (using THW), ready Rocket Raccoon and +1 THW until end of phase", () => {
    // A reactive-only printed Response event is played from hand at the moment its trigger condition is met
    // (`../scw/pack-cards.test.ts`'s own "Turn the Tide" test), not proactively via `playFromHand`. It still
    // costs its printed 1 resource to play, so the picker also has to pay for it once offered.
    const given = moveToHand(runWave3(rocketVsRhino(), toHero()), P1, "16030");
    const identity = identityOf(given.state);
    const withThreat = patchInstance(given.state, given.state.mainScheme.instanceId, { threat: 10 });
    const before = withThreat.mainScheme.instanceId;
    const acceptAndPay: Picker = (state) => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      if (choice.prompt.kind === "payForCard") return [choice.options[0]!.optionId];
      return accepting("16030.ive-got-a-plan-response")(state);
    };
    const firstThwart = settle(
      runWave3(withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: withThreat.mainScheme.instanceId,
      }),
      acceptAndPay,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(firstThwart, identity).exhausted).toBe(false); // readied by its own Response
    const threatAfterFirst = inst(firstThwart, before).threat;
    // A second basic thwart this same phase reads Rocket's printed THW (2) plus the +1 this Response granted.
    const secondThwart = runWave3(firstThwart, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: withThreat.mainScheme.instanceId,
    });
    expect(threatAfterFirst - inst(secondThwart, before).threat).toBe(3);
  });

  it("Reload: Hero Action, readies each tech upgrade you control (16031.reload-action)", () => {
    // Reload is a played event (Hero Action), not an in-play ability — put Battery Pack into play first, exhaust
    // it, then play Reload from hand.
    const { state: withBattery } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16034", 1);
    const battery = instancesOf(withBattery, "16034").find((id) => cardsInPlay(withBattery).includes(id))!;
    const exhausted = patchInstance(withBattery, battery, { exhausted: true });
    const { state: used } = playFromHand(exhausted, "16031", 1);
    expect(inst(used, battery).exhausted).toBe(false);
  });

  it("Battery Pack: enters play with 2 charge counters; Action moves one to another tech upgrade you control (16034.battery-pack-constant)", () => {
    const { state: withBattery } = playFromHand(rocketVsRhino(), "16034", 1);
    const battery = instancesOf(withBattery, "16034").find((id) => cardsInPlay(withBattery).includes(id))!;
    expect(inst(withBattery, battery).counters.charge).toBe(2);

    const { state: withBoth, id: pistol } = playFromHand(withBattery, "16038", 1); // Rocket's Pistol, another [TECH] upgrade
    const used = settle(
      runWave3(withBoth, use(P1, battery, "16034.battery-pack-action")),
      firstLegal, // the only legal "another tech upgrade" candidate is the pistol
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, battery).counters.charge).toBe(1);
    expect(inst(used, pistol).counters.charge).toBe(4); // 3 printed + 1 moved
    expect(inst(used, battery).exhausted).toBe(true);
  });

  it("Cybernetic Skeleton: you get +3 hit points; Rocket Raccoon gets +1 ATK while in hero form (16035.cybernetic-skeleton-constant, 16035.cybernetic-skeleton-constant-2)", () => {
    const { state: withSkeleton } = playFromHand(rocketVsRhino(), "16035", 2);
    const identity = identityOf(withSkeleton);
    const alterEgoMax = maxHitPoints(withSkeleton, identity, WAVE3_DEPS);
    expect(alterEgoMax).toBe(9 + 3); // Rocket Raccoon's printed 9 hit points, +3
    const hero = runWave3(withSkeleton, toHero());
    const villain = hero.villains[0]!.instanceId;
    const before = inst(hero, villain).damage;
    const attacked = runWave3(hero, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: villain,
    });
    expect(inst(attacked, villain).damage).toBe(before + 2); // printed ATK 1, +1 from Cybernetic Skeleton
  });

  it("Particle Cannon: enters play with 2 charge counters; Action exhausts and removes 1 to deal 4 overkill ranged damage (16036.particle-cannon-constant)", () => {
    const { state: withCannon, id: cannon } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16036", 3);
    expect(inst(withCannon, cannon).counters.charge).toBe(2);
    const villain = withCannon.villains[0]!.instanceId;
    const before = inst(withCannon, villain).damage;
    const used = settle(
      runWave3(withCannon, use(P1, cannon, "16036.particle-cannon-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 4);
    expect(inst(used, cannon).counters.charge).toBe(1);
    expect(inst(used, cannon).exhausted).toBe(true);
  });

  it("Rocket Launcher: enters play with 2 charge counters; Action deals 2 damage to the villain and each minion engaged with the chosen player (16037.rocket-launcher-constant)", () => {
    const { state: withLauncher, id: launcher } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16037", 3);
    expect(inst(withLauncher, launcher).counters.charge).toBe(2);
    const { state: withMinion, id: minion } = withEngagedMinion(withLauncher);
    const villain = withMinion.villains[0]!.instanceId;
    const villainBefore = inst(withMinion, villain).damage;
    const used = settle(
      runWave3(withMinion, use(P1, launcher, "16037.rocket-launcher-action")),
      firstLegal, // only P1 to choose
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(villainBefore + 2);
    expect(inst(used, minion).damage).toBe(2);
    expect(inst(used, launcher).counters.charge).toBe(1);
  });

  it("Rocket's Pistol: enters play with 3 charge counters; Action exhausts and removes 1 to deal 2 damage to an enemy (16038.rockets-pistol-constant)", () => {
    const { state: withPistol, id: pistol } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16038", 1);
    expect(inst(withPistol, pistol).counters.charge).toBe(3);
    const villain = withPistol.villains[0]!.instanceId;
    const before = inst(withPistol, villain).damage;
    const used = settle(
      runWave3(withPistol, use(P1, pistol, "16038.rockets-pistol-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2);
    expect(inst(used, pistol).counters.charge).toBe(2);
  });

  it("Thruster Boots: while in hero form, Rocket Raccoon gets +1 THW and gains the aerial trait (16039.thruster-boots-constant)", () => {
    const { state: withBoots } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16039", 1);
    const identity = identityOf(withBoots);
    expect(traitsOf(withBoots, identity, WAVE3_DEPS)).toContain("AERIAL");
    const withThreat = patchInstance(withBoots, withBoots.mainScheme.instanceId, { threat: 10 });
    const before = inst(withThreat, withThreat.mainScheme.instanceId).threat;
    const thwarted = runWave3(withThreat, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identity,
      schemeInstanceId: withThreat.mainScheme.instanceId,
    });
    expect(before - inst(thwarted, withThreat.mainScheme.instanceId).threat).toBe(3); // printed THW 2, +1
  });

  it("Bug: Hero Response, after your hero makes a basic attack, heal 1 damage from Bug", () => {
    const { state: withBug, id: bug } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16040", 2);
    const identity = identityOf(withBug);
    const damaged = patchInstance(withBug, bug, { damage: 1 });
    const villain = damaged.villains[0]!.instanceId;
    const attacked = settle(
      runWave3(damaged, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
      accepting("16040.bug-response"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, bug).damage).toBe(0);
  });

  it("Looking for Trouble: Hero Action (thwart), discards from the encounter deck until a minion, puts it into play engaged with you, then removes 3 threat (16043.looking-for-trouble-action)", () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
    const stacked = stackEncounterDeck(withThreat, "01186", "01186", "01101"); // 2 fillers, then a real minion
    const before = inst(stacked, stacked.mainScheme.instanceId).threat;
    const { state } = playFromHand(stacked, "16043", 0);
    expect(before - inst(state, state.mainScheme.instanceId).threat).toBe(3);
    const minion = instancesOf(state, "01101").find((id) => cardsInPlay(state).includes(id));
    expect(minion).toBeDefined();
    expect(inst(state, minion!).engagedWith).toBe(P1);
  });

  it("Follow Through: constant, your hero's attacks deal 1 more excess damage than they otherwise would (16045.follow-through-interrupt)", () => {
    const { state: withCard } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16045", 2);
    const identity = identityOf(withCard);
    expect(excessDamageBonus(withCard, WAVE3_DEPS, identity)).toBe(1);
  });

  it("Hand Cannon: Hero Interrupt, when your hero makes a basic attack, exhaust and remove 1 charge counter for +2 ATK and overkill", () => {
    const { state: withCannon, id: cannon } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16046", 2);
    const identity = identityOf(withCannon);
    // Hand Cannon's Uses keyword (data) enters play with 3 charge counters.
    const villain = withCannon.villains[0]!.instanceId;
    const before = inst(withCannon, villain).damage;
    const attacked = settle(
      runWave3(withCannon, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("16046.hand-cannon-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(attacked, villain).damage).toBe(before + 1 + 2); // printed ATK 1, +2 from Hand Cannon
    expect(inst(attacked, cannon).exhausted).toBe(true);
  });

  it("Groot (ally): Response, after Groot defends against an attack, heal 2 damage from him", () => {
    const { state: withGroot, id: groot } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16047", 3);
    const damaged = patchInstance(withGroot, groot, { damage: 2 });
    const stacked = stackEncounterDeck(damaged, "01186");
    const reached = settle(
      runWave3(stacked, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE3_DEPS,
    );
    const offered = answer(reached, [groot], WAVE3_DEPS);
    // The attack itself (including Rhino's own boost draw) has already resolved by the time the deferred
    // "defended" Response is offered — read Groot's damage right here, before the heal, rather than assuming a
    // fixed combat outcome.
    const damageAfterAttack = inst(offered, groot).damage;
    const after = settle(offered, accepting("16047.groot-response"), undefined, WAVE3_DEPS);
    expect(inst(after, groot).damage).toBe(Math.max(0, damageAfterAttack - 2));
    expect(inst(after, groot).damage).toBeLessThan(damageAfterAttack); // the heal genuinely did something
  });

  it("Schadenfreude: heals 2 damage from Rocket Raccoon for each separate instance of damage dealt to an enemy this turn (16032.schadenfreude-action)", () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 6 });
    // Rocket's Pistol (16038, a separate card whose own ability exhausts only itself) supplies a first damage
    // instance without exhausting Rocket's own identity, so a second instance — a basic attack — can follow in
    // the same turn.
    const { state: withPistol, id: pistol } = playFromHand(damaged, "16038", 1);
    const { state: withSchaden } = playFromHand(withPistol, "16032", 2);
    const villain = withSchaden.villains[0]!.instanceId;

    const afterPistol = settle(
      runWave3(withSchaden, use(P1, pistol, "16038.rockets-pistol-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(afterPistol, identity).damage).toBe(6 - 2); // one healed instance

    const attacked = runWave3(afterPistol, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: villain,
    });
    expect(inst(attacked, identity).damage).toBe(6 - 2 - 2); // a second healed instance, same turn
  });

  it("Schadenfreude: stops healing once the turn ends (16032.schadenfreude-action)", () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 6 });
    const { state: withSchaden } = playFromHand(damaged, "16032", 2);
    const villain = withSchaden.villains[0]!.instanceId;
    const attacked = runWave3(withSchaden, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: villain,
    });
    expect(inst(attacked, identity).damage).toBe(6 - 2); // healed once, still this turn

    // Past the end of the turn (and the villain phase's own activity), a fresh damage instance heals nothing —
    // Schadenfreude's own standing ability already expired. Form carries over between rounds (no auto-reset), so
    // Rocket is already back in hero form once the next hero phase starts; no further `toHero()` is needed here.
    const nextRound = settle(runWave3(attacked, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const stillIdentity = identityOf(nextRound);
    const before = inst(nextRound, stillIdentity).damage;
    const secondTurnAttack = runWave3(nextRound, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: stillIdentity,
      targetInstanceId: villain,
    });
    expect(inst(secondTurnAttack, stillIdentity).damage).toBe(before);
  });

  it("Schadenfreude: still heals when the enemy's tough status card absorbs the entire hit (16032.schadenfreude-action, RRG 1.8 'Prevent')", () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const identity = identityOf(hero);
    const damaged = patchInstance(hero, identity, { damage: 4 });
    const { state: withSchaden } = playFromHand(damaged, "16032", 2);
    const villain = withSchaden.villains[0]!.instanceId;
    const toughVillain = patchInstance(withSchaden, villain, {
      statuses: { ...inst(withSchaden, villain).statuses, tough: 1 },
    });
    const villainDamageBefore = inst(toughVillain, villain).damage;
    const attacked = runWave3(toughVillain, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identity,
      targetInstanceId: villain,
    });
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore); // tough absorbed the whole hit
    expect(inst(attacked, villain).statuses.tough).toBe(0); // the tough status card is spent, proving it fired
    expect(inst(attacked, identity).damage).toBe(4 - 2); // Rocket still healed: damage was "dealt", not "taken"
  });

  it("Salvage: after you spend this card, puts a tech upgrade from your discard pile on top of your deck (16033.salvage-response)", () => {
    const hero = runWave3(rocketVsRhino(), toHero());
    const { state: withDiscard, id: batteryPack } = moveToDiscard(hero, P1, "16034"); // Battery Pack, a [TECH] upgrade
    const given = moveToHand(withDiscard, P1, "16033", "16031"); // Salvage, Reload (cost 1, an energy icon)
    const [salvage, reload] = given.ids as [InstanceId, InstanceId];
    // Salvage produces a wild resource icon, which can pay Reload's printed energy cost on its own.
    const played = settle(
      runWave3(given.state, play(P1, reload, [salvage])),
      accepting("16033.salvage-response"),
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(played, P1).discard).toContain(salvage); // spent as a resource, in the discard pile
    expect(playerOf(played, P1).deck[0]).toBe(batteryPack);
  });

  it("Booster Boots: exhausts and discards the top card of your deck to prevent 1 of an attack's damage (16052.booster-boots-interrupt)", () => {
    const { state: withBoots, id: boots } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16052", 1);
    const identity = identityOf(withBoots);
    const damaged = patchInstance(withBoots, identity, { damage: 0 });
    const topOfDeck = playerOf(damaged, P1).deck[0];
    // Both branches run the same, otherwise-deterministic villain phase from the identical starting state (the
    // encounter deck's own order, and so the villain's boost draw, is unaffected by which choice is made here) —
    // undefended, so the only difference between accepting and declining Booster Boots is its own 1 damage
    // prevented, whatever Rhino's boosted ATK for this particular reveal turns out to be.
    const prevented = settle(
      runWave3(damaged, endTurn()),
      accepting("16052.booster-boots-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    const declined = settle(runWave3(damaged, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(declined, identity).damage - inst(prevented, identity).damage).toBe(1);
    expect(inst(prevented, boots).exhausted).toBe(true);
    expect(playerOf(prevented, P1).discard).toContain(topOfDeck);
  });

  it("Booster Boots: a deck the cost empties still pays, resetting it at once from the discard pile (16052.booster-boots-interrupt)", () => {
    const { state: withBoots, id: boots } = playFromHand(runWave3(rocketVsRhino(), toHero()), "16052", 1);
    const identity = identityOf(withBoots);
    const damaged = patchInstance(withBoots, identity, { damage: 0 });
    const owner = damaged.players.find((p) => p.playerId === P1)!;
    const [onlyCard, ...rest] = owner.deck;
    // Thin the deck to its very last card, with the rest in the discard pile — paying the cost discards that
    // last card, empties the deck, and the engine resets it at once (ruling, Apr 30, 2026 (3) answer 7; the
    // reset's own facedown-encounter-card side effect is already covered in isolation by the engine's own
    // `deck-discard-cost.test.ts`).
    const thinned: GameState = {
      ...damaged,
      players: damaged.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [onlyCard!], discard: [...p.discard, ...rest] } : p,
      ),
    };
    const prevented = settle(
      runWave3(thinned, endTurn()),
      accepting("16052.booster-boots-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    const declined = settle(runWave3(thinned, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(declined, identity).damage - inst(prevented, identity).damage).toBe(1); // still prevented 1
    expect(inst(prevented, boots).exhausted).toBe(true);
    expect(playerOf(prevented, P1).deck.length).toBeGreaterThan(0); // reshuffled from the discard pile
    expect(playerOf(prevented, P1).discard).not.toContain(onlyCard); // the discarded card was folded into the reset
  });
});
