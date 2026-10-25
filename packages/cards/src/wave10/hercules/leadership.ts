import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  after,
  choosePlayer,
  chosenPlayer,
  chosen,
  constant,
  countOf,
  dealDamageCost,
  defineAbilities,
  discardEncounterUntil,
  discardThis,
  draw,
  forcedResponse,
  gets,
  heroInterrupt,
  interrupt,
  isAlterEgo,
  modifyConsequentialDamage,
  on,
  playOnlyIf,
  putIntoPlay,
  query,
  reduceNextCardCost,
  when,
  yourIdentity,
} from "../../dsl/index.js";
import { NEXT_EVOL_PRECON_CABLE_DECK } from "../../wave7/next_evol/precon-cable-deck.js";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";

/**
 * Wave 10 scripting module `hercules/leadership` (docs/phase7-wave10-hero-packs.md H8.4).
 *
 * Cards (7, five scripted here):
 * - 59018 Deathcry (ally)
 * - 59019 Namora (ally)
 * - 59020 Thor (ally)
 * - 59021 Teamwork (event)
 * - 59022 Call for Backup (player_side_scheme)
 * - 59023 Recruitment Drive (support)
 * - 59024 "Avenge Me!" (upgrade)
 *
 * **59018.deathcry-interrupt**: "Hero Interrupt: When Deathcry makes a basic attack, deal your hero 1 damage ->
 * Deathcry takes -1 consequential damage for this attack." The cost is 1 damage to the hero (`yourIdentity`; hero form
 * only, so the identity is the hero), paid before the attack resolves; the effect lowers Deathcry's pending
 * consequential damage by 1 (printed 2 on an attack, so 1), for that one attack, and not below 0.
 *
 * **59019.namora-constant**: "Namora gets +1 hit point for each other ally you control." Counted live, so it changes as
 * allies come and go; Namora herself is not counted.
 *
 * **59020.thor-forced-response**: "Forced Response: After Thor makes a basic thwart, discard cards from the top of the
 * encounter deck until you discard a minion. Put that minion into play engaged with you." Discarded, not revealed, so
 * no When Revealed, surge or boost resolves; the minion enters play engaged with Thor's controller. With no minion in
 * the deck nothing is put into play.
 *
 * **59023.recruitment-drive-constant**: "Alter-ego form only." A play restriction on the player's own form (RRG 1.8
 * "Hero Form / Alter-Ego Form"), so it cannot be played in hero form; once in play it stays. **59023.recruitment-drive-action**:
 * "Action: Discard Recruitment Drive and choose a player -> reduce the resource cost of the next ally that player
 * plays this phase to 0." The cost is set to 0 (H3.10, `reduceNextCardCost` "toZero"), unused at the end of the phase
 * it is gone (RRG 1.8 "Lasting Effects", p. 26).
 *
 * **59024.avenge-me-interrupt**: "Interrupt: When attached ally is defeated, draw 2 cards." The identity-trait and one
 * per ally restrictions are card data. The controller of the upgrade draws.
 *
 * No ruling in docs/rulings/marvel-champions-rulings-post-rrg-1-7.md (December 17, 2025 to August 13, 2026) names these cards.
 *
 * **Reprints, aliased** to the original's script: 59021 Teamwork (reprint of `thor` 06032) and 59022 Call for Backup (reprint of 40018). Checked in the test.
 */
export const HERCULES_LEADERSHIP: AbilityRegistry = defineAbilities({
  "59018.deathcry-interrupt": heroInterrupt(
    when.attacks("self", { basic: true }),
    { cost: dealDamageCost(yourIdentity, 1) },
    modifyConsequentialDamage(-1),
  ),
  "59019.namora-constant": constant(
    gets("hp", countOf(query("ally", { controller: "you", not: { self: true } })), { self: true }),
  ),
  "59020.thor-forced-response": forcedResponse(
    after.thwarts("self", { basic: true }),
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found")),
  ),
  "59023.recruitment-drive-constant": constant(playOnlyIf(isAlterEgo())),
  "59023.recruitment-drive-action": action(
    { cost: discardThis },
    choosePlayer("player"),
    reduceNextCardCost(chosenPlayer("player"), "toZero", "phase", query("ally")),
  ),
  "59024.avenge-me-interrupt": interrupt(on.attachedCardDefeated(), draw(2)),
  "59021.teamwork-interrupt": THOR_PACK_CARDS["06032.teamwork-constant"]!,
  "59022.when-defeated": NEXT_EVOL_PRECON_CABLE_DECK["40018.when-defeated"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const HERCULES_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {};
