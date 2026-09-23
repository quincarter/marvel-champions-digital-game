import {
  chooseOneBy,
  constant,
  defeatingPlayer,
  defineAbilities,
  discard,
  draw,
  gets,
  heal,
  heroAction,
  identityOf,
  option,
  placeThreat,
  playFromHandReducingCost,
  ready,
  self,
  takeDamageCost,
  theMainScheme,
  whenDefeated,
  spend,
} from "../../dsl/index.js";

/**
 * The Galactic Artifacts modular set (16122–16130, one of the eight modular sets RRG 1.8 FAQ p. 61 names; required
 * by Infiltrate the Museum and Escape the Museum, MC16 p. 4's own "Contents" text for each). Five attachments
 * (16122–16126) and four identical-shell side schemes (16127–16130, each "Hinder 2[per_hero]. Victory 0. When
 * Defeated: the defeating player may …" — Hinder/Victory are data-driven keywords, §1.3/§1.6, no ability ref).
 *
 * **"Attach to the enemy with the lowest/highest ATK/SCH" (16122, 16124, 16126) is data, not an ability ref** —
 * `AttachmentCard.attachesTo: { kind: "superlative", among: "enemy", order, measure }` (`packages/content/src/
 * schema/cards/attachment-host.ts`), already emitted (`packages/content/src/data/gmw/cards.ts`). Same for "Attach
 * to your identity" (16123, 16125: `attachesTo: { kind: "yourIdentity" }`). Only each card's own printed Hero
 * Action (and Obedience Potion's stat penalty, The Poison's Forced Interrupt) needs scripting here.
 *
 * **"Any player can do this" (Obedience Potion 16123, The Poison 16125) needed no new primitive.** An attachment
 * entering play (`resolve/reveal.ts`'s `case "attachment"`) never sets `controllerId`, so it stays `null` — the
 * scenario controls it (RRG 1.8 "Ownership and Control", p. 31). `actionAbilities` (`packages/engine/src/
 * legal.ts`) offers a card's own "action" trigger to every player when `controllerOf` is `null`
 * (`controller !== null && controller !== playerId` only excludes a player when the card *has* a controller), so
 * a Hero Action on an unowned attachment is already usable by any hero-form player. Cloak of Hercules/The
 * Beyonder's Blazer/Vandarian Power Stone (16122/16124/16126, attached to an enemy, no such clause printed) get
 * the same reach for the same reason — attaching to an enemy carries no single-player "your" reading to begin
 * with, so the printed clause on the identity-attached pair is what *restores* the default the engine already
 * gives every unowned encounter card, not something narrower that needs suppressing elsewhere. No card in this
 * set is scripted as if it belonged to one player only.
 *
 * **Genuine primitive gap (`KNOWN_SKIPPED`): `16125.the-poison-forced-interrupt`** — "Forced Interrupt: When your
 * turn begins, place 1 poison counter here, then take 1 damage for each poison counter here." `TriggerEvent
 * turnStarted` is one of `isAnnouncement`'s events (`packages/engine/src/trigger-events.ts`): its stack frame is
 * built straight into the `"responses"` stage (`eventFrame`, `packages/engine/src/resolve/frames.ts`), so it never
 * opens an interrupt window at all — confirmed by driving a real game to a turn start with the ability registered:
 * it never fires, not even to place the counter. The established precedent for "when your turn begins" (Quinjet,
 * `cap` 03019, "Response: After your turn begins") is printed and scripted as a response, which the engine already
 * supports (`on.yourTurnBegins()` composes fine there). The Poison's own printed wording is "Forced Interrupt",
 * not "Forced Response" — scripting it as `forcedResponse` would silently reclassify its timing (interrupts
 * resolve before the triggering condition; responses after, RRG 1.8 "Interrupt"/"Response", p. 25/38) rather than
 * express what is printed, so it is left unscripted rather than approximated. Nothing else in this pool needs an
 * interrupt window on `turnStarted` today, so no fix is proposed here beyond the observation that `isAnnouncement`
 * would need to stop listing it (and `eventFrame` would need an interrupt stage for it) for this exact card to be
 * scriptable as printed. `16125.the-poison-constant` doesn't exist (the printed text has no separate constant
 * ability); its Hero Action, `16125.the-poison-action`, is unaffected and is scripted below.
 */
