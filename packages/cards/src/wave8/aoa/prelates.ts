import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  atEndOfAttack,
  allOf,
  bindTargets,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  discard,
  each,
  engage,
  eventDealt,
  eventTarget,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gets,
  heal,
  identityOf,
  ifThen,
  attachCard,
  modifyAttack,
  on,
  option,
  placeThreat,
  product,
  query,
  refMatches,
  selectCards,
  self,
  statOf,
  superlative,
  theMainScheme,
  topOfDeck,
  when,
  you,
} from "../../dsl/index.js";

/**
 * Scenario set `prelates` (Age of Apocalypse, docs/phase7-wave8.md §1.15, §3.22, §3.30, §3.32): the five [PRELATE]
 * minions, the reverse faces of the Overseers. Never in the encounter deck; the Apocalypse scenario sets them aside
 * and its main scheme and side schemes reveal them one at a time (`apocalypse.ts`).
 *
 * "X engages the first player" is Dreadpool's form (`deadpool` 44038): a forced interrupt on entering play that
 * engages the first player. Every Prelate of this scenario is revealed by the first player, so it only restates what
 * the reveal already did, and holds if another card reveals one. Abyss prints it on the same ref as his hit point
 * line, and one ref is one trigger kind, so there it is true by construction (the scenario's reveals all name the
 * first player) and the ref carries the hit points.
 *
 * Abyss's hit points count the facedown cards attached to him (`facedown: true`, host self); a facedown attached card
 * is a blank, so the query names no category. When he leaves play the attached cards go to their owners' discard
 * piles (RRG "Leaves Play").
 *
 * The Shadow King: no ally means no choice and nothing happens (RRG p. 12, "Choose"), hence the `andThen`.
 *
 * Cards (5):
 * - 45179b Mister Sinister (minion)
 * - 45180b The Shadow King (minion)
 * - 45181b Abyss (minion)
 * - 45182b Sugar Man (minion)
 * - 45183b Mikhail Rasputin (minion)
 */

const engagesFirstPlayer = () => forcedInterrupt(on.entersPlay("self"), engage(self, firstPlayer));

/** "The ally you control with the highest THW", every tied ally a candidate. */
const HIGHEST_THW_ALLY = superlative(
  "highest",
  each(query("ally", { controller: "you" })),
  statOf(chosen("candidate"), "thw"),
);

export const PRELATES: AbilityRegistry = defineAbilities({
  // Mister Sinister: Retaliate 1, Toughness, Villainous, Victory 3 are data. Engages the first player.
  "45179b.mister-sinister-constant": engagesFirstPlayer(),

  // The Shadow King: engages the first player.
  "45180b.the-shadow-king-constant": engagesFirstPlayer(),
  // [star] Forced Response: After The Shadow King attacks you, choose an ally you control with the highest THW. Either
  // discard that ally, or place threat on the main scheme equal to its THW.
  "45180b.the-shadow-king-forced-response": forcedResponse(
    on.enemyAttacks("self", { againstYou: true }),
    bindTargets("highest", HIGHEST_THW_ALLY),
    chooseTarget("ally", { inSlot: "highest" }),
    andThen(
      chooseOne(
        option("Discard that ally", discard(chosen("ally"))),
        option("Place threat equal to its THW", placeThreat(statOf(chosen("ally"), "thw"), theMainScheme)),
      ),
    ),
  ),

  // Abyss: +2 hit points for each facedown card attached to him; engages the first player (see the header).
  "45181b.abyss-constant": constant(gets("hp", product(2, countOf({ host: self, facedown: true })), { self: true })),
  // [star] Forced Response: After Abyss activates against you, attach the top card of your deck to him, facedown.
  "45181b.abyss-forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    selectCards("top", topOfDeck(1)),
    attachCard(chosen("top"), self, { facedown: true }),
  ),

  // Sugar Man: engages the first player.
  "45182b.sugar-man-constant": engagesFirstPlayer(),
  // [star] Forced Interrupt: When Sugar Man attacks, this attack gains piercing. If this attack defeats a character,
  // heal 5 damage from Sugar Man.
  "45182b.sugar-man-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self"),
    modifyAttack({ keywords: ["piercing"] }),
    atEndOfAttack(
      ifThen(
        allOf(eventDealt("defeated"), refMatches(eventTarget, query("character"), { anywhere: true })),
        heal(5, self),
      ),
    ),
  ),

  // Mikhail Rasputin: engages the first player.
  "45183b.mikhail-rasputin-constant": engagesFirstPlayer(),
  // [star] Forced Interrupt: When Mikhail Rasputin attacks you, deal 1 damage to your identity.
  "45183b.mikhail-rasputin-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, identityOf(you)),
  ),
});

/** Unregistered refs and why. Empty: every ref of the group is scripted. */
export const PRELATES_SKIPPED: Readonly<Record<string, string>> = {};
