import { describe, expect, it } from "vitest";
import { statBonus, type GameState, type InstanceId, type Payment } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand, runWave5, startWave5Game, WAVE5_DEPS } from "../testing.js";
import { spdrScenario } from "./support.js";

const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));

/** A picker that accepts the `chooseOne`/`chooseTarget` option whose label is exactly `label`. */
const choosing =
  (label: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label === label);
    return hit ? [hit.optionId] : firstLegal(state);
  };

/** Pays with the Sync Ratio resource ability (`31001a.sync-ratio`), exhausting `pick` (an Interface upgrade). */
const syncUse = (state: GameState, pick: InstanceId): Payment => ({
  ability: {
    instanceId: identityOf(state, P1),
    abilityId: "31001a.sync-ratio" as never,
    costChoices: { exhausted: [pick] },
  },
});

/** Plays `code` from hand (hero form), paying `cost - 1` from other hand cards and 1 via SP//dr Suit's own Sync
 * Ratio (exhausting SP//dr, the attached upgrade, itself always an in-play Interface upgrade in hero form) —
 * `identity.test.ts`'s own Sync Ratio probe precedent. */
function playWithSyncRatio(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const spdr = playerOf(given.state, P1).identity.separatedCardInstanceId!;
  const played = settle(
    runWave5(
      given.state,
      play(P1, id, payWith(given.state, P1, cost - 1, [id]), { abilities: [syncUse(given.state, spdr)] }),
    ),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

/** Plays `code` from hand, attaching it directly to `hostId` — `spiderham/support-upgrades.test.ts`'s own precedent. */
function playAttachedTo(
  state: GameState,
  code: string,
  cost: number,
  hostId: InstanceId,
  pick: Picker = firstLegal,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWave5(given.state, play(P1, id, payWith(given.state, P1, cost, [id]), { attachToInstanceId: hostId })),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

describe("SP//dr's events (31004-31006, 31016, 31023; 31017 KNOWN_SKIPPED, see module docblock)", () => {
  describe("31004.all-systems-go-action", () => {
    it("Ready each Interface upgrade you control: readies the exhausted SP//dr Suit upgrade (hero form)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const spdr = playerOf(hero, P1).identity.separatedCardInstanceId!;
      const exhausted = patchInstance(hero, spdr, { exhausted: true });
      const { state } = playFromHand(exhausted, "31004", 1, choosing("Ready each Interface upgrade you control"));
      expect(inst(state, spdr).exhausted).toBe(false);
    });

    it("Search your deck and discard pile for an Interface upgrade and add it to your hand: shuffles it in from the deck", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const interfaceUpgradeIds = ["31010", "31011", "31012", "31013"].flatMap((code) => instancesOf(hero, code));
      const inHandBefore = playerOf(hero, P1).hand.filter((id) => interfaceUpgradeIds.includes(id)).length;
      const label = "Search your deck and discard pile for an Interface upgrade and add it to your hand";
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        if (!choice) return [];
        if (choice.prompt.kind === "chooseCards") {
          // Pick the first offered Interface upgrade (any legal one proves the search worked).
          return choice.options.slice(0, 1).map((o) => o.optionId);
        }
        return choosing(label)(s);
      };
      const { state } = playFromHand(hero, "31004", 1, pick);
      const inHandAfter = playerOf(state, P1).hand.filter((id) => interfaceUpgradeIds.includes(id)).length;
      expect(inHandAfter).toBe(inHandBefore + 1); // found and added to hand, on top of any already drawn.
    });
  });

  describe("31005.rapid-deployment-action", () => {
    it("without Sync Ratio: removes 3 threat from a scheme, once", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playFromHand(withThreat, "31005", 2);
      expect(mainThreat(state)).toBe(10 - 3);
    });

    it("paid with a Sync Ratio resource: removes 3 threat from a scheme twice (6 total)", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const withThreat = patchInstance(hero, hero.mainScheme.instanceId, { threat: 10 });
      const { state } = playWithSyncRatio(withThreat, "31005", 2);
      expect(mainThreat(state)).toBe(10 - 6);
    });
  });

  describe("31006.web-trap-action", () => {
    it("without Sync Ratio: deals 5 damage to an enemy and does not stun it", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const { state } = playFromHand(hero, "31006", 2);
      expect(inst(state, villain).damage).toBe(before + 5);
      expect(state.instances[villain]?.statuses.stunned ?? 0).toBe(0);
    });

    it("paid with a Sync Ratio resource: deals 5 damage and stuns that enemy", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const villain = hero.villains[0]!.instanceId;
      const before = inst(hero, villain).damage;
      const { state } = playWithSyncRatio(hero, "31006", 2);
      expect(inst(state, villain).damage).toBe(before + 5);
      expect(state.instances[villain]?.statuses.stunned ?? 0).toBeGreaterThan(0);
    });
  });

  describe("31016.repurpose-action", () => {
    it("discards a Tech upgrade, readies your hero, and gets +X (the upgrade's printed cost) to the chosen power until the end of the round", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      // Energy Barrier (31018): cost 2, TECH.
      const { state: withUpgrade, id: barrier } = playAttachedTo(hero, "31018", 2, identity);
      const exhausted = patchInstance(withUpgrade, identity, { exhausted: true });
      const { state } = playFromHand(exhausted, "31016", 0, choosing("ATK"));
      expect(playerOf(state, P1).discard).toContain(barrier); // discarded as the cost.
      expect(playerOf(state, P1).playArea).not.toContain(barrier);
      expect(inst(state, identity).exhausted).toBe(false); // readied.
      // +2 ATK (Energy Barrier's own printed cost, 31018), the chosen power, until the end of the round.
      expect(statBonus(state, WAVE5_DEPS, identity, "atk")).toBe(2);
      expect(statBonus(state, WAVE5_DEPS, identity, "thw")).toBe(0);
      expect(statBonus(state, WAVE5_DEPS, identity, "def")).toBe(0);
    });
  });

  describe("31023.limitless-stamina-action", () => {
    it("readies your hero", () => {
      const hero = runWave5(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      const exhausted = patchInstance(hero, identity, { exhausted: true });
      const { state } = playFromHand(exhausted, "31023", 1);
      expect(inst(state, identity).exhausted).toBe(false);
    });
  });
});
