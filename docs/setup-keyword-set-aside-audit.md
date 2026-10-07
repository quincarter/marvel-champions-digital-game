# Setup-keyword cards in the set-aside area: audit (Q20 = B)

**Rule.** RRG 1.8 Appendix II step 11 (p. 51): "Search each deck and the set aside area for any cards with the setup
keyword and put them into play." "Setup (Keyword)" (p. 40): "A card with the setup keyword begins the game in play."
"Set Aside" (p. 39): set-aside cards "have no interaction with the game until they are referenced by instructions
within the scenario or by a card ability." Owner decision (docs/phase7-wave7.md §4.1 Q20 = B): step 11 as written, with
Mister Sinister exempted by a scenario rule (MC40 p. 16).

**Method.** A script built every record of `PLAYABLE_SCENARIO_RECORDS` (all waves) through `playableScenario`, in
standard and expert, at one and two players, with a fixed seed, and listed every card the config sets aside
(`setAside`, `setAsideModularSets`, `setAsideVillainCardIds`, signature side schemes) whose data has the setup or
permanent keyword, and where each such card is once setup has run. The Hood was also built with each setup-bearing
modular set among its seven set-aside sets. Every campaign's `setAsideCards` op and every set a campaign composes
into the set-aside area (`composeEncounterSets` `into: "setAside"`) was read from `CAMPAIGNS` and its cards checked.
Players' own set-aside areas (nemesis sets, permanent player cards) were listed too. The first pass missed the
composed campaign sets; the cards suite caught it (the Norn Stone row), and the second pass covers them.

