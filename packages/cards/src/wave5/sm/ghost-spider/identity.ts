import type { EventPattern, TargetQuery } from "@mc/engine";
import {
  action,
  chooseCards,
  chooseOne,
  chosen,
  cards,
  defineAbilities,
  moveCards,
  named,
  option,
  query,
  ready,
  response,
  self,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Ghost-Spider / Gwen Stacy (27001a/b, MC27 p. 5): docs/phase7-wave5.md §2.1, §3.32. Her obligation (Worried
 * Father, 27025) and nemesis set (The Lizard, 27026–27029) are scripted separately
 * (`obligation-nemesis.ts`, not yet built); her signature events/support/upgrade/allies (27002–27024) are
 * likewise a separate module (`events.ts`, `support-upgrades-allies.ts`, not yet built).
 *
 * **Ghost-Spider (hero, 27001a) — "Dizzying Reflexes"**: "Response: After you resolve an 'Interrupt' or 'Response'
 * ability on an event, ready Ghost-Spider. (Limit once per phase.)" The trigger is the `abilityResolved` event
 * (`packages/engine/src/trigger-events.ts`), filtered to abilities resolving *on an event card*
 * (`TargetQuery.abilityTiming`, docs/phase7-wave4.md §3.33 — the same primitive Vision's Phase Disruption and
 * Adam Warlock's kit already use for "a card with the text 'Hero Action'/'Hero Response'"/"resolve X's ability")
 * with every printed timing word that reads "Interrupt" or "Response" (Hero/Alter-Ego/Forced variants included,
 * since each of those still prints "Interrupt:"/"Response:" in its own ability box). No `dsl/abilities.ts` `on.*`
 * wrapper for "abilityResolved" exists yet (`wave1/bkw/local.ts`'s `onAbilityResolvedOf` is the same un-sugared
 * shape, filtering by source card instead of by timing word) — composed locally here, matching §3.32's own
 * `abilityResolved` + `abilityTiming` citation for this exact card (also Web-Bracelet, 27009, `events.ts`).
 *
 * **Gwen Stacy (alter-ego, 27001b)**: "Action: Choose to either shuffle Ticket to the Multiverse from your discard
 * pile into your deck or ready George Stacy. (Limit once per round.)" Plain `action()`, not `alterEgoAction()`:
 * the identity's alter-ego face prints no "Alter-Ego" prefix on this one (Core precedent: Spider-Man's `01001b`
 * "Rechannel", Iron Man's `01029b` "Futurist" and Captain Marvel's `01010b` "Commander" are all plain `action()`
 * on an alter-ego face). Ticket to the Multiverse (27008) is unique and `deckLimit: 1`, so "shuffle it from your
 * discard pile" is a `chooseCards` with `min: 0, max: 1` (not gated by a `when`, since the engine's `exists()`
 * predicate only reads cards *in play* — `packages/engine/src/select.ts`'s `selectTargets` is `cardsInPlay(state)
 * .filter(...)` — and has nothing to check a discard pile with); choosing nothing when it isn't there is a no-op,
 * the same forgiving shape zero-target effects already take elsewhere. George Stacy (27007) is unique, so
 * `named()` finds him without a choice.
 */

const INTERRUPT_OR_RESPONSE_TIMINGS = [
  "interrupt",
  "heroInterrupt",
  "alterEgoInterrupt",
  "forcedInterrupt",
  "response",
  "heroResponse",
  "alterEgoResponse",
  "forcedResponse",
] as const;

const EVENT_WITH_INTERRUPT_OR_RESPONSE: TargetQuery = {
  categories: ["event"],
  abilityTiming: INTERRUPT_OR_RESPONSE_TIMINGS,
};

/** "After you resolve an 'Interrupt' or 'Response' ability on an event" (Ghost-Spider, Web-Bracelet). */
export const onInterruptOrResponseResolvedOnEvent: EventPattern = {
  on: "abilityResolved",
  playerIs: "controller",
  sourceIs: EVENT_WITH_INTERRUPT_OR_RESPONSE,
};

export const GHOST_SPIDER_IDENTITY = defineAbilities({
  "27001a.ghost-spider-constant": response(
    onInterruptOrResponseResolvedOnEvent,
    { limit: { count: 1, period: "phase" } },
    ready(self),
  ),

  "27001b.gwen-stacy-action": action(
    { limit: { count: 1, period: "round" } },
    chooseOne(
      option(
        "Shuffle Ticket to the Multiverse into your deck",
        chooseCards(
          "ticket",
          zone("discard", you, { filter: query("upgrade", { name: "Ticket to the Multiverse" }) }),
          { min: 0, max: 1 },
        ),
        moveCards(cards(chosen("ticket")), "deckShuffle"),
      ),
      option("Ready George Stacy", ready(named("George Stacy"))),
    ),
  ),
});
