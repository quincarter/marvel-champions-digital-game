import { trait } from "@mc/content";
import {
  allOf,
  alterEgoAction,
  anyOfCards,
  atMost,
  attachCard,
  boost,
  chosen,
  constant,
  controllerOf,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardCardsCost,
  eitherCost,
  encounterCards,
  encounterSetAside,
  each,
  engage,
  eventTarget,
  gets,
  host,
  ifThen,
  isAttached,
  placeThreat,
  printedCostOf,
  query,
  refMatches,
  revealCard,
  rule,
  selectCards,
  self,
  setAside,
  shuffleEncounterDeck,
  surge,
  threatOn,
  treatAttachedAllyAsMinion,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const PERSONA = trait("PERSONA");

/**
 * Whispers of Paranoia (`sm` 27170–27173, Mysterio's own recommended modular set, MC27 p. 20): Delusion of
 * Collusion, Manipulated Mind, Old Grudge, Analysis Paralysis.
 *
 * All four are scripted here.
 *
 * - **Manipulated Mind (27171)**: "Treat attached ally as a minion with a blank text box (except for traits). Attached
 *   minion's SCH is equal to its printed THW and it does not take consequential damage. When Revealed: Attach to the
 *   ally you control with the lowest cost. Attached ally engages its controller. Otherwise, this card gains surge."
 *   (errata RRG 1.8 p. 67 added "Attached ally engages its controller."; the scan, 27171.png, is the pre-errata print).
 *   Beguiled's own shape (`wave4/mts/enchantress.ts` 21178; docs/phase7-wave4.md §3.9) with "(except for traits)"
 *   (`keepPrintedTraits`) and no new trait. The host is data: `attachesTo` is the lowest printed cost among allies the
 *   revealing player controls (`superlative` … `controlledBy: "you"`, RRG 1.8 "Ownership and Control", p. 31), ties
 *   the first player's choice (RRG 1.8 "First Player", p. 19). While attached the ally is an engaged minion nobody
 *   controls, so its controller cannot use it; it activates in the villain phase like any engaged minion and a minion
 *   takes no consequential damage. Ruling, Dec 17, 2025 (1) #3: nothing enters or leaves play, so its damage, tokens
 *   and exhausted state stay; when Manipulated Mind leaves it is its controller's ally again (RRG 1.8 "Ownership and
 *   Control", p. 31: the control-changing ability "ceases to be in effect").
 *
 * - **Old Grudge (27172)**: "Attached minion gets +1 hit point. When Revealed: Search the encounter deck, discard
 *   pile, and set-aside area for your nemesis minion, then reveal that minion. Attach Old Grudge to it. (Shuffle.)
 *   [star] Boost: Deal 1 damage to each character you control." Scripted. It prints no "attach to" text, so its data
 *   carries no `attachesTo` (curation `impliedAttachHost: "ownWhenRevealed"`): RRG 1.8 "Reveal" (p. 38) step 2 places
 *   it in front of the revealing player, not in play, and its own When Revealed attaches it (ruling, Feb 20, 2026
 *   (4)); the engine's reveal frame then enters it into play, or discards it if it was never attached (RRG 1.8
 *   "Attach To", p. 8). The search is Analysis Paralysis's own pool (below) with `nemesisMinionOf` (RRG 1.8 "Nemesis
 *   Encounter Set", p. 30). A nemesis minion already in play is not in any searched area, so nothing is revealed,
 *   "it" names nothing and Old Grudge is discarded; the same when the minion is out of the game or its reveal was
 *   cancelled (the `attach` effect never attaches to a card out of play).
 *
 * - **Analysis Paralysis (27173)**: "When Revealed: Search the encounter deck, discard pile, and set-aside area
 *   for your nemesis side scheme, then reveal it. Place X additional threat here, where X is equal to the amount
 *   of threat on that side scheme." Scripted with `TargetQuery.nemesisSideSchemeOf`, the side-scheme sibling of
 *   `nemesisMinionOf` (RRG 1.8 "Nemesis Encounter Set", p. 30), over the same pool `toafk/kang.ts`'s 11013b searches
 *   (encounter deck and discard pile, the player's own set-aside area) plus the scenario's set-aside area. "Here" is
 *   Analysis Paralysis itself ("X **additional** threat", with "that side scheme" named separately; checked against
 *   the scan, `27173.png`). X is read after the reveal has resolved, so it is the nemesis side scheme's starting
 *   threat plus anything its own reveal added. With no nemesis side scheme found (already in play, or out of the
 *   game), nothing is revealed and X is 0: "that side scheme" names nothing, and `threatOn` of an empty slot is 0.
 */
export const WHISPERS_OF_PARANOIA = defineAbilities({
  // Delusion of Collusion (27170, attachment, `attachesTo: { kind: "yourIdentity" }` is data — no "When Revealed"
  // ability needed for the attach itself) — You cannot ready allies or Persona supports you control. Two `rule`s,
  // not one query with two categories: a single query's `trait` filter would apply to every category it lists
  // (`categories: ["ally", "support"], trait: PERSONA` would wrongly require allies to have the Persona trait
  // too — `msm/nemesis.ts` 05026's own note on the same shape). "You" is the controller of the identity this card
  // is attached to (`controllerOf(host)`), not `you` (a constant ability's own `context.controllerId`, which is
  // this encounter card's own controller — normally nobody, since it's encounter-side — not the player it affects).
  "27170.delusion-of-collusion-constant": constant(
    rule({ kind: "cannotReady", target: query("ally", { inPlayAreaOf: controllerOf(host) }) }),
    rule({ kind: "cannotReady", target: query("support", { inPlayAreaOf: controllerOf(host), trait: PERSONA }) }),
  ),
  // Delusion of Collusion — Alter-Ego Action: Discard an ally or Persona support you control → discard this card.
  // Same "or" shape as the cost: `eitherCost` between the two disjoint queries, not one query naming both
  // categories (`museum.ts` 16073b's own `eitherCost` precedent). `you` here is fine (unlike the constant above):
  // using this Alter-Ego Action is itself an action the card's own controller (the attached identity's controller)
  // takes, so the ability's `context.controllerId` is already that player.
  "27170.delusion-of-collusion-action": alterEgoAction(
    {
      cost: eitherCost(
        discardCardsCost(query("ally", { controller: "you" })),
        discardCardsCost(query("support", { controller: "you", trait: PERSONA })),
      ),
    },
    discard(self),
  ),
  // Delusion of Collusion — [star] Boost: If an ally is defeated by this attack, take indirect damage equal to
  // that ally's printed cost. Deferred to the end of the attack: a Boost ability's own effects resolve before the
  // attack's damage step, so whether the defender was defeated isn't known yet when the Boost text would otherwise
  // run (The Mad Titan, `mts` 21123's own `atEndOfAttack`/`currentAttack` precedent for exactly this "defeated by
  // this attack" wording). An enemy attack's defender is either the attacked identity or their declared ally, so
  // `refMatches(eventTarget, query("ally"))` distinguishes "the defeated character was an ally" from "was the
  // identity itself" (which would already have ended the game) — `{ anywhere: true }` because by the time this
  // deferred effect runs, a defeated ally has already left play (`27084.mysterio-constant`'s own `anywhere: true`
  // note on the same "reads by default from `cardsInPlay`" trap). `you` inside a Boost ability's own effects is the
  // attacked player (`resolve/enemy-activation.ts stepBoostCard`'s `frame.attackedPlayerId`), matching this card's
  // unstated-subject "take indirect damage" (confirmed against the card's own scan, `27170.png`).
  "27170.boost": boost({
    kind: "atEndOfAttack",
    effects: [
      ifThen(
        allOf(
          { kind: "currentAttack", key: "defeated", atLeast: 1 },
          refMatches(eventTarget, query("ally"), { anywhere: true }),
        ),
        dealIndirectDamage(you, printedCostOf(eventTarget)),
      ),
    ],
  }),

  // Manipulated Mind (27171, attachment; module docblock) — Treat attached ally as a minion with a blank text box
  // (except for traits). Attached minion's SCH is equal to its printed THW and it does not take consequential damage.
  "27171.manipulated-mind-constant": constant(treatAttachedAllyAsMinion([], { keepPrintedTraits: true })),
  // Manipulated Mind — When Revealed: Attach to the ally you control with the lowest cost (data `attachesTo`).
  // Attached ally engages its controller. Otherwise, this card gains surge.
  "27171.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  // Old Grudge (27172, attachment, no "attach to" text — module docblock). Attached minion gets +1 hit point.
  "27172.old-grudge-constant": constant(gets("hp", 1, query("minion", { hostOfSelf: true }))),
  // Old Grudge — When Revealed: Search the encounter deck, discard pile, and set-aside area for your nemesis minion,
  // then reveal that minion. Attach Old Grudge to it. (Shuffle.) The deck is shuffled when the search completes,
  // before the reveal (RRG 1.8 "Search", p. 39), as for Analysis Paralysis below.
  "27172.when-revealed": whenRevealed(
    selectCards(
      "nemesisMinion",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], query("minion", { nemesisMinionOf: you })),
          setAside(you, query("minion", { nemesisMinionOf: you })),
          encounterSetAside(query("minion", { nemesisMinionOf: you })),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    revealCard(chosen("nemesisMinion")),
    attachCard(self, chosen("nemesisMinion")),
  ),
  // Old Grudge — [star] Boost: Deal 1 damage to each character you control (Starshark's shape, `gmw/museum.ts`
  // 16137): `you` in a Boost ability is the attacked player.
  "27172.boost": boost(dealDamage(1, each(query("character", { controller: "you" })))),

  // Analysis Paralysis (27173, side scheme; starting threat 1, amplify, 3 boost icons are data) — When Revealed:
  // Search the encounter deck, discard pile, and set-aside area for your nemesis side scheme, then reveal it. Place X
  // additional threat here, where X is equal to the amount of threat on that side scheme. The searched deck is
  // shuffled before the reveal (RRG 1.8 "Search", p. 39).
  "27173.when-revealed": whenRevealed(
    selectCards(
      "nemesisScheme",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], { nemesisSideSchemeOf: you }),
          setAside(you, { nemesisSideSchemeOf: you }),
          encounterSetAside({ nemesisSideSchemeOf: you }),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    revealCard(chosen("nemesisScheme")),
    placeThreat(threatOn(chosen("nemesisScheme")), self),
  ),
});
