import { trait } from "@mc/content";
import {
  anAttackableEnemy,
  aScheme,
  attack,
  cards,
  changeForm,
  chooseCards,
  choosePlayer,
  chooseOne,
  chosen,
  chosenPlayer,
  countAmong,
  defineAbilities,
  each,
  encounterCards,
  exhaust,
  exhaustCardsCost,
  hasStatus,
  heal,
  ifElse,
  ifThen,
  moveCards,
  option,
  paidWith,
  placeOnTopOrBottom,
  placeOnTopOrBottomOfPlayerDeck,
  query,
  ready,
  removeThreat,
  resolveSpecialsOf,
  scaled,
  selectCards,
  sum,
  teamUpCharacters,
  thwartAScheme,
  topOfDeck,
  yourIdentity,
  heroAction,
  action,
  alterEgoAction,
} from "../../../dsl/index.js";

/** Every S.H.I.E.L.D. card the S.H.I.E.L.D.-tactic events name — an exact trait match (docs/phase7-wave5.md's own
 * "Spider" precedent, FAQ p. 62: matched by the printed trait itself, not a substring). Cards printed
 * "S.H.I.E.L.D. Tactic." or "S.H.I.E.L.D. Spy." carry two traits, so they match too. Any player-card category with the trait qualifies (this precon alone
 * prints it on a support, `27036`/`27044`/`27045`, and an ally, `27040`/`27047`). */
const SHIELD_CARD = query(["ally", "upgrade", "support"], { trait: trait("S.H.I.E.L.D.") });

/** Spider-Man's (27030a) two Specials, by ability id (`identity.ts`). */
const VENOM_BLAST = "27030a.spider-man-constant";
const SPIDER_CAMOUFLAGE = "27030a.spider-man-constant-2";

/**
 * Spider-Man / Miles Morales's own signature events (`sm` 27031–27034, MC27 p. 20, docs/phase7-wave5.md) and the
 * precon's basic/aspect events scripted alongside his kit for this pass: two S.H.I.E.L.D.-tactic `justice` events
 * (27042–27043) and his side of the Team-Up with Gwen Stacy (27050, the same printed effect as Ghost-Spider's own
 * `27019` in `ghost-spider/events-b.ts`, a separate card id since it's a second physical copy in the box).
 *
 * **Arachnobatics (27031)**, **Swing In (27033)** and **Web-Shot (27034)** are all `(attack)`/`(thwart)`-labeled —
 * RRG 1.8 p. 710/3518, the same reading Ghost-Spider's Ghost Kick/Phantom Flip use (`events-a.ts`'s own docblock):
 * even though the printed sentence says "deal N damage"/"remove N threat" rather than literally "attack"/"thwart",
 * the label makes resolving it count as the real attack/thwart mechanic, so these use `attack`/`thwartAScheme`
 * rather than a bare `dealDamage`/`removeThreat`.
 *
 * **Arachnobatics**: "Deal 2 damage to an enemy. If that enemy has a stun status card, deal 3 additional damage to
 * it. If that enemy has a confuse status card, deal 3 additional damage to it." is one attack for a computed total
 * (`sum` of the base 2 and each `ifElse` bonus), the same "one attack, not several separate damage effects" shape
 * Repulsor Blast's own scaled amount uses (`core/heroes/iron-man.ts`) — both bonuses can apply at once (stunned
 * *and* confused reads 8, not a choice of one).
 *
 * **Swing In**: "Remove 4 threat from a scheme. If you paid for this card using a [mental] resource, resolve
 * Spider-Man's 'Spider Camouflage' ability." — `thwartAScheme(4)` then `ifThen(paidWith("mental"), …)`.
 * **Web-Shot**: "Deal 4 damage to an enemy. If you paid for this card using a [energy] resource, resolve
 * Spider-Man's 'Venom Blast' ability." — `attack(4, chosen("enemy"))`, `ifThen(paidWith("energy"), …)`. Each
 * resolves only the Special its text names, by the identity's ability id (`resolveSpecialsOf`'s `abilities`,
 * docs/phase7-wave5.md §4.1 Q63): 27030a prints two, and the other must not resolve. The Special's own `self`
 * reads as the identity card itself regardless of the caller (`wave3/gmw/nebula.ts`'s Technique precedent).
 *
 * **Double Life (27032)**: "Action: Change your form. If you paid for this card using a [physical] resource, ready
 * your identity." A plain `action()` (not hero/alter-ego specific — either form may play it), the same
 * `changeForm(you)` + conditional follow-up shape She-Hulk's own "Split Personality" uses
 * (`core/heroes/she-hulk.ts`'s `01025.split-personality-action`).
 *
 * **Homeland Intervention (27042)** and **Global Logistics (27043)**: `justice` S.H.I.E.L.D.-tactic basic events,
 * their own trigger unlabeled ("Action:"), each with an `exhaustCardsCost` for the "Exhaust [S.H.I.E.L.D. cards]
 * you control" clause (`dsl/abilities.ts`'s own doc: "The engine limits candidates to cards the payer controls").
 * "Choose a scheme" reads as a plain effect after the cost is paid, the same ordering every other divided-cost
 * event in this pack already uses — nothing here depends on whether the scheme is picked before or after the
 * exhaust, since neither choice can affect the other's legality.
 *
 * - Homeland Intervention: "Exhaust up to 3 S.H.I.E.L.D. cards you control and choose a scheme → remove 2 threat
 *   from that scheme for each card exhausted this way." `exhaustCardsCost(SHIELD_CARD, { min: 0, max: 3, bind: "n"
 *   })`, then `removeThreat(scaled(varOf("n"), { times: 2 }), chosen("scheme"))`.
 * - Global Logistics: "Exhaust 1 S.H.I.E.L.D. card you control → look at the top 4 cards of a player deck or the
 *   encounter deck. Discard any number of those, and put the others on the top and/or bottom of that deck in any
 *   order." — a `chooseOne` between the two decks (the same "which deck" decision docs/phase7-wave5.md §4.1 Q13
 *   answers for a *revealed* deck elsewhere; here it's the printed text's own explicit choice, made by the player
 *   resolving the event). The encounter-deck branch is `selectCards`/`chooseCards`/`placeOnTopOrBottom` verbatim
 *   from Take the Fight to Them (`wave3/gmw/market.ts`'s `16161.take-the-fight-to-them-action`). The player-deck
 *   branch is the same shape over the chosen player's deck: `placeOnTopOrBottomOfPlayerDeck` (`reorderCards` to
 *   `"playerDeckTopOrBottom"`, docs/phase7-wave5.md §4.1 Q60) puts each kept card back on the top or the bottom of
 *   that player's deck, in the resolving player's chosen order.
 *
 * **Young Love (27050)**: identical printed text to Ghost-Spider's own `27019` (`ghost-spider/events-b.ts`'s own
 * docblock) — `alterEgoAction(heal(3, teamUpCharacters()))`, a separate ability id since it's a distinct card
 * (a second physical copy of the same Team-Up event, one in each identity's own precon).
 */
