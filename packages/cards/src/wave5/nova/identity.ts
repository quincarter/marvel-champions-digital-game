import {
  alterEgoAction,
  attachCard,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  ifThen,
  moveCards,
  named,
  on,
  query,
  ready,
  response,
  self,
  spend,
  varAtLeast,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * Nova / Sam Alexander (28001a/b, Nova Hero Pack p. 1): docs/phase7-wave5.md's Nova row (§5 table) points only at
 * the pack's own precon and obligation/nemesis, not at this card's text — read directly from
 * `packages/content/src/data/nova/cards.ts` (no errata on RRG 1.8 pp. 67-68, no `nova.ts` curation correction for
 * either face). His signature events/support/upgrade/allies (28002-28020) are a separate module
 * (`support-upgrades-allies.ts`, `events.ts`, not yet built); his obligation (Weight of the World, 28021) and
 * nemesis set (Warbringer/"Bring the War!"/War Delivery/"The War's Been Brought", 28022-28025) are likewise
 * separate (`obligation-nemesis.ts`, not yet built).
 *
 * **Nova (hero, 28001a) — no named title**: "Response: After you use one of Nova's basic powers (THW, ATK, or
 * DEF), ready Supernova Helmet." Prints no "(Limit once per phase)" — unlike Quicksilver's identically-worded
 * "Super Speed" (`qsv` 14001a, `wave2/qsv/kit.ts`) and Ghost-Spider's "Dizzying Reflexes" (27001a), both of which
 * ready *themselves* and both of which do print a limit — so no `limit` here; Nova's own version readies a
 * *different* card (Supernova Helmet) and the printed text carries no cap. `on.basicPowerUsed(self)` is the
 * "After you use a basic power" response (`dsl/abilities.ts`, docs/phase7-wave2.md §3.11), the same primitive
 * Quicksilver's Super Speed and Ghost-Spider's Dizzying Reflexes both already use. Supernova Helmet (28009,
 * unique, `support-upgrades-allies.ts`, not yet scripted) may not be in play; `ready(named(...))` on a ref that
 * resolves to nothing is a no-op, the same forgiving shape George Stacy/Ticket to the Multiverse use in
 * Ghost-Spider's own identity.
 *
 * **Sam Alexander (alter-ego, 28001b)**: "Alter-Ego Action: Spend 1 resource of any type → search your deck and
 * discard pile for Supernova Helmet. Add it to your hand (put it into play instead if you paid for this ability
 * using a [wild] resource)." No printed limit either. `spend(1)` is "1 resource of any type" with no fixed type
 * (`dsl/abilities.ts`); Supernova Helmet is unique (`deckLimit: 1`), so the search is `chooseCards` with
 * `min: 0, max: 1` over `zone(["deck", "discard"], you, { filter: … })` — Doctor Strange's Mystical Studies
 * (`09006.mystical-studies-action`, `wave1/drs/kit.ts`) is the exact model for "search deck and discard pile for a
 * named/identity-set card and add it to hand" (down to the zero-found no-op), except Mystical Studies prints its
 * own "Shuffle your deck." and this card does not — no `shuffleDeck()` here, since nothing in the printed text,
 * RRG 1.8 errata (pp. 67-68) or `nova.ts`'s curation notes says to.
 *
 * The "if you paid … using a [wild] resource" branch is not the `paidWith` predicate (`dsl/values.ts`): that
 * predicate answers "was this cost's requirement satisfiable by a resource of this *type or wild*" (true even off
 * a matched-type resource with no wild spent at all — Relentless Assault's "if you paid … using a [physical]
 * resource", `core/aspects/aggression.ts`), which is the wrong question for "specifically a wild resource was
 * spent". Read directly off the cost's own paid-resource vars instead (`actions.ts` `resourceVars`, the same
 * `paid.<type>`/`paid.wild` vars Relentless Assault's `paidWith` itself is built from): `varAtLeast("paid.wild")`
 * is true only when the resource pool that paid this ability's own `spend(1)` cost actually included a [wild]
 * resource. "Put it into play instead" is `attachCard(chosen("found"), self)` — Supernova Helmet prints no
 * `attachesTo`, so like any upgrade played normally it attaches to the player's own hero identity by default
 * (`self` here, since `identity` is one instance across both faces); `attach` moves the card directly from
 * wherever it was found (deck or discard) to attached-to-host in one step, "whatever zone it came from" per its
 * own docblock in `dsl/effects.ts` (Hawkeye's Quiver precedent: "search the top 5 cards of your deck for an
 * [Arrow] event and attach it faceup to this card") — no `putIntoPlay` needed first.
 */

const SUPERNOVA_HELMET = query("upgrade", { name: "Supernova Helmet" });

export const NOVA_IDENTITY = defineAbilities({
  "28001a.nova-response": response(on.basicPowerUsed("self"), ready(named("Supernova Helmet"))),

  "28001b.sam-alexander-action": alterEgoAction(
    { cost: spend(1) },
    chooseCards("found", zone(["deck", "discard"], you, { filter: SUPERNOVA_HELMET }), { min: 0, max: 1 }),
    ifThen(varAtLeast("paid.wild"), attachCard(chosen("found"), self), moveCards(cards(chosen("found")), "hand")),
  ),
});
