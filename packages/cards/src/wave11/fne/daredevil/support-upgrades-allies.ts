import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  ANY_NUMBER,
  allOf,
  anyOf,
  eventSource,
  hasTrait,
  refMatches,
  action,
  alterEgoAction,
  attachCard,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  damageAnEnemy,
  defineAbilities,
  dealDamage,
  draw,
  each,
  eventAmount,
  exhaustThis,
  forEachCard,
  forcedInterrupt,
  gainTraitUntil,
  gets,
  giveStatus,
  hasStatus,
  heroAction,
  ifThen,
  instead,
  isAlterEgo,
  isHero,
  moveCards,
  cards,
  ofIdentitySetTitled,
  on,
  onlySourceRemovesThreat,
  option,
  playFromSeparateDeck,
  putIntoPlay,
  query,
  ready,
  removeStatus,
  removeThreatFromAScheme,
  response,
  returnToHandCost,
  separateDeckCards,
  takeDamageCost,
  when,
  whenDefeated,
  YOUR_IDENTITY,
  yourIdentity,
  you,
  zone,
} from "../../../dsl/index.js";

const SENSE = trait("SENSE");
const ATTORNEY = trait("ATTORNEY");
const AERIAL = trait("AERIAL");
const SENSE_DECK = "Sense";
const SENSE_UPGRADE = query("upgrade", { trait: SENSE });
const DAREDEVIL = query("identity", { name: "Daredevil" });
const STATUSES = ["stunned", "confused", "tough"] as const;

/** "After you recover": the basic recovery has resolved (`basicPowerUsed` narrowed to the recover power). */
const YOU_RECOVER = { ...on.basicPowerUsed(YOUR_IDENTITY), eventIs: { power: "recover" } } as const;

/**
 * "After an Attorney character or support defeats a side scheme" (Nelson and Murdock 60015): the side scheme's defeat,
 * with the removing card an Attorney identity, ally or support (the trait reads the card's current face).
 */
const SIDE_SCHEME_DEFEATED: EventPattern = on.schemeDefeated(query("sideScheme"));
/**
 * Who defeated it: an Attorney identity, ally or support, or an extension of the identity of the responding player
 * (an event they played, an upgrade they control) while that identity's current face is an Attorney. RRG 1.8 "Event"
 * (p. 18) and "You, Your" (p. 49): a player's event is performed by their identity, so Deposition from Matt Murdock
 * counts and Living Lie Detector from Daredevil (no Attorney trait on his hero face) does not.
 */
const BY_AN_ATTORNEY = anyOf(
  refMatches(eventSource, query(["identity", "ally", "support"], { trait: ATTORNEY })),
  allOf(refMatches(eventSource, query([], { extensionOf: you })), hasTrait(yourIdentity, ATTORNEY)),
);

/**
 * Wave 11 scripting module `fne/daredevil/support-upgrades-allies` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60007 Elektra (ally)
 * - 60012 Focus the Senses (player_side_scheme)
 * - 60013 Foggy Nelson (support)
 * - 60014 Karen Page (support)
 * - 60015 Nelson and Murdock (support)
 * - 60016 Sister Maggie (support)
 * - 60017 Daredevil's Billy Club (upgrade)
 * - 60018 The Man Without Fear (upgrade)
 *
 * **60007.elektra-forced-interrupt**: "Forced Interrupt (Hero): When Elektra would take consequential damage, Daredevil
 * takes that damage instead." The parenthesized form is her controller's (spec §1.3 item 7), so `while: isHero()`. A
 * replacement ("instead", RRG 1.8 "Replacement Effect", p. 37): Elektra takes none, Daredevil is dealt the pending
 * amount (his own tough status card and damage reductions then apply).
 *
 * **60012.focus-the-senses-constant**: threat is removable only by Daredevil or Matt Murdock, every removal bound
 * (spec §3.5). **60012.when-defeated**: "You may move any number of Sense upgrades in play to other cards they can attach
 * to. Choose any number of upgrades from the Sense deck and put them into play. (Do not shuffle.)" Owner question 2 =
 * A (default, open): Focus the Senses itself is a legal host, as it stays in play until the ability resolves (January
 * 11, 2026 R1), so an upgrade moved onto it leaves with it and goes to the bottom of the Sense deck. "Other cards" is
 * read as other than the upgrade's current host. Each moved upgrade is a move, not an entry into play (no Sensory
 * Overload). The deck is in fixed order, so nothing shuffles.
 *
 * **60013.foggy-nelson-action**: removal (not a thwart: no "(thwart)" label, so only Foggy's own removal counts).
 *
 * **60014.karen-page-action**: "Daredevil card" is a card of the Daredevil identity set (RRG 1.8 "Identity-Specific
 * Card", p. 23). The draw follows whatever the shuffle did.
 *
 * **60015.nelson-and-murdock-response**: reading "Attorney character or support" with "Attorney" modifying both nouns, so a support without the trait
 * does not count (engine interpretation, authority step 5; owner question 3 in the PR: A = both, B = any support).
 *
 * **60016.sister-maggie-constant / -response**: Matt Murdock's REC; the response discards a status card of the player's
 * choosing from their identity (one option per status held).
 *
 * **60017.daredevils-billy-club-constant** (Restricted is data) and **-action**: returning this card is the cost.
 *
 * **60018.the-man-without-fear-action**: exhaust and 1 damage to Daredevil as the cost (§3.2).
 */
