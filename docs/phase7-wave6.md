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
| 2b    | Hero packs: Storm, Gambit, Rogue (§6.2, §3.45–§3.58, §4 Q26–Q31)                             | this document     |
| 3     | MojoMania scenario pack (`mojo`) (§7, §3.59–§3.74, §4 Q32–Q47); build order (§8)             | this document     |

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

Passes 2 and 3 are §6 and §7. MojoMania's `Scenario` records, its card data fixes and its pack name are §7.2, §7.7
and §4 Q32.

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
| 3.45 | Weather deck: the curation fields                           | Storm (36001b), Ororo's precon                                      | partial          |
| 3.46 | A facedown separate deck with no discard pile               | Weather deck (`storm`); Hercules's Gift deck                        | partial          |
| 3.47 | Swapping an in-play card with an out-of-play card           | Weather Control, Weather Goddess                                    | missing          |
| 3.48 | "Find" a card                                               | Rogue, Anna Marie, Energy Transfer (errata p. 69)                   | partial          |
| 3.49 | Attaching a player upgrade to any character                 | Skin Contact, Energy Transfer (Touched)                             | partial          |
| 3.50 | Gaining another character's traits                          | Skin Contact, Energy Transfer                                       | partial          |
| 3.51 | A card's classification as a query                          | Superpower Adaptation                                               | missing          |
| 3.52 | What an interrupt did to the card being played              | Throw de Card → Charged Card; §3.42                                 | partial          |
| 3.53 | Placing counters as a cost                                  | Natural Agility                                                     | missing          |
| 3.54 | Looking at encounter cards and discarding one as a cost     | Thief Extraordinaire (Remy LeBeau)                                  | partial          |
| 3.55 | Additional threat for a thwart in progress                  | Operative Skill                                                     | partial          |
| 3.56 | The traits a form change left behind                        | Moira MacTaggert                                                    | partial          |
| 3.57 | Playing a tucked ally as if from hand, exhausted            | Med Lab                                                             | partial          |
| 3.58 | Reusable as is (Storm, Gambit, Rogue)                       | —                                                                   | checked          |
| 3.59 | Threat on cards that are not schemes                        | Mojo I–III, MojoMania 1B, Paparazzi, Supporting Actor, Curtain Call | partial          |
| 3.60 | The encounter deck resets as an event                       | Wheel of Genres (Spinning)                                          | partial          |
| 3.61 | "At the start of step three of the villain phase"           | Wheel of Genres (Stopped)                                           | partial          |
| 3.62 | Bringing in a set-aside modular set by its SHOW environment | MojoMania 1B, Wheel of Genres (Stopped)                             | partial          |
| 3.63 | A modular pool, a per-player set-aside count, an extra set  | Melee in the Mojo-seum, Across the Mojoverse, MojoMania 1A          | partial          |
| 3.64 | "If this card was revealed from the encounter deck"         | The six SHOW environments                                           | missing          |
| 3.65 | Incite on a villain's new face; grants to a revealed card   | Dial M for Mojo (FAQ #35), The One with the Breakup                 | partial          |
| 3.66 | The show deck                                               | Across the Mojoverse, The Search for Spiral, Cornered!              | partial          |
| 3.67 | "After [a character]'s hit points are reset"                | Jolt of Adrenaline, Surge of Aggression                             | missing          |
| 3.68 | Damage by its source's printed resource; doubled damage     | Dragon, Goblin, Troll, Vampire                                      | partial          |
| 3.69 | Choosing a number; different resources as an effect         | Break a Leg, Director's Directions                                  | missing          |
| 3.70 | Playing a card searched from your deck                      | Fetch Quest (erratum p. 69)                                         | partial          |
| 3.71 | An ally with an encounter card back under a player          | Longshot; Captive allies (§3.20)                                    | partial          |
| 3.72 | The MojoMania campaign                                      | MojoMania insert pp. 4–5, 9, 13–14, 17                              | partial          |
| 3.73 | Reusable as is (MojoMania)                                  | —                                                                   | checked          |
| 3.74 | Permanent cards set aside before setup step 1 (Q15 → B)     | Kitty Pryde, Logan, Jean Grey; Vision, Spectrum re-pointed          | partial          |

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

**Pass 2b (Storm, Gambit, Rogue).** §3.45–§3.57 were searched for by behavior the same way (the unions, the `@mc/cards`
DSL, wave 1–5 specs, 2026-10-01); what composes is §3.58. The engine already names two of these packs' cards in its
docblocks: Karma (`treatAsAlly`, `spec.ts`) and Possessed (`treatHostAsMinion`, `abilities.ts`).

### 3.45 Weather deck: the curation fields

> **Status: partial.** The schema has had the shape since wave 2 §15.3 (`IdentitySeparateDeck` fields
> `discardPile: "none"`, `whenEmpty: "stayEmpty"`, `topCardFaceup`, `cardFamily`), but
> `SeparateDeckCuration` (`scripts/marvelcdb/curation/types.ts` ~line 297) carries only `identityCode`, `deckName`,
> `cardCodes`, and `normalize/separate-decks.ts` hardcodes Invocation's three values for every deck.

