import { playCostOf, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  resourceAbility,
  run,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { playFromHand, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";

const milesVsRhino = (seed = 1) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/** Accepts the named optional Interrupt/Response option; declines everything else. */
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

describe("Ganke Lee (support, 27035)", () => {
  it("27035.ganke-lee-action: exhausts, draws 1 card, and (in hero form) discards a chosen hand card", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withGanke, id: ganke } = playFromHand(hero, "27035", 2);
    const beforeHand = withGanke.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, withGanke, use(P1, ganke, "27035.ganke-lee-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, ganke).exhausted).toBe(true);
    // +1 drawn, -1 discarded ("choose and discard 1 card from your hand" in hero form): net unchanged.
    expect(after.players[0]!.hand.length).toBe(beforeHand);
  });

  it("27035.ganke-lee-action: in alter-ego form, draws 1 card with no discard", () => {
    const state = milesVsRhino(2); // Precon starts in alter-ego form.
    const { state: withGanke, id: ganke } = playFromHand(state, "27035", 2);
    const beforeHand = withGanke.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, withGanke, use(P1, ganke, "27035.ganke-lee-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, ganke).exhausted).toBe(true);
    expect(after.players[0]!.hand.length).toBe(beforeHand + 1); // Drew 1, nothing discarded.
  });
});

describe("Jefferson Davis (support, 27036)", () => {
  it("27036.jefferson-davis-action: exhausts and removes 1 threat from the scheme with the least threat", () => {
    const state = milesVsRhino(1); // Precon starts in alter-ego form ("Alter-Ego Action").
    const { state: withDavis, id: davis } = playFromHand(state, "27036", 2);
    const withThreat = patchInstance(withDavis, withDavis.mainScheme.instanceId, { threat: 5 });
    const before = mainThreat(withThreat);
    const after = settle(
      runWith(WAVE5_DEPS, withThreat, use(P1, davis, "27036.jefferson-davis-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, davis).exhausted).toBe(true);
    expect(mainThreat(after)).toBe(before - 1); // The Core scenario's only scheme is trivially "the least".
  });
});

describe("Power Within (upgrade, 27037)", () => {
  it("27037.power-within-response: discarded after a basic power use, resolves Venom Blast only (2 damage + stun)", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withUpgrade, id: powerWithin } = playFromHand(hero, "27037", 1);
    const identity = identityOf(withUpgrade);
    const villain = withUpgrade.villains[0]!.instanceId;
    const before = inst(withUpgrade, villain).damage;
    const after = settle(
      runWith(WAVE5_DEPS, withUpgrade, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("27037.power-within-response", villain),
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.discard).toContain(powerWithin); // "discard Power Within" cost.
    // Venom Blast: "Deal 2 damage to an enemy. Stun that enemy." (on top of the basic attack's own damage).
    expect(inst(after, villain).damage).toBeGreaterThanOrEqual(before + 2);
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
    // Only the Special Power Within names (docs/phase7-wave5.md §4.1 Q63): no Spider Camouflage tough or confuse.
    expect(inst(after, identity).statuses.tough).toBe(0);
    expect(inst(after, villain).statuses.confused).toBe(0);
  });

  it("27037.power-within-response: declined after a basic power use — Power Within stays in play, no Venom Blast", () => {
    const hero = run(milesVsRhino(2), toHero(P1));
    const { state: withUpgrade, id: powerWithin } = playFromHand(hero, "27037", 1);
    const identity = identityOf(withUpgrade);
    const villain = withUpgrade.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, withUpgrade, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal, // Declines the optional Response.
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, powerWithin).attachedTo).toBe(identity); // still attached: not discarded.
    expect(inst(after, villain).statuses.stunned).toBe(0); // Venom Blast never resolved.
  });
});

describe("Defense Mechanism (upgrade, 27038)", () => {
  it("27038.defense-mechanism-response: discarded after a basic power use, resolves Spider Camouflage only (tough + confuse)", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withUpgrade, id: defenseMechanism } = playFromHand(hero, "27038", 1);
    const identity = identityOf(withUpgrade);
    const villain = withUpgrade.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, withUpgrade, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("27038.defense-mechanism-response", villain),
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.discard).toContain(defenseMechanism); // "discard Defense Mechanism" cost.
    expect(inst(after, identity).statuses.tough).toBeGreaterThan(0); // "Give Spider-Man a tough status card."
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0); // "Confuse an enemy."
    // Only the Special Defense Mechanism names (docs/phase7-wave5.md §4.1 Q63): no Venom Blast stun.
    expect(inst(after, villain).statuses.stunned).toBe(0);
  });

  it("27038.defense-mechanism-response: declined — no tough status or confuse", () => {
    const hero = run(milesVsRhino(2), toHero(P1));
    const { state: withUpgrade, id: defenseMechanism } = playFromHand(hero, "27038", 1);
    const identity = identityOf(withUpgrade);
    const villain = withUpgrade.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, withUpgrade, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, defenseMechanism).attachedTo).toBe(identity); // still attached: not discarded.
    expect(inst(after, identity).statuses.tough).toBe(0);
    expect(inst(after, villain).statuses.confused).toBe(0);
  });
});

