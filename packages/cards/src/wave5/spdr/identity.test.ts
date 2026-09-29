import { describe, expect, it } from "vitest";
import {
  activeAbilityRefs,
  applyCommand,
  currentName,
  locateCard,
  paymentFor,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type Payment,
} from "@mc/engine";
import { dealDamage, heroAction, resourcesPaidBy, theVillain } from "../../dsl/index.js";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  run,
  runWith,
  settle,
  toHero,
  use,
  P1,
} from "../../testing/harness.js";
import { WAVE5_DEPS } from "../index.js";
import { startWave5Game } from "../testing.js";
import { spdrScenario } from "./support.js";

// Real Core data: the Rhino villain phase always attacks a lone player — Spider-Ham's/Nova's own identity tests'
// precedent for exercising a form change/damage without needing a scripted spdr encounter set.
const spdrVsRhino = (seed = 1) => startWave5Game(spdrScenario("rhino", { seed }));

describe("SP//dr Suit / Peni Parker (identity, 31001a/31001b/31002/31002b)", () => {
  describe("31002.psychogenetic-compatibility (Setup, coveredByEngineRule): the INACTIVE Suit enters play", () => {
    it("seats Peni Parker in alter-ego form with the SP//dr Suit support already in play", () => {
      const state = spdrVsRhino();
      const identity = identityOf(state, P1);
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(currentName(state, identity)).toBe("Peni Parker");
      const otherId = playerOf(state, P1).identity.separatedCardInstanceId;
      expect(otherId).toBeDefined();
      expect(locateCard(state, otherId!)?.kind).toBe("playArea");
      expect(inst(state, otherId!).cardId).toBe("31001a:heroCardOtherSide");
    });
  });

  describe('31001b/31002b: "This card\'s printed text box cannot be treated as if it were blank" (§3.31)', () => {
    it("31001b.sp-dr-suit-constant is the exact unblankable rule, active on the in-play INACTIVE Suit", () => {
      const state = spdrVsRhino();
      const otherId = playerOf(state, P1).identity.separatedCardInstanceId!;
      expect(WAVE5_DEPS.abilities["31001b.sp-dr-suit-constant"]).toEqual({
        trigger: { kind: "constant", rules: [{ kind: "textBoxCannotBeBlanked" }] },
        effects: [],
      });
      expect(activeAbilityRefs(state, otherId, WAVE5_DEPS).map((r) => r.id)).toContain("31001b.sp-dr-suit-constant");
    });

    it("31002b.sp-dr-constant is the exact unblankable rule, active once SP//dr is attached to the identity in hero form", () => {
      const state = run(spdrVsRhino(), toHero(P1));
      const identity = identityOf(state, P1);
      expect(currentName(state, identity)).toBe("SP//dr Suit");
      const otherId = playerOf(state, P1).identity.separatedCardInstanceId!;
      expect(locateCard(state, otherId)?.kind).toBe("attachment");
      expect(inst(state, otherId).cardId).toBe("31001a:alterEgoCardOtherSide");
      expect(WAVE5_DEPS.abilities["31002b.sp-dr-constant"]).toEqual({
        trigger: { kind: "constant", rules: [{ kind: "textBoxCannotBeBlanked" }] },
        effects: [],
      });
      expect(activeAbilityRefs(state, otherId, WAVE5_DEPS).map((r) => r.id)).toContain("31002b.sp-dr-constant");
    });
  });

  describe("31001b.return-to-base / 31002b.suit-up (Forced Interrupt, coveredByEngineRule): the printed form-change transition", () => {
    it("hero form: SP//dr Suit is ACTIVE, SP//dr is attached, and counters on the INACTIVE Suit move to the identity (§4.1 Q38)", () => {
      const alterEgo = spdrVsRhino();
      const identity = identityOf(alterEgo, P1);
      const suitId = playerOf(alterEgo, P1).identity.separatedCardInstanceId!;
      // A counter on the INACTIVE Suit support (as if some other ability had placed one) moves to the identity
      // when Suit Up! flips it — the printed "moving all counters on this card … to SP//dr Suit" (31002b), built
      // as the engine's own transition rather than scripted separately (module docblock).
      const withCounter = patchInstance(alterEgo, suitId, { counters: { ammo: 2 } });
      const hero = run(withCounter, toHero(P1));
      expect(currentName(hero, identity)).toBe("SP//dr Suit");
      expect(inst(hero, identity).counters.ammo).toBe(2);
      expect(inst(hero, suitId).counters.ammo ?? 0).toBe(0);
      const upgradeId = playerOf(hero, P1).identity.separatedCardInstanceId!;
      expect(upgradeId).toBe(suitId); // same instance, flipped in place — neither card enters or leaves play.
      expect(locateCard(hero, upgradeId)?.kind).toBe("attachment");
    });

    it("alter-ego form: flipping back returns the INACTIVE Suit support to the play area", () => {
      // Form may only change once per round (RRG "Form, Change Form") — an `endTurn` into the next round's player
      // phase between the two flips, `nova/support-upgrades-allies.test.ts`'s own precedent for the same reset.
      const hero = run(spdrVsRhino(), toHero(P1));
      const nextRound = settle(
        runWith(WAVE5_DEPS, hero, { type: "endTurn", playerId: P1 }),
        firstLegal,
        (s) => s.step.phase === "player" && s.pendingChoice === null,
        WAVE5_DEPS,
      );
      const roundTrip = run(nextRound, toHero(P1));
      const identity = identityOf(roundTrip, P1);
      expect(currentName(roundTrip, identity)).toBe("Peni Parker");
      const otherId = playerOf(roundTrip, P1).identity.separatedCardInstanceId!;
      expect(inst(roundTrip, otherId).cardId).toBe("31001a:heroCardOtherSide");
      expect(locateCard(roundTrip, otherId)?.kind).toBe("playArea");
    });
  });

  describe("31002.maintenance: Alter-Ego Action: Exhaust SP//dr Suit → draw 2 cards", () => {
    it("exhausts the SP//dr Suit support and draws 2 cards", () => {
      const state = spdrVsRhino();
      const identity = identityOf(state, P1);
      const suitId = playerOf(state, P1).identity.separatedCardInstanceId!;
      expect(inst(state, suitId).exhausted).toBe(false);
      const before = playerOf(state, P1).hand.length;
      const settled = settle(
        runWith(WAVE5_DEPS, state, use(P1, identity, "31002.maintenance")),
        firstLegal,
        undefined,
        WAVE5_DEPS,
      );
      expect(inst(settled, suitId).exhausted).toBe(true);
      expect(playerOf(settled, P1).hand.length).toBe(before + 2);
    });

    it("cannot use it again once the SP//dr Suit is already exhausted", () => {
      const state = spdrVsRhino();
      const identity = identityOf(state, P1);
      const suitId = playerOf(state, P1).identity.separatedCardInstanceId!;
      const exhausted = patchInstance(state, suitId, { exhausted: true });
      const result = applyCommand(exhausted, use(P1, identity, "31002.maintenance"), WAVE5_DEPS);
      expect(result.ok).toBe(false);
    });

    it("is not offered in hero form (printed on the alter-ego face only)", () => {
      const hero = run(spdrVsRhino(), toHero(P1));
      const identity = identityOf(hero, P1);
      expect(activeAbilityRefs(hero, identity, WAVE5_DEPS).map((r) => r.id)).not.toContain("31002.maintenance");
    });
  });

  describe("31001a.sync-ratio: Resource: Exhaust an Interface upgrade you control → generate that upgrade's resources", () => {
    // A probe standing in for Rapid Deployment's own action (31005, not scripted yet): deals damage equal to
    // `resourcesPaidBy("31001a.sync-ratio")`, so the test reads what Sync Ratio generated toward the card.
    const PROBE_DEPS: EngineDeps = {
      ...WAVE5_DEPS,
      abilities: {
        ...WAVE5_DEPS.abilities,
        "31005.rapid-deployment-action": heroAction(dealDamage(resourcesPaidBy("31001a.sync-ratio"), theVillain)),
      },
    };
    const SYNC = "31001a.sync-ratio";

    /** Hero form, with these Interface upgrades moved into P1's play area (surgery, no costs). */
    function heroWith(...codes: readonly string[]) {
      const hero = run(spdrVsRhino(), toHero(P1));
      const moved = moveToHand(hero, P1, ...codes, "31005");
      const [rapid] = moved.ids.slice(-1);
      const ifaces = moved.ids.slice(0, -1);
      let state = moved.state;
      state = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1
            ? { ...p, hand: p.hand.filter((id) => !ifaces.includes(id)), playArea: [...p.playArea, ...ifaces] }
            : p,
        ),
      };
      for (const id of ifaces) state = patchInstance(state, id, { controllerId: P1, faceup: true });
      return { state, ifaces, rapid: rapid!, spdr: playerOf(state, P1).identity.separatedCardInstanceId! };
    }
    const syncSources = (state: GameState, rapid: InstanceId) =>
      (paymentFor(state, P1, { kind: "playCard", instanceId: rapid }, {}, PROBE_DEPS)?.sources ?? []).filter(
        (source) => source.kind === "resourceAbility" && source.optionId.includes(SYNC),
      );
    const villainDamage = (state: GameState) => inst(state, state.villains[0]!.instanceId).damage;
    const syncUse = (state: GameState, pick: InstanceId): Payment => ({
      ability: { instanceId: identityOf(state, P1), abilityId: SYNC as never, costChoices: { exhausted: [pick] } },
    });

    it("is the printed resource ability: exhaust an Interface upgrade, generate its printed resources", () => {
      expect(WAVE5_DEPS.abilities[SYNC]).toEqual({
        trigger: { kind: "resource" },
        cost: {
          exhaustCards: { slot: "exhausted", query: { categories: ["upgrade"], trait: "INTERFACE" }, min: 1, max: 1 },
        },
        effects: [],
        generates: { kind: "printedResourcesOf", cards: { categories: ["upgrade"], inSlot: "exhausted" } },
      });
    });

    it("offers one source per ready Interface upgrade, each worth that upgrade's printed resources", () => {
      // 31011 Psychic Link [mental], 31012 Speed-Metal Alloy [physical]; SP//dr itself is an INTERFACE upgrade ([wild]).
      const { state, ifaces, rapid, spdr } = heroWith("31011", "31012");
      const byPick = new Map(syncSources(state, rapid).map((s) => [s.costChoices?.exhausted?.[0], s.pool] as const));
      expect(byPick.size).toBe(3);
      expect(byPick.get(ifaces[0])).toEqual({ energy: 0, mental: 1, physical: 0, wild: 0 });
      expect(byPick.get(ifaces[1])).toEqual({ energy: 0, mental: 0, physical: 1, wild: 0 });
      expect(byPick.get(spdr)).toEqual({ energy: 0, mental: 0, physical: 0, wild: 1 });
    });

    it("exhausting the picked upgrade generates exactly its resources; resourcesPaidBy reads them", () => {
      const { state, ifaces, rapid, spdr } = heroWith("31011", "31012");
      const [link, alloy] = ifaces as [InstanceId, InstanceId];
      const other = payWith(state, P1, 1, [rapid]);
      const after = settle(
        runWith(PROBE_DEPS, state, play(P1, rapid, other, { abilities: [syncUse(state, alloy)] })),
        firstLegal,
        undefined,
        PROBE_DEPS,
      );
      expect(inst(after, alloy).exhausted).toBe(true);
      expect(inst(after, link).exhausted).toBe(false);
      expect(inst(after, spdr).exhausted).toBe(false);
      expect(villainDamage(after)).toBe(villainDamage(state) + 1);
    });

    it("with two Interface upgrades used in one payment, each generates its own (2 resources from Sync Ratio)", () => {
      const { state, ifaces, rapid } = heroWith("31011", "31012");
      const [link, alloy] = ifaces as [InstanceId, InstanceId];
      const after = settle(
        runWith(PROBE_DEPS, state, play(P1, rapid, [], { abilities: [syncUse(state, link), syncUse(state, alloy)] })),
        firstLegal,
        undefined,
        PROBE_DEPS,
      );
      expect(inst(after, link).exhausted).toBe(true);
      expect(inst(after, alloy).exhausted).toBe(true);
      expect(villainDamage(after)).toBe(villainDamage(state) + 2);
    });

    it("is not offered with every Interface upgrade exhausted, and can't exhaust a non-Interface card", () => {
      const { state, ifaces, rapid, spdr } = heroWith("31011");
      const tired = patchInstance(patchInstance(state, ifaces[0]!, { exhausted: true }), spdr, { exhausted: true });
      expect(syncSources(tired, rapid)).toEqual([]);
      const refused = applyCommand(
        tired,
        play(P1, rapid, payWith(tired, P1, 1, [rapid]), { abilities: [syncUse(tired, ifaces[0]!)] }),
        PROBE_DEPS,
      );
      expect(refused.ok).toBe(false);
      // The INACTIVE Suit's support is TECH, not INTERFACE; in alter-ego form Sync Ratio isn't there at all.
      const alterEgo = spdrVsRhino();
      expect(activeAbilityRefs(alterEgo, identityOf(alterEgo, P1), WAVE5_DEPS).map((r) => r.id)).not.toContain(SYNC);
    });
  });
});