**Cards.** Ororo Munroe (36001b): "Ororo Munroe begins the game with a WEATHER deck. (See insert.)" **Rules.** The Storm
Hero Pack insert, "The Weather Deck" (read from Hall of Heroes' scan of the printed insert, 2026-10-01): "Storm begins
each game with a special, four-card 'WEATHER deck' in addition to her player deck. To create the WEATHER deck, shuffle
all four of Storm's WEATHER support cards together … Then, place the WEATHER deck facedown next to your identity card."
The insert says nothing about a discard pile or an empty deck; the supports are permanent (RRG 1.8 p. 32), so neither
can arise except by a same-set effect, and none is printed (§4 Q26). **Plan (owner: `card-data-pipeline`).**
`SeparateDeckCuration` gains optional `topCardFaceup`, `discardPile`, `whenEmpty` (and `cardFamily`, for Hercules),
defaulting to today's Invocation values so `drs` regenerates unchanged. `curation/storm.ts` adds `separateDecks: [{
identityCode: "36001a", deckName: "Weather", cardCodes: ["36002", "36003", "36004", "36005"], topCardFaceup: false,
discardPile: "none", whenEmpty: "stayEmpty" }]`. **Lands after §3.46** (or with it): today `unbuildableSeparateDeck`
would make `validateDeck` refuse Storm as `unsupported_identity`.

**Precon change.** `storm-leadership` drops 36002–36005 and totals 40 (the printed list is "40 + 4 weather"); the
four cards get `deckLimit: 0` and `separateDeck: "Weather"`, `requiredIdentitySet` no longer returns them, and
`wave6-precon-legality.test.ts`'s Storm expectations change in the same commit.

### 3.46 A facedown separate deck with no discard pile

> **Status: partial.** `createGame` builds identity separate decks (`setup.ts` ~line 630) and shuffles them at setup
> (`setup-steps.ts`); `syncSeparateDeckTop` (`ctx.ts`) already shows no faceup card when `topCardFaceup` is false;
> `resetSeparateDeckIfEmpty` (`resolve/separate-decks.ts`) is the Invocation reset. `unbuildableSeparateDeck`
> (`deck.ts` ~line 49) refuses any deck other than "player cards, own discard pile".

**Plan.** Build a `cardFamily: "player"`, `discardPile: "none"`, `whenEmpty: "stayEmpty"` deck: lift the refusal for
that kind only (Hercules's encounter-family Labor deck stays refused); no reset when it empties; a card of such a deck
that would be placed in a discard pile, a hand or another deck goes back to its separate deck facedown instead (§4
Q26), logged as a redirect. Choosing from it is the existing `CardZoneQuery { zone: "separateDeck", name }` with
`putIntoPlay`, and is a search (RRG 1.8 "Search", p. 39: shuffle after). Ororo's Setup then composes. **Composes
with:** Hercules's Gift deck (wave 2 §15.3: three permanent upgrades, no discard pile, never refilled).

### 3.47 Swapping an in-play card with an out-of-play card

> **Status: missing.** `swapVillain` and `swapIdentity` (`spec.ts` ~line 2319) swap one kind of card each; nothing
> swaps two arbitrary cards.

**Cards.** Weather Control (36001a, "Action: Swap your WEATHER support in play with a support of your choice from the
WEATHER deck. Resolve the 'Special' ability on your WEATHER support in play. (Limit once per round)."), Weather Goddess
(36009, the same as a Hero Action event). **Rules.** RRG 1.8 "'Swap'" (p. 42): the two cards exchange locations; it
"cannot be completed if there is not a component in both locations"; swapped cards keep the orientation of the
original; between a play area and an out-of-play area, cards that do not share a title mean "the in-play card is
considered to leave play and the out-of-play card is considered to enter play", nothing transfers and the new card
enters ready (cards that share a title transfer tokens, attachments, status cards and exhaustion and neither enters or
leaves play). RRG 1.8 "Permanent" (p. 32): an ability in the permanent card's own set may remove it from play, so
Storm's own abilities may swap her permanent supports.

**Plan.** **`EffectSpec swapCards { a: TargetRef; b: TargetRef }`**: refuses (does not resolve, RRG 1.8 "'Then'",
p. 44) unless both refs name a card; applies p. 42 by title; a different-title swap announces `cardLeavesPlay` for the
outgoing card (permanent's set check passes the ability's set, wave 5 §4.1 Q46) and `cardEntersPlay` for the incoming
one, which takes the outgoing card's controller. The outgoing support takes the chosen card's place in the Weather deck,
facedown; the deck is then shuffled (§3.46, a search). Logged `cardsSwapped`. **DSL:** `swapCards(yourWeatherSupport,
chosen)` then `resolveSpecials`. **Composes with:** Eidetic Memory (`silk`, "swap those cards", erratum RRG 1.8 p. 69:
two out-of-play cards, which the same effect covers with no play-state change).

### 3.48 "Find" a card

> **Status: partial.** Searches exist per zone (`CardZoneQuery` deck / discard / hand / separate deck, `abilities.ts`
> ~line 1057; `encounterSetAside`; the player's set-aside area through `playFromHand.from: "setAside"`); no ref looks
> everywhere a card could be.

**Cards.** Rogue's errata (RRG 1.8 p. 69): Anna Marie "Setup: Find your Touched upgrade and set it aside. Withdrawn —
Forced Response: After you change to this form, find Touched and set it aside."; Skin Contact "Find Touched and attach
it to another character"; Energy Transfer "Find Touched and attach it to …"; Rogue's printed "After the player phase
begins, find Touched and set it aside." Touched may be in the deck (setup), set aside, attached to any character, or in
Rogue's discard pile (its host left play). **Rules.** RRG 1.8 "Find" (p. 19): every game area where the card could be,
except facedown encounter cards in an in-play area, the victory display and removed-from-game cards; ruling Dec 17,
2025 (4) #3: "Find" searches in-game areas only. **Plan.** **`TargetRef find { query: TargetQuery; owner?: PlayerRef
}`**: the matching instances across those areas; a deck searched this way is shuffled after the step (p. 39). Nothing
found resolves nothing. **DSL:** `find(titled("Touched"), { owner: you })`.

### 3.49 Attaching a player upgrade to any character

> **Status: partial.** `attach` (`spec.ts`) attaches a card to a host; player upgrades attach to enemies (Cyclops's
> tactics); no cost component attaches.

**Cards.** Skin Contact ("Attach Touched to another character"), Energy Transfer ("Hero Action: Find Touched and attach
it to a character other than Rogue and deal 2 damage to that character → heal 2 damage from Rogue and ready her"):
the host is any character, including another player's identity and the villain, and in Energy Transfer the attach is
part of the cost. **Rules.** RRG 1.8 "Attach To" (p. 8), "Ownership and Control" (p. 31): Touched stays under Rogue's
player's control on any host. **Plan.** Verify `attach` takes any character as the host (another player's identity in
either form, the villain), with the controller unchanged; add **`AbilityCost.attach { card: TargetRef; to:
InPlayCostPick }`** binding the host to a slot the cost's `damageCards` and the effects read. Touched's four
host lines are `refMatches(host, { categories })` (§3.58); with the host leaving play Touched goes to Rogue's discard
pile, where §3.48 finds it.

### 3.50 Gaining another character's traits

> **Status: partial.** `TraitGrantSpec.traitsOf` (constant, printed traits only, Absorbing Man) and
> `grantTraitUntil { trait }` (one named trait, `spec.ts` ~line 1371) exist.

**Cards.** Skin Contact and Energy Transfer: "You gain each of the attached character's TRAITS until the end of the
round." **Plan.** **`grantTraitUntil.traitsOf?: TargetRef`** (instead of `trait`): the traits that character has when
the effect resolves, printed and granted, recorded on the lasting effect (§4 Q28). Two uses stack. **Composes with:**
Rogue ally (`ncrawler` #12, erratum p. 69: "Rogue gains each of that character's Traits").

### 3.51 A card's classification as a query

> **Status: missing.** `identitySetOf`, the aspect fields and `SpecificSet` exist; no query asks "the same
> classification as".

**Cards.** Superpower Adaptation (38009): "If Touched is attached to a friendly character, search its owner's discard
pile for an event that belong's to the same classification as that character (identity-specific, aspect, or basic) →
add that event to your hand." **Rules.** RRG 1.8 "Classifications" (p. 12). **Plan.** **`TargetQuery
sameClassificationAs?: TargetRef`**: identity-specific (an identity card, or any card with a hero set), aspect (any of
the five aspects, §4 Q29) or basic. An identity is identity-specific.

### 3.52 What an interrupt did to the card being played

> **Status: partial.** `modifyCardEffect` (`resolve/apply-effect.ts`) writes onto the played card's frame; §3.42
> plans `playedVia` for the same need.

**Cards.** Throw de Card (37001a, "When you play an ATTACK event, remove up to 3 charge counters from here → that event
deal +1 damage for each counter removed"; the cost is `spendCounters { upTo, bind }`, Groot's) and Charged Card (37006,
"If Gambit's 'Throw de Card' ability removed at least: • 1 counter, this attack gains ranged. • 2 counters, … piercing.
• 3 counters, … overkill."). **Plan.** **`modifyCardEffect.note?: { name: string; value: ValueSpec }`**: a var
written on the played card's frame, read by **`Predicate playNote { name; atLeast }`**. Build §3.42's `playedVia` as
the same mechanism (a note naming the card that played it) rather than a second one. A note dies with the frame.

### 3.53 Placing counters as a cost

> **Status: missing.** `AbilityCost.spendCounters` removes counters; nothing places them.

**Cards.** Natural Agility (37008, "Hero Interrupt (defense): When you defend against an attack, place 1 charge counter
on Gambit → for each charge counter on Gambit, you get +1 DEF for that attack"). **Plan.** **`AbilityCost.placeCounters
{ counterType; amount; target?: "self" | "identity" }`**, always payable; the effect reads the counters after
payment, so the placed counter counts.

### 3.54 Looking at encounter cards and discarding one as a cost

> **Status: partial.** `lookAt` (wave 5), `discardEncounterCards.bind`, `boostIcons`; `AbilityCost.discardFromDeck`
> reads the player deck only.

**Cards.** Thief Extraordinaire (37001b, "Action (thwart): Exhaust Remy LeBeau and look at the top 2 cards of the
encounter deck. Discard 1 of those cards → remove threat from a scheme equal to the number of boost icons on that
card."). **Plan.** **`AbilityCost.encounterLookDiscard { look: number; discard: number; slot: string }`**: the player
sees the top `look` cards, the chosen ones are discarded into `slot`, the rest stay on top in order. Fewer cards than
`look` show what there is; an empty encounter deck resets first (RRG 1.8 "Encounter Deck", p. 17). Being a cost, a
confused Remy still pays it (RRG 1.8 "Labeled Ability", p. 26). The Thieves Guild's "After you resolve your Thief
Extraordinaire ability" is `abilityResolved` with that ability id (the Ghost-Spider pattern, `wave5/sm/ghost-spider`).

### 3.55 Additional threat for a thwart in progress

> **Status: partial.** The `thwart` event carries `amount` (`trigger-events.ts` ~line 89); `modifyBasicPower` and
> `modifyCardEffect` cover a basic thwart and an event; §3.29 plans the attack-frame var.

**Cards.** Operative Skill (37013, "Interrupt: When you thwart, remove 1 operative counter from here → that thwart
removes 1 additional threat"): basic, event or "(thwart)" ability alike. **Plan.** **`EffectSpec modifyThwart {
extraThreat: ValueSpec }`** on the innermost thwart frame, added after the amount is computed; §3.29's frame-var
mechanism, built once for both. A crisis icon still stops the whole removal from the main scheme.

### 3.56 The traits a form change left behind

> **Status: partial.** `formChanged` (`trigger-events.ts` ~line 607) carries `to`, faces and the change kind; it has no
> traits. `cardLeavesPlay.traits` is the precedent for last-known traits.

**Cards.** Moira MacTaggert (38018, "After a MUTANT alter-ego changes into hero form, exhaust Moira MacTaggert → that
hero's controller draws 1 card"): once it has changed, the identity shows its hero face (MUTANT is printed on the
alter-ego faces). **Plan.** **`formChanged.fromTraits`**: the identity's traits just before the change; a pattern's
`targetIs` trait clause reads it as it reads `cardLeavesPlay.traits`.

### 3.57 Playing a tucked ally as if from hand, exhausted

> **Status: partial.** `playFromHand.from: "hand" | "setAside"` (`spec.ts` ~line 1769, Death-Glow);
> `characterDefeated.consequential` (`trigger-events.ts` ~line 339); `tuckCards`.

**Cards.** Med Lab (38028): "Response: After an ally is defeated by consequential damage, exhaust Med Lab → place it
here. (Limit 1 ally at a time.) Alter-Ego Action: Exhaust Med Lab → play the ally here as if it was in your hand. It
enters play exhausted." **Rules.** Ruling Dec 17, 2025 (4) #2: Med Lab takes an ally from an out-of-play area still in
the game (the discard pile), never one removed from the game (Odin's forced interrupt removes him first). RRG 1.8
"Tuck" (p. 45). **Plan.** `playFromHand.from` gains **`{ tuckedUnder: TargetRef }`** and **`entersExhausted?: true`**
(read at its enter-play step). Med Lab's response is `characterDefeated { consequential }` with the ally taken from the
discard pile by `tuckCards`; "Limit 1 ally at a time" is a `while: not(tucked(self))` on the response.

### 3.58 Reusable as is (Storm, Gambit, Rogue)

| Printed wording                                                                                                             | Cards                                                                                                            | Existing vocabulary                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Each character gains stalwart / retaliate 1"; "gets +1 ATK / -1 ATK"                                                       | Clear Skies, Hurricane, Thunderstorm, Blizzard                                                                   | keyword grant / `gets` over every character (friendly and enemy, per the insert); stalwart sheds held statuses (`resolve/state-checks.ts`, RRG 1.8 p. 40) |
| "Resolve the 'Special' ability on your WEATHER support"; "If Hurricane is in play, resolve its 'Special' ability"           | Weather Control, Weather Goddess, Torrential Rain … Blast of Wind                                                | `resolveSpecials { cards / of }`                                                                                                                          |
| "After you resolve the 'Special' ability on your WEATHER support"; "After you resolve your Thief Extraordinaire"            | Storm's Cape, The Thieves Guild                                                                                  | `abilityResolved` + `abilityTiming` / ability id (Ghost-Spider)                                                                                           |
| "Generate the printed resource on your WEATHER support"                                                                     | Storm's Crown                                                                                                    | `ResourceGeneration printedResourcesOf` (Energy Duplication)                                                                                              |
| "Until the end of the round, treat that minion's text box as if it were blank (except for TRAITS)"                          | Blizzard's Special                                                                                               | lasting `blankTextBox`; `traitsOf` ignores blanking, so traits stay                                                                                       |
| "When the villain attacks you, the villain and each minion engaged with you get -3 ATK while attacking you this phase"      | Flash Freeze                                                                                                     | ruling Dec 17, 2025 (3): only when Storm herself is attacked; the per-reader `while` is §3.43's gap                                                       |
| "Havok gets +1 ATK and takes +1 consequential damage"; "Gentle takes +1 consequential damage after he attacks the villain"  | Havok, Gentle                                                                                                    | §3.31 (`modifyConsequentialDamage`, `consequential` on `increaseDamageTaken`)                                                                             |
| "Max 1 TEAM card per player"; "each of your X-MEN allies costs 1 fewer"                                                     | Uncanny X-Men                                                                                                    | §3.28, `costModifier` with `while` (§4 Q31)                                                                                                               |
| "After you play Pixie from your hand"; "If that ally is still in play at the end of the phase, add it to your hand"         | Pixie, "To Me, My X-Men!", Professor X                                                                           | `cardPlayed` from hand (FAQ p. 64: Magik's top-of-deck play counts, a fixture once Magik exists), `atEndOfPhase` / `atEndOfRound` (Nick Fury)             |
| "When an ally makes a basic thwart or basic attack action, … +1 THW and +1 ATK for that action"                             | Leadership Skill                                                                                                 | `basicPowerUsing` + `modifyBasicPower`                                                                                                                    |
| "Flip to alter-ego form. You cannot change to hero form." (erratum p. 68); "Give to the … player"; "remove … from the game" | Claustrophobia, Guild Business                                                                                   | `changeForm`, `cannotChangeForm` with `while: form alterEgo`; the obligation-in-play shape (Lost Visor); exact-type resource cost                         |
| "If Touched is attached to a: Minion / Villain / Ally / Hero"; "attached to a friendly / enemy character"                   | Touched, Rogue's Jacket, Deadly Touch                                                                            | `refMatches(host, { categories })`, `attackKeywords`, keyword and trait grants; `if` bullets                                                              |
| "If Rogue has AERIAL / Retaliate / Stalwart"                                                                                | Goin' Rogue, Southern Cross                                                                                      | `hasTrait`, `TargetQuery.withKeyword`                                                                                                                     |
| "When an enemy with Touched attached to it attacks, prevent all damage from that attack and gain a tough status card"       | Bulletproof Belle                                                                                                | `modifyAttack.preventAllDamage` + `giveStatus`; ruling Jan 17, 2026 (3) is a fixture (piercing still discards the new tough card)                         |
| "When a boost card is turned face up while the villain attacks, cancel all boost icons"                                     | Preemptive Strike                                                                                                | `boostCardTurnedFaceup` + `cancelBoostIcons.bind` (Attacrobatics)                                                                                         |
| "After you defend … and take no damage"; "and is not defeated"; "If you take no damage from that attack"                    | Gambit's Guild Armor, Unflappable, Hangar Bay, Not Today!                                                        | `resultsAtMost`, `atEndOfAttack` (verify Not Today!'s results read)                                                                                       |
| "Reduce the cost to play Rogue by 1 for each charge counter on your identity"; "enters play with 3 … counters"              | Rogue ally (37002), Gambit ally (38003), Iceman, Bishop                                                          | `costModifier` with `counters`, Hawkeye's shape, `spendCounters`, `min` (Bishop's +6 cap); Bishop's "attacks you" is the player (ruling Dec 17, 2025 (3)) |
| "Take control of that minion and treat it as a CONTROLLED ally"; "Treat attached ally as a CONTROLLED minion"               | Karma, Possessed (erratum p. 68)                                                                                 | `treatAsAlly`, `treatHostAsMinion` + `engage`                                                                                                             |
| "Cannot take damage"; "When attached minion would leave play, instead heal all damage … Then, discard"                      | The Shadow King, Cybernetic Enhancements, Psionic Shield (erratum p. 68)                                         | `cannotTakeDamage { while }`; leave-play replacement (wave 5 §4.1 Q34)                                                                                    |
| "When Revealed (Alter-Ego) / (Hero)"; "Choose an enemy with the highest ATK → take damage equal to its ATK"                 | Knife Fight, Callisto, Switchblade                                                                               | `whenRevealedAlterEgo` (bkw 08029), `superlative`, §3.41 `taken`; `encounterCardRevealing` interrupt; `attachesTo` printed ATK (emitted)                  |
| "Search the encounter deck, discard pile and set-aside area for … and reveal it / shuffle it into your deck"                | Leader of the Morlocks, Mystique (38025), Mystique's Manipulations (erratum p. 69), Shadow King, Exodus, Reavers | search + `revealCard` / `attach`, `encounterSetAside`, `defeatingPlayer`; Misled is pass 1 §3.10 (§4 Q7)                                                  |
| "Each Controlled / ACOLYTE minion activates against you"; "Each ASSASSIN minion attacks you (even if … alter-ego)"          | Astral Attack, Acolyte Frenzy, Assassination Attempt                                                             | `enemyActivation`, `enemyAttack` (verify it attacks an alter-ego)                                                                                         |
| "Teamwork (REAVER)"; "reveal the topmost REAVER minion from the discard pile"; "for each REAVER minion engaged with you"    | Reavers (38029–38035; Bonebreaker erratum p. 69)                                                                 | pass 1 §3.1, topmost selector, `count`, `discardEncounterUntil`                                                                                           |
| Verbatim reprints                                                                                                           | Unflappable, Endurance, Stealth Strike, Hit and Run, Preemptive Strike                                           | a wave 6 reprints module (`wave4/reprints.ts` shape) aliases 09020, 05023, 08013, 18020, 05014                                                            |

**Pass 3 (MojoMania).** §3.59–§3.72 were searched for by behavior the same way (the `TriggerEvent`, `EffectSpec`,
`RuleSpec`, `Predicate`, `ValueSpec`, `CardSelector`, `CardDestination`, `ChoicePrompt` and `CampaignOp` unions, the
`@mc/cards` DSL, wave 1–5 specs, 2026-10-01); what composes is §3.73. Wave 4 §3.18 already built the set-aside
modular sets with Wheel of Genres in view (`shuffleInSetAsideModularSet`, `ValueSpec setAsideModularSetCount`), and
`villain-defeat.test.ts` already covers MaGog's "reset his hit points … instead". §3.74 is the user's change to Q15.

### 3.59 Threat on cards that are not schemes

> **Status: partial.** Every card instance has a `threat` field (`packages/engine/src/state.ts` ~line 175), and
> `placeThreat` / `removeThreat` / `moveThreat` take any target (`resolve/event.ts` ~line 1029,
> `resolve/apply-effect.ts` ~line 1357); `ValueSpec threat` and `TargetQuery hasThreat` read it. Hinder is applied only
> to a side scheme entering play (`resolve/reveal.ts` ~line 574) and to a flipped-in face (`resolve/other-face.ts`).

**Cards.** Mojo I–III (39022–39024: "Place 1 threat on your hero for each card discarded this way …"; II and III:
"Place 2/3 threat on each friendly character"), MojoMania 1B (39025b: "Forced Interrupt: When a character flips or
leaves play, move all threat from that character to this scheme"), Supporting Actor, Top Billing, Curtain Call ("the
character with the most threat"), Director's Directions ("1 damage for each threat on your identity"), Paparazzi (an
encounter obligation: "Hinder 10", "remove 2 threat from here", "move all threat from here to the main scheme").
**Rules.** RRG 1.8 "Threat" (p. 44) speaks only of schemes; "Hinder X" (p. 22) says "a card". The insert prints no
rule for threat on characters (§4 Q34).

**Plan.** (1) Hinder X on any card type entering play (one placement, as now). (2) Audit every reader that takes
threat to mean a scheme, each with a test that puts threat on a hero: basic thwart legality and targets, "the scheme
with the most threat", villain phase step one, crisis and `threatCannotBeRemoved` (scheme-scoped), the side-scheme
defeat sweep (a character or obligation at 0 threat is not defeated), the villain-phase preview, campaign `threatOn`.
(3) "A character flips" is a form change (`setForm`; RRG 1.8 "Flip", p. 20, and the identity is a double-sided card)
and a villain's flip (`cardFlipped`); "leaves play" is `cardLeavesPlay`, a minion's defeat included. 1B's script
listens to all three. No new log type (`threatPlaced` / `threatRemoved` already carry the instance).

### 3.60 The encounter deck resets as an event

> **Status: partial.** `drawEncounterCard` (`effects.ts` ~line 282) resets an empty encounter deck lazily, when the
> next card is needed, and places the acceleration token; `TriggerEvent deckRanOut` (`trigger-events.ts` ~line 387)
> covers player and scenario decks only.

**Cards.** Wheel of Genres, Spinning (39026a): "Forced Response: After the encounter deck resets, if there are no
set-aside modular encounter sets remaining, the players lose the game. Otherwise, flip this card." **Rules.** RRG 1.8
"Encounter Deck" (p. 17): "If the encounter deck is empty, the encounter discard pile is **immediately** shuffled to
create a new encounter deck"; ruling Apr 30, 2026 (3) #7 (the deck resets before the resolving card is discarded).

**Plan.** Reset at the move that empties the deck (the p. 17 rule that a discard-until effect stops there is
unchanged), place the token, then announce `deckRanOut { deck: "encounter", deckId }` when an ability listens; with
several encounter decks (The Wrecking Crew) only that deck. §4 Q38 (replays).

### 3.61 "At the start of step three of the villain phase"

> **Status: partial.** `villainStepResolved { step: "placeThreat" }` (`trigger-events.ts` ~line 650, wave 3 §3.2) is
> the only villain-step timing point, and it is a response window.

**Cards.** Wheel of Genres, Stopped (39026b): "Forced Interrupt: At the start of step three of the villain phase (deal
encounter cards), randomly choose 1 set-aside modular set and reveal its SHOW environment. Shuffle the rest of that
modular set and place it on top of the encounter deck. Deal the first player 2 facedown encounter cards and flip this
card." **Rules.** RRG 1.8 "Villain Phase" (p. 47), step 3.

**Plan.** `TriggerEvent villainStepStarting { step: "dealEncounterCards" }`, pushed when heard before step 3 deals
anything; interrupt window only. The step's own deal reads the deck after it, so the set placed on top is dealt. The
first player's two extra cards are not part of the step's deal (hazard is counted as before).

### 3.62 Bringing in a set-aside modular set by its SHOW environment

> **Status: partial.** `EffectSpec shuffleInSetAsideModularSet { bind? }` (`spec.ts` ~line 1190, wave 4 §3.18)
> shuffles a random set-aside set into the encounter deck.

**Cards.** MojoMania 1B (39025b): "When Revealed: Choose 1 set-aside encounter set at random, reveal its SHOW
environment and shuffle its remaining cards into the encounter deck"; Wheel of Genres, Stopped (§3.61: "on top of
the encounter deck").

**Plan.** Two optional fields. `reveal?: TargetQuery`: the chosen set's matching set-aside card is revealed (full
reveal procedure, by the first player) before the rest moves; it is not revealed from the encounter deck (§3.64), so
it does not surge (insert p. 18). `placement?: "shuffleIn" | "shuffledOnTop"` (absent = shuffleIn): the rest is
shuffled on its own and placed on top. `bind` as now; the log entry gains `placement`.

### 3.63 A modular pool, a per-player set-aside count and a set that is never counted

> **Status: partial.** `Scenario.modularSetCount`, `recommendedModularSetIds` and `setAsideModularSetCount: number`
> exist (`packages/content/src/schema/sets.ts`); nothing limits the modular choice to a pool, the set-aside count has
> no per-player part, and every added set counts as a modular set.

**Cards and rules.** 39002a: "One modular encounter set _(1 random modular set from the MojoMania scenario pack)_"
(italic, a recommendation); 39015a: "Three modular encounter sets from the MojoMania scenario pack"; 39025a: "Choose 1
modular set, plus 1[per_hero] additional modular sets, from the MojoMania scenario pack and set them aside"; insert
p. 2 (Longshot "forms its own one-card modular encounter set that can be included in any scenario … If the scenario
requires a specific number of modular sets, Longshot does not count as one of those sets"); insert p. 16.

**Plan (schema, then the scenario builder and setup screen).** `Scenario.modularSetPool?: { setIds; restricted:
boolean }`: restricted, every pick (the players' or random) comes from `setIds` (Spiral, Mojo; §4 Q44); not
restricted, `setIds` is the random recommendation (MaGog). `setAsideModularSetCount: number | { base; perPlayer }`
(Mojo: 1 + 1 per player; The Hood keeps 7). `EncounterSet.extraModular?: true` (`longshot`): offered at setup in any
scenario, shuffled in, never counted toward `modularSetCount`, never a random pick or a set-aside set (§4 Q43).
Validation: pool ids are modular sets; a restricted pool covers the count at four players (Mojo: 5 of 6).

### 3.64 "If this card was revealed from the encounter deck"

> **Status: missing.** The reveal frame keeps `revealedFrom` for its own bookkeeping (`stack.ts` ~line 324,
> `resolve/reveal.ts` ~line 51); no `Predicate` reads where a reveal came from.

**Cards.** The six SHOW environments (39035, 39041, 39047, 39053, 39060, 39066): "When Revealed: Discard each other
SETTING environment in play. If this card was revealed from the encounter deck, it gains surge." **Rules.** Insert
p. 18: SHOW environments revealed from the show deck or by Wheel of Genres do not surge, "the card was not 'revealed
from the encounter deck'".

**Plan.** `Predicate revealedFromEncounterDeck`, true during the When Revealed of a card whose reveal began at an
encounter deck or at a player's facedown encounter cards dealt from it; false from a scenario deck, the set-aside
area, a search, a discard pile or a player's deck (§4 Q35). The reveal frame records a `source` where the reveal is
initiated.

### 3.65 Incite on a villain's new face; keywords granted to a card being revealed

> **Status: partial.** A villain's flip (`flipCard` and `changeVillainForm`, `resolve/apply-effect.ts` ~line 1080 and
> ~line 1183) and its stage advance (`resolve/defeat.ts` ~line 534) resolve the new face's When Revealed only; incite
> is read inside the reveal procedure (`resolve/reveal.ts` ~line 453). Granted keywords are read through `deps`
> (`keywords.ts`); a grant matching a card in mid-reveal, not yet in play, is untested.

**Cards.** Dial M for Mojo (39035): "Each other encounter card gains incite 1"; The One with the Breakup (39064):
"Each encounter card gains peril". **Rules.** FAQ "Dial M for Mojo (#35)" (RRG 1.8 p. 64): "Villains are encounter
cards, so Dial M for Mojo gives incite 1 to Spiral. When Spiral flips, her new face is revealed, meaning her incite 1
resolves." RRG 1.8 "Encounter Card" (p. 17): eight types, main schemes and obligations among them.

**Plan.** (1) A grant over the eight encounter categories matches a card being revealed, wherever it is. (2) A
villain's new face (flip, `changeVillainForm`, stage advance) resolves its incite after its When Revealed, and no
other reveal step (§4 Q36). (3) A main scheme stage revealed by an advance resolves its own incite (§4 Q37). Granted
peril is read where printed peril is (ruling Jul 9, 2026 (3) #5). FAQ #35 is the fixture.

### 3.66 The show deck

> **Status: partial.** `ScenarioSeparateDeck` (`schema/sets.ts` ~line 175: contents by sets, card type and trait;
> `discardPile: "own" | "encounter"`), `buildScenarioDeck` (`spec.ts` ~line 1743), `CardSelector scenarioDeck { top }`
> and `CardDestination "scenarioDeckShuffle"` (only for a card already homed to that deck) exist.

**Cards.** Across the Mojoverse 1A/1B (39015), The Search for Spiral (39016), Cornered! (39017: "Shuffle this card
into the show deck"), Erratic Teleportation (39019: "look at the top card of the show deck and put it on the top or
bottom of that deck"). **Rules.** Insert p. 11: "The other two SHOW environments are shuffled together with the
Cornered! treachery card during setup to form the show deck. The show deck has no discard pile and cannot be affected
by player card effects. Players can interact with this deck only through the side scheme The Search for Spiral."

**Plan.** `ScenarioSeparateDeck.contents.cardIds?` (named cards join by id: Cornered!), `discardPile: "none"` (the
scenario twin of §3.46), `closedToPlayerCards?: true` (no player card effect selects, looks at, reorders or moves its
cards; Jessica Drew's any-deck look included). **`CardDestination { scenarioDeck: string; at: "top" | "bottom" |
"shuffle" }`** for a card from anywhere, which homes it there: Cornered!, and 1B's "place it on the bottom of the show
deck instead" through the existing discard replacement. 1A's Setup: a random SHOW environment from the encounter deck
into play (put into play, not revealed), `buildScenarioDeck("show")`, `changeVillainForm(ESCAPED)` (a no-op on the
corrected data, §7.7). Verify place-top-or-bottom on a scenario deck.

### 3.67 "After [a character]'s hit points are reset"

> **Status: missing.** MaGog's defeat is replaced by `setRemainingHitPoints` (`villain-defeat.test.ts`, "MaGog's
> shape"), which announces nothing.

**Cards.** Jolt of Adrenaline, Surge of Aggression (39005, 39006): "Forced Response: After MaGog's hit points are
reset, place 1[per_hero] ratings counters on The Challengers and discard this card." **Plan.** `TriggerEvent
hitPointsReset { instanceId }`, pushed when heard by `setRemainingHitPoints` when it sets a character to its maximum
hit points; response window only. A villain's next stage is not a reset.

### 3.68 Damage by its source's printed resource; doubled damage

> **Status: partial.** `RuleSpec cannotTakeDamage { fromSource? }` (`abilities.ts` ~line 379, Killmonger),
> `increaseDamageTaken { amount: number }` (~line 789), the `increaseDamage` interrupt (`spec.ts` ~line 1258) and
> `TargetQuery printedResource` exist; nothing says "only from", adds damage by source, or doubles.

**Cards.** Dragon (39042: "Double the amount of damage this minion takes from cards with a printed [energy]
resource"), Goblin (39043: "can only take damage from cards with a printed [physical] resource"), Troll (39044: "takes
1 additional damage from each card with a printed [mental] resource"), Vampire (39051: "Attacks with piercing deal
double damage to Vampire"). **Rules.** RRG 1.8 "Modifiers" (p. 29): "all additive and subtractive modifiers are
calculated before doubling and/or halving modifiers"; fractions round up.

**Plan.** `cannotTakeDamage.exceptFromSource?: TargetQuery`; `increaseDamageTaken.fromSource?: TargetQuery`;
**`RuleSpec doubleDamageTaken { target; fromSource?; attackKeyword?: AttackKeyword; while? }`**, applied after every
increase and reduction (interrupts and constants), before `maxDamageTakenPerAttack` and §3.3/§3.4's caps. The source
is the damage event's source card (§4 Q39); Wild Wild Mojo's +1 comes first (§4 Q40). Log `damageDoubled`.

### 3.69 Choosing a number; spending different resources as an effect

> **Status: missing.** No `ChoicePrompt` asks for a number (`choices.ts`); `ResourceRequirement` (`resources.ts`
> ~line 67) has no distinct-types rule (the cost's `distinctResourceTypes`, `abilities.ts` ~line 1307, does).

**Cards.** Break a Leg (39009): "You may place any number of ratings counters on The Champion to reduce this damage
by 1 for each counter placed this way"; Director's Directions (39033): "• Spend 2 different resources." **Plan.**
**`EffectSpec chooseNumber { player; min; max; bind }`** (`<bind>.amount`, `ChoicePrompt chooseNumber`), which Break a
Leg reads for its counters and its damage (max: the damage); `spendResources.distinctTypes?: number`, the cost
field's rule (a wild is any one type). The answer is logged as other choices are.

### 3.70 Playing a card searched from your deck

> **Status: partial.** `playFromHand { from?: "hand" | "setAside"; ignoreCost? }` (`spec.ts` ~line 1773); §3.57 adds
> `{ tuckedUnder }`.

**Cards.** Fetch Quest (39045, erratum RRG 1.8 p. 69): "When Defeated: In player order, each player may search their
deck for a card and play that card, ignoring its resource cost. (Shuffle.)" **Rules.** RRG 1.8 "Search" (p. 39);
"Requirement" (p. 37: a card with requirement cannot be played ignoring its cost). **Plan.** `from: "deck"`: the whole
deck is searched and shuffled after; only cards the player could legally play now are offered (play restrictions,
targets, an event's timing); declining is allowed. Same field as §3.57: whichever lands second extends it.

### 3.71 An ally with an encounter card back under a player's control

> **Status: partial.** An ownerless ally revealed or put into play becomes its controller's card
> (`resolve/reveal.ts` ~line 631 sets `ownerId` and a player `home`), so it leaves play to that player's discard pile.

**Cards.** Longshot (39071): "When Revealed: Put Longshot into play under your control. This card gains surge. This
effect cannot be canceled." The Captive allies 32089–32092 (§3.20). **Rules.** RRG 1.8 "Ownership and Control"
(p. 31): "The scenario is considered to be the owner of the encounter deck and each encounter card"; ownership
changes only for "a campaign-specific or scenario-specific player card … with a player card back". Insert p. 2: "The
Longshot ally card has an encounter card back"; turned faceup as a boost card it has no boost icons.

**Plan.** A card-back fact, **`BaseCard.cardBack?: "encounter" | "player"`** (absent: encounter for an encounter-set
card, player otherwise; MC21's Cosmo and Odin and `mut_gen` 171b/172b are "player"). An encounter-backed ally changes
control only: it leaves play to the encounter discard pile (§4 Q41). Verify an `AllyCard` boost card counts 0 icons.
§3.20's Captive allies read the same field (their backs to be checked on the MC32 scans).

### 3.72 The MojoMania campaign

> **Status: partial (composes; verify).** `strike` / `strikeList`, `record`, `choose`, `cardState`, `inGame`,
> `remainingHitPointsCappedAtBase` exist (`packages/engine/src/campaign.ts`); the expert "deal yourself a facedown
> encounter card to heal" has no shared helper (§3.25 notes MC21's token version, `campaigns/mts.ts` ~line 175).

**Rules** (insert pp. 4–5, 9, 13–14, 17; the campaign log is the back cover, not in the scan read):

- The three scenarios in order (MaGog, Spiral, Mojo); a loss may be retried "with no penalty" (p. 4).
- Setup, scenario 1: record identities; shuffle Longshot into the encounter deck. Scenarios 2–3: modular sets checked
  off in the log cannot be chosen (scenario 3: "If there are not enough sets remaining, you may choose checked-off
  sets once all others are chosen"); "If the Longshot ally was in play at the end of the last scenario, one player may
  reveal him. Otherwise, shuffle him into the encounter deck" (ruling Apr 30, 2026 (3) #1, §4 Q42); "Each player may
  take one copy of the card they recorded … from any player's deck and put it into play under their control. Then, add
  threat to the main scheme equal to the total cost of the cards put into play this way" (scenario 3: "each card").
- Victory, scenarios 1–2: record whether Longshot is in play; check off each modular set used; each player may record
  one support or upgrade they control costing 2 or less (3 or less if The Champion is on its BOOING CROWD side /
  "if there is less than ten threat per player on the main scheme"), never a "—" cost.
- Expert (p. 5): remaining hit points recorded, capped at base; "each player may deal themself one facedown encounter
  card to heal their identity to its full hit point value"; a defeated player rejoins the same way.

**Plan.** `MOJO_CAMPAIGN` in `@mc/content` (`packCode: "mojo"`, scenario ids in order, no campaign sets, no roles)
and a `CampaignDefinition` in `@mc/cards`. New: the checked-off filter with its "not enough remain" fallback on the
modular choice, and the shared heal helper (extracted with MC21's). Log fields: identities, Longshot in play, six
modular-set checkboxes, recorded cards per seat, expert hit points. Owner: `ability-scripting-engineer`, after the
three scenarios (§4 Q33).

### 3.73 Reusable as is (MojoMania)

| Printed wording                                                                                                                | Cards                                                      | Existing vocabulary                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "If there are at least 5[per_hero] ratings counters here, flip this environment"; "at least 10[per_hero] … win / lose"         | The Champion, The Challengers                              | `stateCheck` + `flipCard` (counters stay, RRG 1.8 p. 20), `endGame`; "After The Champion flips to this side" is `cardFlipped`                                       |
| "When this scheme would be completed, … instead"; "The players cannot win the game unless they wow the crowd"                  | Melee in the Mojo-seum 1B                                  | `mainSchemeCompleting` + `instead`; `Scenario.victory: "cardAbility"` (only The Challengers' B side wins)                                                           |
| "When MaGog would be defeated, reset his hit points to 10[per_hero] instead"                                                   | MaGog A/B                                                  | the `villain-defeat.test.ts` shape; §3.67 for what follows                                                                                                          |
| "If The Champion is on its CHEERING CROWD side"; "more ratings counters on The Challengers than on The Champion"               | Pump Up the Crowd, Break a Leg, Stage Fright               | `hasTrait` on a named card (verify `flipSide` traits are read), `compare` + `counters`                                                                              |
| "When Revealed (Alter-Ego) / (Hero)"; "If a hero defends against this attack and takes no damage"                              | Defend the Title                                           | `whenRevealedAlterEgo` (bkw 08029); §3.58's results reads                                                                                                           |
| "Spiral cannot take damage or be stunned. Threat cannot be removed from the main scheme"; "she schemes instead"                | Spiral, ESCAPED                                            | `cannotTakeDamage`, `cannotHaveStatus`, `threatCannotBeRemoved`; interrupt to `enemyAttack` + `replaceTriggeringEvent` (the dashed-stat skip runs after interrupts) |
| "If there are at least 3[per_hero] teleport counters here, remove all of them and flip Spiral"; "After Spiral activates"       | Spiral, CORNERED                                           | `stateCheck`, `removeCounters`, `flipCard`; responses to `enemyAttack` / `enemyScheme`; the next stage keeps the side (`resolve/defeat.ts` ~line 534; insert p. 12) |
| "Spiral attacks each player in player order (even in alter-ego form)"; "she attacks you (even if you are in alter-ego form)"   | Spiral III CORNERED, Well-Armed                            | `enemyAttack` against an alter-ego (§3.58, verify)                                                                                                                  |
| "Uses (3 sword counters)"; "+1 ATK for each sword counter"; "spend [physical][physical] → remove 1 sword counter"              | Spiral's Swords                                            | uses, `gets` with `counters`, a Hero Action on an encounter card (the acting player, as today)                                                                      |
| "After the last threat is removed from here, the player who removed that threat …"; "Take 2 damage →" (erratum p. 69)          | The Search for Spiral                                      | response to `removeThreat` with `threat(self)` 0, `eventPlayer`; `AbilityCost.damageSelf`; permanent keeps it in play at 0 threat (verify the sweep)                |
| "A card from the same encounter set as the current SHOW environment … deals that card to themself"                             | The Show Must Go On                                        | `encounterSetOf`, `dealAsEncounterCard`                                                                                                                             |
| "After your turn ends, discard the top 3 cards … for each card … that does not belong to the Mojo encounter set"               | Mojo I–III                                                 | `turnEnding` + `form hero`, `discardEncounterCards.bind`, `count` less `inEncounterSet` (parser fix, §7.7)                                                          |
| "When any amount of damage would be dealt to Mojo, place it here instead"; "remove an equal amount of threat … instead"        | Stinger Tail, Undercover Mojo                              | wave 5 §3.29 `instead` + `placeDamage` / `removeThreat(eventAmount)`; insert p. 18 fixtures (§7.6); §4 Q47                                                          |
| "Discard cards from the encounter deck equal to the amount of damage dealt by that attack"; "Spend [E][M][P] → discard"        | Major Domo                                                 | attack results, `discardEncounterCards`; a Hero Action on an encounter attachment                                                                                   |
| "Choose to either exhaust a character you control or discard 1 card … → remove 2 threat"; "When your turn ends, move all …"    | Paparazzi                                                  | either-cost (`either-cost.test.ts`), `turnEnding`, `moveThreat`; its hinder is §3.59                                                                                |
| "Choose a non-wild resource type, then each player draws 2 cards … discard each card … with the chosen resource type"          | Mana Drain                                                 | `chooseOne` (three branches), `printedResource`                                                                                                                     |
| "+1 THW / -2 ATK"; "The villain cannot take damage"; "Threat cannot be removed from other schemes"; "Spend X [mental] →"       | Dial M for Mojo, Law & Order, Dragnet, Crime Scene         | `gets`, `cannotTakeDamage` (ruling Apr 30, 2026 (1) on targets), scoped `threatCannotBeRemoved`; variable cost (wave 3 §3.25; verify a typed X)                     |
| "Move all threat from a side scheme to the main scheme"; "… until a side scheme is discarded. Reveal that card"                | Elementary, My Dear Mojo                                   | `moveThreat` (a side scheme at 0 is defeated), `discardEncounterUntil` + `revealCard`                                                                               |
| "After a side scheme is defeated, place 1 clue counter here"; acceleration / hazard / amplify icons on non-schemes             | Build the Case, The One with the Breakup, A Game of Mojo's | `schemeDefeated`; wave 5 §3.10                                                                                                                                      |
| "Each player gets +1 hand size"; "Each obligation gains 1 acceleration icon"                                                   | A Game of Mojo's, Mojo in the Middle                       | the `handSize` modifier; `gainsIcon` (wave 4 §3.57)                                                                                                                 |
| "Each minion gains quickstrike / guard and patrol"; "Each minion and ally gains toughness"; "Each enemy attack gains overkill" | The Mojo Files, ICE-Teroid M, Mojo Runner, Wild Wild Mojo  | keyword grants (toughness only on entering play, RRG 1.8 p. 45), `attackKeywords`                                                                                   |
| "Each ally takes -1 consequential damage ([cost]) after attacking a minion"                                                    | The Mojo Files                                             | §3.31                                                                                                                                                               |
| "When a character takes damage, increase that damage by 1"                                                                     | Wild Wild Mojo                                             | interrupt + `increaseDamage` (wave 4 §3.52); the overkill spill is its own damage event, so FAQ #66 composes                                                        |
| "At the end of the round (after the first player token is passed), the first player searches … for a minion"                   | ICE-Teroid M                                               | `phaseEnding { phase: "villain" }` (after step 5, `flow.ts` `executeEndOfRound`)                                                                                    |
| "Treat the printed text box of each support you control as blank (except TRAITS)"; "+2 cost"; "Reduce your ally limit by 2"    | Family Matters, Growing Pains, The Odd Couple              | `blankTextBox`, `costModifier`, `allyLimit` (verify a negative amount)                                                                                              |
| "Response: After a player discards an obligation, that player draws 1 card"                                                    | Mojo in the Middle                                         | `cardLeavesPlay` / `moveCards` into a discard pile, `categories: ["obligation"]` (§4 Q46)                                                                           |
| "When you look up a rule, you are confused"                                                                                    | Watch Me Play                                              | nothing (§4 Q45)                                                                                                                                                    |
| "You may spend 1 resource of any type to attach this card to your identity"; "remove 1 stake counter → +1 ATK … piercing"      | Bandolier of Stakes                                        | `spendResources.bind` + `attach`; `basicPowerUsing` + `modifyBasicPower` (Leadership Skill), a `removeCounters` cost                                                |
| Cultist, The Kraken, Vampire's heal-or-tough, Werewolf Pack ("Defeat an ally you control and place it facedown under")         | Horror                                                     | search + `putIntoPlay` + `engage`; "each other character takes 1 damage" (§3.41); `heal.bind`, `giveStatus`; `defeat` + `tuckCards` (the OZT FAQ p. 63 shape)       |
| Avalanche 9.0, Blob 3.14 ("cannot take more than 2 damage from each attack"), Magneto 2.6, Pyro 4.0, Toad 2.0                  | Sci-Fi                                                     | `minionEngaged`; `maxDamageTakenPerAttack`; counters + `discardFromHand`; `dealIndirectDamage`; `tuckCards` an upgrade, `takeIntoHand` from `tucked`                |
| Dead or Alive, Card Shark, Gunslinger ("When this minion engages you (before resolving quickstrike)"), A Game of Cards         | Western                                                    | `superlative` printed hit points host, per-player hp; `resourceTypes` (wild a type of its own); engagement interrupt (`engagement-interrupt.test.ts`)               |
| "Put Longshot into play under your control. This card gains surge. This effect cannot be canceled."; ally limit; piercing      | Longshot                                                   | `putIntoPlay`, `gainSurge`, `uncancellable` (wave 4 §3.19), `excludedFromAllyLimit`, `attackKeywords`; ownership is §3.71                                           |
| "Flip Spiral to her CORNERED side … Reveal the top card of the show deck … This effect cannot be canceled"                     | Cornered!                                                  | `changeVillainForm` (no-op when already there), `revealCard` from `scenarioDeck { top: 1 }`, `uncancellable`; §3.66 for the shuffle back                            |

### 3.74 Permanent cards set aside before setup step 1

> **Status: partial.** The deck-size count already leaves permanent cards out (`packages/engine/src/deck.ts` ~line
> 690); setup leaves them in the deck, and Vision's and Spectrum's Setups search deck and hand for them
> (`packages/cards/src/wave4/vision/vision-kit.ts` ~line 90, `wave4/mts/spectrum-kit.ts`). The owner's set-aside area
> exists (`PlayerState.setAside`, `CardDestination "setAside"`, wave 4 §3.22).

**Rules.** RRG 1.8 "Permanent" (p. 32): "Permanent cards are set aside before step 1 of setup and are put into play
later by abilities on other cards." Logan's erratum (p. 68): "Put Wolverine's Claws into play". The user changed Q15
to B on 2026-10-01 (Q25 follows); §4.1 is updated by the main session.

**Plan.** `createGame` moves each player's permanent cards (the printed keyword) from the deck list to that player's
set-aside area before Appendix II step 1, logged `cardsSetAside { reason: "permanent" }`; they are never shuffled,
drawn or mulliganed. In the same commit, Vision's (26001b) and Spectrum's (21001b) Setups put their cards into play
from the set-aside area, with their tests; Kitty Pryde (32030b), Logan (35001b) and Jean Grey (34001b) are then
scripted against it. Storm's WEATHER supports are §3.45/§3.46's separate deck, not this area. Precon totals do not
change (`wave6-precon-legality.test.ts`); Vision's and Spectrum's e2e seeds draw differently, so their fixtures are
re-baselined in the same commit.

---

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

All of Q1–Q31 answered by the user 2026-10-01 in the project thread (`1A 2B 3A … 31A`): the proposed default for
every one except **Q2**, **Q15** (changed from A to B at 23:33 UTC) and **Q28**. Each is built when its primitive is; a status column is added as they land.

| Q     | Decision                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Default: only the minion that entered play activates (RRG 1.8 p. 43 over MC32 p. 3).                                                       |
| 2     | **Differs from the default:** teamwork resolves **before** the minion's When Revealed, like quickstrike (ruling Feb 28, 2026 (4) #2).      |
| 3     | Default: optional setup difficulty is 0 unless the players choose; setup offers the printed amount for the mode.                           |
| 4     | Default: Robert Kelly redirects only undefended attacks against his controller (the first player).                                         |
| 5     | Default: one `statusDiscarded` per tough card, in one shared response window.                                                              |
| 6     | Default: Shadowcat "ignores" only a guard, patrol or crisis that would otherwise have stopped her attack or thwart.                        |
| 7     | Default: "After this card enters your hand" treacheries stay in hand with no replacement draw; other drawn encounter cards keep wave 5 Q4. |
| 8     | Default: one `countersPlaced` event per placement, with its amount.                                                                        |
| 9     | Default: damage beyond a cap is neither taken nor prevented; excess-damage readers still see it as dealt.                                  |
| 10    | Default: Zeal for the Cause's "player who defeated" is the player resolving it.                                                            |
| 11    | Default: the expert rejoin costs an acceleration token.                                                                                    |
| 12    | Default: a used role upgrade's removal survives a retry; an unused one is redealt.                                                         |
| 13    | Default: a stray Future Past card returns to the Future Past deck.                                                                         |
| 14    | Default: Captive allies optional; the first player chooses the deck; the ally is that player's for the game.                               |
| 15    | **Differs from the default:** permanent cards are set aside before setup step 1 (RRG 1.8 p. 32) now, in this wave: §3.74.                  |
| 16–25 | Defaults as written in §4.2.                                                                                                               |

| Q             | Decision                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| 25            | Default, so with Q15 = B Logan's and Jean Grey's Setups use §3.74 too.                                        |
| 26, 27, 29–31 | Defaults as written in §4.2.                                                                                  |
| 28            | **Differs from the default:** Rogue's copied traits are live, for as long as Touched stays on that character. |

Q32–Q47 answered by the user 2026-10-02 (`32A … 36B … 46B 47A`): defaults except **Q36** and **Q46**.

| Q                | Decision                                                                                                                                                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32–35, 37–45, 47 | Defaults as written in §4.2 (Q38: the encounter deck resets the moment it empties; the user flagged this as an immediate state transition, not deferred to the next draw).                                                                                                                                              |
| 36               | **Differs from the default:** a villain's new face (flip or next stage) goes through the full reveal pipeline (FAQ #35): its When Revealed and incite, and "when a card is revealed" responses, peril and surge as for any revealed card. Environment flips stay non-reveals (rulings Jan 26, Apr 30 and Jun 25, 2026). |
| 46               | **Differs from the default:** Mojo in the Middle's "After a player discards an obligation" triggers on any discard of an obligation by that player, whatever discards it.                                                                                                                                               |

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

Pass 2b (Storm, Gambit, Rogue):

26. **The Weather deck's edges** (§3.45, §3.46). The insert gives the deck no discard pile and no reset, and RRG 1.8
    p. 32 keeps the permanent supports in play. **Default:** a Weather card that would go to any discard pile, hand
    or deck goes back to the Weather deck facedown; the deck never resets; its owner sees its contents only while a
    choice offers them (Ororo's Setup, a swap), like any facedown deck.
27. **Throw de Card on Royal Flush** (§3.52). Royal Flush deals "0 damage to an enemy" three times. **Default:** Throw
    de Card's +1 per counter adds to each of the three (`modifyCardEffect` adds to every damage the event deals), each
    target is chosen separately and may repeat; an instance that still deals 0 deals no damage (no "after you damage"
    triggers). Royal Flush's own charge counter is placed after Throw de Card has paid.
28. **Rogue's copied traits** (§3.50). **Default:** the character's traits when Skin Contact or Energy Transfer
    resolves, printed and granted, kept until the end of the round even after Touched is set aside or moved; a second
    use adds its traits. Alternative: live, for as long as Touched stays on that character.
29. **Superpower Adaptation's "same classification"** (§3.51). RRG 1.8 p. 12 names one "aspect" classification for
    all five aspects. **Default:** an aspect ally finds any aspect event, a basic ally a basic event, a hero an
    identity-specific event, all in that character's owner's discard pile. An event taken from another player's
    discard pile stays theirs (RRG 1.8 p. 31) and returns to their discard pile.
30. **Skin Contact's targets** (§3.49). "Another character" includes another player's hero or alter-ego, any ally,
    any minion and the villain. **Default:** all of these; Touched on an alter-ego grants none of its four lines, and
    Deadly Touch treats another player's identity as friendly.
31. **Uncanny X-Men's "each of your characters"** (§3.58). **Default:** your identity is one of your characters, so
    in alter-ego form (Ororo, Remy and Anna Marie are MUTANT, not X-MEN) the cost reduction does not apply; the +1 hit
    point to X-MEN allies always does.

Pass 3 (MojoMania):

32. **The pack's name** (§7.1). MarvelCDB's `pack_name` and Hall of Heroes say "Mojo Mania"; the insert's cover and
    text, the card text ("the MojoMania scenario pack", 39002a, 39015a, 39025a), the RRG 1.8 FAQ and errata headings
    (pp. 64, 69) and main scheme 39025's own title say "MojoMania". **Default:** keep the emitted `Pack.name:
