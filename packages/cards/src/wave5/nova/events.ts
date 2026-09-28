import {
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  cards,
  chosen,
  damageAnEnemy,
  defineAbilities,
  FRIENDLY_CHARACTER,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  moveCards,
  on,
  preventDamage,
  response,
  thwartAScheme,
  topOfDeck,
  varAtLeast,
  varOf,
  YOUR_IDENTITY,
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
 * generated while paying for this card.` constant ahead of their Hero Action. This is not
 * `doublesResourcesWhilePayingFor` (The Power of Aggression, `01055`/`25022`): that rule lives on the *resource*
 * card and doubles what it generates while paying for a card matching a query (`resourceMultiplier` read in
 * `handCardResources`, `packages/engine/src/actions.ts` — the card being spent as payment carries the constant).
 * Lightspeed Flight and Pot Shot are the *opposite* direction: the constant sits on the card being paid FOR, and
 * doubles only the wild portion of whatever resource(s) fund it — `handCardResources` never looks at the target
 * card's own abilities at all, only the spending card's. No existing `AbilityDefinition.trigger` shape reaches that
 * (an engine gap, not a DSL-vocabulary gap): `.28004.lightspeed-flight-constant` and `.28005.pot-shot-constant` are
 * left unregistered rather than approximated. Each Hero Action is scripted in full: Lightspeed Flight's "(thwart):
 * Remove 3 threat from a scheme" is `thwartAScheme(3)`; Pot Shot's "(attack): Deal 4 damage to an enemy" is
 * `attackAnEnemy(4)` — reported as a gap below rather than guessed at.
 *
 * **Unleash Nova Force (28006)**: "Max 1 per round." is data (`playRestrictions.maxPerRound`). "Hero Action: Until
 * the end of the round, each time Nova defeats an enemy or removes the last threat from a scheme, ready Nova and
 * draw 1 card" asks for a *delayed, standing* trigger that survives this event card leaving play (it resolves and
 * goes to the discard pile immediately, the way every event does) and fires on future, independent attack/thwart
 * events for the rest of the round. Every triggered-ability collector in the engine (`resolve/triggers.ts`) walks
 * `cardsInPlay(state)` only (`select.ts` `activeAbilityRefs`); a discarded event's own printed response/constant
 * abilities are never consulted again. There is no "grant a temporary triggered ability" primitive in the DSL or
 * the engine to reach for instead (grep for `grantAbility`/`delayedTrigger`/`floatingTrigger` turns up nothing).
 * `.28006.unleash-nova-force-action` is left unregistered; reported as a gap below.
 *
 * **Chase Them Down (28011)**: "Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat
 * from a scheme." `on.attacks(YOUR_IDENTITY, { defeats: true })` is the exact "attacks and defeats" shape (RRG 1.8
 * "Overkill" p. 31 area; Root Stomp, `gmw` 16005, uses the identical `attack.defeated` result, here read through
 * the trigger's own `requireResults` rather than a bound var since nothing downstream needs the amount).
 *
 * **Pitchback (28012)**: "Play only if your identity has the Aerial trait." is data
 * (`playRestrictions.requiresIdentityTrait`). "Hero Response (attack): After your hero attacks, deal 4 damage to
 * an enemy." is `damageAnEnemy(4)`, not `attack(...)` — the printed effect is "deal … damage", not a second attack
 * (the "(attack)" label only categorizes the triggered ability itself, the same reading Into the Fray's excess-
 * damage line and Pitchback's own aggression-aspect precedent both give).
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

  // "28004.lightspeed-flight-constant" is a genuine engine gap (no primitive for a card doubling the *wild* portion
  // of whatever pays for it) — left unregistered; see module docblock and the report to the caller.
  "28004.lightspeed-flight-action": heroAction({ label: "thwart" }, thwartAScheme(3)),

  // "28005.pot-shot-constant" is the same gap as Lightspeed Flight's — left unregistered.
  "28005.pot-shot-action": heroAction({ label: "attack" }, attackAnEnemy(4)),

  // "28006.unleash-nova-force-action" is a genuine engine gap (no primitive for a delayed trigger that survives
  // this event leaving play, for the rest of the round) — left unregistered; see module docblock.

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
