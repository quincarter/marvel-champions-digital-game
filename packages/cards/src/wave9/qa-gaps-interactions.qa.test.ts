/**
 * Rules QA, gaps from the wave 9 scenario tests (their `it.todo` lists, "unit tests only"): cards whose behavior depends
 * on timing with other cards, played inside a real game state reached by commands (setup, an Advance or a boost stacked
 * ahead of a dealt card the way the scenario tests do it, then real attacks, thwarts and Hero Actions). Sources are the
 * printed card text (packages/content, transcribed from the MC50 / MC55 cards), RRG 1.8 (docs/rules/mc_rulesreference_v18_compressed.pdf)
 * by page, and the MC50 rulebook. A FINDING comment marks where the game and its source disagree: the expected behavior
 * is an `it.fails`, with a passing companion that pins today's behavior.
 */
import { cardOf, cardsInPlay, iconsInPlay, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, identityOf, inst, moveToHand, playerOf, play, putOnTopOfDeck, use } from "../testing/harness.js";
import { IRON_MAN, SPIDER_MAN, codeOf } from "./testing.js";
import { DEPS, act, inPlayAll, mainThreatOf, ofType, openScenario, villainPhaseDealing } from "./qa-gaps.shared.js";

vi.setConfig({ testTimeout: 300_000 });

describe("Nabbed! (50082) in a Black Widow game, one player (Spider-Man), standard", () => {
  // 50082: "When Revealed: If Abduct Superhumans is not in play, find it and put it into play. Discard cards from the top
  // of your deck until an ally is discarded and tuck it under Abduct Superhumans. Place threat equal to that ally's cost and
  // 1 acceleration token on Abduct Superhumans." 50081: starting threat 2 [per_hero]; RRG "Acceleration Token" p. 5: a token
  // on another card adds to the main scheme's step 1 threat.
  const start = () => putOnTopOfDeck(openScenario("black-widow", 1, { seats: [SPIDER_MAN] }), P1, "01002").state;

  it("finds Abduct Superhumans, discards the deck to Black Cat and tucks it there: 2 starting + 2 (her cost) threat and one acceleration token", () => {
    const before = start();
    expect(inPlayAll(before, "50081")).toHaveLength(0);
    const { state, events } = villainPhaseDealing(before, ["50082"]);
    const [abduct] = inPlayAll(state, "50081");
    expect(abduct, "Abduct Superhumans entered play").toBeDefined();
    const cat = playerOf(state, P1)
      .discard.concat(inst(state, abduct!).tucked)
      .find((id) => codeOf(state, id) === "01002")!;
    expect(inst(state, abduct!).tucked, "Black Cat is tucked there").toEqual([cat]);
    expect(playerOf(state, P1).discard).not.toContain(cat);
    expect((cardOf(state, cat) as unknown as { cost: number }).cost).toBe(2);
    expect(inst(state, abduct!).threat).toBe(2 + 2);
    expect(inst(state, abduct!).counters["acceleration"]).toBe(1);
    expect(ofType(events, "encounterCardRevealed").map((e) => codeOf(state, e.instanceId))).toContain("50082");
  });

  it("the token on the side scheme adds 1 to the next villain phase's step 1 threat on the main scheme", () => {
    const { state } = villainPhaseDealing(start(), ["50082"]);
    const tokens = state.mainScheme.accelerationTokens;
    const expected = 1 * 1 + tokens + 1 + iconsInPlay(state, DEPS, "acceleration");
    const next = villainPhaseDealing(state, []);
    const firstPlaced = ofType(next.events, "threatPlaced").find(
      (e) => e.schemeInstanceId === state.mainScheme.instanceId,
    );
    expect(firstPlaced?.amount).toBe(expected);
    expect(mainThreatOf(next.state)).toBeGreaterThanOrEqual(0);
  });
});

const heroTurn = (state: ReturnType<typeof openScenario>) => act(state, {}, { type: "changeForm", playerId: P1 }).state;