"MojoMania"`; "Mojo Mania" is only a search alias; correct `phase7-wave6-sources.md` and `phase7-wave5-sources.md`
    (which also put the pack in cycle 5).
33. **The MojoMania campaign in this wave** (§3.72). The definition of done names the box's campaign, not a scenario
    pack's. **Default:** ship `MOJO_CAMPAIGN` in wave 6, after the three scenarios; its log is rebuilt from the
    insert's instructions until a scan of the back cover is found.
34. **Threat on characters** (§3.59). **Default:** only card text places, moves or removes it. A character holding
    threat is not a scheme: it cannot be thwarted, crisis and "threat cannot be removed from schemes" do not apply,
    and 0 threat defeats nothing. A hero's change of form and a villain's flip are "flips"; MojoMania 1B moves the
    threat at the interrupt.
35. **"Revealed from the encounter deck"** (§3.64). **Default:** true for a card revealed off the encounter deck and
    for a facedown encounter card dealt from it and then revealed (villain phase step 4, "deal … an encounter card");
    false for the show deck, the set-aside area (1B, Wheel of Genres), a search, a discard pile and a player's deck.
36. **A villain's new face as a reveal** (§3.65). FAQ #35 calls Spiral's flip a reveal; rulings Jan 26, 2026 (4) #2,
    Apr 30, 2026 (3) #3 and Jun 25, 2026 (4) #3 say flipping environments is not. **Default:** a villain's flip or
    next stage resolves its When Revealed and its incite (printed or granted) and nothing else: no "when a card is
    revealed" responses (Black Widow, Eidetic Memory), no peril or surge. Every other flip is not a reveal.
37. **Dial M for Mojo's "each other encounter card"** (§3.65). **Default:** all eight types (RRG 1.8 p. 17): a
    revealed obligation, a villain's new face (FAQ #35) and a main scheme stage revealed by an advance each resolve
    incite 1 (the new stage takes the threat). Alternative: only cards revealed from the encounter deck.
38. **When the encounter deck resets** (§3.60). **Default:** the moment it empties (RRG 1.8 p. 17, "immediately"), so
    the acceleration token and Wheel of Genres' flip come then, not at the next draw; replay fixtures with an emptied
    encounter deck are re-baselined in the same commit. Alternative: keep the reset at the next draw and announce it
    there.
39. **"Damage from cards with a printed [X] resource"** (§3.68). **Default:** the card is the damage event's source:
    the event, support or upgrade whose ability dealt it, an ally for its attack or ability, the identity for a hero's
    basic attack (no printed resource, so a hero's basic attack cannot damage Goblin); resources spent to pay never
    count.
40. **Wild Wild Mojo with Dragon or Vampire** (§3.68). **Default:** RRG 1.8 p. 29, additions before doubling: 3
    damage from an [energy] card to Dragon is (3 + 1) × 2 = 8; Troll's +1 per card is an addition too.
41. **Where Longshot goes when he leaves play** (§3.71). **Default:** an encounter-backed card stays the scenario's
    (RRG 1.8 p. 31), so he goes to the encounter discard pile and can be revealed again; the same for a Captive ally
    in a standalone Project Wideawake (in the campaign, Q14 makes it a player's card for the game).
42. **Longshot's surge at campaign setup** (ruling Apr 30, 2026 (3) #1: "resolve Longshot's When Revealed ability
    during setup"). **Default:** in full: he enters play under the revealing player's control and the surge reveals
    one more encounter card for that player during setup. Alternative: the surge does nothing at setup.
43. **Longshot outside the campaign** (insert p. 2: "can be included in any scenario"). **Default:** an opt-in
    "Include Longshot" at setup for any scenario, off by default, never counted as a modular set, never a random pick.
44. **Modular pools** (§3.63). **Default:** Spiral and Mojo choose only among the six MojoMania genre sets (they need a
    SHOW environment); MaGog takes any modular set and defaults to one random genre set.
45. **Watch Me Play** (39065): "Forced Interrupt: When you look up a rule, you are confused." **Default:** it never
    triggers; the engine has no rule lookup. Alternative: opening the in-game glossary while the card is in your play
    area counts, through a client command the engine logs.
46. **Mojo in the Middle's "After a player discards an obligation"** (39060). **Default:** whenever an obligation in
    that player's play area goes to a discard pile because its own text or that player's ability or cost says so (a
    resolved obligation's "discard this card", a Sitcom obligation's Alter-Ego Action, Paparazzi's turn-end discard);
    not when removed from the game or discarded by another card.
47. **Undercover Mojo with less threat than the damage** (39031). **Default:** the whole damage is replaced and only
    the threat there is removed (at 0 the side scheme is defeated), as `instead` reads elsewhere (Magnetic Bubble).
    Alternative: only that much damage is replaced; the rest is dealt to Mojo.

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

### 6.2 Pass 2b: Storm, Gambit, Rogue

Read 2026-10-01: every record of `packages/content/raw/marvelcdb/{storm,gambit,rogue}.json` against the emitted
`packages/content/src/data/<pack>/cards.ts`; scans for 37015, 37025, 38001a; the Storm insert (Hall of Heroes' scan of
the printed sheet); an offline regeneration of all three packs into a scratch copy (only `gambit` drifts). RRG 1.8
errata: Storm and Gambit p. 68, **Rogue p. 69** (Anna Marie, Rogue, Energy Transfer, Mystique's Manipulations,
Bonebreaker). FAQ: none for these packs except Pixie (Storm #17) under Magik's entry (p. 64). **Source corrections:**
`docs/phase7-wave6-sources.md` §3.2's "Rogue ally copying Hope Summers" (Jan 17, 2026 (1)) is the Nightcrawler pack's
Rogue ally (#12, erratum p. 69), not a `rogue` card; the `rogue` ruling it misses is Dec 17, 2025 (4) #2 (Med Lab).

| Identity                            | Obligation             | Nemesis set (nemesis minion in bold)                                                  | Setup, hand size, precon                                                                                             |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Storm / Ororo Munroe (36001), 10 HP | Claustrophobia (36030) | **Callisto** (36031), Leader of the Morlocks, Switchblade, Knife Fight ×2             | Ororo's Setup: choose a Weather support into play (§3.46). 5 / 6. Leadership, 44 emitted → 40 + Weather deck (§3.45) |
| Gambit / Remy LeBeau (37001), 9 HP  | Guild Business (37025) | **Belladonna** (37026), The Assassins Guild, Guild Assassin ×2, Assassination Attempt | No Setup. 5 / 6. Justice, 40 cards                                                                                   |
| Rogue / Anna Marie (38001), 11 HP   | Deadly Touch (38024)   | **Mystique** (38025), Mystique's Manipulations, Misled ×3                             | Anna Marie's Setup (erratum p. 69): find Touched, set it aside. 5 / 6. Protection, 41 cards (Touched included)       |

Each pack also carries a modular set: The Shadow King (`shadow_king`, 36036–36039: Possessed turns allies into
CONTROLLED minions), Exodus (`exodus`, 37032–37035: Psionic Shield, Acolyte Frenzy) and Reavers (`reavers`,
38029–38035: teamwork (REAVER), pass 1 §3.1). All three compose (§3.58) once §3.1 lands.

**Storm: one weather at a time.** Four permanent WEATHER supports form a facedown four-card deck beside the identity
(§3.45, §3.46). Setup puts one into play; Weather Control (once per round) and Weather Goddess swap it for another
(§3.47) and resolve the new one's Special; Storm's Cape readies her after a Special, Storm's Crown generates the in-play
support's printed resource. Each support's constant hits every character, enemies included (insert: "friendly and
enemy"), and the events key on titles ("If Thunderstorm is in play, resolve its Special"). Flash Freeze is played only
when Storm herself is attacked (ruling Dec 17, 2025 (3)). Claustrophobia (erratum p. 68) locks her in alter-ego form.

**Gambit: charge counters on the identity.** Charge de Card places one (once per round); Molecular Acceleration, Royal
Flush and Natural Agility (§3.53) place more; Throw de Card spends up to 3 to add damage to an ATTACK event, which
Charged Card reads (§3.52, §4 Q27). The Rogue ally costs 1 less per counter. Remy's Thief Extraordinaire pays with an
encounter card's boost icons (§3.54), and The Thieves Guild follows it. Breaking and Entering is "SPY or THIEF" (below).

**Rogue: Touched.** One identity-specific upgrade, set aside at setup and at each player phase's start, attached by
Skin Contact (once per round) or Energy Transfer to any character (§3.48–§3.49, §4 Q30); while attached it gives Rogue
overkill (minion), retaliate 1 (villain), AERIAL (ally) or stalwart (hero), and she copies the host's traits for the
round (§3.50, §4 Q28). Goin' Rogue and Southern Cross read those keywords and traits; Rogue's Jacket, Bulletproof Belle,
Superpower Adaptation (§3.51) and Deadly Touch read where Touched is. The Gambit ally (38003) and Med Lab (§3.57) are
the pack's other new shapes.

**Card data fixes** (for `card-data-pipeline`):

- **Gambit's regeneration drift: the regenerated output is right in both places.** An offline `ingest --pack gambit`
  into a scratch copy changes only 37015 and 37025. 37015 Breaking and Entering (scan: "Play only if your identity has
  the SPY or THIEF trait. Action (thwart): Remove 3 threat from a scheme."): the committed
  `playRestrictions.requiresIdentityTrait: trait("SPY OR THIEF")` names one trait no identity has, so the card could
  never be played; `parse-text.ts` now leaves an "X or Y" trait unmatched on purpose (Moon Girl, `nova` 28018), and
  the regen emits `37015.breaking-and-entering-constant` (`playOnlyIf(or(hasTrait SPY, hasTrait THIEF))`, the Moon
  Girl precedent) beside the action. 37025 Guild Business (scan: "Give to the Remy LeBeau player." and an "Alter-Ego
  Action: Exhaust Remy LeBeau and spend a [energy] resource → remove Guild Business from the game.", no When
  Revealed): the regen's
  `37025.guild-business-constant` + `37025.guild-business-action` match Claustrophobia (36030) and Lost Visor (33027);
  the committed single `37025.obligation` predates that split. Regenerate; neither id is scripted yet.
- **Ability names behind "−".** MarvelCDB writes Gambit's and Rogue's ability names with U+2212 ("Charge de Card −
  Action"); the scans print an em dash (38001a). The parser misses the name, so 37001a, 37001b, 38001a and 38001b emit
  `-constant` ids with no `label`, and Skin Contact, Throw de Card, Charge de Card, Thief Extraordinaire and Withdrawn
  come out as constants. Normalize "−" to "—" before parsing (or correct the four records), before any of them is
  scripted: the ids change.
- **Rogue errata (RRG 1.8 p. 69) are missing** (`curation/rogue.ts` has `errata: []`): Anna Marie 38001b ("Setup: Find
  your Touched upgrade and set it aside. / Withdrawn — Forced Response: After you change to this form, find Touched and
  set it aside."), Rogue 38001a (Skin Contact: "Find Touched and attach it to another character. …"), Energy Transfer
  38007 ("Hero Action: Find Touched and attach it to a character other than Rogue and deal 2 damage to that character
  → …"), Mystique's Manipulations 38026 ("When Defeated: The defeating player searches … and shuffles it into their
  deck."). Bonebreaker 38031's raw text already reads "Forced Response" (p. 69).
- The raw text of Claustrophobia 36030, Possessed 36038 and Psionic Shield 37034 already carries the p. 68 errata as
  printed text; add `errata` entries so `printed` holds the card's own wording (low priority; `current` is right).
- Touched 38002: the header "If Touched is attached to a:" is emitted as its own constant (five constants for four
  lines); merge it into the four.
- Storm's Weather deck: §3.45.

**Deckbuilding (DoD §4b).**

- Storm: once §3.45 lands, a Storm deck listing a Weather support (36002–36005) in its player deck is illegal (they
  are `deckLimit: 0`, separate-deck cards), and `requiredIdentitySet` returns the hero set without them. Illegal-deck
  test for each.
- Gambit and Rogue print no deckbuilding rule. Touched is not permanent, so it counts toward Rogue's deck size (RRG 1.8
  p. 32 exempts permanent cards only).
- Team-Up (RRG 1.8 p. 43): Beauty and the Thief (37019, 38020, two printings of one title, "Max 1 per deck") only in
  Gambit or Rogue decks; Soul Sisters (34035) is legal in a Storm deck (positive test).
- Play restrictions, not deckbuilding: "To Me, My X-Men!" and Armor need X-MEN (each hero face); Mutant Education,
  X-Men Instruction, Moira MacTaggert and X-Gene need MUTANT (each alter-ego face); Breaking and Entering needs SPY or
  THIEF (both of Gambit's faces are THIEF).

**Precons.** All three are emitted from each pack's printed decklist and pass `wave6-precon-legality.test.ts` today.
Storm's changes with §3.45 (44 → 40). Gambit's list is unchanged by the regeneration. Rogue's stays 41.

## 7. Pass 3: MojoMania (`mojo`)

Read 2026-10-01: all 71 records of `packages/content/raw/marvelcdb/mojo.json` against the emitted
`packages/content/src/data/mojo/cards.ts` (67 cards); scans for 39012a, 39016, 39030, 39054; the printed insert
(Hall of Heroes' scan, `https://hallofheroeslcg.com/wp-content/uploads/2022/11/mojomania-insert.pdf`, pp. 1–19; the
back-cover campaign log is not in it), cited "insert p. N". RRG 1.8: FAQ p. 64 (Dial M for Mojo #35, Wild Wild Mojo
#66), errata p. 69 (The Search for Spiral #16, Fetch Quest #45). Rulings: Apr 30, 2026 (1) (a target that cannot take
damage), (3) #1, #3 and #7; Jan 26, 2026 (4) #2; Jun 25, 2026 (4) #3. The insert is worth keeping beside the other
rulebooks in `docs/campaign-modes/` (not done in this pass).

