import { cardId } from "@mc/content";
import {
  activeEncounterDeck,
  applyCommand,
  characterProfile,
  faceVisible,
  maxHitPoints,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { ironheartScenario } from "./support.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";

const ironheartVsRhino = (seed = 1) => startWave5Game(ironheartScenario("rhino", { seed }));
/** Every card here is a "Hero Action:" event — playable only in hero form (identity.test.ts's own `toHero` precedent). */
const ironheartInHeroForm = (seed = 1) => runWave5(ironheartVsRhino(seed), toHero(P1));

/** Test-only surgery (`identity.test.ts`'s own `forcedV3` precedent): forces Ironheart onto a given Version
 * directly, without paying Level Up!'s own cost, purely to exercise a Version-dependent event in isolation. */
function forceVersion(state: GameState, player: PlayerId, version: "29001a" | "29002a" | "29003a"): GameState {
  const identity = identityOf(state, player);
  const id = cardId(version);
  return {
    ...state,
    instances: { ...state.instances, [identity]: { ...inst(state, identity), cardId: id } },
    players: state.players.map((p) => (p.playerId === player ? { ...p, identity: { ...p.identity, cardId: id } } : p)),
  };
}

const refused = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, WAVE5_DEPS);
  if (result.ok) throw new Error("expected the play to be refused");
  return result.error.code;
};

