import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
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
 * **45030b.illyana-rasputin-interrupt**, "Interrupt: When you change to hero form, choose a SPELL in your discard pile
 * and put it on top of your deck. (Limit once per phase.)": an optional interrupt on her own identity's change to hero
 * form, heard before the identity turns (`on.youWouldChangeIdentityForm("hero")`, the engine's `formChanging` window),
 * while this alter-ego face is still live. The SPELL goes onto a facedown deck and is the card shown as the hero face
 * turns up (docs/phase7-wave8.md section 7.1). An additional cost to change form is paid before the window opens.
 *
 * Cards (1):
 * - 45030a Magik (hero_identity)
 */
export const MAGIK_IDENTITY: AbilityRegistry = defineAbilities({
  "45030a.magik-constant": constant(playWithTopOfDeckFaceup()),

  "45030a.magik-constant-2": constant(playableTopOfDeck({ costReduction: 1, limit: "phase" })),

  "45030b.illyana-rasputin-interrupt": interrupt(
    on.youWouldChangeIdentityForm("hero"),
    { limit: oncePerPhase },
    chooseCards("spell", zone("discard", you, { filter: { trait: SPELL } }), { min: 1, max: 1 }),
    moveCards(cards(chosen("spell")), "deckTop"),
  ),
});

/** Refs left unregistered, each with its reason. None is left. */
export const MAGIK_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
