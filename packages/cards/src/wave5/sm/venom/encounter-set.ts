import { trait } from "@mc/content";
import type { EffectSpec } from "@mc/engine";
import {
  activationIs,
  addCounters,
  blanksTextBox,
  boost,
  constant,
  countersOn,
  dealIndirectDamage,
  defineAbilities,
  discard,
  enemyAttack,
  eventAmount,
  exists,
  flipCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  ifThen,
  increaseDamageTaken,
  instead,
  interrupt,
  min,
  modifyAttack,
  named,
  perHero,
  preventDamage,
  query,
  removeCountersFrom,
  removeThreat,
  resolveWhenRevealedOf,
  response,
  revealCard,
  self,
  takeDamage,
  theMainScheme,
  valueAtLeast,
  valueAtMost,
  when,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const QUIET = trait("QUIET");
const RINGING = trait("RINGING");
const VENOM = { name: "Venom" };

/** "Bell Tower" (27077a/b), read from anywhere in Venom's own encounter set. */
export const BELL_TOWER = named("Bell Tower");

/**
 * Bell Tower's own "If there are at least 3[per_hero] chime counters here, flip this card" (Quiet, 27077a) and "If
 * there are no chime counters here, flip this card" (Ringing, 27077b) are not independent triggers — nothing in the
 * engine announces "a counter was added/removed" generically (only the last-counter-removed case does,
 * docs/phase7-wave4.md §3.15, which does not fit either threshold here). Every ability that changes a chime counter
 * on the Bell Tower (its own two interrupts, Biting Retort's boost, For Whom the Bell Tolls's reveal) appends this
 * check afterward instead, reading whichever face is showing right now so only that face's own threshold applies.
 * `27077a.bell-tower-constant` and `27077b.bell-tower-constant-2` (the two printed "if …, flip this card" lines) are
 * therefore registered as empty constants: the real check lives here, at every mutation site.
 */
const flipBellTowerIfThreshold = (): readonly EffectSpec[] => [
  ifThen(
    exists(query("environment", { name: "Bell Tower", trait: QUIET })),
    ifThen(valueAtLeast(countersOn(BELL_TOWER, "chime"), perHero(3)), flipCard(BELL_TOWER)),
  ),
  ifThen(
    exists(query("environment", { name: "Bell Tower", trait: RINGING })),
    ifThen(valueAtMost(countersOn(BELL_TOWER, "chime"), 0), flipCard(BELL_TOWER)),
  ),
];

/**
 * Venom's own encounter set (`sm` 27077–27083, docs/phase7-wave5.md §2.2/§3.8/§3.29): Bell Tower, "Now We're
 * Angry!", Guard the Bell Tower, Lashing Out, Tooth and Nail, Biting Retort and For Whom the Bell Tolls.
 * `VENOM_ABILITIES` (`index.ts`) reads `BELL_TOWER` from here for the villain's and main scheme's own effects.
 */
export const VENOM_ENCOUNTER_SET = defineAbilities({
  // Bell Tower, Quiet (27077a) — "If there are at least 3[per_hero] chime counters here, flip this card.": folded
  // into `bell-tower-interrupt`'s own effects (`flipBellTowerIfThreshold`, see above); this ref is a no-op.
  "27077a.bell-tower-constant": constant(),
  // Bell Tower, Quiet (27077a) — Interrupt: When any amount of damage would be dealt to Venom by an attack, (you
  // may) place that many chime counters here instead (docs/phase7-wave5.md §3.29's own worked example,
  // `wave5-3-29.test.ts`; MC27 p. 21 FAQ: no damage is dealt and no excess spills). Optional: an `interrupt`, not a
  // `forcedInterrupt` (docs/phase7-wave5.md §4.1 Q8: the attacking player chooses, or the first player).
  "27077a.bell-tower-interrupt": interrupt(
    when.damage(query("villain", VENOM), { fromAttack: true }),
    instead(addCounters("chime", eventAmount), ...flipBellTowerIfThreshold()),
  ),

  // Bell Tower, Ringing (27077b) — Increase all damage Venom takes by 1 (docs/phase7-wave5.md §3.8's own worked
  // example, `wave5-3-8.test.ts`... actually `wave5-primitives.test.ts`).
  "27077b.bell-tower-constant": constant(increaseDamageTaken(query("villain", VENOM), 1)),
  // Bell Tower, Ringing (27077b) — "If there are no chime counters here, flip this card.": folded into
  // `bell-tower-forced-interrupt`'s own effects (see above); this ref is a no-op.
  "27077b.bell-tower-constant-2": constant(),
  // Bell Tower, Ringing (27077b) — Forced Interrupt: When Venom's attack would deal any amount of damage to an
  // identity, remove that many chime counters from here. For each chime counter removed this way, prevent 1 of that
  // damage. `min(eventAmount, countersOn(…))` reads the pre-removal count (docs/dsl `min`'s own sequencing note),
  // so `preventDamage` is computed before `removeCountersFrom` changes it.
  "27077b.bell-tower-forced-interrupt": forcedInterrupt(
    { ...when.damage(query("identity"), { fromAttack: true }), sourceIs: query("villain", VENOM) },
    preventDamage(min(eventAmount, countersOn(self, "chime"))),
    removeCountersFrom(self, "chime", eventAmount),
    ...flipBellTowerIfThreshold(),
  ),

  // "Now We're Angry!" (27078, attachment to Venom; Uses 2 rage counters is data) — the pipeline classifies the
  // star-marked "Venom's attacks gain overkill" line as a constant (its own ability id), not a Boost ability: Uses
  // discards the card the moment its last counter is removed (RRG 1.8 "Uses", p. 46), so there is no window where
  // the card is in play with 0 uses left for a "while it has at least 1 use" condition to matter.
  "27078.now-were-angry-constant": constant(gainsKeyword({ name: "overkill" }, { hostOfSelf: true })),
  // Forced Response: After Venom takes any amount of damage from an attack, remove 1 rage counter from here. If
  // that attack dealt 3 or more damage to Venom, discard this card.
  "27078.now-were-angry-forced-response": forcedResponse(
    when.damage("host", { fromAttack: true, taken: true }),
    removeCountersFrom(self, "rage", 1),
    ifThen(valueAtLeast(eventAmount, 3), discard(self)),
  ),
  // [star] Boost: Reveal this card.
  "27078.boost": boost(revealCard(self, you)),

  // Guard the Bell Tower (27079, side scheme) — Treat the Bell Tower's printed text box as if it were blank (except
  // for TRAITS: traits are not part of a card's text box, so nothing extra is needed for the parenthetical).
  "27079.guard-the-bell-tower-constant": constant(blanksTextBox(query("environment", { name: "Bell Tower" }))),
  // When Revealed: Remove each chime counter from the Bell Tower and flip it to its QUIET side. Removing every
  // counter satisfies the Ringing side's own "if there are none, flip" check, so `flipBellTowerIfThreshold` already
  // flips it back to Quiet when it was Ringing, and leaves an already-Quiet tower alone.
  "27079.when-revealed": whenRevealed(
    removeCountersFrom(BELL_TOWER, "chime", countersOn(BELL_TOWER, "chime")),
    ...flipBellTowerIfThreshold(),
  ),

  // Lashing Out (27080, side scheme, acceleration icon is data) — Response: After Venom takes any amount of damage
  // from an attack, remove an equal amount of threat from here.
  "27080.lashing-out-response": response(
    when.damage(query("villain", VENOM), { fromAttack: true, taken: true }),
    removeThreat(eventAmount, self),
  ),
  // [star] Boost: If this activation is an attack, take 2 indirect damage.
  "27080.boost": boost(ifThen(activationIs("attack"), dealIndirectDamage(you, 2))),

  // Tooth and Nail (27081, side scheme, hazard icon is data) — Response: as Lashing Out.
  "27081.tooth-and-nail-response": response(
    when.damage(query("villain", VENOM), { fromAttack: true, taken: true }),
    removeThreat(eventAmount, self),
  ),
  // [star] Boost: If this activation is an attack, it gains piercing.
  "27081.boost": boost(ifThen(activationIs("attack"), modifyAttack({ keywords: ["piercing"] }))),

  // Biting Retort (27082, treachery) — When Revealed: Venom activates against you (read as an attack,
  // `kang-encounter-set.ts`'s own "activates against you" precedent). **Known gap:** "Each boost card turned faceup
  // during that activation gets +1 boost icon" is not modeled — `eachTimeUntil` only scopes to a phase/round/turn,
  // not "this activation" (docs/phase7-wave5.md §3.6's own "Not here", unverified); pinned in `encounter-set.test.ts`.
  "27082.when-revealed": whenRevealed(enemyAttack(named("Venom"), { against: you, additionalResolution: true })),
  // [star] Boost: Remove 1 chime counter from the Bell tower.
  "27082.boost": boost(removeCountersFrom(BELL_TOWER, "chime", 1), ...flipBellTowerIfThreshold()),

  // For Whom the Bell Tolls (27083, treachery) — When Revealed: Remove 2 chime counters from the Bell Tower. If the
  // Bell Tower is on its quiet side, take 1 damage. If it is on its ringing side, remove 1 threat from the main
  // scheme.
  "27083.when-revealed": whenRevealed(
    removeCountersFrom(BELL_TOWER, "chime", 2),
    ...flipBellTowerIfThreshold(),
    ifThen(
      exists(query("environment", { name: "Bell Tower", trait: QUIET })),
      takeDamage(1),
      removeThreat(1, theMainScheme),
    ),
  ),
  // [star] Boost: Resolve this card's "When Revealed" ability.
  "27083.boost": boost(resolveWhenRevealedOf(self)),
});