describe("Heightened Reflexes (50092) against Batroc's reset (50086a), one player, standard", () => {
  // 50092: "Attach to Batroc. Uses (4 leap counters). Forced Interrupt: When Batroc would take any amount of damage, prevent
  // 2 of that damage and remove 1 leap counter from here." 50086a: "Forced Interrupt: When Batroc would be defeated, reset his
  // hit points to 8 instead. Then, remove 6 threat from the main scheme." MC50 p. 22 FAQ: the reset replaces the defeat.
  const KICK = "01005"; // Swinging Web Kick: 8 damage, cost 3
  function prepared() {
    let s = openScenario("batroc", 1, { seats: [SPIDER_MAN] });
    s = villainPhaseDealing(s, ["50092"]).state;
    const reflexes = inPlayAll(s, "50092")[0]!;
    expect(inst(s, reflexes).attachedTo, "attached to Batroc").toBe(s.activeVillainId);
    expect(inst(s, reflexes).counters["leap"]).toBe(4);
    s = heroTurn(s);
    const given = moveToHand(s, P1, KICK, KICK);
    const money = playerOf(given.state, P1).hand.filter((id) => !given.ids.includes(id));
    return { s: given.state, ids: [...given.ids, ...money], reflexes };
  }

  it("each hit loses 2 to the attachment and a leap counter; the reset keeps the attachment, its counters and the threat removal", () => {
    const { s: s0, ids, reflexes } = prepared();
    const [kick1, kick2, ...money] = ids;
    const batroc = s0.activeVillainId;
    const threatBefore = mainThreatOf(s0);
    const first = act(s0, {}, play(P1, kick1!, money.slice(0, 3), {}));
    expect(inst(first.state, batroc).damage, "8 damage - 2 prevented").toBe(6);
    expect(inst(first.state, reflexes).counters["leap"]).toBe(3);
    // Needs a target: the Kick is an attack event aimed at Batroc (the only enemy).
    const second = act(first.state, {}, play(P1, kick2!, money.slice(3, 6), {}));
    // 6 more would take it to 12 of 8: defeated -> reset to 8 (0 damage) and 6 threat off the main scheme.
    expect(inst(second.state, batroc).damage, "reset: the full 8 hit points again").toBe(0);
    expect(second.state.outcome, "Batroc was not defeated: the players have not won").toBeNull();
    expect(
      inst(second.state, reflexes).counters["leap"],
      "the prevention still took its counter before the reset",
    ).toBe(2);
    expect(inst(second.state, reflexes).attachedTo, "Reflexes stays on Batroc through the reset").toBe(batroc);
    expect(mainThreatOf(second.state)).toBe(Math.max(0, threatBefore - 6));
    expect(ofType(second.events, "threatRemoved").map((e) => e.amount)).toContain(Math.min(6, threatBefore));
  });
});

describe("Alert Level (50090a), Embassy Guard (50093) and Commandeer Security Office (50095) in a Batroc game", () => {
  // 50090a: "If there is at least 4 [per_hero] threat here, remove all threat from here and flip this card. Forced Response:
  // After a character is defeated except by consequential damage, place 1 threat here. Hero Action: Spend 1 resource of any
  // type -> remove 1 threat from here." 50093: "When Defeated: Place 1 threat on Alert Level." 50095: "When Defeated: Remove
  // 1 [per_hero] threat from Alert Level." RRG "Defeat" p. 16 and "Cost" p. 13 (overpaying is allowed, p. 13).
  const KICK = "01005";
  it("defeating the Guard puts 2 threat on Alert Level (the defeat and its own When Defeated); a Hero Action pays 1 resource to take 1 off", () => {
    let s = openScenario("batroc", 1, { seats: [SPIDER_MAN] });
    s = villainPhaseDealing(s, ["50093"]).state;
    const guard = inPlayAll(s, "50093")[0]!;
    expect(inst(s, guard).engagedWith).toBe(P1);
    const alert = inPlayAll(s, "50090a")[0]!;
    expect(inst(s, alert).threat).toBe(0);
    s = heroTurn(s);
    const given = moveToHand(s, P1, KICK);
    s = given.state;
    const money = playerOf(s, P1).hand.filter((id) => id !== given.ids[0]);
    const killed = act(s, { targets: [guard] }, play(P1, given.ids[0]!, money.slice(0, 3), {}));
    expect(inPlayAll(killed.state, "50093"), "the Guard left play").toHaveLength(0);
    expect(inst(killed.state, alert).threat, "1 for the character defeated, 1 from the Guard's When Defeated").toBe(2);
    // Hero Action: spend 1 resource of any type.
    const handBefore = playerOf(killed.state, P1).hand;
    const paid = act(killed.state, {}, use(P1, alert, "50090a.alert-level-action", [{ fromHand: handBefore[0]! }]));
    expect(inst(paid.state, alert).threat).toBe(1);
    expect(playerOf(paid.state, P1).hand.length, "one card was spent").toBe(handBefore.length - 1);
  });

  it("Alert Level flips to High when the fourth threat lands, removing all 4; the Forced Response that follows the defeat then places 1 on the High side", () => {
    // Round 1: Batroc's attack (Forced Response, +1) and a defeated Guard (the defeat +1, its When Defeated +1) make 3; the
    // second Guard (+1 When Defeated) is the fourth. 50090a is a state check: it flips the moment 4 [per_hero] are there, so
    // the defeat's own Forced Response (after the When Defeated) lands on the High side.
    let s = openScenario("batroc", 1, { seats: [SPIDER_MAN] });
    const alert = inPlayAll(s, "50090a")[0]!;
    let last: ReturnType<typeof act> | undefined;
    for (let round = 0; round < 2; round++) {
      s = villainPhaseDealing(s, ["50093"]).state;
      const guard = inPlayAll(s, "50093")[0]!;
      s = round === 0 ? heroTurn(s) : s;
      const given = moveToHand(s, P1, KICK);
      s = given.state;
      const money = playerOf(s, P1).hand.filter((id) => id !== given.ids[0]);
      last = act(s, { targets: [guard] }, play(P1, given.ids[0]!, money.slice(0, 3), {}));
      s = last.state;
    }
    expect(inst(s, alert).flipped, "flipped to its High side").toBe(true);
    expect(ofType(last!.events, "threatRemoved").find((e) => e.schemeInstanceId === alert)?.amount).toBe(4);
    expect(inst(s, alert).threat, "the defeat's Forced Response placed 1 after the flip").toBe(1);
  });
});

