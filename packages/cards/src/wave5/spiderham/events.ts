import { JUSTICE } from "../../core/aspects/justice.js";
import { NEBULA_PACK_CARDS } from "../../wave4/nebu/nebula-pack-cards.js";
import { VENOM_KIT } from "../../wave3/vnm/venom-kit.js";
import {
  cancelRevealedCard,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  countOf,
  countersOn,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  draw,
  each,
  enemyAttack,
  heroAction,
  heroInterrupt,
  on,
  option,
  perHero,
  product,
  query,
  removeCounter,
  removeThreat,
  setVar,
  sum,
  theVillain,
  thwartAScheme,
  varOf,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * Spider-Ham's own signature events (`spiderham` 30003–30007, 30014–30017; Spider-Ham Hero Pack pp. 1-2; read
 * directly off `packages/content/src/data/spiderham/cards.ts`, no errata on RRG 1.8 pp. 67-68). All nine print the
 * "hero:30001a"/"justice" aspects, not a specific character, so every trigger sources off `yourIdentity`/`you`, the
 * same reasoning Nova's own events module gives (`wave5/nova/events.ts`) — "your hero"/"Spider-Ham" in the printed
 * text is the controller's identity, not the event card resolving it.
 *
 * **Ham It Up (30003)**: "Hero Action (thwart): Remove 1 threat from a scheme for each toon counter on Spider-Ham."
 * `thwartAScheme(countersOn(yourIdentity, "toon"))` — toon counters live on the identity (`identity.ts`'s own
 * `countersAsResource`/`addCounters` precedent), read live at resolution (RRG 1.8 "Modifiers", p. 29: a variable
 * value is checked when the ability resolves).
 *
 * **Hogwashed (30004)**: "Hero Action: Remove 1 toon counter from Spider-Ham → loudly read this card's flavor
 * text. Choose to either deal 5 damage to a minion or remove 5 threat from a side scheme." The "loudly read this
 * card's flavor text" clause is a purely social/narrative instruction with no game-state effect — the same kind of
 * unscripted flavor direction Captain Americat's "give someone a high five" (30002, not yet built) leaves out.
 * `removeCounter("toon", 1, { fromIdentity: true })` is Groot's own growth-counter cost shape (`gmw` 16008) for "…
 * from [it/him] →" where the counter lives on the identity rather than the card carrying the ability.
 *
 * **"I Don't Think So!" (30005)**: "Hero Interrupt: When you reveal a card from the encounter deck, remove 1 toon
 * counter from Spider-Ham → say '\"I don't think so!\"' in your best Spider-Ham voice. Cancel the effects of that
 * card and discard it." The "say … in your best Spider-Ham voice" clause is flavor only, same reasoning as
 * Hogwashed above. `cancelRevealedCard()` alone is Black Widow's own precedent (`01075.black-widow-interrupt`,
 * `core/aspects/protection.ts`) for "cancel the effects of that card and discard it" (`RuleSpec cancelRevealedCard`
 * cancels the reveal's own resolution, which includes its normal post-resolution discard). Unlike Black Widow, the
 * printed trigger is "When **you** reveal a card" rather than "When a card is revealed" — `playerIn: you` narrows
 * `on.encounterCardRevealed()`'s own `encounterCardRevealing` pattern to reveals the ability's controller made
 * (`EventPattern.playerIn`, docs/phase7-wave5.md §3.25's own precedent for reading an event's carried player), so
 * another player's own reveal (multiplayer) never offers this Spider-Ham's interrupt.
 *
 * **Petulant Pig (30006)**: "Hero Action: Stick your tongue out at the villain. The villain attacks you. Draw 3
 * cards." "Stick your tongue out at the villain" is flavor (no state change beyond starting the attack the next
 * sentence names). `enemyAttack(theVillain, { against: you })` is Swinging Assault's own "The villain attacks you"
 * shape (`wave5/sm/venom/symbiotic-strength.ts` 27168); "Draw 3 cards" is unconditional, not gated on the attack's
 * outcome (the card never says "if that attack …").
 *
 * **Swinging Web Pig (30007)**: "Hero Action (attack): Deal 6 damage to an enemy. Confuse that enemy." The
 * "(attack)" label only categorizes the triggered ability itself; the printed effect is "deal … damage", not a
 * second attack — Spider-Man Morales's own `27030a.spider-man-constant` (`wave5/sm/spider-man-morales/identity.ts`)
 * is the identical "`...damageAnEnemy(n, slot)`, then a status on that same slot" shape, here `confuse` in place of
 * `stun`.
 *
 * **Even the Odds (30014)**: "Requirement ([energy])." is data (`keywords: [{ name: "requirement", icon: "energy"
 * }]`). "Hero Action (thwart): Remove 1[per_hero] threat from each side scheme. Deal 1 damage to the villain for
 * each side scheme defeated this way." `removeThreat(perHero(1), each(query("sideScheme")))` is Queen of Hel's own
 * "each side scheme in play" shape (`wave4/mts/hela.ts` `placeThreat(1, each(query("sideScheme")))`, the identical
 * multi-target primitive in the opposite direction). No result var on a multi-target `removeThreat` counts how many
 * of its targets were defeated (unlike a single-target attack's own `defeated` result), so "defeated this way" is
 * read as a before/after count of side schemes still in play — `setVar("before", countOf(query("sideScheme")))`
 * ahead of the removal (Corruptor's own "exhausted this way" snapshot, `wave4/hood/crossfire-crew.ts` 24025, and
 * Promised Prosperity's own dealt-encounter-count snapshot, `wave4/hood/hood.ts` 24005b, are `setVar`'s established
 * "for a comparison later in the same ability" precedent, docs/phase7-wave4.md §3.46), then
 * `sum(varOf("before"), product(-1, countOf(query("sideScheme"))))` — the count before minus the count after — as
 * the villain's damage amount (`product(-1, …)` negates, since `ValueSpec` has no dedicated subtraction kind; `sum`
 * then adds the negated after-count to the stored before-count). `dealDamage` no-ops at 0 or below (`applyDamage`,
 * `resolve/event.ts`), so no side scheme defeated deals no damage, matching the printed "for each … defeated".
 *
 * **Great Responsibility (30015)**: a second printing of Core Spider-Man's own `01061` (module docblock,
 * `core/aspects/justice.ts`): identical printed text ("Hero Interrupt: When any amount of threat would be placed on
 * a scheme, you take it as damage instead."), aliased rather than re-scripted (Agent 13's own `29022`/`27046`
 * precedent, `wave5/ironheart/allies.ts`).
 *
 * **Making an Entrance (30016)**: a second printing of `vnm` 20013 (identical printed text), aliased the same way.
 *
 * **One Way or Another (30017)**: a second printing of `nebu` 22015 (identical printed text, including "Max 1 per
 * round"), aliased the same way.
 */

export const SPIDERHAM_EVENTS = defineAbilities({
  "30003.ham-it-up-action": heroAction({ label: "thwart" }, thwartAScheme(countersOn(yourIdentity, "toon"))),

  "30004.hogwashed-action": heroAction(
    { cost: removeCounter("toon", 1, { fromIdentity: true }) },
    chooseOne(
      option("Deal 5 damage to a minion", chooseTarget("target", query("minion")), dealDamage(5, chosen("target"))),
      option(
        "Remove 5 threat from a side scheme",
        chooseTarget("target", query("sideScheme")),
        removeThreat(5, chosen("target")),
      ),
    ),
  ),

  "30005.i-dont-think-so-interrupt": heroInterrupt(
    { ...on.encounterCardRevealed(), playerIn: you },
    { cost: removeCounter("toon", 1, { fromIdentity: true }) },
    cancelRevealedCard(),
  ),

  "30006.petulant-pig-action": heroAction(enemyAttack(theVillain, { against: you }), draw(3)),

  "30007.swinging-web-pig-action": heroAction({ label: "attack" }, ...damageAnEnemy(6), confuse(chosen("enemy"))),

  "30014.even-the-odds-action": heroAction(
    { label: "thwart" },
    setVar("before", countOf(query("sideScheme"))),
    removeThreat(perHero(1), each(query("sideScheme"))),
    dealDamage(sum(varOf("before"), product(-1, countOf(query("sideScheme")))), theVillain),
  ),

  "30015.great-responsibility-interrupt": JUSTICE["01061.great-responsibility-interrupt"]!,

  "30016.making-an-entrance-interrupt": VENOM_KIT["20013.making-an-entrance-interrupt"]!,

  "30017.one-way-or-another-action": NEBULA_PACK_CARDS["22015.one-way-or-another-action"]!,
});
