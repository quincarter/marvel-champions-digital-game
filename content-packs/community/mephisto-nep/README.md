# Mephisto (`mephisto-nep`)

A fan-made scenario pack by Neptune (Typhon00): a battle for your soul against Mephisto. One scenario (villain,
three-stage main scheme, its own encounter set), four modular encounter sets (Blackheart, Corruptive Offers, Damned,
Mother of Demons) and new art for the base game's Standard and Expert sets. See `CREDITS.md` and `PERMISSION.md`.

Status: step 1 of 2. The card data, encounter sets and scenario are transcribed and validate; **no ability is scripted**
(`abilities/index.ts` is a stub that lists every ability id with its printed text). `TRANSCRIPTION.md` lists what was
read by eye and is unconfirmed. The scripting agent starts from "Engine gaps" below.

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

1. **Hell Lord outside expert mode.** The insert says the Hell Lord is Mephisto's expert-mode attachment, but the card
   Mephisto (II) prints "When Revealed: Find and attach the Hell Lord attachment to Mephisto" and II is in both modes'
   villain decks, and 1A sets the Hell Lord aside in every mode. Transcribed as printed (so it is in play in standard
   mode once II is revealed). Ask the author whether standard mode should skip it.
2. **Acceleration counters on Hell.** "At the end of each round, place 1 acceleration token here" on Hell: it is not
   stated what an acceleration token on the environment does (the engine adds +1 threat to the main scheme per
   acceleration token on the main scheme at the villain phase; a token on a different card counts for nothing). Ask the
   author; the likeliest reading is that the main scheme's acceleration grows by one each round while Hell is revealed.
3. **"Insert says Hell Lord prevents his main scheme being thwarted by players with Bargain attachments"**: no card says
   this (Hell Lord only reduces damage and drives Damnation recovery). Not built.
4. **Corruptive Offers earlier draft.** The `Corruptive Offers.png` promo shows the attachments as "Bargain. Condition."
   with a "When Revealed: Choose:" and an Action "Exhaust your identity and set-aside X cards ... discard this card"; the
   cards in the pack folder are the current versions ("Peril." with Interrupt/Hero Response and a discard Response). The
   current cards are transcribed.
