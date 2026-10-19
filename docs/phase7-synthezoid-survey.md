# Synthezoid Smackdown (MC57): source and data survey

> **Status:** survey for the Synthezoid Smackdown scenario pack (`synthezoid`, MC57), added by the owner's decision of
> 2026-10-19 to the wave 11 PR (#251). It replaces the 2026-10-11 choice of a separate PR
> (`docs/phase7-wave10.md` §4.1 Q2 and `docs/phase7-wave10-sources.md` Q1 record the old answer; the main session
> edits those two). The working spec is [phase7-synthezoid.md](phase7-synthezoid.md).
> **Checked** means read this session from a primary file: the raw cache, the MC57 rulebook, RRG 1.8, the rulings
> transcript, repo code, or a scan in `assets/card-art/bundles/cards/`. Everything else says "unchecked". Hall of
> Heroes and MarvelCDB are pointers, not authorities.

---

## 0. What the spec author most needs to know

- **Chronology.** The pack sits after Civil War (MC56, October 17, 2025) and before Wonder Man and Hercules (MC58 and
  MC59, February 20, 2026). It is cycle 10 ("Civil War"), never cycle 11 with Fear No Evil (MC60, July 24, 2026).
  Hall of Heroes' own navigation puts it in the Civil War cycle (index line 150, "Cycle 10 Civil War") and links it
  between the two (index lines 28, 119, 136). The spec's §1 names every field that encodes this.
- **The pack has no heroes.** 81 raw records and no hero, no starter deck, no Team-Up pair, no campaign. It adds two
  leaders, ten encounter sets and four main scheme stages. So there is no progression reward and no `UNLOCK_WAVES` row.
- **The MC57 rulebook is public and was read this session** (all 20 pages, text extraction):
  `https://hallofheroeslcg.com/wp-content/uploads/2025/12/mc57_rulebook-web.pdf`. It is **not in the repo**; the repo
  has `mc56_rulebook-web_1.pdf` beside it in `docs/campaign-modes/`. The main session should add it as
  `docs/campaign-modes/mc57_rulebook-web.pdf` (not done here: this task touches two new docs only). It settles the
  preconstructed scenarios, the competitive rules and the cooperative reading of "the enemy team".
- **Phased Out and Moon Knight are errata, and Phased Out is also a ruling.** RRG 1.8 p. 70 (checked, lines 5182 to
  5190): Moon Knight #65 gains "(Limit once per phase.)"; Phased Out #76 reads "Hero Action" or "Hero Response". The
  March 19, 2026 Ruling 1 (checked, `marvel-champions-rulings-post-rrg-1-7.md` lines 645 to 653) confirms "Hero
  Action". The two agree; there is no conflict to flag.
- **Two things the normalizer will get wrong on this pack** (§5): Dense and Intangible print "Mass form.", which the
  keyword parser already reads as the `form` keyword that gives an identity extra forms (`keywords.ts` line 200); and
  the eight reprinted Standard PvP records are the same cards as Civil War's.
- **One main scheme question has no official answer** (spec §4.1 Q1): whether the pack's four new stages join the
  Civil War builder's stage choices. The rulebook says "four main scheme stage 1s from the chosen side" (MC56, line
  428); with this pack there are five.

---

## 1. Release and chronology (sources)

- **Hall of Heroes** (`hallofheroes-llms.txt` line 119, and the page fetched this session): "Release date: December,
  2025", lead designer Caleb Grace, links "Insert" (the rulebook above), "Rulings" (the post-RRG-1.6 page), "News
  Article". No card count and no new keywords are stated on the page.
- **Exact date: unchecked.** A web search (this session) returned an FFG announcement that the pack was available in
  select markets on **November 21, 2025** and in the US on **December 5, 2025** (Asmodee listing, Fantasy Flight Games
  "Available Now: November 21"). The spec records `2025-12-05` with `releaseDateSource` naming both and the
  disagreement, as the Civil War curation does for its date. Either date falls between October 17, 2025 and February
  20, 2026, so the order does not depend on the choice.
