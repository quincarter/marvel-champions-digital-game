import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EffectSpec, PlayerRef } from "@mc/engine";
import {
  addVillain,
  anyOf,
  blankTextBoxUntil,
  boost,
  chooseTarget,
  chosen,
  consideredToHaveHitPoints,
  constant,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  enemyActivates,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  giveTough,
  heal,
  heroResponse,
  host,
  identityOf,
  ifThen,
  moveActiveCounterToNextInRow,
  moveCards,
  named,
  on,
  query,
  remainingHpOf,
  resolveForcedResponseCost,
  resolveForcedResponseOf,
  revealCard,
  rule,
  selectCards,
  self,
  setActiveVillain,
  setup,
  shuffleEncounterDeck,
  thatPlayer,
  theVillain,
  topOfDeck,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * Scenario set `four_horsemen` (Age of Apocalypse, docs/phase7-wave8.md §2.3, §3.7 to §3.15): the four Horsemen
 * villains (side A and side B are separate one-stage cards with the same text), the main scheme, four side schemes,
 * two attachments and five treacheries.
 *
 * Every ref the card data names is registered (`FOUR_HORSEMEN_SKIPPED` is empty): the eight villain faces (a Forced
 * Response and the "cannot be defeated" constant each), the main scheme's 1A Setup and 1B Forced Response, the four
 * side schemes' When Defeated, Golden Horse and Metal Wings (the considered hit points floor, the trait or retaliate,
 * the Hero Response; Metal Wings' When Revealed), the four Horseman treacheries (When Revealed and Boost) and Rough
 * Riders.
 *
 * The row (docs/phase7-wave8.md §3.7, §3.8). 1A's Setup shuffles the four set-aside Horsemen into a row
 * (`addVillain` with `row: "shuffled"`: `GameState.villainRow`, logged `villainRowSet`) and the leftmost takes the
 * active counter; then each player, in player order, reveals a random side scheme of the set from the encounter deck,
 * which is shuffled once afterward (RRG 1.8 "Search", p. 39). 1B hears every villain activation, the villain phase's
 * and one a treachery or boost ability starts, and moves the counter one place along the row from the villain that
 * holds it, whichever villain activated (§4.1 Q5 = A, the owner's decision). A stunned or confused villain did not
 * activate (RRG 1.8 "Stun, Stunned", p. 41; "Confused", p. 13), so the counter stays (§4.1 Q4 = A).
 *
 * "Another villain has at least 1 hit point" is read live from the other three Horsemen by title (`named`: a villain
 * not in play reads 0). It reads `remainingHp`, and so does each Forced Response's "if he has at least 1 hit point".
 *
 * "Is considered to have at least 1 hit point" (Golden Horse, Metal Wings; docs/phase7-wave8.md §3.10, §4.1 Q6 = A) is
 * `consideredToHaveHitPoints` on the attached villain: every reading of its remaining hit points is at least 1, so its
 * own Forced Response still resolves at 0, the other three Horsemen stay protected by it, and it is not defeated at
 * zero itself (RRG 1.8 "Defeat", p. 15) until the attachment leaves. The dial is untouched, so Golden Horse's own
 * "villain with the fewest hit points" reads the real one.
 *
 * Horseman of War / Famine / Pestilence / Death: the When Revealed heals 2, gives a tough status card and starts the
 * activation (`enemyActivates`, against the player who revealed it). The Boost queues the second activation behind
 * the one it was drawn for, with no boost card (`afterCurrentActivation`, `noBoost`; Hellfire 49042 is the same
 * shape). The active counter is not touched here: it is 1B's job (45085b) and, per Q5 = A, moves one position from the
 * villain that holds it.
 *
 * Cards (20):
 * - 45081a War (villain)
 * - 45081b War (villain)
 * - 45082a Famine (villain)
 * - 45082b Famine (villain)
 * - 45083a Pestilence (villain)
 * - 45083b Pestilence (villain)
 * - 45084a Death (villain)
 * - 45084b Death (villain)
 * - 45085a The Horsemen of Apocalypse (main_scheme)
 * - 45086 The Ravages of War (side_scheme)
 * - 45087 A Time of Famine (side_scheme)
 * - 45088 Plague and Pestilence (side_scheme)
 * - 45089 The Specter of Death (side_scheme)
 * - 45090 Golden Horse (attachment)
 * - 45091 Metal Wings (attachment)
 * - 45092 Horseman of War (treachery)
 * - 45093 Horseman of Famine (treachery)
 * - 45094 Horseman of Pestilence (treachery)
 * - 45095 Horseman of Death (treachery)
 * - 45096 Rough Riders (treachery)
 */

type Horseman = "War" | "Famine" | "Pestilence" | "Death";
const HORSEMEN: readonly { readonly title: Horseman; readonly slug: string; readonly code: string }[] = [
  { title: "War", slug: "war", code: "45081" },
  { title: "Famine", slug: "famine", code: "45082" },
  { title: "Pestilence", slug: "pestilence", code: "45083" },
  { title: "Death", slug: "death", code: "45084" },
];

/** "[Name] cannot be defeated while another villain has at least 1 hit point." */
const cannotBeDefeatedWhileAnother = (title: Horseman) =>
  constant(
    rule({
      kind: "cannotBeDefeated",
      target: { self: true },
      while: anyOf(
        ...HORSEMEN.filter((h) => h.title !== title).map((h) => valueAtLeast(remainingHpOf(named(h.title)), 1)),
      ),
    }),
  );

/** "[star] Forced Response: After [Name] attacks you, if [he/she] has at least 1 hit point, …". */
const afterAttackingYou = (...effects: EffectSpec[]) =>
  forcedResponse(on.enemyAttacks("self", { againstYou: true }), ifThen(valueAtLeast(remainingHpOf(self), 1), effects));

/**
 * "Treat[s] [their] identity's text box as if it were blank (except for [TRAITS]) until the next villain phase begins"
 * (Pestilence, Plague and Pestilence; docs/phase7-wave8.md §3.13). The whole identity card is blank, both faces and
 * its keywords, with traits and the stat line kept (RRG 1.8 "Text Box", p. 44; "Traits", p. 45). Made in a villain
 * phase it lasts through all of the next player phase; made in the player phase, to that round's villain phase.
 */
const blankIdentityOf = (player: PlayerRef): EffectSpec =>
  blankTextBoxUntil(identityOf(player), "nextVillainPhaseBegins");

/** The effect of each Horseman's Forced Response, the same on side A and side B. */
const FORCED_RESPONSE: Readonly<Record<Horseman, AbilityDefinition>> = {
  // Discard an upgrade or support you control (nothing happens with none; a permanent card is no target).
  War: afterAttackingYou(
    chooseTarget("lost", query(["upgrade", "support"], { controller: "you" })),
    discard(chosen("lost")),
  ),
  Famine: afterAttackingYou(moveCards(topOfDeck(10, you), "discard")),
  Pestilence: afterAttackingYou(blankIdentityOf(you)),
  Death: afterAttackingYou(dealDamage(1, each(query("character", { controller: "you" })))),
};

const villainFace = (face: "a" | "b") => {
  const refs: Record<string, AbilityDefinition> = {};
  for (const { title, slug, code } of HORSEMEN) {
    refs[`${code}${face}.${slug}-forced-response`] = FORCED_RESPONSE[title];
    refs[`${code}${face}.${slug}-constant`] = cannotBeDefeatedWhileAnother(title);
  }
  return refs;
};

/** "Heal 2 damage from X and give [him/her] a tough status card. [He/She] activates against you." */
const horsemanWhenRevealed = (title: Horseman) =>
  whenRevealed(heal(2, named(title)), giveTough(named(title)), enemyActivates(named(title), { against: you }));
/** "[star] Boost: After this activation, X activates against you. Do not give X a boost card for that activation." */
const horsemanBoost = (title: Horseman) =>
  boost(enemyActivates(named(title), { against: you, afterCurrentActivation: true, noBoost: true }));

/** A side scheme of this set still in the encounter deck. */
const HORSEMEN_SIDE_SCHEME = query("sideScheme", { inEncounterSet: "four_horsemen" });

const AERIAL = trait("AERIAL");
/** "Attached villain". */
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });

