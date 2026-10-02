import { trait } from "@mc/content";
import {
  action,
  anyOf,
  attackInProgress,
  changeAdditionalForm,
  constant,
  defineAbilities,
  eventSource,
  eventTarget,
  exhaustThis,
  forcedResponse,
  heroResource,
  ifThen,
  ignores,
  inAdditionalForm,
  putIntoPlayFromSetAside,
  query,
  refMatches,
  response,
  rule,
  setup,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";
import type { EventPattern } from "@mc/engine";

const ATTACK = trait("ATTACK");
const DEFENSE = trait("DEFENSE");

/**
 * "After you attack or defend": an `attack` by, or a `defended` against, your identity. An ally's attack or defense
 * is heard by the same two events, so the effect checks that your identity is the attacker or the defender.
 */
const ATTACKS_OR_DEFENDS: EventPattern = { on: ["attack", "defended"], playerIs: "controller" };
const IDENTITY_TOOK_PART = anyOf(refMatches(eventSource, YOUR_IDENTITY), refMatches(eventTarget, YOUR_IDENTITY));

/**
 * Kitty Pryde / Shadowcat (32030a/b, MC32 p. 22) and her mass form upgrade Solid / Phased (32031a/b):
 * docs/phase7-wave6.md §3.22, §3.74 (Q15 = B), §3.8 (Q6).
 *
 * - **Shadowcat (hero, 32030a)** "Selective Intangibility - While you are in Phased mass form, Shadowcat ignores the
 *   guard and patrol keywords, and any crisis icons in play": `ignores(...)` while Phased (wave 4 §3.24). "Ignores"
 *   only counts when the keyword or icon would have stopped her attack or thwart (Q6, §3.8), which is the engine's
 *   `keywordIgnored` reading, not this card's.
 * - **Kitty Pryde (alter-ego, 32030b)** "Setup: Put your mass form upgrade into play, Solid side faceup": the
 *   permanent upgrade was set aside before setup step 1, so it is taken from there (the Vision precedent). "Phase
 *   Control - Action: Flip your mass form upgrade. (Limit once per round.)" is a mass form change
 *   (`changeAdditionalForm`, RRG 1.8 "Form, Change Form" p. 21), not the hero/alter-ego flip, so it neither spends nor
 *   needs that once-per-round flip. The limit stays with the identity card across its flips (ruling Jan 26, 2026 (6) #2).
 * - **Solid (32031a)** "Hero Resource: Exhaust this card -> generate a [physical] resource for an attack or defense
 *   event." "Response: After you attack or defend in Solid mass form, flip this card" (optional; the card is Solid
 *   whenever this face's ability is live).
 * - **Phased (32031b)** "While Shadowcat is defending, she cannot take damage." "Forced Response: After you attack or
 *   defend in Phased mass form, flip this card." Both flips are `changeAdditionalForm("mass")`, never a bare flip, so
 *   they count as changing form for Ready to Rumble (32051) and Perseverance (32016).
 */
export const SHADOWCAT_IDENTITY = defineAbilities({
  "32030a.shadowcat-constant": constant(
    ignores(YOUR_IDENTITY, ["guard", "patrol", "crisis"], inAdditionalForm("mass", "Phased")),
  ),

  "32030b.setup": setup(
    putIntoPlayFromSetAside("mass", query("upgrade", { name: "Solid" }), { attachTo: yourIdentity }),
  ),
  "32030b.kitty-pryde-constant": action({ limit: { count: 1, period: "round" } }, changeAdditionalForm("mass")),

  "32031a.solid-resource": heroResource(
    { physical: 1 },
    { cost: exhaustThis, generatesFor: query("event", { anyTrait: [ATTACK, DEFENSE] }) },
  ),
  "32031a.solid-response": response(ATTACKS_OR_DEFENDS, ifThen(IDENTITY_TOOK_PART, changeAdditionalForm("mass"))),

  "32031b.phased-constant": constant(
    rule({
      kind: "cannotTakeDamage",
      target: YOUR_IDENTITY,
      while: attackInProgress({ defender: YOUR_IDENTITY }),
    }),
  ),
  "32031b.phased-forced-response": forcedResponse(
    ATTACKS_OR_DEFENDS,
    ifThen(IDENTITY_TOOK_PART, changeAdditionalForm("mass")),
  ),
});