- **RRG 1.8 Appendix VI** (`mc_rulesreference_v18_compressed.md`, p. 71) lists waves 1 to 10 and does not name the
  pack (`docs/phase7-wave10-sources.md` §1, §10). Scenario packs are in no Limited wave. Wave 9 also shipped Trickster
  Takeover without the list naming it.
- **MC56's last page** (line 911, checked): "Continue the registration vs. resistance conflict with the Synthezoid
  Smackdown scenario pack!" MC57's last page (checked): "Continue the registration vs. resistance conflict with the
  Civil War Expansion!" The two boxes are one product line.

## 2. What is in the pack

Raw cache `packages/content/raw/marvelcdb/synthezoid.json` (fetched 2026-09-13, 81 top-level records; read in full).
Readable list: `docs/cards/by_pack/synthezoid.md`. By `type_code`: leader 8, minion 15, treachery 21, attachment 11,
side scheme 12, event 5, main scheme 4, resource 2, obligation 2, upgrade 1. The b faces are nested `linked_card`s:
four main scheme b stages, Intangible (57046b) and two Now It's Personal (57039b, 57081b), so 88 faces. Counts below
are by quantity (checked).

**Two sides, one leader each** (MC57 p. 3: "1 Leader ... 4 stages and their own 10-card encounter set", "2 Main
Schemes: 1 stage 1 and 1 stage 2", "4 Modular Encounter Sets: Each set is exactly 5 cards", "1 Standard PvP Encounter
Set"):

| Side         | Leader (raw set)                 | Leader's set                           | Main scheme stages | Modular sets (5 cards each)                             | PvP copy        |
| ------------ | -------------------------------- | -------------------------------------- | ------------------ | ------------------------------------------------------- | --------------- |
| Registration | She-Hulk I to IV, 57001 to 57004 | `she_hulk_leader`, 57007 to 57012 (10) | 57005a/b, 57006a/b | S.H.I.E.L.D. Ops, Thunderbolts, Taskmaster, Deadly Duo  | 57036 to 57039a |
| Resistance   | Vision I to IV, 57040 to 57043   | `vision_leader`, 57046a to 57054 (10)  | 57044a/b, 57045a/b | Young Avengers, Scarlet Twins, Moon Knight, Royal Guard | 57078 to 57081a |

- **Leaders.** Four-stage villains (`type_code: "leader"`, `health_per_hero`): She-Hulk SCH 1/1/1/2, ATK 2/3/3/3, HP
  16/20/20/24 per player; Vision SCH 1/1/1/2, ATK 1/2/2/2, HP 14/18/18/22 per player. Stages I and III print Setup
  (the enemy team finds She-Hulk's Superhuman Strength, or Vision's mass form attachment, and attaches it); stages II
  and IV print Steady and a When Revealed ("Deal each player an encounter card. [Leader] cannot take damage this
  phase."). Standard play uses I and II, expert III and IV (MC57 p. 6, p. 7).
- **The preconstructed scenarios** (MC57 pp. 6 and 7, checked). She-Hulk: main scheme deck "Enforce the Law, Mighty
  Avengers"; encounter deck She-Hulk, S.H.I.E.L.D. Ops, Thunderbolts, Taskmaster, Deadly Duo and Standard. Vision:
  "Protect Secret Identities, Expose Overreach"; Vision, Young Avengers, Scarlet Twins, Moon Knight, Royal Guard and
  Standard. So each side has exactly one stage 1B and one stage 2B, and the preconstructed scenario uses all four of
  its modular sets (no choice of three or four, unlike the Civil War leaders' own recommended sets).
- **Main schemes.** The A faces (57005a, 57006a, 57044a, 57045a) are word for word the Civil War A faces
  (56063a "Contents ... Setup", and flavor-only stage 2As; checked against `cw.json`). The B faces are four new stages,
  and each repeats the text of a Civil War stage of the other side:
  - 57005b Enforce the Law (registration 1B): hinder 2 with more than one player; "The enemy leader gains steady." Same
    text as 56200b Going Underground (resistance).
  - 57006b Mighty Avengers (registration 2B): the enemy leader gets +1 ATK while attacking (+2 if undefended); players
    lose if completed. Same text as 56142b Secret Avengers (resistance), checked by the stage listing.
  - 57044b Protect Secret Identities (resistance 1B): hinder 2; "[star] Forced Response: After resolving step 1 of the
    villain phase, each player discards the top 3 cards of their deck." Same text as 56122b Public Outrage
    (registration).
  - 57045b Expose Overreach (resistance 2B): "Allies enter play exhausted."; players lose if completed. Same text as
    56124b No Going Back (registration).
    Values: base threat 0, target 7 (1B) or 9 (2B) per player, acceleration +1 per player; 57044b's raw escalation field
    is starred (`escalation_threat_star`) because its text mentions threat.
    Wave 10 §7.5 and §7.6 list those Civil War stages and `cw/main-schemes/{registration,resistance}.ts` script them, so the four are likely reuse under new ids and titles (the scripting agent diffs the full printed text first).
- **The leaders' own sets.**
  - She-Hulk: Superhuman Strength x2 (attachment; attack gains overkill, discard), Focused Rage x2 (stalwart, SCH
    1), One-Two Punch x2, Ground Stomp x2, Gamma Slam, Legal Practice (side scheme, 3 per player).
  - Vision: Dense and Intangible (one double-sided permanent attachment, "Mass form."), Solar Gem, Vision's Cape,
    Mass Increase, Density Control (surge), Solar Beam x2, Superdense Strike, Phase Disruption, Just Passing Through
    (side scheme, 3 per player).
- **The eight modular sets.** S.H.I.E.L.D. Ops (Operator x2, two treacheries, Homeland Security); Thunderbolts
  (Atlas, Songbird, Penance, Justice Like Lightning, The Thunderbolts); Taskmaster (minion, Sword, Shield, Mimicked
  Move, Taskmaster's Academy); Deadly Duo (Jester, Jack O'Lantern, Mad Jack's Platform, Jester's Yo-Yo, Deadly Duo);
  Young Avengers (Patriot, Hawkeye, Stature, Teenage Superheroes, Young Avengers); Scarlet Twins (Speed, Wiccan,
  Superspeed, the obligation Spellcasting, Superpowered Siblings); Moon Knight (Moon Knight, Crescent Dart x2, Fist
  of Khonshu, Khonshu's Avatar); Royal Guard (Janus, Amir, Atlanteans, the obligation Blood Debt, The Royal Guard).
  Twenty-seven records are unique (`is_unique`): the eight leader stages, Taskmaster and his two attachments, Atlas,
  Songbird, Penance, Jester, Jack O'Lantern, Mad Jack's Platform, Solar Gem, Vision's Cape, Patriot, Hawkeye,
  Stature, Speed, Wiccan, Moon Knight, Janus and Amir. Several share a title with a hero, ally or identity already in
  the pool (She-Hulk, Vision, Hawkeye, Wiccan, Moon Knight), the same situation as Civil War's Hercules and Falcon
  minions (`docs/phase7-wave10.md` §3.8, owner Q5 = A).
- **The leaders' player cards (competitive only).** Eight cards: She-Hulk's You're Out of Order! (57032), She-Hulk
  Smash (57033), Make Me Angry (57034), Legal Counsel (57035); Vision's Calculated Risk (57074), Synthezoid Strike
  (57075), Phased Out (57076), Android Assistance (57077). All name "your leader" or "the enemy leader". They follow
  the same rule as Civil War's sixteen (`docs/phase7-wave10.md` §7.9): data, not playable until competitive mode.
- **Standard PvP, reprinted.** 57036 Righteous Cause, 57037 Whatever It Takes, 57038 Targeted Strike x2, 57039a/b
  Choosing Sides / Now It's Personal; and 57078, 57079, 57080 x2, 57081a/b. Raw `duplicate_of_code` is 56125, 56126,
  56127, 56128a and 56203, 56204, 56205, 56206a (checked). Text is word for word the Civil War cards (checked in the
  list). Choosing Sides' scan prints "128A" in MC57's own competitive diagram beside the registration area and "206A"
  beside the resistance area (MC57 p. 10 to 11, text extraction).

## 3. Mechanics the pack uses, and how Civil War already models them

The Civil War work is `docs/phase7-wave10*.md` (spec, data survey, sources, QA), the data in
`packages/content/src/data/cw/`, and the scripts in `packages/cards/src/wave10/cw/`. Status words follow wave 10 §3:
**reuse** (found by name in the repo this session, used as is), **verify** (found, not run for this card: a test must
prove it), **extend**, **new**.

| Mechanic in MC57                                                                                | Cards                                                          | Civil War model                                                                                                                                                              | Status          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| A leader is a four-stage villain; stage I and III Setup, II and IV When Revealed and Steady     | 57001 to 57004, 57040 to 57043                                 | `VillainCard` with `printedType: "leader"`, `Scenario.villainStages: { standard: [1, 2], expert: [3, 4] }` (wave 10 §1.1, §3.7)                                              | reuse           |
| The two scenarios as records with a `side`, a main scheme card and a modular set range          | She-Hulk, Vision                                               | Four records in `cw/scenarios.ts`; `modularSetCount` range and `mainSchemeStages.recommended` (wave 10 §1.4)                                                                 | reuse (data)    |
| Stage choices from the side's main scheme                                                       | 57005 to 57006, 57044 to 57045                                 | One `MainSchemeCard` per side with eight stages and `printedCardId`; builder derives options from that one card (wave 10 §1.2, §3.2)                                         | **extend** (Q1) |
| "The enemy team finds / searches / deals / exhausts / chooses"                                  | 57001, 57003, 57040, 57042, 57053, 57073, 57029, 57038, 57039a | `enemyTeamDecider`, `EffectSpec` search and deal with an authority, grim rule, first player decides (wave 10 §3.5, owner Q6 = A)                                             | reuse           |
| "Your leader" and "the enemy leader" as references; "your leader" cannot resolve in cooperative | 57017 to 57019, 57025, 57032 to 57035, 57074 to 57077          | `leader` ref, "Otherwise" fallbacks, "Do as much as you can" (wave 10 §3.6, owner Q11 = A). MC57 p. 4 repeats MC56 p. 6 word for word                                        | reuse; Q2       |
| A permanent attachment set up by the leader, with no "Attach to" sentence                       | 57046a (Dense)                                                 | Curation `impliedAttachHost: "ownWhenRevealed"` (`ownSetup` in `curation/cw.ts`, Finesse 56174, Energy Channel 56098)                                                        | reuse           |
| Flipping a double-sided attachment after villain phase step 1                                   | 57046a/b, 57047, 57048, 57050, 57052, 57053, 57077             | `EffectSpec flipCard` with `otherFaceId`, "after resolving step 1 of the villain phase" (Public Outrage 56122b, wave 10 `registration.ts` line 166), `faceNamed`             | **verify**      |
| An attachment's printed ATK or SCH changes with the face (Dense ATK 1, Intangible SCH 1)        | 57046a/b                                                       | Attachment stat modifiers on a villain host (printed ATK or SCH on an attachment, as on Taskmaster's Sword 57023). A face change on the same instance has no precedent found | **verify**      |
| "Mass form." label that must not become the identity-form keyword                               | 57046a/b                                                       | None: `keywords.ts` line 200 reads "Mass form." as `form` for the hero Vision (26002) and Mutant Genesis Solid/Phased                                                        | **new** (data)  |
| Hero Action or Hero Response on an encounter attachment that players use against the leader     | 57023, 57024, 57047, 57048                                     | Civil War's leader attachments (Cap's Shield 56143, Finesse 56174); not run for a Hero Action or Hero Response cost, unchecked                                               | verify          |
| Choose an attachment on the enemy leader by the label of its ability                            | 57076 (competitive only)                                       | None found (`hasAbility`, `abilityLabel`, `hasLabel`, `withAbility` searched in `spec.ts` and `select.ts`)                                                                   | **new**, later  |
| Hinder X on side schemes; "this stage gains hinder 2 [per_hero]" with more than one player      | all side schemes but 57012, 57054; 57005b, 57044b              | Wave 10 §3.13 (done)                                                                                                                                                         | reuse           |
| Resolve a "When Revealed" ability of another card (topmost treachery in the discard pile)       | 57065, 57068 (also 57058 for each minion)                      | `EffectSpec resolveSpecials` with a `count` binding (Teenage Superheroes shape); "topmost" selection of the encounter discard pile                                           | **verify**      |
| A limit once per phase on a When Revealed                                                       | 57065 (erratum)                                                | `AbilityLimit` per phase (wave 10 §3.14 extended it per event player)                                                                                                        | verify          |
| Activate the leader without giving it a boost card                                              | 57020                                                          | Enemy activation exists; a "no boost card" option was not found by name                                                                                                      | **verify**      |
| Villainous (boost card for each activation)                                                     | 57022 Taskmaster                                               | `packages/engine/src/resolve/villainous.ts` is being written by another agent in the working tree now (untracked); RRG 1.8 p. 47                                             | dependency      |
| "Attach to X. Otherwise, attach to the enemy leader."                                           | 57023, 57024, 57066                                            | Wave 2's "ifAble attach host" gap (OR of two targets) was not individually re-checked                                                                                        | verify (data)   |
| "Attach to a minion of the enemy team's choice. Otherwise, this card gains surge."              | 57029                                                          | Resistance Fighter 56191 (curation `curation/cw.ts` lines 187 to 188, owner Q6 = A)                                                                                          | reuse           |
| Alter-Ego Response on a side scheme, with an exhaust-identity cost                              | 57012 Legal Practice                                           | None found for a side scheme in Civil War; `canRemoveThreatFrom` exists for "cannot be removed by heroes or allies"                                                          | verify          |
| Cancel a played card's effects, then discard the obligation                                     | 57063 Spellcasting                                             | `cancelTriggeringEvent`, `modifyCardEffect` exist in `spec.ts`; no Forced Interrupt on "you play a card" was checked                                                         | verify          |
| Gain a trait from an obligation; "if you have the Hunted trait"                                 | 57072, 57069, 57070                                            | `grantTraitUntil`, `hasTrait`, wave 10 §3.16 (Unregistered)                                                                                                                  | reuse           |
| Discard the top N cards, then count different card types                                        | 57027, 57028, 57071, 57019                                     | `discardDeckUntil`, `distinctCardTypes`, `dealIndirectDamage`                                                                                                                | reuse           |
| Competitive mode: team, boost card dealt to a defending leader, equal-phase end, tie-breakers   | 57005a, 57044a, 57032 to 57039, 57074 to 57081                 | Not built (`docs/competitive-mode-plan.md`); `gameMode` and `inMode` exist, `createGame` refuses `competitive`                                                               | out of scope    |

Anything marked reuse or verify was found by name, not run. Wave 10 §3 states the same rule; the scripting agent proves
each in its own module test.

## 4. Data gaps in the raw cache

**Checked.** Scans exist locally for 70 of the 88 faces, in `assets/card-art/bundles/cards/` (gitignored, never wired
into the data). Missing: **57005a, 57005b, 57006a, 57006b, 57044a, 57044b, 57045a, 57045b** (the main scheme faces),
**57036 to 57039a/b and 57078 to 57081a/b** (the PvP reprints; Civil War's scans 56125 to 56128 and 56203 to 56206 are
stand-ins). The MC57 rulebook's competitive diagrams (pp. 10 to 11) print 57005b and 57044b in full, which checks those two texts.

| Gap                                                                                                     | Cards                                                                     | What to do                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Boost icons absent** (`boost: null`, not zero; the list prints "not recorded")                        | 57036, 57037, 57039a/b, 57078, 57079, 57081a/b, 57046a/b, and the leaders | Read the scans where they exist (57046a/b); a PvP reprint takes the Civil War card's value (56125 etc.); leader faces have no boost area                        |
| **Side scheme with no starting threat** (`base_threat: null`)                                           | 57039a, 57081a Choosing Sides                                             | The Civil War copy 56128a prints **4 per player** (scan read this session, "4" and the per-player icon). Take 4 per player; check 57039a when a scan exists     |
| **Side scheme threat fixed or per player** (raw `base_threat_fixed`)                                    | 57012, 57054 per player; the other eight fixed                            | Scans read this session: 57012 prints "3" with the per-player icon; 57054 the same; **57016 prints a plain 3**. The other seven fixed values are raw only       |
| **Side scheme icons absent on Choosing Sides** (`scheme_*` all null; ten others carry one)              | 57039a, 57081a                                                            | Civil War's 56128a prints none (scan read); expected none                                                                                                       |
| **Dense prints only "Permanent. Mass form." and ATK 1**; Intangible prints a Forced Interrupt and SCH 1 | 57046a/b                                                                  | Read both scans before scripting (they exist as PNG only, no JPG)                                                                                               |
| **`[per_hero]` icons in the text**                                                                      | 57005b, 57044b, "Hinder 1[per_hero]"                                      | Present in `real_text` (unlike wave 10's expectation, which the Civil War cache also carries as HTML spans). No restore needed; confirm on 57005b's p. 10 print |
| **`[star]` icons on a text line** (Superhuman Strength, Focused Rage, Hawkeye, Mass form's neighbors)   | see list                                                                  | Existing `star-icon` handling (RRG 1.8 "Star Icon", p. 40); not a boost star                                                                                    |
| **Erratum, current text** (RRG 1.8 p. 70)                                                               | 57065 Moon Knight, 57076 Phased Out                                       | `Errata` records, printed text kept (spec §2 D3)                                                                                                                |
| **Missing set side** (not in the source)                                                                | 10 sets                                                                   | `EncounterSet.side` curated by set (wave 10 §1.3); the card frame colors identify it (MC56 p. 4, MC57 p. 2)                                                     |
| **Pack and cycle fields**                                                                               | whole pack                                                                | `pack_wave` is `null` on every record (Civil War's cache said 10); the cycle is curated                                                                         |
| **Release date**                                                                                        | pack                                                                      | Curated, with the source line (§1)                                                                                                                              |
| **Raw `traits` and `quantity`**                                                                         | all                                                                       | Present on every record; no gap                                                                                                                                 |

Not checked: the other seven fixed side-scheme thresholds against scans (57021, 57026, 57031, 57059, 57064, 57068,
57073); the boost icons of each of the 73 other faces beyond the raw field.

## 5. Normalizer risks on this pack

1. **"Mass form."** `parse-text.ts` and `keywords.ts` read a line "X form." as the `form` keyword
   (`formType: "mass"`), which `changeAdditionalForm` and the identity's forms use. On 57046a/b it is a label that
   "Vision's mass form attachment" refers to. The curation must mark those two cards so the parser emits no `form`
   keyword (a `Correction` with `textReplace`, or an `ignoreKeywords` field if the curation type has one; the spec's
   D3 asks for whichever exists). Source: `keywords.ts` lines 195 to 205.
2. **"Attach to your She-Hulk leader."** Make Me Angry (57034) parses through the existing `parse-text.ts` line 557
   rule ("Attach to your Iron Man leader."), which already names She-Hulk in its comment. Checked.
3. **The standard_pvp records.** The normalizer emits both printings of a set under one id and cannot tell which copy
   belongs to which side (wave 10 survey G3). Civil War solved this with two side-tagged `competitiveOnly` sets
   (`standard_pvp_registration`, `standard_pvp_resistance`). This pack's two copies need two more set ids (spec §2 D4).
4. **Reprints as their own cards.** `duplicate_of_code` is recorded as `CardProvenance.duplicateOfCardId` and the
   reprint is still emitted (`raw-types.ts` lines 38 to 43; the wave 1 reprint-art policy). Nothing is dropped.
5. **Eight leader player cards** have `faction_code: "basic"` and a leader set (`she_hulk_leader`, `vision_leader`,
   `card_set_type_name_code: "leader"`; checked); Civil War's sixteen use `specificTo: { kind: "competitive", ... }`. Same
   treatment.
6. **Obligations inside encounter sets** (Spellcasting 57063, Blood Debt 57072): Civil War has Unregistered Super
   (56106, 56114) as an obligation in a modular set; the same shape.

## 6. What the cooperative game does with the "enemy team" cards

MC57 p. 4 (checked) is word for word MC56 p. 6: "the enemy leader" is the leader in play; "the villain" means the
enemy leader; "the enemy team" is the players, resolved with the grim rule; "your leader" cannot be resolved and the
card's alternate effect resolves, doing as much as possible. Owner answers 6 and 11 of wave 10 already implement that.
Cards that need it, by shape:

- **"[X] your leader. Otherwise, [Y]"** (57017 Atlas, 57018 Songbird, 57019 Penance, 57060 Speed, 57061 Wiccan,
  57027, 57028 and others): the first half cannot resolve, so the "Otherwise" half does. Same as Civil War's
  "Otherwise" cards.
- **"If [condition], [X] your leader. Otherwise, [Y]"** (57025 Mimicked Move): the condition can be true while the
  half it guards cannot resolve. Spec §4.1 Q2.
- **"The enemy team exhausts / finds / searches"**: the first player decides in a prompt marked as the enemy's (owner
  Q6 = A). 57053 Phase Disruption is the sharpest: "The enemy team exhausts an upgrade you control" makes the players
  choose their own upgrade as an opponent would.
- **Player-side cards that name "your leader"** (57032 to 57035, 57074 to 57077): set aside.

## 7. Reuse versus new engine work, in one view

- **Pure reuse, no engine change** (script and test only): the four main scheme stages (text identical to Civil War
  stages), She-Hulk's leader set, five modular sets (S.H.I.E.L.D. Ops, Deadly Duo, Young Avengers, Scarlet Twins,
  Royal Guard), if the verify rows hold.
- **Verify, then probably reuse:** Vision's flipping attachment (the largest risk), Moon Knight's set and Taskmaster's
  (once Villainous lands), Thunderbolts (the leader-or-you fallbacks and Justice Like Lightning's no-boost activation),
  Legal Practice's Alter-Ego Response, Spellcasting.
- **New or extend:** the stage pool across two products (Q1); a way to keep "Mass form." from reading as an identity
  form; a labeled-ability query for Phased Out (competitive only, so it can wait).
- **Out of scope:** competitive mode, the eight player cards and the PvP copies as playable content.

## 8. Sources read this session

- `packages/content/raw/marvelcdb/synthezoid.json` (81 records, all printed), `docs/cards/by_pack/synthezoid.md`,
  `packages/content/raw/marvelcdb/cw.json` (main scheme stages).
- MC57 rulebook (downloaded to the scratch directory, `pdftotext -layout`, all pages). **Not in the repo.**
- `mc_rulesreference_v18_compressed.md` lines 5180 to 5192 (the Synthezoid errata); `marvel-champions-rulings-post-rrg-1-7.md`
  lines 645 to 653 (Phased Out), and a grep for "Synthezoid" and "enemy leader".
- `docs/phase7-wave10.md` §1, §3, §4.1, §7.9, §8; `docs/phase7-wave10-sources.md`; `docs/phase7-wave10-data-survey.md`
  G2, G3, section 3.5, section 5; `docs/phase7-wave2-data.md` line 318 and line 852; `docs/campaign-modes/markdown/mc56_civil_war.md`
  pages 3 to 6 and 17.
- Code: `packages/content/src/data/index.ts`, `data/cw/packs.ts`, `data/wonder_man/packs.ts`, `data/fne/packs.ts`,
  `scripts/marvelcdb/curation/cw.ts` and `types.ts`, `scripts/ingest-marvelcdb.ts`, `scripts/marvelcdb/survey.ts`,
  `packages/cards/src/wave10/{modules,card-groups,cards}.ts`, `packages/cards/src/playable/scenario-options.ts`,
  `packages/client/src/content/pool.ts`, `progression/unlocks.ts`, `view/new-in-box-model.ts`.
- Scans read as images: 57012, 57016, 57054, 56128a.
- Web: Hall of Heroes' Synthezoid Smackdown page; a search for the release date (not authoritative, see §1).
