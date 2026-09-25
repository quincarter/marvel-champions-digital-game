import {
  attack,
  changeAdditionalForm,
  chooseTarget,
  chosen,
  constant,
  damageAnEnemy,
  defineAbilities,
  draw,
  each,
  forcedResponse,
  gets,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  inAdditionalForm,
  on,
  printedForm,
  putIntoPlay,
  query,
  removeThreatFromAScheme,
  selectCards,
  setup,
  thwart,
  turnFacedown,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
  heroResource,
  printedResourcesOf,
  exhaustThis,
} from "../../dsl/index.js";

const FACEDOWN_ENERGY_FORM = query("upgrade", { ...printedForm("energy"), facedown: true, controller: "you" });
const YOUR_ENERGY_FORMS = query("upgrade", { ...printedForm("energy"), controller: "you" });

/**
 * Spectrum / Monica Rambeau (21001a/b) and her energy-form kit (21002–21010, printed `aspect: "hero:21001a"`):
 * docs/phase7-wave4.md §1.1/§1.3 (the `form` keyword, the dash cost on Gamma/Photon/Pulsar) and §3.1 (additional
 * forms — landed 2026-09-24). Most of the kit is the exact composition `dsl/wave4-primitives.test.ts` §3.1 already
 * gives for these cards.
 *
 * **Energy Duplication (21006)** generates `printedResourcesOf` the faceup energy form (docs/phase7-wave4.md §3.38).
 *
 * **Pulsar Shield's (21009) retaliate grant is a primitive gap.** The change-to-Pulsar-and-ready half is scriptable,
 * but "she gains retaliate 1 until the end of the phase" is a one-shot lasting *keyword* grant from a triggered
 * ability, and only `modifyStatUntil`/`grantTraitUntil` exist as lasting effects (`packages/engine/src/spec.ts`) —
 * there is no `grantKeywordUntil`. Since the whole card is one ability ref, it is skipped whole rather than half-
 * scripted.
 */
