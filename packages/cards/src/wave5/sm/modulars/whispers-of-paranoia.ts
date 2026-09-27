import { trait } from "@mc/content";
import {
  allOf,
  alterEgoAction,
  boost,
  constant,
  controllerOf,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardCardsCost,
  eitherCost,
  eventTarget,
  host,
  ifThen,
  printedCostOf,
  query,
  refMatches,
  rule,
  self,
  you,
} from "../../../dsl/index.js";

const PERSONA = trait("PERSONA");

/**
 * Whispers of Paranoia (`sm` 27170–27173, Mysterio's own recommended modular set, MC27 p. 20): Delusion of
 * Collusion, Manipulated Mind, Old Grudge, Analysis Paralysis.
 *
 * Only Delusion of Collusion (27170) is scripted here. The other three each need something that doesn't exist yet
 * one level below the ability DSL — reported rather than hacked around:
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
 *   [star] Boost: Deal 1 damage to each character you control." Unlike Manipulated Mind, there is no `AttachmentHost`
 *   kind this maps onto at all — "your nemesis minion" is an identity-relative search (`TargetQuery.nemesisMinionOf`,
 *   already landed and used by `toafk/kang.ts`'s own When Revealed effects), not a superlative or a plain category,
 *   and the schema has no such kind. Worse: `resolve/reveal.ts`'s `resolveAttachmentTarget` runs unconditionally for
 *   every `type: "attachment"` card *before* its own When Revealed ability gets to resolve (confirmed by test: with
 *   the current data's `attachesTo: { kind: "minion" }`, revealing Old Grudge with only Shifting Apparition in play
 *   auto-attaches it there regardless of what its own When Revealed script says, since `{ kind: "minion" }` matches
 *   the first minion in play unconditionally) — so even a new `nemesisMinion` `AttachmentHost` kind wouldn't be
 *   enough on its own; the reveal step also needs a way for a card's own ability to supply/override the generic
 *   host choice before `resolveAttachmentTarget` commits to one. Both a schema and an engine question, for
 *   `game-rules-architect` and `card-data-pipeline` together, not something an ability script can route around.
 *
 * - **Analysis Paralysis (27173)**: "When Revealed: Search the encounter deck, discard pile, and set-aside area
 *   for your nemesis side scheme, then reveal it. Place X additional threat here, where X is equal to the amount
 *   of threat on that side scheme." `TargetQuery` has `nemesisMinionOf` (identity-relative, minion-only) but no
 *   sibling for a side scheme — `select.ts`'s own `nemesisMinionOf` case reads `MinionCard.nemesisMinion`/`sole
 *   MinionOfSet`, neither of which exists for `SideSchemeCard`. A `nemesisSideSchemeOf` field (a nemesis set has at
 *   most one side scheme, so it needs no parenthetical-designation half of `nemesisMinionOf`'s own check) is the
 *   missing engine primitive — a `game-rules-architect` addition to `spec.ts`/`select.ts`, parallel to
 *   `nemesisMinionOf`.
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
});
