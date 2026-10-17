/**
 * Rules audit chunk 13 (Glossary: PREVENT ... RESPONSE), card-side proofs. Each `it.fails` marks a place the engine
 * does something the RRG 1.8 forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Printed" (p. 35): "If a player must pay a cost using 'printed resources,' they may use resources generated
 * by a card's ability, so long as the icon(s) ... is printed in its text box. Wild resources cannot be spent as other
 * resource types for such a cost." We Are One (`sm` 27120) reads "Spend [energy][mental][physical] printed resources
 * -> discard this card"; the script is an ordinary typed `spend(...)`, which accepts a wild declared as any type.
 */
import { cardId, encounterSetId } from "@mc/content";
import { activeEncounterDeckId, activeVillain, applyCommand, createGame, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { firstLegal, inst, moveToHand, playerOf, settle, toHero, use, P1 } from "../testing/harness.js";
import { runWave5, WAVE5_DEPS } from "../wave5/testing.js";
import { ghostSpiderScenarioWithExtras } from "../wave5/sm/ghost-spider/support.js";

describe("RRG 1.8 p. 35 'Printed': a cost paid with printed resources", () => {
  it("We Are One cannot be paid with three printed wild resources", () => {
    // Spider-Woman (01011), Hellcat (01020) and War Machine (01030) each print one wild resource icon.
    const config = ghostSpiderScenarioWithExtras("venom-goblin", {
      seed: 7,
      modularSetIds: [encounterSetId("bomb_scare")],
      extraCodes: ["01011", "01020", "01030"],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
    const villain = activeVillain(state).instanceId;
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    const weAreOne =
      pile.deck.find((i) => state.instances[i]?.cardId === cardId("27120")) ??
      pile.discard.find((i) => state.instances[i]?.cardId === cardId("27120"));
    if (!weAreOne) throw new Error("no We Are One in the encounter deck or discard");
    const attached: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((i) => i !== weAreOne),
          discard: pile.discard.filter((i) => i !== weAreOne),
        },
      },
      instances: {
        ...state.instances,
        [weAreOne]: { ...state.instances[weAreOne]!, faceup: true, attachedTo: villain },
        [villain]: { ...state.instances[villain]!, attachments: [...state.instances[villain]!.attachments, weAreOne] },
      },
    };
    const hero = playerOf(attached, P1).identity.form === "hero" ? attached : runWave5(attached, toHero(P1));
    const given = moveToHand(hero, P1, "01011", "01020", "01030");
    const result = applyCommand(
      given.state,
      use(
        P1,
        weAreOne,
        "27120.we-are-one-action",
        given.ids.map((fromHand) => ({ fromHand })),
      ),
      WAVE5_DEPS,
    );
    // Control: it was attached before and the three cards were in hand.
    expect(inst(attached, weAreOne).attachedTo).toBe(villain);
    // Wild is not energy, mental or physical for a "printed resources" cost, so the payment is refused.
    expect(result.ok).toBe(false);
  });
});