### 7.1 The pack

- **Contents** (insert pp. 1–2): three scenarios, "played individually as standalone adventures" or "sequentially as a
  campaign" (MaGog, Spiral, Mojo); six genre modular sets (Crime, Fantasy, Horror, Sci-Fi, Sitcom, Western) that "can
  be used in any scenario"; Longshot, a one-card modular set. Featured keywords (insert p. 3: amplify, hinder, incite,
  patrol, permanent, piercing, stalwart, villainous) all exist.
- **Name:** "MojoMania" (§4 Q32). The insert scan prints no product code; `phase7-wave6-sources.md`'s "MC31" is
  unchecked. `curation/mojo.ts` still names the cycle "Cycle 6"; 391e11cd renamed the seven hero packs' record to
  "Mutant Genesis".
- **No starter decks** (a scenario pack).

### 7.2 The three scenarios and their `Scenario` records

| Scenario | Villain                                                                       | Main scheme                    | Sets                                                                            | 1A Setup                                                                                                                                                                                                                                         | Needs (§3)                       |
| -------- | ----------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| MaGog    | 39001a standard, 39001b expert ("one double-sided villain card", insert p. 8) | Melee in the Mojo-seum (39002) | MaGog, Standard; 1 modular (1 random genre set recommended)                     | "Put The Champion environment card and The Challengers environment card into play, each with its BOOING CROWD side faceup." Win at 10[per_hero] ratings counters on The Challengers; lose at 10[per_hero] on The Champion (insert p. 7)          | 3.59, 3.67, 3.69; the genre sets |
| Spiral   | 39012a–39014a, two-sided (ESCAPED / CORNERED); I–II standard, II–III expert   | Across the Mojoverse (39015)   | Spiral, Standard; 3 genre sets (required)                                       | "Put The Search for Spiral side scheme and 1 random SHOW environment into play. Shuffle each other SHOW environment together with the Cornered! treachery to create the show deck. … Flip Spiral to her ESCAPED side." Insert pp. 11–12          | 3.63–3.66; the genre sets        |
| Mojo     | 39022–39024 (I–III); I–II standard, II–III expert                             | MojoMania (39025)              | Mojo, Standard; 1 + 1[per_hero] genre sets set aside, none shuffled in at setup | "Choose 1 modular set, plus 1[per_hero] additional modular sets, from the MojoMania scenario pack and set them aside. Put the Wheel of Genres environment into play, SPINNING side faceup." 1B's When Revealed brings in the first. Insert p. 16 | 3.59–3.63; the genre sets        |