export const SPIDER_MAN_MORALES_EVENTS = defineAbilities({
  "27031.arachnobatics-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(
      sum(2, ifElse(hasStatus(chosen("enemy"), "stunned"), 3, 0), ifElse(hasStatus(chosen("enemy"), "confused"), 3, 0)),
      chosen("enemy"),
    ),
  ),

  "27032.double-life-action": action(changeForm(), ifThen(paidWith("physical"), ready(yourIdentity))),

  "27033.swing-in-action": heroAction(
    { label: "thwart" },
    ...thwartAScheme(4),
    ifThen(paidWith("mental"), resolveSpecialsOf(yourIdentity, undefined, { abilities: [SPIDER_CAMOUFLAGE] })),
  ),

  "27034.web-shot-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(4, chosen("enemy")),
    ifThen(paidWith("energy"), resolveSpecialsOf(yourIdentity, undefined, { abilities: [VENOM_BLAST] })),
  ),

  "27042.homeland-intervention-action": action(
    // `exhaustCardsCost`'s `min` can't be 0 (RRG 1.8 "Cost", p. 14: a cost can't be entirely optional) — "up to 3"
    // is a plain choose-then-exhaust effect instead, the same shape `wave4/hood/crossfire-crew.ts`'s own
    // choose-and-exhaust boost uses.
    chooseCards("exhausted", cards(each({ ...SHIELD_CARD, exhausted: false })), { min: 0, max: 3 }),
    exhaust(chosen("exhausted")),
    aScheme("scheme"),
    removeThreat(scaled(countAmong(chosen("exhausted"), {}), { times: 2 }), chosen("scheme")),
  ),

  "27043.global-logistics-action": action(
    { cost: exhaustCardsCost(SHIELD_CARD, { min: 1, max: 1 }) },
    chooseOne(
      option(
        "The encounter deck",
        selectCards("looked", encounterCards(["deck"], undefined, 4)),
        chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 4 }),
        moveCards(cards(chosen("discarded")), "discard"),
        placeOnTopOrBottom(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
      ),
      option(
        "A player deck",
        choosePlayer("owner"),
        selectCards("looked", topOfDeck(4, chosenPlayer("owner"))),
        chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 4 }),
        moveCards(cards(chosen("discarded")), "discard"),
        placeOnTopOrBottomOfPlayerDeck(cards(chosen("looked"), { excludeSlots: ["discarded"] }), chosenPlayer("owner")),
      ),
    ),
  ),

  "27050.young-love-action": alterEgoAction(heal(3, teamUpCharacters())),
});
