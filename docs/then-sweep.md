# "Then" sweep: cards still to move to `andThen`

**Status (2026-09-26): not started.** This is the follow-up [PR #61](https://github.com/quincarter/marvel-champions-digital-game/pull/61) left open. Do it as its own PR, one pack at a time, with `ability-scripting-engineer`.

## The rule and what the engine already does

RRG 1.8 "'Then'" (p. 44): if the text before "then" does not fully resolve, the text after it does not attempt to resolve. `f83d3218` (#61) added the machinery:

- **Engine:** `EffectSpec { kind: "then", effects }`. A required choice that finds nothing marks the frame (`_then.unresolved`) and logs `choiceFoundNothing`. A later `then` in the same program is skipped and logs `thenSkipped`. A required choice is a `chooseTarget` with a fixed count that isn't `upTo`/`optional`, or a `chooseCards` with `min` ≥ 1 that doesn't read a deck. See `packages/engine/src/resolve/target-validity.ts`, `packages/engine/src/resolve/effects-frame.ts` and `packages/engine/src/choose-no-target.test.ts`.
- **DSL:** `andThen(...effects)` in `packages/cards/src/dsl/effects.ts`.
- **Initiation:** post-"then" text is not a separate part of the ability, so a player ability whose only real part is a failed choice can't be played (RRG 1.8 "Choose (Game Element)", p. 12). Plain "and", or a new sentence, is not a "then". Sanctum Sanctorum's "and draw 1 card" still draws with no Spell to choose.
- **Done:** Quinjet (03019), Aamir Khan (05006), Tinkering (16029b). Design notes: `docs/phase7-wave3.md` §4 Q19 and PLAN.md.

## What to do per card

1. Read the printed text (current errata) and find the "then".
2. Put the post-"then" effects in `andThen(...)`. That is always the faithful reading, even where it changes nothing today.
3. Check what can make the pre-"then" text not fully resolve. The engine only marks it unresolved when a **required choice finds nothing**. Other ways it can fail aren't modeled yet:
   - a search or "discard until" that finds nothing (Call for Aid, Masters of Mayhem, Planetary Invasion);
   - a cancel with nothing to cancel;
   - "the villain attacks you" when no attack happens (Held Hostage);
   - a threshold "if" (Badoon Ship, Island of Dr. Zola).

   If a card needs one of these, ask `game-rules-architect` for the primitive rather than working around it, and note it here.

4. Write a test: the "then" part is skipped when the pre-"then" text fails, and runs when it succeeds.
5. Run the e2e seeds before and after, and record any seed that plays differently (the §4 Q19 pattern).
6. One commit per pack, with a `changie new -k Content` fragment. No attribution trailer.

## Checklist

63 scripted cards print "then", matched case-insensitively on the card's current text in `packages/content/src/data/*/cards.ts`, limited to cards with at least one ability id in `packages/cards/src`. A few are lowercase "then" inside a sentence ("…, then draw 1 card"). RRG p. 44 treats those the same way, but check each one.

### Player cards (27)

| Done | Pack   | Card   | Name                      | Type          | Where the "then" is                                                                                                                                                                                           |
| ---- | ------ | ------ | ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]  | `ant`  | 12015  | Call for Aid              | event         | …rom the top of your deck until you discard an Avenger ally, then add that ally to your hand.…                                                                                                                |
| [ ]  | `bkw`  | 08018  | Spycraft                  | upgrade       | …Spycraft → cancel the effects of that card and discard it. Then, reveal another card from the encounter…                                                                                                     |
| N/A  | `cap`  | 03006  | Shield Toss               | event         | …Hero Action (attack): Discard X cards from your hand, then return Captain America's Shield from pla…. N/A: "then" sits between two cost components before the "→", not in the effect text RRG p. 44 governs. |
| [x]  | `cap`  | 03008  | Captain America's Helmet  | upgrade       | …ica would be defeated, set his hit point dial to 1 instead. Then, discard this card.…                                                                                                                        |
| [x]  | `cap`  | 03019  | Quinjet                   | support       | …ual to or less than the number of time counters on Quinjet. Then, discard Quinjet.…                                                                                                                          |
| [x]  | `core` | 01009  | Webbed Up                 | upgrade       | …hen attached enemy would attack, discard Webbed Up instead. Then, stun that enemy.…                                                                                                                          |
| [x]  | `core` | 01012  | Crisis Interdiction       | event         | …Hero Action (thwart): Remove 2 threat from a scheme. Then, if you have the Aerial trait, remove 2…                                                                                                           |
| [x]  | `core` | 01025  | Split Personality         | event         | …Action: Change your form (flip your identity card). Then, draw up to your printed hand size.…                                                                                                                |
| [ ]  | `core` | 01075  | Black Widow               | ally          | …resource → cancel the effects of that card and discard it. Then, reveal another card from the encounter…                                                                                                     |
| [ ]  | `drax` | 19020  | Gamora                    | ally          | …cards from the top of your deck until you discard an event, then add that card to your hand.…                                                                                                                |
| [ ]  | `drs`  | 09005  | Master of the Mystic Arts | event         | …d of the Invocation deck → resolve its "Special" ability. Then, place it back on top of the Invocation…                                                                                                      |
| [ ]  | `gmw`  | 16150  | Brainstorm                | event         | …Unit Cost 1. Hero Action (thwart): Name a card type, then look at the top card of your deck. If th … scheme. Place that card on the top or bottom of your deck, then draw 1 card.…                           |
| [ ]  | `gmw`  | 16154  | Calculate the Odds        | event         | …aw 1 card and choose a player. That player may draw 1 card, then choose and discard 1 card from their han…                                                                                                   |
| [ ]  | `gmw`  | 16158  | Close Call                | event         | …d's "Boost" ability and all of its boost icons ([boost]), then discard it. Draw 1 card.…                                                                                                                     |
| [ ]  | `gmw`  | 16161  | Take the Fight to Them    | event         | …] cards of the encounter deck. Discard any number of those, then place the rest on the top and/or bottom…                                                                                                    |
| [ ]  | `msm`  | 05001a | Ms. Marvel                | hero_identity | …m the top of your deck until you discard a Ms. Marvel card, then add that card to your hand. (Limit once…                                                                                                    |
| [x]  | `msm`  | 05006  | Aamir Khan                | support       | …e 1 card from your discard pile on the bottom of your deck, then draw 1 card.…                                                                                                                               |
| [ ]  | `msm`  | 05014  | Preemptive Strike         | event         | …ain attacks, cancel all boost icons ([boost]) on that card. Then deal 1 damage to the villain for each bo…                                                                                                   |
| [ ]  | `mts`  | 21036  | Cosmic Ward               | upgrade       | …card, cancel its "When Revealed" effects and discard it. Then, discard Cosmic Ward…                                                                                                                          |
| [ ]  | `nebu` | 22001a | Nebula                    | hero_identity | …"Special" ability on each technique upgrade you control, then discard each technique upgrade resolved…                                                                                                       |
| [ ]  | `nebu` | 22002  | Gamora                    | ally          | …er you play Gamora, choose a technique upgrade you control, then resolve its "Special" ability.…                                                                                                             |
| [ ]  | `nebu` | 22009  | Combat Ready              | event         | …ou discard a technique upgrade. Put that upgrade into play, then resolve its "Special" ability.…                                                                                                             |
| [ ]  | `nebu` | 22020  | Cosmo                     | ally          | …Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or…                                                                                                   |
| [ ]  | `qsv`  | 14018  | Order and Chaos           | event         | …m the encounter deck, cancel its "When Revealed" effects, then deal 2 damage to the villain.…                                                                                                                |
| [ ]  | `scw`  | 15018  | Order and Chaos           | event         | …m the encounter deck, cancel its "When Revealed" effects, then deal 2 damage to the villain.…                                                                                                                |
| [ ]  | `stld` | 17020  | Cosmo                     | ally          | …Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or…                                                                                                   |
| [ ]  | `vnm`  | 20001a | Venom                     | hero_identity | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                              |

### Encounter cards (36)

| Done | Pack    | Card   | Name                   | Type        | Where the "then" is                                                                                                                                                                                   |
| ---- | ------- | ------ | ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ ]  | `core`  | 01098  | Armored Rhino Suit     | attachment  | …t of damage would be dealt to Rhino, place it here instead. Then, if there is at least 5 damage here, dis…                                                                                           |
| [ ]  | `core`  | 01133  | Masters of Mayhem      | treachery   | …sters of Evil minion and put it into play engaged with you, then shuffle the encounter deck.…                                                                                                        |
| [x]  | `core`  | 01159  | Ritual Combat          | treachery   | …When Revealed: Discard the top card of the encounter deck. Then, choose to either deal X damage to your…                                                                                             |
| [ ]  | `core`  | 01180  | Legions of Hydra       | side_scheme | …le for Madame Hydra and put her into play engaged with you, then shuffle the encounter deck. Place 2 addi…                                                                                           |
| [ ]  | `core`  | 01183  | The Doomsday Chair     | side_scheme | …pile for M.O.D.O.K. and put him into play engaged with you, then shuffle the encounter deck.…                                                                                                        |
| [x]  | `core`  | 01185  | Biomechanical Upgrades | attachment  | …minion would be defeated, heal all damage from it instead, then discard this card.…                                                                                                                  |
| [ ]  | `drs`   | 09030  | Counterspell           | attachment  | …When you play an event, cancel its effects and discard it. Then, discard this card.…                                                                                                                 |
| [ ]  | `gmw`   | 16057  | Planetary Invasion     | treachery   | …ounter deck until you discard a minion. Reveal that minion, then give it a tough status card.…                                                                                                       |
| [ ]  | `gmw`   | 16063  | Badoon Ship            | environment | …Charge Up — Special: Place 1 barrage counter here. Then, if there are 4 or more barrage counters…                                                                                                    |
| [ ]  | `gmw`   | 16070  | Collector              | villain     | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `gmw`   | 16074  | Biogram Image          | attachment  | …rd faceup into The Collection → prevent all of that damage, then place threat on the main scheme equal to…                                                                                           |
| [ ]  | `gmw`   | 16077  | View the Cosmos        | treachery   | …Collection. - Discard the highest cost card from your hand, then place threat on the main scheme equal to…                                                                                           |
| [ ]  | `gmw`   | 16080a | Collector              | villain     | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `gmw`   | 16081a | Collector              | villain     | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `gmw`   | 16088  | Nebula                 | villain     | …e "Special" ability on each Technique attachment in play, then discard each of those attachments. / The…                                                                                             |
| [ ]  | `gmw`   | 16091a | The Art of Evasion     | main_scheme | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `gmw`   | 16101  | Combat Ready           | treachery   | …ntil a Technique attachment is discarded. Reveal that card, then resolve its "Special" ability.…                                                                                                     |
| [ ]  | `gmw`   | 16125  | The Poison             | attachment  | …errupt: When your turn begins, place 1 poison counter here, then take 1 damage for each poison counter he…                                                                                           |
| [ ]  | `gmw`   | 16141  | Honor Among Thieves    | treachery   | …k until a Criminal minion is discarded. Reveal that minion, then give that minion a tough status card and…                                                                                           |
| [ ]  | `gob`   | 02004a | Hostile Takeover       | main_scheme | …: Place 1[per_hero] infamy counters on Criminal Enterprise. Then discard 1 card from each player's deck f…                                                                                           |
| [ ]  | `hood`  | 24001  | The Hood               | villain     | …vealed: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Foul…                                                                                           |
| [ ]  | `hood`  | 24004a | Making Connections     | main_scheme | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `hood`  | 24012  | Field Recruitment      | treachery   | …vealed: Choose 1 set-aside modular encounter set at random, then shuffle it into the encounter deck. Reso…                                                                                           |
| [ ]  | `hood`  | 24036  | Hyde Formula           | treachery   | …evealed: If Calvin Zabo is in play, he schemes with +3 SCH, then he takes 4 damage. If Mister Hyde is in…                                                                                            |
| [ ]  | `mts`   | 21098a | Under Siege            | main_scheme | …e completed, remove all the threat from this stage instead. Then, deal 6[per_hero] damage to Avengers Tow…                                                                                           |
| [ ]  | `mts`   | 21100a | Avengers Tower         | environment | …here is at least 9[per_hero] damage here, remove all of it. Then flip Avengers Tower over. / When Reveale…                                                                                           |
| [ ]  | `toafk` | 11007a | Kang's Arrival         | main_scheme | …(the "then" is on a face or ability the parser did not capture; read the card)…                                                                                                                      |
| [ ]  | `toafk` | 11021  | Time-Travel Hijinks    | obligation  | …When Revealed: Discard the highest-cost card you control, then place it facedown under this card. Alter…                                                                                             |
| [ ]  | `trors` | 04104  | Photographic Reflexes  | attachment  | …n equal amount of damage to that player's identity instead. Then, discard Photographic Reflexes. (Max onc…                                                                                           |
| [ ]  | `trors` | 04112a | The Island of Dr. Zola | main_scheme | …g step one of the villain phase, place 1 test counter here. Then, if there are 3 or more test counters he…                                                                                           |
| [ ]  | `trors` | 04134  | Master Strategist      | attachment  | …him an additional boost card for each side scheme in play. Then, discard this card. (Max once per activa…                                                                                            |
| [ ]  | `twc`   | 07005  | Held Hostage           | attachment  | …lain corresponding to the attached side scheme attacks you. Then discard this card.…                                                                                                                 |
| [ ]  | `twc`   | 07012  | Crowbar Toss           | treachery   | …When Revealed (Alter-Ego): Wrecker schemes. Then, move the active villain counter to the … he least threat. When Revealed (Hero): Wrecker attacks you. Then, move the active villain counter to the… |
| [ ]  | `twc`   | 07021  | Held Hostage           | attachment  | …lain corresponding to the attached side scheme attacks you. Then, discard this card.…                                                                                                                |
| [ ]  | `twc`   | 07036  | Held Hostage           | attachment  | …lain corresponding to the attached side scheme attacks you. Then, discard this card.…                                                                                                                |
| [ ]  | `twc`   | 07050  | Held Hostage           | attachment  | …lain corresponding to the attached side scheme attacks you. Then, discard this card.…                                                                                                                |

The villain entries (Collector, Nebula, The Hood, Venom), and main schemes with no snippet, have their "then" on a stage or face this list's parser didn't capture. Read the whole card.

## Background: the shape survey from #61

The agent that built `andThen` also ran a code-shape survey: player abilities that open with a required choice followed by effects that don't read the chosen slot. It found 46, plus 30 where the choice comes later. It only checked code structure, so most of those have no printed "then". Of the 46, only Crisis Interdiction (01012), Quinjet and Aamir Khan print one, and all three are in the checklist above. The rest (Photonic Blast, Melee, Save the Day, Cosmic Alliance, …) are governed by the "any part of the ability" rule (RRG p. 12), which #61 already implements, so they don't need `andThen`. The survey is not the to-do list; the checklist is.
