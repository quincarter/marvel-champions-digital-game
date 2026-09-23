import { activeVillain, hasKeyword, restrictedLimitFor, type GameState, type InstanceId } from "@mc/engine";
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
  payWith,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  settleUntil,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { traceAbilities } from "../../testing/trace.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";
import { venomScenario } from "./support.js";

/** Real wave 3 content: Venom (a hand-built stand-in deck, `support.ts`) against Rhino (a Core scenario, seated
 * with wave 3 content — `wave3Scenario`'s fallback), standard, solo. Venom starts in alter-ego. */
const venomVsRhino = (seed = 1) => startWave3Game(venomScenario("rhino", { seed }));

/** Accepts the named optional response/interrupt; declines everything else. Mirrors `../gam/gamora-kit.test.ts`. */
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

/** Picks the first offered option whose *label* starts with `prefix` (a `chooseOne`'s own options are indexed,
 * not ability-id-suffixed, so `accepting` can't reach them). Mirrors `../gmw/groot-obligation-nemesis.test.ts`. */
const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Like `accepting`, but also pays a `payForCard` prompt (an interrupt/response event played straight from hand)
 * with whatever hand cards it offers, up to the printed cost. Mirrors `../gam/gamora-kit.test.ts`. */
const acceptingAndPaying =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    return accepting(...wanted)(state);
  };

function playAndAccept(state: GameState, code: string, cost: number, accept?: string | Picker) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const payment = cost > 0 ? payWith(given.state, P1, cost, [id]) : [];
  const pick = accept === undefined ? firstLegal : typeof accept === "string" ? accepting(accept) : accept;
  const played = settle(runWith(WAVE3_DEPS, given.state, play(P1, id, payment)), pick, undefined, WAVE3_DEPS);
  return { state: played, id };
}

