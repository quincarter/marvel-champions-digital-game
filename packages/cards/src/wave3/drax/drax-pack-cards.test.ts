import { activeVillain, applyCommand, characterProfile, legalActions, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
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
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { WAVE3_DEPS } from "../index.js";
import { playFromHand, startWave3Game } from "../testing.js";
import { draxScenario } from "./support.js";

const draxVsRhino = (seed = 1) => startWave3Game(draxScenario("rhino", { seed }));

describe("Drax pack fillers (19030–19032)", () => {
  it('"Bring It!" — Hero Action: draw 1 card for each minion engaged with you (19030.bring-it-action)', () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    // A synthetic minion engaged with P1 (the `18015.first-hit-interrupt` gam-kit-test convention: an engaged
    // enemy's `home` is the engaged player's `playArea`, not `villainArea`).
    const minionId = "test-minion" as InstanceId;
    const withMinion = {
      ...hero,
      players: hero.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minionId] } : p)),
      instances: {
        ...hero.instances,
        [minionId]: {
          instanceId: minionId,
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
    const beforeHand = playerOf(withMinion, P1).hand.length;
    const { state } = playFromHand(withMinion, "19030", 0);
    // Playing "Bring It!" costs the card itself (hand -1); drawing 1 per engaged minion (one here) is +1 — net 0.
    expect(playerOf(state, P1).hand.length).toBe(beforeHand);
  });

  it('"Bring It!" — 19030.bring-it-action, "Max 1 per phase." rejects a second copy this phase but allows one in a later phase', () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    const given = moveToHand(hero, P1, "19030", "19030");
    const [first, second] = given.ids as [InstanceId, InstanceId];

    const afterFirst = settle(runWith(WAVE3_DEPS, given.state, play(P1, first, [])), firstLegal, undefined, WAVE3_DEPS);
    expect(playerOf(afterFirst, P1).discard).toContain(first);

    // A second copy in the same phase is rejected outright...
    const rejected = applyCommand(afterFirst, play(P1, second, []), WAVE3_DEPS);
    expect(rejected.ok ? undefined : rejected.error.code).toBe("limit_reached");

    // ...and legalActions greys it out rather than letting the player click into that error.
    const actions = legalActions(afterFirst, P1, WAVE3_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === second)).toBe(false);
    const illegal = actions.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === second);
    expect(illegal?.reason).toBe("limit_reached");

    // A fresh player phase (next round) resets the count, so the same copy can now be played.
    const nextRound = settle(runWith(WAVE3_DEPS, afterFirst, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    const playedLater = applyCommand(nextRound, play(P1, second, []), WAVE3_DEPS);
    expect(playedLater.ok).toBe(true);
  });

  it('"Think Fast!" — Hero Action: take 1 damage, confuse the villain (19031.think-fast-action)', () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    const identity = identityOf(hero);
    const villain = activeVillain(hero).instanceId;
    const damageBefore = inst(hero, identity).damage;
    const { state } = playFromHand(hero, "19031", 1);
    expect(inst(state, identity).damage).toBe(damageBefore + 1);
    expect(inst(state, villain).statuses.confused).toBeGreaterThan(0);
  });

  it("Regroup — Forced Interrupt: when the round ends, discard this card (19032.regroup-forced-interrupt)", () => {
    const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
    const { state: played, id } = playFromHand(hero, "19032", 1);
    expect(playerOf(played, P1).playArea).toContain(id);
    // Sits in play until the round ends (the villain phase's own end, RRG 1.8 p. 47 step 6b) — drive a full turn.
    const after = settle(runWith(WAVE3_DEPS, played, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(playerOf(after, P1).discard).toContain(id);
    expect(playerOf(after, P1).playArea).not.toContain(id);
  });

  describe("Regroup — Interrupt: when an ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it (19032.regroup-interrupt, docs/phase7-wave3.md §3.45)", () => {
    it("an ally defeated by the villain's attack returns to hand, not the discard pile", () => {
      const hero = runWith(WAVE3_DEPS, draxVsRhino(1), toHero());
      const { state: withRegroup } = playFromHand(hero, "19032", 1);
      const { state: withMantis } = playFromHand(withRegroup, "19002", 2); // Mantis, hp 3
      const [mantis] = instancesOf(withMantis, "19002") as [InstanceId];
      const maxHp = characterProfile(withMantis, mantis, WAVE3_DEPS)!.maxHp;
      const primed = patchInstance(withMantis, mantis, { damage: maxHp - 1 }); // any hit at all defeats her
      const defendWithMantis: Picker = (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "declareDefender") {
          const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === mantis);
          return defend ? [defend.optionId] : ["decline"];
        }
        if (choice?.prompt.kind === "chooseTriggers") {
          const regroup = choice.options.find((o) => o.optionId.endsWith(":19032.regroup-interrupt"));
          return regroup ? [regroup.optionId] : choice.options.map((o) => o.optionId);
        }
        return firstLegal(s);
      };
      const settled = settle(runWith(WAVE3_DEPS, primed, endTurn()), defendWithMantis, undefined, WAVE3_DEPS);
      expect(playerOf(settled, P1).playArea).not.toContain(mantis); // no longer in play: still defeated
      expect(playerOf(settled, P1).hand).toContain(mantis);
      expect(playerOf(settled, P1).discard).not.toContain(mantis);
      expect(inst(settled, mantis).damage).toBe(0); // leaving play cleared it (RRG 1.8 "Leaves Play")
    });

    it("an ally defeated by non-attack damage (her own consequential damage) still goes to the discard pile as usual", () => {
      const hero = runWith(WAVE3_DEPS, draxVsRhino(2), toHero());
      const { state: withRegroup } = playFromHand(hero, "19032", 1);
      const { state: withMartyr } = playFromHand(withRegroup, "19012", 4); // Martyr: consequentialDamage.attack = 1
      const [martyr] = instancesOf(withMartyr, "19012") as [InstanceId];
      const primed = patchInstance(withMartyr, martyr, { damage: 2 }); // hp 3: her own 1 consequential damage kills her
      const villain = activeVillain(primed).instanceId;
      const attacked = settle(
        runWith(WAVE3_DEPS, primed, {
          type: "basicAttack",
          playerId: P1,
          attackerInstanceId: martyr,
          targetInstanceId: villain,
        } as never),
        firstLegal,
        undefined,
        WAVE3_DEPS,
      );
      expect(playerOf(attacked, P1).playArea).not.toContain(martyr);
      expect(playerOf(attacked, P1).discard).toContain(martyr);
      expect(playerOf(attacked, P1).hand).not.toContain(martyr);
    });
  });
});
