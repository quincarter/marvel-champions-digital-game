import {
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  cards,
  chosen,
  constant,
  damageAnEnemy,
  defineAbilities,
  doublesResourcesGeneratedForThisCard,
  draw,
  eachTimeUntil,
  eventTarget,
  FRIENDLY_CHARACTER,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  moveCards,
  on,
  preventDamage,
  query,
  ready,
  response,
  threatOn,
  thwartAScheme,
  topOfDeck,
  valueEquals,
  varAtLeast,
  varOf,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * Nova's own signature events (`nova` 28003–28006, 28011–28014, 28026; Nova Hero Pack pp. 1-3, docs/phase7-wave5.md;
 * read directly from `packages/content/src/data/nova/cards.ts`, no errata on RRG 1.8 pp. 67-68). All nine are
 * `YOUR_IDENTITY`-sourced (`Who`), not `self` — every one is an event, never attached to a specific character, the
 * same reasoning Ghost-Spider's own events module gives (`wave5/sm/ghost-spider/events-a.ts`): "your hero" in the
 * printed text is the controller's identity, not the card resolving it.
 *
 * **Forcefield Projection (28003)**: "Hero Interrupt: When a friendly character would take any amount of damage
 * from an attack, prevent 3 of that damage. If you paid for this card using a [wild] resource, deal 3 damage to an
 * enemy." `on.damage(FRIENDLY_CHARACTER, { fromAttack: true })` is Magic Shield's own trigger shape (`scw/kit.ts`
 * 15008) narrowed to attack damage, the same `fromAttack` option Backflip (Core `01003`) reads. The wild branch is
 * `varAtLeast("paid.wild")`, not `paidWith("wild")` — `TypedResource` (`packages/engine/src/resources.ts`)
 * deliberately excludes "wild" from `paidWith` (see `identity.ts`'s own docblock on the same distinction, Sam
 * Alexander's Action): "paid … using a [wild] resource" means a wild resource was actually spent, which only the
 * raw `paid.wild` var says. Prints a plain "an enemy", not "that enemy" (unlike Side Step's `eventSource`, `qsv`
 * 14015) — a freshly chosen enemy, so `damageAnEnemy(3)`.
 *
 * **Lightspeed Flight (28004)** and **Pot Shot (28005)** each print a `Double the number of [wild] resources
 * generated while paying for this card.` constant ahead of their Hero Action. It is the reverse direction of The Power
 * of Aggression's `doublesResourcesWhilePayingFor` (`01055`/`25022`), which sits on the resource card being spent: here
 * the constant sits on the card being paid FOR, so `doublesResourcesGeneratedForThisCard("wild")`
 * (`resourceMultiplier.forThisCard`, engine `ResourceMultiplierSpec`) doubles the wild portion of every source that
 * pays for it — a wild resource card (Connection to the Worldmind, 28007), a resource ability — and nothing typed (RRG
 * 1.8 "Resource", p. 37; each doubled wild is declared on its own, "Wild Resource", p. 48). Paying for any other card
 * is untouched. Lightspeed Flight's "(thwart): Remove 3 threat from a scheme" is `thwartAScheme(3)`; Pot Shot's
 * "(attack): Deal 4 damage to an enemy" is `attackAnEnemy(4)`.
 *
 * **Unleash Nova Force (28006)**: "Max 1 per round." is data (`playRestrictions.maxPerRound`). "Hero Action: Until
 * the end of the round, each time Nova defeats an enemy or removes the last threat from a scheme, ready Nova and
 * draw 1 card" is a lasting effect (RRG 1.8 "Lasting Effects", p. 26: it "continues to affect the game for the
 * specified duration whether or not the card that created the lasting effect is in play", so this event going to the
 * discard pile does not end it). The engine already has that shape: `eachTimeUntil` (`LastingEffectBody eachTime`,
 * docs/phase7-wave3.md §3.17, Schadenfreude `gmw` 16032), stored in `state.lastingEffects`, walked by
 * `eachTimeEffectsFor` at every event's response step and expired at the round's end. Two of them, one per clause:
 * - "defeats an enemy": `characterDefeated` of an enemy whose defeating source is Nova (`sourceInstanceId` is the
 *   attacker for attack damage, basic or "(attack)"-labeled, `resolve/event.ts` `applyPlayerAttack`).
 * - "removes the last threat from a scheme": `removeThreat` sourced to Nova (a thwart's removal is sourced to the
 *   thwarter, basic or "(thwart)"-labeled) that removed at least 1 threat and left the scheme at 0. Read off the
 *   removal rather than `schemeDefeated`, so the main scheme (never "defeated" at 0 threat) counts too, as "a
 *   scheme" says. By this event's response step a defeated side scheme has left play; its threat still reads 0.
 * "Nova" is the identity, not an event card Nova's player plays: a non-labeled "remove N threat"/"deal N damage"
 * event is sourced to the event card and does not count (Small but Mighty, `wsp` 13001a, has to print "or an event
 * you play" to include one). Flagged in the wave report as an open reading.
 *
 * **Chase Them Down (28011)**: "Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat
 * from a scheme." `on.attacks(YOUR_IDENTITY, { defeats: true })` is the exact "attacks and defeats" shape (RRG 1.8
 * "Overkill" p. 31 area; Root Stomp, `gmw` 16005, uses the identical `attack.defeated` result, here read through
 * the trigger's own `requireResults` rather than a bound var since nothing downstream needs the amount).
 *
 * **Pitchback (28012)**: "Play only if your identity has the Aerial trait." is data
 * (`playRestrictions.requiresIdentityTrait`). "Hero Response (attack): After your hero attacks, deal 4 damage to
 * an enemy." is `damageAnEnemy(4)`, the printed "deal … damage". The "(attack)" label makes resolving it one attack
 * by the hero (owner ruling Q48, docs/phase7-wave8.md §4.1; the engine's rule, `resolve/attack-ability.ts`), so the
 * enemy is one the hero may attack, and "after your hero attacks" is true of the attack it makes for any other card
 * that asks (another copy in hand included). A copy never answers its own attack: it has left the hand by then.
 *
 * **No Quarter (28013)**: `Requirement ([physical])` is data (`keywords: [{ name: "requirement", icon:
 * "physical" }]`), enforced generically by the engine reading `requirementResources` (`packages/content/src/schema
 * /keywords.ts`) at payment — no ability script needed for it (confirmed: `content/src/data/wave5.test.ts`'s own
 * Requirement-keyword suite exercises the identical `{ icon }` shape). "Hero Action (attack): Deal 4 damage to an
 * enemy. For each point of excess damage dealt to that enemy by this attack, discard the top card of your deck and
 * add each Aggression (red) card discarded this way to your hand." reads the attack's own `excessDealt` result
 * (Into the Fray, `13013`, is the "N threat per excess damage" precedent; here it scales a discard-and-filter
 * instead of a threat removal) — `topOfDeck(varOf("strike.excessDealt"), you)` discards that many cards (0 is a
 * no-op, no minimum unlike a cost), bound as `"milled"`, then `cards(chosen("milled"), { aspect: "aggression" })`
 * moves only the Aggression-aspect ones to hand (Black Cat's `printedResource: "mental"` filter, Core `01002`, is
 * the same "discard, then move a matching subset to hand" shape; `aspect` is a first-class `TargetQuery` field,
 * `packages/engine/src/spec.ts`).
 *
 * **One by One (28014)**: "Hero Action (attack): Deal 2 damage to an enemy. If this attack defeats that enemy,
 * deal 2 damage to an enemy." The second "an enemy" is a fresh choice (not "that enemy" again), so
 * `varAtLeast("hit.defeated")` (Root Stomp's own `bind`-and-check shape) gates a second, independently-targeted
 * `damageAnEnemy(2, "second")` — a distinct slot name from the first attack's `"enemy"` target so the two choices
 * don't collide.
 *
 * **Yaw and Roll (28026)**: "Play only if your identity has the Aerial trait." is data. "Hero Response (thwart):
 * After your hero thwarts, remove 3 threat from a scheme." is `thwartAScheme(3)` off `on.thwarts(YOUR_IDENTITY)`.
 */

export const NOVA_EVENTS = defineAbilities({
  "28003.forcefield-projection-interrupt": heroInterrupt(
    on.damage(FRIENDLY_CHARACTER, { fromAttack: true }),
    preventDamage(3),
    ifThen(varAtLeast("paid.wild"), damageAnEnemy(3)),
  ),

  "28004.lightspeed-flight-constant": constant(doublesResourcesGeneratedForThisCard("wild")),
  "28004.lightspeed-flight-action": heroAction({ label: "thwart" }, thwartAScheme(3)),

  "28005.pot-shot-constant": constant(doublesResourcesGeneratedForThisCard("wild")),
  "28005.pot-shot-action": heroAction({ label: "attack" }, attackAnEnemy(4)),

  "28006.unleash-nova-force-action": heroAction(
    eachTimeUntil(
      "endOfRound",
      { on: "characterDefeated", targetIs: query("enemy"), sourceIs: YOUR_IDENTITY },
      ready(yourIdentity),
      draw(1),
    ),
    eachTimeUntil(
      "endOfRound",
      { on: "removeThreat", sourceIs: YOUR_IDENTITY, requireResults: { amount: 1 } },
      ifThen(valueEquals(threatOn(eventTarget), 0), [ready(yourIdentity), draw(1)]),
    ),
  ),

  "28011.chase-them-down-response": response(
    on.attacks(YOUR_IDENTITY, { defeats: true }),
    { label: "thwart" },
    thwartAScheme(2),
  ),

  "28012.pitchback-response": heroResponse(on.attacks(YOUR_IDENTITY), { label: "attack" }, damageAnEnemy(4)),

  "28013.no-quarter-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(4, chosen("enemy"), { bind: "strike" }),
    moveCards(topOfDeck(varOf("strike.excessDealt")), "discard", "milled"),
    moveCards(cards(chosen("milled"), { aspect: "aggression" }), "hand"),
  ),

  "28014.one-by-one-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(2, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), damageAnEnemy(2, "second")),
  ),

  "28026.yaw-and-roll-response": heroResponse(on.thwarts(YOUR_IDENTITY), { label: "thwart" }, thwartAScheme(3)),
});
