import { trait } from "@mc/content";
import {
  boost,
  chooseOne,
  chosen,
  chooseCards,
  constant,
  countAmong,
  dealDamage,
  defineAbilities,
  exhaust,
  exists,
  firstPlayer,
  ifThen,
  option,
  putIntoPlay,
  query,
  rule,
  self,
  setAside,
  surge,
  valueAtLeast,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { discardThisObligation, mayFlipToAlterEgo } from "../../core/obligations.js";

const SYMBIOTE = trait("SYMBIOTE");

/**
 * Struggle for Control (20023), Venom's obligation, and his nemesis set: Klyntar Frenzy (20024), Enraged Symbiote
 * ×4 (20025).
 *
 * **Struggle for Control does not fit the shared `obligation()` shape** (`core/obligations.ts`): its first option
 * is "Exhaust Flash Thompson **and take 2 damage** → discard this obligation" — a different cost (taking damage,
 * not just exhausting) and a different destination (discard, not "remove from the game") than the shared
 * `exhaustAlterEgoToRemove` bakes in. Built directly from `mayFlipToAlterEgo` (exported additively from
 * `core/obligations.ts` for exactly this) and `discardThisObligation` instead.
 *
 * **How many Enraged Symbiote copies start set aside (docs/phase7-wave3.md §4 Q8): all 4 — and this is already
 * the engine's own general default, not a Venom-specific setup step to build.** `packages/engine/src/setup.ts`
 * (`config.includeIdentitySets !== false` branch): "Obligations and nemesis cards have no encounter deck of their
 * own" — every hero's own obligation is shuffled into the (active villain's) encounter deck at setup (RRG 1.8
 * "Obligation", p. 30, step 10), but every *other* nemesis-set card (a nemesis minion, a nemesis side scheme) is
 * instead pushed onto that player's own `PlayerState.setAside` and left there — nothing shuffles it into the
 * encounter deck automatically. `stackSetAside`'s own docblock (`packages/cards/src/testing/staging.ts`) and the
 * `stld` session's own Spartoi Cunning comment (`star-lord-obligation-nemesis.test.ts`) already establish this for
 * their own packs' nemesis sets; Klyntar Frenzy and all 4 Enraged Symbiote copies (`quantityInSet: 4`,
 * `packages/content/src/data/vnm/cards.ts`) start there the same way. So the obligation's own "Put 1 set-aside
 * copy of Enraged Symbiote into play" is `CardSelector setAside(you, …)` (`dsl/effects.ts`'s `setAside`, reading
 * `player.setAside`), not the scenario-wide `encounterSetAside` (a *different* zone, `GameState.encounterSetAside`,
 * for a scenario-specific card like the Milano — the wrong one for a nemesis-set card). Corroborated independently
 * by two secondary sources (not authoritative on their own, per CLAUDE.md, but consistent with the engine's own
 * general rule and with each other): the Venom insert's own FAQ (fetched this pass,
 * `hallofheroeslcg.com/wp-content/uploads/2021/07/venominsert.jpg`) — "Q: Each Enraged Symbiote has the text
 * 'Venom's nemesis minion.' If Venom is told to put his nemesis minion into play (such as when revealing Shadow of
 * the Past), what happens? A: Because each copy of Enraged Symbiote is considered to be Venom's nemesis minion,
 * Venom will put all set-aside copies of Enraged Symbiote into play." — and an official FFG ruling (Hall of Heroes
 * "Latest FFG Rulings (post-RRG 1.5)", May 18, 2023, Alex): "If you reveal Shadow of the Past while playing the
 * Venom hero and you can't put all **4** copies of his nemesis minion into play (like if you had already put one
 * into play earlier from his obligation) … you simply put as many as you can that are currently set aside."
 * Neither source is needed to justify the engine's *own* general nemesis-set rule, but both confirm the printed
 * count (4) and that Shadow of the Past (an unrelated treachery, not scripted by this pack) draws from the same
 * pool the obligation's own option does.
 */
export const VENOM_OBLIGATION_NEMESIS = defineAbilities({
  // Struggle for Control — Give to the Flash Thompson player. You may flip to your alter-ego form. Choose:
  // • Exhaust Flash Thompson and take 2 damage → discard this obligation.
  // • Put 1 set-aside copy of Enraged Symbiote into play engaged with the first player. If you cannot, this card
  //   gains surge. Discard this obligation.
  "20023.obligation": whenRevealed(
    mayFlipToAlterEgo,
    chooseOne(
      option(
        "Exhaust Flash Thompson and take 2 damage → discard this obligation",
        { when: exists(query("alterEgo", { controller: "you", exhausted: false })) },
        exhaust(yourIdentity),
        dealDamage(2, yourIdentity),
        discardThisObligation,
      ),
      option(
        "Put 1 set-aside copy of Enraged Symbiote into play engaged with the first player",
        chooseCards("symbiote", setAside(you, query("minion", { name: "Enraged Symbiote" })), { min: 0, max: 1 }),
        // Not `exists({ inSlot: "symbiote" })`: `Predicate exists` resolves through `selectTargets`, which is
        // scoped to `cardsInPlay` (`packages/engine/src/select.ts`) — always false for a still-set-aside card, so
        // it would silently take the "cannot" branch even when one was just chosen. `countAmong` reads the bound
        // slot directly, wherever its cards are (`dsl/values.ts`'s own docblock: "not restricted to in play").
        ifThen(
          valueAtLeast(countAmong(chosen("symbiote"), query("minion")), 1),
          putIntoPlay(chosen("symbiote"), firstPlayer),
          surge(),
        ),
        discardThisObligation,
      ),
    ),
  ),

  // Klyntar Frenzy — Threat cannot be removed from this scheme while a Symbiote enemy is in play.
  "20024.klyntar-frenzy-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: { self: true },
      while: exists(query("enemy", { trait: SYMBIOTE })),
    }),
  ),

  // Enraged Symbiote — Guard. Patrol (data). [star] Boost: Put Enraged Symbiote into play engaged with you.
  "20025.boost": boost(putIntoPlay(self)),
});