5. Printed typos kept word for word and flagged in `TRANSCRIPTION.md` (Lillith, "first players puts", "MYSIC", "scorned"
   vs "scored", Culling's "Forced Interrupt: After").

## Engine gaps (a first list for the scripting pass)

"Precedent" names a base card or an existing DSL builder (`packages/cards/src/dsl`) the script can follow. Anything
marked **GAP** has no builder or engine rule found. The DSL is very wide, so each line says what to check first.

1. **Damnation: a shared, per-owner, out-of-play pile of player cards (GAP).** Cards from a player's deck go in
   facedown ("Put N[per_hero] cards from the top of your deck facedown into Damnation"), are looked at and shuffled
   back into their owner's deck, the count is read ("10[per_hero] cards in Damnation", "for every 6 cards in
   Damnation", "looks at 1[per_hero] card"), and no player card can reach it. Nearest: `createScenarioArea` /
   `scenarioArea` / `scenarioAreaCount` (Museum, `wave3/gmw/museum.ts`), `seedHiddenPiles` / `dealHiddenPiles` /
   `revealHiddenPile` / `hiddenPileCount` (Baron Zemo, `wave9/aos/baron-zemo.ts`), `separateDeckCards` /
   `shuffleSeparateDeck`. None is an owner-tagged pile that returns cards to the owner's deck, and a pack scenario cannot
   declare `separateGameAreas`/`separateDecks` (`customScenarioProblems`).
2. **Redirecting "set aside from a player's deck" into Damnation (GAP).** Gateway/Hell: "Forced Interrupt: When a card
   is set aside from a player's deck, put it facedown into Damnation instead." No `on.` trigger for a set-aside event was
   found (`on.discardedFromEncounterDeck`, `on.aPlayerDiscardsFromTheirDeck` exist, not set aside). Used by the Hidden
   Clause too ("Corruptive Offers: set-aside X cards ... facedown").
3. **Named main scheme ability "Hidden Clause" resolved by other cards.** Precedent: `tagged` + `resolveTagged` /
   `resolveOneTagged`, `resolveSpecials` (Pterosaur 45128 resolves the Setting environment's "Special"). "For each Bargain
   attachment you control" is a loop over a count (`forEachCard` / `repeatTimes`). Stage-scaled amount: `mainSchemeStageNumber`
   - `perHero`.
4. **Hell environment flip from the main scheme (3A) and double-sided environment.** Precedent: `flipCard`, other
   double-sided environments (`flipSide` in aoa/aos data). Needs checking that `flipCard` takes an environment. Hell's
   acceleration tokens: `addAccelerationToken` exists for the main scheme; tokens "here" on an environment are a GAP
   (and the meaning is an open question, 2 above).
5. **Optional attach-on-reveal with a penalty (Bargain "When Revealed").** "You may attach this card to your identity. If
   you do not, discard this card and the villain activates against you." Precedent: `attachInstruction`, `attachCard`,
   `enemyActivates` (187 uses), `chooseOne`/`option`, `ifThen`. Peril is a keyword in data. Check `attachCard` to
   "your identity" with a decline branch.
6. **"After your turn begins" Response/Forced Response and "when the villain phase begins" Interrupt.** `on.yourTurnBegins`,
   `on.phaseBeginning` exist. A Response by the attachment's controller that discards itself as cost
   (`discardThis`) then `enemyActivates` Mephisto "against you" (`enemyActivates(theVillain, you)`).
7. **"Apply this card's boost icons ([boost]) for this activation as if it were a boost card" (GAP-ish).** Precedent:
   `applyAsBoostCard` (`wave4/mts/loki.ts`, `wave4/mts/thanos.ts`), `countBoostIcons`, `boostIconsOn`. The card applied is
   the discarded attachment, whose boost icons count (3). Needs confirming that `applyAsBoostCard` accepts a discarded
   attachment with no boost ability.
8. **Seven Bargain constant effects.** Endless Greed (+2 hand size: precedent "You get +1 hand size" cards use a
   hand-size modifier in `constant`; no `modifyHandSize` builder was found by name, check engine `handSize` rules);
   Gluttonous Restoration (Alter-Ego Interrupt on `on.basicRecovery`: "restore your identity to its printed hit point
   value", precedent `resetHitPoints`/`setRemainingHitPoints`, and a base resource whose text reads "ready your identity and
   restore it to its printed hit point value instead"); Lusting Existence (Action: exhaust an identity-specific card you control ->
   ready your identity; `exhaustCardsCost`, `ready`); Prideful Ambitions ("ignores the patrol keyword and any crisis
   icons" precedent `ignores`, Nebula kit / a thwart that "ignores the patrol keyword and any crisis icons"; "Double the
   THW value of your identity" is a GAP: no `doubleStat` builder, `modifyStat` with `statOf` as the delta may do it, check
   it applies to the printed/current value on a hero or alter-ego); Shackled Wrath (`attacksGainKeywords`, double ATK,
   same gap); Slothful Endurance ("cannot take damage less than its DEF from each attack": a damage floor, **GAP**;
   `maxDamageTaken` is a ceiling, `doubleDamageTaken` precedent Mojo; double DEF same as above); Unquenchable Envy ("Each
   resource you generate is considered a wild resource instead": **GAP**, nearest `consideredToHaveResourceIcon`,
   `printedResourcesOf`, `doublesResourcesGeneratedForThisCard`).
9. **Corruptive Offers counters.** "corrupt", "damned" and "scorned" counters: precedent `addCounters`, `countersOn`,
   `removeCounter`, `counterLimit` (all-purpose / named counters; check custom counter names are free text). Famished
   Power "combine the values of 2 basic powers of your hero for this use": **GAP** (precedent `modifyBasicPower`,
   `useThwInsteadOfAtk`, `basicPowerBy`: nothing adds two powers). Pestilent Nature "when a card you control leaves play ...
   shuffle that card into your deck instead": `replaceLeaveDestination` + `on.leavesPlay` (should exist). Deathless
   Persistence: interrupt on `on.defeated`/"would be defeated" + `heal` + `instead` (the `instead` pattern of the sample
   pack's Escapement Plating). Warring Rage: `on.defeats` after attack by hero.
10. **Demonized: an ally treated as a Mystic minion.** Precedent exists: `treatAttachedAllyAsMinion([trait], { schFromThw:
    "base" })` (Converted 60100 `wave11/fne/villains/purple-man.ts`; Beguiled, `wave4/mts/enchantress.ts`). Gaps: "SCH is
    equal to its printed THW" (printed vs base), "does not take consequential damage" (`preventConsequentialDamage`
    exists), "gains toughness and 1 acceleration icon" (`gainsKeyword`, `gainsIcon`), "with a blank text box"
    (`blanksTextBox`), and "put that ally into play engaged with you with Demonized attached" (`attachCard`+`engage`;
    `searchEncounterIntoPlayCost` is not relevant).
11. **Facedown Mystic minions from the discard pile (Lilith, Call of the Demoness, Spawn Magic) (GAP).** Precedent:
    `putIntoPlayFacedown(player, { kind: "minion", traits })` (Drone, `AS_DRONE`; Controlled minions,
    `wave9/aos/maria-hill/obligation-nemesis.ts`), but that takes the top card of the **deck**; these take the top card(s)
    of the **discard pile**, with "base SCH 1, base ATK 1, base hit points 1" set by a scenario rule on facedown Mystic
    minions engaged with a player, "cannot leave play while a facedown Mystic minion is in play" (`cannotLeavePlay`),
    and Condemned Soul Portal's "printed non-Elite Mystic minion" (a facedown card's printed traits).
12. **Lilin Remaking on an identity.** "Treat your identity's printed text box as blank (except for Traits)": `blanksTextBox`
    precedent (24 uses); "You gain the Mystic trait, retaliate 2, and villainous" (`gainsTrait`, `gainsKeywordX`,
    `gainsKeyword`) on an **identity** (a villainous player character attacking: GAP if the engine treats villainous only
    on encounter cards); "you cannot attack Lilith and she cannot activate against you" (`cannotActivate`, `cannotAttack`).
13. **Devil's Pacts (villain Forced Interrupt).** "When Mephisto would activate against you ... does not activate and
    heals N[per_hero] damage instead. If no damage was healed this way, place 1 threat on the main scheme for each
    Bargain attachment in play." `on.enemyActivating` + `instead(heal(...), ifThen(...))`; `heal` bound result
    (`bind: "healed"`, as the sample pack's Overwind). "No damage was healed" with Toughness-like readings: check.
14. **Hell Lord.** "Reduce the amount of damage Mephisto takes from identities by 1 for each Bargain attachment they
    control" (`reduceDamage` with a count and an "from identities" source filter, precedent Armored Rhino Suit is a
    replacement, not a reduction; `reducesAttackDamageTaken`, `takesDamageOnlyFrom`), and the Forced Response "after an
    identity with a Bargain attachment attacks Mephisto, for each Bargain attachment they control, look at 1 card in
    Damnation -> shuffle it back" (Damnation, gap 1).
15. **Main scheme stage 3B win condition.** "If there is no threat here, the players win the game." Precedent: `stateCheck`
    - `endGame` (Risky Business, Protection Racket), `completeMainScheme`. Stage 3A "flip Gateway to reveal Hell" is the
      stage's when revealed; Fiendish/Hellbound "search the encounter deck for a Bargain attachment and reveal it ... in
      player order" (`searchAndReveal`, `forEachPlayerInChosenOrder`/`forEachPlayer`).
16. **Scenario setup in a pack (PARTLY DONE).** The scenario record now carries `setAsideCardIds: ["x.mephisto-nep.04"]` (the Hell Lord, set aside out of play, taken out of the encounter deck), and the Gateway to Corruption has the Setup keyword and is in the Mephisto set, so the engine puts it into play at setup step 11 (RRG p. 51) with no ability. Still needs an ability: **create the "Damnation" game area** (the `02a.setup` ability, once the engine primitive lands).  Original note: `setup()`-style stage 1A script
    into play, create Damnation. A pack scenario record may only use the plain fields, so `setAsideCardIds`,
    `separateGameAreas` and startup environments are not available (sample pack README, "Known gaps"). Precedent for
    the scripts: `putIntoPlay`, `encounterSetAside`/`setAside`, `putIntoPlayFromSetAside` (20 uses), `createScenarioArea`.
17. **Per-stage pictures for pack villains and main schemes (client GAP).** See "Picture names": `packPictureCodes` returns
    the card's own code (and the `b` sibling for flip sides) so stage II/III of Mephisto and stages 2/3 of the main scheme
    show stage I / 1A's picture until `art-source.ts` maps stages to `01b`/`01c` and `02c`...`02f`.
18. **Smaller items.** Teamwork (MYSTIC) is a keyword in the schema (`teamwork` with `sharedTrait`); check the engine
    implements its trigger for minions (the AoA Dark Riders precedent in data). Hinder 2[per_hero] (`hinder` with
    `perPlayer`), Assault, Incite, Guard, Patrol, Steady, Stalwart, Toughness, Vulnerable, Retaliate and Villainous are
    keywords with engine support. "Mephisto attacks you with +X ATK", "schemes with +X SCH" (`modifyAttack`, a scheme
    equivalent: check), "Give him 2 additional boost cards" (`extraBoostCardsForVillain`), "This attack gains overkill and
    piercing" (`attacksGainKeywords`), a villain's "give him a tough status" (`giveTough`), "heal 3 damage from
    Blackheart" (Action on an encounter minion usable by a player: check precedent for an encounter card with a player
    `action`), Blackheart's Boost "cancel this activation" (`cancelIt`).
19. **Counters on enemy HP.** Demon Amalgam: "gets +1 hit point for each damned counter on it" (`modifyStat` HP with
    `countersOn`) and Vulnerable (Vulnerable is a keyword, a status-like rule).