export const SPECTRUM_KIT = defineAbilities({
  // Spectrum (hero, 21001a) — Energy Transformation, Forced Response: After you change to this form, choose a
  // facedown energy form upgrade → flip that card faceup to change to that energy form.
  "21001a.spectrum-constant": forcedResponse(
    on.youChangeIdentityForm(),
    chooseTarget("form", FACEDOWN_ENERGY_FORM),
    changeAdditionalForm("energy", { to: chosen("form") }),
  ),

  // Monica Rambeau (alter-ego, 21001b) — Setup: Put all 3 energy form upgrades into play, facedown. Gamma/Photon/
  // Pulsar print no `attachesTo`, so they enter the ordinary play area (`putIntoPlay`), not attached to the
  // identity — `each(query)` (used by `turnFacedown` below) only finds cards already in play, so putting the deck's
  // 3 dash-cost forms into play needs a deck-zone selection (`selectCards`/`zone`) first, bound to `chosen("forms")`.
  "21001b.setup": setup(
    // A dash-cost card can still land in the opening hand from the shuffle (nothing stops the deal), so search both
    // zones, not deck alone.
    selectCards("forms", zone(["deck", "hand"], you, { filter: query("upgrade", printedForm("energy")) })),
    putIntoPlay(chosen("forms")),
    turnFacedown(chosen("forms")),
  ),
  // Power Down, Forced Response: After you change to this form, turn all your energy form upgrades facedown.
  "21001b.monica-rambeau-constant": forcedResponse(on.youChangeIdentityForm(), turnFacedown(each(YOUR_ENERGY_FORMS))),

  // Gamma (21002) — Spectrum gets +2 ATK while this energy form is up. Hero Response: After you change to this
  // energy form, deal 1 damage to an enemy.
  "21002.gamma-constant": constant(gets("atk", 2, YOUR_IDENTITY, { while: inAdditionalForm("energy", "Gamma") })),
  "21002.gamma-response": heroResponse(on.youChangeToThisForm(), damageAnEnemy(1)),

  // Photon (21003) — +2 THW while up. Hero Response: remove 1 threat from a scheme.
  "21003.photon-constant": constant(gets("thw", 2, YOUR_IDENTITY, { while: inAdditionalForm("energy", "Photon") })),
  "21003.photon-response": heroResponse(on.youChangeToThisForm(), removeThreatFromAScheme(1)),

  // Pulsar (21004) — +2 DEF while up. Hero Response: heal 1 damage from Spectrum.
  "21004.pulsar-constant": constant(gets("def", 2, YOUR_IDENTITY, { while: inAdditionalForm("energy", "Pulsar") })),
  "21004.pulsar-response": heroResponse(on.youChangeToThisForm(), heal(1, yourIdentity)),

  // Blue Marvel (ally, 21005) — Hero Response: After Blue Marvel enters play, change energy forms. With 3 single-
  // faced energy forms (unlike Vision's one double-sided mass form card), "change energy forms" with no `to`/
  // `toName` is ambiguous to the engine (`changeAdditionalForm`'s own "the only one if double-sided" fallback
  // never applies here) and does nothing — so this, like Energy Transformation, is an explicit choice among the
  // *other* two energy forms (never the one already up, which would trigger nothing).
  "21005.blue-marvel-response": heroResponse(
    on.entersPlay("self"),
    chooseTarget("form", FACEDOWN_ENERGY_FORM),
    changeAdditionalForm("energy", { to: chosen("form") }),
  ),

  // Energy Duplication (21006) — Hero Resource: Exhaust Energy Duplication → generate the printed resource on your
  // faceup energy form upgrade (read when generated, `printedResourcesOf`, docs/phase7-wave4.md §3.38; none faceup:
  // nothing).
  "21006.energy-duplication-resource": heroResource(
    printedResourcesOf(query("upgrade", { ...printedForm("energy"), facedown: false, controller: "you" })),
    { cost: exhaustThis },
  ),

  // Gamma Blast (21007) — Hero Action (attack): Change to Gamma energy form and deal 7 damage to an enemy. If you
  // were already in Gamma energy form, this attack gains overkill. Read "already in Gamma" *before* the change
  // (docs/phase7-wave4.md §3.1's own scripting note): both branches still make the change (idempotent if already
  // there, per the same section's "already there: nothing changes and nothing triggers").
  "21007.gamma-blast-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity })),
    ifThen(
      inAdditionalForm("energy", "Gamma"),
      [changeAdditionalForm("energy", { toName: "Gamma" }), attack(7, chosen("enemy"), { overkill: true })],
      [changeAdditionalForm("energy", { toName: "Gamma" }), attack(7, chosen("enemy"))],
    ),
  ),

  // Photon Speed (21008) — Hero Action (thwart): Change to Photon energy form and remove 4 threat from a scheme. If
  // you were already in Photon energy form, ignore crisis icon for this thwart.
  "21008.photon-speed-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    ifThen(
      inAdditionalForm("energy", "Photon"),
      [changeAdditionalForm("energy", { toName: "Photon" }), thwart(4, chosen("scheme"), { ignoreCrisis: true })],
      [changeAdditionalForm("energy", { toName: "Photon" }), thwart(4, chosen("scheme"))],
    ),
  ),

  // Pulsar Shield (21009): see module docblock — KNOWN_SKIPPED.

  // Speed of Light (21010) — Hero Action: Change energy forms and draw 1 card.
  // Speed of Light (21010) — Hero Action: Change energy forms and draw 1 card. Same ambiguity as Blue Marvel above:
  // an explicit choice among the other two energy forms.
  "21010.speed-of-light-action": heroAction(
    chooseTarget("form", FACEDOWN_ENERGY_FORM),
    changeAdditionalForm("energy", { to: chosen("form") }),
    draw(1),
  ),
});
