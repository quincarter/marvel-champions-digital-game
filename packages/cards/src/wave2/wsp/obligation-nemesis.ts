import {
  cards,
  chooseOneBy,
  constant,
  defeatingPlayer,
  defineAbilities,
  enemyAttack,
  forcedInterrupt,
  gets,
  ifThen,
  instead,
  made,
  moveCards,
  named,
  not,
  option,
  query,
  self,
  spendResources,
  takeDamage,
  when,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  zone,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";
import { cardName } from "../names.js";

/**
 * Red Dreams (13026), Wasp's obligation, and her nemesis set: Mother's Orders (13027), Beetle (13028), Beetle
 * Armor MK IV (13029), Beetle Mania (13030).
 */
export const WASP_OBLIGATION_NEMESIS = defineAbilities({
  // Red Dreams — Give to the Nadia Van Dyne player. You may flip to alter-ego form. Choose:
  // • Exhaust Nadia Van Dyne → remove Red Dreams from the game.
  // • Discard each card with a printed [mental] resource from your hand and take 1 damage. Discard this
  //   obligation. Reuses Core's `obligation()` helper (`../../core/obligations.js`) — the standard shape every
  //   wave 1 obligation follows too (docs/phase7-wave1.md §2.1), no bolded extra restriction the way Ant-Man's own
  //   obligation (Care for Cassie, `ant/obligation-nemesis.ts`) has.
  "13026.obligation": obligation("Nadia Van Dyne", {
    label: "Discard each card with a printed [mental] resource from your hand and take 1 damage.",
    effects: [moveCards(zone("hand", you, { filter: { printedResource: "mental" } }), "discard"), takeDamage(1)],
  }),

  // Mother's Orders — As an additional cost for each hero to make a basic attack, that hero must spend 1 of any
  // resource. The exact card docs/phase7-wave2.md §3.8 cites as already landed for this shape.
  "13027.mothers-orders-constant": constant({ basicPowerCosts: [{ power: "attack", cost: { resources: 1 } }] }),

  // Beetle (nemesis minion) — Guard (data). Forced Interrupt: When Beetle is defeated, the defeating player
  // chooses to either spend a [physical] resource or shuffle Beetle into the encounter deck (errata, RRG 1.8
  // p. 66: "the defeating player chooses", not "choose"). The first option carries no `instead`, so the normal
  // defeat (discard) still happens after paying; the second replaces it, the same shape Clea's own "shuffle
  // into the deck instead of being defeated" (`drs/pack-cards.ts`) uses for `instead`.
  "13028.beetle-forced-interrupt": forcedInterrupt(
    when.defeated("self"),
    chooseOneBy(
      defeatingPlayer,
      option("Spend a physical resource", spendResources({ physical: 1 }, "paid", defeatingPlayer)),
      option("Shuffle Beetle into the encounter deck", instead(moveCards(cards(self), "encounterDeckShuffle"))),
    ),
  ),

  // Beetle Armor MK IV — Attach to Beetle, if able. Otherwise, attach to the villain (data, `AttachmentHost.
  // ifAble`). Attached character gets +4 hit points.
  "13029.beetle-armor-mk-iv-constant": constant(gets("hp", 4, query("enemy", { hostOfSelf: true }))),

  // Beetle Mania — When Revealed (Alter-Ego): this card gains surge. When Revealed (Hero): Beetle attacks you with
  // +1 ATK. If no attack was made this way, this card gains surge (the same "attack, or surge if it couldn't be
  // made" shape Mad Genius, `wave1/gob/risky-business.ts`, uses).
  "13030.when-revealed-alter-ego": whenRevealedAlterEgo({ kind: "gainSurge" }),
  "13030.when-revealed-hero": whenRevealedHero(
    enemyAttack(named(cardName("13028")), { against: you, atkBonus: 1, bind: "beetle" }),
    ifThen(not(made("beetle")), { kind: "gainSurge" }),
  ),
});
