import { cardId } from "@mc/content";
import { activeEncounterDeck, activeVillain, remainingHitPoints, type GameState, type InstanceId } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, instancesOf, mainThreat, moveToHand, P1, patchInstance, payWith, play, playerOf, putOnTopOfDeck, settle, stackEncounterDeck, toHero, type Picker } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { DRS_DEPS, forceMinionIntoPlay, runDrs, stackFromSetAside, startDrsGame } from "./testing.js";

/**
 * A picker that never discards `protect` at a "discard down to hand size" check (`endTurn()`'s own end-of-turn
 * step, unrelated to whatever ability a test is exercising — matching `wave1/msm/ms-marvel.test.ts`'s identically
 * shaped `protecting`), and otherwise defers to `firstLegal`.
 */
const protecting =
  (protect: readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "discardDownToHandSize") {
      const safe = choice.options.map((o) => o.optionId).filter((id) => !protect.includes(id as InstanceId));
      return safe.slice(0, choice.minSelections);
    }
    return firstLegal(state);
  };

// Real wave 1 content: the Doctor Strange (Protection) precon against Rhino, standard, solo.
const drsVsRhino = (seed = 4301) => startDrsGame(wave1Scenario("rhino", { players: [{ starterDeckId: "drs-protection" }], seed }));

// A neutral boost card (0 icons, no boost ability) — see `wave1/bkw/nemesis.test.ts`'s own `ADVANCE` doc note:
// `stackFromSetAside` inserts at the absolute top of the encounter deck, so stacking `ADVANCE` after it pushes the
// nemesis card to the second slot, past the villain's own unavoidable enemy-activation boost draw.
const ADVANCE = "01186";