describe("Venom's identity (20001a/b)", () => {
  it("Venom: 1 additional restricted upgrade in hero form (20001a.venom-constant)", () => {
    const hero = runWave3(venomVsRhino(), toHero());
    const identity = identityOf(hero);
    expect(restrictedLimitFor(hero, WAVE3_DEPS, P1, [identity, identity, identity])).toBe(3);
  });

  it("Flash Thompson: 1 additional restricted upgrade in alter-ego form too (20001b.flash-thompson-constant)", () => {
    const start = venomVsRhino(); // alter-ego by default
    const identity = identityOf(start);
    expect(restrictedLimitFor(start, WAVE3_DEPS, P1, [identity, identity, identity])).toBe(3);
  });

  it("Symbiotic Bond — Resource: take 1 damage → generate a [wild] resource, spent paying for a hand card (20001a.venom-constant-2)", () => {
    const hero = runWave3(venomVsRhino(2), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20009"); // Spider-Sense, cost 2
    const [spiderSense] = ids as [InstanceId];
    const identity = identityOf(withCard);
    const before = inst(withCard, identity).damage;
    const bond = resourceAbility(identity, "20001a.venom-constant-2");
    const played = runWith(
      WAVE3_DEPS,
      withCard,
      play(P1, spiderSense, payWith(withCard, P1, 1, [spiderSense]), { abilities: [bond] }),
    );
    expect(inst(played, identity).damage).toBe(before + 1);
    expect(instancesOf(played, "20009")).toHaveLength(1);
  });

  it("Armed and Ready — Setup: discard from the top of your deck until a weapon upgrade, then add it to hand (20001b.flash-thompson-constant-2)", () => {
    const start = venomVsRhino(3);
    const hand = playerOf(start, P1).hand;
    const weaponInHand = hand.some((id) => {
      const cardId = start.instances[id]?.cardId as string | undefined;
      return cardId !== undefined && ["20008", "20010", "20015", "20021", "20022"].includes(cardId);
    });
    expect(weaponInHand).toBe(true);
  });
});

describe("Venom's hero kit", () => {
  it("Behind Enemy Lines — (thwart): remove 3 threat from a scheme; paid with only [mental], confuse an enemy (20002.behind-enemy-lines-action)", () => {
    const hero = runWave3(venomVsRhino(4), toHero());
    const { state: withThreat } = { state: patchInstance(hero, hero.mainScheme.instanceId, { threat: 6 }) };
    const { state: withHand, ids } = moveToHand(withThreat, P1, "20002", "20018"); // Behind Enemy Lines + Genius (mental)
    const [behindLines, genius] = ids as [InstanceId, InstanceId];
    const villain = activeVillain(withHand).instanceId;
    const played = settle(
      runWith(WAVE3_DEPS, withHand, play(P1, behindLines, [genius])),
      accepting("20002.behind-enemy-lines-action"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, withHand.mainScheme.instanceId).threat).toBe(3);
    expect((inst(played, villain).statuses.confused ?? 0) > 0).toBe(true);
  });

  it("Grasping Tendrils — cancels the villain's initiated attack; paid with only [physical], stuns the villain (20003.grasping-tendrils-interrupt)", () => {
    const hero = runWave3(venomVsRhino(1), toHero());
    const { state: withHand } = moveToHand(hero, P1, "20003", "20019"); // Grasping Tendrils + Strength (physical)
    const villain = activeVillain(withHand).instanceId;
    const identity = identityOf(withHand);
    const beforeDamage = inst(withHand, identity).damage;
    const settled = settle(
      runWith(WAVE3_DEPS, withHand, endTurn()),
      acceptingAndPaying("20003.grasping-tendrils-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(settled, identity).damage).toBe(beforeDamage); // the attack was cancelled
    expect((inst(settled, villain).statuses.stunned ?? 0) > 0).toBe(true); // paid with only physical
  });

  it("Locked and Loaded — searches your deck for a weapon upgrade and adds it to hand (20004.locked-and-loaded-constant)", () => {
    const hero = runWave3(venomVsRhino(5), toHero());
    const { state } = playAndAccept(hero, "20004", 0);
    const hand = playerOf(state, P1).hand;
    const weaponInHand = hand.some((id) => {
      const cardId = state.instances[id]?.cardId as string | undefined;
      return cardId !== undefined && ["20008", "20010", "20015", "20021", "20022"].includes(cardId);
    });
    expect(weaponInHand).toBe(true);
  });

  it("Run and Gun — readies Venom and each weapon upgrade you control (20005.run-and-gun-action)", () => {
    const hero = runWave3(venomVsRhino(6), toHero());
    const { state: withPistol, ids: pistolIds } = moveToHand(hero, P1, "20022"); // Plasma Pistol
    const [pistol] = pistolIds as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withPistol, play(P1, pistol, payWith(withPistol, P1, 2, [pistol]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const identity = identityOf(played);
    const exhausted = patchInstance(patchInstance(played, identity, { exhausted: true }), pistol, {
      exhausted: true,
    });
    const { state: withRunAndGun, ids: rgIds } = moveToHand(exhausted, P1, "20005");
    const [runAndGunId] = rgIds as [InstanceId];
    const after = settle(
      runWith(WAVE3_DEPS, withRunAndGun, play(P1, runAndGunId, payWith(withRunAndGun, P1, 3, [runAndGunId]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, identity).exhausted).toBe(false);
    expect(inst(after, pistol).exhausted).toBe(false);
  });

  it("Savage Attack — deals 5 damage to an enemy; paid with only [energy], the attack gains overkill (20006.savage-attack-action)", () => {
    const hero = runWave3(venomVsRhino(7), toHero());
    const villain = activeVillain(hero).instanceId;
    const { state: withHand, ids } = moveToHand(hero, P1, "20006", "20017"); // Savage Attack + Energy
    const [savage, energy] = ids as [InstanceId, InstanceId];
    const before = inst(withHand, villain).damage;
    const played = settle(
      runWith(WAVE3_DEPS, withHand, play(P1, savage, [energy])),
      accepting("20006.savage-attack-action"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, villain).damage).toBe(before + 5);
  });

  it("Project Rebirth 2.0 — Alter-Ego Action: exhaust → draw 1 card or heal 3 damage from Flash Thompson (20007.project-rebirth-20-action)", () => {
    const start = venomVsRhino(8); // alter-ego by default
    const identity = identityOf(start);
    const hurt = patchInstance(start, identity, { damage: 5 });
    const { state: withCard, ids } = moveToHand(hurt, P1, "20007");
    const [rebirth] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, rebirth, payWith(withCard, P1, 1, [rebirth]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const used = settle(
      runWith(WAVE3_DEPS, played, use(P1, rebirth, "20007.project-rebirth-20-action")),
      pickingLabelStartingWith("Heal 3 damage"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).damage).toBe(2);
  });

  it("Multi-Gun — Restricted; exhaust → choose one: deal 2 damage to an enemy (20008.multi-gun-action, 20008.multi-gun-constant, 20008.multi-gun-constant-2, 20008.multi-gun-constant-3 are the bulleted-list parser artifact — no behavior of their own)", () => {
    const hero = runWave3(venomVsRhino(9), toHero());
    const villain = activeVillain(hero).instanceId;
    const { state: withCard, ids } = moveToHand(hero, P1, "20008");
    const [multiGun] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, multiGun, payWith(withCard, P1, 3, [multiGun]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const before = inst(played, villain).damage;
    const used = settle(
      runWith(WAVE3_DEPS, played, use(P1, multiGun, "20008.multi-gun-action")),
      pickingLabelStartingWith("Deal 2 damage"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2);
  });

  it("Spider-Sense — Hero Interrupt: draws 1 card when the villain initiates an attack against you (20009.spider-sense-interrupt)", () => {
    const hero = runWave3(venomVsRhino(1), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20009");
    const [spiderSense] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, spiderSense, payWith(withCard, P1, 2, [spiderSense]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const { deps, trace } = traceAbilities(WAVE3_DEPS);
    settle(runWith(deps, played, endTurn()), accepting("20009.spider-sense-interrupt"), undefined, deps);
    expect(trace.resolved()).toContain("20009.spider-sense-interrupt");
  });

  it("Venom's Pistol — Restricted; exhaust when you use one of Venom's basic powers → +1 to that power for this use (20010.venoms-pistol-interrupt)", () => {
    const hero = runWave3(venomVsRhino(2), toHero());
    const { state: withThreat } = { state: patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 }) };
    const { state: withHand, ids } = moveToHand(withThreat, P1, "20010");
    const [pistol] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withHand, play(P1, pistol, payWith(withHand, P1, 1, [pistol]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const identity = identityOf(played);
    const printedThw = 1; // Venom's printed THW (20001a)
    const offered = settleUntil(
      runWith(WAVE3_DEPS, played, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: played.mainScheme.instanceId,
      }),
      "chooseTriggers",
      firstLegal,
      WAVE3_DEPS,
    );
    const before = inst(withHand, played.mainScheme.instanceId).threat;
    const settled = settle(offered, accepting("20010.venoms-pistol-interrupt"), undefined, WAVE3_DEPS);
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBe(Math.max(0, before - (printedThw + 1)));
  });

  it("Jack Flag — Response: after Jack Flag thwarts, place 1 ammo counter; Hero Action: exhaust and spend it to deal 2 damage (20011.jack-flag-response, 20011.jack-flag-action)", () => {
    const hero = runWave3(venomVsRhino(3), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20011");
    const [jackFlag] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, jackFlag, payWith(withCard, P1, 4, [jackFlag]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const withThreat = patchInstance(played, played.mainScheme.instanceId, { threat: 10 });
    const thwarted = settle(
      runWith(WAVE3_DEPS, withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: jackFlag,
        schemeInstanceId: withThreat.mainScheme.instanceId,
      }),
      accepting("20011.jack-flag-response"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(thwarted, jackFlag).counters.ammo).toBe(1);
    const villain = activeVillain(thwarted).instanceId;
    const before = inst(thwarted, villain).damage;
    const readied = patchInstance(thwarted, jackFlag, { exhausted: false });
    const used = settle(
      runWith(WAVE3_DEPS, readied, use(P1, jackFlag, "20011.jack-flag-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 2);
    expect(inst(used, jackFlag).counters.ammo ?? 0).toBe(0);
  });

  it("Scare Tactic — deals 3 damage to a confused enemy (20012.scare-tactic-action)", () => {
    const hero = runWave3(venomVsRhino(4), toHero());
    const villain = activeVillain(hero).instanceId;
    const confused = patchInstance(hero, villain, { statuses: { ...inst(hero, villain).statuses, confused: 1 } });
    const { state: withHand, ids } = moveToHand(confused, P1, "20012");
    const [scare] = ids as [InstanceId];
    const before = inst(withHand, villain).damage;
    const played = settle(
      runWith(WAVE3_DEPS, withHand, play(P1, scare, payWith(withHand, P1, 1, [scare]))),
      accepting("20012.scare-tactic-action"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, villain).damage).toBe(before + 3);
  });

  it("Making an Entrance — a basic thwart gets +2 THW; after it clears a scheme's threat, heal 2 damage from your hero (20013.making-an-entrance-interrupt)", () => {
    const hero = runWave3(venomVsRhino(5), toHero());
    const identity = identityOf(hero);
    const printedThw = 1; // Venom's printed THW
    const hurt = patchInstance(hero, identity, { damage: 4 });
    const withThreat = patchInstance(hurt, hurt.mainScheme.instanceId, { threat: printedThw + 2 }); // exactly cleared
    const { state: withHand, ids } = moveToHand(withThreat, P1, "20013");
    const [entrance] = ids as [InstanceId];
    const settled = settle(
      runWith(WAVE3_DEPS, withHand, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: withHand.mainScheme.instanceId,
      }),
      acceptingAndPaying("20013.making-an-entrance-interrupt"),
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(settled, P1).discard).toContain(entrance); // played as the interrupt
    expect(inst(settled, settled.mainScheme.instanceId).threat).toBe(0);
    expect(inst(settled, identity).damage).toBe(2); // 4 - 2 healed
  });

  it("Sonic Rifle — Restricted, Uses (2 charge counters); exhaust + spend a counter → confuse an enemy, or deal 3 damage if already confused (20015.sonic-rifle-action)", () => {
    const hero = runWave3(venomVsRhino(6), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20015");
    const [rifle] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, rifle, payWith(withCard, P1, 3, [rifle]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, rifle).counters.charge).toBe(2);
    const villain = activeVillain(played).instanceId;
    const used = settle(
      runWith(WAVE3_DEPS, played, use(P1, rifle, "20015.sonic-rifle-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect((inst(used, villain).statuses.confused ?? 0) > 0).toBe(true);
    expect(inst(used, rifle).counters.charge).toBe(1);
  });

  it("Star-Lord — [star] attacks gain ranged; Forced Response: entering play under your control deals a facedown encounter card (20016.star-lord-constant, 20016.star-lord-forced-response)", () => {
    const hero = runWave3(venomVsRhino(7), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20016");
    const [starLord] = ids as [InstanceId];
    const before = playerOf(withCard, P1).dealtEncounter.length;
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, starLord, payWith(withCard, P1, 2, [starLord]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(playerOf(played, P1).dealtEncounter.length).toBe(before + 1);
    expect(hasKeyword(played, starLord, "ranged", WAVE3_DEPS)).toBe(true);
  });

  it("Side Holster — 1 additional restricted [Weapon] upgrade in play under its controller (20021.side-holster-constant)", () => {
    const hero = runWave3(venomVsRhino(8), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20021", "20022"); // Side Holster, Plasma Pistol (Weapon)
    const [holster, pistol] = ids as [InstanceId, InstanceId];
    const played = settle(runWith(WAVE3_DEPS, withCard, play(P1, holster, [])), firstLegal, undefined, WAVE3_DEPS);
    // A base restricted limit of 2, +1 from Venom's own identity (any restricted card), +1 from Side Holster
    // scoped to *weapon* upgrades only — held here is a real weapon-upgrade instance, not a stand-in, so the
    // `cards`-scoped rule actually counts it.
    expect(restrictedLimitFor(played, WAVE3_DEPS, P1, [pistol, pistol, pistol, pistol])).toBe(4);
  });

  it("Plasma Pistol — Restricted, Uses (3 charge counters); exhaust + spend a counter → deal 1 damage to an enemy (20022.plasma-pistol-action)", () => {
    const hero = runWave3(venomVsRhino(9), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20022");
    const [pistol] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, pistol, payWith(withCard, P1, 2, [pistol]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const villain = activeVillain(played).instanceId;
    const before = inst(played, villain).damage;
    const used = settle(
      runWith(WAVE3_DEPS, played, use(P1, pistol, "20022.plasma-pistol-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, villain).damage).toBe(before + 1);
    expect(inst(used, pistol).counters.charge).toBe(2);
  });

  it("Fusillade — exhaust a weapon upgrade you control → deal 5 damage to an enemy (20026.fusillade-action)", () => {
    const hero = runWave3(venomVsRhino(1), toHero());
    const { state: withGun, ids: gunIds } = moveToHand(hero, P1, "20022"); // Plasma Pistol
    const [pistol] = gunIds as [InstanceId];
    const withGunInPlay = settle(
      runWith(WAVE3_DEPS, withGun, play(P1, pistol, payWith(withGun, P1, 2, [pistol]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const { state: withCard, ids } = moveToHand(withGunInPlay, P1, "20026");
    const [fusillade] = ids as [InstanceId];
    const villain = activeVillain(withCard).instanceId;
    const before = inst(withCard, villain).damage;
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, fusillade, payWith(withCard, P1, 2, [fusillade]))),
      accepting("20026.fusillade-action"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(played, villain).damage).toBe(before + 5);
    expect(inst(played, pistol).exhausted).toBe(true);
  });

  it('"Welcome Aboard" — reduces the resource cost of the next ally played this phase by 2 (20027.welcome-aboard-action)', () => {
    const hero = runWave3(venomVsRhino(2), toHero());
    const { state: withCard, ids } = moveToHand(hero, P1, "20027");
    const [aboard] = ids as [InstanceId];
    const played = settle(runWith(WAVE3_DEPS, withCard, play(P1, aboard, [])), firstLegal, undefined, WAVE3_DEPS);
    const { state: withAlly, ids: allyIds } = moveToHand(played, P1, "20011"); // Jack Flag, cost 4
    const [jackFlag] = allyIds as [InstanceId];
    // Cost reduced by 2 (4 → 2): paying with only 2 other cards must succeed.
    const result = settle(
      runWith(WAVE3_DEPS, withAlly, play(P1, jackFlag, payWith(withAlly, P1, 2, [jackFlag]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(instancesOf(result, "20011")).toHaveLength(1);
  });

  it("Shake it Off — after a guardian character takes damage from an attack, give it a tough status card (20028.shake-it-off-response)", () => {
    // Seed 1: Rhino attacks (rather than schemes) on the villain phase this test reaches (the same seed
    // `../wave2/trors/hawkeye.test.ts`'s own Mockingbird test relies on for the identical reason).
    const hero = runWave3(venomVsRhino(1), toHero()); // Venom prints the Guardian trait
    const identity = identityOf(hero);
    const { state: withCard } = moveToHand(hero, P1, "20028");
    const reached = settle(
      runWith(WAVE3_DEPS, withCard, endTurn()),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE3_DEPS,
    );
    // No defense: Rhino's full ATK lands on the identity, so "takes any amount of damage from an attack" is true.
    const offered = answer(reached, ["decline"], WAVE3_DEPS);
    // Stops the instant the tough card lands — left to run to full stillness, the villain phase continues past
    // this attack into its own next reveal, which can deal further damage and immediately spend the fresh tough
    // card again (RRG 1.8 "Tough", p. 44), which would look like the response never fired.
    const settled = settle(
      offered,
      acceptingAndPaying("20028.shake-it-off-response"),
      (s) => (inst(s, identity).statuses.tough ?? 0) > 0,
      WAVE3_DEPS,
    );
    expect(inst(settled, identity).damage).toBeGreaterThan(0);
    expect(inst(settled, identity).statuses.tough ?? 0).toBeGreaterThan(0);
  });

  it("Crew Quarters — Alter-Ego Action: exhaust → heal 1 damage from an alter-ego (20029.crew-quarters-action)", () => {
    const start = venomVsRhino(4); // alter-ego by default
    const identity = identityOf(start);
    const hurt = patchInstance(start, identity, { damage: 3 });
    const { state: withCard, ids } = moveToHand(hurt, P1, "20029");
    const [quarters] = ids as [InstanceId];
    const played = settle(
      runWith(WAVE3_DEPS, withCard, play(P1, quarters, payWith(withCard, P1, 1, [quarters]))),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    const used = settle(
      runWith(WAVE3_DEPS, played, use(P1, quarters, "20029.crew-quarters-action")),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(used, identity).damage).toBe(2);
  });
});
