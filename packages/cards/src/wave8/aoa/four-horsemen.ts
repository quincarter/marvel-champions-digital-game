import type { AbilityDefinition, AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  anyOf,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  enemyActivates,
  forcedResponse,
  gainsKeyword,
  giveTough,
  heal,
  identityOf,
  ifThen,
  moveCards,
  named,
  on,
  query,
  remainingHpOf,
  rule,
  self,
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
 * Registered: the eight villain faces (a Forced Response and the "cannot be defeated" constant each, except
 * Pestilence's Forced Response), the four Horseman treacheries (When Revealed and Boost), Ravages of War, A Time of
 * Famine, The Specter of Death, and Metal Wings' retaliate. Skipped (`FOUR_HORSEMEN_SKIPPED`): everything that waits
 * on the villain row (engine queue task 20), the considered hit points floor (task 21), resolving a Forced Response
 * as if it just attacked (task 22) or a blank text box that lasts until the next villain phase begins (task 23).
 *
 * "Another villain has at least 1 hit point" is read live from the other three Horsemen by title (`named`: a villain
 * not in play reads 0). It reads `remainingHp`, so the floor of Golden Horse and Metal Wings (task 21) reaches it
 * once that task lands, with no change here.
 *
 * Horseman of War / Famine / Pestilence / Death: the When Revealed heals 2, gives a tough status card and starts the
 * activation (`enemyActivates`, against the player who revealed it). The Boost queues the second activation behind
 * the one it was drawn for, with no boost card (`afterCurrentActivation`, `noBoost`; Hellfire 49042 is the same
 * shape). The active counter is not touched here: it is 1B's job (45085b, skipped) and, per Q5 = A, moves one
 * position from the villain that holds it.
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

/** The effect of each Horseman's Forced Response, the same on side A and side B. */
const FORCED_RESPONSE: Readonly<Record<Horseman, AbilityDefinition | undefined>> = {
  // Discard an upgrade or support you control (nothing happens with none; a permanent card is no target).
  War: afterAttackingYou(
    chooseTarget("lost", query(["upgrade", "support"], { controller: "you" })),
    discard(chosen("lost")),
  ),
  Famine: afterAttackingYou(moveCards(topOfDeck(10, you), "discard")),
  // Pestilence: skipped, see FOUR_HORSEMEN_SKIPPED and PESTILENCE_FORCED_RESPONSE_DRAFT.
  Pestilence: undefined,
  Death: afterAttackingYou(dealDamage(1, each(query("character", { controller: "you" })))),
};

const villainFace = (face: "a" | "b") => {
  const refs: Record<string, AbilityDefinition> = {};
  for (const { title, slug, code } of HORSEMEN) {
    const forced = FORCED_RESPONSE[title];
    if (forced) refs[`${code}${face}.${slug}-forced-response`] = forced;
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

const ANY_UPGRADE_OR_SUPPORT_OF_DEFEATER = query(["upgrade", "support"], { controlledBy: defeatingPlayer });

export const FOUR_HORSEMEN: AbilityRegistry = defineAbilities({
  ...villainFace("a"),
  ...villainFace("b"),

  // The Ravages of War — When Defeated: the player who defeated this scheme discards an upgrade or support they control.
  "45086.when-defeated": whenDefeated(
    chooseTarget("lost", ANY_UPGRADE_OR_SUPPORT_OF_DEFEATER, { chooser: defeatingPlayer }),
    discard(chosen("lost")),
  ),
  // A Time of Famine — When Defeated: the player who defeated this scheme discards the top 10 cards of their deck.
  "45087.when-defeated": whenDefeated(moveCards(topOfDeck(10, defeatingPlayer), "discard")),
  // The Specter of Death — When Defeated: the player who defeated this scheme deals 1 damage to each character they
  // control. (The amplify icon is data.)
  "45089.when-defeated": whenDefeated(dealDamage(1, each(query("character", { controlledBy: defeatingPlayer })))),

  // Metal Wings — "Death gains retaliate 1" (the first of its two constants; the data names no ref for "Attach to Death
  // and move the active counter to him", see the report). Attached to Death, so the host.
  "45091.metal-wings-constant": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, query("villain", { hostOfSelf: true })),
  ),

  "45092.when-revealed": horsemanWhenRevealed("War"),
  "45092.boost": horsemanBoost("War"),
  "45093.when-revealed": horsemanWhenRevealed("Famine"),
  "45093.boost": horsemanBoost("Famine"),
  "45094.when-revealed": horsemanWhenRevealed("Pestilence"),
  "45094.boost": horsemanBoost("Pestilence"),
  "45095.when-revealed": horsemanWhenRevealed("Death"),
  "45095.boost": horsemanBoost("Death"),
});

/**
 * Pestilence's Forced Response as it should read once a blank text box can last "until the next villain phase begins"
 * (task 23). Not registered. `until: "endOfRound"` is the nearest value today, and it is wrong: the round ends right
 * after the villain phase that made the effect, so the blank would not reach the next player phase.
 */
export const PESTILENCE_FORCED_RESPONSE_DRAFT: AbilityDefinition = afterAttackingYou({
  kind: "blankTextBox",
  target: identityOf(you),
  until: "endOfRound",
});

/** Plague and Pestilence, the same blank for the player who defeated the scheme. Not registered (task 23). */
export const PLAGUE_AND_PESTILENCE_DRAFT: AbilityDefinition = whenDefeated({
  kind: "blankTextBox",
  target: identityOf(defeatingPlayer),
  until: "endOfRound",
});

const PESTILENCE_WAITS =
  "waits on engine queue task 23 (docs/phase7-wave8.md section 8.2, 3.13): a lasting blank of the identity's text box until the next villain phase begins; LastingUntil has no such value, and endOfRound would end it before the next player phase";
const FLOOR_WAITS =
  "waits on engine queue task 21 (3.10): RuleSpec consideredRemainingHp, the floor of 1 on the attached villain's remaining hit points, which every reader (defeat, Forced Responses, the other Horsemen) must see";
const FORCED_AS_IF_WAITS =
  "waits on engine queue task 22 (3.11), after task 21: resolveSpecials trigger forcedResponse and the cost form that resolves the villain's Forced Response as if it just attacked you";

/** Unregistered refs and why. */
export const FOUR_HORSEMEN_SKIPPED: Readonly<Record<string, string>> = {
  "45083a.pestilence-forced-response": PESTILENCE_WAITS,
  "45083b.pestilence-forced-response": PESTILENCE_WAITS,
  "45088.when-defeated": PESTILENCE_WAITS,
  "45085a.setup":
    "waits on engine queue task 20 (3.7): GameState.villainRow and a random order (villainRowSet) for the four set-aside Horsemen, and each player revealing a random side scheme of the set (3.15, exists) in step 12a",
  "45085b.the-horsemen-of-apocalypse-forced-response":
    "waits on engine queue task 20 (3.7): moveActiveCounter { to: nextInRow }, one position along the row from the villain that holds the counter (Q5 = A); the existing nextInActivationOrder reads printed activation orders the Horsemen do not have",
  "45090.golden-horse-constant": `the Aerial trait is expressible, but the same constant carries the floor: ${FLOOR_WAITS}`,
  "45090.golden-horse-response": FORCED_AS_IF_WAITS,
  "45091.metal-wings-constant-2": FLOOR_WAITS,
  "45091.metal-wings-response": FORCED_AS_IF_WAITS,
  "45096.when-revealed": `${FORCED_AS_IF_WAITS}; also task 20 (moving the counter to the next villain in the row) and the asIf floor of 1`,
};
