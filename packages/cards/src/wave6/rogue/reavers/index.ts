import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  attachCard,
  cannotAttach,
  chosen,
  constant,
  countOf,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardEncounterUntil,
  encounterCards,
  forcedResponse,
  oneCopyOf,
  placeThreat,
  query,
  revealCard,
  rule,
  selectCards,
  self,
  shuffleEncounterDeck,
  surge,
  theMainScheme,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const REAVER = trait("REAVER");
const REAVER_MINION = query("minion", { trait: REAVER });
const REAVERS_ENGAGED = query("minion", { trait: REAVER, engagedWith: "you" });
/** "After [this minion] engages you" (RRG 1.8 "Engage", p. 18): the engagement itself, apart from any activation. */
const afterEngagesYou = { on: "minionEngaged", selfIs: "source" } as const;

/**
 * The Reavers modular set (`reavers`, `rogue` 38029-38035; docs/phase7-wave6.md §2, §6.2): five REAVER minions (Donald
 * Pierce, Skullbuster, Bonebreaker, Wade Cole, Murray Reese), The Reavers side scheme and Cybernetic Enhancements x2.
 *
 * - **Teamwork (REAVER)** and Villainous / Toughness are data (the engine's `resolveTeamwork`, docs §3.1: only the
 *   entering minion activates, before its When Revealed, §4 Q2).
 * - **Bonebreaker** (erratum, RRG 1.8 p. 69): the printed "Forced Interrupt: After Bonebreaker engages you" is a
 *   Forced Response, which the "after" wording always was; scripted as one.
 * - **Cybernetic Enhancements**: the host and +1 ATK are data; "Otherwise, this card gains surge" is its
 *   `cannotAttach` ability; "attached minion cannot take damage" is a `cannotTakeDamage` rule on the host.
 */
export const REAVERS_ABILITIES: AbilityRegistry = defineAbilities({
  // Donald Pierce — Forced Response: After Donald Pierce engages you, reveal the topmost REAVER minion from the
  // discard pile. (The encounter discard pile; "topmost" is its first card, the most recently discarded.)
  "38029.donald-pierce-forced-response": forcedResponse(
    afterEngagesYou,
    selectCards("found", encounterCards(["discard"], REAVER_MINION, { topmostOnly: true })),
    revealCard(chosen("found"), you),
  ),

  // Skullbuster — Forced Response: After Skullbuster engages you, place 1 threat on the main scheme for each REAVER
  // minion engaged with you (Skullbuster himself included: he is engaged with you by then).
  "38030.skullbuster-forced-response": forcedResponse(
    afterEngagesYou,
    placeThreat(countOf(REAVERS_ENGAGED), theMainScheme),
  ),

  // Bonebreaker — Forced Response (erratum, RRG 1.8 p. 69; printed "Forced Interrupt"): After Bonebreaker engages
  // you, take 1 indirect damage for each REAVER minion engaged with you.
  "38031.bonebreaker-forced-response": forcedResponse(
    afterEngagesYou,
    dealIndirectDamage(you, countOf(REAVERS_ENGAGED)),
  ),

  // Wade Cole / Murray Reese — When Revealed: search the encounter deck and discard pile for a copy of the Cybernetic
  // Enhancements attachment and attach it to him. (Shuffle.)
  "38032.when-revealed": whenRevealed(
    selectCards(
      "found",
      oneCopyOf(encounterCards(["deck", "discard"], query("attachment", { name: "Cybernetic Enhancements" }))),
    ),
    attachCard(chosen("found"), self),
    shuffleEncounterDeck(),
  ),
  "38033.when-revealed": whenRevealed(
    selectCards(
      "found",
      oneCopyOf(encounterCards(["deck", "discard"], query("attachment", { name: "Cybernetic Enhancements" }))),
    ),
    attachCard(chosen("found"), self),
    shuffleEncounterDeck(),
  ),

  // The Reavers — When Defeated: the player who defeated this scheme discards cards from the encounter deck until a
  // REAVER minion is discarded, then reveals that minion.
  "38034.when-defeated": whenDefeated(
    discardEncounterUntil(REAVER_MINION, "minion"),
    revealCard(chosen("minion"), defeatingPlayer),
  ),

  // Cybernetic Enhancements — Attach to a minion (data). Otherwise, this card gains surge.
  "38035.cybernetic-enhancements-constant": cannotAttach(surge()),
  // Attached minion cannot take damage.
  "38035.cybernetic-enhancements-constant-2": constant(
    rule({ kind: "cannotTakeDamage", target: query("minion", { hostOfSelf: true }) }),
  ),
  // [star] Forced Response: After attached minion attacks, discard Cybernetic Enhancements.
  "38035.cybernetic-enhancements-forced-response": forcedResponse(after.enemyAttacks("host"), discard(self)),
});