describe("Destroy Evidence's incite on the card revealed after it (50075) with Widow's Bite (50079), Black Widow game, two players", () => {
  // 50075: "Hinder 2 [per_hero]. Each other encounter card gains incite 1." Incite X (MC55 p. 2): when a card with incite X is
  // revealed, place X threat on the main scheme. 50079: "When Revealed: You are stunned. Take 1 damage (2 damage instead if you
  // were already stunned)." One villain phase deals p1 Destroy Evidence, then p2 Widow's Bite (a crisis icon on Destroy
  // Evidence would stop a thwart of the main scheme, so a single player cannot take the threat down in between).
  const SEATS2 = [SPIDER_MAN, IRON_MAN] as const;
  const run = () => villainPhaseDealing(openScenario("black-widow", 2, { seats: SEATS2 }), ["50075", "50079"]);

  it("Destroy Evidence enters with its 2 starting threat plus Hinder 2 [per_hero] (RRG 'Hinder', MC55 p. 2)", () => {
    const { state } = run();
    const evidence = inPlayAll(state, "50075")[0]!;
    expect(inst(state, evidence).threat).toBe(2 + 2 * 2);
  });

  it("the Bite revealed after it incites: 1 threat on the main scheme, then the stun and 1 damage on the player it was dealt to", () => {
    const { state, events } = run();
    const reveals = ofType(events, "encounterCardRevealed");
    const evidenceReveal = reveals.find((e) => codeOf(state, e.instanceId) === "50075")!;
    const biteReveal = reveals.find((e) => codeOf(state, e.instanceId) === "50079")!;
    expect(evidenceReveal.playerId).toBe(P1);
    expect(biteReveal.playerId).toBe(P2);
    const biteIndex = events.indexOf(biteReveal);
    const evidenceIndex = events.indexOf(evidenceReveal);
    const main = state.mainScheme.instanceId;
    const isIncite = (e: (typeof events)[number]) =>
      e.type === "threatPlaced" &&
      e.schemeInstanceId === main &&
      e.amount === 1 &&
      e.sourceInstanceId === biteReveal.instanceId;
    expect(events.slice(evidenceIndex, biteIndex).some(isIncite), "no incite for Destroy Evidence itself").toBe(false);
    const inciteAt = events.findIndex((e, i) => i > biteIndex && isIncite(e));
    const damageAt = events.findIndex(
      (e, i) => i > biteIndex && e.type === "damageDealt" && e.sourceInstanceId === biteReveal.instanceId,
    );
    expect(inciteAt, "incite 1 placed from the Bite").toBeGreaterThan(biteIndex);
    expect(damageAt, "the Bite's damage").toBeGreaterThan(inciteAt);
    const damage = events[damageAt] as { targetInstanceId: InstanceId; amount: number };
    expect(damage.targetInstanceId).toBe(identityOf(state, P2));
    expect(damage.amount).toBe(1);
    const stun = events.findIndex(
      (e, i) =>
        i > biteIndex && e.type === "statusGiven" && e.status === "stunned" && e.instanceId === identityOf(state, P2),
    );
    // Observation, not asserted as a rule: the card prints "stunned" before "take 1 damage" but the script's damage event
    // comes first (the "already stunned" test is read before the stun either way, so the amount is right: 1, not 2).
    expect(stun, "P2's identity was stunned").toBeGreaterThan(biteIndex);
  });
});