**Curation records** (`ScenarioCuration`, `scripts/marvelcdb/curation/types.ts`; standard `["standard"]`, expert
`["expert"]` for all three; `evidence` cites the 1A text and the insert page):

- `magog`: `villainSetCode: "magog"`, `villainCardCode: "39001a"`, `expertVillains: { villainCardCode: "39001b",
setAsideVillainCardCodes: [] }`, `villainStages: { standard: [1, 1], expert: [1, 1] }`, `victory: "cardAbility"`
  (1B: "The players cannot win the game unless they wow the crowd"; MaGog's defeat is always replaced),
  `modularSetCount: 1`, `recommendedModularSetCodes` the six genre sets, `modularSetPool { restricted: false }`.
- `spiral`: `villainSetCode: "spiral"`, `villainStages: { standard: [1, 2], expert: [2, 3] }`, `modularSetCount: 3`,
  `modularSetPool { restricted: true }`, `separateDecks: [{ name: "show", contents: { cardType: "environment", trait:
SHOW, cardIds: ["39017"] }, discardPile: "none", whenEmpty: "remainsEmpty", closedToPlayerCards: true }]`.
- `mojo`: `villainSetCode: "mojo"`, `villainStages: { standard: [1, 2], expert: [2, 3] }`, `modularSetCount: 0`,
  `setAsideModularSetCount: { base: 1, perPlayer: 1 }`, `modularSetPool { restricted: true }`.
- `longshot` is `extraModular` and in no scenario's lists. `modularSetPool`, the per-player count, `extraModular`
  and the show deck's new fields wait for §3.63 and §3.66.

### 7.3 Environments and the genre machinery

- **The crowds** (39003, 39004, `flipSide` emitted): ratings counters on two environments; each flips at
  5[per_hero] keeping its counters (RRG 1.8 "Flip", p. 20); the B sides end the game at 10[per_hero] (The Champion:
  players lose; The Challengers: players win). The Challengers B's "Tag Team" fetches Surprise Contender.
- **Wheel of Genres** (39026a/b, insert p. 16): SPINNING flips after the encounter deck resets, or the players lose if
  no set-aside modular set remains (§3.60); STOPPED, at the start of step 3, reveals a random set-aside set's SHOW
  environment, puts the rest on top of the deck, deals the first player 2 facedown cards and flips back (§3.61,
  §3.62). Its flips are not reveals: no Black Widow cancel, no Eidetic Memory or Metaknowledge (rulings above).
- **SHOW environments**, one per genre set (SETTING, SHOW): each discards the other SETTING environments when revealed
  (one show at a time) and surges only when revealed from the encounter deck (§3.64, insert p. 18). In Spiral, a
  discarded SHOW goes to the bottom of the show deck (1B, §3.66).
- **Threat on characters** (the Mojo set, §3.59): Mojo's turn-end discards put threat on the hero; 1B moves it to the
  main scheme when the character flips (changes form) or leaves play.

### 7.4 The six genre sets

| Set     | Cards                                                                                                                                                             | Needs (§3)                   |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Crime   | Dial M for Mojo (incite 1 to each other encounter card, +1 THW), Build the Case, Crime Scene Investigation, Law & Order, Dragnet (hinder 1[per_hero]), Elementary | 3.64, 3.65                   |
| Fantasy | A Game of Mojo's (+1 hand size, amplify), Dragon, Goblin, Troll, Fetch Quest (erratum p. 69), Mana Drain                                                          | 3.64, 3.68, 3.70             |
| Horror  | The Mojo Files (quickstrike, −1 consequential), Bandolier of Stakes, Cultist → The Kraken, Vampire, Werewolf Pack                                                 | 3.64, 3.68, 3.31             |
| Sci-Fi  | Mojo Runner (toughness), Avalanche 9.0, Blob 3.14, Magneto 2.6, Pyro 4.0, Toad 2.0, ICE-Teroid M                                                                  | 3.64                         |
| Sitcom  | Mojo in the Middle, and five encounter obligations that stay in play until their Alter-Ego Action discards them (Family Matters … Watch Me Play)                  | 3.64, 3.65 (peril), Q45, Q46 |
| Western | Wild Wild Mojo (overkill, +1 damage), Dead or Alive, Card Shark, Gunslinger ×2, A Game of Cards                                                                   | 3.64                         |

### 7.5 Longshot

One card with an encounter back, shuffled into the encounter deck at setup in any scenario and never one of a
scenario's modular sets; as a boost card it has no boost icons (insert p. 2). His When Revealed puts him into play
under the revealing player's control, surges and cannot be canceled. §3.71, §4 Q41–Q43; the campaign carries him over
(§3.72).

### 7.6 Fixtures for `rules-qa-engineer`

- FAQ "Dial M for Mojo (#35)" (RRG 1.8 p. 64): Spiral flips with Dial M in play; her incite 1 places 1 threat on the
  main scheme (§3.65).
- FAQ "Wild Wild Mojo (#66)" (RRG 1.8 p. 64, also insert p. 18): an overkill attack on a minion; +1 to the minion's
  damage and +1 to the spill.
- Insert p. 18: Wild Wild Mojo adds 1 to an ally's consequential damage when it takes at least 1; Stinger Tail
  discarded by an attack's damage is gone before its retaliate 2; with Stinger Tail and Undercover Mojo both in play,
  the first player picks which replaces Mojo's damage (`orderTriggers`) and the other has nothing left to replace; a
  SHOW revealed from the show deck or by Wheel of Genres does not surge.
- Ruling Apr 30, 2026 (1): with Spiral ESCAPED or Dragnet in play, an effect whose only effect is damage cannot target
  the villain; one with another effect can.
- Ruling Apr 30, 2026 (3) #1: Longshot revealed at campaign setup resolves his When Revealed (§4 Q42).
- Errata p. 69: The Search for Spiral's 2 damage is a cost; Fetch Quest cannot play a card with requirement.

### 7.7 Card data fixes (for `card-data-pipeline`)

- **MaGog 39001a** is emitted as one villain with stages A and B; the insert (p. 8) makes them the standard and expert
  versions. Emit 39001a and 39001b as two one-stage `VillainCard`s (the Brotherhood shape, §1.4).
- **Spiral** is emitted as `39012b` with side A the CORNERED faces (12B/13B/14B) and `startingSide: "A"`. The scans
  print 12A as ESCAPED, and the insert (p. 11) says "Spiral begins the game on her ESCAPED side": emit `39012a` with
  side A ESCAPED, side B CORNERED, no `startingSide`. ESCAPED's ATK prints "★" (39012a scan): keep `dashedStats:
["atk"]` with a `cardNotes` line (her forced interrupt replaces every attack before the dashed-stat skip).
- **Mojo 39022–39024:** "Forced Response (Hero): After your turn ends, …" is emitted as a constant
  (`39022.mojo-constant` …). The parser should read the form qualifier on a forced response as it does "When Revealed
  (Alter-Ego)"; the ids change, so before scripting.
- **The Search for Spiral 39016:** the scan prints "Forced Response" (raw "Forced Interrupt"); add the p. 69 erratum
  (printed "Hero Action: Take 2 damage. Remove 3 threat from here.", current with the cost arrow; raw is current).
- **Fetch Quest 39045:** add the p. 69 erratum (printed "for free"; raw is current).
- **Avalanche 9.0 39054:** "deal 1 damage to **that** character" (scan; raw "this character").
- **Paparazzi 39030:** "Hinder 10." is in the text, not in `keywords`.
- `curation/mojo.ts`: cycle name "Mutant Genesis"; the three scenario records (§7.2); `longshot` `extraModular` and
  card backs once §3.63 and §3.71 land; regenerate `mojo`.

### 7.8 What this asks of the other agents

- **`card-data-pipeline`:** §7.7, then §7.2's records once §3.63 and §3.66's fields exist.
- **`game-rules-architect`:** §3.59–§3.71 and §3.74, in §8's order.
- **`ability-scripting-engineer`:** one agent per scenario's villain + main scheme + its own set (MaGog, Spiral, Mojo),
  one per genre set, Longshot with the Mojo set; then §3.72. §3.73 composes now.
- **`encounter-ai-designer`:** default picks for the greedy test player where an encounter card asks a player to
  choose (Mana Drain's type, Elementary's and Director's Directions' modes, Break a Leg's number, Erratic
  Teleportation's top or bottom).
- **`rules-qa-engineer`:** §7.6; a MaGog game won on The Challengers and one lost on The Champion; a Spiral game
  through the show deck (Cornered! shuffled back, a SHOW sent to the bottom); a Mojo game in which the encounter deck
  resets twice (Wheel flips, a set placed on top, the loss when none remain).
- **`game-client-engineer`:** threat on characters and obligations; ratings counters on the crowds; the show deck (a
  count, no faces); the set-aside modular sets (names and count, beside Wheel of Genres); the setup screen's modular
  pool and "Include Longshot"; glossary and how-to entries for ratings counters, the show deck, Wheel of Genres and
  threat on characters.

---

## 8. Build order (all passes)

One §3 section per agent and per commit. **At most one engine agent at a time** (`packages/engine`, and
`packages/content/src/schema` for a schema change); beside it, at most two other agents on disjoint files (curation,
card scripts, campaign definitions, tests). A scenario, hero or set is scripted only once every row it needs has
landed. The box first (its scenarios Sabretooth → Magneto, then Colossus and Shadowcat, then its campaign), then the
hero packs and MojoMania in release order (Cyclops, Phoenix; Wolverine, Storm, MojoMania; Gambit, Rogue).

**Engine queue, in order** ("after" names a dependency, not just the order):

| #   | §                           | Unblocks                                                             |
| --- | --------------------------- | -------------------------------------------------------------------- |
| 1   | 3.10                        | Sabretooth (Mystique's treacheries)                                  |
| 2   | 3.11                        | Sabretooth (Protect the Senator); Rescue Captives; X-Mansion         |
| 3   | 3.12                        | Sabretooth                                                           |
| 4   | 3.15                        | Master Mold                                                          |
| 5   | 3.18                        | Mansion Attack                                                       |
| 6   | 3.19 (after 3.18)           | Mansion Attack                                                       |
| 7   | 3.1                         | Magneto (Acolytes); Reavers                                          |
| 8   | 3.2                         | Magneto; Phoenix Force (Unleashed)                                   |
| 9   | 3.3                         | Magneto                                                              |
| 10  | 3.4 (after 3.3)             | Future Past (Nimrod); Blob 3.14                                      |
| 11  | 3.13                        | Magneto (Physical Strain); Field Commander                           |
| 12  | 3.14                        | Magneto (Wrapped in Metal); Death Factor                             |
| 13  | 3.16                        | Magneto                                                              |
| 14  | 3.17                        | Magneto (Zeal for the Cause)                                         |
| 15  | 3.74                        | Shadowcat, Logan, Jean Grey (Q15 = B); re-points Vision and Spectrum |
| 16  | 3.5                         | Colossus                                                             |
| 17  | 3.6 (after 3.5)             | Colossus                                                             |
| 18  | 3.7                         | Colossus                                                             |
| 19  | 3.8                         | Shadowcat                                                            |
| 20  | 3.9                         | Shadowcat (White Queen)                                              |
| 21  | 3.71                        | Longshot; Captive allies                                             |
| 22  | 3.20 (after 3.71)           | the MC32 campaign                                                    |
| 23  | 3.26                        | Cyclops                                                              |
| 24  | 3.27 (after 3.26)           | Cyclops                                                              |
| 25  | 3.28                        | Cyclops; Phoenix (Mission Training)                                  |
| 26  | 3.29                        | Cyclops; Wolverine (Warrior Skill)                                   |
| 27  | 3.30                        | Cyclops                                                              |
| 28  | 3.31                        | Cyclops; The Mojo Files                                              |
| 29  | 3.32                        | Cyclops                                                              |
| 30  | 3.33                        | Phoenix                                                              |
| 31  | 3.34                        | Phoenix                                                              |
| 32  | 3.35                        | Phoenix                                                              |
| 33  | 3.36                        | Phoenix                                                              |
| 34  | 3.37                        | Phoenix (Dark Phoenix)                                               |
| 35  | 3.38                        | Phoenix (Consume the World)                                          |
| 36  | 3.39                        | Phoenix                                                              |
| 37  | 3.40                        | Wolverine (Death Factor)                                             |
| 38  | 3.41                        | Wolverine                                                            |
| 39  | 3.42 (after 3.30)           | Wolverine                                                            |
| 40  | 3.43                        | Wolverine (Jubilee)                                                  |
| 41  | 3.46                        | Storm (then 3.45, data)                                              |
| 42  | 3.47 (after 3.46)           | Storm                                                                |
| 43  | 3.63 (schema)               | all three MojoMania scenarios                                        |
| 44  | 3.64                        | the six genre sets                                                   |
| 45  | 3.65                        | Crime, Sitcom; Spiral                                                |
| 46  | 3.68 (after 3.4)            | Fantasy, Horror                                                      |
| 47  | 3.70                        | Fantasy (Fetch Quest)                                                |
| 48  | 3.59                        | Mojo; Paparazzi                                                      |
| 49  | 3.67                        | MaGog                                                                |
| 50  | 3.69                        | MaGog; Mojo (Director's Directions)                                  |
| 51  | 3.66                        | Spiral                                                               |
| 52  | 3.60                        | Mojo (Wheel of Genres)                                               |
| 53  | 3.61                        | Mojo (Wheel of Genres)                                               |
| 54  | 3.62 (after 3.60, 3.61)     | Mojo                                                                 |
| 55  | 3.52 (after 3.42)           | Gambit                                                               |
| 56  | 3.53                        | Gambit                                                               |
| 57  | 3.54                        | Gambit                                                               |
| 58  | 3.55                        | Gambit                                                               |
| 59  | 3.48                        | Rogue                                                                |
| 60  | 3.49 (after 3.48)           | Rogue                                                                |
| 61  | 3.50 (after 3.49)           | Rogue                                                                |
| 62  | 3.51                        | Rogue                                                                |
| 63  | 3.56                        | Rogue (Moira MacTaggert)                                             |
| 64  | 3.57 (extends 3.70's field) | Rogue (Med Lab)                                                      |

**Beside the engine agent:**

- **Now:** the verification tests §3.21, §3.22, §3.24 (`rules-qa-engineer`, test files only); §7.7's data fixes;
  scripting Project Wideawake (needs nothing new).
- **As rows land:** Sabretooth after 1–3; Master Mold after 4; Mansion Attack after 6; Magneto after 14; Colossus
  after 18; Shadowcat after 20; the MC32 campaign after 22 with §3.23 (compose) and §3.24; each hero pack after its
  rows; §3.45's curation after 41; §7.2's records after 43 and 51; the genre sets after 44–48 (one agent per set);
  MaGog after 50, Spiral after 51, Mojo after 54; §3.72 after the three scenarios.