describe("Doctor Strange's nemesis set", () => {
  it("Baron Mordo: milling a [wild]-resource card stuns, damages, and confuses you all at once", () => {
    const start = drsVsRhino();
    const staged = stackFromSetAside(start, P1, "09028");
    const mordo = activeEncounterDeck(staged).deck.find((id) => staged.instances[id]?.cardId === cardId("09028"))!;
    const withMordo = forceMinionIntoPlay(staged, mordo, P1);
    // Wong (09002) has a printed [wild] resource icon: "[wild] All of the above" (stun + 2 damage + confused).
    const { state: stacked } = putOnTopOfDeck(withMordo, P1, "09002");
    const hero = runDrs(stacked, toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const milled = playerOf(stacked, P1).deck[0]!;
    // The minion's own activation attacks P1 during the villain phase (along with the villain's own attack that
    // round); Baron Mordo's Forced Interrupt has no choice of its own to make (mandatory), so `firstLegal` carries
    // the round through untouched. The total damage taken this round isn't just the interrupt's own +2 (Mordo's
    // and Rhino's own basic attacks land too), so only the lower bound is asserted for damage; the two statuses are
    // unambiguous signals of the interrupt itself, since nothing else in this round grants either.
    const after = settle(runDrs(hero, endTurn()), firstLegal, (s) => s.step.phase === "player" && s.round > hero.round, DRS_DEPS);
    expect(inst(after, identity).statuses.stunned).toBeGreaterThan(0);
    expect(inst(after, identity).statuses.confused).toBeGreaterThan(0);
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(damageBefore + 2);
    expect(playerOf(after, P1).discard).toContain(milled);
  });

  it("Open the Dark Dimension: tucks the top Invocation card When Revealed, shuffles it back When Defeated", () => {
    const start = drsVsRhino();
    const staged = stackEncounterDeck(stackFromSetAside(start, P1, "09029"), ADVANCE);
    const before = playerOf(staged, P1).separateDecks["Invocation"]!.deck[0]!;
    const invocationDeckBefore = playerOf(staged, P1).separateDecks["Invocation"]!.deck.length;
    const after = settle(runDrs(staged, endTurn()), firstLegal, (s) => s.step.kind === "turn", DRS_DEPS);
    const scheme = instancesOf(after, "09029")[0]!;
    expect(inst(after, scheme).tucked).toContain(before);
    expect(playerOf(after, P1).separateDecks["Invocation"]!.deck.length).toBe(invocationDeckBefore - 1);

    // Defeat it through a real `removeThreat` (a basic thwart, not a raw threat patch) so the engine's own
    // "threat hit 0" defeat check actually fires. Doctor Strange's hero THW is 2; test surgery only lowers the
    // scheme's threat down to exactly that first, rather than patching it straight to 0.
    const hero = runDrs(after, toHero());
    const lowered = { ...hero, instances: { ...hero.instances, [scheme]: { ...inst(hero, scheme), threat: 2 } } };
    const defeated = settle(
      runDrs(lowered, { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(lowered), schemeInstanceId: scheme }),
      firstLegal,
      undefined,
      DRS_DEPS,
    );
    expect(inst(defeated, scheme).tucked).toHaveLength(0);
    expect(playerOf(defeated, P1).separateDecks["Invocation"]!.deck).toContain(before);
  });

  it("Thoughtcasting (Alter-Ego): discards the highest-cost hand card, places its cost in threat on the main scheme", () => {
    const start = drsVsRhino();
    // Momentum Shift (cost 2, x3) is the highest-cost card reachable in the precon's hand-fillable pool; give the
    // player exactly one hand of known costs so "highest cost" is unambiguous: Wong (3), Momentum Shift (2), The
    // Eye of Agamotto (2), Warning (0).
    const given = moveToHand(start, P1, "09002", "09016", "09011", "09021");
    const [wong] = given.ids as [never, never, never, never];
    const staged = stackEncounterDeck(stackFromSetAside(given.state, P1, "09031"), ADVANCE);
    const before = mainThreat(staged);
    const after = settle(runDrs(staged, endTurn()), protecting([wong]), (s) => s.step.kind === "turn", DRS_DEPS);
    expect(playerOf(after, P1).discard).toContain(wong); // Wong (cost 3) is the highest-cost card in hand
    // At least Wong's printed cost (3) landed as threat; the villain phase's own per-round scheme increase (RRG
    // 1.8 "Place Threat", p. 9) adds on top, so the delta isn't exactly 3.
    expect(mainThreat(after)).toBeGreaterThanOrEqual(before + 3);
  });

  it("Thoughtcasting (Hero): discards the highest-cost hand card, you take its cost in damage", () => {
    const start = drsVsRhino();
    const given = moveToHand(start, P1, "09002", "09016", "09011", "09021");
    const [wong] = given.ids as [never, never, never, never];
    const hero = runDrs(given.state, toHero());
    const staged = stackEncounterDeck(stackFromSetAside(hero, P1, "09031"), ADVANCE);
    const identity = identityOf(staged);
    const damageBefore = inst(staged, identity).damage;
    const after = settle(runDrs(staged, endTurn()), protecting([wong]), (s) => s.step.kind === "turn", DRS_DEPS);
    expect(playerOf(after, P1).discard).toContain(wong);
    // At least Wong's printed cost (3) landed as damage; the villain's own basic attack that round adds on top,
    // so the delta isn't exactly 3.
    expect(inst(after, identity).damage).toBeGreaterThanOrEqual(damageBefore + 3);
  });

  it("Counterspell: cancels the next event's effects (its own cost is still paid) and discards itself", () => {
    const start = drsVsRhino();
    const hero = runDrs(start, toHero());
    // Attach to your hero: reveal it while in hero form so it has a legal host.
    const staged = stackEncounterDeck(stackFromSetAside(hero, P1, "09030"), ADVANCE);
    const identity = identityOf(staged);
    const afterReveal = settle(runDrs(staged, endTurn()), firstLegal, (s) => s.step.kind === "turn", DRS_DEPS);
    const counterspell = instancesOf(afterReveal, "09030")[0]!;
    expect(inst(afterReveal, counterspell).attachedTo).toBe(identity);

    // Momentum Shift (09016): "Hero Action: Heal 2 damage from your hero → deal 2 damage to an enemy." Damage the
    // identity first so its own heal-2 cost is payable.
    const given = moveToHand(afterReveal, P1, "09016");
    const [momentumShift] = given.ids as [InstanceId];
    const damaged = patchInstance(given.state, identity, { damage: 2 });
    const villain = activeVillain(damaged).instanceId;
    const hpBefore = remainingHitPoints(damaged, villain);
    // Counterspell's Forced Interrupt fires automatically (a "Forced" ability is never optional, so there is no
    // `chooseTriggers` prompt to answer, unlike every plain "Response"/"Interrupt" this file's other tests settle).
    const after = settle(runDrs(damaged, play(P1, momentumShift, payWith(damaged, P1, 2, [momentumShift]))), firstLegal, (s) => s.step.kind === "turn", DRS_DEPS);

    // RRG 1.8 "Cancel" (p. 13): "the ability (apart from its effects) is still regarded as initiated, and any
    // costs are still paid" — Momentum Shift's own heal-2 cost still applied, but its effect (2 damage to the
    // villain) never resolved.
    expect(inst(after, identity).damage).toBe(0);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore);
    // "the card is still considered played, and it is discarded" (same citation).
    expect(playerOf(after, P1).discard).toContain(momentumShift);
    // "Then, discard this card": Counterspell itself.
    expect(activeEncounterDeck(after).discard).toContain(counterspell);
    expect(inst(after, counterspell).attachedTo).toBeNull();
  });
});
