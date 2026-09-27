import { cardsInPlay } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, moveToDiscard, withDamage } from "../../../testing/staging.js";
import { playFromHand, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "./support.js";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

/**
 * Accepts the named optional response/interrupt (by ability id); declines everything else. Also pays a reactively
 * played card's own `payForCard` step by discarding the first `cost` other hand cards — `firstLegal`'s own
 * `minSelections` (0, since paying is itself optional up to the point of failing to pay) would otherwise pay
 * nothing at all and quietly let the response fizzle. Mirrors `wave3/gmw/groot-kit.test.ts`'s own `accepting`.
 */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "payForCard") {
      return choice.options.slice(0, choice.prompt.cost).map((o) => o.optionId);
    }
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/**
 * `accepting`, plus never discarding a card named `keep` at an end-of-turn "discard down to hand size" step — Web
 * Binding needs to survive a full round (its own villain phase, and the next) to reach an enemy's activation, so a
 * plain `firstLegal` (which would happily discard it there first) can't drive these tests.
 */
const acceptingAndKeeping =
  (keep: string, ...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "discardDownToHandSize") {
      const discardable = choice.options.filter((o) => o.label !== keep);
      return discardable.slice(0, choice.minSelections).map((o) => o.optionId);
    }
    return accepting(...wanted)(state);
  };

