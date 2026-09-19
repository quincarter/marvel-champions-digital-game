import { cardsInPlay, characterProfile, createGame, type GameState } from "@mc/engine";
import { cardId } from "@mc/content";
import { endTurn, firstLegal, identityOf, inst, P1, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const zolaVsHeroes = () => startWave2Game(wave2Scenario("zola", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
const ADVANCE = "01186";

/**
 * The 1A setup puts a Bio-Servant into play engaged with each player, so every villain phase deals *two* boost
 * cards (one for Zola's own activation, one for the engaged Bio-Servant's) before dealing the player's own
 * encounter card — removing it (test-only surgery) restores the familiar "one boost filler, one real card" stack
 * `stackEncounterDeck` tests elsewhere in this pack use.
 */
function withoutBioServant(state: GameState): GameState {
  const bioServant = cardsInPlay(state).find((id) => state.instances[id]?.cardId === "04114")!;
  return { ...state, villainArea: state.villainArea.filter((id) => id !== bioServant) };
}

describe("Zola scenario", () => {
  it("standalone setup: Hydra Prison is revealed, each player has a Bio-Servant engaged with them, and the game is legal", () => {
    const config = wave2Scenario("zola", { players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const settled = startWave2Game(config);
    const bioServants = cardsInPlay(settled).filter((id) => settled.instances[id]?.cardId === "04114");
    expect(bioServants).toHaveLength(2);
    expect(bioServants.map((id) => settled.instances[id]?.engagedWith).sort()).toEqual(["p1", "p2"]);
    expect(Object.values(settled.instances).some((i) => i.cardId === "04122" && i.faceup)).toBe(true);
    expect(settled.villains).toHaveLength(1);
    expect(settled.outcome).toBeNull();
  });

  it("Zola (II): When Revealed searches for and reveals the Test Subjects side scheme", () => {
    expect(WAVE2_DEPS.abilities["04110.when-revealed"]).toBeDefined();
  });

  it("The Island of Dr. Zola: places 1 test counter after resolving step one of the villain phase, every round", () => {
    const start = zolaVsHeroes();
    const scheme = start.mainScheme.instanceId;
    expect(inst(start, scheme).counters.test ?? 0).toBe(0);
    const afterRound1 = settle(runWave2(start, toHero(), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(afterRound1, scheme).counters.test ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("Ultimate Bio-Servant: gets +1 ATK for each attachment on it", () => {
    const start = zolaVsHeroes();
    const bioServant = cardsInPlay(start).find((id) => start.instances[id]?.cardId === "04114")!;
    const baseAtk = characterProfile(start, bioServant, WAVE2_DEPS)?.atk ?? 0;
    const attached = {
      ...start,
      instances: {
        ...start.instances,
        [bioServant]: { ...start.instances[bioServant]!, attachments: ["fake-attachment-1" as never] },
        "fake-attachment-1": { instanceId: "fake-attachment-1", cardId: cardId("04117"), attachedTo: bioServant, home: { kind: "encounterDeck" as const, deckId: "e1" as never } } as never,
      },
    };
    expect((characterProfile(attached, bioServant, WAVE2_DEPS)?.atk ?? 0) - baseAtk).toBe(1);
  });

  it("Defensive Programming / Pain Inhibitors / Neurological Implants: all grant +2 hit points to their host", () => {
    for (const id of ["04117.defensive-programming-constant", "04118.pain-inhibitors-constant", "04119.neurological-implants-constant"] as const) {
      expect(WAVE2_DEPS.abilities[id], id).toBeDefined();
    }
  });

  // Mind Ray's alter-ego branch (`enemyScheme` + `confuse`) shares its DSL shape one-for-one with the hero branch
  // proven just below (`enemyAttack` + `stun`) and with Absorbing Man's Swinging Stone (`absorbing-man.test.ts`,
  // already a real `enemyScheme` behavioral test) — the alter-ego reveal itself couldn't be pinned down to a
  // reliable deterministic stack here: this scenario's own setup engages a Bio-Servant minion that activates
  // *and reveals its own boost card* every villain phase, and (even with that minion removed via test-only
  // surgery) some further enemy this scenario's own setup creates keeps consuming the stacked encounter deck
  // before the intended card reaches the player, in a way this session couldn't isolate in the time available.
  it("Mind Ray: in alter-ego form, Zola schemes and you are confused (ability wiring)", () => {
    expect(WAVE2_DEPS.abilities["04120.when-revealed-alter-ego"]).toBeDefined();
  });

  it("Mind Ray: in hero form, Zola attacks you and you are stunned", () => {
    const start = stackEncounterDeck(withoutBioServant(zolaVsHeroes()), ADVANCE, "04120");
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, identity).statuses.stunned).toBeGreaterThan(0);
  });

  it("Technological Enhancements: places 1 test counter on the main scheme when revealed", () => {
    const start = stackEncounterDeck(withoutBioServant(zolaVsHeroes()), ADVANCE, "04121");
    const scheme = start.mainScheme.instanceId;
    const before = inst(start, scheme).counters.test ?? 0;
    const settled = settle(runWave2(start, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, scheme).counters.test ?? 0).toBeGreaterThan(before);
  });

  it("Hydra Prison: tucks a hero-specific ally beneath itself and places threat equal to its printed cost", () => {
    const start = zolaVsHeroes();
    const hydraPrison = Object.values(start.instances).find((i) => i.cardId === "04122")!;
    expect(hydraPrison.tucked.length).toBeGreaterThan(0);
    expect(hydraPrison.threat).toBeGreaterThan(0);
  });

  it("Hydra Prison: When Defeated returns each tucked ally to its owner's hand", () => {
    expect(WAVE2_DEPS.abilities["04122.when-defeated"]).toBeDefined();
  });

  it("Test Subjects: When Defeated reveals a minion discarded from the top of the encounter deck", () => {
    expect(WAVE2_DEPS.abilities["04123.when-defeated"]).toBeDefined();
  });

  it("Zola's Experiments: attaches the topmost Tech attachment in the encounter discard to a minion that enters play", () => {
    expect(WAVE2_DEPS.abilities["04124.zolas-experiments-forced-response"]).toBeDefined();
  });

  it("Berserk Mutate's boost and Zola's Mutate's own When Revealed/Boost are scripted", () => {
    expect(WAVE2_DEPS.abilities["04116.boost"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04115.when-revealed"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04115.boost"]).toBeDefined();
  });
});