Categories: **(a)** enters play at step 11 under Q20 = B and did not; **(b)** set aside by printed text that names when
the card comes in (exempt by that scenario's own text); **(c)** unclear, needs the owner.

## Set-aside cards with the setup keyword

| Scenario (standard and expert)                                                                                      | Card                                                                                        | Why it is set aside (printed)                                                                                                                                                                                                                                                             | Verdict                                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Brotherhood of Badoon                                                                                               | Milano 16142 (Permanent. Setup.)                                                            | Not printed. 16061a: "Setup: Put the Badoon Ship environment and the Milano support into play." The builder parks it aside because a player-typed support is in no deck.                                                                                                                  | **(a)** enters at step 11 instead of at step 12a |
| Nebula                                                                                                              | Milano 16142                                                                                | Not printed. 1A: "Setup: Put the Nebula's Ship environment and the Milano support into play. …"                                                                                                                                                                                           | **(a)** same                                     |
| Ronan the Accuser                                                                                                   | Milano 16142                                                                                | Not printed. 1A: "Setup: Put the Kree Command Ship environment and the Milano support into play. …"                                                                                                                                                                                       | **(a)** same                                     |
| Escape the Museum                                                                                                   | Milano 16142                                                                                | 16082a: "Setup: … Set aside the Ship Command modular encounter set." 16083a: "When Revealed: Put the set-aside Milano support from the Ship Command encounter set into play under the first player's control."                                                                            | **(b)**                                          |
| Mister Sinister                                                                                                     | Flight 40151, Super Strength 40155, Telepathy 40159 (Permanent. Setup.)                     | 40139a: "Setup: Set aside the Flight, Super Strength, and Telepathy encounter sets." MC40 p. 16: "The setup keyword on the Flight, Super Strength, and Telepathy attachments is ignored in this scenario because these cards are set aside during setup." Each stage 2B attaches its own. | **(b)**                                          |
| The Mad Titan's Shadow campaign, all five scenarios                                                                 | Norn Stone 21187a (Permanent. Setup.), the supply copies in the composed `mts_campaign` set | Not printed: the campaign composes its box's cards aside so text can find them. 21186a: "When Defeated: Each player puts a copy of the Norn Stone upgrade into play under their control on its setup side."                                                                               | **(b)** campaign supply                          |
| The Hood, only when a set-aside pick is the Power Stone, Infinity Gauntlet, Flight, Super Strength or Telepathy set | Power Stone 16149, Infinity Gauntlet 21129, Flight, Super Strength, Telepathy               | 1A: "Setup: Choose 7 modular encounter sets and set them aside (you may choose randomly). Choose 1 of those sets at random, then shuffle it into the encounter deck." Later stages shuffle in another.                                                                                    | **(c)**                                          |

Counts: **(a) 3** scenarios (one card), **(b) 2** scenarios and 1 campaign (five cards), **(c) 1** scenario (five
possible cards).

### (a): what changes

The Milano is in play before the first turn either way; under Q20 = B the keyword puts it there at step 11 and the 1A
Setup text's "and the Milano support" finds it already in play. Same controller (the first player), same owner, same
board once setup ends: no change in difficulty. The trace differs (the Milano's entry now precedes the ship
environment's). These three scenarios never needed an instruction to set the Milano aside; it was a builder convention.

### (c): for the owner

**The Hood with a setup-bearing set among the seven.** Step 11 as written would put the set's setup card into play
while the rest of its set waits aside, possibly for the whole game. The printed Setup sets the sets aside as wholes
and names how each comes in (a random one is shuffled in), which reads like (b), but no rulebook line speaks to a
setup keyword there as MC40 p. 16 does for Mister Sinister. Note MC40's stated reason ("because these cards are set
aside during setup") supports the same reading here.

- **Recommended default (built, behavior unchanged):** the card stays aside with its set and is shuffled into the
  encounter deck with it, then enters play when revealed.
- Alternative 1: step 11 puts it into play at once (the Power Stone would attach during setup with its set unused).
- Alternative 2: it stays aside and enters play, not the deck, when its set is shuffled in.

## Set-aside cards with Permanent only (not reached by step 11)

Permanent cards "are put into play later by abilities on other cards" (RRG p. 32); none of these has the setup keyword.

| Scenario         | Card                       | Brought in by                                       |
| ---------------- | -------------------------- | --------------------------------------------------- |
| Tower Defense    | Focused Defense 21101      | the main scheme's setup text                        |
| The Sinister Six | Light at the End 27102a    | the main scheme's setup text                        |
| On the Run       | Hope's Captor 40105a       | 1A Setup, attached to the villain it puts into play |
| Juggernaut       | Juggernaut's Helmet 40122a | 1A Setup                                            |
| Stryfe           | Stryfe's Grasp 40168a      | 1A Setup                                            |

## Checked and clear

- **Setup-keyword cards that start in a deck** (already swept): Power Stone (Nebula, Ronan), Infinity Gauntlet (Thanos,
  Loki), Hope Summers (Juggernaut, Mister Sinister, Stryfe), Formidable Foe (Standard II), and the Milano or a
  Superpower attachment when its set is an ordinary modular pick (`modularSetupCardIds`).
- **MojoMania** (Mojo's set-aside genre sets): the pool is restricted to six sets, none with a setup card.
- **Campaigns:** of the sixteen sets the campaigns compose aside, only `mts_campaign` holds a setup-keyword card (the
  Norn Stone, above). No `setAsideCards` op names a setup-keyword card (Sinister Motives: Helicarrier, Symbiote Suit,
  Venom; Mutant Genesis: role upgrades, Jubilee, the captives; NeXt Evolution: the player side schemes, Safehouse,
  Pouches, recorded encounter cards and environments). The campaign "Permanent. Setup." upgrades (MC10, MC21, MC27)
  are player cards in a player's own set-aside area, swept there already (docs/phase7-wave6.md §3.74). Campaign games
  of the scenarios above go through the same builders and get the same verdicts.
- **Players' set-aside areas:** no nemesis set holds a setup-keyword card.
- **Dreadpool's set-aside remainder, linked cards, set-aside villains, signature side schemes:** no setup keyword.

## Built

`GameSetupConfig.setAsideUntilCalled` (`{ cardIds?, encounterSetIds? }`, kept in `ScenarioRules`): step 11 leaves
those cards aside. Set by the scenario builders for Escape the Museum (Ship Command), Mister Sinister (the three
Superpower sets), The Hood and Mojo (their set-aside modular sets; The Hood pending the owner). A campaign-specific
card in the encounter set-aside area is the campaign's supply and is never taken, as an engine rule, because every
caller composes a campaign game's set-aside cards itself. Everything else in the encounter set-aside area with the
setup keyword now enters play at step 11.
