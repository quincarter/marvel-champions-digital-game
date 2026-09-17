import { activeEncounterDeck, activeVillain, applyCommand, characterProfile, remainingHitPoints, traitsOf } from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { TRAIT } from "../../dsl/index.js";
import { wave1Scenario } from "../setup.js";
import { runThor, stackFromSetAside, startThorGame, THOR_DEPS } from "./testing.js";

// Real wave 1 content: the Thor (Aggression) precon against Rhino, standard, solo.
const thorVsRhino = (seed = 11) => startThorGame(wave1Scenario("rhino", { players: [{ starterDeckId: "thor-aggression" }], seed }));

describe("Thor kit", () => {
  it('"Have at thee!": draws 2 cards after you engage a minion (limit once per phase)', () => {
    const start = thorVsRhino();
    // Engage a minion deterministically via Defender of the Nine Realms's own "put into play engaged with you"
    // (rather than a real villain phase, whose further unrelated encounter reveals would make the hand-size delta
    // noisy) — Frost Giant (06029, Thor's own nemesis set) is set aside at setup, not shuffled into a plain Rhino
    // game (no "Shadow of the Past" in play), so it's pulled to the top directly (`stackFromSetAside`).
    const given = moveToHand(start, P1, "06003"); // Defender of the Nine Realms
    const [card] = given.ids as [never];
    const withGiants = stackFromSetAside(given.state, P1, "06029", "06029");
    const stacked = stackEncounterDeck(withGiants, "06029", "06029");
    const hero = runThor(stacked, toHero());
    const identity = identityOf(hero);
    const handBefore = playerOf(hero, P1).hand.length; // includes the card about to be played
    const played = runThor(hero, play(P1, card, payWith(hero, P1, 0, [card])));
    const after = settle(played, picking(`${identity}:06001a.have-at-thee`), undefined, THOR_DEPS);
    // -1 for the played card leaving hand to resolve, +2 for "Have at thee!"'s draw.
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 + 2);
  });

  it("Worthy: searches deck and discard for Mjolnir into hand (limit once per round)", () => {
    const start = thorVsRhino();
    const mjolnir = instancesOf(start, "06009")[0]!;
    expect(playerOf(start, P1).hand).not.toContain(mjolnir);
    const identity = identityOf(start);
    const after = runThor(start, use(P1, identity, "06001b.worthy"));
    expect(playerOf(after, P1).hand).toContain(mjolnir);

    // Limit once per round: putting Mjolnir back on the deck and trying again is still rejected.
    const given = putOnTopOfDeck(after, P1, "06009");
    const rejected = applyCommand(given.state, use(P1, identity, "06001b.worthy"), THOR_DEPS);
    expect(rejected.ok).toBe(false);
  });

  it("Lady Sif: readies Thor/Odinson when she enters play", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06002");
    const [sif] = given.ids as [never];
    const identity = identityOf(given.state);
    const exhausted = patchInstance(given.state, identity, { exhausted: true });
    const played = runThor(exhausted, play(P1, sif, payWith(exhausted, P1, 4, [sif])));
    // Response is optional (RRG "Response") even with no "you may" — take it via `chooseTriggers`.
    const after = settle(played, picking(`${sif}:06002.lady-sif-response`), undefined, THOR_DEPS);
    expect(inst(after, identity).exhausted).toBe(false);
  });

  it("Defender of the Nine Realms: discards until a minion, puts it into play engaged, removes 3 threat", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06003");
    const [card] = given.ids as [never];
    const withGiants = stackFromSetAside(given.state, P1, "06029", "06029");
    const stacked = stackEncounterDeck(withGiants, "06029", "06029"); // both copies of Frost Giant on top
    const hero = runThor(stacked, toHero());
    const before = activeEncounterDeck(hero).deck.length;
    const played = runThor(hero, play(P1, card, payWith(hero, P1, 0, [card])));
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    // The first Frost Giant on top was discarded to find it (a minion), then put into play engaged with the player.
    const frostGiants = instancesOf(after, "06029");
    const engaged = frostGiants.find((id) => inst(after, id).engagedWith === P1);
    expect(engaged).toBeDefined();
    expect(activeEncounterDeck(after).deck.length).toBeLessThan(before);
  });

  it("For Asgard!: searches deck and discard for a chosen Asgard card into hand", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06004");
    const [card] = given.ids as [never];
    const helmet = instancesOf(start, "06010")[0]!; // Thor's Helmet, an Asgard upgrade
    const played = runThor(given.state, play(P1, card, payWith(given.state, P1, 1, [card])));
    const atChoice = settleUntil(played, "chooseCards", firstLegal, THOR_DEPS);
    expect(atChoice.pendingChoice?.options.map((o) => o.optionId)).toContain(helmet);
    const after = settle(answer(atChoice, [helmet], THOR_DEPS), firstLegal, undefined, THOR_DEPS);
    expect(playerOf(after, P1).hand).toContain(helmet);
  });

  it("Hammer Throw: exhausts Mjolnir, deals 8 overkill damage, returns Mjolnir to hand", () => {
    const start = thorVsRhino();
    const mjolnir = instancesOf(start, "06009")[0]!;
    const given = moveToHand(start, P1, "06005"); // Hammer Throw
    const [throwCard] = given.ids as [never];
    const withMjolnir = moveToHand(given.state, P1, "06009").state;
    const hero = runThor(withMjolnir, toHero());
    const inPlay = runThor(hero, play(P1, mjolnir, payWith(hero, P1, 1, [mjolnir, throwCard])));
    const villain = activeVillain(inPlay).instanceId;
    const hpBefore = remainingHitPoints(inPlay, villain, THOR_DEPS);
    const played = runThor(inPlay, play(P1, throwCard, payWith(inPlay, P1, 3, [throwCard, mjolnir]), { costChoices: { exhausted: [mjolnir] } }));
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    expect(remainingHitPoints(after, villain, THOR_DEPS)).toBe(hpBefore! - 8);
    expect(playerOf(after, P1).hand).toContain(mjolnir);
    expect(inst(after, mjolnir).attachedTo).toBeNull();
  });

  it("Lightning Strike: spends X energy, deals X damage to the villain and each minion engaged with you", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06006", "06022"); // Lightning Strike, Energy (2 energy icons)
    const [strike, energyCard] = given.ids as [never, never];
    const hero = runThor(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain, THOR_DEPS);
    // Paying the printed cost (1) entirely with the Energy card (2 energy) leaves X = 1 (`resourcesX` reads the
    // pool left over after the fixed requirement, `packages/engine/src/actions.ts` `resourceVars`).
    const played = runThor(hero, play(P1, strike, [energyCard]));
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    expect(remainingHitPoints(after, villain, THOR_DEPS)).toBe(hpBefore! - 1);
  });

  it("Thor's Helmet: +5 hit points while in play", () => {
    const start = thorVsRhino();
    const identity = identityOf(start);
    const hpBefore = remainingHitPoints(start, identity, THOR_DEPS)!;
    const given = moveToHand(start, P1, "06010");
    const [helmet] = given.ids as [never];
    const after = runThor(given.state, play(P1, helmet, payWith(given.state, P1, 2, [helmet])));
    expect(remainingHitPoints(after, identity, THOR_DEPS)).toBe(hpBefore + 5);
  });

  it("Mjolnir: +1 ATK and gains the Aerial trait while in play", () => {
    const start = thorVsRhino();
    const identity = identityOf(start);
    const hero = runThor(start, toHero());
    const atkBefore = characterProfile(hero, identity, THOR_DEPS)!.atk;
    const given = moveToHand(hero, P1, "06009");
    const [mjolnir] = given.ids as [never];
    const after = runThor(given.state, play(P1, mjolnir, payWith(given.state, P1, 1, [mjolnir])));
    expect(inst(after, mjolnir).attachedTo).toBe(identity);
    expect(characterProfile(after, identity, THOR_DEPS)!.atk).toBe(atkBefore + 1);
    expect(traitsOf(after, identity, THOR_DEPS)).toContain(TRAIT.AERIAL);
  });
});
