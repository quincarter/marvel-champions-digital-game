# Phase 7 working spec: wave 6 (cycle 6, Mutant Genesis)

This is the shared brief for every agent working Phase 7's sixth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3) and open questions with proposed defaults (§4). The model is
`docs/phase7-wave5.md`; wave 1–5 §3 primitives are assumed. The definition of done is
`docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision here, update this
file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 6** is our `cycleId("cycle6")`. It is written in passes so each stays small:

| Pass  | Scope                                                                                        | State             |
| ----- | -------------------------------------------------------------------------------------------- | ----------------- |
| **1** | **Mutant Genesis box (`mut_gen`, MC32): Colossus, Shadowcat, five scenarios, MC32 campaign** | **this document** |
| 2a    | Hero packs: Cyclops, Phoenix, Wolverine (§6, §3.26–§3.44, §4 Q16–Q25)                        | this document     |
| 2b    | Hero packs: Storm, Gambit, Rogue                                                             | placeholder (§6)  |
| 3     | MojoMania scenario pack (`mojo`)                                                             | placeholder (§7)  |

- **The box's content** (MC32 p. 2): Colossus / Piotr Rasputin (32001a/b) and Shadowcat / Kitty Pryde (32030a/b), five
  scenarios (Sabretooth, Project Wideawake, Master Mold, Mansion Attack, Magneto), modular sets Brotherhood, Mystique,
  Sentinels, Zero Tolerance, Acolytes and Future Past, the campaign cards 171–175 (double-sided encounter cards) and
  176–195 (the four role sets, five upgrades each). 273 cards; MarvelCDB has 208 records (a/b faces nested).
- **Cycle id.** `mut_gen` joins the six emitted packs under `{ id: "cycle6" }`; the label "Mutant Genesis" is the
  data survey's step 9. **RRG 1.8 Appendix VI (p. 71) does not list MojoMania in wave 6:** checked against the PDF,
  item 6 reads "The _Mutant Genesis_ campaign expansion, the _Cyclops Hero Pack_, the _Phoenix Hero Pack_, the
  _Wolverine Hero Pack_, the _Storm Hero Pack_, the _Gambit Hero Pack_, and the _Rogue Hero Pack_." Appendix VI lists
  no scenario pack in any wave (it is the Limited Environment list), so MojoMania's place in cycle 6 is MarvelCDB's
  `pack_wave`, not the RRG. `docs/phase7-wave6-sources.md` §1 quotes the item with Mojo Mania in it; that quote is wrong.

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The Mutant Genesis rulebook, `docs/campaign-modes/mc32_mutant_genesis_rulebook_v5-compressed.pdf`, converted in
     `docs/campaign-modes/markdown/mc32_mutant_genesis.md`, cited as "MC32 p. N" (PDF page = printed page). The
     conversion jumbles the Setup/Victory order on pp. 10 and 16; both pages were re-read from the PDF text layer
     (2026-10-01). Neither the PDF nor the markdown prints a prohibited-card list (searched every page).
   - Card text: `packages/content/raw/marvelcdb/mut_gen.json` (208 records, 29 with a nested `linked_card` b face),
     every record read for this spec. Not an authority on its own. Scans read where the raw text was in doubt
     (`assets/card-art/bundles/cards/`, gitignored, never committed): 32153 (Electromagnetic Blast), 32172b (Magneto
     ally), 32174b (Reactivate Defenses), 32175a/b (Magneto's Fortress / Magneto's Power). Findings in §1.9.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading.
   None names a Mutant Genesis card except through the RRG FAQ; the ones this pass leans on:
   - Jan 17, 2026 (3): keywords (piercing) have timing priority over triggered abilities; "prevent" prevents damage
     taken, not dealt (Colossus's tough cards, Phased).
   - Jan 26, 2026 (3): Nimrod, excess damage dealt versus overkill taken (§3.4).
   - Jan 26, 2026 (4) #3 (cards dealt simultaneously go AABB, first player orders) and #5 (Operation Zero Tolerance has
     no special interaction with facedown Drones).
   - Jan 26, 2026 (6) #2: limits stay with the card across form flips (Phase Control's once per round).
   - Feb 28, 2026 (4) #2: quickstrike resolves before When Revealed (the teamwork question, §4 Q2).
   - Jun 2, 2026 (3) #1: GMW's expert rejoin is free (contrast for MC32, §4 Q11).
   - Jun 25, 2026 (4) #5: characters not under player control are not friendly (Robert Kelly while attached).
   - Jul 9, 2026 (3) #1: alter-ego Setup abilities resolve even after a setup form change (Piotr, Kitty).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (checked against the PDF:
   printed page = PDF page). Cycle 6's FAQ is on p. 63 (Powerful Punch, Mutant Protectors, White Queen, Operation Zero
   Tolerance) and p. 64 (Fabian Cortez); its errata on p. 68 (Steel Fist, Armor Up, Mutants at the Mall, Asteroid M,
   Factory Online, The Rule of Magnus). Entries this pass leans on: "Ally Limit" (p. 7), "Attach To" (p. 8),
   "Campaign-Specific Card" (p. 11), "Deal" (p. 15), "Form, Change Form" (p. 21), "Hinder X" (p. 22), "Leaves Play" and
   "'Loses'" (p. 27), "Modes of Play" (p. 28), "Ownership and Control" (p. 31), "Permanent" and "Piercing" (p. 32),
   "Set Aside" (p. 39), "Status Cards" and "Steady" (p. 41), "Sustained Damage" and "'Swap'" (p. 42), "Team-Up" and
   "Teamwork (Trait)" (p. 43), "Tough" (p. 44), "Toughness", "Tuck" and "Unique" (pp. 45–46), "Victory Display" and
   "Victory X" (p. 46), "Villain Defeat" (p. 47).
4. **`docs/phase7-wave6-sources.md` and `docs/phase7-wave6-data-survey.md`**, reconciled with this pass. Where they
   differ, this file is the architect's reading:
   - Sources §7 says Shadowcat "begins in Phased". Kitty Pryde's Setup (32030b): "Put your mass form upgrade into play,
     **Solid** side faceup."
   - Sources §3.1 summarizes teamwork from MC32 p. 3 ("each minion … activates"); RRG 1.8 p. 43 says only the minion
     that just entered play activates. §4 Q1.
   - Sources §1's Appendix VI quote (above).
   - Survey §8 item 6 points at `multipleVillains` for Mansion Attack. Only one Brotherhood villain is in play at a time
     (MC32 p. 15), so it is the Loki shape, not The Sinister Six's (§1.4, §3.21).

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-01), nothing landed.** The survey's §8 items 2, 3, 5, 6 and 7, settled. Items 1 (Burning
> Hunger's text) and 4 (keywords) are the data agent's; every keyword the box prints (Hinder, Incite, Patrol,
> Permanent, Piercing, Quickstrike, Ranged, Retaliate, Setup, Stalwart, Steady, Surge, Team-Up, Teamwork, Toughness,
> Victory, Villainous) is already a `KeywordInstance` in `packages/content/src/schema/keywords.ts`.

### 1.1 Campaign roles: four campaign-specific sets and an optional `Campaign.roles`

MC32 p. 5: "The four roles are: Brawler, Commander, Defender, and Peacekeeper … Brawler (Aggression + Protection),
Commander (Aggression + Leadership), Defender (Justice + Protection), Peacekeeper (Justice + Leadership) … Each role
comes with its own set of 5 upgrades." Raw set codes `brawler` (32176–32180), `commander` (32181–32185), `defender`
(32186–32190), `peacekeeper` (32191–32195), faction `campaign`, no cost printed.

- **Four `EncounterSet` records**, one per role, in `Campaign.campaignSetIds`, the S.H.I.E.L.D. Tech shape (wave 5
  §1.8): the cards are `UpgradeCard`s with `cost: 0, specialCost: "dash"` and `specificTo: { kind: "campaign" }`. A
  campaign `random` op draws from `CampaignChoiceSource.campaignSet` by set id (exists, `packages/engine/src/campaign.ts`).
- **Same title, different cards:** Coup de Grâce (32176, 32181), Swagger (32177, 32186), Surprise! (32187, 32191),
  Compassion (32182, 32192) are printed in two roles each. They stay separate ids; they never enter a deck, so the
  copy limit does not apply.
- **New optional `Campaign.roles?: readonly CampaignRole[]`**, `CampaignRole { id: string; name: string;
encounterSetId: EncounterSetId; aspects: readonly [Aspect, Aspect] }`. The role-to-aspect pairing is a fact printed
  in the product (MC32 p. 5), so it lives with the other product facts in `@mc/content`, where the client can show it;
  the `CampaignDefinition` in `@mc/cards` reads it for role-building (§3.23). Validation: each `encounterSetId` is in
  `campaignSetIds`, the two aspects differ, ids are unique.
- **Data:** 32187 and 32191 print "Hero Response"; raw reads "Hero Reponse" (a curation text fix).

### 1.2 Shadowcat's mass form: no new field (the Vision shape)

Solid / Phased (32031a/b) is one double-sided upgrade: "Mass form. Permanent." on both faces. MC32 p. 3 "Additional
Forms" and RRG 1.8 "Form, Change Form" (p. 21): "Cards with the '[type] form' keyword grant an identity unique forms
… When an identity changes their additional form, it does not count against the once-per-turn limit … but it does
count as changing form for the purpose of triggering card effects." Built in wave 4 §3.1 for Vision's Intangible /
Dense (`vision` 26002) and Spectrum's energy forms.

- **One `UpgradeCard` 32031a with a `flipSide` (32031b)**, keywords `{ name: "form", formType: "mass" }` and
  `{ name: "permanent" }` on both faces, `cost: 0, specialCost: "dash"` (the survey's "upgrade without a cost" line;
  `vision` 26002 is the emitted precedent). No `attachesTo`.
- The identity needs nothing new: 32030a/b are an ordinary hero/alter-ego pair. 32030b's "Setup: Put your mass form
  upgrade into play, Solid side faceup" is an ability (§3.22).
- Permanently Phased (32055), Shadowcat's obligation, names the form type ("change mass form"), which the existing
  `cannotChangeForm { formType }` reads.

### 1.3 Conditional attach hosts

| Card                           | Printed                                                                                                                            | Data                                                                                                                                                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Energy Barrier 32103           | "Attach to a [Sentinel] minion without Energy Barrier attached and give it a tough status card. Otherwise, this card gains surge." | `{ kind: "qualified", category: "minion", trait: "Sentinel", withoutAttachmentNamed: "Energy Barrier" }`, the Stun Beam (32116) shape already in `schema/wave1.test.ts`. The tough card and the surge are the card's When Revealed (wave 4 §3.58: `isAttached` → `giveTough`, else `gainSurge`). |
| Homo Superior 32077            | "Attach to a minion and give it a tough status card. Otherwise, this card gains surge."                                            | `{ kind: "minion" }`; the rest as Energy Barrier. Its boost ("Attach this card to a minion and give it a tough status card") is an ability.                                                                                                                                                      |
| Targeted for Elimination 32107 | "Attach to your identity if a copy of Targeted for Elimination is not attached to you. Otherwise, this card gains surge."          | **Schema change (small):** `{ kind: "yourIdentity" }` gains the optional `withoutAttachmentNamed` qualifier that `qualified` and `minionWithHighestPrintedHp` already take; validation as for those. Surge as above.                                                                             |
| Nano-Sentinel Tech 32170       | No attach line; its When Revealed searches for "your nemesis minion … attach this card to it."                                     | `Correction.impliedAttachHost` (the `sm` Manipulated Mind 27171 precedent, wave 5 §1.9): the host is the nemesis minion its own When Revealed finds.                                                                                                                                             |

Wrapped in Metal (32150, "Attach to your identity. Max 1 per identity.") is the existing max-per-instance reading
(wave 5 §3.14); Unstoppable (32028) and Stun Beam (32116) already parse.

### 1.4 Mansion Attack's villains: the Loki shape, not `multipleVillains`

MC32 p. 15: "Mansion Attack has four different villains … Only one villain will be in play at a time, but the order is
randomized … Skirmish Mode: Defeat 1 villain to win. Standard Mode: 2 … Expert Mode: 3 … Heroic Mode: 4." 32125a Setup:
"Shuffle the villains together (without looking) to create the villain deck. The top card of this deck is in play."
"Replace each villain (A) with its villain (B) side for expert mode." Avalanche, Blob, Pyro and Toad (32121–32124) each
print "Toughness. Victory 2." on both faces.

- **Each physical villain card is emitted as two one-stage `VillainCard`s**, 32121a (standard) and 32121b (expert), and
  so on, because the faces are mode versions, not forms a card ability flips between. That is the Kang shape (wave 2,
  `expertVillains`) and needs no engine change.
- **Scenario fields, all existing** (`packages/content/src/schema/sets.ts`): `villainCardId: 32121a`,
  `setAsideVillainCardIds: [32122a, 32123a, 32124a]`, `expertVillains: { villainCardId: 32121b,
setAsideVillainCardIds: [32122b, 32123b, 32124b] }`, `startingVillain: "random"`, `victory: "cardAbility"` (Save the
  School 32130 wins), `victoryCondition: { skirmish: 1, standard: 2, expert: 3, heroic: 4 }`. No `multipleVillains`.
- The engine side is §3.21 (expected to compose).

### 1.5 Mansion Attack's main scheme deck: one card, five stages, four of them alternatives

32125a Setup: "Shuffle all copies of main scheme 2A and stack them under this scheme." MC32 p. 15: "each side 2A of each
main scheme is identical to one another … each side 2A assigned the range 126A–129A." 1B (32125b): "When Revealed:
Deal each player a facedown encounter card. Advance to the next card in the main scheme deck. Add this card to the
victory display." Each 2B: "When Completed: Add this scheme to the victory display. Advance to the next card in the
main scheme deck. If there are 3 main schemes in the victory display, the players lose the game."

- **One `MainSchemeCard` 32125a** with five stages: stage 1 The Brotherhood Strikes!, then The Atrium, The Cafeteria,
  The Basketball Court and The Courtyard, each `stageNumber: 2` with its own `name` (the validator already accepts
  alternative stages told apart by name, `schema/validation.ts` ~line 979). Their A sides are the identical "When
  Revealed: Flip this card." The order of stages 2–5 is set by the 1A Setup (§3.18).
- 32125b's scheme values (the survey's "missing acceleration") are all in `dashedValues`: 1B advances on its own reveal
  and never holds threat.
- Losing at three schemes in the victory display (1B counts as one) needs §3.19.

### 1.6 Main scheme B sides with no target threat

32063b (Stalked by Sabretooth) and 32087b (Night of the Sentinels) print no target threat; the survey lists them as
"missing target threat". Stalked by Sabretooth advances only through Find the Senator's When Defeated ("Advance to
main scheme 2A"); Night of the Sentinels never advances (the game is won by defeating the Sentinel and lost through
Operation Zero Tolerance). **Data:** `targetThreat` in the stage's `dashedValues`. The engine already never completes
a stage whose target threat is dashed (`resolve/defeat.ts` ~line 120). Confirm each against its scan before curating.

### 1.7 The campaign record (`MUT_GEN_CAMPAIGN`)

The hand-authored `packages/content/src/data/mut_gen/campaign.ts`, the `sm` shape:

- `boxCode: "MC32"`, `packCode: "mut_gen"`, `scenarioIds` in MC32 p. 4's fixed order (Sabretooth, Project Wideawake,
  Master Mold, Mansion Attack, Magneto), `logSheetReference` to `docs/campaign-modes/log-sheets/mc32_mutant_genesis_campaign_log.pdf`.
- `campaignSetIds`: `mut_gen_campaign` (171–175) and the four role sets (§1.1). **Future Past is not
  campaign-specific:** MC32 p. 5, "When not playing a Mutant Genesis campaign, this set can be used like any other
  encounter set."
- No `perSeatSetIds` (roles are chosen, not numbered by seat) and no `prohibited` (MC32 prints none).
- `roles` (§1.1).
- **Log fields** (MC32 p. 24, for the `CampaignDefinition`): per seat identity, role, expert remaining hit points;
  four "Defeated" checkboxes (Frightened Police, Enemy of My Enemy, Find the Prisoners, Surprise Attack); "Future Past
  cards in the victory display" (removed from the campaign) and "Future Past cards in the encounter deck" (card list);
  "Role upgrades in play" per seat, scenarios 1–4 (removed); Jubilee (scenarios 2–4: in play / removed); "Allies from
  Abduction Protocols" (scenario 2); "Allies under Rescue Captives or Find the Prisoners" (scenario 3, removed).

### 1.8 The campaign cards 171–175 and their other faces

The a faces are side schemes in `mut_gen_campaign` (`campaignSpecific`); each b face is another card type that the a
face's When Defeated flips to. Emit each b face as its own card with `otherFaceId` both ways (wave 4 §1.7, flipped by
wave 4 §3.10), `specificTo: { kind: "campaign" }`:

| a face                  | b face                                    | Notes                                                                                                                     |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 171a Frightened Police  | 171b Metro P.D., support (BASIC/CAMPAIGN) | Permanent; "The first player controls Metro P.D."; no printed cost: `cost: 0, specialCost: "dash"`                        |
| 172a Enemy of My Enemy  | 172b Magneto, ally (BASIC/CAMPAIGN)       | Scan: cost "—", THW 2, ATK 3, HP 5, Victory 1, unique. **Also used standalone** by Master Mold's 1A Setup (below)         |
| 173a Find the Prisoners | 173b Rescue Captives, environment         | "(Keep facedown cards under Rescue Captives.)"                                                                            |
| 174a Surprise Attack    | 174b Reactivate Defenses, obligation      | **Title fix:** raw says "Reactive Defense"; the 174B scan and 174A's text say "Reactivate Defenses"                       |
| 175a Magneto's Fortress | 175b Magneto's Power, attachment          | Scan: "Attach to Magneto. Permanent." with +1 SCH and +1 ATK. Read as printed: defeating the fortress strengthens Magneto |

**Master Mold uses 172b outside the campaign.** 32112a Setup: "Put the Magneto Ally (172B) into play under the first
player's control." The card is in the campaign set, which a standalone game does not compose. **New optional
`Scenario.setAsideCardIds?: readonly CardId[]`** (cards a scenario's own setup needs from outside its encounter sets,
created set aside with no owner); the scenario builder passes it to the existing `GameSetupConfig.setAside`
(`packages/engine/src/setup.ts` ~line 743), the field a campaign's `setAsideCards` already joins. Master Mold:
`["32172b"]`. In the campaign the same card may already be in play from scenario 2's Enemy of My Enemy; scenario 3's
1A Setup puts it in either way, from the set-aside copy.

### 1.9 Other data notes for the pipeline

- **Errata to apply** (RRG 1.8 p. 68): Mutants at the Mall 32088a ("discarding any other **ally** version of Jubilee";
  raw is the old text); Asteroid M, Factory Online, The Rule of Magnus 32141b–32143b ("remove 3 of them and discard
  cards … Reveal that card"; raw has the old order). Steel Fist 32008 and Armor Up 32010: raw is already current.
- **Electromagnetic Blast 32153:** raw "Place 1 counter on the main scheme"; the scan reads "Place 1 **magnet**
  counter on the main scheme."
- **Duplicate records:** raw has both an unsuffixed record and an `a` record with a nested `b` for 32063, 32064, 32087,
  32112, 32113, 32125–32129 and 32141–32143; the unsuffixed record repeats the b face. Emit one card per printed face.
- **Dashed or missing stats:** Robert Kelly 32066 (no ATK, no THW), Mystique 32080 (ATK and SCH are "★", set by her
  text: "Mystique's SCH is equal to the villain's SCH, and her ATK is equal to the villain's ATK") via `cardNotes`.
- **Captive allies 32089–32092** (Rictor, Boom Boom, Cannonball, Wolfsbane) are encounter-set allies with a printed
  cost of 2: `AllyCard`s in `project_wideawake` with the CAPTIVE trait. In the campaign they can be shuffled into a
  player's deck and played (§3.20). Raw typo: 32092 "Wolfbane's attacks" (printed "Wolfsbane's"; confirm on the scan).
- **Jubilee 32088b:** Victory -1 (wave 5 §1.2's negative value), first player controls her, she does not count
  against the ally limit.
- **Magneto's Fortress 175a:** the "!" burst on the scan is the crisis icon, not amplify (171a prints the same icon; 51033, a real amplify card, shows a different one). The data already carries `icons: ["crisis"]` (checked in curation pass 2, b10b7ca6).
- Survey items: 32031a cost (§1.2), 32171b/32172b costs (§1.8), the main scheme B sides (§1.5, §1.6), the attach rules
  (§1.3).

### 1.10 Hero packs and MojoMania

Placeholders for passes 2 and 3 (§6, §7). Known from the survey: Phoenix's Burning Hunger (34028) text from the scan,
Phoenix Force's power counters, MojoMania's missing `Scenario` records and genre sets.

---

## 2. Per-scenario setup needs, standalone and campaign

RRG 1.8 Appendix II (p. 51) with the wave 1–5 engine. Villain decks are I–II standard and II–III expert, except Mansion
Attack (§1.4).

### 2.1 The box's heroes

| Identity                          | Obligation                 | Nemesis set (nemesis minion in bold)                                               | Setup and legality                                                                                           |
| --------------------------------- | -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Colossus / Piotr Rasputin (32001) | Homesick (32025)           | **Juggernaut** (32026), Rampaging Juggernaut, Unstoppable ×2, Slammed              | Piotr's Setup: search for Organic Steel. Precon Colossus/Protection (MC32 p. 22, 40 cards). Hand size 6 / 4. |
| Shadowcat / Kitty Pryde (32030)   | Permanently Phased (32055) | **White Queen** (32056), The Hellfire Club, Hellfire Pawn ×2, Telepathic Restraint | Kitty's Setup puts Solid / Phased into play Solid side up (§3.22). Precon Shadowcat/Aggression (MC32 p. 22). |

- **Same title, different cards:** Shadowcat the hero and the ally (32002, in Colossus's kit); Colossus the hero and
  the ally (32048, basic); Shadow and Steel and Energy/Genius/Strength printed twice (32021/32050, 32022–32024 /
  32052–32054; give each precon one printing, collector order, the `sm` precedent); Wolverine (32041) and Magneto (172b)
  as allies, Avalanche/Blob/Pyro/Toad as minions (32073–32076) and villains (32121–32124).

### 2.2 The five scenarios

| Scenario          | Main scheme deck                                         | Encounter sets (required) + modulars                               | 1A Setup / scenario rules                                                                                                                                                                                                   | Needs (§3)                            |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Sabretooth        | Stalked by Sabretooth → The Injured Senator              | Sabretooth, Standard; Brotherhood and Mystique (both removable)    | "Put the Find the Senator side scheme into play. Attach the Robert Kelly to it. While attached to Find the Senator, Robert Kelly is in play but under no player's control." MC32 p. 7: if he leaves play, the players lose. | 3.10, 3.11, 3.12                      |
| Project Wideawake | Night of the Sentinels                                   | Project Wideawake, Zero Tolerance, Standard; Sentinels (removable) | "Set each [Captive] ally aside. Reveal the Operation Zero Tolerance and Mutants at the Mall side schemes." 1B: OZT gains permanent. MC32 p. 9.                                                                              | §1.3 only (Targeted for Elimination)  |
| Master Mold       | The Sentinel Factory → Master Mold's Agenda              | Master Mold, Sentinels, Standard; Zero Tolerance (removable)       | "Put the Magneto Ally (172B) into play under the first player's control." (§1.8). 1B/2B: "Each [Sentinel] minion gains guard." MC32 p. 12.                                                                                  | 3.15                                  |
| Mansion Attack    | The Brotherhood Strikes! → four shuffled stage 2s (§1.5) | Mansion Attack, Brotherhood, Standard; Mystique (removable)        | "Put the Save the School environment into play. Shuffle all copies of main scheme 2A and stack them under this scheme. Shuffle the villains together …" MC32 p. 15.                                                         | 3.18, 3.19, 3.21                      |
| Magneto           | Asteroid M → Factory Online → The Rule of Magnus         | Magneto, Standard; Acolytes (removable)                            | "Set the Orbital Decay side scheme aside. Reveal the Boarding Party side scheme." MC32 p. 18: each of the two double-sided side schemes caps Magneto's sustained damage.                                                    | 3.1, 3.2, 3.3, 3.13, 3.14, 3.16, 3.17 |

- **Modular sets.** Brotherhood and Mystique (Sabretooth; Brotherhood is required in Mansion Attack), Sentinels
  (Project Wideawake; required in Master Mold), Zero Tolerance (required in Project Wideawake; removable in Master Mold),
  Acolytes (Magneto), Future Past (the campaign throughout; an ordinary modular standalone). Future Past needs §3.4.
- **Modular difficulty** (MC32 pp. 7, 9): "If players wish to modify the difficulty … they may place damage on Robert
  Kelly during setup" (skirmish 0, standard 1, expert 2, heroic 3) and "they may place cards from the top of their deck
  facedown under Operation Zero Tolerance during setup" (0/1/2/3). Both are optional: §4 Q3.
- **Robert Kelly** (32066): "The first player controls Robert Kelly. He does not count against your ally limit and
  cannot have player cards attached. Forced Interrupt: When an enemy resolves an undefended attack against you, deal
  the damage to Robert Kelly." Composes from wave 4 §3.8's Odin primitives (`captive-ally.test.ts`:
  `cannotHaveAttachments`, `controlledByFirstPlayer`, `excludedFromAllyLimit`, `leavingPlayLoses`) and wave 5 §3.29's
  `instead` (§3.25). §4 Q4 on "against you". While attached he is not friendly (ruling Jun 25, 2026 (4) #5).
- **Operation Zero Tolerance** (32104): "After an enemy attacks and defeats an ally, place that ally facedown under this
  scheme. If there are X facedown cards under this scheme, the players lose the game. X is 3 more than the number of
  players." FAQ p. 63: the ally goes under OZT "regardless of where it ended up". Composes (`tuckCards { facedown }`,
  `tucked` selector, a `stateCheck` count).
- **Master Mold** (32109–32111): "Forced Interrupt: When Master Mold schemes against you, discard cards from the
  encounter deck until a [Sentinel] minion is discarded. Put that minion into play engaged with you. Do not give Master
  Mold a boost card for this activation." MC32 p. 12: the minion activates as normal after Master Mold. §3.15.
- **Mansion Attack** (MC32 p. 15; Save the School 32130): "After the villain is defeated, if there are X villains in
  the victory display, the players win the game. Otherwise, deal each player an encounter card and reveal the next
  villain. If a minion with the same title as the new villain is engaged with a player, discard that minion and the
  villain activates against that player." A new villain of a different title starts clean (RRG 1.8 "Villain Defeat",
  p. 47). A Brotherhood **minion** cannot enter play while the matching villain is in play (RRG 1.8 "Unique", p. 46: it
  is discarded and the revealing player is dealt a facedown encounter card); a villain can.
- **Magneto** (MC32 p. 18): Boarding Party (32144a, "Magneto cannot have more than 6[per_hero] sustained damage") →
  Sabotage Master Mold (32144b, 12[per_hero]; When Defeated reveals the set-aside Orbital Decay and goes to the victory
  display) → Orbital Decay (32145a, 18[per_hero]) → Physical Strain (32145b, "Attach to Magneto. Permanent. Magneto
  loses steady."). Magnet counters: "After Magneto attacks you, place 1 magnet counter on the main scheme"; each main
  scheme B side, with the p. 68 erratum: "After you place a magnet counter on this scheme, if there are at least 3
  magnet counters here, remove 3 of them and discard cards from the encounter deck until a [Magnetic] card is
  discarded. Reveal that card."

### 2.3 The campaign (MC32 pp. 4–5, 7–19, 24)

Five scenarios in order; a lost scenario may be reset and retried "with no penalty" (MC32 p. 4; foundation row 11).
`docs/campaign-mode-design.md` was designed with this box in view (rows 23, 28, 29, 32, 33, 37, 39, 43, 49, 53).

| Scenario            | Campaign setup (in printed order)                                                                                                                                                                                                                                    | Campaign victory                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Sabretooth        | Record identities; each player chooses a **different** role, records it, takes 1 random role upgrade into play, may role-build; shuffle Future Past and set it aside (the Future Past deck); reveal Frightened Police (171A)                                         | Frightened Police defeated → record; Future Past in VD removed, Future Past in deck/discard/in play recorded; role upgrades that began in play removed; expert: record HP               |
| 2 Project Wideawake | Recorded Future Past into the encounter deck, rest set aside; if Frightened Police defeated: 1 random role upgrade each + role-build; reveal Enemy of My Enemy (172A); expert: set HP, each player may place 1 acceleration token on the main scheme to heal to full | as 1 (Enemy of My Enemy); Jubilee in play → record; record each CAPTIVE ally that entered play                                                                                          |
| 3 Master Mold       | Future Past as 2; Jubilee recorded → into play; each recorded CAPTIVE ally may be shuffled into any player's deck; if Enemy of My Enemy defeated: role upgrade + role-build; reveal Find the Prisoners (173A); expert as 2                                           | as 1 (Find the Prisoners); Jubilee in play → record, else remove her from the log; allies under Find the Prisoners / Rescue Captives recorded and unusable for the rest of the campaign |
| 4 Mansion Attack    | as 3, gated on Find the Prisoners defeated; reveal Surprise Attack (174A)                                                                                                                                                                                            | as 1 (Surprise Attack); Jubilee as 3                                                                                                                                                    |
| 5 Magneto           | as 3, gated on Surprise Attack defeated; reveal Magneto's Fortress (175A); expert as 2; **expert: a loss loses the campaign**                                                                                                                                        | The campaign is won                                                                                                                                                                     |

- **Campaign side schemes** (171A–175A): each When Defeated "Shuffle[s] the top card of the Future Past deck into the
  encounter deck" and flips to its b face (§1.8).
- **Role upgrades** (MC32 p. 5): "take a random upgrade from their role's set of cards and put it into play at the
  start of the game. At the end of the game, those upgrades are removed from the campaign, whether their abilities
  were used or not." Each upgrade also prints "Remove this card from the game and the campaign pool." **Role-building:**
  "up to 1 copy of an event and/or 1 copy of an upgrade in their collection from their role's associated aspects …
  Cards chosen this way do not count toward minimum or maximum deck size", for that game only. §3.23.
- **Expert campaign** (MC32 p. 5): persistent damage capped at base hit points (foundation row 18); "the defeated
  player does not participate in the Victory steps" and "can rejoin … by placing an acceleration token on the main
  scheme to restore their identity to full hit points" (§4 Q11).
- **Future Past** across scenarios: §3.24.

---

## 3. Engine primitives for the box (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed,
and each section names cards from other packs that compose with it. Every "missing" below was searched for by behavior
first (`TriggerEvent`, `EffectSpec`, `RuleSpec`, `Predicate`, `ValueSpec`, `AbilityCost`, `CampaignOp` unions and the
wave 1–5 specs, 2026-10-01). Each section is one agent, one commit.

**Priority order.** The scenarios first (Sabretooth → Magneto), then the heroes, then the campaign. A scenario or hero
whose cards need an unbuilt primitive stays data only.

| §    | Primitive                                                   | Needed by                                                           | Status           |
| ---- | ----------------------------------------------------------- | ------------------------------------------------------------------- | ---------------- |
| 3.1  | Teamwork (trait) keyword                                    | Acolytes (32159–32163)                                              | missing          |
| 3.2  | "After you place a [type] counter" (`countersPlaced`)       | Asteroid M, Factory Online, The Rule of Magnus                      | missing          |
| 3.3  | A cap on sustained damage                                   | Boarding Party, Sabotage Master Mold, Orbital Decay                 | missing          |
| 3.4  | A per-phase cap on damage taken                             | Nimrod (32166)                                                      | partial          |
| 3.5  | "After a status card is discarded from X"                   | Iron Will, Organic Steel                                            | missing          |
| 3.6  | Discarding a status card as a cost; how many were discarded | Made of Rage, Bulletproof Protector, Homesick, Rampaging Juggernaut | partial          |
| 3.7  | A numeric tough status capacity                             | Colossus                                                            | partial          |
| 3.8  | "After you ignore guard / patrol / the crisis icon"         | Acute Control, Intangible Interference                              | missing          |
| 3.9  | A status card a constant ability keeps giving               | White Queen, Telepathic Restraint                                   | partial          |
| 3.10 | Encounter treacheries that stay in a player's hand          | Infiltration, Shapeshifter Surprise                                 | partial          |
| 3.11 | Who may trigger an ability                                  | X-Mansion, Protect the Senator, Rescue Captives                     | partial          |
| 3.12 | "Cannot be healed by player card effects"                   | Find the Senator, Protect the Senator                               | missing          |
| 3.13 | Losing a keyword                                            | Physical Strain                                                     | missing          |
| 3.14 | "Cannot recover"                                            | Wrapped in Metal                                                    | missing          |
| 3.15 | Withholding the boost card from the activation in progress  | Master Mold I–III                                                   | partial          |
| 3.16 | Giving a chosen card as a boost card                        | Master of Magnetism                                                 | partial          |
| 3.17 | Resolving "When Defeated" abilities on demand               | Zeal for the Cause                                                  | partial          |
| 3.18 | Main scheme stages shuffled at setup                        | The Brotherhood Strikes! 1A                                         | missing          |
| 3.19 | A main scheme stage in the victory display                  | The Brotherhood Strikes! 1B, The Atrium … The Courtyard             | missing          |
| 3.20 | An encounter-set ally that is a player's card for one game  | Captive allies in the campaign (MC32 pp. 12, 16, 19)                | partial          |
| 3.21 | A villain sequence of different titles                      | Mansion Attack                                                      | exists (verify)  |
| 3.22 | Shadowcat's mass form                                       | Solid / Phased, Kitty Pryde, Quick Shift, Permanently Phased …      | exists           |
| 3.23 | Campaign roles                                              | MC32 p. 5                                                           | exists (compose) |
| 3.24 | The Future Past deck across the campaign                    | MC32 pp. 7–19                                                       | exists (verify)  |
| 3.25 | Reusable as is                                              | —                                                                   | checked          |
| 3.26 | Temporary keyword                                           | Exploit Weakness, Practiced Defense, Priority Target (`cyclops`)    | missing          |
| 3.27 | "You take the first turn during the player phase"           | Field Commander (`cyclops`)                                         | missing          |
| 3.28 | "Max 1 [TRAIT] upgrade per ally" / "card per player"        | Danger Room Training, Mission Training                              | missing          |
| 3.29 | Additional damage for a player attack in progress           | Full Blast, Warrior Skill                                           | partial          |
| 3.30 | A resource ability's effect on the ability it pays for      | Ruby Quartz Visor                                                   | partial          |
| 3.31 | Changing an ally's consequential damage                     | Dust, Coordinated Attack                                            | partial          |
| 3.32 | A basic attack made with THW                                | Befuddle                                                            | partial          |
| 3.33 | A printed stat as a value                                   | Marvel Girl                                                         | partial          |
| 3.34 | "Cannot activate"                                           | Mental Paralysis                                                    | missing          |
| 3.35 | A scheme activation that removes threat instead             | Psychic Manipulation                                                | missing          |
| 3.36 | An enemy attack's damage dealt to another enemy             | Psychic Misdirection                                                | partial          |
| 3.37 | An enemy's scheme threat placed on a named side scheme      | Dark Phoenix (`phoenix` 34029)                                      | partial          |
| 3.38 | A scheme losing a printed icon                              | Consume the World                                                   | partial          |
| 3.39 | A bonus for the next basic thwart or attack                 | Psychic Kicker                                                      | missing          |
| 3.40 | The basic recovery as an event                              | Death Factor                                                        | partial          |
| 3.41 | "Take N damage" is not damage the card deals                | Berserker Barrage with Aggressive Energy                            | partial          |
| 3.42 | Playing a chosen card from an ability, and remembering how  | Wolverine's Claws, Lunging Strike                                   | partial          |
| 3.43 | A lasting bonus for basic attacks against one enemy         | Jubilee (`wolv` 35003)                                              | partial          |
| 3.44 | Reusable as is (Cyclops, Phoenix, Wolverine)                | —                                                                   | checked          |

### 3.1 Teamwork (trait) keyword

> **Status: missing.** The keyword is in the schema (`KeywordInstance` `teamwork` with `sharedTrait`,
> `packages/content/src/schema/keywords.ts`) and nowhere in the engine; `packages/engine/src/resolve/reveal.ts` ~line
> 414 says "The teamwork keyword (not built yet) has the same RRG wording … an open question for whoever builds it."

**Cards.** Fabian Cortez, Amelia Voght, Senyaka, Delgado, Unuscione (`mut_gen` 32159–32163, Teamwork (ACOLYTE)).

**Rules.** RRG 1.8 "Teamwork (Trait)" (p. 43): "After a minion with teamwork enters play and engages a player, if there
is at least one other minion that shares the specified trait in play, the minion that just entered play activates
against the player it is engaged with. The teamwork (trait) keyword is equivalent to the following triggered ability:
'Forced Response: After this minion enters play, if there is another Trait minion in play, this minion activates
against the engaged player.' If a minion with the teamwork keyword is being revealed, the teamwork keyword resolves
after any 'When Revealed' abilities on that minion are resolved." FAQ "Fabian Cortez (#159)" (p. 64): a minion put into
play by Cortez's When Defeated does not see Cortez, who is already discarded. MC32 p. 3 words it differently (§4 Q1).

**Plan.** A keyword-sourced forced response on `cardEntersPlay` of the minion, resolved with the keywords' timing
priority (ruling Jan 17, 2026 (3) #2), checked at resolution: another minion in play has the keyword's `sharedTrait`
(by trait, granted traits included, e.g. Nano-Sentinel Tech's "gains the [Sentinel] trait"). Effect: the existing
`enemyActivation` of that minion against its engaged player (attack or scheme by form, boost and villainous as usual).
On a reveal it waits for the When Revealed (`reveal.ts`, after the `whenRevealed` stage, unlike quickstrike; §4 Q2). A
minion that enters play unengaged does not activate. Log `keywordResolved { keyword: "teamwork" }`.

**Composes with:** the Age of Apocalypse teamwork minions (`aoa` 45112–45116, 45140–45144) and any later teamwork card.

### 3.2 "After you place a [type] counter" (`countersPlaced`)

> **Status: missing.** `TriggerEvent` has `countersRemoved` (wave 4 §3.15, "After the last X counter is removed") but no
> counterpart for placing; `addCounters` (`spec.ts`) announces nothing.

**Cards.** Asteroid M, Factory Online, The Rule of Magnus (32141b–32143b, errata p. 68).

**Plan.** **`TriggerEvent countersPlaced { targetInstanceId, counterType, amount, playerId | null }`**, response only,
pushed by `addCounters` (and `moveCounters` onto the target) only when an ability listens, like `resourcesGenerated`.
`playerId` is the player resolving the placing ability ("you": the attacked player for Magneto's response, the
revealing player for Metal Shards, "that player" for Magnetic Mayhem). One event per placement, its `amount` the number
placed (§4 Q8). All-purpose counters take the card's type before the event (ruling Jan 26, 2026 (2)). **DSL:**
`on.countersPlaced(counterType, where?)`.

**Composes with:** Phoenix Force (`phoenix` 34002b, "After a power counter is placed here"), Pursued by the Past
(`aoa` 45075a), the Officer's Aid side schemes (`aos` 50181b–50183b), Breakthrough (61005), Alpha Flight Recruit
(`cw` 56135).

### 3.3 A cap on sustained damage

> **Status: missing.** `maxDamageTakenPerAttack` (`packages/engine/src/abilities.ts` ~line 801, wave 3 §3.15) caps one
> attack; nothing caps a total.

**Cards.** Boarding Party (6[per_hero]), Sabotage Master Mold (12[per_hero]), Orbital Decay (18[per_hero]):
"Magneto cannot have more than N sustained damage."

**Rules.** RRG 1.8 "Sustained Damage" (p. 42): for a villain, maximum hit points minus remaining hit points (the dial).

**Plan.** **`RuleSpec maxSustainedDamage { target: TargetQuery; amount: ValueSpec; while?: Predicate }`**, read where
damage is taken (with the other constants, after `reduceDamageTaken`/`increaseDamageTaken`, before the dial moves):
the damage taken is lowered to what keeps sustained damage at most `amount`; with several rules, the lowest wins.
Damage above the cap is not taken and not prevented (§4 Q9). It does not stop healing or change the dial's maximum.
Log `damageCapped { targetInstanceId, amount }`. **DSL:** `constant(maxSustainedDamage(target, amount))`.

### 3.4 A per-phase cap on damage taken

> **Status: partial.** `maxDamageTakenPerAttack` exists (`abilities.ts` ~line 801, `damage-limits.test.ts`).

**Cards.** Nimrod (32166, Future Past): "Nimrod cannot take more than 3 damage each phase." Ruling Jan 26, 2026 (3) uses
him: excess damage dealt still counts for "excess damage" readers while overkill reads damage taken.

**Plan.** Add `per?: "attack" | "phase"` to the rule (absent = attack; rename the kind only if the scripting DSL keeps
its builder name) and a per-instance tally of damage taken this phase, cleared at each phase's end, kept on the card
instance so replay reproduces it. Only damage taken counts (§4 Q9's reading). **DSL:** `maxDamageTaken(target, n, {
per: "phase" })`.

### 3.5 "After a status card is discarded from X"

> **Status: missing.** Status removal is logged (`GameEvent statusRemoved`, `packages/engine/src/events.ts` ~line 290,
> emitted from `effects.ts`, `actions.ts`, `resolve/apply-effect.ts`, `resolve/state-checks.ts`) but is no `TriggerEvent`.

**Cards.** Iron Will (32004, "After a tough status card is discarded from Colossus, draw 1 card"), Organic Steel
(32006, "After a tough status card is discarded from Colossus, exhaust this card and remove 1 steel counter from it →
give Colossus a tough status card").

**Plan.** **`TriggerEvent statusDiscarded { instanceId, status, reason, playerId | null }`**, response only, one per
status card, from every path that discards one: a tough card used up by damage (RRG 1.8 "Tough", p. 44), piercing,
`removeStatus`, a cost (§3.6), a steady clear, stalwart shedding. Cards discarded by one step share one response window
(the wave 5 §4.1 Q33/Q49 rule; §4 Q5). Not announced for `cannotHaveStatus` refusals (nothing was held). **DSL:**
`on.statusDiscarded(status, from)`.

**Composes with:** Luke Cage, Fogwell's Gym, Power Man (`62001a`, `62007`, `62011`).

### 3.6 Discarding a status card as a cost; how many were discarded

> **Status: partial.** `EffectSpec removeStatus { target, status }` exists (`spec.ts` ~line 1937) with no `bind`;
> `AbilityCost` has `giveStatus` (`abilities.ts` ~line 1234) but no discard counterpart.

**Cards.** Made of Rage (32007) and Bulletproof Protector (32009): "discard a tough status card from your hero →";
Homesick (32025: "Discard this card and each tough status card from your identity. If you discarded no tough status
cards this way, this card gains surge"); Rampaging Juggernaut (32027: "Place 2 threat here for each tough status card
discarded this way"); Self-Repair (32097) and Delgado (32162) remove statuses without counting.

**Plan.** **`AbilityCost.discardStatus { status, from: TargetRef }`**: payable only if every card `from` names holds
one (RRG 1.8 "Cost", p. 13); paying discards one per card and announces §3.5. **`removeStatus.bind`**: `<bind>.amount`
= cards actually discarded, summed (the `giveStatus.bind` shape, wave 4 §3.60). **DSL:** `discardStatusCost("tough",
yourHero)`, `removeStatus(target, status, { bind })`. Steel Fist's optional "You may discard a tough status card … to
stun and confuse" (erratum p. 68) is an effect, not a cost: `chooseOne` over `removeStatus` with `bind`.

**Composes with:** Watch Me Play (`mojo` 39065), Titanium Exoskeleton (`next_evol` 40091).

### 3.7 A numeric tough status capacity

> **Status: partial.** `RuleSpec statusLimit { target, status: "tough", max: "unlimited" }` (`abilities.ts` ~line 781,
> wave 5 §3.19, Armadillo).

**Cards.** Colossus (32001a): "Colossus can have 1 additional tough status card."

**Plan.** `max: "unlimited" | number`; Colossus is `2` (RRG 1.8 "Status Cards", p. 41: one of each type is the base).
Each tough card still prevents one damage event and is discarded alone; piercing discards them all. With several rules
the largest wins. **DSL:** `statusLimit("tough", 2, target)` beside the existing unlimited form.

### 3.8 "After you ignore guard / patrol / the crisis icon"

> **Status: missing.** `RuleSpec characterIgnores` (`abilities.ts`, wave 4 §3.24) grants the exemption; wave 4 §3.24
> already noted the response cards "need an event; not built."

**Cards.** Acute Control (32034, "After you ignore the guard or patrol keyword on a minion, exhaust Acute Control → deal
2 damage to that minion"), Intangible Interference (32035, "After you ignore the crisis icon on a scheme, exhaust
Intangible Interference → remove 2 threat from that scheme"). The exemptions: Shadowcat's Selective Intangibility
(32030a, while in Phased mass form) and the Shadowcat ally (32002).

**Plan.** **`TriggerEvent keywordIgnored { characterInstanceId, playerId, ignored: "guard" | "patrol" | "crisis",
cardInstanceId }`**, response only, one per card whose keyword or icon would otherwise have stopped the attack or
thwart the character just made (a guard minion engaged with the attacker's player while it attacks something else; a
patrol minion engaged while it thwarts the main scheme; a crisis icon in play while it removes threat from the main
scheme), announced after that attack or thwart, only when an ability listens (§4 Q6). `characterIgnores` already knows
at the legality check which rule it waived; record that on the attack/thwart frame. **DSL:**
`on.youIgnore(["guard", "patrol"])`, binding `that minion` / `that scheme` to the event card.

### 3.9 A status card a constant ability keeps giving

> **Status: partial.** `stateCheck` triggers exist (`abilities.ts` ~line 230) but are edge-triggered, and a card's
> first observation only records the value, so "White Queen enters play engaged with you" would not confuse you.

**Cards.** White Queen (32056, "While White Queen is engaged with you, you are confused"), Telepathic Restraint (32059,
"While Telepathic Restraint is attached to your identity, you are stunned").

**Rules.** FAQ "White Queen (#56)" (p. 63): "she continuously places confused status cards on the engaged player's
identity until that identity cannot have any more confused status cards (normally one, but can be more, such as when
the identity has the steady keyword). If that identity attempts to thwart, they can do so and remove their confused
status card(s), but will immediately be given more … When White Queen leaves play, any confused status cards remain."

**Plan.** **`RuleSpec keepsGivingStatus { target: TargetQuery; status: StatusName; while?: Predicate }`**, applied
between frames like `controlledByFirstPlayer`: each matching character below its capacity (`statusCapacity`, steady
aware) is given status cards up to it, as real cards (announced and logged as given, `reason: "constant"`). The thwart
still removes them first. Leaving play takes nothing back. **DSL:** `constant(youAre("confused", { while }))`.

### 3.10 Encounter treacheries that stay in a player's hand

> **Status: partial.** Wave 5 §3.5 put encounter cards in player decks and hands; its §4.1 Q4 fallback
> (`dealUnhandledEncounterCard`, `packages/engine/src/resolve/cards.ts` ~line 525) deals every encounter card drawn
> from a deck to that player as a facedown encounter card and draws a replacement. MC32 p. 7 asks for the opposite here.

**Cards.** Infiltration (32082, "When Revealed: Shuffle this card into your deck. This card gains surge. Forced
Response: After this card enters your hand, discard an ally or support you control."), Shapeshifter Surprise (32083,
"… After this card enters your hand, Mystique activates against you. Otherwise, search … for Mystique and reveal her").
Metamorphic Mayhem (32081) shuffles them back in.

**Rules.** MC32 p. 7: "If one of these treachery cards subsequently enters your hand, trigger its Forced Response at
that time. Drawing a treachery card from your deck counts as drawing a card. Each treachery in your hand remains until
you discard it, which you may do any time you could discard a player card from your hand … When you discard a
treachery card from your hand or deck, it is placed in the encounter discard pile."

**Plan.** An encounter card whose own text carries an "After this card enters your hand" ability stays in the hand:
**`RuleSpec staysInHand { cards: TargetQuery }`** read by `dealUnhandledEncounterCard` (no deal, no replacement draw),
and that ability is active in hand (wave 4 §3.13's hand-active abilities) as a response to the existing
`encounterCardFromPlayerDeck { how: "draw" }` naming itself. The end-of-phase hand-size discard and "discard a card
from your hand" effects may pick it; it goes to the encounter discard pile (wave 5 §3.5's `moveCards` already keeps its
encounter home). §4 Q7.

### 3.11 Who may trigger an ability

> **Status: partial.** `firstPlayerOnly` (actions and interrupts, `abilities.ts`) and resource `forAnyPlayer` exist; a
> card's ability open to some other set of players, or closed to all but one, is not expressible.

**Cards.** X-Mansion (32049, "Alter-Ego Action: … Any player whose alter-ego has the [MUTANT] trait may trigger this
ability"), Protect the Senator (32065b, an encounter environment: "Hero Response: … Only the player who controls
Robert Kelly can trigger this ability"), Rescue Captives (173b, an environment: "(Any player may trigger this
ability.)").

**Plan.** **`trigger.triggerableBy?: PlayerQuery`** on action, response and interrupt triggers, read by `legal.ts`
(actions) and `candidatesFor` (`resolve/triggers.ts`): absent keeps today's rule (the controller; for an encounter
card, the acting player); present, every matching player is offered it and "you" is that player. The form gate
("Alter-Ego Action") applies to the triggering player. Verify first what an encounter environment's "you" offers today:
Rescue Captives may already compose. **DSL:** `{ triggerableBy: playersWhere(...) }` on `action`/`response`.

**Composes with:** Stun Net (`aos` 50071), High-Tech Suit (`cw` 56131), Plot Convenience (`deadpool` 44050), Shopping
Spree (47003), Safehouse (40197), Get the Scoop (52005), Dr. Sinclair (52017).

### 3.12 "Cannot be healed by player card effects"

> **Status: missing.** No heal restriction exists; `RuleSpec cannotReady { bySource: "playerCard" }` is the shape.

**Cards.** Find the Senator / Protect the Senator (32065a/b): "Robert Kelly cannot be healed by player card effects".
Medical Emergency (32071, encounter) still heals him.

**Plan.** **`RuleSpec cannotBeHealed { target; bySource?: "playerCard"; while? }`**, read by `heal`: a matching card
heals nothing from a source that matches (the ability's card is a player card), logged `healBlocked`. Encounter
card heals (Medical Emergency) still apply.

### 3.13 Losing a keyword

> **Status: missing.** Keywords can be granted (`KeywordGrantSpec`, `abilities.ts` ~line 348) and blanked, not lost.

**Cards.** Physical Strain (32145b): "Magneto loses steady."

**Rules.** RRG 1.8 "'Loses'" (p. 27).

**Plan.** **`KeywordGrantSpec.loses?: true`** (a constant's `keywordGrants` entry that removes the named keyword, printed
or granted), applied after grants in `hasKeyword` (`packages/engine/src/keywords.ts`), so a lost steady drops the
status capacity at once (excess stun/confused cards are discarded by the existing over-capacity state check). **DSL:**
`losesKeyword({ name: "steady" }, target)`.

**Composes with:** Field Commander (`cyclops` 33004), Tigra (56001a), Cap's Shield (56143), Luke Cage (62001a/b),
Solid Sound Constructs (50144).

### 3.14 "Cannot recover"

> **Status: missing.** `cannotThwart`, `cannotAttack`, `cannotDefend` exist; `basicRecover`
> (`packages/engine/src/actions.ts` ~line 3396) checks no rule.

**Cards.** Wrapped in Metal (32150): "Attached identity cannot thwart, attack, defend, or recover."

**Plan.** **`RuleSpec cannotRecover { player; while? }`**, read by `basicRecover` and `legal.ts`. **DSL:**
`cannotRecover(player)`.

### 3.15 Withholding the boost card from the activation in progress

> **Status: partial.** `noBoost` rides an activation that an effect initiates (`enemyAttack`/`enemyScheme` events,
> `trigger-events.ts` ~lines 127, 133; read at the `giveBoost` stage, `resolve/enemy-activation.ts` ~line 682), and
> `modifyAttack.extraBoostCards` adds to the activation in progress, but nothing removes its boost card.

**Cards.** Master Mold I–III (32109–32111), from a forced interrupt "When Master Mold schemes against you … Do not give
Master Mold a boost card for this activation."

**Plan.** **`modifyAttack.noBoost?: true`**: an activation var set from an interrupt to `enemyScheme`/`enemyAttack`,
read at `giveBoost` beside `extraBoost` (no automatic boost card, no extra ones). Boost cards dealt to the enemy
outside its activation still resolve (RRG 1.8 "Boost", p. 11). **DSL:** `modifyAttack({ noBoost: true })`.

**Composes with:** the Horsemen (`aoa` 45092–45095) and the Civil War cards with the same sentence.

### 3.16 Giving a chosen card as a boost card

> **Status: partial.** `EffectSpec giveBoostCard { enemy, count? }` (`spec.ts` ~line 2105) deals from the encounter
> deck's top.

**Cards.** Master of Magnetism (32151): "Take the topmost [Magnetic] card in the encounter discard pile and give it to
Magneto as a facedown boost card. Magneto activates against you."

**Plan.** `giveBoostCard.card?: TargetRef`: that card (from any out-of-play zone) goes facedown onto the enemy as a boost
card dealt outside its activation, which then resolves in the activation that follows. No card found, nothing given.
**DSL:** `giveBoostCard(theVillain, { card })`.

### 3.17 Resolving "When Defeated" abilities on demand

> **Status: partial.** `resolveSpecials.trigger?: "special" | "whenRevealed"` (`spec.ts` ~line 1532, wave 4 §3.56).

**Cards.** Zeal for the Cause (32164): "Resolve the 'When Defeated' ability of each [Acolyte] minion engaged with you.
If you are not engaged with an [Acolyte] minion, discard cards from the encounter deck until a minion is discarded,
then reveal it."

**Plan.** Add `"whenDefeated"`: the printed When Defeated abilities of each card, with the card still in play; "the
player who defeated [this card]" reads the resolving player (§4 Q10). `<bind>.count` as today.

### 3.18 Main scheme stages shuffled at setup

> **Status: missing.** A main scheme's stages are in a fixed order (`MainSchemeState.stageIndex`, `state.ts` ~line 337).

**Cards.** The Brotherhood Strikes! 1A (32125a, §1.5).

**Plan.** **`EffectSpec shuffleMainSchemeStages { fromStageIndex }`** (seeded RNG), storing the order on the main scheme's
state (`MainSchemeState.stageOrder?: readonly number[]`) so advancing walks it; log `mainSchemeStagesShuffled` with the
order hidden from the client view until each stage is revealed. Check how alternative stages (Kang's stage 3, same
number) are skipped by the advance today, and make the shuffled list the authority when present.

### 3.19 A main scheme stage in the victory display

> **Status: missing.** The victory display holds instances (`GameState.victoryDisplay`); a main scheme stage is not
> one, and `victoryDisplayCount` cannot count it.

**Cards.** The Brotherhood Strikes! 1B, The Atrium, The Cafeteria, The Basketball Court, The Courtyard (32125b–32129b):
"Add this card / this scheme to the victory display … If there are 3 main schemes in the victory display, the players
lose the game."

**Plan.** **`EffectSpec addMainSchemeStageToVictoryDisplay`**: creates an out-of-play instance of the main scheme card
fixed at the current stage (name, traits, stage number read from that stage) in the victory display, then the stage
advances as usual. `victoryDisplayCount { categories: ["mainScheme"] }` counts it. From 1B's When Revealed it runs
before the advance; from 2B's When Completed (wave 4 §3.4, completion replaceable) before the normal advance. The loss
is a `stateCheck` on the count.

### 3.20 An encounter-set ally that is a player's card for one game

> **Status: partial.** `moveCards.into` puts an encounter card in a player's deck **unowned** (wave 5 §3.5), so a drawn
> Captive ally would meet §4.1 Q4's fallback and be dealt as an encounter card.

**Cards / rules.** MC32 pp. 12, 16, 19: "Each CAPTIVE ally recorded in the campaign log may be shuffled into any
player's deck." Rictor, Boom Boom, Cannonball, Wolfsbane (32089–32092), printed cost 2. Also: Rescue Captives puts a
player's own ally from under it into play under another player's control (owner unchanged).

**Plan.** `moveCards.owner?: "destinationPlayer"`: the card becomes that player's for the rest of the game (playable,
paid for, discarded to their discard pile; RRG 1.8 "Ownership and Control", p. 31); the campaign setup creates the
ally set aside (`setAsideCards`), and an in-game instruction has the first player choose the deck (`choosePlayer`,
§4 Q14). Each game rebuilds decks, so nothing needs removing afterwards.

### 3.21 A villain sequence of different titles (Mansion Attack)

> **Status: exists (verify).** `Scenario.startingVillain: "random"` with `setAsideVillainCardIds` and `expertVillains`,
> `victory: "cardAbility"` and `victoryCondition` (wave 4 §1.11/§3.7, `packages/engine/src/resolve/villain-swap.ts`); a
> defeated last stage with Victory X goes to the victory display (`defeatVillainStage`); zero villains in play is a
> legal state (wave 5 §3.1, `set-aside-villains.test.ts`); `addVillain` with `reveal` re-admits a set-aside villain,
> and `encounterSetAside { random }` picks one from the seeded RNG.

Save the School: `response(on.defeated(theVillain), ifThen(compare(victoryDisplayCount(villains), "atLeast",
victoryCondition), endGame("win"), [dealEncounterCard(each), addVillain(random set-aside villain, { reveal }), …]))`.
`advanceToSetAsideVillain` is title-bound (Loki) and does not fit. **To verify in a scenario test** before scripting: a
single-villain game whose villain is defeated with Victory 2 and no set-aside stage of its title waits for the
response with no villain in play (no win, no auto-advance); the new villain gets its tough card; an activation the old
villain was making ends (RRG 1.8 "Villain Defeat", p. 47). If any step fails, it becomes a partial here.

### 3.22 Shadowcat's mass form

> **Status: exists.** Wave 4 §3.1, `packages/engine/src/additional-forms.test.ts`: `changeAdditionalForm`,
> `inAdditionalForm`, `printedForm`, `cannotChangeForm { formType }`, `formChanged.change: "additional"`, a double-sided
> form card flipping; `characterIgnores` (wave 4 §3.24) for Selective Intangibility.

- Kitty Pryde's Setup is the Vision precedent (`packages/cards/src/wave4/vision/vision-kit.ts`, `26001b.setup`):
  find the mass form upgrade in deck and hand, put it into play (Solid up). See §4 Q15.
- **"Flip this card" on Solid and Phased is `changeAdditionalForm("mass")`, never a bare `flipCard`**, so it counts as a
  form change (RRG 1.8 p. 21) for Ready to Rumble (32051) and Perseverance (32016). Phase Control (32030b, "Flip your
  mass form upgrade. (Limit once per round.)") keeps its limit across hero/alter-ego flips (ruling Jan 26, 2026 (6) #2).
- Phased (32031b): "While Shadowcat is defending, she cannot take damage" is `cannotTakeDamage` while
  `attackInProgress { defender: yourIdentity }`; "After you attack or defend in Phased mass form, flip this card" hears
  the existing `attack` and `defended` events. FAQ "Powerful Punch (#14)" (p. 63) is the QA fixture: an attack-labeled
  interrupt counts as attacking (flip), and she then defends that attack (flip again).
- Permanently Phased (32055): "Flip your mass form upgrade to Phased" is `changeAdditionalForm("mass", { toName:
"Phased" })`; "You cannot attack, defend or change mass form" is `cannotAttack`, `cannotDefend`, `cannotChangeForm {
formType: "mass" }`.

### 3.23 Campaign roles

> **Status: exists (compose)**, plus §1.1's data. Foundation rows 29, 33, 43 (`docs/campaign-mode-design.md`), all in
> `packages/engine/src/campaign.ts`: a `choice` log field; `strike` + `fieldOptions { unstruckOnly }` for "each player
> must choose a different role" (seats choose in order from what is left); `random` from `campaignSet` for "1 random
> upgrade from their role's set" (one `if` per role, or a `campaignSet` id read from §1.1's `roles`); `setAsideCards` +
> an in-game `putIntoPlay` under the seat; `removeFromCampaign` for "Remove each role upgrade that began the game in
> play" (Victory) and for the card's own "Remove this card from the game and the campaign pool" (in game, kept across a
> retry by RRG 1.8 p. 29); `choose` from `collection { categories: ["event"] / ["upgrade"], aspects }` with `grantCard
{ permanence: "thisGame" }` for role-building (`expiringGrants`).

**Verify:** that a `random` over a `campaignSet` skips cards removed from the campaign (the role pool shrinks), and that
two seats cannot strike the same option.

### 3.24 The Future Past deck across the campaign

> **Status: exists (verify).** `composeEncounterSets { into: "setAside" }`, `buildScenarioDeck` / the `scenarioDeck`
> selector (wave 4 §3.6), the `campaignLog` card selector, `cardList` over the `encounter` selector plus cards in play,
> `cardsInVictoryDisplay`, `removeFromCampaign`.

Setup: compose Future Past set aside; move the recorded titles into the encounter deck (shuffle); build the "Future
Past" scenario deck from the rest (minus removed cards). Each campaign side scheme's "Shuffle the top card of the Future
Past deck into the encounter deck" moves the deck's top card. Victory: Future Past cards in the victory display →
`removeFromCampaign`; those in the encounter deck, discard pile and in play → the log (§4 Q13 for anywhere else).
**Verify** that `buildScenarioDeck` runs from a campaign in-game instruction over set-aside cards.

### 3.25 Reusable as is (checked against the engine unions)

| Printed wording                                                                                                                          | Cards                                                                                                              | Existing vocabulary                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Attach the Robert Kelly to [Find the Senator] … in play but under no player's control"; "If Robert Kelly leaves play, the players lose" | Stalked by Sabretooth, Robert Kelly                                                                                | wave 4 §3.8 (Odin): `attach`, `cannotHaveAttachments`, `controlledByFirstPlayer`, `excludedFromAllyLimit`, `leavingPlayLoses`                                              |
| "When an enemy resolves an undefended attack against you, deal the damage to Robert Kelly"                                               | Robert Kelly                                                                                                       | interrupt to `damage(yourIdentity, { fromAttack })` with `currentAttack undefended`, `instead(dealDamage(…, eventAmount))` (verify; §4 Q4)                                 |
| "While Robert Kelly is attached to Find the Senator, treat his text box as if it were blank"                                             | Stalked by Sabretooth 1B                                                                                           | `blankTextBox` with `isAttached`                                                                                                                                           |
| "Advance to main scheme 2A. Flip this card and place it next to the main scheme"; side scheme ↔ other face                               | Find the Senator, Mutants at the Mall, 171A–175A, Boarding Party, Orbital Decay                                    | `advanceMainScheme`; wave 4 §3.10 / §3.37 flip into a separately emitted face; verify tucked cards stay on a flip (Find the Prisoners → Rescue Captives)                   |
| "Place … facedown under this scheme"; "the top 6/9 cards of their deck facedown under here"                                              | OZT, Night of the Sentinels, Mutant Detected, Warn the Others, Seized!, Bastion's Machinations, Find the Prisoners | `tuckCards { facedown }`, `tucked`; RRG 1.8 "Tuck" (p. 45): discarded when the host leaves play                                                                            |
| "Operation Zero Tolerance gains permanent"                                                                                               | Night of the Sentinels                                                                                             | `gainsKeyword`; granted permanent is read (`keywords.ts` `isPermanent`), set-aware (wave 5 §4.1 Q46)                                                                       |
| "Discard cards from the encounter deck until a [Sentinel] minion is discarded"; "each player …"                                          | Master Mold, Sentinel Factory, Agenda, Intruder Alert!, Mutant Terrorists, Fabian Cortez                           | `discardEncounterUntil`, `forEachPlayer`                                                                                                                                   |
| "If it did not enter play this way"; "Otherwise, this card gains surge"                                                                  | Mutant Terrorists, Shields Up, Energy Barrier, Homo Superior                                                       | `putIntoPlay.bind`, `giveStatus.bind`, `isAttached` (wave 4 §3.58–§3.60)                                                                                                   |
| "Take 1 random set-aside [Captive] ally and put it into play under their control"                                                        | Abduction Protocols                                                                                                | `encounterSetAside { random }`, `putIntoPlay`                                                                                                                              |
| "Heal damage … equal to the number of boost icons discarded this way"; "for each printed resource icon"                                  | Sabretooth, Nimrod's Portal, Pyro                                                                                  | `discardEncounterCards.bind` + `boostIcons`, `totalPrintedResources`                                                                                                       |
| "Mystique's SCH is equal to the villain's SCH"; "Players cannot attack the villain"                                                      | Mystique 32080                                                                                                     | `StatModifierSpec` base replacement with `stat`; `cannotAttack`                                                                                                            |
| "Each character gains steady / retaliate 1 / +1 ATK"; "Each ally and minion gains toughness"                                             | The Atrium, Cafeteria, Courtyard, Basketball Court                                                                 | `gainsKeyword`, `gets`; toughness only on entering play (RRG 1.8 "Toughness", p. 45)                                                                                       |
| "When Magneto would take any amount of damage, place it here instead. Then, if there is 8 or more damage here, discard this card"        | Magnetic Bubble                                                                                                    | wave 5 §3.29 `instead` + `placeDamage`; damage on a non-character (wave 4 §3.5)                                                                                            |
| "Magneto cannot be stunned / confused"                                                                                                   | Magneto's Armor, Magneto's Helmet                                                                                  | `cannotHaveStatus`                                                                                                                                                         |
| "While you are engaged with a [Sentinel] minion, you cannot change from hero form to alter-ego form"                                     | Targeted for Elimination                                                                                           | `cannotChangeForm` with `while: and(form hero, engaged …)`                                                                                                                 |
| "Each player engaged with a [Sentinel] minion cannot thwart this scheme"                                                                 | Relentless Robots                                                                                                  | `cannotThwart { schemes }`                                                                                                                                                 |
| "The villain's attacks gain piercing and ranged"; "Wolverine's/Senyaka's attacks gain piercing"                                          | Gauntlet Beam, Wolverine ally, Wolfsbane, Senyaka                                                                  | `attackKeywords`                                                                                                                                                           |
| "Deal this card to yourself / to that player as a facedown encounter card"                                                               | Bastion, Sentinel Mark VI                                                                                          | `dealAsEncounterCard`                                                                                                                                                      |
| "Give the villain … a facedown boost card"; "give him an additional boost card for this activation"                                      | Delgado, M-Type Sentinel, Ground Swell … Hopping Mad                                                               | `giveBoostCard`; `modifyAttack.extraBoostCards` (verify it deals during the flip stage when given by a boost ability)                                                      |
| "When the villain would activate, change to hero form" (erratum p. 68)                                                                   | Armor Up                                                                                                           | `enemyActivating` (wave 5 §3.2), `changeForm`                                                                                                                              |
| "Put an [X-Men] ally into play from your hand. Exhaust it and declare it the defender"                                                   | Mutant Protectors (FAQ p. 63)                                                                                      | `putIntoPlay`, `declareDefender`                                                                                                                                           |
| "Spend a [energy] resource and return Nightcrawler to your hand → prevent all of that damage"                                            | Nightcrawler                                                                                                       | `AbilityCost.returnToHand` + `resources`; `preventDamage`                                                                                                                  |
| "+6 ATK for that attack. That attack gains overkill"; "this attack deals 3 additional damage and gains overkill"                         | Made of Rage, Coup de Grâce                                                                                        | `modifyStat("atk", …, "endOfAttack")` + `modifyAttack({ overkill })` (Spider-Ham's Huge Wooden Hammer); for an attack event, `modifyCardEffect` (verify for Coup de Grâce) |
| "Generate a [physical] resource for each tough status card on Colossus"; "for a player whose identity has [X-Men]"                       | Titanium Muscles, The X-Jet                                                                                        | resource from table (wave 4 §3.38); `forAnyPlayer`                                                                                                                         |
| "Discard an attachment with the text 'Hero Action' or 'Hero Response'"                                                                   | Phase Strike                                                                                                       | wave 4 §3.33 text query                                                                                                                                                    |
| "When attached enemy would attack, discard this card instead. Then, confuse that enemy"                                                  | Phased and Confused                                                                                                | interrupt to `enemyAttack` + `cancelTriggeringEvent`                                                                                                                       |
| "Exhaust your hero and any number of [X-Men] allies → deal X damage among enemies"                                                       | Team Strike                                                                                                        | `exhaustCards`/`exhaustIdentity` bind, `totalStatOf`, `divide`                                                                                                             |
| "Each player may place 1 acceleration token on the main scheme to heal their identity to its full hit point value"                       | MC32 expert setup, scenarios 2–5                                                                                   | the MC21 instruction in `packages/cards/src/campaigns/mts.ts` (~line 175); extract to a shared helper                                                                      |
| Persistent damage capped at base; expert loss of scenario 5 loses the campaign                                                           | MC32 p. 5, p. 19                                                                                                   | `remainingHitPointsCappedAtBase`, foundation rows 15, 18                                                                                                                   |

**Pass 2a (Cyclops, Phoenix, Wolverine).** §3.26–§3.43 were searched for by behavior the same way (the unions above,
the `@mc/cards` DSL, wave 1–5 specs, 2026-10-01); what composes is §3.44. Several engine docblocks already name these
packs' cards (Mind Control, Phoenix Force, Fastball Special, Longshot, Sunfire, Psychic Rapport).

### 3.26 Temporary keyword

> **Status: missing.** `KeywordInstance` `temporary` exists (`packages/content/src/schema/keywords.ts`) and is emitted
> on 33005–33007; the engine never reads it. The timing point exists: `phaseEnding { phase: "villain" }` is the round's
> end (`flow.ts` `executeEndOfRound`, after "until the end of the round" effects expire).

**Cards.** Exploit Weakness, Practiced Defense, Priority Target (33005–33007). **Rules.** RRG 1.8 "Temporary" (p. 44):
"A card with temporary must be discarded from play at the end of the round … equivalent to … '**Forced Interrupt**:
When the round ends, discard this card from play.'"

**Plan.** A keyword-sourced forced interrupt to `phaseEnding { phase: "villain" }`, one per card in play for which
`hasKeyword(…, "temporary")` holds at that moment (so a keyword lost through §3.13 exempts it, and a granted one
counts), discarding it to its owner's discard pile. `heard` must count it as a listener. Log `keywordResolved {
keyword: "temporary" }`. **Composes with:** Move in Shadow (60027), The Best Offense… (60052), Lion of Olympus (59016).

### 3.27 "You take the first turn during the player phase"

> **Status: missing.** `beginPlayerPhase` (`packages/engine/src/flow.ts` ~line 274) takes turns in `playerOrder`.

**Cards.** Field Commander (33004): "You take the first turn during the player phase. (When your turn is done, play
proceeds in player order, starting with the first player. You do not take another turn.)" **Rules.** RRG 1.8 "First
Player" (p. 19), "In Player Order" (p. 24).

**Plan.** **`RuleSpec takesFirstTurn { player: PlayerRef; while? }`**, read by `beginPlayerPhase`: that player's turn
first, then `playerOrder` without them. The first player token does not move, and every other "in player order"
sequence (villain activations, encounter cards, interrupt/response priority) is unchanged. Read when the phase begins
(§4 Q16). **DSL:** `takesFirstTurn(you)`. Field Commander's second sentence is §3.13 (`losesKeyword({ name:
"temporary" }, …)` over upgrades with `identitySetTitled: ["Cyclops"]` whose `host` is a minion), after §3.26.

### 3.28 "Max 1 [TRAIT] upgrade per ally" / "Max 1 [TRAIT] card per player"

> **Status: missing.** `PlayRestrictions.maxPerHost` / `maxPerPlayer` (`schema/cards/player-cards.ts`) count copies of
> the same title only; 33015 and 34016 are emitted with no restriction.

**Cards.** Danger Room Training (33015), Mission Training (34016): "Attach to an X-MEN ally. Max 1 TRAINING upgrade per
ally." **Plan.** **`PlayRestrictions.maxWithTrait?: { trait: Trait; per: "host" | "player"; max: number }`**, schema +
validation + the engine's play legality check (the one `maxPerHost` uses): the card cannot be played onto a host (or
under a player) that already has `max` cards with that trait, printed or gained. A put-into-play still obeys it (RRG 1.8
"Max, Maximum", p. 28). **Composes with:** Uncanny X-Men (`storm` 36018, pass 2b), Uncanny X-Force (40022), Flight
Squadron (53020), all "Max 1 TEAM card per player".

### 3.29 Additional damage for a player attack in progress

> **Status: partial.** `modifyAttack` (`spec.ts` ~line 1120) already writes `overkill` and `keywords` onto the
> innermost `attack` frame (`currentActivationFrameId`, `stack.ts`), but its damage bonus `atkBonus` is read for enemy
> activations only. A basic attack takes `modifyStat(..., "endOfAttack")`, an event `modifyCardEffect`; an "(attack)"
> ability on an identity or upgrade has neither.

**Cards.** Full Blast (33008, "When you use your 'Optic Blast' ability, exhaust Cyclops → this attack deals 8 additional
damage and gains overkill"), Warrior Skill (35016, "When your hero attacks, remove 1 counter from here → that attack
deals 1 additional damage", any attack). **Plan.** **`modifyAttack.extraDamage?: ValueSpec`**, an attack-frame var
added to the damage a player attack deals (basic or ability; after the amount is computed, beside `cardEffectBonus`).
"When you use your 'Optic Blast' ability" is the existing interrupt pattern `{ on: "attack", sourceIs: <your identity>,
attackKind: "ability" }`: Optic Blast is the identity's only attack ability. **DSL:** `modifyAttack({ extraDamage })`.
**Composes with:** Coup de Grâce (32176/32181), which pass 1 §3.25 left to verify.

### 3.30 A resource ability's effect on the ability it pays for

> **Status: partial.** Wave 4 §3.30 (`resource-effects.test.ts`): a resource ability's effects resolve with the payment,
> slot `paidFor` = the card paid for; `generatesFor` (`abilities.ts` ~line 1475) restricts it to a matching card.

**Cards.** Ruby Quartz Visor (33003): "Exhaust this card → generate a [energy] resource for your 'Optic Blast' ability.
That attack gains piercing and ranged." `generatesFor` matching your identity already gives "for your Optic Blast"
(for an ability cost `payingFor` is the ability's card, and Optic Blast is Cyclops's only cost with resources). The
gap is "that attack": the effects run before the ability makes it. **Plan.** **`applyRuleUntil.until:
"endOfPaidFor"`**: the rule (here `attackKeywords { via: paidFor }`) lasts until the paid-for ability or card finishes
resolving, read from the payment's frame. Only that use's attack is touched; a later Optic Blast is not.

### 3.31 Changing an ally's consequential damage

> **Status: partial.** `cancelConsequentialDamage` (`spec.ts` ~line 1212, Cosmo) and the `consequential` flag on
> `dealDamage` events (pattern field, `abilities.ts`) exist; no rule changes the amount.

**Cards.** Dust (33012, "[star] Interrupt: When Dust attacks a minion, she attacks each minion in play. Dust takes +1
consequential damage after this attack"; the first half is `resolveAttackAgainst`, wave 4 §3.22), Coordinated Attack
(33016, "Each ally takes -1 consequential damage when attacking attached minion"). **Rules.** RRG 1.8 "Consequential
Damage" (p. 13). **Plan.** `reduceDamageTaken` / `increaseDamageTaken` gain **`consequential?: true`**, matching only
consequential damage, and the pushed consequential `dealDamage` event carries the attack's `targetInstanceId` so a
`while` can ask "attacking attached minion". Dust's is one-shot: **`EffectSpec modifyConsequentialDamage { character,
amount }`**, the signed sibling of `cancelConsequentialDamage` on the same pending damage.

### 3.32 A basic attack made with THW

> **Status: partial.** `thwartWithAtk` (`abilities.ts` ~line 520) is the mirror (a thwart with ATK, a constant), and
> `modifyBasicPower` (`spec.ts` ~line 1205) changes "this use".

**Cards.** Befuddle (33033): "Interrupt: When a character makes a basic attack against attached minion, that character
uses their THW instead of their ATK." **Plan.** **`modifyBasicPower.useStat?: "thw"`**: for this use the power's value
is the character's THW with its THW modifiers, and ATK modifiers do not apply (§4 Q22). Consequential damage stays the
ATK field's (it is still an attack).

### 3.33 A printed stat as a value

> **Status: partial.** `ValueSpec stat` is the current value; `printedCost` and `printedHp` exist; the
> `treatHostAsAlly` rule's `thwFromSch` reads a printed SCH internally.

**Cards.** Marvel Girl (34015): "remove X threat from the main scheme, where X is that minion's printed SCH." **Rules.**
RRG 1.8 "Printed" (p. 35). **Plan.** **`stat.printed?: true`**, read from the card data (a "—" or star value reads 0).
**Composes with:** Concentrated Fire (50037).

### 3.34 "Cannot activate"

> **Status: missing.** No rule stops an enemy's activation; stun only replaces an attack.

**Cards.** Mental Paralysis (34008): "Attached minion cannot activate." **Rules.** RRG 1.8 "Activation" (p. 6):
"Whenever an enemy attacks or schemes, it is considered to have activated." **Plan.** **`RuleSpec cannotActivate {
target: TargetQuery; while? }`**, read wherever an `enemyAttack` or `enemyScheme` would begin (villain phase step 2, an
effect's "X attacks/schemes", quickstrike, teamwork §3.1): it does not begin, no boost card is dealt, logged
`activationBlocked`. §4 Q19. **Composes with:** Target Spotter (51038), Distraction (44054), Wrapped in Metal (49007).

### 3.35 A scheme activation that removes threat instead

> **Status: missing.** `modifyAttack.threatBonus` changes the amount of an `enemyScheme`; nothing reverses it.

**Cards.** Psychic Manipulation (34017): "Interrupt (thwart): When the villain schemes, this activation removes threat
instead of placing it." **Plan.** **`modifyAttack.removesThreat?: true`** on the scheme activation in progress: at its
place-threat step the computed amount (SCH, boost icons, modifiers) is removed from the scheme it would have gone on,
by the playing player as a thwart (the label), so a crisis icon applies (§4 Q17). No `placeThreat` event; a
`removeThreat` one. **Composes with:** Informant (50050).

### 3.36 An enemy attack's damage dealt to another enemy

> **Status: partial.** Robert Kelly's redirect is an interrupt to the damage event with `instead` (pass 1 §3.25);
> `retargetAttack` changes the attacked character, never to an enemy.

**Cards.** Psychic Misdirection (34033): "Hero Interrupt (defense): When an enemy attacks you, choose a different enemy
→ damage from that attack is dealt to the chosen enemy instead of you." **Rules.** RRG 1.8 "Defend, Defense" (p. 15):
the defense label makes your identity the defender. **Plan.** **`modifyAttack.damageTo?: TargetRef`**, an attack-frame
var bound at the interrupt and read where the attack deals its damage: that damage goes to the chosen enemy as attack
damage from the attacker (§4 Q18). Not an attack on that enemy.

### 3.37 An enemy's scheme threat placed on a named side scheme

> **Status: partial.** `RuleSpec schemeThreatDestination { enemy, scheme: "ownSignatureSideScheme" }` (`abilities.ts` ~line
> 626, the Wrecking Crew).

**Cards.** Dark Phoenix (34029): "[star] When Dark Phoenix schemes, place that threat on Consume the World, if able."
**Plan.** `scheme: "ownSignatureSideScheme" | TargetRef` (`named("Consume the World")`); the main scheme when the
ref finds nothing in play. **Composes with:** Covert Surveillance (50038), Show of Empathy (51017), Butler (44033).

### 3.38 A scheme losing a printed icon

> **Status: partial.** `RuleSpec gainsIcon { icon, target, count?, while? }` (`abilities.ts` ~line 830); blanking clears
> all icons (`blanked-scheme-icons.test.ts`).

**Cards.** Consume the World (34030): "While there is no threat here, this scheme loses the [amplify] icon." **Rules.**
RRG 1.8 "'Loses'" (p. 27). **Plan.** `gainsIcon.loses?: true` (or a negative `count` floored at 0 per card), applied
after gains where icons are counted. **DSL:** `losesIcon("amplify", self, { while })`.

### 3.39 A bonus for the next basic thwart or attack

> **Status: missing.** Lasting stat modifiers end on a clock (`lasting.ts`); "next card played" cost reductions are the
> only effects consumed by use.

**Cards.** Psychic Kicker (34034): "Ready an ally. That ally gets +2 THW and +2 ATK for its next basic thwart or attack
action this phase." **Plan.** **`modifyStatUntil.until: { kind: "nextBasicPower", powers: ["attack", "thwart"] }`**
(capped by the end of the phase): the modifier ends when that character's next matching basic power finishes, both
stats together (§4 Q23). **DSL:** `modifyStat(..., { nextBasic: ["attack", "thwart"] })`.

### 3.40 The basic recovery as an event

> **Status: partial.** `basicRecover` (`actions.ts` ~line 3396) heals inside the command and then announces
> `basicPowerUsed { power: "recover" }` (so Jean Grey's star response already composes); `basicPowerUsing` is not
> pushed for a recovery. Wave 2 §17.4 named the change.

**Cards.** Death Factor (35030): "Alter-Ego Interrupt: When you make a basic recovery, discard this card instead of
healing damage." **Rules.** RRG 1.8 "Recover, Recovery" (p. 36). **Plan.** Wave 2 §17.4's change: the recovery gets an
event frame whose apply step heals by the current REC; `basicPowerUsing { power: "recover" }` precedes it, and an
`instead` there replaces the healing only (§4 Q20). Pairs with §3.14 (`cannotRecover`).

### 3.41 "Take N damage" is not damage the card deals

> **Status: partial.** `modifyCardEffect` adds to every `dealDamage` its card's frame makes (`resolve/apply-effect.ts`
> ~line 244), and the DSL's `takeDamage` is `dealDamage` to your identity.

**Cards.** Berserker Barrage (35008, erratum p. 68: "If this attack defeats an enemy, you may take 2 damage to repeat
this ability") with Aggressive Energy (35020, "that event deals 1 additional damage"). **Rules.** Ruling Jul 9, 2026
(3) #4: "Aggressive Energy increases damage dealt to enemies, not to Wolverine." **Plan.** **`dealDamage.taken?:
true`** (set by `takeDamage`): no `cardEffectBonus`, still damage from that card for every other purpose. The repeat is
`repeatWhile` (wave 4 §3.54). §4 Q21.

### 3.42 Playing a chosen card from an ability, and remembering how

> **Status: partial.** `playFromHand { ignoreCost, filter }` (`spec.ts` ~line 1766, Chaos Magic) has the player choose
> as it resolves; the cost-side card pick and `AbilityCost.damageSelf` exist; nothing records what played a card.

**Cards.** Wolverine's Claws (35002): "Exhaust Wolverine's Claws, choose an ATTACK event in your hand, and take damage
equal to its printed cost → play that event, ignoring its resource cost. That attack gains piercing." Lunging Strike
(35010): "If you exhausted Wolverine's Claws to play this card, this attack gains overkill." **Plan.**
`playFromHand.card?: TargetRef` (the card picked in the cost) and **`playFromHand.via`**: the play records the
ability's card in the played card's vars; **`Predicate playedVia { card: TargetQuery }`** reads it while the card
resolves. "That attack gains piercing" is `applyRuleUntil(attackKeywords { via: that card }, "endOfPaidFor")`-shaped
(§3.30's scope, keyed on the played card). The damage cost reads `printedCost` of the picked card.

### 3.43 A lasting bonus for basic attacks against one enemy

> **Status: partial.** `modifyStatUntil { affects, until: "endOfPhase" }` re-reads its `amount` on every read;
> `Predicate attackInProgress { attacker, target, defender }` has no basic/ability filter.

**Cards.** Jubilee (35003): "choose an enemy. Until the end of the phase, while Wolverine or Jubilee is making a basic
attack against that enemy, they get +2 ATK for that attack." **Rules.** Ruling Jun 2, 2026 (1): keyed on the chosen
enemy, stacking per trigger, and the same for every Jubilee or Wolverine card. **Plan.** `attackInProgress.basic?:
boolean`, then `modifyStatUntil("atk", 2, { affects: titled(["Wolverine", "Jubilee"]), while: attackInProgress({
attacker: <the reader>, target: chosen enemy, basic: true }) })` — the `while` must be read per affected card ("the
reader"), which `affects` amounts are not today: verify, or add a `self`-relative reading.

### 3.44 Reusable as is (Cyclops, Phoenix, Wolverine)

| Printed wording                                                                                                                                                      | Cards                                                                                                 | Existing vocabulary                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Spend one resource of any type → deal 3 damage to an enemy with an upgrade attached. (Limit once per round)"                                                        | Optic Blast (33001a), Ricochet Beam                                                                   | `resources` cost, `hasAttachment`, round limit; FAQ "Ricochet Beam (#9)" (p. 64) is a QA fixture: one attack, two damage events, Exploit Weakness adds 1 to each (`increaseDamageTaken { fromAttack }`, per damage event) |
| "Attach to an enemy. Max 1 per enemy"; "-1 ATK"; "the player who defeated it draws 2 cards"                                                                          | Cyclops's three tactics, Pinned Down, Marked                                                          | `maxPerHost`, `gets`, `when.defeated(host)` + `defeatingPlayer`; Marked's "attacks against attached minion gain overkill" is `attackKeywords` with `while: attackInProgress({ target: host })` (verify)                   |
| "Search your deck for a TACTIC upgrade"; "Choose a TACTIC / Cyclops card in your discard pile"                                                                       | Scott Summers, Tactical Brilliance, Phoenix ally                                                      | search, `chooseCards` from discard, `identitySetTitled`                                                                                                                                                                   |
| Lost Visor: search four zones, tuck facedown; "Cyclops cannot attack"; exhaust Scott → retrieve, remove from game                                                    | 33027                                                                                                 | `tuckCards { facedown }`, `cannotAttack { attacker }`, obligations staying in play (Weakened `toafk` 11018 shape)                                                                                                         |
| "When attached enemy attacks, the attack gains overkill and piercing. At the end of this attack, discard"                                                            | Gene Therapy (data host: `superlative` lowest printed ATK)                                            | `modifyAttack({ keywords })`, `atEndOfAttack`                                                                                                                                                                             |
| "If Mister Sinister is in play, he schemes / attacks you. Otherwise …"                                                                                               | Concussive Force, Fiery Rage, Seeking Vengeance                                                       | `enemyScheme`/`enemyAttack`/`enemyActivation`, form conditions                                                                                                                                                            |
| "Exhaust an ally you control → add that ally's matching power to your hero's power for this use"                                                                     | Teamwork (33017)                                                                                      | Thor's Teamwork (`wave1/thor/pack-cards.ts` 06032)                                                                                                                                                                        |
| "When you spend this card to play an ally / THWART event / ATTACK event"                                                                                             | Effective Leadership, Passion for Justice, Aggressive Energy                                          | `resourcesSpent` interrupt (wave 2 §12), `modifyCardEffect` (§3.41 for Berserker Barrage)                                                                                                                                 |
| "If each of your allies has X-MEN, increase your ally limit by 1"; "Reduce the cost to play Angel by 1 if …"                                                         | Utopia, Angel, Storm, Colossus (35021)                                                                | `allyLimit` with `while`; `costModifier { appliesTo: self, activeIn: "hand" }` (Winter Soldier)                                                                                                                           |
| "Any player whose alter-ego has the MUTANT trait may trigger this ability"                                                                                           | Danger Room                                                                                           | pass 1 §3.11 (`triggerableBy`)                                                                                                                                                                                            |
| "Team-Up (Cyclops and Phoenix)"; "Ready Cyclops and Phoenix"; "the total ATK of Colossus and Wolverine"                                                              | Psychic Rapport ×2, Soul Sisters, Fastball Special                                                    | wave 3 §3.34 (`titled`, `identitySetTitled`), `stat.total`                                                                                                                                                                |
| Phoenix Force: power counters, "You gain the RESTRAINED trait", flip after the last counter / at 4 counters                                                          | 34002a/b, Jean Grey's Setup and star response                                                         | `countersRemoved` (wave 4 §3.15), trait grant, `flipCard`; **the Unleashed side needs pass 1 §3.2** (`countersPlaced`); `basicPowerUsed { power: "recover" }`; Setup as Vision's (§4 Q25)                                 |
| "Remove 1 power counter from Phoenix Force → generate a [wild] resource. (Limit once per phase.)"                                                                    | Psionic Bond (34001a)                                                                                 | resource ability with `removeCounters` cost                                                                                                                                                                               |
| "Choose: • Remove 1 power counter → ready Phoenix • Place 2 power counters"; "Choose: • Exhaust Logan → …"                                                           | Phoenix Firebird, White Hot Room, Past Demons                                                         | `chooseOne` with option `condition`s (the core obligation shape)                                                                                                                                                          |
| "When you would be defeated, … ready your identity and restore it to its printed hit point value instead"; "by an enemy attack, … set your hit point dial to 5"      | Rise from the Ashes, "I Got Better"                                                                   | `when.defeated` + `instead`, `setRemainingHitPoints`, `printedHp`, `ready` (Too Stubborn to Die `drax` 19011; `identity-defeat-from-attack.test.ts`); §4 Q24                                                              |
| "When attached character would take damage from an enemy attack, place that damage here instead … at least 5"                                                        | Telekinetic Shield                                                                                    | wave 5 §3.29 `instead` + `placeDamage` (Magnetic Bubble)                                                                                                                                                                  |
| "Take control of attached minion and treat it as a CONTROLLED ally with a blank text box …"                                                                          | Mind Control                                                                                          | `treatHostAsAlly` (wave 4 §3.29)                                                                                                                                                                                          |
| "If you have the UNLEASHED trait"; "Phoenix gains AERIAL"; "While you have RESTRAINED, you gain steady"                                                              | Telekinetic Attack, Psychic Blast, Telepathic Trickery, Phoenix Suit                                  | `hasTrait` (granted traits count), keyword grant with `while`                                                                                                                                                             |
| "Play only if your identity has the PSIONIC / MUTANT / X-MEN trait"; "Hero form only"; "Play under any player's control. Max 1 per player"                           | Psychic events, Cerebro, Weapon X, Honorary X-Men, Longshot, Mental Paralysis, Down Time, Battle Fury | `PlayRestrictions`                                                                                                                                                                                                        |
| "Exhaust your hero and any number of X-MEN allies → remove X threat among schemes"                                                                                   | Mutant Peacekeepers                                                                                   | Team Strike's shape (pass 1 §3.25)                                                                                                                                                                                        |
| "When Storm thwarts a scheme, move 2 threat …"; "look at the top 5 cards of the encounter deck. Discard 1"                                                           | Storm ally (34021), Blindfold                                                                         | `moveThreat`; `lookAt` (wave 5)                                                                                                                                                                                           |
| "Make the following 2 attacks in order"; "If this removes the last threat"; "If this attack defeats that enemy"                                                      | Slice and Dice, Track by Scent, Precision Strike                                                      | several `attack` effects (FAQ "Dance of Death (#4)", p. 59), `thwart.bind` / `attack.bind`                                                                                                                                |
| "After the player phase begins, heal 2"; "After your turn ends, take 1 damage"                                                                                       | Healing Factor, Death Factor                                                                          | `phaseBeginning`, `turnEnding`                                                                                                                                                                                            |
| "Enters play with 2 psionic counters"; "Uses (3 warrior counters)"; "After you play Sunfire from your hand"; "discard … until you discard an identity-specific card" | Psylocke, Warrior Skill, Sunfire, Weapon X                                                            | Hawkeye's shape, uses, `cardPlayed` + `abilityTiming` (Sunfire is named in `spec.ts`), `discardDeckUntil` + `identitySetOf`                                                                                               |
| "Discard the top card of the encounter deck. If that card has a star icon … defeat the attacked minion"                                                              | Longshot (35033)                                                                                      | `starIcon` query (named in `spec.ts`), `defeat`                                                                                                                                                                           |
| Omega Red, Carbonadium Synthesizer, Lady Deathstrike, Adamantium Upgrades, Hack 'n' Slash, Tentacle Strike                                                           | `wolv` nemesis and Deathstrike sets                                                                   | `cannotBeDefeated` (Proxima Midnight), `discardFromHand { random }` + `ownerOf`, exact-type resource cost, `totalPrintedResources`                                                                                        |

---

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

None yet.

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently. **Proposed defaults are
flagged; none is implemented yet.**

1. **Teamwork: who activates** (§3.1). MC32 p. 3: "each minion that shares the teamwork keyword with the same specified
   trait activates" (its example: both Delgado and Senyaka activate). RRG 1.8 p. 43: "the minion that just entered
   play activates", with an equivalent single-minion forced response. **Default:** RRG 1.8, the later document; only
   the minion that entered play activates.
2. **Teamwork timing on a reveal** (§3.1). RRG 1.8 p. 43: after the minion's When Revealed. Ruling Feb 28, 2026 (4) #2
   moved quickstrike before When Revealed because it "triggers upon engagement"; teamwork's own wording is also "enters
   play and engages". **Default:** RRG p. 43 (after When Revealed); the ruling names quickstrike only.
3. **Modular difficulty** (MC32 pp. 7, 9): damage on Robert Kelly and facedown cards under Operation Zero Tolerance at
   setup, "if players wish to modify the difficulty". **Default:** 0 unless the players choose a number at setup; the
   setup screen offers the printed recommendation for the mode (skirmish 0, standard 1, expert 2, heroic 3). Data: a
   per-scenario optional setup number.
4. **Robert Kelly's interrupt** (§3.25): "When an enemy resolves an undefended attack against you" on a card the first
   player controls. **Default:** literal; only undefended attacks against his controller (the first player) are
   redirected, and the redirected damage is still that attack's damage (overkill, "if this attack defeats an ally",
   Sabretooth Strikes' boost). Attacks on other players hit them as normal.
5. **Several tough cards discarded at once** (§3.5): piercing against Colossus with two tough cards, Homesick,
   Rampaging Juggernaut. **Default:** one `statusDiscarded` per card in one shared response window, so Iron Will (no
   limit) draws once per card and Organic Steel (exhausts) triggers once.
6. **When does Shadowcat "ignore" guard, patrol or crisis?** (§3.8). **Default:** only when that keyword or icon would
   otherwise have stopped the attack or thwart she made; one event per card ignored, after the attack/thwart.
7. **Mystique's treacheries in hand versus wave 5's Q4 fallback** (§3.10). **Default:** MC32 p. 7 wins for cards that
   print "After this card enters your hand": they stay in hand with no replacement draw; every other encounter card
   drawn from a deck keeps the Q4 fallback.
8. **Several magnet counters placed at once** (§3.2): Magnetic Mayhem places one per [Magnetic] card discarded.
   **Default:** one `countersPlaced` event per placement with its amount; the scheme's response checks "at least 3"
   once and removes 3 (erratum p. 68), so placing 6 at once leaves 3 until the next placement.
9. **Damage beyond a cap** (§3.3, §3.4). **Default:** not taken and not prevented (no "after damage is prevented"
   triggers); excess-damage readers still see it as dealt (ruling Jan 26, 2026 (3)); Nimrod's tally counts damage
   taken only.
10. **"The player who defeated [this minion]" when Zeal for the Cause resolves a When Defeated** (§3.17). **Default:**
    the player resolving Zeal for the Cause.
11. **Expert rejoin** (MC32 p. 5): "the defeated player can rejoin … by placing an acceleration token on the main
    scheme". GMW's rejoin is free (ruling Jun 2, 2026 (3) #1); MC10's costs its obligation (`campaign-mode-design.md`
    Q19, each box read on its own terms). **Default:** the token is the price; the defeated seat places it in the same
    setup step where healthy seats may.
12. **A role upgrade in a lost game** (§3.23). Used: its own text removed it from the campaign pool, and RRG 1.8 p. 29
    keeps removals across a retry. Unused: only Victory removes it, so the retry deals a new random one. **Default:**
    as stated.
13. **A Future Past card neither in the victory display nor in the encounter deck, discard pile or play at game end**
    (Bastion's boost deals itself to a player as a facedown encounter card). **Default:** not recorded and not
    removed; it returns to the Future Past deck next scenario.
14. **Captive allies shuffled into "any player's deck"** (§3.20). **Default:** each is optional, the first player
    chooses the deck (group decision), and the ally is that player's card for the game.
15. **Permanent cards at setup** (§3.22): RRG 1.8 p. 32 sets permanent cards aside before setup step 1, but the engine
    keeps them in the deck and Vision's and Spectrum's Setups search deck and hand. **Default:** follow the Vision
    precedent for Kitty Pryde in this wave and record the RRG reading as a cross-wave follow-up (it changes three
    heroes' scripts and the deck-size count at once).

Pass 2a (Cyclops, Phoenix, Wolverine):

16. **Field Commander's first turn** (§3.27). **Default:** read when the player phase begins; a Field Commander played
    mid-phase changes the next player phase. The first player token and every other "in player order" sequence stay as
    they are (RRG 1.8 p. 19, p. 24); if Cyclops's player is the first player nothing changes.
17. **Psychic Manipulation and the crisis icon** (§3.35). RRG 1.8 "Crisis Icon" (p. 14): "threat cannot be removed from
    the main scheme by player cards". **Default:** the removal is the player card's thwart, so with a crisis icon in
    play a villain scheming against the main scheme places nothing and removes nothing (the placing is still replaced).
    Alternative: the activation is the villain's, so the crisis icon does not apply.
18. **Psychic Misdirection's redirected damage** (§3.36). **Default:** it is attack damage from the attacking enemy
    (its tough status card absorbs it; no excess spills anywhere); the chosen enemy is not attacked (no retaliate from it, no "when attacked"
    triggers); your identity defended and took no damage; the boost still resolves into the amount.
19. **"Cannot activate"** (§3.34). **Default:** it stops every attack and scheme by the minion, those a card effect
    initiates ("he attacks you") and quickstrike/teamwork included (RRG 1.8 "Activation", p. 6); its other abilities
    still work, and it stays engaged.
20. **Death Factor's replaced recovery** (§3.40). **Default:** only the healing is replaced; the alter-ego still
    exhausts and has made a basic recovery ("after you make a basic recovery" triggers). RRG 1.8 p. 36: with no damage
    to heal there is no basic recovery, so Death Factor cannot be shed at full hit points.
21. **"Take N damage" and card damage bonuses** (§3.41). Ruling Jul 9, 2026 (3) #4 names Aggressive Energy and
    Berserker Barrage. **Default:** generalized: no "that event deals N additional damage" bonus (Embiggen!, Cybernetic
    Arm, Aggressive Energy) ever adds to damage a player card says "you take".
22. **Befuddle's THW** (§3.32). **Default:** THW with THW modifiers; ATK modifiers (Jubilee, Danger Room Training,
    Mean Swing) do not apply; still a basic attack for every other purpose, with ATK-field consequential damage.
23. **Psychic Kicker's "next basic thwart or attack"** (§3.39). **Default:** the first of the two the ally makes this
    phase ends both bonuses; an "(attack)"/"(thwart)" ability or a defense does not consume it.
24. **Rise from the Ashes while Restrained.** "Remove each power counter from Phoenix Force" removes the last counter,
    so Restrained's forced response flips Phoenix Force to Unleashed. **Default:** literal, it flips (with no counters
    there nothing is removed and nothing flips).
25. **Permanent cards at setup (Q15).** Logan's erratum (RRG 1.8 p. 68) replaced "Search your deck and discard pile for
    the Wolverine's Claws upgrade and put it into play" (printed) with "Put Wolverine's Claws into play": FFG's own
    reading of RRG p. 32's set-aside rule. Jean Grey's Setup has the same wording. **Default:** Logan and Jean Grey
    follow Q15's choice in this wave; the erratum is recorded as evidence for Q15's cross-wave follow-up.

---

## 5. What this asks of the other agents

- **`card-data-pipeline`:** `curation/mut_gen.ts` passes 1 and 2 per the survey §9 steps 3–6, with §1's decisions, §1.9's
  corrections (errata, Electromagnetic Blast, Reactivate Defenses, the duplicate records), `Campaign.roles` and
  `Scenario.setAsideCardIds` once their schema lands, the two precons (MC32 p. 22).
- **`game-rules-architect`:** §1's two schema additions (`Campaign.roles`, `Scenario.setAsideCardIds`) and the
  `yourIdentity` qualifier, then §3 in the priority order; §3.21 and §3.24 are verification tests first.
- **`ability-scripting-engineer`:** script each scenario once its §3 rows are "landed"; §3.25 lists what composes now.
- **`encounter-ai-designer`:** first-player choices: Robert Kelly's controller, Save the School's next villain reveal,
  the deck a Captive ally goes into, Mutant Detected's choice (the revealing player's).
- **`rules-qa-engineer`:** FAQ fixtures p. 63 (Powerful Punch with Phased Shadowcat; Mutant Protectors' defender leaving
  play; White Queen with steady; an ally defeated and returned to hand going under OZT) and p. 64 (Fabian Cortez); a
  Mansion Attack game reaching the standard win at two villains and the loss at three main schemes in the victory
  display; the Magneto scenario's three damage caps in order; the full campaign with a retry.
- **`game-client-engineer`:** the mass form card; cards facedown under a scheme (counted, owners hidden); Robert Kelly
  attached and uncontrolled; Mansion Attack's victory display (villains and main schemes); magnet counters; the role
  choice and role-building screens; the campaign log fields (§1.7).

## 6. Pass 2: hero packs

### 6.1 Pass 2a: Cyclops, Phoenix, Wolverine

Read 2026-10-01: every record of `packages/content/raw/marvelcdb/{cyclops,phoenix,wolv}.json` against the emitted
`packages/content/src/data/<pack>/cards.ts`; scans for 34003, 34016, 34028, 34031, 35001b, 35002, 35007. All three
precons are emitted from each pack's printed decklist and pass `packages/cards/src/wave6-precon-legality.test.ts`.
**Source correction:** `docs/phase7-wave6-sources.md` §3.2 cites the Aggressive Energy ruling as "July 9, 2026 - Ruling
4"; it is Ruling 3, answer 4.

| Identity                        | Obligation             | Nemesis set (nemesis minion in bold)                                                 | Setup, hand size, precon                                                                                  |
| ------------------------------- | ---------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Cyclops / Scott Summers (33001) | Lost Visor (33027)     | **Mister Sinister** (33028), Genetic Manipulation, Gene Therapy ×2, Concussive Force | No Setup. 5 / 6. Leadership, 40 cards, with Dust, Rockslide, Blindfold (off-aspect X-Men allies)          |
| Phoenix / Jean Grey (34001)     | Burning Hunger (34028) | **Dark Phoenix** (34029), Consume the World (permanent), Fiery Rage ×3               | Jean Grey's Setup: Phoenix Force into play Restrained side up, 4 power counters. 5 / 6. Justice, 41 cards |
| Wolverine / Logan (35001)       | Past Demons (35027)    | **Omega Red** (35028), The Carbonadium Synthesizer, Death Factor ×2, Tentacle Strike | Logan's Setup (erratum p. 68): Wolverine's Claws into play. 5 / 6. Aggression, 41 cards                   |

The `wolv` pack also carries the Lady Deathstrike modular set (`deathstrike`, 35034–35037): Quickstrike, discards at
random, Adamantium Upgrades' exact-type resource cost; all §3.44.

**Cyclops: tactics on enemies.** His kit attaches cheap TACTIC upgrades to enemies (Exploit Weakness, Practiced
Defense, Priority Target, all temporary, §3.26), Optic Blast hits only an enemy with an upgrade attached, Scott Summers
fetches TACTIC upgrades, and Field Commander takes the first turn and keeps his upgrades on minions (§3.27, §3.13 after
§3.26). The aspect TACTIC upgrades (Coordinated Attack, Marked, Befuddle, Pinned Down) are "Attach to a minion. Max 1
per minion" and not temporary. Optic Blast's two modifiers are §3.29 (Full Blast) and §3.30 (Ruby Quartz Visor); the
Ricochet Beam FAQ (p. 64) is a fixture. Lost Visor stays in play with the visor tucked under it. Mister Sinister's
nemesis set reuses the Unstoppable shape (Gene Therapy, `superlative` lowest printed ATK host, already in the data).

**Phoenix: power counters on a two-sided permanent.** Phoenix Force (34002a/b) is one upgrade, permanent, flipped by
its own forced responses: Restrained ("After the last power counter is removed from here", `countersRemoved`, exists)
and Unleashed (−2 THW, +2 ATK; "After a power counter is placed here, if there are 4 or more", **needs pass 1 §3.2**).
The traits it grants (RESTRAINED / UNLEASHED) switch half her events (Telekinetic Attack, Psychic Blast, Telepathic
Trickery, Phoenix Suit) through `hasTrait`. Counters are placed by Jean Grey's star response (after a basic recovery),
White Hot Room, Phoenix Firebird, the Cyclops ally, Psychic Rapport, and removed by Psionic Bond (a wild resource), the
Cyclops ally leaving, Rise from the Ashes (§4 Q24) and Burning Hunger. Phoenix Force is **not** a form card: its flip
is `flipCard`, not `changeAdditionalForm`. Burning Hunger (obligation) reveals Dark Phoenix when Unleashed; Dark Phoenix
schemes onto Consume the World (§3.37), which loses its amplify icon while empty (§3.38) and loses the game at 12.
Psionic events gated on PSIONIC (Psychic Assault, Misdirection, Kicker, Manipulation) are §3.36, §3.39, §3.35.

**Wolverine: damage as a resource.** Wolverine's Claws plays an Attack event for damage equal to its printed cost
(§3.42, which Lunging Strike reads); Berserker Barrage repeats for 2 damage (§3.41); Healing Factor, Regenerative
Healing, Adamantium Skeleton and "I Got Better" keep him up; Berserker Frenzy draws on enemy-attack damage. Jubilee's
+2 ATK is §3.43 (ruling Jun 2, 2026 (1)). Death Factor needs §3.40.

**Card data fixes** (for `card-data-pipeline`; the emitted text is wrong in each):

- Fiery Rage 34031: emitted "Peril." only. Scan: "Peril. (While you are resolving this card, other players cannot help
  you.) When Revealed: If Dark Phoenix is in play, she activates against you. If Dark Phoenix is not in play, place 1
  threat on Consume the World and this card gains surge." (Peril: ruling Jul 9, 2026 (3) #5.)
- Cyclops ally 34003: the second ability is "**Forced Interrupt**: When Cyclops leaves play, remove 2 power counters
  from Phoenix Force" (raw "Response").
- Mission Training 34016: "+1 THW and +2 hit points" (raw "+1 THW point"); Wolverine's Claws 35002: "choose an ATTACK
  event" (raw "en"); Logan's Cabin 35007: "from your discard pile" (raw "you").
- Danger Room Training 33015 and Mission Training 34016: "Max 1 TRAINING upgrade per ally" has no field (§3.28).
- Logan 35001b: raw already carries the p. 68 erratum ("Put Wolverine's Claws into play"); the scan prints the old
  search text. Keep the erratum. Burning Hunger 34028's emitted text matches its scan.

**Deckbuilding (DoD §4b).**

- Scott Summers: "You may include X-MEN allies from any aspect in your deck." Landed in f274a97d
  (`offAspectAllowance { cardType: "ally", anyTrait: [X-MEN] }`, no `maxCards`; `off-aspect-allowance.test.ts`).
  §4b's illegal-deck test: a non-X-MEN off-aspect ally, or an off-aspect X-MEN event, in a Cyclops deck.
- Team-Up (RRG 1.8 p. 43: "that player's chosen identity must match one of the named characters"): Psychic Rapport
  (33023, 34023, two printings of one title, "Max 1 per deck" by title) only in Cyclops or Phoenix decks; Soul Sisters
  (34035) in Phoenix or Storm decks; Fastball Special (35023) in Colossus or Wolverine decks. Illegal-deck tests for each.
- Phoenix and Wolverine print no deckbuilding rule. Phoenix Force and Wolverine's Claws are permanent and in their
  precon counts (41 each); Q15/Q25 decide whether they are set aside before setup.
- "Play only if your identity has the PSIONIC / MUTANT / X-MEN trait" is a play restriction, not deckbuilding, and
  depends on the face: Phoenix (hero) is PSIONIC/X-MEN, Jean Grey MUTANT/PSIONIC; Cyclops and Wolverine are X-MEN as
  heroes and MUTANT as alter-egos (Cerebro and Weapon X need MUTANT; Honorary X-Men and Longshot need X-MEN).

### 6.2 Pass 2b: Storm, Gambit, Rogue (placeholder)

Not surveyed. Known so far: the `storm` / `rogue` rulings in `docs/phase7-wave6-sources.md` §3.2, Claustrophobia's
erratum (p. 68), Pixie (Storm #17) under Magik's FAQ entry, Uncanny X-Men's "Max 1 TEAM card per player" (§3.28), Rogue
and Karma in `treatHostAsAlly`'s docblock, Storm's Weather deck gap (PR handoff).

## 7. Pass 3: MojoMania (placeholder)

The `mojo` scenario pack: its `Scenario` records, the Wheel of Genres environment and the six genre sets, Mojo, Spiral,
Magog and Longshot. Not surveyed in this pass. Known so far: ruling Apr 30, 2026 (3) (Longshot's When Revealed at setup;
flipping environments are not revealed), FAQ p. 64 (Dial M for Mojo, Wild Wild Mojo).
