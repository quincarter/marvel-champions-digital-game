# Mephisto (`mephisto-nep`)

A fan-made scenario pack by Neptune (Typhon00): a battle for your soul against Mephisto. One scenario (villain,
three-stage main scheme, its own encounter set), four modular encounter sets (Blackheart, Corruptive Offers, Damned,
Mother of Demons) and new art for the base game's Standard and Expert sets. See `CREDITS.md` and `PERMISSION.md`.

Status: complete (step 2 of 2). The card data, encounter sets and scenario are transcribed, every ability is scripted in
`abilities/index.ts` and tested, and the pack plays standard and expert. `TRANSCRIPTION.md` lists what was read by eye
and is unconfirmed; "Rules readings and open questions" below lists the calls made and the engine gaps.

## Source layout

`pack.json`, `cards/*.json`, `encounter-sets/`, `scenarios/` and `abilities/index.ts` are in git. The pictures
(`cards/en/`, `alt-art/en/`) are not: `.gitignore` leaves them out, and they ship in the content repo's release bundles
(a `pack-art` bundle, to be made). For a local build, unzip the author's download and run
`sh fetch-art.sh "<path>/Mephisto/Mephisto"` (it calls `convert-art.cjs`: WebP, 900 px on the long side, quality 85,
landscape cards turned upright). The author distributes the pack in the community Discord; there is no public repository
to clone. Without the pictures `mc-pack build` fails on `altArt`; `mc-pack validate` does not need them.

### Picture names

Pictures are `cards/en/<card code>.webp`, one per printed face, the code's digits naming the card:

| Card                        | Pictures                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `01` Mephisto (villain)     | `01` stage I, `01b` stage II, `01c` stage III (the villain record has one code for three cards) |
| `02a` Battle for the Soul   | `02a`/`02b` stage 1A/1B, `02c`/`02d` 2A/2B, `02e`/`02f` 3A/3B                                   |
| `03a` Gateway to Corruption | `03a` Gateway to Corruption (7A), `03b` Hell (7B)                                               |
| every other card            | `<code>` (one picture; copies share it)                                                         |

Landscape cards (main schemes, side schemes) are 900 px wide; portrait cards 900 px tall. Neptune's PNGs store the
schemes rotated a quarter turn (as printed on the A4 sheets); `convert-art.cjs` turns them upright. The client picks
the picture per villain stage and main scheme stage and side by the sequential-letter convention in
docs/custom-content-packs.md section 5.1 (`art/art-source.ts` `packPictureCodes`), which these names already follow.

`alt-art/en/01186.webp` ... `01193.webp` are Neptune's new art for the base cards of the Standard (Advance, Assault,
Caught Off Guard, Gang-Up, Shadow of the Past: 01186-01190) and Expert (Exhaustion, Masterplan, Under Fire:
01191-01193) sets. The pack insert says these are "custom arts for the Standard and Expert sets": the text, stats and
boost icons on all eight are identical to the base cards (checked against `packages/content/src/data/core/cards.ts`),
so they are `altArt` for the base cards and **not** new sets. Only the flavor lines differ (the base cards quote
Red Skull, Venom and Klaw; these quote Mephisto, which is art, not data). Neptune's folder holds 10 pictures; the two
duplicates (Advance, Assault) are one picture each.

## Cards

| Set (encounter set id)                      | Records | Printed cards | Codes                             |
| ------------------------------------------- | ------- | ------------- | --------------------------------- |
| Mephisto (`mephisto-nep-mephisto`)          | 21      | 28            | `01`, `02a`, `03a`, `04` ... `21` |
| Blackheart (`mephisto-nep-blackheart`)      | 4       | 5             | `22` ... `25`                     |
| Corruptive Offers (`...-corruptive-offers`) | 5       | 6             | `26` ... `30`                     |
| Damned (`mephisto-nep-damned`)              | 10      | 12            | `31` ... `40`                     |
| Mother of Demons (`...-mother-of-demons`)   | 4       | 5             | `41` ... `44`                     |
| **Total**                                   | **44**  | **56**        | (+ 8 base-card alt-art pictures)  |