describe("Ghost-Spider's events, part A (27002–27006)", () => {
  it("27002.ghost-kick-response: deals 6 damage to an enemy after Ghost-Spider uses a basic power, and triggers her own Dizzying Reflexes (identity, 27001a)", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27002");
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const before = inst(given.state, villain).damage;
    const attacked = settle(
      runWith(WAVE5_DEPS, given.state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      accepting("27002.ghost-kick-response", "27001a.ghost-spider-constant"),
      undefined,
      WAVE5_DEPS,
    );
    // 2 (Ghost-Spider's own ATK) + 6 (Ghost Kick).
    expect(inst(attacked, villain).damage).toBe(before + 8);
    // A basic attack exhausts the attacker; Dizzying Reflexes readies her right back up after the Response resolves.
    expect(inst(attacked, identity).exhausted).toBe(false);
  });

  it("27004.phantom-flip-response: removes 5 threat from a scheme after Ghost-Spider uses a basic power (Max 1 per basic power use)", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27004");
    const identity = identityOf(given.state);
    const scheme = given.state.mainScheme.instanceId;
    const withThreat = patchInstance(given.state, scheme, { threat: 8 });
    const thwarted = settle(
      runWith(WAVE5_DEPS, withThreat, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identity,
        schemeInstanceId: scheme,
      }),
      accepting("27004.phantom-flip-response"),
      undefined,
      WAVE5_DEPS,
    );
    // 1 (Ghost-Spider's own THW) + 5 (Phantom Flip).
    expect(mainThreat(thwarted)).toBe(8 - 1 - 5);
  });

  it("27005.pirouette-and-punch-interrupt: deals damage to the villain equal to 1 more than the revealed card's boost icons, and cancels its own 'When Revealed'", () => {
    const state = ghostSpiderVsRhino();
    // "Hero Interrupt": only usable in hero form.
    const given = moveToHand(run(state, toHero(P1)), P1, "27005");
    const villain = given.state.villains[0]!.instanceId;
    // Hard to Keep Down (01104, 0 boost icons): "When Revealed: Rhino heals 4 damage." Cancelled, the heal never
    // applies, so the villain's damage only ever goes up (5 before + 1 from Pirouette and Punch = 6) — a much
    // sharper signal than "at least" that a real heal would have undone.
    const stacked = stackEncounterDeck(given.state, "01186", "01104");
    const withDmg = withDamage(stacked, villain, 5);
    const revealed = settle(
      runWith(WAVE5_DEPS, withDmg, endTurn(P1)),
      accepting("27005.pirouette-and-punch-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(revealed, villain).damage).toBe(6);
  });

  it("27003.parental-guidance-action: George Stacy in play — attaches an event from hand facedown to him", () => {
    const state = ghostSpiderVsRhino();
    const withStacy = playFromHand(state, "27007", 1).state; // George Stacy.
    const stacyId = instancesOf(withStacy, "27007").find((id) => cardsInPlay(withStacy).includes(id))!;
    const given = moveToHand(withStacy, P1, "27003", "27004"); // Parental Guidance, an event to attach (Phantom Flip).
    const [pg, event] = given.ids as [never, never];
    const played = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, pg, payWith(given.state, P1, 0, [pg]))),
      picking(event), // Several events are legal to attach (her own deck's own copies); name Phantom Flip explicitly.
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(played, event).attachedTo).toBe(stacyId);
    expect(inst(played, event).faceup).toBe(false);
    expect(inst(played, event).facedownAs).not.toBeNull();
  });

  it("27003.parental-guidance-action: George Stacy not in play — searches deck and discard pile for him and adds him to hand (shuffled)", () => {
    // George Stacy starts this precon's opening hand at this seed, so he's put in the discard pile first — a
    // "not in play" state a real game reaches once he's died or been discarded some other way.
    const state = ghostSpiderVsRhino();
    const withStacyDiscarded = moveToDiscard(state, P1, "27007");
    const stacyId = withStacyDiscarded.id;
    const given = moveToHand(withStacyDiscarded.state, P1, "27003"); // Parental Guidance.
    const [pg] = given.ids as [never];
    const played = settle(
      runWith(WAVE5_DEPS, given.state, play(P1, pg, payWith(given.state, P1, 0, [pg]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Found in the discard pile (the deck has no copy of him to search out) and moved to hand as the same card.
    // (Parental Guidance itself lands in the discard pile too, once it resolves, so the pile's raw count alone
    // wouldn't tell the two apart.)
    expect(playerOf(played, P1).hand).toContain(stacyId);
    expect(playerOf(played, P1).discard).not.toContain(stacyId);
  });

  it("27006.web-binding-interrupt: cancels the villain's own activation — no attack, and no damage (it isn't a minion)", () => {
    const state = ghostSpiderVsRhino();
    const given = moveToHand(run(state, toHero(P1)), P1, "27006");
    const identity = identityOf(given.state);
    const villain = given.state.villains[0]!.instanceId;
    const after = settle(
      runWith(WAVE5_DEPS, given.state, endTurn(P1)),
      acceptingAndKeeping("Web Binding", "27006.web-binding-interrupt"),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(0);
    expect(inst(after, identity).damage).toBe(0); // The attack never happened (§4.1 Q3).
  });

  it("27006.web-binding-interrupt: cancels a minion's activation and deals 4 damage to that minion", () => {
    // Real Core data: Advance (0 boost icons, "the villain schemes") ahead of Hydra Mercenary (Guard, ATK 1) — the
    // same neutral stack `core/heroes/spider-man.test.ts`'s own tests use to get a minion engaged with the player
    // from the villain phase's own encounter-card draw. It enters play too late to activate this round, so a
    // second round is driven to reach its own activation.
    const ADVANCE = "01186";
    const HYDRA_MERCENARY = "01101";
    const state = ghostSpiderVsRhino();
    const given = moveToHand(stackEncounterDeck(run(state, toHero(P1)), ADVANCE, HYDRA_MERCENARY), P1, "27006");
    const keepBinding = acceptingAndKeeping("Web Binding"); // Round 1: never accept it (the villain, not a minion).
    const afterRound1 = settle(runWith(WAVE5_DEPS, given.state, endTurn(P1)), keepBinding, undefined, WAVE5_DEPS);
    const minion = instancesOf(afterRound1, HYDRA_MERCENARY).find((id) => cardsInPlay(afterRound1).includes(id))!;
    expect(minion).toBeDefined();
    // Round 2: Hydra Mercenary now activates too. Accept Web Binding only on *its* activation, not the villain's.
    const acceptOnMinion: Picker = (s) => {
      const event = s.pendingChoice?.prompt.kind === "chooseTriggers" ? s.pendingChoice.prompt.event : undefined;
      if (event?.kind === "enemyActivating" && event.enemyInstanceId === minion) {
        return acceptingAndKeeping("Web Binding", "27006.web-binding-interrupt")(s);
      }
      return acceptingAndKeeping("Web Binding")(s);
    };
    // Hydra Mercenary's own HP is 3: 4 damage both proves the effect and defeats it, so its own `damage` counter
    // resets once it leaves play — the *event* is the proof, not the stale instance snapshot afterward.
    const { state: afterRound2, events } = driveEventsPicking(WAVE5_DEPS, afterRound1, acceptOnMinion, endTurn(P1));
    expect(events).toContainEqual(
      expect.objectContaining({ type: "damageDealt", targetInstanceId: minion, amount: 4 }),
    );
    expect(cardsInPlay(afterRound2)).not.toContain(minion); // Defeated by Web Binding's own damage, not its attack.
    // Its own attack never happened at all (§4.1 Q3) — no `damageDealt` sourced from the minion, ever.
    expect(events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === minion)).toBe(false);
  });
});