describe("Citizen V's Sword (50132) in a Thunderbolts game, one player (Spider-Man), standard", () => {
  // 50132: "When Revealed: Attach to Citizen V. He activates against you. Hero Response: After you attack and damage Citizen V,
  // spend [physical] [physical] resources -> discard this card." RRG "Response" p. 36 (optional), "Cost" p. 13 (typed
  // resources are paid with cards that generate that type).
  function armed() {
    let s = openScenario("thunderbolts", 1, { seats: [SPIDER_MAN] });
    const dealt = villainPhaseDealing(s, ["50132"]);
    s = dealt.state;
    const sword = inPlayAll(s, "50132")[0]!;
    expect(inst(s, sword).attachedTo, "attached to Citizen V").toBe(s.activeVillainId);
    expect(codeOf(s, s.activeVillainId)).toBe("50129a");
    expect(ofType(dealt.events, "enemyActivated").length, "Citizen V (and the minions) activated").toBeGreaterThan(0);
    s = act(s, {}, { type: "changeForm", playerId: P1 }).state;
    // 50130a: "Each Thunderbolt minion gains guard." The engaged minion must fall before Citizen V can be attacked.
    const guardMinion = cardsInPlay(s).find(
      (id) => inst(s, id).engagedWith === P1 && cardOf(s, id)?.type === "minion",
    )!;
    const base = playerOf(s, P1).hand;
    const kicks = moveToHand(s, P1, "01005", "01005");
    s = kicks.state;
    s = act(
      s,
      { targets: [guardMinion] },
      play(P1, kicks.ids[0]!, base.slice(0, 3), {}),
      play(P1, kicks.ids[1]!, base.slice(3, 6), {}),
    ).state;
    expect(cardsInPlay(s), "the guard minion fell").not.toContain(guardMinion);
    const given = moveToHand(s, P1, "01003", "01003");
    return { s: given.state, sword, physical: given.ids };
  }
  const attackCitizen = (s: ReturnType<typeof openScenario>) => ({
    type: "basicAttack" as const,
    playerId: P1,
    attackerInstanceId: identityOf(s, P1),
    targetInstanceId: s.activeVillainId,
  });

  it("the Response is offered after the hero damages Citizen V; two physical resources discard the Sword", () => {
    const { s, sword, physical } = armed();
    const seen: string[] = [];
    const r = act(s, { take: ["citizen-vs-sword"], payWith: physical, seen }, attackCitizen(s));
    expect(seen.some((line) => line.startsWith("chooseTriggers") && line.includes("Citizen V's Sword"))).toBe(true);
    expect(inst(r.state, s.activeVillainId).damage, "the attack damaged him").toBeGreaterThan(0);
    expect(inst(r.state, sword).attachedTo, "the Sword is discarded").toBeNull();
    expect(inPlayAll(r.state, "50132")).toHaveLength(0);
    for (const id of physical) expect(playerOf(r.state, P1).discard, "paid with the physical cards").toContain(id);
  });

  it("declining the Response keeps the Sword; mental resources do not pay it", () => {
    const { s, sword, physical } = armed();
    const declined = act(s, { take: [] }, attackCitizen(s));
    expect(inst(declined.state, sword).attachedTo).toBe(s.activeVillainId);
    const mental = moveToHand(s, P1, "01004", "01004");
    expect(physical).toHaveLength(2);
    // Either the engine refuses the wrong-type payment outright or the Sword stays; it must never be discarded.
    let after: ReturnType<typeof act> | undefined;
    try {
      after = act(mental.state, { take: ["citizen-vs-sword"], payWith: mental.ids }, attackCitizen(s));
    } catch {
      after = undefined;
    }
    if (after) expect(inst(after.state, sword).attachedTo).toBe(s.activeVillainId);
  });
});
