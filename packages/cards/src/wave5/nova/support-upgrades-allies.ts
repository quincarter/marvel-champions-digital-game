import { trait } from "@mc/content";
import {
  alterEgoAction,
  anyOf,
  cards,
  chooseCards,
  chooseOneBy,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  damageThisCardCost,
  defineAbilities,
  discard,
  discardFromHand,
  doublesResourcesWhilePayingFor,
  draw,
  eventPlayer,
  eventTarget,
  exhaustThis,
  forcedInterrupt,
  gainsTrait,
  heal,
  heroAction,
  heroResource,
  heroResponse,
  interrupt,
  identityOf,
  ifThen,
  maxOnePerTriggeringInstance,
  modifyStat,
  moveCards,
  notCountedTowardHandSize,
  on,
  option,
  paidWith,
  playOnlyIf,
  printedCostOf,
  query,
  response,
  rule,
  self,
  spendableForAnyPlayer,
  varOf,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  youHaveTrait,
  zone,
} from "../../dsl/index.js";

const CHAMPION = trait("CHAMPION");
const GENIUS = trait("GENIUS");
const AERIAL = trait("AERIAL");
const ATTACK = trait("ATTACK");
const CIVILIAN = trait("CIVILIAN");

const CONNECTION_TO_THE_WORLDMIND = query("resource", { name: "Connection to the Worldmind" });

