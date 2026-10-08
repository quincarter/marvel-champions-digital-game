import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  interrupt,
  moveCards,
  on,
  oncePerPhase,
  playableTopOfDeck,
  playWithTopOfDeckFaceup,
  you,
  zone,
} from "../../../dsl/index.js";

const SPELL = trait("SPELL");

/**
 * Magik / Illyana Rasputin identity (45030a hero face, 45030b alter-ego face): docs/phase7-wave8.md section 7.1, 3.48,
 * 3.49, 3.60; section 4.1 Q26 and Q27.
 *
 * **45030a.magik-constant**, "Play with the top card of your deck faceup": `playWithTopOfDeckFaceup()`. A constant of
 * the hero face, so it is off in alter-ego form and the top card is hidden again (Q26 = B: a facedown top card
 * satisfies no "the top card of your deck has" condition).
 *
 * **45030a.magik-constant-2**, "Once per phase, you may play the top card of your deck as if it was in your hand,
 * reducing its resource cost by 1": `playableTopOfDeck({ costReduction: 1, limit: "phase" })` in its own constant
 * (the limit is that ability's). It is played from the hand for every reader (RRG FAQ "Magik (#30A)", p. 64), both
 * reductions apply when she plays it through another effect (Q27 = A).
 *
 * **45030b.illyana-rasputin-interrupt** is not registered (`MAGIK_IDENTITY_SKIPPED`, `ILLYANA_INTERRUPT_DRAFT`). Printed:
 * "Interrupt: When you change to hero form, choose a SPELL in your discard pile and put it on top of your deck.
 * (Limit once per phase.)" It resolves before the form changes, so the SPELL goes onto a facedown deck and is the card
 * shown as the hero face turns up (docs/phase7-wave8.md section 7.1). The draft is an optional interrupt on her own
 * identity change to hero form, once per phase, choosing a SPELL of her discard pile (nothing happens with none).
 *
 * Cards (1):
 * - 45030a Magik (hero_identity)
 */
export const MAGIK_IDENTITY: AbilityRegistry = defineAbilities({
  "45030a.magik-constant": constant(playWithTopOfDeckFaceup()),

  "45030a.magik-constant-2": constant(playableTopOfDeck({ costReduction: 1, limit: "phase" })),
});

/**
 * The Illyana Rasputin interrupt as it should read once the engine can open an interrupt window before a form change
 * (see `MAGIK_IDENTITY_SKIPPED`). Not registered. The face it sits on is the alter-ego, and no form gate is written:
 * the window opens while she is still in alter-ego form, which is when this face's abilities are live.
 */
export const ILLYANA_INTERRUPT_DRAFT: AbilityDefinition = interrupt(
  // `eventIs.to` narrows "you change form" to "you change to hero form" (the alter-ego change is not heard).
  { ...on.youChangeIdentityForm(), eventIs: { change: "identity", to: "hero" } },
  { limit: oncePerPhase },
  chooseCards("spell", zone("discard", you, { filter: { trait: SPELL } }), { min: 1, max: 1 }),
  moveCards(cards(chosen("spell")), "deckTop"),
);

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const MAGIK_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "45030b.illyana-rasputin-interrupt":
    "needs an interrupt window before the form changes: the engine announces formChanged after the identity has turned, and the alter-ego face's abilities are no longer live then, so the interrupt is never offered (the plan, docs/phase7-wave8.md section 7.1, wants the SPELL on a facedown deck before the hero face turns up)",
};
