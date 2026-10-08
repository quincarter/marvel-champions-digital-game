import type { AbilityRegistry } from "@mc/engine";
import {
  adjustBoostCount,
  after,
  alterEgoResponse,
  boost,
  cannotAttach,
  chosen,
  constant,
  coveredByEngineRule,
  defeatingPlayer,
  defineAbilities,
  dealIndirectDamage,
  discard,
  forcedInterrupt,
  forcedResponse,
  ifThen,
  inPlay,
  modifyAttack,
  moveCards,
  on,
  query,
  rule,
  self,
  surge,
  takeDamage,
  topOfDeck,
  totalPrintedResources,
  when,
  whenDefeated,
  whenRevealed,
  YOUR_IDENTITY,
  you,
} from "../../../dsl/index.js";

/** "[N] resource icons on the cards discarded" into `slot`: every printed icon counts once, a wild icon as one. */
const ICONS_DISCARDED = (slot: string) => totalPrintedResources(chosen(slot));

/**
 * "After you make a basic recovery": the recovery has resolved, so `basicPowerUsed` narrowed to the recover power (the
 * `basicRecovery` pattern is the "when", docs/phase7-wave6.md section 3.40, Q20).
 */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;

/**
 * Iceman's obligation and nemesis set (46024-46028), docs/phase7-wave8.md section 7.2, 3.61, 3.65, 3.70.
 *
 * Cards (5):
 * - 46024 Hot-Headed (obligation)
 * - 46025 Pyro (minion)
 * - 46026 Playing with Fire (side_scheme)
 * - 46027 Pyro's Flamethrower (attachment)
 * - 46028 Burn! (treachery)
 *
 * **Hot-Headed (46024)**: "Give to the Bobby Drake player" is engine data (`obligationCardId`). The Alter-Ego
 * Response is registered: after a basic recovery the Bobby Drake player may discard it (optional, an alter-ego
 * response, so refused in hero form). Its Forced Response, "after you attach a Frostbite upgrade to an enemy, take 1
 * damage", is NOT registered: the engine announces no event when a card is attached (the `attach` effect moves the card
 * and says nothing; no trigger event kind names an attach, and `cardEntersPlay` is not raised for an upgrade attached
 * from the set-aside area), so no pattern can hear "a Frostbite was attached", whether by "Freeze!", Ice Blast, Frozen
 * Solid or Ice Wall. Section 3.61 lists Hot-Headed under "exists (verify)" and calls the log event `cardAttached`;
 * neither the log event nor the trigger exists. See `skipped` and `ICEMAN_OBLIGATION_NEMESIS_DRAFTS`.
 *
 * **Pyro (46025)**: Quickstrike is data. His attacks deal indirect damage (Starshark's constant): the attacked player
 * divides his ATK, after Frostbite and boost icons, among the characters they control. Nothing in the card reads or
 * moves a Frostbite or an ICE card.
 *
 * **Playing with Fire (46026)**: 3 threat regardless of the number of players, an acceleration icon, 3 boost icons (all
 * data). When Defeated: the player who defeated it discards the top 3 cards of their deck and takes 1 indirect damage per
 * resource icon on them (a wild icon is one icon; a short deck discards what it has).
 *
 * **Pyro's Flamethrower (46027)**: "Attach to Pyro" is data (`attachesTo`); with no Pyro in play it gains surge. The
 * Forced Interrupt when its host attacks the player: that player discards the top card of their deck and the attack gets
 * +1 ATK per resource icon on it (an empty deck discards nothing and adds 0).
 *
 * **Burn! (46028)**: When Revealed: the revealing player discards the top 2 cards of their deck (3 with a card titled
 * Pyro in play) and takes 1 indirect damage per resource icon on them. Boost: the player the activation is against
 * discards the top card of their deck and the card gets +1 boost icon per icon on it, for this count.
 */
export const ICEMAN_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "46024.obligation": coveredByEngineRule(),
  "46024.hot-headed-response": alterEgoResponse(YOU_RECOVER, discard(self)),

  "46025.pyro-constant": constant(rule({ kind: "attacksDealIndirectDamage", attacker: { self: true } })),

  "46026.when-defeated": whenDefeated(
    moveCards(topOfDeck(3, defeatingPlayer), "discard", "burned"),
    dealIndirectDamage(defeatingPlayer, ICONS_DISCARDED("burned")),
  ),

  "46027.pyros-flamethrower-constant": cannotAttach(surge()),
  "46027.pyros-flamethrower-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("host", { againstYou: true }),
    moveCards(topOfDeck(1, you), "discard", "flamed"),
    modifyAttack({ atkBonus: ICONS_DISCARDED("flamed") }),
  ),

  "46028.when-revealed": whenRevealed(
    ifThen(
      inPlay("Pyro"),
      moveCards(topOfDeck(3, you), "discard", "burned"),
      moveCards(topOfDeck(2, you), "discard", "burned"),
    ),
    dealIndirectDamage(you, ICONS_DISCARDED("burned")),
  ),
  "46028.boost": boost(moveCards(topOfDeck(1, you), "discard", "burn"), adjustBoostCount(ICONS_DISCARDED("burn"))),
});

/**
 * Hot-Headed's Forced Response written as nearly as the DSL allows, NOT registered. It listens for a Frostbite upgrade
 * entering play, the only pattern that names a card being attached to anything, and it is never heard: attaching a card
 * announces nothing (see the header). When the engine announces an attach, replace the pattern with it, move the entry
 * into the registry and delete it from `skipped`.
 */
export const ICEMAN_OBLIGATION_NEMESIS_DRAFTS: AbilityRegistry = defineAbilities({
  "46024.hot-headed-forced-response": forcedResponse(
    after.entersPlay(query("upgrade", { name: "Frostbite" })),
    takeDamage(1),
  ),
});

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const ICEMAN_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "46024.hot-headed-forced-response":
    "section 3.61 (exists, verify) fails: no trigger event is announced when a card is attached (no cardAttached event kind; cardEntersPlay is not raised for an upgrade attached from the set-aside area), so 'after you attach a Frostbite upgrade to an enemy' cannot be heard",
};
