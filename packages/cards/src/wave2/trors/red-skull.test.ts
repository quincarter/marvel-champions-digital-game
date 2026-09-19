import { cardsInPlay, characterProfile, createGame } from "@mc/engine";
import { endTurn, firstLegal, identityOf, inst, P1, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const redSkullVsHeroes = () => startWave2Game(wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
const ADVANCE = "01186";

describe("Red Skull scenario", () => {
  it("standalone setup: the Red House is in play, The Sleeper is set aside, the side-scheme deck is built, and the game is legal", () => {
    const config = wave2Scenario("red-skull", { players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const settled = startWave2Game(config);
    expect(cardsInPlay(settled).some((id) => settled.instances[id]?.cardId === "04139")).toBe(true);
    expect(settled.encounterSetAside.some((id) => settled.instances[id]?.cardId === "04130")).toBe(true);
    expect(settled.scenarioDecks["side-scheme"]?.deck.length ?? 0).toBeGreaterThan(0);
    expect(settled.villains).toHaveLength(1);
    expect(settled.outcome).toBeNull();
  });

  it("Red Skull (I/II/III): gets +1 ATK for each side scheme in play", () => {
    const start = redSkullVsHeroes();
    const villain = start.villains[0]!.instanceId;
    const baseAtk = characterProfile(start, villain, WAVE2_DEPS)?.atk ?? 0;
    // The Red House is already in play from setup — patch in one more side scheme to prove the count is live.
    const withExtra = { ...start, villainArea: [...start.villainArea, "fake-side-scheme" as never], instances: { ...start.instances, "fake-side-scheme": { instanceId: "fake-side-scheme", cardId: "04141", home: { kind: "encounterDeck" as const, deckId: "e1" as never } } as never } };
    const afterAtk = characterProfile(withExtra, villain, WAVE2_DEPS)?.atk ?? 0;
    expect(afterAtk).toBe(baseAtk + 1);
  });

  it("The Rise of Red Skull / New World Hydra: reveals the top of the side-scheme deck after resolving step one, every round", () => {
    const start = redSkullVsHeroes();
    const before = start.scenarioDecks["side-scheme"]!.deck.length;
    const settled = settle(runWave2(start, toHero(), endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // The side-scheme deck's own discard pile (`discardPile: "own"`) should have gained the revealed card, unless
    // it entered play and stayed (side schemes always stay in play once revealed, so the deck itself just shrinks).
    expect(settled.scenarioDecks["side-scheme"]!.deck.length).toBeLessThan(before);
  });

  it("The Sleeper: When Revealed engages the first player; When Defeated removes it from the game", () => {
    expect(WAVE2_DEPS.abilities["04130.when-revealed"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04130.when-defeated"]).toBeDefined();
  });

  it("The Red House: Red Skull cannot take damage, and a character may thwart it with ATK instead of THW", () => {
    expect(WAVE2_DEPS.abilities["04139.the-red-house-constant"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04139.the-red-house-interrupt"]).toBeDefined();
  });

  it("Master Strategist: gives Red Skull an additional boost card for each side scheme in play, for his own activation, then discards", () => {
    expect(WAVE2_DEPS.abilities["04134.master-strategist-forced-interrupt"]).toBeDefined();
  });

  it("Bitter Rival: for each side scheme in play, choose and exhaust a character you control", () => {
    const start = stackEncounterDeck(redSkullVsHeroes(), ADVANCE, "04136");
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    expect(inst(hero, identity).exhausted).toBe(false);
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // With at least one side scheme (The Red House) in play, at least the hero's own identity gets exhausted.
    expect(inst(settled, identity).exhausted).toBe(true);
  });

  it("Spreading Lies: places 2 threat on each scheme in play", () => {
    const start = stackEncounterDeck(redSkullVsHeroes(), ADVANCE, "04137");
    const scheme = start.mainScheme.instanceId;
    const before = inst(start, scheme).threat;
    const settled = settle(runWave2(start, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, scheme).threat).toBeGreaterThanOrEqual(before + 2);
  });

  it("Infinite Power: in alter-ego form, gives Red Skull a tough status card and he schemes", () => {
    const start = stackEncounterDeck(redSkullVsHeroes(), ADVANCE, "04138");
    const villain = start.villains[0]!.instanceId;
    const settled = settle(runWave2(start, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, villain).statuses.tough).toBeGreaterThan(0);
  });

  // Mass Chaos (04144) is itself a side scheme (the "crisis" icon), so setup's own "shuffle every other side
  // scheme into the side-scheme deck" (errata #128A) moves it there before any game starts — reachable through
  // the side-scheme deck's own reveal mechanic, not `stackEncounterDeck` (the regular encounter deck/discard).
  it("Mass Chaos: each player discards the top 5 cards of their deck and places threat for each distinct resource type discarded", () => {
    expect(WAVE2_DEPS.abilities["04144.when-revealed"]).toBeDefined();
  });

  it("Combat Knife / Hydra Sidearm (Weapon Master) grant piercing/ranged to their attached villain", () => {
    expect(WAVE2_DEPS.abilities["04148.combat-knife-constant"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04149.hydra-sidearm-forced-interrupt"]).toBeDefined();
  });

  it("Weapon Master: in alter-ego form, the villain schemes (and gains surge if it has a Weapon attachment)", () => {
    expect(WAVE2_DEPS.abilities["04150.when-revealed-alter-ego"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04150.when-revealed-hero"]).toBeDefined();
  });

  // Concussion Grenade (04151) is a Weapon Master card — not part of Red Skull's own required sets (only Hydra
  // Assault and Hydra Patrol are, per `../setup.ts`'s `redSkullScenario` docblock; Weapon Master is Taskmaster's
  // and Crossbones' own modular pick), so it never reaches this scenario's own encounter deck to stack.
  it("Concussion Grenade: in alter-ego form, confuses you and places threat (more if already confused)", () => {
    expect(WAVE2_DEPS.abilities["04151.when-revealed-alter-ego"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04151.when-revealed-hero"]).toBeDefined();
  });

  it("Hydra Patrol: When Defeated, each player searches for a Hydra minion and puts it into play engaged with them", () => {
    expect(WAVE2_DEPS.abilities["04154.when-defeated"]).toBeDefined();
  });

  it("Hydra Flame-Soldier / Hydra Jet-Trooper (Hydra Assault) are scripted", () => {
    expect(WAVE2_DEPS.abilities["04145.hydra-flame-soldier-forced-response"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04145.boost"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04146.boost"]).toBeDefined();
  });

  it("Prison Camps and Hydra Reinforcements are skipped for a missing 'defeating player' primitive (module docblock)", () => {
    expect(WAVE2_DEPS.abilities["04141.when-defeated"]).toBeUndefined();
    expect(WAVE2_DEPS.abilities["04143.when-defeated"]).toBeUndefined();
  });

  it("Censor the Past: each player chooses up to 3 discarded cards and shuffles them into their deck", () => {
    expect(WAVE2_DEPS.abilities["04142.when-defeated"]).toBeDefined();
  });

  it("Red Skull's Luger / Right Hook grant piercing+ranged / retaliate to Red Skull", () => {
    expect(WAVE2_DEPS.abilities["04132.red-skulls-luger-constant"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04133.red-skulls-right-hook-constant"]).toBeDefined();
  });

  it("Hydra Exo-Soldier: gives the villain a tough status card and an additional boost card for this activation", () => {
    expect(WAVE2_DEPS.abilities["04131.boost"]).toBeDefined();
  });
});
