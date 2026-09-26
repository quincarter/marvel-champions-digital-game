import {
  addCounters,
  andThen,
  chooseOneBy,
  constant,
  countersOn,
  defeatingPlayer,
  defineAbilities,
  discard,
  draw,
  forcedInterrupt,
  gets,
  heal,
  heroAction,
  identityOf,
  on,
  option,
  placeThreat,
  playFromHandReducingCost,
  ready,
  self,
  takeDamage,
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
 * **The Poison's "Forced Interrupt: When your turn begins" (16125)** is `forcedInterrupt(on.yourTurnBegins(), …)`. A
 * turn beginning opens an interrupt window before its response window (docs/phase7-wave3.md §3.46, RRG 1.8
 * "Interrupt", p. 25), and "your" on an uncontrolled attachment on your identity is that identity's controller (RRG
 * 1.8 "Attachment", p. 8), so it answers the attached player's turn only. "Take 1 damage" is `takeDamage` on that
 * player's identity (RRG 1.8 "You, Your", p. 49).
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
  // begins, place 1 poison counter here, then take 1 damage for each poison counter here (module docblock).
  // `addCounters` always fully resolves, so `andThen` around the "then take damage" is the faithful reading (RRG
  // 1.8 "'Then'", p. 44) without changing behavior today.
  "16125.the-poison-forced-interrupt": forcedInterrupt(
    on.yourTurnBegins(),
    addCounters("poison", 1),
    andThen(takeDamage(countersOn(self, "poison"))),
  ),
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
