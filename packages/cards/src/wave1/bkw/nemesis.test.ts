import { cardId } from "@mc/content";
import { activeEncounterDeck, characterProfile, type GameState } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  mainThreat,
  moveToHand,
  P1,
  payWith,
  picking,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  threatOn,
  toHero,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { BKW_DEPS, forceMinionIntoPlay, runBkw, stackFromSetAside, startBkwGame } from "./testing.js";

// Real wave 1 content: the Black Widow (Justice) precon against Rhino, standard, solo.
const bkwVsRhino = (seed = 4201) => startBkwGame(wave1Scenario("rhino", { players: [{ starterDeckId: "bkw-justice" }], seed }));

// A neutral boost card (0 icons, no boost ability): "Advance" — see `black-widow.test.ts`'s own `ADVANCE` doc note.
// `stackFromSetAside` always inserts at the absolute top of the encounter deck, so stacking `ADVANCE` *after* it
// (via `stackEncounterDeck`, which also inserts at the top) pushes the nemesis card to the second slot — exactly the
// order needed for the villain's own unavoidable enemy-activation boost draw to consume `ADVANCE` first, leaving the
// nemesis card for the per-player reveal (see `atRevealStep`'s doc comment).
const ADVANCE = "01186";

/** Runs `endTurn()` and stops the moment the villain phase reaches its "reveal encounter cards" step — after the
 * villain's own enemy activation (attack or scheme, with its own boost draw) but before the per-player card at the
 * top of the deck is dealt/revealed. Isolates a stacked card's own effect from the villain's unavoidable collateral
 * activation each round (`packages/engine/src/villain/phase.ts`'s step order: `enemyActivations` before
 * `dealEncounterCards`/`revealEncounterCards`). */
const atRevealStep = (state: GameState): GameState => settle(runBkw(state, endTurn()), firstLegal, (s) => s.step.kind === "revealEncounterCards", BKW_DEPS);

describe("Black Widow's nemesis set", () => {
  it("Taskmaster: gets +1 SCH and +1 ATK for each upgrade controlled by the player it's engaged with", () => {
    const start = bkwVsRhino();
    const staged = stackFromSetAside(start, P1, "08026");
    const taskmaster = activeEncounterDeck(staged).deck.find((id) => staged.instances[id]?.cardId === cardId("08026"))!;
    const withTaskmaster = forceMinionIntoPlay(staged, taskmaster, P1);
    const before = characterProfile(withTaskmaster, taskmaster, BKW_DEPS)!;
    expect(before.atk).toBe(0);
    expect(before.sch).toBe(0);

    const given = moveToHand(withTaskmaster, P1, "08008", "08009"); // Grappling Hook, Synth-Suit — 2 upgrades
    const [hook, suit] = given.ids as [never, never];
    const hero = runBkw(given.state, toHero());
    const withHook = settle(runBkw(hero, play(P1, hook, payWith(hero, P1, 2, [hook, suit]))), firstLegal, undefined, BKW_DEPS);
    const withBoth = settle(runBkw(withHook, play(P1, suit, payWith(withHook, P1, 3, [suit]))), firstLegal, undefined, BKW_DEPS);
    const after = characterProfile(withBoth, taskmaster, BKW_DEPS)!;
    expect(after.atk).toBe(2);
    expect(after.sch).toBe(2);
  });

  it("Killer for Hire: When Revealed places an additional 1 threat per hero here", () => {
    const start = bkwVsRhino();
    const staged = stackEncounterDeck(stackFromSetAside(start, P1, "08027"), ADVANCE);
    const after = settle(runBkw(staged, endTurn()), firstLegal, (s) => s.step.kind === "turn", BKW_DEPS);
    const killerForHire = instancesOf(after, "08027")[0]!;
    // startingThreat base 3 + 1 per hero (1 player) = 4.
    expect(threatOn(after, killerForHire)).toBe(4);
  });

  it("Deadly Shot (Alter-Ego): discards a controlled upgrade and places 1 threat on the main scheme", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08008"); // Grappling Hook, an upgrade to discard
    const [hook] = given.ids as [never];
    const withHook = settle(runBkw(given.state, play(P1, hook, payWith(given.state, P1, 2, [hook]))), firstLegal, undefined, BKW_DEPS);
    const staged = stackEncounterDeck(stackFromSetAside(withHook, P1, "08029"), ADVANCE);
    const atReveal = atRevealStep(staged);
    const before = mainThreat(atReveal);
    const after = settle(atReveal, picking(hook), (s) => s.step.kind === "turn", BKW_DEPS);
    expect(playerOf(after, P1).discard).toContain(hook);
    expect(mainThreat(after)).toBe(before + 1);
  });

  it("Deadly Shot (Hero): discards a controlled upgrade and you take 1 damage", () => {
    const start = bkwVsRhino();
    const given = moveToHand(start, P1, "08008");
    const [hook] = given.ids as [never];
    const hero = runBkw(given.state, toHero());
    const withHook = settle(runBkw(hero, play(P1, hook, payWith(hero, P1, 2, [hook]))), firstLegal, undefined, BKW_DEPS);
    const staged = stackEncounterDeck(stackFromSetAside(withHook, P1, "08029"), ADVANCE);
    const atReveal = atRevealStep(staged);
    const damageBefore = inst(atReveal, identityOf(atReveal)).damage;
    const after = settle(atReveal, picking(hook), (s) => s.step.kind === "turn", BKW_DEPS);
    expect(playerOf(after, P1).discard).toContain(hook);
    expect(inst(after, identityOf(after)).damage).toBe(damageBefore + 1);
  });
});