(The pack box says "70-card scenario pack": 56 printed cards, the 10 Standard/Expert cards and the four double-sided
cards' second faces come to 70.)

### Neptune's printed code to pack code

| Pack code | Printed                                  | Pack code | Printed                                       |
| --------- | ---------------------------------------- | --------- | --------------------------------------------- |
| `01`      | Mephisto (1/28) I, (2/28) II, (3/28) III | `26`      | Corruptive Offers (1/6) Deathless Persistence |
| `02a`     | (4/28) 1A/1B, (5/28) 2A/2B, (6/28) 3A/3B | `27`      | (2/6) Famished Power                          |
| `03a`     | (7/28) Gateway to Corruption / Hell      | `28`      | (3/6) Pestilent Nature                        |
| `04`      | (8/28) Hell Lord                         | `29`      | (4/6) Warring Rage                            |
| `05`-`11` | (9/28)-(15/28) the seven Bargain sins    | `30`      | (5/6), (6/6) Soul Gambling x2                 |
| `12`-`15` | (16/28)-(19/28) the four side schemes    | `31`      | Damned (1/12) Demon Amalgam                   |
| `16`      | (20/28) Alter the Deal                   | `32`      | (2/12) Demon Lieutenant                       |
| `17`      | (21/28), (22/28) Dark Compulsions x2     | `33`      | (3/12), (4/12) Demon Soldier x2               |
| `18`      | (23/28) Demonic Fury                     | `34`      | (5/12) Dweller Demon                          |
| `19`      | (24/28), (25/28) Infernal Temper x2      | `35`      | (6/12) Harmony Demon                          |
| `20`      | (26/28), (27/28) Meager Request x2       | `36`      | (7/12), (8/12) Human Demon x2                 |
| `21`      | (28/28) Rewrite History                  | `37`      | (9/12) Demonized                              |
| `22`      | Blackheart (1/5) Blackheart              | `38`      | (10/12) Dark Lord's Tactics                   |
| `23`      | (2/5) Prince's Offer                     | `39`      | (11/12) Hell's Legions                        |
| `24`      | (3/5) Black-Hearted                      | `40`      | (12/12) Condemned Soul Portal                 |
| `25`      | (4/5), (5/5) Sinful Ambitions x2         | `41`      | Mother of Demons (1/5) Lilith                 |
|           |                                          | `42`      | (2/5) Call of the Demoness                    |
|           |                                          | `43`      | (3/5) Lilin Remaking                          |
|           |                                          | `44`      | (4/5), (5/5) Spawn Magic x2                   |

The creator's own file codes (`(B01)`, `(CO05)`, `(D03)`, `(MoD04)`, `(S01)`, `(E01)`) and the printed "n/N" numbers
are kept in each record's `collectorNumber` ("B1/5", "CO5/6, CO6/6", "D3/12, D4/12"). Standard files `(S01)`-`(S07)`
and Expert files `(E01)`-`(E03)` are the alt-art above.

## The scenario (`scenarios/mephisto-nep-mephisto.json`)

From the insert ("Mephisto Scenario", front) and the stage 1A card, "Contents":

- **Villain deck:** Mephisto (I), Mephisto (II). Expert mode: remove Mephisto (I), add Mephisto (III) (so II, III):
  `villainStages: { standard: [1, 2], expert: [2, 3] }`.
- **Main scheme deck:** Battle for the Soul (1), Fiendish Investment (2), Hellbound Obsession (3), one record `02a`.
- **Encounter deck:** Mephisto, Blackheart, Damned, one modular set (Mother of Demons or Corruptive Offers recommended,
  "Corruptive Bargains" in the insert is a slip for Corruptive Offers), and the Standard set (the base `standard`, plus
  `expert` in expert mode; the Mephisto Standard/Expert art is the pack's `altArt`). Blackheart and Damned are written
  as ordinary modular sets (they also work in other scenarios) that this scenario always includes
  (`encounterSetIds`); `recommendedModularSetIds` is Mother of Demons then Corruptive Offers; `modularSetCount` is left
  at 1. "Mother of Demons and Corruptive Bargains modular sets can be removed from this scenario and/or added to other
  scenarios using the scenario customization rules."
- **Setup (stage 1A):** "Put the Hell Lord attachment aside, out of play. Put the Gateway to Corruption environment
  into play. Create the "Damnation" game area (see insert for details)." The Gateway environment has Setup and Permanent.
  The scenario record carries `setAsideCardIds` (Hell Lord) and the Gateway enters play through its Setup keyword, so only creating the Damnation game area is left for the `02a.setup` ability.
- **Villain phase / rounds:** as the base game. Stage 2A (Fiendish Investment) and 3A (Hellbound Obsession) are the
  entry text of the stage; 3A "flip the Gateway to Corruption environment to reveal the Hell environment".
- **Win/lose:** the players lose at the end of stage 3B ("If this stage is completed, the players lose the game"), or
  when Damnation holds 10 cards per hero. "If there is no threat here (stage 3B), the players win the game." (Stages 1B and
  2B print neither; the stage advances when its threat is completed, as in the base game.)

Stage threat (read from the cards, per hero): 1B target 6, starts 2; 2B target 9, starts 3; 3B target 18, starts 9;
+1 acceleration per hero on each. See TRANSCRIPTION.md for the reading of the start/acceleration box.

### What the extra pieces in Neptune's download are for

- `Mephisto - HP Counter.png`: a blank, Mephisto-art banner (a text frame with nothing printed) for making a printed
  hit point tracker; no rules content. Not used.
- `Mephisto Table.png`: a "Mephisto" title card/playmat background; no rules content. Not used.
- `Mephisto Scenario Pack - Front/Back.png`, `(Page Insert) ... Front/Back.png`: the box cover (with its "70-card
  scenario pack" blurb) and the two-sided rules insert. Transcribed below.
- `Printouts/`: the same cards as the pictures, 9 A4 sheets (3 x 3) and a PDF for printing, no extra rules text.
- `Corruptive Offers.png`: a promo montage of an **earlier draft** of the Corruptive Offers cards (see below).

## Rules transcription (the insert)

### Bargain attachments

"Mephisto uses the powerful Bargain attachments, cards an identity can choose to accept or decline when they are
revealed. Should a player accept one of these Bargain attachments, it attaches to their identity and grants them a
powerful ability they can use. Each Bargain attachment offers a different ability, with examples including doubling a
basic power, making resources generate wilds, or recovering your full hit points on a basic recovery.

Bargain attachments all share the peril keyword. There are 7 total Bargain attachments, each inspired by the infamous
seven deadly sins. Bargain can be discarded at the start of your turn, but by doing so Mephisto or the owner of the
Bargain attachment activates against you. Alongside this, while you have a Bargain attachment under your control, you
must resolve the "Hidden Clause" ability on the main scheme.

Blackheart and Lilith each have their own Bargain attachments, however they are not as powerful as those from Mephisto.
The Corruptive Offers modular also includes 4 more Bargain attachments you can include into any game as a modular set,
or into the Mephisto scenario alongside Lilith for an even more tempting game."

In data: `BARGAIN` is a trait on all 7 sins (05-11), Black-Hearted (24), the four Corruptive Offers attachments (26-29)
and Lilin Remaking (43). Every one is "Peril. When Revealed: You may attach this card to your identity. If you do not,
discard this card and (Mephisto | the villain) activates against you." and a Response "After your turn begins, discard
this card -> ... activates against you".

### Hidden Clause ability

"'Hidden Clause' is a special ability located on the main scheme. This ability resolves at the end of a player's turn if
they control a Bargain attachment, or if an encounter card is revealed that resolves this special. 'Hidden Clause' places
cards from the top of a player's deck into the Damnation area. The amount of cards is determined by the main scheme's
current stage number, alongside the number of players in the game."

So: stage 1B: 1 per hero cards; 2B: 2 per hero; 3B: 3 per hero ("Hidden Clause - Special: Put N[per_hero] card(s) from
the top of your deck facedown into Damnation"). Resolved by the Forced Response printed on each B side ("At the end of
your turn, resolve the "Hidden Clause" ability for each Bargain attachment you control": once per Bargain attachment)
and by encounter cards that say so (Alter the Deal, Dark Compulsions, Meager Request).

### Damnation

"Throughout the course of Mephisto's scenario, cards may be added to 'Damnation'. Damnation is an out of play area shared
by all player's and specific to this scenario. Cards in Damnation follow the standard rules for out-of-play cards and
cannot be looked at except by cards from the encounter deck. When creating space for the Damnation area, ensure that
the Damnation area is easily visible and reachable for all players, as each player may have to interact with the
Damnation area at multiple points during the scenario. Each player will create their own pile/deck when cards are sent
to Damnation, designated as their area where cards from their collection will be set-aside.

The Gateway to Corruption and Hell environment requires 10 cards per player in Damnation for the players to lose the
game. The Hell environment is revealed when the main scheme reaches stage 3. While the Hell environment is revealed, at
the end of each round, place 1 acceleration counter on it.

Cards can only be retrieved from Damnation from encounter cards in the scenario. If in expert mode, Mephisto uses the
unique Hell Lord attachment. This prevents him taking damage or his main scheme being thwarted by players with Bargain
attachments, but does allow cards to be recovered from Damnation when a player does either option."

Notes for scripting: each player's cards in Damnation are kept as that player's own pile (the cards go back to their
owner's deck when "looked at and shuffled back"). Cards in Damnation are facedown. A card "set aside from a player's
deck" (any effect, including Corruptive Offers' and Soul Gambling's) goes to Damnation instead.

### Blackheart and Lilith

Blackheart and Lilith "each have their own Bargain attachment ... to sway you to their side and oppose Mephisto's
desire for your soul. Their Bargain attachments will reveal these minions when discarded". Blackheart can discard
Bargain attachments or shuffle them back into the deck "in exchange for remaining in play"; his Bargain (Black-Hearted)
lets you manipulate the encounter deck at the start of the villain phase, provided it is the only Bargain attachment you
control. Lilith uses her magic to form an army of Mystic minions, converting cards in the discard pile into facedown
Mystic minions; her Bargain (Lilin Remaking) turns your identity into a Mystic character (villainous, retaliate 2) and
blanks your text box except for traits.

### Corruptive Offers

"As an additional option to play in this scenario or others, the Corruptive Offers modular provides new Bargain
attachments with effects that require placing a corrupt counter on them. Corrupt counters determine how many cards would
be set aside from the top of your deck when these Bargain attachments are removed or their signature treachery is
revealed. These effects are repeatable, but always require a corrupt counter be placed to perform them. Because they
also possess the Bargain trait, playing with them in Mephisto's scenario does trigger his 'Hidden Clause' ability on his
main schemes."

### Rules clarifications (the insert's Q and A)

- **Do I have to accept a Bargain attachment?** "All Bargain attachments possess the peril keyword and a choose option
  when they are revealed ... the choice to accept their offers or they will activate against you, scorned by your
  refusal. The choice always lies with you to accept or deny the Bargain attachment."
- **Does Mephisto still scheme or attack me while I have a Bargain attachment?** "When Mephisto activates against you
  while you have a Bargain attachment, he will instead heal by a set amount based off the number of players facing him.
  This is because Mephisto is not trying to defeat you, but rather corrupt you by stripping your deck down after you
  accept a Bargain attachment." (This is the card's Devil's Pacts: heal 1 / 2 / 3 per hero by stage.)
- **Why does he heal?** "He heals ... because at this point, he is not trying to hurt you, but rather to give you time to
  be corrupted by the Bargain attachment each round. If a Bargain attachment is under your control, you should consider
  discarding it as soon as possible as he may reveal additional encounter cards that can speed up this process."
- **Why play it?** Mephisto, Blackheart and Lilith "form a trio that is iconic among the Marvel Pantheon as demonic
  evils", with "a heavy usage of choice and player options during the villain phase".

## Rules readings and open questions (for the owner / the author)

Answered by default (the owner's calls for the first build; each can change without touching the card data):

1. **Hell Lord in every mode, as printed.** The insert calls it Mephisto's expert-mode attachment, but Mephisto (II)
   prints "When Revealed: Find and attach the Hell Lord attachment to Mephisto" and II is in both modes' villain decks.
   Built as printed: in standard mode it arrives when II is revealed; in expert mode II is the first stage, so Mephisto
   starts with it. (Ask the author whether standard mode should skip it.)
2. **The Hell Lord does not stop thwarts.** The insert says it "prevents ... his main scheme being thwarted by players
   with Bargain attachments", but no card text says so (the card only reduces damage and drives the Damnation
   recovery). Not built.
3. **"Look at N cards in Damnation" is a blind random pick** (`scenarioArea(..., { random })`): the cards are facedown
   and unidentified, so the player learns nothing and picks nothing. Aid the Condemned, Culling the Damned, Hotel Inferno
   ("up to 6" is always 6), Dark Compulsions (kept a "may") and the Hell Lord's Forced Response use it. **Exposing
   Intentions' When Defeated is the exception:** it says "looks at each card in Damnation, then shuffles 1[per_hero] card
   looked at this way", so the player is shown the area and picks (`chooseCards`); its "shuffle the Damnation area" has
   nothing to reorder (the area is facedown and picked by identity).
   3a. **The Gateway's redirect is only from a player's deck** ("when a card is set aside from a player's deck"):
   `setAsideDestination` has `from: ["deck"]`. A card set aside from a hand or discard pile stays in the set-aside area.
4. **Famished Power with Shackled Wrath: the sum, then the doubling** (RRG "Modifiers", p. 29: additions first, then
   multipliers). A Spider-Man attack of 2 + THW 1 becomes 6, not 5 (tested).
5. **Acceleration tokens on Hell.** "Place 1 acceleration token here" at the end of each round: RRG "Acceleration Token"
   (p. 5) has the tokens on any card in play add that much threat to the main scheme in step one of the villain phase, so
   each Hell token is +1 threat every round (tested: Hell holds a token after the round it is revealed).

Raised by the scripting pass (the author's or the owner's answer is wanted; the default is what is built):

6. **The Corruptive Offers' "Response: Discard this card -> set-aside X[per_hero] cards ..." has no triggering
   condition printed** (checked against the card picture). Built as the Bargain family's response (the insert: "Bargain
   can be discarded at the start of your turn"): after your turn begins. Alternatives: an Action. Recommended: keep the
   turn-start timing. The discard is the last effect rather than a cost, because a discarded card's counters are gone
   before X can be read.
7. **Culling the Damned: "Forced Interrupt: After a Mystic minion is defeated"** mixes the words. Built as a Forced
   Response ("after").
8. **Exposing Intentions: "Forced Interrupt: When a card is put into Damnation ... put 1 additional card".** The engine
   announces `cardPutIntoScenarioArea` once the card has moved, so it is heard as a Forced Response; the additional card
   does not chain. The outcome (1 extra card per card put in) is the same.
9. **"You control a Bargain attachment" is "is attached to your identity".** An encounter attachment is controlled by
   no player (RRG "Attachment", p. 8), so costs that discard "a card you control" cannot pick it: Blackheart's Action
   picks it as the cost (`chooseTargetCost`) and discards it as its first effect.
10. **Blackheart's Boost "cancel this activation"** (`cancelBoostedActivation`, since 1.0.1). Discarding a Bargain
    cancels the attack or scheme he is a boost card for, then he enters play engaged with you. The cancelled activation
    deals no damage and places no threat, the activation's other boost cards are discarded without being turned faceup,
    and no "after ... attacks / schemes / activates" response triggers (RRG 1.8 "Cancel", p. 11). Before 1.0.1 an attack
    was only answered by preventing its damage and a scheme was not stopped.
11. **Famished Power combines the used basic power with one other** (THW, ATK or DEF) chosen when it is triggered, the
    sum being +N to that use.
12. **Gluttonous Restoration's "may discard any number of status cards"** is a keep/discard prompt for each status the
    identity holds.
13. **Lilin Remaking, "she cannot activate against you"** is a Forced Interrupt of the attachment that cancels
    Lilith's activation when it is against the attachment's player (`x.mephisto-nep.43.lilin-remaking-forced-interrupt`,
    a new ability id on the card record), so she still activates against the other players. "You cannot attack
    Lilith" is a `cannotAttack` rule on the host. "Lillith" is Lilith.
14. **Condemned Soul Portal's "printed non-Elite Mystic minion"** is an encounter-controlled, faceup Mystic minion
    without the Elite trait: a facedown player card and an ally treated as a minion (Demonized) are not printed minions.
15. **Demonized has no data host.** Its record's `attachesTo: ally` is removed: its own When Revealed discards from the
    deck until an ally, puts that ally into play engaged with you and attaches itself. A deck with no ally leaves it
    unattached and discarded.
16. **The Bargain attachments have no data host either** (`attachesTo` removed from the 7 sins, Black-Hearted, the four
    Corruptive Offers and Lilin Remaking): the "you may attach" is the card's own When Revealed, a choice between
    attaching and "discard it and the villain activates against you".
17. **Soul Gambling's "Otherwise, this card gains surge"** is read as: no Bargain attachment in play holds a corrupt
    counter. Its Boost places a corrupt counter on any Bargain attachment you control, whatever its set.

## Scripting notes

All 108 ability ids are scripted in `abilities/index.ts` (the 107 of the stub plus
`x.mephisto-nep.43.lilin-remaking-forced-interrupt`); there is no bespoke engine code for a card. The Damnation
machinery uses the engine primitives added for this pack (`engine-only-features.ts` shows each):

- Damnation: `createScenarioArea` in 1A's Setup; `moveCards(..., { scenarioArea }, undefined, { facedown: true })`;
  `scenarioArea(name, filter, { random })` and `scenarioAreaCount`; `setAsideDestination` on both faces of the Gateway;
  `on.cardPutIntoScenarioArea`. The 10[per_hero] loss and the stage 3B win are `stateCheck` + `endGame`.
- Hidden Clause: `tagged("hiddenClause", ...)` on each B stage, resolved by `resolveTagged` from the turn-end Forced
  Response (once per Bargain attachment) and from Alter the Deal, Dark Compulsions and Meager Request.
- Bargain Response: `enemyActivates(theVillain, { against: you, boostCards: self })`; the sins' constants:
  `multiplyStat`/`doubleStat`, `minDamageTaken`, `resourcesGeneratedAsWild`, `gets("handSize")`, `ignores`.
- Lilith's and Call of the Demoness's facedown Mystic minions: `putIntoPlayFacedown(..., { from: "discard" })` and
  `gets(..., { setBase: true })` (1 SCH, 1 ATK, 1 hit point), as Ultron's Drones.

### What is not exact (engine gaps, for `game-rules-architect`)

- **"Discard this card ->" cannot read the card's own counters afterwards**, and an encounter attachment cannot pay a
  "you control" discard cost, so two costs are written as effects (the Corruptive Offers' Response, Blackheart's
  Action). The player-visible result is the same.
- **Hell Lord's stopping thwarts** (the insert) has no card text and is not built.

## Tests

`packages/mod-sdk/src/mephisto-nep.test.ts`: setup (Gateway in play, Hell Lord set aside, Damnation created and empty);
a Bargain accepted and refused; Hidden Clause at the end of the turn per Bargain (and 3 per hero on stage 3B); Devil's
Pacts (heal, or threat when there is nothing to heal); the Damnation loss at 10 per hero (1 and 2 heroes); Gateway's
set-aside redirect; stage 3B win and loss; Fiendish Investment; Gateway to Hell with its acceleration token; Slothful
Endurance's floor; Famished Power with and without Shackled Wrath; the facedown Mystic minions (1/1/1, Spawn Magic);
Hell Lord's damage reduction and recovery; Alter the Deal, Dark Compulsions, Hotel Inferno, Culling the Damned, Exposing
Intentions; Blackheart's Action and Boost (an attack and a scheme cancelled, and declined); Lilin Remaking; the turn-start Responses; Deathless Persistence; Demon
Amalgam; Demonized; Lusting Existence; Condemned Soul Portal; and every encounter card revealed in hero and alter-ego
form with and without a Bargain attachment. `mc-pack test` plays the scenario (standard and expert) and every modular set.