describe("Web-Shooter (upgrade, 27039)", () => {
  it("27039.web-shooter-resource: exhausts, removes a web counter, and generates a [wild] resource (Core's own 01008 verbatim)", () => {
    const hero = run(milesVsRhino(1), toHero(P1));
    const { state: withShooter, id: webShooter } = playFromHand(hero, "27039", 1);
    expect(inst(withShooter, webShooter).counters.web).toBe(3);
    // Web-Shot (27034, cost 2, [mental]) paid using the Web-Shooter's generated [wild] resource and 1 filler card,
    // the same `resourceAbility` shape Core's own Web-Shooter test uses (`core/heroes/spider-man.test.ts`).
    const given = moveToHand(withShooter, P1, "27034", "27044");
    const [webShot, filler] = given.ids as [InstanceId, InstanceId];
    const web = resourceAbility(webShooter, "27039.web-shooter-resource");
    const after = settle(
      runWith(
        WAVE5_DEPS,
        given.state,
        play(P1, webShot, payWith(given.state, P1, 1, [webShot, filler]), { abilities: [web] }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, webShooter).exhausted).toBe(true);
    expect(inst(after, webShooter).counters.web).toBe(2);
  });
});

describe("Monica Chang (ally, 27040)", () => {
  it("27040.monica-chang-response: searches deck/hand/discard for Surveillance Team, puts it into play, and adds a snoop counter", () => {
    const state = milesVsRhino(1);
    // Surveillance Team (27045) staged into the deck so the search can find it.
    const given = moveToHand(state, P1, "27045");
    const [surveillanceTeam] = given.ids as [InstanceId];
    const toDeck: typeof given.state = {
      ...given.state,
      players: given.state.players.map((p, i) =>
        i === 0
          ? { ...p, hand: p.hand.filter((id) => id !== surveillanceTeam), deck: [surveillanceTeam, ...p.deck] }
          : p,
      ),
    };
    const { state: withMonica } = playFromHand(toDeck, "27040", 3, accepting("27040.monica-chang-response"));
    expect(withMonica.players[0]!.playArea).toContain(surveillanceTeam);
    // Surveillance Team's own "Uses (3 snoop counters)" already places 3 on entering play; Monica's own "Place 1
    // snoop counter on each Surveillance Team you control" adds a 4th on top.
    expect(inst(withMonica, surveillanceTeam).counters.snoop).toBe(4);
  });

  it("27040.monica-chang-response: does nothing when no copy of Surveillance Team can be found", () => {
    const state = milesVsRhino(2);
    // The precon's own copy (27045) is left in the deck's usual position; remove every copy from every zone.
    const scrubbed: typeof state = {
      ...state,
      players: state.players.map((p) => ({
        ...p,
        deck: p.deck.filter((id) => state.instances[id]?.cardId !== "27045"),
        hand: p.hand.filter((id) => state.instances[id]?.cardId !== "27045"),
        discard: p.discard.filter((id) => state.instances[id]?.cardId !== "27045"),
      })),
    };
    const { state: withMonica } = playFromHand(scrubbed, "27040", 3, accepting("27040.monica-chang-response"));
    expect(withMonica.players[0]!.playArea.some((id) => withMonica.instances[id]?.cardId === "27045")).toBe(false);
  });
});

describe("Spider-Woman (ally, 27041)", () => {
  it("27041.spider-woman-constant: costs 1 less for each confused enemy in play", () => {
    const state = milesVsRhino(1);
    const villain = state.villains[0]!.instanceId;
    const given = moveToHand(state, P1, "27041");
    const [id] = given.ids as [InstanceId];
    const noConfusion = given.state;
    const confused = patchInstance(given.state, villain, { statuses: { stunned: 0, confused: 2, tough: 0 } });
    expect(playCostOf(noConfusion, P1, id, WAVE5_DEPS)?.current).toBe(3);
    // "For each confused enemy in play" counts enemies, not confuse tokens: 1 confused enemy (with 2 confuse status
    // cards) reduces the cost by only 1, to 2.
    expect(playCostOf(confused, P1, id, WAVE5_DEPS)?.current).toBe(2);
  });
});
