import type { AbilityRegistry } from "@mc/engine";
import { damageOn, defineAbilities, flipCard, forcedResponse, heal, on, query, self } from "../../../dsl/index.js";

/**
 * The Typhoid Mary campaign ally (docs/phase7-wave11-scenarios.md section S6; MC60 p. 9 step 13). Victory -1 and the
 * Setup keyword are data. Setup is a keyword, not a "Setup:" ability: the campaign (step 13) puts her into play under
 * a player it chooses, only while "Trust Established?" is checked and "Mary Defeated?" is not, and setup step 11's
 * sweep of Setup-keyword cards must not take her (she is set aside by the campaign, not a deck card).
 *
 * **60210a Typhoid Mary**: "Forced Response: After you reveal a minion, remove all damage from here and flip this
 * card." "You" is the player who controls her (RRG 1.8 "You, Your", p. 49), so a minion another player reveals does not
 * trigger her. The flip keeps her tokens, status cards and attachments (RRG 1.8 "Flip", p. 20), her damage already
 * removed. A reveal is heard once every step of it has completed (RRG 1.8 "Reveal", p. 38).
 * **60210b Bloody Mary**: the same with "a side scheme", flipping back.
 *
 * Bloody Mary prints THW 1 / ATK 2 where Typhoid Mary prints THW 2 / ATK 1: data (`CardFlipSide.thw` / `atk`), read by
 * the engine's printed stats while she is flipped.
 *
 * Cards (1):
 * - 60210a Typhoid Mary (ally)
 */
export const FNE_CAMPAIGN_TYPHOID_MARY_ALLY: AbilityRegistry = defineAbilities({
  "60210a.typhoid-mary-forced-response": forcedResponse(
    on.youRevealEncounterCard(query("minion")),
    heal(damageOn(self), self),
    flipCard(self),
  ),
  "60210b.bloody-mary-forced-response": forcedResponse(
    on.youRevealEncounterCard(query("sideScheme")),
    heal(damageOn(self), self),
    flipCard(self),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_CAMPAIGN_TYPHOID_MARY_ALLY_SKIPPED: Readonly<Record<string, string>> = {};
