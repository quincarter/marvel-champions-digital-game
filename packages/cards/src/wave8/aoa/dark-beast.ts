import type { AbilityDefinition, AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  anyOf,
  attachCard,
  boost,
  chosen,
  constant,
  defeatingPlayer,
  defineAbilities,
  dealEncounterCard,
  discardEncounterUntil,
  eachPlayer,
  enemyActivates,
  exhaustYourHero,
  find,
  forEachPlayer,
  forcedInterrupt,
  gainsKeyword,
  gets,
  giveTough,
  heroAction,
  discard,
  encounterSetOf,
  each,
  ifThen,
  inForm,
  inMode,
  named,
  on,
  query,
  revealCard,
  revealFromSetAsideModularSet,
  self,
  setup,
  thatPlayer,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";
import { resolveSettingSpecial, resolveSettingSpecialCost, SETTING_ENVIRONMENT } from "./setting.js";

const THE_BEAST = named("Dark Beast");
const HOST_MINION = query("minion", { hostOfSelf: true });

/** A real player (not "nobody") defeated the card: an encounter card's damage leaves no defeating player. */
const aPlayerDefeated = anyOf(inForm("hero", defeatingPlayer), inForm("alterEgo", defeatingPlayer));

/**
 * High-Tech Goggles and Genetic Enhancement: "Hero Action: Exhaust your hero and resolve the 'Special' ability on the
 * Setting environment -> discard this card." Both the exhaust and the Special are the cost (docs/phase7-wave8.md
 * §3.24), so the action is not offered while the hero is exhausted, with no Setting environment in play, or while the
 * Special would change nothing (§4.1 Q7 = A). The attachment is on Dark Beast; any player in hero form may use it.
 */
const goggleAction = (): AbilityDefinition =>
  heroAction({ cost: [exhaustYourHero, resolveSettingSpecialCost] }, discard(self));

/** "Deal each player an encounter card." (stages II and III) */
const dealEachPlayer = (): EffectSpec => forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer));

/** The Forced Interrupt every stage prints: the attacked player resolves the Setting environment's Special. */
const darkBeastInterrupt = () =>
  forcedInterrupt(on.enemyAttacks("self", { againstYou: true }), ...resolveSettingSpecial());

/**
 * Scenario set `dark_beast` (Age of Apocalypse, docs/phase7-wave8.md §1.16, §2.8, §3.12, §3.23, §3.24, §3.25, §3.32,
 * §4.1 Q8, Q14, Q15): Dark Beast I to III, Dark Beast's Bogus Journey and the set's cards. The Savage Land, Genosha and
 * Blue Moon sets are set aside whole by the scenario builder (`setAsideModularSets`, with `setAsideUntilCalled` so
 * their setup keywords wait); Dark Beast's When Revealed reveals the Setting environment of a random one and
 * shuffles the rest of that set in. Stages II and III also deal each player an encounter card.
 *
 * 45121a's Setup reveals High-Tech Goggles in expert mode, found in the encounter deck and attached to Dark Beast by the
 * attachment's own "Attach to Dark Beast". "If this stage is completed, the players lose the game" is data.
 *
 * Evil Genius: the alter-ego half is Dark Beast scheming (the revealing player is in alter-ego form) and then the tough
 * card; the hero half is Dark Beast attacking with one additional boost card (Q8 = A: the boost card is set up for the
 * activation, the tough card follows it).
 *
 * Cruel Experiment's +1 ATK and +1 SCH are data statModifiers; the hit points and guard are constants of the host.
 *
 * The two Hero Actions (Goggles, Genetic Enhancement) pay the Setting environment's Special as part of their cost
 * (`goggleAction`).
 *
 * Cards (7):
 * - 45118 Dark Beast (villain)
 * - 45121a Dark Beast's Bogus Journey (main_scheme)
 * - 45122 High-Tech Goggles (attachment)
 * - 45123 Genetic Enhancement (attachment)
 * - 45124 Cruel Experiment (attachment)
 * - 45125 Evil Genius (treachery)
 * - 45126 Time-Travel Shenanigans (side_scheme)
 */
export const DARK_BEAST: AbilityRegistry = defineAbilities({
  // Dark Beast I — [star] Forced Interrupt: When Dark Beast attacks you, resolve the Special on the Setting environment.
  "45118.dark-beast-forced-interrupt": darkBeastInterrupt(),
  // When Revealed: Reveal a random set-aside environment and shuffle the rest of its encounter set into the encounter deck.
  "45118.when-revealed": whenRevealed(revealFromSetAsideModularSet(SETTING_ENVIRONMENT)),
  // Dark Beast II — the same, and: Deal each player an encounter card.
  "45119.dark-beast-forced-interrupt": darkBeastInterrupt(),
  "45119.when-revealed": whenRevealed(revealFromSetAsideModularSet(SETTING_ENVIRONMENT), dealEachPlayer()),
  // Dark Beast III — the same as II.
  "45120.dark-beast-forced-interrupt": darkBeastInterrupt(),
  "45120.when-revealed": whenRevealed(revealFromSetAsideModularSet(SETTING_ENVIRONMENT), dealEachPlayer()),

  // Dark Beast's Bogus Journey 1A — Setup: (the three sets are set aside by the builder.) In expert mode, reveal the
  // High-Tech Goggles attachment.
  "45121a.setup": setup(ifThen(inMode("expert"), revealCard(find(query("attachment", { name: "High-Tech Goggles" }))))),

  // High-Tech Goggles — Attach to Dark Beast (data, +1 SCH). [star] Boost: Attach this card to Dark Beast.
  // Hero Action: Exhaust your hero and resolve the Special on the Setting environment -> discard this card.
  "45122.high-tech-goggles-action": goggleAction(),
  "45122.boost": boost(attachCard(self, THE_BEAST)),
  // Genetic Enhancement — Attach to Dark Beast (data, +1 ATK). [star] Boost: Attach this card to Dark Beast.
  "45123.genetic-enhancement-action": goggleAction(),
  "45123.boost": boost(attachCard(self, THE_BEAST)),

  // Cruel Experiment — Attached minion gets +2 hit points and gains guard (+1 ATK, +1 SCH are data).
  "45124.cruel-experiment-constant": constant(gets("hp", 2, HOST_MINION), gainsKeyword({ name: "guard" }, HOST_MINION)),
  // When Revealed: Discard cards from the top of the encounter deck until you discard a minion. Reveal that minion and
  // attach Cruel Experiment to it.
  "45124.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion"), "found"),
    revealCard(chosen("found")),
    attachCard(self, chosen("found")),
  ),

  // Evil Genius — When Revealed (Alter-Ego): Dark Beast schemes. Give him a tough status card.
  "45125.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyActivates(THE_BEAST, { against: you }),
    giveTough(THE_BEAST),
  ),
  // When Revealed (Hero): Dark Beast attacks you. Give him an additional boost card for this attack.
  "45125.when-revealed-hero": whenRevealedHero(enemyActivates(THE_BEAST, { against: you, extraBoostCards: 1 })),

  // Time-Travel Shenanigans — When Defeated: The player who defeated this scheme discards cards from the top of the
  // encounter deck until they discard a card from the same encounter set as the Setting environment and reveals it.
  "45126.when-defeated": whenDefeated(
    ifThen(aPlayerDefeated, [
      discardEncounterUntil(query([], encounterSetOf(each(SETTING_ENVIRONMENT))), "found"),
      revealCard(chosen("found"), defeatingPlayer),
    ]),
  ),
});

export const DARK_BEAST_SKIPPED: Readonly<Record<string, string>> = {};
