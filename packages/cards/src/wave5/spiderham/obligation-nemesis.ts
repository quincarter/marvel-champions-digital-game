import { trait } from "@mc/content";
import type { Predicate } from "@mc/engine";
import {
  allOf,
  cards,
  chooseOne,
  chosen,
  confuse,
  constant,
  defeatingPlayer,
  defineAbilities,
  each,
  encounterCards,
  enemyAttack,
  exhaust,
  exists,
  forcedResponse,
  gainsTrait,
  hasStatus,
  ifThen,
  inPlay,
  moveCards,
  named,
  option,
  putIntoPlay,
  query,
  removeAllCountersFrom,
  removeCountersFrom,
  self,
  selectCards,
  shuffleEncounterDeck,
  stun,
  surge,
  takeDamage,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { discardThisObligation, mayFlipToAlterEgo } from "../../core/obligations.js";

const GREEN_GOBBLER = "The Green Gobbler";

/**
 * "I Really Want a Hot Dog!" (30024), Spider-Ham's obligation, and his nemesis set: Nefarious Trap (30025, side
 * scheme), The Green Gobbler (30026, nemesis minion), Gobbler Glider (30027, attachment), "Feast on This!" (30028,
 * treachery, quantity 2). Read directly off `packages/content/src/data/spiderham/cards.ts` (no errata, no
 * `curation/spiderham.ts` correction on any of the five — the scans at `assets/card-art/bundles/cards/3002{4-8}.png`
 * match `text.printed`/`text.current` word for word for every card below).
 *
 * **"I Really Want a Hot Dog!" (30024, obligation)**: "Give to the Peter Porker player" is data
 * (`obligationCardId`, the same shape as every other obligation in this engine). This does **not** fit Core's shared
 * `obligation()` helper (`core/obligations.ts`) — that helper's first option is a bare "Exhaust [alter-ego] → remove
 * this from the game", but this card's first option is "Exhaust Peter Porker **and remove 1 toon counter from him**
 * → remove this from the game", a second, independent cost component the shared `exhaustAlterEgoToRemove` doesn't
 * have room for. Built directly from the exported `mayFlipToAlterEgo` instead, the same "doesn't fit the shape"
 * precedent as Venom's Struggle for Control (`wave3/vnm/venom-obligation-nemesis.ts` 20023) and Nova's own docblock —
 * both cited there for exactly this. `hasToonCounter()` (a local `Predicate.counterAtLeast` on `yourIdentity`, the
 * `wave5/ironheart/obligation-nemesis.ts` `hasProgressCounter` precedent for a raw `Predicate` shape with no
 * `dsl/values.ts` wrapper of its own) gates the option alongside the usual "a ready alter-ego to exhaust" check —
 * RRG 1.8 "Cost" (p. 13): a cost is paid in full or not at all, so an option needing both a ready alter-ego *and* a
 * toon counter to spend is only offered when both are true at once. Toon counters live on Spider-Ham's identity
 * instance itself regardless of which face is up (`identity.ts`'s own docblock), so `yourIdentity` is the same ref
 * whether "Peter Porker" is currently showing or not. The second option, "You are stunned. If you are already
 * stunned, this card gains surge. Discard this obligation," reads "already" before this reveal's own stun is applied
 * — the same order Gamora's Waylay (`wave3/gam/gamora-obligation-nemesis.ts` 18028) and "Feast on This!" below use.
 *
 * **Nefarious Trap (30025, side scheme)**: "When Defeated: The Green Gobbler attacks the player who defeated this
 * scheme. If The Green Gobbler is not in play, search the encounter deck and discard pile for him and put him into
 * play engaged with the player who defeated this scheme." Read as an if/else on whether he was already in play to
 * attack, not as two always-both-happen instructions — a card that isn't in play cannot attack (RRG 1.8 "Attack
 * (Enemy)"), so the fetch clause is the alternative for exactly that case, not an addition to it. `defeatingPlayer`
 * (`dsl/values.ts`, the Crossbones' Assault / Red Skull precedent, `wave2/trors/crossbones.ts` 04070,
 * `wave2/trors/red-skull.ts`) is "the player who defeated this scheme". The fetch clause has no printed "then
 * shuffle the encounter deck" sentence (unlike the Core Madame Hydra/M.O.D.O.K. precedent it otherwise matches,
 * `core/modular/hydra-and-doomsday.ts` 01180's own `fetchIntoPlay`), but RRG 1.8 "Search" (p. 39): "If any portion
 * of a deck is searched, upon completion of that…card ability, shuffle that entire deck" applies regardless of
 * whether the card's own text repeats it — `shuffleEncounterDeck()` runs here for that reason, not because the
 * printed text says so.
 *
 * **The Green Gobbler (30026, nemesis minion)**: "Forced Response: After The Green Gobbler engages you, discard all
 * counters from each card you control." `{ on: "minionEngaged", selfIs: "source" }` is the landed "after it engages
 * you" primitive (`wave4/mts/tower-defense.ts` 21102 Black Order Besieger precedent verbatim — no `playerIs` needed;
 * a minion has no controller, so a triggered ability's own "you" already resolves to the engaged player straight off
 * the event). "Each card you control" is `each(query([], { controlledBy: you }))` — the Nova "The War's Been
 * Brought" precedent for "cards under your control" (`wave5/nova/obligation-nemesis.ts` 28025), any card type, not
 * one narrowed list. "Discard all counters" (every counter type present, not one named type by a fixed amount) had
 * no existing DSL primitive — `removeCountersFrom` only ever removes one named counter type. Extended the engine's
 * `removeCounters` effect additively (`counterType`/`amount` both now optional; omitted means "every counter type
 * this target holds, each fully removed" — `packages/engine/src/spec.ts`, `packages/engine/src/resolve/
 * apply-effect.ts`) rather than special-case this one card, and exposed it as `removeAllCountersFrom` (`dsl/
 * effects.ts`) — the existing single-type `removeCountersFrom` is untouched (its own `counterType`/`amount` stay
 * required at the call site, so no existing caller's behavior changes).
 *
 * **Gobbler Glider (30027, attachment)**: "Surge." is a printed, unconditional keyword (`keywords: [{ name:
 * "surge" }]` in the data, unlike Cyborg Tech's/Goblin Glider's own *conditional* "if you cannot, gains surge" —
 * those are scripted `whenRevealed` effects; this is a standing keyword the engine applies with no ability of its
 * own). "Attach to The Green Gobbler. If you cannot, attach to a minion." is data
 * (`attachesTo: { kind: "ifAble", preferred: { kind: "namedCard", name: "The Green Gobbler" }, otherwise: { kind:
 * "minion" } }` — the same `ifAble` shape as every other Sinister-Six-style nemesis attachment with a preferred/
 * fallback host, `ant` 12028/`wsp` 13029/`gmw` 16056/etc.; the engine's `ifAble` resolution already tries `preferred`
 * then `otherwise` with no ability needed, per `wave2.test.ts`/`wave2-later-packs.test.ts`'s own coverage). Only
 * "Attached minion gains the Aerial trait" needs a script: `gainsTrait(trait("AERIAL"), query("minion", {
 * hostOfSelf: true }))` — the Sky Cycle precedent (`wave2/trors/hawkeye-kit.ts` 04015).
 *
 * **"Feast on This!" (30028, treachery, quantity 2)**: "When Revealed: Take 2 damage. You are confused. If you
 * already confused, this card gains surge." (printed typo: "you already confused", not "you are already confused" —
 * kept verbatim, current text repeats it). Same "check already, then apply" order as 30024's second option and
 * Gamora's Waylay above.
 */

const hasToonCounter = (): Predicate => ({
  kind: "counterAtLeast",
  of: yourIdentity,
  counterType: "toon",
  amount: 1,
});

export const SPIDERHAM_OBLIGATION_NEMESIS = defineAbilities({
  // "I Really Want a Hot Dog!" — Give to the Peter Porker player. You may flip to alter-ego form. Choose:
  // • Exhaust Peter Porker and remove 1 toon counter from him → remove this obligation from the game.
  // • You are stunned. If you are already stunned, this card gains surge. Discard this obligation.
  "30024.obligation": whenRevealed(
    mayFlipToAlterEgo,
    chooseOne(
      option(
        "Exhaust Peter Porker and remove 1 toon counter from him → remove this obligation from the game",
        { when: allOf(exists(query("alterEgo", { controller: "you", exhausted: false })), hasToonCounter()) },
        exhaust(yourIdentity),
        removeCountersFrom(yourIdentity, "toon", 1),
        moveCards(cards(self), "removedFromGame"),
      ),
      option(
        "You are stunned",
        ifThen(hasStatus(yourIdentity, "stunned"), surge()),
        stun(yourIdentity),
        discardThisObligation,
      ),
    ),
  ),

  // Nefarious Trap — When Defeated: The Green Gobbler attacks the player who defeated this scheme. If The Green
  // Gobbler is not in play, search the encounter deck and discard pile for him and put him into play engaged with
  // the player who defeated this scheme.
  "30025.when-defeated": whenDefeated(
    ifThen(inPlay(GREEN_GOBBLER), enemyAttack(named(GREEN_GOBBLER), { against: defeatingPlayer }), [
      selectCards("gobbler", encounterCards(["deck", "discard"], { name: GREEN_GOBBLER })),
      putIntoPlay(chosen("gobbler"), defeatingPlayer),
      shuffleEncounterDeck(),
    ]),
  ),

  // The Green Gobbler — Forced Response: After The Green Gobbler engages you, discard all counters from each card
  // you control.
  "30026.the-green-gobbler-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    removeAllCountersFrom(each(query([], { controlledBy: you }))),
  ),

  // Gobbler Glider — Surge (data). Attach to The Green Gobbler. If you cannot, attach to a minion (data). Attached
  // minion gains the Aerial trait.
  "30027.gobbler-glider-constant": constant(gainsTrait(trait("AERIAL"), query("minion", { hostOfSelf: true }))),

  // "Feast on This!" — When Revealed: Take 2 damage. You are confused. If you already confused, this card gains
  // surge.
  "30028.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "confused"), surge()),
    takeDamage(2),
    confuse(yourIdentity),
  ),
});
