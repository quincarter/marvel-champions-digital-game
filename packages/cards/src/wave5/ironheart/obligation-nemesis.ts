import type { Predicate } from "@mc/engine";
import {
  allOf,
  boost,
  cards,
  constant,
  dealAsEncounterCard,
  dealEncounterCard,
  defineAbilities,
  enemyScheme,
  exists,
  forcedResponse,
  gainsIcon,
  gainsKeyword,
  gets,
  giveTough,
  ifThen,
  isAttached,
  moveCards,
  named,
  not,
  on,
  placeThreat,
  query,
  removeCountersFrom,
  self,
  surge,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { discardThisObligation } from "../../core/obligations.js";

/**
 * A Minor Setback (29028), Ironheart's obligation, and her nemesis set: Rule by Force (29029, side scheme), Lucia
 * von Bardas (29030, nemesis minion), Cyborg Tech (29031, attachment), Political Retribution (29032, treachery,
 * quantity 2). Read directly from `packages/content/src/data/ironheart/cards.ts` — no errata, no
 * `curation/ironheart.ts` correction on any of the five (the scan at `assets/card-art/bundles/cards/2902{8,9}.png`,
 * `2903{0,1,2}.png` matches `text.printed`/`text.current` word for word for every card below).
 *
 * **A Minor Setback (29028)**: "Give to the Riri Williams player" is data-level (`HeroIdentityCard.obligationCardId`,
 * matching every other obligation in this engine, `wave5/nova/obligation-nemesis.ts`'s own docblock) — RRG Appendix
 * II step 10 shuffles it into the (shared) encounter deck itself, and the engine resolves "you"/"your identity" on a
 * drawn obligation against its own hero's player regardless of who actually revealed it (`resolve/reveal.ts`
 * `card.obligationCardId === identity.obligationCardId`; `resolve/triggers.ts`'s own "uncontrolledYouOf" comment) —
 * so no `forEachPlayer`/explicit player lookup is needed here, unlike `wave5/nova/obligation-nemesis.ts`'s own
 * "Bring the War!" ("each player discards…", a genuinely per-player effect). This card does **not** use Core's
 * shared `obligation()` helper (`core/obligations.ts`) — that helper's shape ("You may flip to alter-ego form.
 * Choose: exhaust [alter-ego] to remove this, or [alternative], discard this obligation") is a different printed
 * shape entirely; A Minor Setback prints no flip-to-alter-ego line and no either/or choice, just a straight
 * "remove a counter, then branch on whether that worked."
 *
 * "Remove 1 progress counter from your identity, then discard this card" is the success branch; "If no progress
 * counter was removed this way, deal yourself 1 facedown encounter card, then shuffle this card into the encounter
 * deck" is the failure branch (no progress counter existed to remove) — read as an if/else on whether a counter was
 * actually there to remove, not as two separate always-both-happen instructions (a literal "discard this card" AND
 * "shuffle this card into the encounter deck" can't both be true of the same card at once). `hasProgressCounter()`
 * (a local `Predicate.counterAtLeast`, the `wave4/mts/mts-campaign-cards.ts` `counterAtLeast`/`wave1/gob/local.ts`
 * `noCounters` precedent for a raw `Predicate` shape with no `dsl/values.ts` wrapper of its own) is checked *before*
 * removing, since `removeCountersFrom` (`dsl/effects.ts`) itself has no "how many were actually removed" bind to
 * branch on after the fact — checking first and branching is equivalent here (removing 1 when at least 1 exists
 * always succeeds). "Your identity" is `yourIdentity` — Riri Williams' progress counters live on the identity
 * instance itself, the same instance `swapIdentity` carries across all three versions (`identity.ts`'s own
 * docblock), so no `fromIdentity`-style redirection is needed beyond naming that ref directly. The failure branch's
 * "shuffle this card into the encounter deck" is `moveCards(cards(self), "encounterDeckShuffle")` — the Beetle
 * precedent (`wave2/wsp/obligation-nemesis.ts` 13028: "shuffle Beetle into the encounter deck").
 *
 * **Rule by Force (29029, side scheme)**: "While Lucia von Bardas is in play, this card gains a hazard icon. While
 * Lucia von Bardas is not in play, this card gains an acceleration icon" is two complementary `constant(gainsIcon(
 * …))` rules, one on each side of the same condition — `RuleSpec.gainsIcon`'s own `while` field
 * (`packages/engine/src/abilities.ts`) already anticipated exactly this card by name in its own doc comment, but
 * the `dsl/abilities.ts` `gainsIcon` wrapper only exposed `icon`/`target`/`count` until this module needed the
 * `while` it was missing — extended here (additive: existing 2-arg callers, `wave4/hood/streets-of-mayhem.ts`
 * 24061, `wave5/sm/sinister-six/guerrilla-tactics.ts` 27143/27144, are unaffected) rather than special-cased for
 * just this card. `LUCIA_IN_PLAY` (`exists(query("minion", { name: "Lucia von Bardas" }))`) is the
 * `wave3/ron/kree-fanatic.ts` "Ronan the Accuser" precedent for "while [a specific named card] is in play".
 *
 * **Lucia von Bardas (29030, nemesis minion)**: "While Lucia von Bardas has tough status card, she gets +1 SCH and
 * +1 ATK" is `gets("sch"/"atk", 1, query("minion", { hasStatus: "tough", self: true }))` — the `wave5/nova/
 * armadillo.ts` 28028 "gets +3 ATK while it has a tough status card" precedent, narrowed to `self: true` since this
 * buff is about Lucia herself, not every tough enemy. "Forced Response: After the villain phase ends, give Lucia
 * von Bardas a tough status card" is `forcedResponse(on.phaseEnding("villain"), giveTough(self))` — a Response (not
 * Interrupt) reacting *after* the phase ends, per the printed "Forced Response" header (`on.phaseEnding` is reused
 * by both trigger shapes elsewhere in this codebase, `wave3/drax/drax-pack-cards.ts` 19032's own Forced Interrupt
 * vs. this card's own Forced Response — the header word picks which).
 *
 * **Cyborg Tech (29031, attachment)**: "Attach to the minion with the most traits" is data
 * (`attachesTo: { kind: "superlative", among: "minion", order: "highest", measure: "traitCount" }`); only its "If
 * you cannot, this card gains surge" clause needs a script, the Goblin Glider precedent
 * (`wave1/gob/goblin-gimmicks.ts` 02033: `whenRevealed(ifThen(not(isAttached(self)), surge()))`) reused verbatim —
 * despite the data-generated ability id's own `-constant` suffix (the parser's default label for any plain sentence
 * with no formal trigger header, `packages/content/scripts/marvelcdb/parse-text.ts`'s own doc comment; the Nova
 * "Worried Father"/"-constant"-is-really-a-`whenRevealed` precedent this pack's own `index.ts` docblock already
 * flags), this clause is a `whenRevealed`, read only once, at this card's own reveal — not a standing rule. "Attached
 * minion gets +3 hit points and gains retaliate 1" is the genuine standing `constant`, `{ hostOfSelf: true }`'s
 * plain shape (`wave2/wsp/obligation-nemesis.ts` 13029 Beetle Armor MK IV: `gets("hp", 4, query("enemy", {
 * hostOfSelf: true }))`; `wave2/trors/zola.ts` 04119: `gainsKeyword({ name: "retaliate", value: 1 }, query("minion",
 * { hostOfSelf: true }))`), matching this card's own data-generated second `-constant-2` ability id (the printed
 * card's second plain sentence). "[star] Boost: Deal this card to yourself as a facedown encounter card" is
 * `dealAsEncounterCard(self)` (`dsl/effects.ts`'s own "You Dare Oppose Me?" precedent, `ron` 90005) inside `boost`.
 *
 * **Political Retribution (29032, treachery, quantity 2)**: three independent conditional clauses, not an if/else-if
 * chain — the first two ("If Lucia von Bardas is in play, she schemes"; "If Rule by Force is in play, place 3
 * threat on it") can both be true at once, and the third ("If neither is in play, this card gains surge") only
 * when both of the first two are false. `enemyScheme(named("Lucia von Bardas"))` is `wave5/nova/obligation-
 * nemesis.ts`'s own "War Delivery" shape reused (a `named` ref that resolves to nothing if the card isn't in play
 * would itself no-op safely, but the printed text conditions explicitly on "if…is in play", so that condition is
 * scripted directly rather than relied on implicitly). `placeThreat(3, named("Rule by Force"))` likewise names the
 * side scheme directly, gated by its own explicit `exists` check.
 */

const hasProgressCounter = (): Predicate => ({
  kind: "counterAtLeast",
  of: yourIdentity,
  counterType: "progress",
  amount: 1,
});

const LUCIA_IN_PLAY = exists(query("minion", { name: "Lucia von Bardas" }));
const RULE_BY_FORCE_IN_PLAY = exists(query("sideScheme", { name: "Rule by Force" }));

export const IRONHEART_OBLIGATION_NEMESIS = defineAbilities({
  // A Minor Setback — Remove 1 progress counter from your identity, then discard this card. If no progress
  // counter was removed this way, deal yourself 1 facedown encounter card, then shuffle this card into the
  // encounter deck.
  "29028.obligation": whenRevealed(
    ifThen(
      hasProgressCounter(),
      [removeCountersFrom(yourIdentity, "progress", 1), discardThisObligation],
      [dealEncounterCard(you), moveCards(cards(self), "encounterDeckShuffle")],
    ),
  ),

  // Rule by Force — While Lucia von Bardas is in play, this card gains a hazard icon. While Lucia von Bardas is
  // not in play, this card gains an acceleration icon.
  "29029.rule-by-force-constant": constant(
    gainsIcon("hazard", query("sideScheme", { self: true }), { while: LUCIA_IN_PLAY }),
    gainsIcon("acceleration", query("sideScheme", { self: true }), { while: not(LUCIA_IN_PLAY) }),
  ),

  // Lucia von Bardas — While Lucia von Bardas has tough status card, she gets +1 SCH and +1 ATK.
  "29030.lucia-von-bardas-constant": constant(
    gets("sch", 1, query("minion", { hasStatus: "tough", self: true })),
    gets("atk", 1, query("minion", { hasStatus: "tough", self: true })),
  ),
  // Lucia von Bardas — Forced Response: After the villain phase ends, give Lucia von Bardas a tough status card.
  "29030.lucia-von-bardas-forced-response": forcedResponse(on.phaseEnding("villain"), giveTough(self)),

  // Cyborg Tech — Attach to the minion with the most traits (data). If you cannot, this card gains surge.
  "29031.cyborg-tech-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Cyborg Tech — Attached minion gets +3 hit points and gains retaliate 1.
  "29031.cyborg-tech-constant-2": constant(
    gets("hp", 3, query("minion", { hostOfSelf: true })),
    gainsKeyword({ name: "retaliate", value: 1 }, query("minion", { hostOfSelf: true })),
  ),
  // Cyborg Tech — [star] Boost: Deal this card to yourself as a facedown encounter card.
  "29031.boost": boost(dealAsEncounterCard(self)),

  // Political Retribution — When Revealed: If Lucia von Bardas is in play, she schemes. If Rule by Force is in
  // play, place 3 threat on it. If neither is in play, this card gains surge.
  "29032.when-revealed": whenRevealed(
    ifThen(LUCIA_IN_PLAY, enemyScheme(named("Lucia von Bardas"))),
    ifThen(RULE_BY_FORCE_IN_PLAY, placeThreat(3, named("Rule by Force"))),
    ifThen(allOf(not(LUCIA_IN_PLAY), not(RULE_BY_FORCE_IN_PLAY)), surge()),
  ),
});
