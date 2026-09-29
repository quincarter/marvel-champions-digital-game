import { trait } from "@mc/content";
import {
  additionalThwartCost,
  constant,
  defineAbilities,
  dealDamage,
  eventAmount,
  eventPlayer,
  exhaust,
  forcedResponse,
  identityOf,
  ifThen,
  isHero,
  made,
  not,
  on,
  query,
  spendResources,
  takeDamage,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  chooseTarget,
  chosen,
  cards,
  moveCards,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

/**
 * Inherited Burden (31025), SP//dr's obligation, and her nemesis set: Giant Monster Attack (31026, side scheme),
 * M.O.R.B.I.U.S. (31027, nemesis minion), Energy Drain (31028, treachery, quantity 3). Read directly off
 * `packages/content/src/data/spdr/cards.ts` — the scans at `assets/card-art/bundles/cards/3102{5,6,7,8}.png` match
 * `text.printed`/`text.current` word for word on 31025/31026/31028; **31027 carries the RRG 1.8 pp. 67-68 errata**
 * (`errata.history` on the card record itself), and its `text.current` already reads "engaged player" / "that
 * player's hero" — the corrected wording, not the raw "engaged hero" / "that hero" `text.printed` still carries.
 * Confirmed against the card scan (still prints the pre-errata wording, as expected of a physical card) and against
 * docs/phase7-wave5.md §1.9's own errata list for this id; no `curation/spdr.ts` fix was needed since the ingested
 * `current` field was already correct.
 *
 * **Inherited Burden (31025, obligation)**: "Give to the Peni Parker player. You may flip to alter-ego form.
 * Choose: • Exhaust Peni Parker → remove Inherited Burden from the game. • Choose and discard 1 Interface upgrade
 * you control. Discard this obligation." fits Core's shared `obligation()` helper (`core/obligations.ts`) exactly —
 * the same shape `wave5/sm/spider-man-morales/obligation-nemesis.ts` 27056 uses — so this card doesn't rebuild the
 * flip-to-alter-ego/exhaust-to-remove branches by hand. The alternative option's own target ("1 Interface upgrade
 * you control") is a plain `chooseTarget` over `query("upgrade", { trait: trait("INTERFACE"), controller: "you"
 * })`; with none in play, RRG 1.8 "Choose (Option)" (p. 12) already excludes the whole option (the `16077.when-
 * revealed` "View the Cosmos" precedent, `wave3/gmw/museum.ts`), so no extra `exists(...)` guard is needed the way
 * the exhaust branch's cost check needs one.
 *
 * **Giant Monster Attack (31026, side scheme)**: "As an additional cost to thwart this scheme, you must spend a
 * [energy] resource" is `constant(additionalThwartCost({ self: true }, { resources: { energy: 1 } }))` — this
 * card's own worked example in the builder's docblock (`dsl/abilities.ts`, docs/phase7-wave5.md §3.21). A player
 * who declines (or can't pay) the additional cost has the thwart cancelled outright (RRG 1.8 "Cost", p. 13); the
 * engine's own `additional-thwart-cost.test.ts` (built for this exact card) carries the plain-data version of this
 * assertion.
 *
 * **M.O.R.B.I.U.S. (31027, nemesis minion)**: "Forced Response: After the engaged player generates any number of
 * resources, deal an equal amount of damage to that player's hero." is `forcedResponse(on.resourcesGenerated({ by:
 * "engaged" }), ...)`, `dealDamage(eventAmount, identityOf(eventPlayer))` for the amount/target — the exact
 * composition `dsl/wave5-3-25.test.ts` validates for this card. **§4.1 Q24 (user decision, differs from the spec's
 * proposed default): M.O.R.B.I.U.S. deals no damage while the engaged player is in alter-ego form** — "that
 * player's hero" is read as "only while that player currently has a hero identity face up", not "the identity
 * regardless of form" (the spec's own proposed default at docs/phase7-wave5.md §4 Q24, which this project did not
 * take) — so the damage is gated on `isHero(eventPlayer)`, an extra `ifThen` the plain-data engine test (`SIPHON`
 * in `packages/engine/src/resources-generated.test.ts`) does not carry, since that test predates/generalizes past
 * this card-specific ruling. **§4.1 Q5 (built engine-side, f959030c): spending a toon counter as a resource does
 * not raise a `resourcesGenerated` event at all** (`countersAsResource`'s own `spentAsIfResource: true` marks a
 * resource ability's use as *spent*, not *generated* — `packages/engine/src/resources-generated.test.ts`'s "a
 * payment made only with counters raises no resourcesGenerated event" is the direct engine-level proof) — so this
 * ability's own `on.resourcesGenerated` trigger already ignores a spent toon counter for free, with no card-level
 * code needed to special-case it (Spider-Ham's own toon-counter resource ability isn't part of this pack; noted
 * here only because the errata text's own "any number of resources" would otherwise read as if it covered that
 * case too).
 *
 * **Energy Drain (31028, treachery, quantity 3)**: "When Revealed (Alter-Ego): Choose to either spend
 * [energy][energy] resources or exhaust your identity. When Revealed (Hero): Choose to either spend
 * [energy][energy] or take 3 damage." is the `spendResources(resources, bind)` + `ifThen(not(made(bind)), …)`
 * "either spend X or Y" precedent (`wave3/gmw/museum.ts` 16078 Stay Awhile, cited by the builder's own docblock).
 */

const INTERFACE_UPGRADE_YOU_CONTROL = query("upgrade", { trait: trait("INTERFACE"), controller: "you" });

export const SPDR_OBLIGATION_NEMESIS = defineAbilities({
  // Inherited Burden — Give to the Peni Parker player. You may flip to alter-ego form. Choose:
  // • Exhaust Peni Parker → remove Inherited Burden from the game.
  // • Choose and discard 1 Interface upgrade you control. Discard this obligation.
  "31025.obligation": obligation("Peni Parker", {
    label: "Choose and discard 1 Interface upgrade you control",
    effects: [chooseTarget("upgrade", INTERFACE_UPGRADE_YOU_CONTROL), moveCards(cards(chosen("upgrade")), "discard")],
  }),

  // Giant Monster Attack — As an additional cost to thwart this scheme, you must spend a [energy] resource.
  "31026.giant-monster-attack-constant": constant(additionalThwartCost({ self: true }, { resources: { energy: 1 } })),

  // M.O.R.B.I.U.S. — Forced Response: After the engaged player generates any number of resources, deal an equal
  // amount of damage to that player's hero (errata, RRG 1.8 pp. 67-68; §4.1 Q24: none while that player is in
  // alter-ego form).
  "31027.morbius-forced-response": forcedResponse(
    on.resourcesGenerated({ by: "engaged" }),
    ifThen(isHero(eventPlayer), dealDamage(eventAmount, identityOf(eventPlayer))),
  ),

  // Energy Drain — When Revealed (Alter-Ego): Choose to either spend [energy][energy] resources or exhaust your
  // identity.
  "31028.when-revealed-alter-ego": whenRevealedAlterEgo(
    spendResources({ energy: 2 }, "paid"),
    ifThen(not(made("paid")), exhaust(yourIdentity)),
  ),
  // Energy Drain — When Revealed (Hero): Choose to either spend [energy][energy] or take 3 damage.
  "31028.when-revealed-hero": whenRevealedHero(
    spendResources({ energy: 2 }, "paid"),
    ifThen(not(made("paid")), takeDamage(3)),
  ),
});
