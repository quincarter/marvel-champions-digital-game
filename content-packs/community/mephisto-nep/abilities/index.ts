/**
 * Mephisto scenario pack (mephisto-nep), by Neptune (Typhon00). STUB: no ability is scripted yet. Every ability id the
 * card records reference is listed below under its card with the printed text, for the ability-scripting pass.
 * Run `mc-pack validate --allow-unscripted` until then.
 */
import { definePackAbilities } from "@mc/mod-sdk";

export default definePackAbilities({
  // ======== 01 Mephisto (villain, 1/28, 2/28, 3/28)
  // Mephisto (I):
  //   Steady.
  //   [star] Devil's Pacts — Forced Interrupt: When Mephisto would activate against you, if you control a Bargain attachment, Mephisto does not activate and heals 1[per_hero] damage instead. If no damage was healed this way, place 1 threat on the main scheme for each Bargain attachment in play.
  //   ids: x.mephisto-nep.01.devils-pacts-i
  // Mephisto (II):
  //   Steady.
  //   [star] Devil's Pacts — Forced Interrupt: When Mephisto would activate against you, if you control a Bargain attachment, Mephisto does not activate and heals 2[per_hero] damage instead. If no damage was healed this way, place 1 threat on the main scheme for each Bargain attachment in play.
  //   When Revealed: Find and attach the Hell Lord attachment to Mephisto.
  //   ids: x.mephisto-nep.01.devils-pacts-ii, x.mephisto-nep.01.when-revealed-ii
  // Mephisto (III):
  //   Stalwart.
  //   [star] Devil's Pacts — Forced Interrupt: When Mephisto would activate against you, if you control a Bargain attachment, Mephisto does not activate and heals 3[per_hero] damage instead. If no damage was healed this way, place 1 threat on the main scheme for each Bargain attachment in play.
  //   ids: x.mephisto-nep.01.devils-pacts-iii
  // ======== 02a Battle for the Soul (main_scheme, 4/28, 5/28, 6/28 (1A/1B, 2A/2B, 3A/3B))
  // stage 1A:
  //   Contents: Mephisto (I) and Mephisto (II). (Mephisto (II) and Mephisto (III) for expert mode.) Mephisto, Blackheart, Damned, and Standard encounter sets. One modular encounter set (Corruptive Offers or Mother of Demons).
  //   Setup: Put the Hell Lord attachment aside, out of play. Put the Gateway to Corruption environment into play. Create the "Damnation" game area (see insert for details).
  //   NOTE: the Hell Lord is set aside by the scenario record (setAsideCardIds) and the Gateway enters play via its Setup keyword; this ability only needs to create the Damnation area.
  //   ids: x.mephisto-nep.02a.setup
  // stage 1B:
  //   Forced Response: At the end of your turn, resolve the "Hidden Clause" ability for each Bargain attachment you control.
  //   Hidden Clause — Special: Put 1[per_hero] card from the top of your deck facedown into Damnation.
  //   ids: x.mephisto-nep.02a.forced-response, x.mephisto-nep.02a.hidden-clause
  // stage 2A:
  //   When Revealed: Shuffle each Bargain attachment from the encounter discard pile into the encounter deck. In player order, each player must search the encounter deck for a Bargain attachment and reveal it. (Shuffle.)
  //   ids: x.mephisto-nep.02a.when-revealed-2
  // stage 2B:
  //   Forced Response: At the end of your turn, resolve the "Hidden Clause" ability for each Bargain attachment you control.
  //   Hidden Clause — Special: Put 2[per_hero] cards from the top of your deck facedown into Damnation.
  //   ids: x.mephisto-nep.02a.forced-response-2, x.mephisto-nep.02a.hidden-clause-2
  // stage 3A:
  //   When Revealed: Shuffle each Bargain attachment from the encounter discard pile into the encounter deck. Flip the Gateway to Corruption environment to reveal the Hell environment.
  //   ids: x.mephisto-nep.02a.when-revealed-3
  // stage 3B:
  //   Forced Response: At the end of your turn, resolve the "Hidden Clause" ability for each Bargain attachment you control.
  //   Hidden Clause — Special: Put 3[per_hero] cards from the top of your deck facedown into Damnation.
  //   If there is no threat here, the players win the game.
  //   If this stage is completed, the players lose the game.
  //   ids: x.mephisto-nep.02a.forced-response-3, x.mephisto-nep.02a.hidden-clause-3, x.mephisto-nep.02a.win-condition
  // ======== 03a Gateway to Corruption (environment, 7/28 (A/B))
  // Gateway to Corruption:
  //   Permanent. Setup.
  //   Forced Interrupt: When a card is set aside from a player's deck, put it facedown into Damnation instead.
  //   If there are 10[per_hero] cards in Damnation, the players lose the game.
  //   ids: x.mephisto-nep.03a.forced-interrupt, x.mephisto-nep.03a.damnation-loss
  // Hell (flip side):
  //   Permanent.
  //   [star] Forced Response: At the end of the round (after the first player token is passed), place 1 acceleration token here.
  //   Forced Interrupt: When a card is set aside from a player's deck, put it facedown into Damnation instead.
  //   If there are 10[per_hero] cards in Damnation, the players lose the game.
  //   ids: x.mephisto-nep.03b.forced-response, x.mephisto-nep.03b.forced-interrupt, x.mephisto-nep.03b.damnation-loss
  // ======== 04 Hell Lord (attachment, 8/28)
  // Hell Lord:
  //   Attach to Mephisto.
  //   Reduce the amount of damage Mephisto takes from identities by 1 for each Bargain attachment they control.
  //   Forced Response: After an identity with a Bargain attachment attacks Mephisto, for each Bargain attachment they control, look at 1 card in Damnation → shuffle each card looked at this way back into its owner's deck.
  //   ids: x.mephisto-nep.04.hell-lord-constant, x.mephisto-nep.04.forced-response
  // ======== 05 Endless Greed (attachment, 9/28)
  // Endless Greed:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Your identity gains +2 hand size.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.05.when-revealed, x.mephisto-nep.05.endless-greed-constant, x.mephisto-nep.05.response
  // ======== 06 Gluttonous Restoration (attachment, 10/28)
  // Gluttonous Restoration:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Alter-Ego Interrupt: When you make a basic recovery, restore your identity to its printed hit point value and you may discard any number of status cards from it.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.06.when-revealed, x.mephisto-nep.06.alter-ego-interrupt, x.mephisto-nep.06.response
  // ======== 07 Lusting Existence (attachment, 11/28)
  // Lusting Existence:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Action: Exhaust an identity-specific card you control → ready your identity.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.07.when-revealed, x.mephisto-nep.07.action, x.mephisto-nep.07.response
  // ======== 08 Prideful Ambitions (attachment, 12/28)
  // Prideful Ambitions:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Your identity ignores the patrol keyword and any crisis icons ([crisis]) in play. Double the THW value of your identity.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.08.when-revealed, x.mephisto-nep.08.prideful-ambitions-constant, x.mephisto-nep.08.response
  // ======== 09 Shackled Wrath (attachment, 13/28)
  // Shackled Wrath:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Your identity's attacks gain overkill. Double the ATK value of your identity.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.09.when-revealed, x.mephisto-nep.09.shackled-wrath-constant, x.mephisto-nep.09.response
  // ======== 10 Slothful Endurance (attachment, 14/28)
  // Slothful Endurance:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Your identity cannot take damage less than its DEF from each attack. Double the DEF value of your identity.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.10.when-revealed, x.mephisto-nep.10.slothful-endurance-constant, x.mephisto-nep.10.response
  // ======== 11 Unquenchable Envy (attachment, 15/28)
  // Unquenchable Envy:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and Mephisto activates against you.
  //   Each resource you generate is considered a wild ([wild]) resource instead of its current resource.
  //   Response: After your turn begins, discard this card → Mephisto activates against you. Apply this card's boost icons ([boost]) for this activation as if it were a boost card.
  //   ids: x.mephisto-nep.11.when-revealed, x.mephisto-nep.11.unquenchable-envy-constant, x.mephisto-nep.11.response
  // ======== 12 Aid the Condemned (side_scheme, 16/28)
  // Aid the Condemned:
  //   Hinder 2[per_hero].
  //   When Defeated: Each player looks at 1[per_hero] card in Damnation and shuffles it back into their owner's deck.
  //   ids: x.mephisto-nep.12.when-defeated
  // ======== 13 Culling the Damned (side_scheme, 17/28)
  // Culling the Damned:
  //   Forced Interrupt: After a Mystic minion is defeated, place one scorned counter here.
  //   When Defeated: The player who defeated this side scheme looks at X cards in Damnation, where X is equal to the number of scorned counters here. Shuffle each card looked at this way back into its owner's deck.
  //   ids: x.mephisto-nep.13.forced-interrupt, x.mephisto-nep.13.when-defeated
  // ======== 14 Exposing Intentions (side_scheme, 18/28)
  // Exposing Intentions:
  //   Forced Interrupt: When a card is put into Damnation from a player's deck, put 1 additional card into Damnation from that player's deck.
  //   When Defeated: Each player looks at each card in Damnation, then shuffles 1[per_hero] card looked at this way back into their owner's deck. Shuffle the Damnation area.
  //   ids: x.mephisto-nep.14.forced-interrupt, x.mephisto-nep.14.when-defeated
  // ======== 15 Hotel Inferno (side_scheme, 19/28)
  // Hotel Inferno:
  //   When Revealed: Place 6 threat on the main scheme for every 6 cards in Damnation.
  //   When Defeated: The player who defeated this scheme looks at up to 6 cards in Damnation. Shuffle each card looked at this way back into its owner's deck.
  //   ids: x.mephisto-nep.15.when-revealed, x.mephisto-nep.15.when-defeated
  // ======== 16 Alter the Deal (treachery, 20/28)
  // Alter the Deal:
  //   When Revealed: Shuffle each Bargain attachment you control into the encounter deck. For each Bargain attachment shuffled this way, resolve the "Hidden Clause" ability on the main scheme. Then, discard cards from the top of the encounter deck until a Bargain attachment is discarded. Attach that card to your identity. Otherwise, shuffle this card into the encounter deck.
  //   ids: x.mephisto-nep.16.when-revealed
  // ======== 17 Dark Compulsions (treachery, 21/28, 22/28)
  // Dark Compulsions:
  //   When Revealed: Each player resolves the "Hidden Clause" ability on the main scheme if they control a Bargain attachment. If no player controls a Bargain attachment, you may look at 1[per_hero] card in Damnation and shuffle it back into its owner's deck.
  //   [star] Boost: This card gains boost icons ([boost]) equal to the number of Bargain attachments in play.
  //   ids: x.mephisto-nep.17.when-revealed, x.mephisto-nep.17.boost
  // ======== 18 Demonic Fury (treachery, 23/28)
  // Demonic Fury:
  //   Peril.
  //   When Revealed: Choose:
  //   • Search the encounter deck and discard pile for a Bargain attachment. Attach it to your identity.
  //   • Mephisto attacks you. Give him an additional boost card for this activation. This attack gains overkill and piercing.
  //   ids: x.mephisto-nep.18.when-revealed
  // ======== 19 Infernal Temper (treachery, 24/28, 25/28)
  // Infernal Temper:
  //   When Revealed (Alter-Ego): Mephisto schemes with +X SCH, where X is equal to the number of Bargain attachments in play.
  //   When Revealed (Hero): Mephisto attacks you with +X ATK, where X is equal to the number of Bargain attachments in play.
  //   ids: x.mephisto-nep.19.when-revealed-alter-ego, x.mephisto-nep.19.when-revealed-hero
  // ======== 20 Meager Request (treachery, 26/28, 27/28)
  // Meager Request:
  //   When Revealed: You may ready your identity, draw 1 card, and heal 4 damage from your identity. If you do, resolve the "Hidden Clause" ability on the main scheme. Otherwise, this card gains surge.
  //   [star] Boost: After this activation, discard cards from the top of the encounter deck until a Bargain attachment is discarded. Reveal that card.
  //   ids: x.mephisto-nep.20.when-revealed, x.mephisto-nep.20.boost
  // ======== 21 Rewrite History (treachery, 28/28)
  // Rewrite History:
  //   Peril.
  //   When Revealed: Choose:
  //   • Discard your hand, shuffle your discard pile into your deck, draw up to your hand size, and ready your identity. Search the encounter deck and discard pile for a Bargain attachment. Attach it to your identity.
  //   • Mephisto schemes against you. Give him 2 additional boost cards for this activation.
  //   ids: x.mephisto-nep.21.when-revealed
  // ======== 22 Blackheart (minion, B1/5)
  // Blackheart:
  //   Toughness. Villainous.
  //   Action: Discard a Bargain attachment you control → heal 3 damage from Blackheart. If no damage was healed this way, give him a tough status card.
  //   [star] Boost: You may discard a Bargain attachment to cancel this activation. If you do, put Blackheart into play engaged with you.
  //   ids: x.mephisto-nep.22.action, x.mephisto-nep.22.boost
  // ======== 23 Prince's Offer (side_scheme, B2/5)
  // Prince's Offer:
  //   Incite 1.
  //   When Defeated: Each player may shuffle 1 Bargain attachment they control into the encounter deck. The player who defeated this scheme finds the Black-Hearted attachment and reveals it.
  //   ids: x.mephisto-nep.23.when-defeated
  // ======== 24 Black-Hearted (attachment, B3/5)
  // Black-Hearted:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Interrupt: When the villain phase begins, if this is the only Bargain attachment you control, look at the top 3 cards of the encounter deck. Put them back in any order.
  //   Response: After your turn begins, discard this card → find Blackheart and reveal him. (If he is already in play, he engages you.) Blackheart activates against you.
  //   ids: x.mephisto-nep.24.when-revealed, x.mephisto-nep.24.interrupt, x.mephisto-nep.24.response
  // ======== 25 Sinful Ambitions (treachery, B4/5, B5/5)
  // Sinful Ambitions:
  //   Incite 2.
  //   When Revealed: If Blackheart is in play, you may shuffle a Bargain attachment you control into the encounter deck. If you do, give Blackheart a tough status. Otherwise, this card gains surge.
  //   ids: x.mephisto-nep.25.when-revealed
  // ======== 26 Deathless Persistence (attachment, CO1/6)
  // Deathless Persistence:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Interrupt: When a character you control would be defeated, place 1 corrupt counter here → heal 1 damage from that character instead.
  //   Response: Discard this card → set-aside X[per_hero] cards from the top of your deck facedown, where X is equal to the number of corrupt counters here.
  //   ids: x.mephisto-nep.26.when-revealed, x.mephisto-nep.26.interrupt, x.mephisto-nep.26.response
  // ======== 27 Famished Power (attachment, CO2/6)
  // Famished Power:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Interrupt: When you use a basic power, place 1 corrupt counter here → combine the values of 2 basic powers of your hero for this use.
  //   Response: Discard this card → set-aside X[per_hero] cards from the top of your deck facedown, where X is equal to the number of corrupt counters here.
  //   ids: x.mephisto-nep.27.when-revealed, x.mephisto-nep.27.interrupt, x.mephisto-nep.27.response
  // ======== 28 Pestilent Nature (attachment, CO3/6)
  // Pestilent Nature:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Interrupt: When a card you control leaves play, place 1 corrupt counter here → shuffle that card into your deck instead.
  //   Response: Discard this card → set-aside X[per_hero] cards from the top of your deck facedown, where X is equal to the number of corrupt counters here.
  //   ids: x.mephisto-nep.28.when-revealed, x.mephisto-nep.28.interrupt, x.mephisto-nep.28.response
  // ======== 29 Warring Rage (attachment, CO4/6)
  // Warring Rage:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Hero Response: After you attack and defeat an enemy, place 1 corrupt counter here → ready your hero, heal 1 damage, and draw 1 card.
  //   Response: Discard this card → set-aside X[per_hero] cards from the top of your deck facedown, where X is equal to the number of corrupt counters here.
  //   ids: x.mephisto-nep.29.when-revealed, x.mephisto-nep.29.hero-response, x.mephisto-nep.29.response
  // ======== 30 Soul Gambling (treachery, CO5/6, CO6/6)
  // Soul Gambling:
  //   When Revealed: Each player sets aside the top X[per_hero] cards of their deck, where X is equal to the number of corrupt counters on each Bargain attachment they have under their control. Otherwise, this card gains surge.
  //   [star] Boost: Place 1 corrupt counter on each Bargain attachment you control. If no counters were placed this way, shuffle this card into the encounter deck.
  //   ids: x.mephisto-nep.30.when-revealed, x.mephisto-nep.30.boost
  // ======== 31 Demon Amalgam (minion, D1/12)
  // Demon Amalgam:
  //   Teamwork (Mystic). Toughness. Vulnerable.
  //   [star] Demon Amalgam gets +1 hit point for each damned counter on it.
  //   When Revealed: Place X damned counters on Demon Amalgam, where X is equal to the number of Mystic minions in the encounter discard pile.
  //   ids: x.mephisto-nep.31.demon-amalgam-constant, x.mephisto-nep.31.when-revealed
  // ======== 32 Demon Lieutenant (minion, D2/12)
  // Demon Lieutenant:
  //   Retaliate 1. Teamwork (Mystic).
  //   [star] Demon Lieutenant's attacks gain overkill.
  //   [star] Boost: If this activation is an attack, this attack gains overkill and this card gets +1 boost icon ([boost]) for this activation.
  //   ids: x.mephisto-nep.32.demon-lieutenant-constant, x.mephisto-nep.32.boost
  // ======== 33 Demon Soldier (minion, D3/12, D4/12)
  // Demon Soldier:
  //   Guard. Teamwork (Mystic).
  //   When Revealed: Take 1 indirect damage.
  //   [star] Boost: After this activation, put this minion into play engaged with you.
  //   ids: x.mephisto-nep.33.when-revealed, x.mephisto-nep.33.boost
  // ======== 34 Dweller Demon (minion, D5/12)
  // Dweller Demon:
  //   Surge. Teamwork (Mystic).
  //   When Revealed: Place X threat on a scheme, where X is equal to the number of other Mystic minions in play.
  //   [star] Forced Response: After Dweller Demon attacks you, if there are no other minions engaged with you, deal yourself 1 facedown encounter card.
  //   ids: x.mephisto-nep.34.when-revealed, x.mephisto-nep.34.forced-response
  // ======== 35 Harmony Demon (minion, D6/12)
  // Harmony Demon:
  //   Incite 2. Teamwork (Mystic).
  //   [star] Forced Response: After Harmony Demon activates, heal 1 damage from each other Mystic minion in play.
  //   [star] Boost: If this activation is a scheme, give the activating enemy a tough status card and this card gets +1 boost icon ([boost]) for this activation.
  //   ids: x.mephisto-nep.35.forced-response, x.mephisto-nep.35.boost
  // ======== 36 Human Demon (minion, D7/12, D8/12)
  // Human Demon:
  //   Patrol. Teamwork (Mystic).
  //   When Revealed: Place 1 threat on the main scheme.
  //   [star] Boost: Put Human Demon into play against you.
  //   ids: x.mephisto-nep.36.when-revealed, x.mephisto-nep.36.boost
  // ======== 37 Demonized (attachment, D9/12)
  // Demonized:
  //   Treat attached ally as a Mystic minion with a blank text box. Attached minion's SCH is equal to its printed THW, and it does not take consequential damage. It gains the toughness keyword and 1 acceleration icon ([acceleration]).
  //   When Revealed: Discard cards from the top of your deck until you discard an ally. Put that ally into play engaged with you with Demonized attached to it.
  //   ids: x.mephisto-nep.37.demonized-constant, x.mephisto-nep.37.when-revealed
  // ======== 38 Dark Lord's Tactics (side_scheme, D10/12)
  // Dark Lord's Tactics:
  //   Each Mystic minion gains guard and patrol.
  //   ids: x.mephisto-nep.38.dark-lords-tactics-constant
  // ======== 39 Hell's Legions (side_scheme, D11/12)
  // Hell's Legions:
  //   Assault.
  //   Each Mystic minion gains toughness.
  //   [star] Boost: Reveal this card.
  //   ids: x.mephisto-nep.39.hells-legions-constant, x.mephisto-nep.39.boost
  // ======== 40 Condemned Soul Portal (environment, D12/12)
  // Condemned Soul Portal:
  //   When Revealed: Discard a non-Elite minion in play. Otherwise, this card gains surge.
  //   Forced Response: After a printed non-Elite Mystic minion is defeated, shuffle that minion into the encounter deck.
  //   Hero Action: If there are no Mystic minions in play, spend 2 resources of any type → discard this card.
  //   ids: x.mephisto-nep.40.when-revealed, x.mephisto-nep.40.forced-response, x.mephisto-nep.40.hero-action
  // ======== 41 Lilith (minion, MoD1/5)
  // Lilith:
  //   Steady. Villainous.
  //   [star] Forced Response: After Lilith activates against you, if Call of the Demoness is in play, put the top card of your discard pile facedown engaged with you as a Mystic minion.
  //   ids: x.mephisto-nep.41.forced-response
  // ======== 42 Call of the Demoness (side_scheme, MoD2/5)
  // Call of the Demoness:
  //   This card cannot leave play while facedown Mystic minion is in play.
  //   Each facedown Mystic minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1.
  //   Forced Response: After the villain phase begins, the first players puts the top card of their discard pile into play facedown engaged with them as a Mystic minion.
  //   ids: x.mephisto-nep.42.call-of-the-demoness-constant, x.mephisto-nep.42.forced-response
  // ======== 43 Lilin Remaking (attachment, MoD3/5)
  // Lilin Remaking:
  //   Peril.
  //   When Revealed: You may attach this card to your identity. If you do not, discard this card and the villain activates against you.
  //   Treat your identity's printed text box as blank (except for Traits). You cannot attack Lilith and she cannot activate against you. You gain the Mystic trait, retaliate 2, and villainous.
  //   Response: After your turn begins, discard this card → find Lillith and reveal her. (If she is already in play, she engages you.) Lillith activates against you.
  //   ids: x.mephisto-nep.43.when-revealed, x.mephisto-nep.43.lilin-remaking-constant, x.mephisto-nep.43.response
  // ======== 44 Spawn Magic (treachery, MoD4/5, MoD5/5)
  // Spawn Magic:
  //   When Revealed: If Call of the Demoness is in play, put the top 2 cards of your discard pile into play each facedown and engaged with you as a Mystic minion. Otherwise, find Call of the Demoness and reveal it.
  //   [star] Boost: Resolve this card's "When Revealed" ability.
  //   ids: x.mephisto-nep.44.when-revealed, x.mephisto-nep.44.boost
});
