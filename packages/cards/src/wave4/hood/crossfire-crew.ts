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
  eventTarget,
  dealDamage,
  exhaust,
  firstPlayer,
  forcedInterrupt,
  increaseDamage,
  repeatWhile,
  resolveWhenRevealedOf,
  statOf,
  varAtLeast,
  bindTargets,
  modifyAttack,
  placeThreat,
  query,
  remainingHpOf,
  retargetAttack,
  setVar,
  varOf,
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
 * Out for Blood's "repeat this effect" is `repeatWhile` (docs/phase7-wave4.md §3.54) and its boost re-resolves its own
 * When Revealed (`resolveWhenRevealedOf`, §3.56); Controller's "increase that amount by that character's ATK" is
 * `increaseDamage` (§3.52).
 */

const CROSSFIRES_CREW = trait("CROSSFIRE'S CREW");

/**
 * "Deal 1 damage to the friendly character with the fewest remaining hit points. If that character is defeated this
 * way, repeat this effect." A tie is the first player's choice (RRG 1.8 "First Player", p. 19).
 */
const outForBlood = () =>
  repeatWhile(
    varAtLeast("hit.defeated"),
    bindTargets("fewest", superlative("lowest", each(query(["identity", "ally"])), remainingHpOf(chosen("candidate")))),
    chooseTarget("pick", { inSlot: "fewest" }, { chooser: firstPlayer }),
    dealDamage(1, chosen("pick"), { bind: "hit" }),
  );

export const CROSSFIRE_CREW = defineAbilities({
  // Out for Blood (24023, side scheme; hazard icon, starIcon are data) — When Revealed: deal 1 damage to the friendly
  // character with the fewest remaining hit points; if that character is defeated this way, repeat this effect.
  // [star] Boost: resolve this card's "When Revealed" ability.
  "24023.when-revealed": whenRevealed(outForBlood()),
  "24023.boost": boost(resolveWhenRevealedOf(self)),

  // Controller (24024, minion; BRUTE/CROSSFIRE'S CREW are data) — [star] Forced Interrupt: when Controller's attack
  // would deal any amount of damage to a character, increase that amount by that character's ATK.
  "24024.controller-forced-interrupt": forcedInterrupt(
    { on: "dealDamage", selfIs: "source", fromAttack: true },
    increaseDamage(statOf(eventTarget, "atk")),
  ),

  // Corruptor (24025, minion; CRIMINAL/CROSSFIRE'S CREW, starIcon are data) — When Revealed: exhaust each ally you
  // control; place 1 threat on the main scheme for each ally exhausted this way. [star] Boost: choose and exhaust
  // a character you control.
  // "Exhausted this way": only the allies that were ready count (a snapshot before the exhaust, docs/phase7-wave4.md
  // §3.46's `setVar`).
  "24025.when-revealed": whenRevealed(
    setVar("ready", countOf(query("ally", { controller: "you", exhausted: false }))),
    exhaust(each(query("ally", { controller: "you" }))),
    placeThreat(varOf("ready"), theMainScheme),
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
