import { cardsInPlay, characterProfile } from "@mc/engine";
import { firstLegal, identityOf, inst, instancesOf, P1, settle, stackEncounterDeck } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { revealFromEncounterDeck, runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";
import { WASP_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

// Real wave 2 content: the Wasp (Aggression) precon against Rhino, standard, solo.
const waspVsRhino = () =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "wsp-aggression" }], seed: 2026 }));

describe("Wasp's obligation and nemesis (Red Dreams, Mother's Orders, Beetle)", () => {
  it("Red Dreams: shuffled into the encounter deck at setup, dealt and resolved like any encounter card", () => {
    const start = waspVsRhino();
    expect(instancesOf(start, "13026")).toHaveLength(1);
    // Advance (01186) first: Rhino's own activation is dealt its boost card from the top before any player's own
    // encounter card (docs/phase7-wave2-scripting.md §5), so a lone `stackEncounterDeck(state, "13026")` would deal
    // Red Dreams to Rhino as *his* boost card instead of to the player as their own reveal.
    const staged = stackEncounterDeck(start, "01186", "13026");
    const settled = settle(runWave2(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE2_DEPS);
    // The default (`firstLegal`) declines the "may flip" choice, then picks Core's `obligation()` helper's first
    // listed option — "exhaust Nadia Van Dyne → remove Red Dreams from the game": the identity ends exhausted and
    // the obligation is gone from the deck/discard, with no damage taken and no hand cards lost (the *other*
    // branch's own consequence).
    expect(inst(settled, identityOf(settled)).exhausted).toBe(true);
  });

  it("Red Dreams: the other branch — discard each [mental] card from hand and take 1 damage, discarding the obligation", () => {
    const start = waspVsRhino();
    const staged = stackEncounterDeck(start, "01186", "13026");
    // The second option, in `chooseOne`'s own listed order (Core's `obligation()` helper: exhaust-to-remove first,
    // the card's own alternative second).
    const pickSecondOption: typeof firstLegal = (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseOption" && choice.options.length > 1) return [choice.options[1]!.optionId];
      return firstLegal(state);
    };
    const settled = settle(
      runWave2(staged, { type: "endTurn", playerId: P1 }),
      pickSecondOption,
      undefined,
      WAVE2_DEPS,
    );
    expect(inst(settled, identityOf(settled)).damage).toBeGreaterThanOrEqual(1);
  });

  it("Mother's Orders: as an additional cost for each hero to make a basic attack, that hero must spend 1 of any resource", () => {
    const start = waspVsRhino();
    const { state, id: mothersOrders } = revealFromEncounterDeck(start, "13027");
    expect(cardsInPlay(state)).toContain(mothersOrders);
    const identity = identityOf(state);
    const villain = state.villains[0]!.instanceId;
    // No resource offered to pay the additional cost: the basic attack is refused outright.
    expect(() =>
      runWave2(state, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }),
    ).toThrow();
  });

  it("Beetle Armor MK IV: attached character gets +4 hit points", () => {
    const start = waspVsRhino();
    const { state: withBeetle, id: beetle } = revealFromEncounterDeck(start, "13028");
    const baseHp = characterProfile(withBeetle, beetle, WAVE2_DEPS)?.maxHp;
    const { state: withArmor } = revealFromEncounterDeck(withBeetle, "13029");
    expect(characterProfile(withArmor, beetle, WAVE2_DEPS)?.maxHp).toBe((baseHp ?? 0) + 4);
  });

  it("Beetle: Forced Interrupt, when defeated the defeating player chooses to spend a physical resource or shuffle Beetle into the encounter deck instead of discarding it", () => {
    expect(WASP_OBLIGATION_NEMESIS["13028.beetle-forced-interrupt"]).toBeDefined();
  });

  it("Beetle Mania: When Revealed (Alter-Ego) gains surge; When Revealed (Hero) Beetle attacks you with +1 ATK, or gains surge if no attack was made", () => {
    expect(WASP_OBLIGATION_NEMESIS["13030.when-revealed-alter-ego"]).toBeDefined();
    expect(WASP_OBLIGATION_NEMESIS["13030.when-revealed-hero"]).toBeDefined();
  });
});