describe("Ironheart's events (29005-29008, 29017-29019, 29025)", () => {
  describe("29005.fly-over-action", () => {
    it("removes 3 threat and places 1 progress counter when it doesn't clear the scheme", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const before = inst(withThreat, identity).counters.progress ?? 0;
      const { state } = playFromHand(withThreat, "29005", 2);
      expect(mainThreat(state)).toBe(10 - 3);
      expect(inst(state, identity).counters.progress ?? 0).toBe(before + 1);
    });

    it("places 2 progress counters when this thwart removes the last threat from the scheme", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 3 });
      const before = inst(withThreat, identity).counters.progress ?? 0;
      const { state } = playFromHand(withThreat, "29005", 2);
      expect(mainThreat(state)).toBe(0);
      expect(inst(state, identity).counters.progress ?? 0).toBe(before + 2);
    });
  });

  describe("29006.photon-beam-action", () => {
    it("deals 4 damage to an enemy and places 1 progress counter when it doesn't defeat that enemy", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const beforeCounters = inst(hero, identity).counters.progress ?? 0;
      const { state } = playFromHand(hero, "29006", 2);
      expect(inst(state, villain).damage).toBe(before + 4);
      expect(inst(state, identity).counters.progress ?? 0).toBe(beforeCounters + 1);
    });

    it("places 2 progress counters when this attack defeats that enemy", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const villain = hero.villains[0]!.instanceId;
      const hp = maxHitPoints(hero, villain, WAVE5_DEPS) ?? 4;
      const readyToDefeat = patchInstance(hero, villain, { damage: Math.max(0, hp - 4) });
      const beforeCounters = inst(readyToDefeat, identity).counters.progress ?? 0;
      const { state } = playFromHand(readyToDefeat, "29006", 2);
      expect(inst(state, villain).damage).toBe(0); // defeated: the stage's own dial resets (Nova's No Quarter precedent).
      expect(inst(state, identity).counters.progress ?? 0).toBe(beforeCounters + 2);
    });
  });

  describe("29007.new-and-improved-action", () => {
    it("Version 1: choose 1 different option (searches her deck for an Ironheart card and shuffles)", () => {
      const hero = ironheartInHeroForm();
      const given = moveToHand(hero, P1, "29007");
      const [id] = given.ids as [InstanceId];
      const handBefore = playerOf(given.state, P1).hand.filter((h) => h !== id);
      const after = settle(
        runWave5(given.state, play(P1, id, payWith(given.state, P1, 3, [id]))),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      // New and Improved itself and its 3 payment cards left the hand; exactly 1 Ironheart card was found and added.
      const newInHand = playerOf(after, P1).hand.filter((h) => !handBefore.includes(h));
      expect(newInHand).toHaveLength(1);
      expect(playerOf(after, P1).discard).toContain(id);
    });

    it("Version 3: choose 3 different options (search, give tough, and ready)", () => {
      const hero = ironheartInHeroForm(2);
      const identity = identityOf(hero, P1);
      const v3 = forceVersion(hero, P1, "29003a");
      const withDeck = putOnTopOfDeck(v3, P1, "29018").state; // Push Ahead, an Ironheart card.
      const exhausted = patchInstance(withDeck, identity, { exhausted: true });
      const { state } = playFromHand(exhausted, "29007", 3);
      expect(playerOf(state, P1).hand.some((id) => state.instances[id]?.cardId === cardId("29018"))).toBe(true);
      expect(inst(state, identity).statuses.tough).toBe(1);
      expect(inst(state, identity).exhausted).toBe(false);
    });
  });

  describe("29008.sector-scan-constant / 29008.sector-scan-action", () => {
    it("Version 1 reduces the cost to play Sector Scan (3) by 1", () => {
      const hero = ironheartInHeroForm();
      const given = moveToHand(hero, P1, "29008");
      const [id] = given.ids as [InstanceId];
      const after = settle(
        runWave5(given.state, play(P1, id, payWith(given.state, P1, 2))),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(playerOf(after, P1).discard).toContain(id); // 2 resources paid its cost of 3 - 1.
    });

    it("Version 3 reduces the cost to play Sector Scan (3) by 3 (free)", () => {
      const hero = ironheartInHeroForm(2);
      const v3 = forceVersion(hero, P1, "29003a");
      const given = moveToHand(v3, P1, "29008");
      const [id] = given.ids as [InstanceId];
      const after = settle(runWave5(given.state, play(P1, id, [])), firstLegal, undefined, WAVE5_DEPS);
      expect(playerOf(after, P1).discard).toContain(id); // free: no resources needed.
    });

    it("until the end of the round, only the resolving player may look at the top card of the encounter deck", () => {
      const hero = ironheartInHeroForm(3);
      const { state } = playFromHand(hero, "29008", 3);
      const top = activeEncounterDeck(state).deck[0]!;
      expect(faceVisible(state, top, { viewer: P1, deps: WAVE5_DEPS })).toBe(true);
      expect(faceVisible(state, top)).toBe(false); // the table-wide view still doesn't see it.
    });
  });

  describe("29017.go-all-out-action", () => {
    // Requirement ([energy]): 29006 (Photon Beam) prints an [energy] resource icon.
    it("exhausts your hero and deals damage to an enemy equal to the total of THW, ATK, and DEF", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const profile = characterProfile(hero, identity, WAVE5_DEPS)!;
      const total = profile.thw + profile.atk + profile.def;
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const given = moveToHand(hero, P1, "29017", "29006");
      const [goAllOut, energyCard] = given.ids as [InstanceId, InstanceId];
      const filler = payWith(given.state, P1, 1, [goAllOut, energyCard]);
      const after = settle(
        runWave5(given.state, play(P1, goAllOut, [energyCard, ...filler])),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).exhausted).toBe(true);
      expect(inst(after, villain).damage).toBe(before + total);
    });

    it("an already-exhausted hero cannot pay the cost", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const exhausted = patchInstance(hero, identity, { exhausted: true });
      const given = moveToHand(exhausted, P1, "29017", "29006");
      const [goAllOut, energyCard] = given.ids as [InstanceId, InstanceId];
      const filler = payWith(given.state, P1, 1, [goAllOut, energyCard]);
      expect(refused(given.state, play(P1, goAllOut, [energyCard, ...filler]))).toBe("already_exhausted");
    });
  });

  describe("29018.push-ahead-action", () => {
    // Requirement ([mental]): 29005 (Fly Over) prints a [mental] resource icon.
    it("exhausts your hero and removes threat from a scheme equal to the total of THW, ATK, and DEF", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const profile = characterProfile(hero, identity, WAVE5_DEPS)!;
      const total = profile.thw + profile.atk + profile.def;
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const given = moveToHand(withThreat, P1, "29018", "29005");
      const [pushAhead, mentalCard] = given.ids as [InstanceId, InstanceId];
      const filler = payWith(given.state, P1, 2, [pushAhead, mentalCard]);
      const after = settle(
        runWave5(given.state, play(P1, pushAhead, [mentalCard, ...filler])),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(after, identity).exhausted).toBe(true);
      expect(mainThreat(after)).toBe(10 - total);
    });

    it("an already-exhausted hero cannot pay the cost", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const exhausted = patchInstance(hero, identity, { exhausted: true });
      const given = moveToHand(exhausted, P1, "29018", "29005");
      const [pushAhead, mentalCard] = given.ids as [InstanceId, InstanceId];
      const filler = payWith(given.state, P1, 2, [pushAhead, mentalCard]);
      expect(refused(given.state, play(P1, pushAhead, [mentalCard, ...filler]))).toBe("already_exhausted");
    });
  });

  describe("29019.morale-boost-action", () => {
    it("the chosen hero gets +1 THW, +1 ATK, and +1 DEF until the end of the round", () => {
      const hero = ironheartInHeroForm();
      const identity = identityOf(hero, P1);
      const before = characterProfile(hero, identity, WAVE5_DEPS)!;
      const { state } = playFromHand(hero, "29019", 1);
      const boosted = characterProfile(state, identity, WAVE5_DEPS)!;
      expect(boosted.thw).toBe(before.thw + 1);
      expect(boosted.atk).toBe(before.atk + 1);
      expect(boosted.def).toBe(before.def + 1);

      const endedRound = settle(runWave5(state, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      const reverted = characterProfile(endedRound, identity, WAVE5_DEPS)!;
      expect(reverted.thw).toBe(before.thw);
      expect(reverted.atk).toBe(before.atk);
      expect(reverted.def).toBe(before.def);
    });
  });

  describe('29025."go-for-champions!"-action', () => {
    it('removes "Go for Champions!" from the game (not to the discard pile)', () => {
      const hero = ironheartInHeroForm();
      const given = moveToHand(hero, P1, "29025");
      const [id] = given.ids as [InstanceId];
      const after = settle(
        runWave5(given.state, play(P1, id, payWith(given.state, P1, 3))),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(playerOf(after, P1).discard).not.toContain(id);
      expect(after.removedFromGame).toContain(id);
    });

    it("Champion Ironheart takes no damage from Rhino's attack this round", () => {
      const hero = ironheartInHeroForm(4);
      const identity = identityOf(hero, P1);
      const given = moveToHand(hero, P1, "29025");
      const [id] = given.ids as [InstanceId];
      const played = settle(
        runWave5(given.state, play(P1, id, payWith(given.state, P1, 3))),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      const stacked = stackEncounterDeck(played, "01186"); // Advance: 0 boost icons, keeps Rhino's own ATK the whole story.
      const damageBefore = inst(stacked, identity).damage;
      const defended = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(defended, identity).damage).toBe(damageBefore); // cannot take damage: Rhino's attack lands for 0.
    });

    it("without it, the same attack deals Rhino's ATK to Ironheart", () => {
      const hero = ironheartInHeroForm(4);
      const identity = identityOf(hero, P1);
      const stacked = stackEncounterDeck(hero, "01186");
      const damageBefore = inst(stacked, identity).damage;
      const defended = settle(runWave5(stacked, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
      expect(inst(defended, identity).damage).toBeGreaterThan(damageBefore);
    });
  });
});