/**
 * Nova's supports, upgrades, allies and resources scripted directly (docs/phase7-wave5.md's Nova row): Ms. Marvel
 * (28002), Connection to the Worldmind (28007), Jesse Alexander (28008), Supernova Helmet (28009), The Locust
 * (28010), The Power of Aggression (28015), Fluid Motion (28016), Honed Technique (28017), Moon Girl
 * (28018), Everyday Hero (28019), Champions Mobile Bunker (28020), Height Advantage (28027). Text is read directly
 * from `packages/content/src/data/nova/cards.ts` (no errata on RRG 1.8 pp. 67-68), confirmed against each card's own
 * scan in `assets/card-art/bundles/cards/<id>.png`.
 *
 * **Ms. Marvel (28002)** — "Hero Response: After you play an event, exhaust Ms. Marvel and deal 1 damage to her →
 * return that event to your hand from your discard pile." The cost combines `exhaustThis` with
 * `damageThisCardCost(1)` (`AbilityCost.damageThisCard` — `damageSelf`/`takeDamageCost` instead damages the
 * player's *identity*, per `packages/engine/src/actions.ts`, the wrong target for "deal 1 damage to her"); the
 * trigger is the shared
 * `on.youPlayedCard(query("event"))` response twin ("after you play an [X] card", `dsl/abilities.ts`), not
 * Ms. Marvel's own play (she is an ally, not the event).
 *
 * **Connection to the Worldmind (28007)** — `constant(notCountedTowardHandSize)`, its own worked example in
 * `dsl/abilities.ts` (docs/phase7-wave5.md §3.18).
 *
 * **Jesse Alexander (28008)** — "Alter-Ego Action: Exhaust Jesse Alexander → shuffle 1 copy of Connection to the
 * Worldmind from your discard pile into your deck. Draw 1 card." `chooseCards`/`moveCards(..., "deckShuffle")` is
 * James Rhodes' own precedent for "choose a named card in your discard pile and shuffle it into your deck"
 * (`wave4/warm/war-machine-kit.ts` `23001b.james-rhodes-action`) — `min: 1, max: 1`, since a missing copy makes the
 * choice (and so the ability) have no legal target rather than a soft no-op.
 *
 * **Supernova Helmet (28009)** — "Nova gains the Aerial trait." is `constant(gainsTrait(AERIAL, YOUR_IDENTITY))`,
 * Vision's Solar Gem precedent verbatim (`wave4/vision/vision-kit.ts` `26005.solar-gem-constant`) since neither card
 * prints an `attachesTo` and both default to the player's own identity. "Hero Resource: Exhaust Supernova Helmet →
 * generate a [wild] resource." is the same card's own resource ability, `heroResource({ wild: 1 }, { cost:
 * exhaustThis })`.
 *
 * **The Locust (28010)** — "Play only if your identity has the champion trait" is schema-level
 * `playRestrictions.requiresIdentityTrait` (already on the card record, the Plan B/Ghost-Spider precedent for a play
 * restriction that needs no ability ref of its own). "Hero Response: After The Locust enters play, add 1 Aggression
 * (red) event from your discard pile to your hand" reuses Assault Training's own "choose an Aggression event in your
 * discard pile" shape (`wave4/vision/vision-pack-cards.ts` `26033.assault-training-action`) with `moveCards(...,
 * "hand")` in place of that card's `"deckShuffle"`; `min: 0, max: 1` since an empty discard pile is a legal (if
 * unlikely) state at this point in a game and the printed text has no "if you do".
 *
 * **The Power of Aggression (28015)** reprints Core's own resource verbatim (`01055.the-power-of-aggression-constant`,
 * `core/aspects/aggression.ts`) — same `constant(doublesResourcesWhilePayingFor({ aspect: "aggression" }))`, scripted
 * again under this card's own id rather than aliased (this pack has no reprint-aliasing module of its own yet, the
 * same reasoning `wave4/nebu/nebula-pack-cards.ts` gives for Cosmo/Knowhere).
 *
 * **Fluid Motion (28016)** — "Hero Response: After you play an Attack event, exhaust this card → your hero gets +1
 * ATK until the end of the phase. (Max 1 per Attack event.)" `on.youPlayedCard(query("event", { trait: ATTACK }))` is
 * the shared "after you play an [X] event" response (Morphogenetics' `afterYouPlay` precedent, promoted to DSL
 * sugar); `modifyStat("atk", 1, yourIdentity, "endOfPhase")` is Core's Combat Training precedent
 * (`core/aspects/leadership.ts`); the printed "(Max 1 per Attack event.)" is `maxOnePerTriggeringInstance`
 * (`dsl/abilities.ts`), the same named export Web-Bracelet's identical parenthetical uses
 * (`wave5/sm/ghost-spider/support-upgrades-allies.ts` `27009.web-bracelet-response`).
 *
 * **Honed Technique (28017)** — "Interrupt: When you play an Aggression Attack event, if you paid for that event using
 * a [mental] resource, increase the amount of damage that event deals by its printed cost." `on.youPlay(query("event",
 * { aspect: "aggression", trait: ATTACK }))` is the `cardBeingPlayed` interrupt point before the event's own abilities
 * resolve, and `modifyCardEffect` on `eventTarget` is Embiggen!'s own "increase the amount of damage that event deals"
 * (`wave1/msm/kit.ts` `05010.embiggen-interrupt`): every instance of damage the event deals is increased (RRG 1.8
 * "Event", p. 19; FAQ "Embiggen (#10)", p. 59), by `printedCostOf(eventTarget)`. "If you paid for that event" is
 * `paidWith("mental", eventTarget)`: with `of`, the predicate reads the paid vars of the event's own play in progress
 * (`playPaymentVars`, `packages/engine/src/stack.ts`) rather than this upgrade's own ability frame, which never has a
 * payment (Honed Technique is already in play, not the card being played). A [wild] resource counts, as for every
 * `paidWith` (RRG 1.8 "Wild Resource", p. 48). The condition is an `ifThen` inside the effect (the `qsv`/`scw`
 * `paidWith` precedent), so the optional interrupt is still offered, as a no-op, for an event paid without [mental].
 * No Aggression Attack event in the pool prints an X cost, so "its printed cost" is always a number here.
 *
 * **Moon Girl (28018)** — "Play only if your identity has the champion or genius trait": `PlayRestrictions.
 * requiresIdentityTrait` (`packages/content/src/schema/index.ts`) is a single trait string, which can't express an
 * OR of two traits. The ingestion parser's `Play only if your identity has the (.+) trait.` regex used to capture
 * "champion or genius" whole and emit it as one bogus literal trait (`"CHAMPION OR GENIUS"`, never held by any
 * identity, permanently blocking the card from being playable) — fixed in `parse-text.ts` (guarding the capture
 * against `" or "`/`" and "`) so the sentence is left unmatched and falls through to the ordinary constant-ability
 * buffer instead, giving this card a real `28018.moon-girl-constant` ref with no `playRestrictions` at all. Scripted
 * here as `constant(playOnlyIf(anyOf(youHaveTrait(CHAMPION), youHaveTrait(GENIUS))))` — the "schema has no
 * restriction field for this" shape Spider-Man/Hobie Brown's own `27017.spider-man-constant` already uses
 * (`wave5/sm/ghost-spider/support-upgrades-allies.ts`). "Response: After you play Moon Girl from your hand, draw 1
 * card for each [mental] resource used to pay for her" is `on.youPlayThis()` (Eros' own precedent for "after you
 * play [this ally] … for each [mental] resource you used to pay for [it]", `wave4/nebu/nebula-pack-cards.ts`
 * `22011.eros-response`) with `draw(varOf("paid.mental"))` in place of Eros' `confuse` — `paid.mental` is read here
 * (unlike Honed Technique above) because this response lives in Moon Girl's *own* ability frame, seeded from Moon
 * Girl's *own* `playCard` frame (`playPaymentVars` matches by instance id).
 *
 * **Everyday Hero (28019)** — the card's single printed sentence, "While your identity has the [Civilian] trait,
 * this card can be spent for any player and gains the text: 'Response: After you spend this card for a player, heal
 * 1 damage from that player's identity,'" is two distinct trigger kinds (a `constant` field and a `response`) that
 * cannot share one `AbilityDefinition`. The ingestion parser's header scan deliberately never reads a *quoted*
 * bold timing word as a real header (so a quoted ability *name* elsewhere in the corpus, e.g. "Optic Blast", is
 * never mistaken for one) — fixed narrowly in `parse-text.ts` for the specific `gains the text: "…"` idiom: the
 * quoted clause is *also* run through the header scan on its own, giving this card a second, real
 * `28019.everyday-hero-response` ref, while `text.printed`/`current` (and every other card's parsing) are
 * unchanged. `constant(spendableForAnyPlayer(youHaveTrait(CIVILIAN)))` is `dsl/abilities.ts`'s own worked example
 * for this exact card (docs/phase7-wave5.md §3.17). The response is `on.youSpendThis()` ("you" = this card's owner,
 * "that player" = `eventPlayer`, per that same worked example) with `heal(1, identityOf(eventPlayer))` gated by
 * `ifThen(youHaveTrait(CIVILIAN), …)`: since the response text is itself only "gained" while the identity has the
 * Civilian trait, an ability that would otherwise exist unconditionally is instead wrapped in a no-op condition —
 * the same forgiving shape `wave5/nova/identity.ts` already documents for a ready-by-name on a card that may not be
 * in play (nothing to observe differs from the card's response text not existing at all while the condition is
 * false, since a Response never asks the player anything).
 *
 * **Champions Mobile Bunker (28020)** — "Hero Action: Exhaust Champions Mobile Bunker → choose an identity with the
 * champion trait. The player who controls that identity may draw 2 cards, then discard 2 cards from their hand."
 * `chooseTarget` picks the identity; `chooseOneBy(controllerOf(chosen("identity")), …)` is Calculate the Odds' own
 * "that player may … then …" idiom (`wave3/gmw/market.ts` `16154.calculate-the-odds-action`) over a chosen player
 * reached through `controllerOf` rather than `choosePlayer`, since the printed text chooses an identity, not a
 * player, first.
 *
 * **Height Advantage (28027)** — "While your identity has the Aerial trait, reduce the amount of damage you take
 * from each enemy attack by 1" is the engine's own `RuleSpec.reduceDamageTaken` (`packages/engine/src/abilities.ts`,
 * the mirror of `increaseDamageTaken`, which has DSL sugar already; this one does not yet), composed here with the
 * local `rule(...)` wrapper the same way `wave1/msm/kit.ts`'s `whenYouPlay` composes a raw `EventPattern` before its
 * own DSL sugar existed — `target: yourIdentity`'s query form, `fromAttack: true`, `while: youHaveTrait(AERIAL)`.
 * "Forced Interrupt: When your turn begins, discard this card" is The Poison's own precedent verbatim
 * (`wave3/gmw/galactic-artifacts.ts` `16125.the-poison-forced-interrupt`'s trigger, `forcedInterrupt(on.
 * yourTurnBegins(), discard(self))` here since this card's own forced effect is only the discard, not a counter).
 */
