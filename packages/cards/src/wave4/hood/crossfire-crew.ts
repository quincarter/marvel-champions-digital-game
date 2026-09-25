import { trait } from "@mc/content";
import {
  additionalCostToReady,
  boost,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealIndirectDamage,
  defineAbilities,
  discardDeckUntil,
  discardEncounterUntil,
  each,
  engagedPlayerOf,
  exhaust,
  forcedInterrupt,
  modifyAttack,
  placeThreat,
  query,
  remainingHpOf,
  retargetAttack,
  revealCard,
  self,
  superlative,
  theMainScheme,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * The Crossfire's Crew modular set (`hood` 24023-24028, docs/phase7-wave4.md §2.3): a side scheme (Out for Blood),
 * three minions (Controller, Corruptor, Crossfire), Mister Fear (already scripted below via the printed
 * `additionalCostToReady` example, docs/phase7-wave4.md §3.19) and a treachery (Caught in the Crossfire).
 *
 * **Not scripted (genuine engine gaps — see `../coverage.test.ts`'s `KNOWN_SKIPPED.hood`):**
 * - **Out for Blood (24023, `when-revealed`/`boost`)**: "Deal 1 damage to the friendly character with the fewest
 *   remaining hit points. If that character is defeated this way, repeat this effect" needs a repeat-until-nothing
 *   -happens primitive; nothing in the DSL re-runs an effect conditioned on its own outcome.
 * - **Controller (24024, `controller-forced-interrupt`)**: "When Controller's attack would deal any amount of
 *   damage to a character, increase that amount by that character's ATK" is the same "modify an in-flight damage
 *   event's amount" gap as Beast Mode (`beasty-boys.ts`'s own docblock).
 */

const CROSSFIRES_CREW = trait("CROSSFIRE'S CREW");

export const CROSSFIRE_CREW = defineAbilities({
  // Corruptor (24025, minion; CRIMINAL/CROSSFIRE'S CREW, starIcon are data) — When Revealed: exhaust each ally you
  // control; place 1 threat on the main scheme for each ally exhausted this way. [star] Boost: choose and exhaust
  // a character you control.
  "24025.when-revealed": whenRevealed(
    exhaust(each(query("ally", { controller: "you" }))),
    placeThreat(countOf(query("ally", { controller: "you" })), theMainScheme),
  ),
  "24025.boost": boost(
    chooseTarget("exhausted", query("character", { controller: "you" })),
    exhaust(chosen("exhausted")),
  ),

  // Crossfire (24026, minion; CROSSFIRE'S CREW/MASTERS OF EVIL, Quickstrike are data; docs/phase7-wave4.md §3.21) —
  // [star] Forced Interrupt: when Crossfire attacks, he attacks the friendly character with the fewest remaining
  // hit points. That attack gains overkill and ranged.
  "24026.crossfire-forced-interrupt": forcedInterrupt(
    { on: "enemyAttack", selfIs: "source" },
    retargetAttack(superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate")))),
    modifyAttack({ keywords: ["overkill", "ranged"] }),
  ),

  // Mister Fear (24027, minion; CRIMINAL/CROSSFIRE'S CREW, starIcon are data; docs/phase7-wave4.md §3.19's own
  // worked example) — As an additional cost for the engaged player to ready a hero or ally they control, the
  // player must spend a [mental] resource. [star] Boost: discard cards from the top of your deck until you discard
  // an ally.
  "24027.mister-fear-constant": constant(
    additionalCostToReady(
      query(["hero", "ally"], { controlledBy: engagedPlayerOf(self) }),
      { mental: 1 },
      { player: engagedPlayerOf(self) },
    ),
  ),
  "24027.boost": boost(discardDeckUntil(query("ally"), "found", you)),

  // Caught in the Crossfire (24028, treachery) — When Revealed: discard cards from the top of the encounter deck
  // until a Crossfire's Crew minion is discarded; reveal that minion; take indirect damage equal to the number of
  // Crossfire's Crew minions in play.
  "24028.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion", { trait: CROSSFIRES_CREW }), "found"),
    revealCard(chosen("found")),
    dealIndirectDamage(you, countOf(query("minion", { trait: CROSSFIRES_CREW }))),
  ),
});