/**
 * "Hero Response: After you attack attached villain, resolve its 'Forced Response' as if it just attacked you → discard
 * this card." (Golden Horse; Metal Wings names Death, its only host.) "You attack" is the player's identity attacking
 * (RRG 1.8 "You, Your", p. 49). The villain's printed Forced Response resolves as the cost, with that player as "you":
 * no attack is made, so no boost card, no damage of an attack and no move of the active counter. Its own "if he has at
 * least 1 hit point" is met by this card's constant. Not offered while it could change nothing (War with no upgrade or
 * support to discard; docs/phase7-wave8.md §3.11, §4.1 Q7 = A).
 */
const resolveHostsForcedResponse = heroResponse(
  on.attacks(query("identity"), { byYou: true, target: ATTACHED_VILLAIN }),
  { cost: resolveForcedResponseCost(host) },
  discard(self),
);
/** "Resolve the 'Forced Response' on the active villain as if it has at least 1 hit point and attacked you." */
const RESOLVE_ACTIVE_VILLAINS_FORCED_RESPONSE = resolveForcedResponseOf(theVillain, { remainingHpAtLeast: 1 });

const ANY_UPGRADE_OR_SUPPORT_OF_DEFEATER = query(["upgrade", "support"], { controlledBy: defeatingPlayer });

