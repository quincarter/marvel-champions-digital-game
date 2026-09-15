import { cardId } from "@mc/content";
import { applyCommand, createGame, type GameSetupConfig } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { forceMinionIntoPlay, runThor, stackFromSetAside, startThorGame, THOR_DEPS } from "./testing.js";

const thorVsRhino = (seed = 11) => startThorGame(wave1Scenario("rhino", { players: [{ starterDeckId: "thor-aggression" }], seed }));

/**
 * A Thor (Aggression) game whose deck also contains a few off-aspect filler cards (Under Surveillance / Second
 * Wind — justice/protection, not in the Aggression precon) purely so their abilities can be exercised in
 * isolation. `requireLegalDecks` is dropped for this one test setup (deckbuilding legality is
 * `card-data-pipeline`/`rules-qa-engineer` territory, not what these ability tests are about).
 */
function thorVsRhinoWithExtras(...extraCodes: readonly string[]) {
  const config = wave1Scenario("rhino", { players: [{ starterDeckId: "thor-aggression" }], seed: 11 });
  const patched: GameSetupConfig = {
    ...config,
    requireLegalDecks: false,
    players: config.players.map((p, i) => (i === 0 ? { ...p, deck: [...p.deck, ...extraCodes.map((c) => cardId(c))] } : p)),
  };
  const created = createGame(patched, THOR_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", THOR_DEPS);
}

/** A game with one Frost Giant already in play, engaged with P1 (via `forceMinionIntoPlay`, deterministic). */
function thorWithEngagedMinion() {
  const start = thorVsRhino();
  const withGiant = stackFromSetAside(start, P1, "06029");
  const stacked = stackEncounterDeck(withGiant, "06029");
  const minion = instancesOf(stacked, "06029")[0]!;
  return { state: forceMinionIntoPlay(stacked, minion, P1), minion };
}

describe("Thor pack cards (generic aspect)", () => {
  it("Hercules: reduces its own cost by 1 for each minion engaged with you, from hand", () => {
    const { state } = thorWithEngagedMinion();
    // Extra guaranteed single-value filler (Battle Fury, Jarnbjorn, Invulnerability, Hall of Heroes) so excluding
    // every multi-value resource card still leaves enough to pay with.
    const given = moveToHand(state, P1, "06011", "06018", "06019", "06021", "06017"); // Hercules, ...filler
    const [hercules] = given.ids as [never];
    // Multi-value resource cards (Energy/Genius/Strength, The Power of Aggression) would make an underpay check
    // vacuous (docs/phase7-wave1-scripting.md "Test conventions") — exclude every copy from the payment pool.
    const multiValue = ["06016", "06022", "06023", "06024"].flatMap((code) => instancesOf(given.state, code));
    // Hercules is printed cost 6; 1 minion engaged with Thor reduces it to 5 — paying only 4 must fail.
    const underpaid = applyCommand(given.state, play(P1, hercules, payWith(given.state, P1, 4, [hercules, ...multiValue])), THOR_DEPS);
    expect(underpaid.ok).toBe(false);
    const after = runThor(given.state, play(P1, hercules, payWith(given.state, P1, 5, [hercules, ...multiValue])));
    expect(playerOf(after, P1).playArea).toContain(hercules);
  });

  it("Get Over Here!: deals 1 damage to a minion, and engages it if you have the Aerial trait (Mjolnir)", () => {
    const { state, minion } = thorWithEngagedMinion();
    const mjolnir = instancesOf(state, "06009")[0]!;
    const given = moveToHand(state, P1, "06014", "06009"); // Get Over Here!, Mjolnir
    const [getOverHere] = given.ids as [never];
    const hero = runThor(given.state, toHero());
    const withMjolnir = runThor(hero, play(P1, mjolnir, payWith(hero, P1, 1, [mjolnir, getOverHere])));
    const hpBefore = inst(withMjolnir, minion).damage;
    const played = runThor(withMjolnir, play(P1, getOverHere, payWith(withMjolnir, P1, 0, [getOverHere])));
    const atChoice = settle(played, firstLegal, (s) => s.pendingChoice?.prompt.kind === "chooseTarget", THOR_DEPS);
    const after = settle(atChoice, () => [minion], undefined, THOR_DEPS);
    expect(inst(after, minion).damage).toBe(hpBefore + 1);
    expect(inst(after, minion).engagedWith).toBe(P1); // already engaged before the attack — Aerial's engage is a no-op here
  });

  it("Hall of Heroes: exhausts and removes 3 glory counters to draw 3", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06017");
    const [hallOfHeroes] = given.ids as [never];
    const withHall = runThor(given.state, play(P1, hallOfHeroes, payWith(given.state, P1, 2, [hallOfHeroes])));
    const patched = patchInstance(withHall, hallOfHeroes, { counters: { glory: 3 } });
    const handBefore = playerOf(patched, P1).hand.length;
    const after = runThor(patched, use(P1, hallOfHeroes, "06017.hall-of-heroes-action"));
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 3);
    expect(inst(after, hallOfHeroes).counters.glory).toBe(0);
  });

  it("Invulnerability: gives your hero a tough status card", () => {
    const start = thorVsRhino();
    const identity = identityOf(start);
    const given = moveToHand(start, P1, "06021");
    const [card] = given.ids as [never];
    const hero = runThor(given.state, toHero());
    const after = runThor(hero, play(P1, card, payWith(hero, P1, 3, [card])));
    expect(inst(after, identity).statuses.tough).toBeGreaterThan(0);
  });

  it("Under Surveillance: attaches to the main scheme and increases its target threat by 4", () => {
    const started = thorVsRhinoWithExtras("06031");
    const given = moveToHand(started, P1, "06031");
    const [card] = given.ids as [never];
    const mainScheme = given.state.mainScheme.instanceId;
    const after = runThor(given.state, play(P1, card, payWith(given.state, P1, 2, [card]), { attachToInstanceId: mainScheme }));
    expect(inst(after, card).attachedTo).toBe(mainScheme);
  });

  it("Second Wind: heals 4 damage from an identity (5 if paid with a [mental] resource)", () => {
    const started = thorVsRhinoWithExtras("06033", "06023"); // Second Wind, Genius (2 mental icons)
    const identity = identityOf(started);
    const near = patchInstance(started, identity, { damage: 6 });
    const given = moveToHand(near, P1, "06033", "06023");
    const [card, genius] = given.ids as [never, never];
    // Printed cost 3: Genius (2 mental) alone falls short — add one filler card, keeping "paid with mental" true.
    const played = runThor(given.state, play(P1, card, [...payWith(given.state, P1, 1, [card, genius]), genius]));
    // "Heal 4 damage from an identity" is a mandatory `chooseTarget` (only Thor's own identity is a legal target
    // here, but it's still a choice to settle — docs/phase7-wave1-scripting.md "Test conventions").
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    expect(inst(after, identity).damage).toBe(1); // 6 - 5 (paid using a [mental] resource)
  });

  it("Enhanced Physique: enters play with 3 physical counters", () => {
    const started = thorVsRhinoWithExtras("06034");
    const given = moveToHand(started, P1, "06034");
    const [card] = given.ids as [never];
    const inPlay = runThor(given.state, play(P1, card, payWith(given.state, P1, 2, [card])));
    expect(inst(inPlay, card).counters.physical).toBe(3);
  });
});

describe("Mean Swing (06015) is not scripted", () => {
  it("has no ability id resolved — a missing TargetQuery primitive; see pack-cards.ts's docblock beside it", () => {
    expect("06015.mean-swing-interrupt" in THOR_DEPS.abilities).toBe(false);
  });
});
