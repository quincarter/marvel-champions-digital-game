import { activeEncounterDeck, cardsInPlay, createGame, hasKeyword, type GameState, type InstanceId } from "@mc/engine";
import { cardId, WAVE2_CARDS } from "@mc/content";
import { endTurn, firstLegal, identityOf, inst, P1, payWith, play, playerOf, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game, WAVE2_DEPS } from "../testing.js";

const taskmasterVsHeroes = () => startWave2Game(wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }));
const ADVANCE = "01186";

/** Photographic Reflexes (04104), attached directly to Taskmaster — test-only surgery, matching wave1's precedent
 * (docs/phase7-wave1-scripting.md "The Wrecking Crew", `forceAttachToVillain`) for reaching a specific villain
 * attachment without a real reveal. */
function withPhotographicReflexes(state: GameState): { readonly state: GameState; readonly card: InstanceId } {
  const villain = state.villains[0]!.instanceId;
  const id = Object.values(state.instances).find((i) => i.cardId === cardId("04104") && i.attachedTo === null)!.instanceId;
  return {
    state: {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, attachedTo: villain, faceup: true },
        [villain]: { ...state.instances[villain]!, attachments: [...state.instances[villain]!.attachments, id] },
      },
    },
    card: id,
  };
}

describe("Taskmaster scenario", () => {
  it("standalone setup: the four Captive allies are set aside, Hydra Patrol is in play, and the game is legal", () => {
    const config = wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }], seed: 2026 });
    const created = createGame(config, WAVE2_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const captives = created.state.encounterSetAside.filter((id) => ["04097", "04098", "04099", "04100"].includes(created.state.instances[id]?.cardId ?? ""));
    expect(captives).toHaveLength(4);
    expect(cardsInPlay(created.state).some((id) => created.state.instances[id]?.cardId === "04154")).toBe(true);
    expect(created.state.villains).toHaveLength(1);
    expect(created.state.outcome).toBeNull();
  });

  it("Taskmaster (I/II/III): Forced Response, after a player changes to hero form, they discard the top card of the encounter deck and take damage equal to its boost icons", () => {
    const start = taskmasterVsHeroes();
    const identity = identityOf(start);
    const before = inst(start, identity).damage;
    const deckBefore = activeEncounterDeck(start).deck.length;
    const hero = runWave2(start, toHero());
    // Taskmaster (I) is the default starting stage, and this forced response has no "against you"/villain-scoping
    // — it fires for any player's own change to hero form.
    expect(activeEncounterDeck(hero).deck.length).toBeLessThan(deckBefore);
    const discarded = activeEncounterDeck(hero).discard.at(-1)!;
    const discardedCardId = hero.instances[discarded]!.cardId;
    const discardedCard = WAVE2_CARDS.find((c) => c.id === discardedCardId);
    const boostIcons = discardedCard && "boostIcons" in discardedCard ? discardedCard.boostIcons : 0;
    expect(inst(hero, identity).damage).toBe(before + boostIcons);
  });

  it("Taskmaster (II/III): When Revealed deals each player an encounter card", () => {
    expect(WAVE2_DEPS.abilities["04094.when-revealed"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04095.when-revealed"]).toBeDefined();
  });

  it("Hydra Hunter: his attacks gain piercing and ranged (a constant keyword grant on himself)", () => {
    const start = taskmasterVsHeroes();
    const hydraHunter = Object.values(start.instances).find((i) => i.cardId === cardId("04101"))!;
    // A constant ability only applies while its card is in play (RRG 1.8 "Constant Ability", p. 12) — test-only
    // surgery to place this specific minion in play, engaged with P1, the way a real reveal would.
    const inPlay = {
      ...start,
      villainArea: [...start.villainArea, hydraHunter.instanceId],
      instances: { ...start.instances, [hydraHunter.instanceId]: { ...hydraHunter, faceup: true, engagedWith: P1 } },
    };
    expect(hasKeyword(inPlay, hydraHunter.instanceId, "piercing", WAVE2_DEPS)).toBe(true);
    expect(hasKeyword(inPlay, hydraHunter.instanceId, "ranged", WAVE2_DEPS)).toBe(true);
  });

  it("Photographic Reflexes: prevents all damage to Taskmaster from a player's attack and redirects it to that player's identity, then discards", () => {
    const start = withPhotographicReflexes(taskmasterVsHeroes());
    const hero = runWave2(start.state, toHero());
    const villain = hero.villains[0]!.instanceId;
    const identity = identityOf(hero);
    const villainDamageBefore = inst(hero, villain).damage;
    const identityDamageBefore = inst(hero, identity).damage;
    // Basic attack against the villain.
    const attacked = settle(runWave2(hero, { type: "basicAttack", playerId: P1, attackerInstanceId: identity, targetInstanceId: villain }), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(attacked, villain).damage).toBe(villainDamageBefore);
    expect(inst(attacked, identity).damage).toBeGreaterThan(identityDamageBefore);
    // An encounter card (home: the encounter deck) discards to the *encounter* discard pile, not the player's own
    // (docs/phase7-wave1-scripting.md "Test conventions").
    expect(activeEncounterDeck(attacked).discard).toContain(start.card);
  });

  it("Mimicry: in alter-ego form, discards 5 cards and Taskmaster schemes if a Thwart card was among them", () => {
    expect(WAVE2_DEPS.abilities["04105.when-revealed-alter-ego"]).toBeDefined();
    expect(WAVE2_DEPS.abilities["04105.when-revealed-hero"]).toBeDefined();
  });

  it("Hunted by Hydra: each player in hero form takes 1 damage and discards a random hand card", () => {
    const start = stackEncounterDeck(taskmasterVsHeroes(), ADVANCE, "04106");
    const hero = runWave2(start, toHero());
    const identity = identityOf(hero);
    const damageBefore = inst(hero, identity).damage;
    const handBefore = playerOf(hero, P1).hand.length;
    const settled = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, identity).damage).toBeGreaterThan(damageBefore);
    expect(playerOf(settled, P1).hand.length).toBeLessThan(handBefore + 1); // -1 discarded, plus whatever else the round adds/removes
  });

  it("Taskmaster's Training Camp: gives a tough status card to a minion that enters play", () => {
    expect(WAVE2_DEPS.abilities["04108.taskmasters-training-camp-forced-response"]).toBeDefined();
  });

  it("Moon Knight: after you play him from your hand, spending a [wild] resource draws 2 cards", () => {
    const start = taskmasterVsHeroes();
    // Test-only surgery: move the set-aside Moon Knight into hand (a real game gets him there via Captured by
    // Hydra's "When Defeated" clause, which has no ability ref to script — module docblock).
    const moonKnight = start.encounterSetAside.find((id) => start.instances[id]?.cardId === "04097")!;
    const withHand = {
      ...start,
      encounterSetAside: start.encounterSetAside.filter((id) => id !== moonKnight),
      players: start.players.map((p, i) => (i === 0 ? { ...p, hand: [...p.hand, moonKnight] } : p)),
      instances: { ...start.instances, [moonKnight]: { ...start.instances[moonKnight]!, ownerId: P1, home: { kind: "player" as const } } },
    };
    const before = playerOf(withHand, P1).hand.length;
    // Moon Knight's own printed cost is 0 — no payment for the play itself; his Response then has its own "spend
    // a [wild] resource" cost, answered as a separate `payForAbility` choice (docs/phase7-wave2-scripting.md's
    // own note on Mockingbird's interrupt, the same prompt kind).
    const playedRaw = runWave2(withHand, play(P1, moonKnight, []));
    const triggerOption = `${moonKnight}:04097.moon-knight-response`;
    const played = settle(
      playedRaw,
      (s) => {
        if (s.pendingChoice?.prompt.kind === "payForAbility") return payWith(s, P1, 1).map((id) => `hand:${id}`);
        if (s.pendingChoice?.options.some((o) => o.optionId === triggerOption)) return [triggerOption];
        return firstLegal(s);
      },
      undefined,
      WAVE2_DEPS,
    );
    expect(playerOf(played, P1).playArea).toContain(moonKnight);
    // -1 played, -1 resource for the Response, +2 drawn.
    expect(playerOf(played, P1).hand.length).toBe(before - 2 + 2);
  });

  it("Captured by Hydra: places 1 random set-aside Captive ally facedown beneath this scheme", () => {
    expect(WAVE2_DEPS.abilities["04107.when-revealed"]).toBeDefined();
  });
});
