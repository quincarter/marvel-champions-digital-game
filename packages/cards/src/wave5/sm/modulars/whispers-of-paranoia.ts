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
  eventTarget,
  gets,
  host,
  ifThen,
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
  threatOn,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const PERSONA = trait("PERSONA");

/**
 * Whispers of Paranoia (`sm` 27170–27173, Mysterio's own recommended modular set, MC27 p. 20): Delusion of
 * Collusion, Manipulated Mind, Old Grudge, Analysis Paralysis.
 *
 * Delusion of Collusion (27170), Old Grudge (27172) and Analysis Paralysis (27173) are scripted here. Manipulated
 * Mind needs something that doesn't exist yet one level below the ability DSL — reported rather than hacked around:
 *
 * - **Manipulated Mind (27171)**: "Treat attached ally as a minion with a blank text box (except for traits).
 *   Attached minion's SCH is equal to its printed THW and it does not take consequential damage. When Revealed:
 *   Attach to the ally you control with the lowest cost. Attached ally engages its controller. Otherwise, this
 *   card gains surge." The engine's `treatAsAlly` (`spec.ts` `EffectSpec`, Karma `rogue` 38011) is the mirror of
 *   this — a *minion* treated as an *ally*, with blank text, a THW/SCH stat swap and *extra* consequential damage
 *   after acting — but there is no `treatAsMinion` going the other way (an *ally* treated as a *minion*, with a
 *   SCH/THW swap and consequential damage *cancelled* rather than added to). A `game-rules-architect` primitive,
 *   not an ability-DSL gap. Separately, its own attach target ("the ally you control with the lowest cost") *can*
 *   already be expressed as data (`AttachmentHost` `{ kind: "superlative", among: "ally", order: "lowest", measure:
 *   "printedCost" }`, the same shape `Beguiled`/'Pool-ized' already use, `attachment-host.ts` `HostMeasure`
 *   `printedCost`) — the card's own current data (`packages/content/src/data/sm/cards.ts` 27171) carries a plain
 *   `{ kind: "ally" }` instead, which auto-attaches to an *arbitrary* ally (or opens a first-player choice among
 *   all of them) rather than specifically the cheapest one; a `card-data-pipeline` curation fix, reported alongside
 *   the primitive since the card can't work correctly until both land.
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