export const GALACTIC_ARTIFACTS = defineAbilities({
  // Cloak of Hercules (16122) — Attach to the enemy with the lowest ATK (data). Hero Action: Spend [P][P][P] → discard.
  "16122.cloak-of-hercules-action": heroAction({ cost: spend({ physical: 3 }) }, discard(self)),

  // Obedience Potion (16123) — Attach to your identity (data). Attached character gets -1 THW/-1 ATK/-1 DEF.
  // Hero Action: Take 1 damage and spend [M][M] → discard. Any player can do this (see module docblock).
  "16123.obedience-potion-constant": constant(
    gets("thw", -1, { hostOfSelf: true }),
    gets("atk", -1, { hostOfSelf: true }),
    gets("def", -1, { hostOfSelf: true }),
  ),
  "16123.obedience-potion-action": heroAction({ cost: [takeDamageCost(1), spend({ mental: 2 })] }, discard(self)),

  // The Beyonder's Blazer (16124) — Attach to the enemy with the highest SCH (data). Hero Action: Place 2 threat
  // on the main scheme and spend 2 resources → discard.
  "16124.the-beyonders-blazer-action": heroAction({ cost: spend(2) }, placeThreat(2, theMainScheme), discard(self)),

  // The Poison (16125, errata RRG 1.8 p. 66) — Attach to your identity (data). Forced Interrupt: When your turn
  // begins, place 1 poison counter here, then take 1 damage for each poison counter here — SKIPPED, module
  // docblock (`16125.the-poison-forced-interrupt`, genuine primitive gap: `turnStarted` has no interrupt window).
  // Hero Action: Spend 3 resources of different types → discard. Any player can do this (see module docblock).
  // "3 resources of different types" is one of each typed resource — the same total as any other 3-resource cost,
  // just unable to be paid from a single type (RRG 1.8 "Resource Type", p. 37).
  "16125.the-poison-action": heroAction({ cost: spend({ physical: 1, mental: 1, energy: 1 }) }, discard(self)),

  // Vandarian Power Stone (16126) — Attach to the enemy with the lowest SCH (data). Hero Action: Spend [E][E][E] → discard.
  "16126.vandarian-power-stone-action": heroAction({ cost: spend({ energy: 3 }) }, discard(self)),

  // The four side schemes (16127–16130): Hinder 2[per_hero]. Victory 0. (data, §1.3/§1.6). Each When Defeated is
  // an optional effect for the defeating player — the established "you may" shape (`gmw/nebula.ts`'s Nebula III,
  // `chooseOne(option("do the thing", ...), option("Do not"))`), chosen by `defeatingPlayer`.
  "16127.when-defeated": whenDefeated(
    chooseOneBy(defeatingPlayer, option("Ready your identity", ready(identityOf(defeatingPlayer))), option("Do not")),
  ),
  "16128.when-defeated": whenDefeated(
    chooseOneBy(
      defeatingPlayer,
      option("Heal 4 damage from your identity", heal(4, identityOf(defeatingPlayer))),
      option("Do not"),
    ),
  ),
  "16129.when-defeated": whenDefeated(
    chooseOneBy(defeatingPlayer, option("Draw 2 cards", draw(2, defeatingPlayer)), option("Do not")),
  ),
  // "Play a card from their hand, reducing its resources cost by 3" is `playFromHandReducingCost`'s own optional
  // form — declining, or having nothing playable even with the reduction, both resolve to nothing happening.
  "16130.when-defeated": whenDefeated(playFromHandReducingCost(3, defeatingPlayer, { optional: true })),
});