export const FOUR_HORSEMEN: AbilityRegistry = defineAbilities({
  ...villainFace("a"),
  ...villainFace("b"),

  // The Horsemen of Apocalypse 1A — Setup: Shuffle the four Horsemen villains, then reveal them in a row from left to
  // right. Place the active counter on the leftmost villain. Each player reveals a random side scheme from the Four
  // Horsemen encounter set.
  "45085a.setup": setup(
    selectCards("horsemen", encounterSetAside(query("villain"))),
    addVillain(chosen("horsemen"), { row: "shuffled" }),
    forEachPlayer(
      eachPlayer,
      selectCards("scheme", encounterCards(["deck"], HORSEMEN_SIDE_SCHEME, { random: 1 })),
      revealCard(chosen("scheme"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // 1B — Forced Response: After a villain activates, move the active counter to the next villain. ("If this stage is
  // completed, the players lose the game" is data.) Always one place from the villain holding the counter (Q5 = A).
  "45085b.the-horsemen-of-apocalypse-forced-response": forcedResponse(
    on.enemyActivates(query("villain")),
    moveActiveCounterToNextInRow,
  ),

  // The Ravages of War — When Defeated: the player who defeated this scheme discards an upgrade or support they control.
  "45086.when-defeated": whenDefeated(
    chooseTarget("lost", ANY_UPGRADE_OR_SUPPORT_OF_DEFEATER, { chooser: defeatingPlayer }),
    discard(chosen("lost")),
  ),
  // A Time of Famine — When Defeated: the player who defeated this scheme discards the top 10 cards of their deck.
  "45087.when-defeated": whenDefeated(moveCards(topOfDeck(10, defeatingPlayer), "discard")),
  // Plague and Pestilence — When Defeated: the player who defeated this scheme treats their identity's text box as if
  // it were blank (except for [TRAITS]) until the next villain phase begins.
  "45088.when-defeated": whenDefeated(blankIdentityOf(defeatingPlayer)),
  // The Specter of Death — When Defeated: the player who defeated this scheme deals 1 damage to each character they
  // control. (The amplify icon is data.)
  "45089.when-defeated": whenDefeated(dealDamage(1, each(query("character", { controlledBy: defeatingPlayer })))),

  // Golden Horse — "Attached villain gains the [AERIAL] trait and is considered to have at least 1 hit point." ("Attach
  // to the villain with the fewest hit points without the Aerial trait" is the card's `attachesTo`, data.)
  "45090.golden-horse-constant": constant(
    gainsTrait(AERIAL, ATTACHED_VILLAIN),
    consideredToHaveHitPoints(ATTACHED_VILLAIN),
  ),

  "45090.golden-horse-response": resolveHostsForcedResponse,

  // Metal Wings — "Death gains retaliate 1 and is considered to have at least 1 hit point remaining." Attached to
  // Death, so the host.
  "45091.metal-wings-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, ATTACHED_VILLAIN),
    consideredToHaveHitPoints(ATTACHED_VILLAIN),
  ),

  // "Attach to Death and move the active counter to him." The attaching is the card's `attachesTo` (data); the counter
  // goes straight to Death, wherever he sits in the row (`setActiveVillain`, not a step along it).
  "45091.when-revealed": whenRevealed(setActiveVillain(named("Death"))),
  "45091.metal-wings-response": resolveHostsForcedResponse,

  "45092.when-revealed": horsemanWhenRevealed("War"),
  "45092.boost": horsemanBoost("War"),
  "45093.when-revealed": horsemanWhenRevealed("Famine"),
  "45093.boost": horsemanBoost("Famine"),
  "45094.when-revealed": horsemanWhenRevealed("Pestilence"),
  "45094.boost": horsemanBoost("Pestilence"),
  "45095.when-revealed": horsemanWhenRevealed("Death"),
  "45095.boost": horsemanBoost("Death"),

  // Rough Riders — When Revealed: Resolve the "Forced Response" on the active villain as if it has at least 1 hit point
  // and attacked you. Move the active counter to the next villain and resolve its "Forced Response" the same way.
  // Neither is an activation, so 1B does not move the counter again: it moves once, here (§3.7, §3.11).
  "45096.when-revealed": whenRevealed(
    RESOLVE_ACTIVE_VILLAINS_FORCED_RESPONSE,
    moveActiveCounterToNextInRow,
    RESOLVE_ACTIVE_VILLAINS_FORCED_RESPONSE,
  ),
});

/** Unregistered refs and why. */
export const FOUR_HORSEMEN_SKIPPED: Readonly<Record<string, string>> = {};