export const NOVA_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "28002.ms-marvel-response": heroResponse(
    on.youPlayedCard(query("event")),
    { cost: [exhaustThis, damageThisCardCost(1)] },
    moveCards(cards(eventTarget), "hand"),
  ),

  "28007.connection-to-the-worldmind-constant": constant(notCountedTowardHandSize),

  "28008.jesse-alexander-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone("discard", you, { filter: CONNECTION_TO_THE_WORLDMIND }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "deckShuffle"),
    draw(1),
  ),

  "28009.supernova-helmet-constant": constant(gainsTrait(AERIAL, YOUR_IDENTITY)),
  "28009.supernova-helmet-resource": heroResource({ wild: 1 }, { cost: exhaustThis }),

  "28010.the-locust-response": heroResponse(
    on.entersPlay("self"),
    chooseCards("found", zone("discard", you, { filter: query("event", { aspect: "aggression" }) }), {
      min: 0,
      max: 1,
    }),
    moveCards(cards(chosen("found")), "hand"),
  ),

  "28015.the-power-of-aggression-constant": constant(doublesResourcesWhilePayingFor({ aspect: "aggression" })),

  "28016.fluid-motion-response": heroResponse(
    on.youPlayedCard(query("event", { trait: ATTACK })),
    { cost: exhaustThis, limit: maxOnePerTriggeringInstance },
    modifyStat("atk", 1, yourIdentity, "endOfPhase"),
  ),

  "28017.honed-technique-interrupt": interrupt(
    on.youPlay(query("event", { aspect: "aggression", trait: ATTACK })),
    ifThen(paidWith("mental", eventTarget), {
      kind: "modifyCardEffect",
      card: eventTarget,
      damage: printedCostOf(eventTarget),
    }),
  ),

  "28018.moon-girl-constant": constant(playOnlyIf(anyOf(youHaveTrait(CHAMPION), youHaveTrait(GENIUS)))),
  "28018.moon-girl-response": response(on.youPlayThis(), draw(varOf("paid.mental"))),

  "28019.everyday-hero-constant": constant(spendableForAnyPlayer(youHaveTrait(CIVILIAN))),
  "28019.everyday-hero-response": response(
    on.youSpendThis(),
    ifThen(youHaveTrait(CIVILIAN), heal(1, identityOf(eventPlayer))),
  ),

  "28020.champions-mobile-bunker-action": heroAction(
    { cost: exhaustThis },
    chooseTarget("identity", query("identity", { trait: CHAMPION })),
    chooseOneBy(
      controllerOf(chosen("identity")),
      option(
        "Draw 2 cards, then discard 2 cards from your hand",
        draw(2, controllerOf(chosen("identity"))),
        discardFromHand(2, controllerOf(chosen("identity"))),
      ),
      option("Do not"),
    ),
  ),

  "28027.height-advantage-constant": constant(
    rule({
      kind: "reduceDamageTaken",
      target: YOUR_IDENTITY,
      amount: 1,
      fromAttack: true,
      while: youHaveTrait(AERIAL),
    }),
  ),
  "28027.height-advantage-forced-interrupt": forcedInterrupt(on.yourTurnBegins(), discard(self)),
});
