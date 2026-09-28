import { describe, expect, it } from "vitest";
import { activeAbilityRefs, applyCommand, currentName, locateCard } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  patchInstance,
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

  // 31001a.sync-ratio ("Exhaust an Interface upgrade you control → generate that upgrade's resources") is not
  // registered: a genuine engine gap in the resource-payment path, not a DSL gap — see `identity.ts`'s own
  // docblock for the exact primitive missing (`generatedResources`'s `bindings: {}` never sees the ability's own
  // `exhaustCardsCost` pick, and `generates` is priced before `cost` is paid).
});
