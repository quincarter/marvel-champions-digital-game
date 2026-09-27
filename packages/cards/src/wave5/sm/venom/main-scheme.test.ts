import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, activeVillain, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  P1,
} from "../../../testing/harness.js";
import { driveEvents } from "../../../testing/staging.js";
import { startWave5Game, runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

const venomGame = (seed = 1) =>
  startWave5Game(ghostSpiderScenario("venom", { seed, modularSetIds: [encounterSetId("bomb_scare")] }));

/** Takes the bottom card of the encounter deck and puts it facedown on P1's identity as a boost card (what Vengeance
 * does), so the test does not need an attack first. */
function withBoostOnIdentity(state: GameState): { readonly state: GameState; readonly boostCard: string } {
  const piles = activeEncounterDeck(state);
  const boostCard = piles.deck[piles.deck.length - 1]!;
  const identity = identityOf(state);
  const moved: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { ...piles, deck: piles.deck.slice(0, -1) },
    },
  };
  return {
    state: patchInstance(patchInstance(moved, boostCard, { faceup: false }), identity, {
      boostCards: [...inst(moved, identity).boostCards, boostCard],
    }),
    boostCard,
  };
}

describe('"Leave Us Alone!" (27076a/b)', () => {
  it("27076a.setup: Setup puts the Bell Tower environment into play, Quiet side faceup", () => {
    const state = venomGame();
    const tower = instancesOf(state, "27077a")[0] ?? instancesOf(state, "27077b")[0];
    expect(tower).toBeDefined();
    expect(state.villainArea).toContain(tower);
    expect(inst(state, tower!).flipped).toBe(false);
  });

  it("27076b.leave-us-alone-forced-interrupt: moves each facedown boost card from your identity to Venom when he activates against you", () => {
    const state = venomGame();
    const villain = activeVillain(state).instanceId;
    const identity = identityOf(state);
    // Strip Toughness and attack once so Vengeance places a facedown boost card on the identity (27073.vengeance,
    // `villain.test.ts`).
    const stripped = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, tough: 0 } });
    const withBoost = settle(
      runWave5(stripped, toHero(P1), {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity,
        targetInstanceId: villain,
      }),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(withBoost, identity).boostCards.length).toBe(1);
    const boostCard = inst(withBoost, identity).boostCards[0]!;
    // End the turn: the villain phase's own step 2 activates Venom against the lone player, firing the Forced
    // Interrupt before his activation resolves — the moved card joins that activation's own boost cards and is
    // flipped and discarded with them (docs/phase7-wave5.md §3.6: "moved before an activation's flip step, they
    // resolve in it"), so by the time the phase settles it has left both the identity and Venom for the encounter
    // discard pile.
    const afterVillainPhase = settle(runWave5(withBoost, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(inst(afterVillainPhase, identity).boostCards).not.toContain(boostCard);
    expect(inst(afterVillainPhase, villain).boostCards).not.toContain(boostCard);
    expect(activeEncounterDeck(afterVillainPhase).discard).toContain(boostCard);
  });

  // "When Venom activates against you" is his attacks and his schemes, from a card as well as from the villain phase
  // (docs/phase7-wave5.md §4.1 Q67). The villain phase's own activation is cancelled by a status card (stunned in hero
  // form, confused in alter-ego form), which the interrupt never sees, so the one that fires is Biting Retort's.
  for (const form of ["hero", "alterEgo"] as const) {
    it(`27076b fires on Biting Retort's ${form === "hero" ? "attack" : "scheme"} (${form} form)`, () => {
      let state = venomGame();
      if (form === "hero") state = runWave5(state, toHero(P1));
      expect(playerOf(state, P1).identity.form).toBe(form);
      const villain = activeVillain(state).instanceId;
      const status = form === "hero" ? "stunned" : "confused";
      state = patchInstance(state, villain, { statuses: { ...inst(state, villain).statuses, [status]: 1 } });
      // No boost card is dealt for the cancelled activation, so Biting Retort is the encounter card dealt.
      const stacked = stackEncounterDeck(state, "27082", "01186");
      const { state: primed, boostCard } = withBoostOnIdentity(stacked);
      const { state: after, events } = driveEvents(WAVE5_DEPS, primed, endTurn(P1));
      const revealed = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "27082");
      expect(revealed).toBeGreaterThanOrEqual(0);
      const fired = events.findIndex(
        (e) => e.type === "abilityResolved" && e.abilityId.endsWith("27076b.leave-us-alone-forced-interrupt"),
      );
      expect(fired).toBeGreaterThan(revealed);
      // The moved card is flipped in Biting Retort's activation (its +1 included) and discarded with the dealt one.
      const flipped = events
        .slice(revealed)
        .filter((e) => e.type === "boostCardFlipped" && e.enemyInstanceId === villain);
      expect(flipped.map((e) => (e.type === "boostCardFlipped" ? e.instanceId : null))).toContain(boostCard);
      expect(inst(after, identityOf(after)).boostCards).not.toContain(boostCard);
      expect(activeEncounterDeck(after).discard).toContain(boostCard);
    });
  }
});