export const FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "60007.elektra-forced-interrupt": forcedInterrupt(
    when.damage("self", { consequential: true }),
    { while: isHero() },
    instead(dealDamage(eventAmount, each(DAREDEVIL))),
  ),

  "60012.focus-the-senses-constant": constant(
    onlySourceRemovesThreat({ self: true }, { extensionOf: { kind: "controller" } }),
  ),
  "60012.when-defeated": whenDefeatedMoveAndFetch(),

  "60013.foggy-nelson-action": alterEgoAction({ cost: exhaustThis }, removeThreatFromAScheme(2)),

  "60014.karen-page-action": action(
    { cost: exhaustThis },
    chooseCards("shuffled", zone("discard", you, { filter: query([], ofIdentitySetTitled("Daredevil")) }), {
      min: 1,
      max: 1,
    }),
    moveCards(cards(chosen("shuffled")), "deckShuffle"),
    ifThen(isAlterEgo(), draw(1)),
  ),

  "60015.nelson-and-murdock-response": response(
    SIDE_SCHEME_DEFEATED,
    { while: BY_AN_ATTORNEY },
    chooseTarget("enemy", query("enemy")),
    giveStatus(chosen("enemy"), "confused"),
  ),

  "60016.sister-maggie-constant": constant(gets("rec", 3, query("alterEgo", { name: "Matt Murdock" }))),
  "60016.sister-maggie-response": response(
    YOU_RECOVER,
    chooseOne(
      ...STATUSES.map((status) =>
        option(
          `Discard the ${status} status card from your identity`,
          { when: hasStatus(yourIdentity, status) },
          removeStatus(yourIdentity, status, { count: 1 }),
        ),
      ),
    ),
  ),

  "60017.daredevils-billy-club-constant": constant(gets("atk", 1, DAREDEVIL)),
  "60017.daredevils-billy-club-action": heroAction(
    { cost: returnToHandCost(query("upgrade", { self: true })) },
    chooseOne(
      option("Deal 1 damage to an enemy", damageAnEnemy(1)),
      option(
        "Daredevil gains the Aerial trait until the end of the round",
        gainTraitUntil(AERIAL, yourIdentity, "endOfRound"),
      ),
    ),
  ),

  "60018.the-man-without-fear-action": heroAction(
    { cost: [exhaustThis, takeDamageCost(1)] },
    chooseOne(
      option(
        "Play any upgrade from the Sense deck, ignoring its resource cost",
        playFromSeparateDeck(SENSE_DECK, "any", { ignoreCost: true, filter: query("upgrade") }),
      ),
      option("Ready Daredevil", ready(yourIdentity)),
    ),
  ),
});

function whenDefeatedMoveAndFetch() {
  return whenDefeated(
    chooseCards("moving", cards(each(SENSE_UPGRADE)), { min: 0, max: ANY_NUMBER }),
    forEachCard(
      "moved",
      chosen("moving"),
      chooseTarget(
        "newHost",
        query([], {
          canHaveAttached: chosen("moved"),
          excluding: chosen("moved"),
          not: { hasAttachment: query("upgrade", { inSlot: "moved" }) },
        }),
      ),
      attachCard(chosen("moved"), chosen("newHost")),
    ),
    chooseCards("fetched", separateDeckCards(SENSE_DECK), { min: 0, max: ANY_NUMBER }),
    putIntoPlay(chosen("fetched")),
  );
}

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
