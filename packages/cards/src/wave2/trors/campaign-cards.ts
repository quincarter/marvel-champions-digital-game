import type { EventPattern } from "@mc/engine";
import {
  after,
  alterEgoAction,
  cards,
  chooseCards,
  chosen,
  constant,
  coveredByEngineRule,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  draw,
  each,
  exhaustThis,
  exhaustYourHero,
  forcedResponse,
  gets,
  giveTough,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  isHero,
  moveCards,
  on,
  putIntoPlay,
  query,
  ready,
  removeFromCampaign,
  response,
  self,
  spend,
  takeDamageCost,
  theVillain,
  topOfDeck,
  you,
  yourIdentity,
  YOUR_HERO,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { discardThisObligation } from "../../core/obligations.js";

/**
 * The Rise of Red Skull's Hydra Campaign encounter set (`hydra_camp`, campaign-specific — design §6.2) and the
 * campaign's Expert Campaign obligations (`expcamp`): the 30 refs docs/campaign-mode-design.md §6.2 and §11 step 8
 * park in `wave2/coverage.test.ts`'s `KNOWN_SKIPPED.trors` (04155-04166). Card text: `packages/content/src/data/
 * trors/cards.ts`. The Basic/Improved Condition upgrades' Basic-to-Improved *flip* is a between-games campaign log
 * write (`setGrantFace`, `../../campaigns/trors.ts`), never an in-game effect — RRG p. 29 / MC10 p. 12's Q&A route
 * that entirely through the campaign log, so nothing here scripts a flip.
 *
 * **Martial Law (04165) and Anti-Hero Propaganda (04166), now split and scripted.** Each prints a persistent
 * constant penalty *and* an independent Alter-Ego Action under a single printed ability, which cannot work as one
 * ref: an `AbilityDefinition` carries exactly one `AbilityTriggerSpec` (`packages/engine/src/abilities.ts`).
 * `card-data-pipeline` generalized the obligation parser (`packages/content/scripts/marvelcdb/parse-text.ts`'s
 * `options.obligation` branch) to recognize this exact shape — a non-header preamble sentence followed by exactly
 * one formal trigger header — and split it into `<name>-constant` / `<name>-action` refs, the same naming
 * `packages/content/src/data/toafk/cards.ts` already used for 11020/11049 (docs/phase7-wave2-data.md "Part 8"),
 * then regenerated `packages/content/src/data/trors/cards.ts` through the normal ingest path rather than
 * hand-editing it. Both cards' `-constant`/`-action` refs are scripted below, alongside 04155-04164.
 */

/** "When your turn ends" (Enraged, `wave1/hlk/kit.ts`) — no `dsl/abilities.ts` `on.*` wrapper yet. */
const turnEnding: EventPattern = { on: "turnEnding", playerIs: "controller" };

export const TRORS_CAMPAIGN_CARDS = defineAbilities({
  // --- Hydra Campaign TECH upgrades (04155-04158) — "Setup.\nHero Action: Discard this card and remove it from
  // the campaign log → <effect>." As built (design §6.2): both pre-arrow clauses are ordinary effects, not an
  // `AbilityCost` — `removeFromCampaign` has no cost-side primitive (it is a log operation, not a card
  // manipulation), so the whole clause is scripted as effects, matching `dsl/campaign.test.ts`'s own worked
  // example of this exact printed sentence. Neither clause needs cost-style legality gating (discarding your own
  // card and removing it from the log are always possible once you're using the ability).

  // Adrenal Stims (04155) — ready your hero and heal 5 damage from them.
  "04155.adrenal-stims-action": heroAction(
    discard(self),
    removeFromCampaign(cards(self)),
    ready(yourIdentity),
    heal(5, yourIdentity),
  ),

  // Tactical Scanner (04156) — draw 5 cards.
  "04156.tactical-scanner-action": heroAction(discard(self), removeFromCampaign(cards(self)), draw(5)),

  // Emergency Teleporter (04157) — search your deck and discard pile for an ally, put it into play, and give it a
  // tough status card.
  "04157.emergency-teleporter-action": heroAction(
    discard(self),
    removeFromCampaign(cards(self)),
    chooseCards("ally", zone(["deck", "discard"], you, { filter: query("ally") }), { min: 1, max: 1 }),
    putIntoPlay(chosen("ally")),
    giveTough(chosen("ally")),
  ),

  // Laser Cannon (04158) — deal 5 damage to the villain and each enemy engaged with you.
  "04158.laser-cannon-action": heroAction(
    discard(self),
    removeFromCampaign(cards(self)),
    dealDamage(5, theVillain),
    dealDamage(5, each(query("enemy", { engagedWith: "you" }))),
  ),

  // --- Basic/Improved Thwart Upgrade (04159a/b) — Permanent. Setup. You get +2 hit points. Your hero gets +1
  // THW. [Improved only:] Response: After you defeat a side scheme, exhaust this card → draw 1 card.
  "04159a.basic-thwart-upgrade-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "04159a.basic-thwart-upgrade-constant-2": constant(gets("thw", 1, YOUR_HERO)),
  "04159b.improved-thwart-upgrade-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "04159b.improved-thwart-upgrade-constant-2": constant(gets("thw", 1, YOUR_HERO)),
  "04159b.improved-thwart-upgrade-response": response(
    // "After you defeat a side scheme": `on.schemeDefeated` has no `byYou` option (unlike `on.defeated`), so the
    // player scope is added directly on the raw pattern — `defeatedByPlayerId` is the event's player subject,
    // matched by `playerIs: "controller"` (`packages/engine/src/trigger-events.ts`).
    { ...on.schemeDefeated(query("sideScheme")), playerIs: "controller" },
    { cost: exhaustThis },
    draw(1),
  ),

  // --- Basic/Improved Attack Upgrade (04160a/b) — Permanent. Setup. You get +1 hit points. Your hero gets +1
  // ATK. [Improved only:] Hero Response: After you defeat a minion, exhaust this card → draw 1 card.
  "04160a.basic-attack-upgrade-constant": constant(gets("hp", 1, YOUR_IDENTITY)),
  "04160a.basic-attack-upgrade-constant-2": constant(gets("atk", 1, YOUR_HERO)),
  "04160b.improved-attack-upgrade-constant": constant(gets("hp", 1, YOUR_IDENTITY)),
  "04160b.improved-attack-upgrade-constant-2": constant(gets("atk", 1, YOUR_HERO)),
  "04160b.improved-attack-upgrade-response": heroResponse(
    after.defeated(query("minion"), { byYou: true }),
    { cost: exhaustThis },
    draw(1),
  ),

  // --- Basic/Improved Defense Upgrade (04161a/b) — Permanent. Setup. You get +3 hit points. Your hero gets +1
  // DEF. [Improved only:] Hero Response: After you defend against an attack, exhaust this card → draw 1 card.
  "04161a.basic-defense-upgrade-constant": constant(gets("hp", 3, YOUR_IDENTITY)),
  "04161a.basic-defense-upgrade-constant-2": constant(gets("def", 1, YOUR_HERO)),
  "04161b.improved-defense-upgrade-constant": constant(gets("hp", 3, YOUR_IDENTITY)),
  "04161b.improved-defense-upgrade-constant-2": constant(gets("def", 1, YOUR_HERO)),
  "04161b.improved-defense-upgrade-response": heroResponse(after.defends(YOUR_HERO), { cost: exhaustThis }, draw(1)),

  // --- Basic/Improved Recovery Upgrade (04162a/b) — Permanent. Setup. You get +4 hit points. Your alter-ego gets
  // +1 REC. [Improved only:] Response: After you use your REC, exhaust this card → draw 1 card.
  "04162a.basic-recovery-upgrade-constant": constant(gets("hp", 4, YOUR_IDENTITY)),
  "04162a.basic-recovery-upgrade-constant-2": constant(gets("rec", 1, query("alterEgo", { controller: "you" }))),
  "04162b.improved-recovery-upgrade-constant": constant(gets("hp", 4, YOUR_IDENTITY)),
  "04162b.improved-recovery-upgrade-constant-2": constant(gets("rec", 1, query("alterEgo", { controller: "you" }))),
  "04162b.improved-recovery-upgrade-response": response(
    // "After you use your REC": `on.basicPowerUsed` has no `power` filter (docs/phase7-wave2-scripting.md's own
    // note — every card needing it so far reacted to any basic power), but `EventPattern.eventIs` is generic, so
    // narrowing to `power: "recover"` needs no new primitive, only bypassing the convenience wrapper.
    { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } },
    { cost: exhaustThis },
    draw(1),
  ),

  // --- Zola's Algorithm (04163) — Alter-Ego Action: Exhaust your alter-ego and spend a [mental] resource →
  // discard this card. `exhaustYourHero` is `{ exhaustIdentity: true }` (form-agnostic despite the name — the
  // engine has no separate "exhaust your alter-ego" cost, and none is needed: exhausting the identity is the same
  // effect regardless of which form it's read off).
  "04163.obligation": alterEgoAction({ cost: [exhaustYourHero, spend({ mental: 1 })] }, discardThisObligation),

  // --- Medical Emergency (04164) — already split into three refs by `@mc/content` (unlike 04165/04166 above):
  // a base marker plus its own two clauses.
  "04164.obligation": coveredByEngineRule(),
  // Forced Response: At the end of your turn, take 1 damage if you are in hero form. `turnEnding` is the engine's
  // one event for "your turn ends" (landed for Hulk's Enraged, `wave1/hlk/kit.ts`, interrupt-only there); the same
  // event also opens a response window, which is what "Forced Response" (rather than "Forced Interrupt") needs.
  "04164.medical-emergency-forced-response": forcedResponse(turnEnding, ifThen(isHero(), dealDamage(1, yourIdentity))),
  // Alter-Ego Action: Discard the top 5 cards of your deck and spend a [physical] resource → discard this card.
  // "Discard the top 5 cards of your deck" has no `AbilityCost` primitive (every existing card mills the deck as
  // an effect, never a cost — `moveCards(topOfDeck(n), "discard")`), so it is scripted as a leading effect; the
  // resource spend *is* a real cost (the ability must be unavailable without a physical resource to pay it), so
  // it stays `{ cost: spend(...) }` rather than folding into the same effects list as the TECH upgrades' clauses.
  "04164.medical-emergency-action": alterEgoAction(
    { cost: spend({ physical: 1 }) },
    moveCards(topOfDeck(5), "discard"),
    discardThisObligation,
  ),

  // --- Martial Law (04165) — "Your hand size is reduced by 1.\nAlter-Ego Action: Deal yourself an encounter card
  // and spend a [energy] resource → discard this card." Split by `card-data-pipeline` into a `-constant` ref (see
  // this module's own docblock) and an `-action` ref.
  "04165.martial-law-constant": constant(gets("handSize", -1, YOUR_IDENTITY)),
  // "Deal yourself an encounter card" has no `AbilityCost` primitive (every existing "deal a card" idiom —
  // `dealEncounterCard` — is an effect, not a cost), so it's scripted as a leading effect, matching Medical
  // Emergency's (04164) own mixed leading-effect/real-cost split above; the resource spend is the only real cost.
  "04165.martial-law-action": alterEgoAction(
    { cost: spend({ energy: 1 }) },
    dealEncounterCard(you),
    discardThisObligation,
  ),

  // --- Anti-Hero Propaganda (04166) — "Your hero gets -1 THW, -1 ATK, and -1 DEF.\nAlter-Ego Action: Take 2
  // damage and spend a [wild] resource → discard this card." Same two-clauses-one-ref split as 04165. The stat
  // penalty is one printed sentence naming three stats, so it's one `constant()` call with three `gets` parts —
  // one ref — not three refs (contrast the Hydra Campaign upgrades above, whose stat changes print as separate
  // lines and so each get their own ref).
  "04166.anti-hero-propaganda-constant": constant(
    gets("thw", -1, YOUR_HERO),
    gets("atk", -1, YOUR_HERO),
    gets("def", -1, YOUR_HERO),
  ),
  // "Take N damage →" *is* a real `AbilityCost` (`takeDamageCost`, `damageSelf` — Focused Rage, `01027`), unlike
  // Martial Law's "deal yourself an encounter card" above, so both pre-arrow clauses here are costs.
  "04166.anti-hero-propaganda-action": alterEgoAction(
    { cost: [takeDamageCost(2), spend({ wild: 1 })] },
    discardThisObligation,
  ),
});
