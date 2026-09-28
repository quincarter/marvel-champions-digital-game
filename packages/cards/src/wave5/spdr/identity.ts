import {
  alterEgoAction,
  constant,
  coveredByEngineRule,
  defineAbilities,
  draw,
  exhaustCardsCost,
  query,
  textBoxCannotBeBlanked,
} from "../../dsl/index.js";

/**
 * SP//dr Suit / Peni Parker (31001a/31001b/31002/31002b, SP//dr Hero Pack p. 1, docs/phase7-wave5.md §2.1's `spdr`
 * row, §3.24): read directly off `packages/content/src/data/spdr/cards.ts` (no errata, no `curation/spdr.ts`
 * correction on any of the four faces her identity spans). Her signature events/support/upgrades/allies
 * (31003-31024) are a separate module (not yet built); her obligation (Inherited Burden, 31025) and nemesis set
 * (M.O.R.B.I.U.S./Giant Monster Attack/Energy Drain ×3, 31026-31029) and the Iron Spider's Sinister Syndicate
 * modular (31030-31038) are likewise separate.
 *
 * **A separated identity, not a two-faced one**: the identity instance is Peni Parker (alter-ego) or the SP//dr
 * Suit (hero); the *other* physical card lives as a second engine instance, a permanent support (the INACTIVE
 * Suit, in alter-ego form) or a permanent upgrade attached to the identity (SP//dr, in hero form). §3.24 landed
 * the whole transition (`createGame` seating Peni Parker with the Suit set aside, `flipSeparatedCard` on every
 * `setForm`, counters/attachments moving per Q38, ready state following the physical card per Q37, statuses
 * staying on the identity per Q39) as engine-native machinery — nothing here re-implements any of it.
 *
 * **31002 Psychogenetic Compatibility — Setup** (alter-ego): "Put SP//dr Suit into play, INACTIVE side faceup."
 * This is Appendix II step 16 itself for a separated identity (RRG 1.8 p. 51): `putSeparatedCardIntoPlay` runs for
 * every player during setup regardless of any card text (`flow.ts`), so this printed sentence names a step the
 * engine already always takes — `coveredByEngineRule()`, the same shape Ironheart's 29001b's own "Begin the game
 * with this card" carries an ability id only so the printed sentence has a ref (`wave5/ironheart/identity.ts`).
 *
 * **31001b Return to Base — Forced Interrupt** (the INACTIVE support side) / **31002b Suit Up! — Forced Interrupt**
 * (the SP//dr upgrade side): "When you flip to this side, flip [the other card] to [its other form] … moving all
 * counters on this card and cards attached to this card to [the identity]." Exactly the transition `flipSeparatedCard`
 * runs for every `setForm` (§3.24's own docblock in `packages/engine/src/separated-identity.ts`), so both are
 * `coveredByEngineRule()` too — scripting either as its own trigger would double the engine's own transition.
 *
 * **31001b / 31002b's own "This card's printed text box cannot be treated as if it were blank."** (§3.31):
 * `constant(textBoxCannotBeBlanked())`, the exact builder this printed sentence exists for
 * (`dsl/abilities.ts`'s own docblock cites these two ids by name).
 *
 * **31002 Maintenance — Alter-Ego Action**: "Exhaust SP//dr Suit → draw 2 cards." Only reachable in alter-ego form
 * (the ability is printed on the alter-ego face, `alterEgoAction`'s own gate), where "SP//dr Suit" unambiguously
 * names the INACTIVE support side (the only "SP//dr Suit"-titled card in play then — the identity itself is Peni
 * Parker in that form). `exhaustCardsCost(query("support", { name: "SP//dr Suit", controller: "you" }))` auto-picks
 * that one candidate (`planInPlayPick`'s `candidates.length === pick.min` shortcut, `packages/engine/src/actions.ts`)
 * with no separate choice needed. Ready/exhausted follows the physical card (Q37) — this leaves the *hero* form
 * exhausted on the next flip, as the RRG's own "Change Form" ready-state carry-over would not, which is exactly
 * what the community reading §3.24 built expects.
 *
 * **31001a Sync Ratio — Resource** (hero): "Exhaust an Interface upgrade you control → generate that upgrade's
 * resources." **Not scripted — a genuine engine gap, not a DSL gap to shim around.** `ResourceGeneration`
 * already has the right shape for "that card's printed resources" (`printedResourcesOf`, `dsl/abilities.ts`), and
 * `AbilityCost.exhaustCards` already has the right shape for "choose and exhaust a card matching a query"
 * (`exhaustCardsCost`), but the two cannot be wired together today: every call site that evaluates a resource
 * ability's `generates` while it is used in a payment (`generatedResources`, called from `payPayment` and from
 * `paymentSourceVars`/`resourceAbilityFault` in `packages/engine/src/actions.ts`) builds its `EffectContext` with
 * `bindings: {}` literally, and evaluates `generates` *before* the ability's own `cost` is paid (`payCost` runs
 * only after `generatedResources` has already computed the pool). So a `printedResourcesOf(query(…, { inSlot:
 * "exhausted" }))` reading the card `exhaustCardsCost`'s own pick bound to slot `"exhausted"` can never see that
 * binding — `packages/engine/src/select.ts`'s `inSlot` check reads `context.bindings[slot]`, which is always empty
 * here. The primitive needed: thread the resource ability's own cost pick(s) into the context `generates` is
 * evaluated with (or evaluate the cost before pricing `generates`, the RRG 1.8 "Initiating Abilities" p. 24 order
 * anyway — pay costs, then resolve/measure effects). Flagged for `game-rules-architect`/whoever owns
 * `packages/engine/src/actions.ts`'s resource-payment path; no ability id is registered for `31001a.sync-ratio`
 * until it lands (so a deck naming it stays legible as "unscripted", not silently wrong).
 */

const SPDR_SUIT = query("support", { name: "SP//dr Suit", controller: "you" });

export const SPDR_IDENTITY = defineAbilities({
  "31002.psychogenetic-compatibility": coveredByEngineRule(),
  "31002.maintenance": alterEgoAction({ cost: exhaustCardsCost(SPDR_SUIT) }, draw(2)),

  "31001b.sp-dr-suit-constant": constant(textBoxCannotBeBlanked()),
  "31001b.return-to-base": coveredByEngineRule(),

  "31002b.sp-dr-constant": constant(textBoxCannotBeBlanked()),
  "31002b.suit-up": coveredByEngineRule(),
});
