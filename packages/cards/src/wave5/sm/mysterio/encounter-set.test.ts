import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeVillain, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  payWith,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  endTurn,
  P1,
} from "../../../testing/harness.js";
import { driveEvents, encounterCardInVillainArea } from "../../../testing/staging.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const mysterioGame = () =>
  startWave5Game(ghostSpiderScenario("mysterio", { seed: 1, modularSetIds: [encounterSetId("bomb_scare")] }));

describe("Humongous Hallucination (27089)", () => {
  it("27089.humongous-hallucination-action: spends a resource, shuffles the top 2 encounter cards into your deck, discards itself", () => {
    const state = mysterioGame();
    const { state: withCard, id } = encounterCardInVillainArea(state, "27089");
    const deckSizeBefore = playerOf(withCard, P1).deck.length;
    const payment = payWith(withCard, P1, 1).map((fromHand) => ({ fromHand }));
    const after = settle(
      runWave5(withCard, toHero(P1), {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: id,
        abilityId: "27089.humongous-hallucination-action" as never,
        payment,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).deck.length).toBe(deckSizeBefore + 2);
    expect(activeEncounterDeck(after).discard).toContain(id);
  });
});

describe("Masterful Mirage (27090)", () => {
  it("27090.masterful-mirage-constant: instead of damaging Mysterio, discards the top 4 cards of your deck; discards itself", () => {
    const start = mysterioGame();
    // Maze of Mirrors 1A's own Setup puts a Guard minion engaged with P1 (`main-scheme.test.ts`): disengage it so
    // this attack can reach Mysterio directly.
    const disengaged = instancesOf(start, "27091")
      .filter((minion) => inst(start, minion).engagedWith === P1)
      .reduce((s, minion) => patchInstance(s, minion, { engagedWith: null }), start);
    const { state: withCard, id } = encounterCardInVillainArea(disengaged, "27090");
    const villain = activeVillain(withCard).instanceId;
    const damageBefore = inst(withCard, villain).damage;
    const deckBefore = playerOf(withCard, P1).deck.length;
    const identity = identityOf(withCard);
    const after = settle(
      runWave5(withCard, toHero(P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(damageBefore);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - 4);
    expect(activeEncounterDeck(after).discard).toContain(id);
  });

  it("27090.boost: gives Mysterio 1 additional boost card for that activation", () => {
    const state = mysterioGame();
    // Masterful Mirage as Mysterio's own boost card; two harmless fillers behind it (its own [star] Boost draws a
    // second boost card, then the villain's own normal activation is dealt its player reveal).
    const stacked = stackEncounterDeck(state, "27090", "01186", "01186");
    const { events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    const dealt = events.filter((e) => e.type === "boostCardDealt");
    expect(dealt.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Déjà Vu (27092)", () => {
  it("27092.when-revealed: choose to take 1 damage or place 1 threat, then shuffles itself into a player's deck (never the encounter discard)", () => {
    const state = mysterioGame();
    const card = instancesOf(state, "27092")[0]!;
    const stacked = stackEncounterDeck(state, "01186", "27092");
    const { state: after, events } = driveEvents(WAVE5_DEPS, stacked, toHero(P1), endTurn(P1));
    // `firstLegal` picks the first `chooseOne` option: take 1 damage — read Déjà Vu's own dealt damage, not the
    // identity's running total (Mysterio's own activation this round deals damage too).
    const dealtByCard = events.some((e) => e.type === "damageDealt" && e.sourceInstanceId === card && e.amount === 1);
    expect(dealtByCard).toBe(true);
    expect(playerOf(after, P1).deck).toContain(card);
    expect(activeEncounterDeck(after).discard).not.toContain(card);
  });
});

describe("Fearmonger (27093)", () => {
  it("27093.when-revealed: discards your hand, then draws up to your hand size", () => {
    const state = mysterioGame();
    const handBefore = playerOf(state, P1).hand;
    const stacked = stackEncounterDeck(state, "01186", "27093");
    const after: GameState = settle(runWave5(stacked, toHero(P1), endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(playerOf(after, P1).hand.some((id) => handBefore.includes(id))).toBe(false);
    expect(handBefore.every((id) => playerOf(after, P1).discard.includes(id))).toBe(true);
    expect(playerOf(after, P1).hand.length).toBeGreaterThan(0);
  });
});

describe("Shifting Apparition (27091): When Defeated, excess damage", () => {
  // Printed: "When Defeated: If this minion was defeated with excess damage, the defeating player shuffles the top
  // card of the encounter deck into their deck." Not registered (`encounter-set.ts`'s own module docblock): no
  // `characterDefeated`-side excess-damage read exists yet. Pinned so re-enabling it (once the primitive lands)
  // turns this green.
  it.fails("shuffles the top card of the encounter deck into the defeating player's deck when defeated with excess damage", () => {
    const state = mysterioGame();
    const apparition = instancesOf(state, "27091").find((id) => inst(state, id).engagedWith === P1)!;
    const deckBefore = playerOf(state, P1).deck.length;
    const identity = identityOf(state);
    const after = settle(
      runWave5(state, toHero(P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: apparition,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(playerOf(after, P1).deck.length).toBe(deckBefore + 1);
  });
});
