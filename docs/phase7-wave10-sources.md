# Phase 7, Wave 10: Cycle 10 – Civil War, Wonder Man, Hercules – Sources

> **Status:** Source survey for Phase 7 wave 10 (Civil War custom scenario expansion `cw` / MC56, Wonder Man
> hero pack `wonder_man`, Hercules hero pack `hercules`). Scope is in
> [phase7-wave10-handoff.md](phase7-wave10-handoff.md).
> **Check marks:** a claim is "checked" only if it was read this session from a primary file (RRG markdown,
> MC56 markdown transcription, rulings markdown, raw caches, repo docs) or from an insert image. Everything else
> is "unchecked". The MC56 PDF could not be rendered (`pdftoppm` is not installed), so rulebook pages come from
> the transcription's "Page N of 20" headers (unchecked against the PDF). RRG pages come from the footer markers
> in `mc_rulesreference_v18_compressed.md` (a line belongs to the page whose footer follows it). Hall of Heroes
> and MarvelCDB are pointers, not authorities.

---

## 0. What the spec author most needs to know

- **Civil War is not a campaign.** Four preconstructed scenarios, a custom-scenario builder and a competitive
  mode. Handoff step 6 does not apply (MC56 p. 3, `mc56_civil_war.md` line 171).
- **Two errata change raw data before emitting.** Energy Channel (#98, `56098`) and Ionic Physiology (`58002`)
  still carry the cost arrow (RRG lines 5152, 5180). Yellow Jacket (#19 `56019`, #73 `56073`) becomes
  "Yellowjacket" (RRG lines 5168–5176).
- **Hercules builds two decks at setup** (Gift and Labor). Defined by the insert; RRG 1.8 has only one FAQ
  entry on Labor cards (line 4738).
- **"Teamwork" in the Hercules pack is a player event** (`59021`), not the Teamwork (Trait) keyword.
- **The Unique Icon reveal branch becomes reachable.** Civil War encounter sets have unique minions named
  Hercules, Falcon, Spider-Man and Maria Hill (MC56 pp. 4, 8). The `hercules` hero (`59001a`) matches the
  Hercules minion. See `PLAN.md` line 320.
- **One ruling conflicts with RRG 1.8.** The June 25, 2026 ruling says a discarded Hero Shield returns to
  Steve's discard pile; RRG p. 27 (Linked) makes the taking player the owner (§7.2).
- **Synthezoid Smackdown** (scenario pack, December 2025) sits between Civil War and Wonder Man and is not in
  RRG's wave-10 list. Wave 9 included Trickster Takeover, which that list did not name either (§10).
- **Handoff claim to check.** `docs/phase7-wave10-handoff.md` line 85 says each hero pack has "a nemesis set and
  a modular set". Raw `wonder_man` has a nemesis set and no modular set (§8.4).

---

## 1. Products and release order

RRG 1.8 Appendix VI, "Limited Environment", item 10, printed p. 71 (`mc_rulesreference_v18_compressed.md` line
5282, checked). The three products also appear in the Current Environment list on p. 71 (lines 5220, 5242,
5244, checked).

- **Civil War** (`cw`, MC56), custom scenario expansion. Released **October 17, 2025** (index line 28; product
  page fetched this session). Lead designer Caleb Grace. The page's "Insert" is the rulebook PDF (the URL in
  `docs/phase7-wave2.md` line 988). Its rulings link is the older post-RRG-1.6 page.
- **Wonder Man** (`wonder_man`), hero pack. Released **February 20, 2026** (index line 136; page fetched). Lead
  designer "TBA". Code **MC58** is inferred from image filenames, unchecked. No card count; no new keywords.
- **Hercules** (`hercules`), hero pack. Released **February 20, 2026** (index line 49; page fetched). Lead
  designer "TBA". Code **MC59** is inferred from image filenames, unchecked. No card count; new keywords "not
  stated".
- **Order.** Civil War (Oct 2025); Synthezoid Smackdown (Dec 2025, not in this wave, §10); Wonder Man and Hercules
  (same date; the RRG order breaks the tie, Wonder Man first). The Hall of Heroes pages chain Wonder Man, then
  Hercules, then Fear No Evil.
- **Not in this wave.** Fear No Evil (MC60, July 2026, index line 41) follows Hercules; the repo has `fne.json`
  and the handoff does not scope it. Elektra Natchios (index line 32) and Iron Fist (index line 57) are announced
  for November 2026 with TBA designers; they are not implementable content.
- **Counts.** Rulebook p. 2 (line 157): 274 cards (98 player, 16 leader, 158 encounter, 2 quick reference).
  MarvelCDB: 234 `type_code` records for `cw`, 35 for `wonder_man`, 46 for `hercules`. Copies are not counted
  separately, so these are record counts.

---

## 2. The MC56 rulebook

**Files:** `docs/campaign-modes/mc56_rulebook-web_1.pdf` (20 pages; present, not rendered) and
`docs/campaign-modes/markdown/mc56_civil_war.md` (transcription; read in full this session).

**Transcription problems** (read the page text, not the summaries):

- Callouts on pp. 2, 4, 5 and 15 are scrambled. Use `cw.json` for card text.
- Steps on pp. 4–5 are out of order and partly struck through (lines 240–341, 426–434). The real order is side,
  leader, encounter deck, main scheme.
- The summary at lines 9–11 ("Superhero Registration Conflict", two "Leader Scenarios") is wrong. The book has
  four preconstructed scenarios (pp. 7–8).
- `docs/campaign-modes/markdown/index.md` line 37 says "2 scenarios" (stale; `PLAN.md` lines 1243–1246 already
  corrected this).
- `docs/campaign-modes/mc55-reference-cards/` holds two PNGs (`epic-multiplayer-reminder.png`,
  `shatter-the-illusion.png`). Both are Trickster Takeover (MC55) cards; none is for Civil War.
  `docs/campaign-modes/mc55_rulebook-web.pdf` is now in the repo.

**Page map** (markdown lines in brackets):

- **p. 1** [37–43]: cover art. **p. 2** [45–163]: welcome, callouts, components (274 cards), set symbol.
- **p. 3** [165–230]: leaders are a new card type that "function exactly the same as villains" (line 175). Per
  side: two leaders, four stage-1 and four stage-2 main schemes, modular sets of "exactly 5 cards" (line 224),
  and a Standard PvP set. Each leader has four stages, a 10-card encounter set and four basic player cards "used
  only when playing in competitive mode" (line 214).
- **p. 4** [235–393]: custom scenario steps: side; leader of that side (registration: Iron Man or Captain Marvel;
  resistance: Captain America or Spider-Woman); three or four modular sets of that side plus the standard set
  (PvP in competitive); one stage 1 and one stage 2 main scheme. Registration and resistance sets cannot be mixed
  (line 353).
- **p. 5** [423–490]: random creation; other products' modular sets allowed in co-op, not in competitive (line
  490).
- **p. 6** [498–526]: co-op clarifications. "The enemy leader" is the leader in play (line 516); "the villain"
  means the enemy leader; "the enemy team" means the players (line 520); the **grim rule** (line 522); "your
  leader" cannot be resolved (line 524).
- **p. 7** [534–562]: preconstructed registration: Iron Man, Captain Marvel (leader decks, main schemes, sets).
- **p. 8** [572–596]: preconstructed resistance: Captain America, Spider-Woman.
- **p. 9** [604–668]: featured terms: Find (lines 606–608), Hinder X, Patrol, Teamwork (Trait) with the Falcon
  example (line 624), Victory X, Villainous, Permanent, Piercing, Ranged, Setup, Stalwart, Steady; amplify icon;
  alternate card back.
- **pp. 10–13** [672–702]: art only.
- **p. 14** [708–734]: competitive setup: 1v1 or 2v2; teams pick different sides; no identity shares a title with
  its side's leader (line 720); PvP set replaces standard (line 722); leader's basic cards set aside (line 726);
  teams trade scenarios (line 730).
- **p. 15** [738–804]: competitive setup diagram (scrambled).
- **p. 16** [808–871]: registration acts first (line 815); "enemy" means the leader you fight plus your side's
  minions (lines 821–823); unique rule only on your own side (lines 839–843); four-step enemy-leader attack
  (lines 857–865); leader basic cards earned by defeating "Choosing Sides", two of four (lines 869–871).
- **p. 17** [879–911]: three ways to win (lines 883–887); equal phases (line 889); five tie-breakers (lines
  897–905); line 911 continues the story into the Synthezoid Smackdown pack.
- **p. 18** [919–949]: starter decks (Hulkling/Protection; Tigra/Aggression) and their nemesis sets.
- **p. 19** [957–985]: credits. **p. 20** [993–1055]: FAQ (seven entries, including Energy Channel #98 on a leader
  attack, Drafted #80 in competitive play, and Cap's Shield #143 when its identity is defeated) and a competitive
  quick reference.

**Rulebook-only rules** (no RRG 1.8 entry): the custom builder and "sides"; the co-op grim rule; the enemy-team
definition; competitive turn structure, enemy-leader attack and tie-breakers. RRG 1.8 has no "competitive",
"enemy team" or "registration" entry (checked by grep).

---

## 3. Hero packs: inserts and what they add

Both Hall of Heroes pages link the "Insert" as one JPG, not a PDF. Both were read visually this session. Neither
is in the repo, and neither pack has a separate rules PDF.

- **Wonder Man insert** (`hallofheroeslcg.com/wp-content/uploads/2026/02/wonder-man-pdf.jpg`). Featured terms:
  Amplify, Permanent, Piercing, Player Side Scheme, Setup, Tuck. Three clarifications:
  - Ionic Physiology: tuck only if fewer than three cards are tucked (matches raw "Max 3 cards tucked here").
  - Cameo (`58031`): "search your collection" means your Marvel Champions cards outside the current game, for an
    ally of another identity's set. Not in RRG 1.8.
  - Overpay: you choose which resource types cover an overpayment (matches the January 17, 2026 ruling, Ruling 4,
    Q1).
- **Hercules insert** (`hallofheroeslcg.com/wp-content/uploads/2026/02/hercules-pdf.jpg`). Featured terms:
  Assault, Find, Permanent, Piercing, Player Side Scheme, Steady, Temporary, Victory X. Adds the **Gift and Labor
  decks**:
  - Each game starts with two three-card decks (three Gift cards; three Labor cards), placed facedown in the play
    area. The insert gives no setup step number.
  - Alter-ego action "New Labors of Hercules" reveals the top Labor card.
  - Hero-form response "Atonement": after a Labor card enters the victory display, the top Gift card may enter
    play (raw `59001a`; limit once per phase).
  - Find searches in and out of play except facedown encounter cards, the victory display and removed cards.
    Same as RRG 1.8 Find (line 1492).

---

## 4. Civil War in the raw cache (`cw.json`, `pack_wave` 10, fetched 2026-09-13)

- **Heroes.** Tigra `56001a` (alter-ego Greer Nelson `56001b`): "On the Hunt" response draws up to three. Hulkling
  `56029a`; alter-ego Teddy Altman `56029b` (constant ability on Shapeshift upgrades).
- **Leaders** (stage cards by name, `leader` set type): Iron Man `56059`–`56062`; Captain Marvel `56092`–`56095`;
  Captain America `56137`–`56140`; Spider-Woman `56168`–`56171`. Their attachments are in the leader encounter
  sets: Energy Channel `56098`, Cap's Shield `56143`, Finesse `56174`.
- **Unique minion.** Hercules `56151`: "Teamwork (Avenger)"; When Defeated, give this card to the enemy leader as a
  facedown boost card.
- **Modular sets** (raw set names; match MC56 pp. 7–8). Registration: Mighty Avengers, The Initiative (Drafted
  `56080`), Maria Hill, Dangerous Recruits, Cape-Killer, Martial Law, Heroes for Hire, Paladin. Resistance: New
  Avengers, Secret Avengers, Namor, Atlanteans, Spider-Man, Defenders, Hell's Kitchen, Cloak & Dagger.
- **Basic cards.** Yellow Jacket `56019` and `56073` (errata targets, §6.3). The four basic cards per leader and
  the Standard PvP set are not coded here (unchecked).

---

## 5. New keywords and mechanics

Method: each term was checked against the RRG 1.8 glossary and section headings (grep), the Hall of Heroes keyword
list (WebFetch summary only, unchecked beyond that), and the three raw caches.

**No new keyword in this cycle.** Hall of Heroes: "New keywords: None" for Civil War (index line 28), "None listed"
for Wonder Man, "not stated" for Hercules. The keyword list's one entry for these packs is Teamwork (Mutant
Genesis, 2022), reworked with Age of Apocalypse (index line 120; the summary gives March 29, 2024, unchecked). Its
current wording matches RRG 1.8.

**Already in RRG 1.8 and used here** (lines checked; page from footer):

- Teamwork (Trait): glossary line 2028 (p. 26); keyword lines 3450–3456 (p. 43).
- Leader (card type): lines 2082–2084 (p. 26): "follows the same rules as the villain card type for all
  purposes".
- Linked: lines 2116–2128 (p. 27). Set aside at setup, not in any deck; taking control makes you the owner (2128).
- Permanent: lines 2520–2526 (p. 32). Dash (value): lines 1122–1130 (p. 15); Ionic Physiology and Cameo are dash-cost.
- Temporary: glossary line 2030 (p. 26). Assault: line 558 (p. 8). Setup, Stalwart, Steady, Villainous: glossary
  lines 2018–2038 (p. 26). Ranged (2814), Patrol (2476), Piercing (2534), Tuck (3598), Victory display (3672),
  Player Side Scheme (2680), Amplify icon (520). Uses (a Core keyword; labor counters on `59004`).

**Not in RRG 1.8; only in the packs' own text:**

- **Competitive mode, Standard PvP set, "enemy team", "enemy leader", "your leader"**: rulebook pp. 6, 14, 16, 20.
  RRG has "enemy leader" only in a Synthezoid errata (line 5190) and the July 9 ruling (§7).
- **Registration and Resistance sides**: rulebook only.
- **Gift and Labor decks**: `hero_special` set type in the raw; insert only; RRG has one FAQ entry (lines
  4736–4738).
- **Shapeshift**: a card trait on the Hulkling and Teddy Altman upgrades (rulebook p. 2 trait line; raw
  `[[Shapeshift]]`). Used in the January 11 ruling.
- **Cameo**: a card name (`58031`). No RRG entry.
- **Named counters on leader attachments**: energy (`56098`) and skill (`56174`). RRG has general counter rules
  (line 1068, p. 14) and all-purpose counters (line 444, p. 6) but no named type.
- **Ability labels, not keywords**: "On the Hunt", "Chosen Shape", "Power Recycling", "Atonement", "New Labors of
  Hercules".
- **"Team up" in the rulebook** (p. 3, line 175: players "can team up with their chosen leader in competitive
  play"). Not the RRG Team-Up keyword (lines 3440–3446, p. 43; deck-building text at 3956, p. 50). Model it as a
  competitive-only term.

**Engine and schema** (file-level grep, unchecked line by line): `attachment-hosts.ts` has the `leader` host kind;
`deck.ts` refuses competitive cards; `schema/validation.ts` and `sets.ts` carry competitive-only markers. No Labor
or Gift deck support was found.

---

## 6. RRG 1.8 entries that name these products or terms

### 6.1 Glossary and rules text

- **Unique Icon:** glossary line 1780 (p. 23); section lines 3612–3622 (p. 45): matching by title, subtitle and
  alter-ego title (3616–3620); deck building (3622). The out-of-play rule ("a non-villain card" that matches a card
  in play cannot enter play) is quoted in `PLAN.md` line 314 from p. 46; not re-read here.
- **Leader**, **Teamwork**, **Linked**, **Permanent**, **Dash**: see §5.
- **Team-Up**: lines 3440–3446 (p. 43); deck building 3956, 3970–3974 (p. 50; line 3970 is the Leadership aspect).

### 6.2 FAQ (Appendix IV)

- **Core Set block** (heading line 4170, p. 57): "Tigra/Greer Grant Nelson (#51)", lines 4248–4250 (p. 58). Not
  Civil War's Tigra (`56001a`). Civil War collector numbers are the last three digits of the code (errata #19, #73,
  #98, #143; FAQ #92), so #51 belongs to another product. Do not apply it to `56001a`.
- **SP//dr block**, Fabian Cortez, line 4632 (p. 64): a Teamwork minion entering play as the last effect of a
  "When Defeated" ability does not find an Acolyte, because the source has already left play. Not a Civil War card,
  but it sets Teamwork and "When Defeated" ordering.
- **Hercules "Labor cards"**, lines 4736–4738 (p. 65): "That Labor card is discarded. Any time a Labor card leaves
  play other than being placed in the victory display, place it on the bottom of the Labor deck." See §7.2.
- **No FAQ** names a Civil War card, leader or Wonder Man entry (heading list, lines 4170–4742).

### 6.3 Errata (Appendix V)

- **Ionic Physiology (#2, Wonder Man)**, lines 5148–5152 (p. 70): the arrow becomes "Then". Text: "After you play an
  event with a printed resource, tuck that event from your discard pile under this card. Then, heal 1 damage from
  your identity."
- **Yellowjacket (#19, Civil War)**, lines 5168–5172 (p. 70): title "Yellowjacket"; "After Yellowjacket enters play,
  search the top 5 cards of your deck for an upgrade and add it to your hand." Raw `56019` reads "Yellow Jacket".
- **Yellowjacket (#73)**, lines 5174–5176 (p. 70): title only (`56073`).
- **Energy Channel (#98, Civil War)**, lines 5178–5180 (p. 70): the arrow becomes "and". Text: "Forced Response:
  After a leader, hero, or ally attacks Captain Marvel, place 1 energy counter here. Then, if there are at least 4
  energy counters here, remove all of them and Captain Marvel attacks that character. This attack gains overkill."
- **Phased Out (#76, Synthezoid)**, lines 5188–5190 (p. 70): "enemy leader"; outside Civil War it means the villain
  (§7.1, July 9).

### 6.4 Appendix VI, p. 71

- Current Environment: Civil War (line 5220), Fear No Evil "upon release" (5222), Wonder Man (5242), Hercules (5244).
  Line 5246 is the catch-all for later products. Limited wave 10 (line 5282) is this scope.
- Synthezoid Smackdown appears in neither list; scenario packs are not in any Limited wave.

---

## 7. FFG rulings (post RRG 1.7) that name these products

Source: `marvel-champions-rulings-post-rrg-1-7.md` (Hall of Heroes transcription of FFG's Game Rules Specialist).
Each entry was read this session. Lines are the heading lines unless noted.

### 7.1 Rulings that name a card, hero, leader or term from these packs

- **Jan 11, 2026, Ruling 1** (line 191; 203–209). Armored Defense still gives Hulkling a Tough status when its first
  sentence defeats the attacker (205). Teddy Altman's constant ability bars a second Shapeshift upgrade (204).
  Overkill that damages Captain America triggers Cap's Shield (206). Captain Marvel's Forced Response triggers twice
  on ally plus identity overkill (207). Registration sets cannot be used with a Resistance leader, co-op included
  (209). Consistent with rulebook p. 4 (line 353).
- **Jan 11, 2026, Ruling 2** (line 215; 224–226). Same overkill points. Jigsaw (226) is a name collision (§7.4).
- **Jan 26, 2026, Ruling 3** (line 353; 362). Overkill counts damage taken; excess counts damage dealt. Needed for
  the Cap's Shield and Golden Mace rulings.
- **Jan 26, 2026, Ruling 5** (line 396; 402). Energy Channel erratum: the arrow becomes "and". Matches RRG 5178–5180.
- **Feb 8, 2026, Ruling 2** (line 437; 448). Hercules' Golden Mace (+3 ATK, overkill) against Thumbelina: the
  excess-dealt and excess-taken sequence is confirmed.
- **Feb 20, 2026, Ruling 3** (line 454; 460). Protect Humanity's Forced Interrupt needs Hercules to have an ally in
  play (raw `59004`: "choose 1 of your allies").
- **Mar 6, 2026, Ruling 3** (line 612; 619–620). Wonder Man can tuck at full hit points once the "Then" errata
  applies (619; matches RRG 5152). A Labor card that cannot enter play goes to the bottom of the Labor deck (620).
  §7.2.
- **Mar 6, 2026, Ruling 4** (line 626; 632–638). Leading Blow, Wonder Man's Forced Response and Ionic Physiology in
  one basic attack: the tuck happens when the event is played; the Forced Response discards the tucked cards after
  damage.
- **Mar 19, 2026, Ruling 6** (line 709; 715). Unique cards added in setup (Cameo, scenario rules) may share titles
  with player cards; uniqueness applies to deck building. Matches RRG 3622.
- **Mar 30, 2026, Ruling 1** (line 721; 730). Tigra's On the Hunt caps at three per trigger (local maximum), matching
  card text.
- **Jun 2, 2026, Ruling 2** (line 823; 833–834). Spectrum's bonus lasts only while a card stays tucked under her, so
  returning Cap's Shield to hand ends it (833). Embody Pathos can find set-aside cards (834).
- **Jun 2, 2026, Ruling 4** (line 860; 866). Energy Channel erratum confirmed; the attack still triggers if the
  attacker has left play.
- **Jun 19, 2026, Ruling 1** (line 884; 887–896). The Hercules Teamwork event (`59021`) played as an interrupt with
  Wonder Man's basic attack and Ionic Physiology; step order matters.
- **Jun 25, 2026, Ruling 1** (line 902; 910–911). Falcon with Captain America's title upgrade takes Steve's Shield
  into hand; if discarded it returns to Steve's discard pile. **Conflict, §7.2.**
- **Jun 25, 2026, Ruling 4** (line 944; 955). Leadership Captain America can search for the hero Cap's Shield as a
  player card (consistent with Linked set-aside, RRG 2120, and Find).
- **Jul 9, 2026, Ruling 3** (line 1015; 1026). Outside Civil War, "enemy leader" is the villain. Matches RRG p. 26
  and rulebook p. 6.
- **Aug 3, 2026, Ruling 4** (line 1075; 1086). Linked cards cannot be in decks (the hero Cap's Shield, Q3). Matches
  RRG 2118.
- **Aug 13, 2026, Ruling 1** (line 1117; 1125). A borrowed card goes to its owner's discard pile. Relevant to §7.2.

### 7.2 Conflicts and tensions (owner decisions; defaults in §10)

- **Labor card with no valid target.** Mar 6 Ruling 3 (line 620): bottom of the Labor deck. RRG p. 65 (line 4738):
  "is discarded", then bottom of the Labor deck when it leaves play. Same end state, different first step. RRG 1.8
  is later than the ruling.
- **Hero Shield after a player takes it.** Jun 25 Ruling 1 (line 910): a discarded Shield returns to Steve's discard
  pile. RRG p. 27 (line 2128): the taking player becomes the owner. Aug 13 Ruling 1 (line 1125): a borrowed card goes
  to its owner's discard pile. **The June ruling conflicts with the RRG text.**
- **Overkill wording on the Captain America leader.** Jan 11 Ruling 2 (line 224) says "damage dealt to" Captain
  America; Jan 26 Ruling 3 (line 362) says overkill counts damage taken; the card text (`56143`) says "attack and
  damage". No conflict in outcome if "damage" means damage taken by the identity. Check when scripting.

**Consistent:** Jul 9 Ruling 3 with rulebook pp. 6 and 16; Jun 25 Ruling 4 with RRG Linked and Find; Jan 11 Ruling 1
(Q7) with rulebook p. 4; Jan 26 Ruling 5 and Mar 6 Ruling 3 with the errata.

### 7.3 Rules-architect questions the rulings do not answer

- Co-op "enemy team" choices (for example "the enemy team finds Cap's Shield and attaches it") are made by the
  players under the grim rule (rulebook p. 6, line 522). No ruling covers it.

### 7.4 Name collisions (same title, different card)

- **Jigsaw** (Jan 11 Ruling 2, line 226): Tigra starter nemesis (rulebook p. 18); not this wave's set.
- **Iron Man** (Mar 30 Ruling 1, line 734): the core hero's hand-size rule, not the Civil War leader.
- **Spider-Man** (Jul 9 Ruling 1, line 990; Aug 3 Ruling 3, line 1063): core hero's Spider-Sense. The Civil War
  Spider-Man is a separate unique minion.
- **Captain Americat** (Jan 26 Ruling 2, line 341; Mar 30 Ruling 1, lines 725–731): a Captain America pack card.
- **Cap's Shield** is two cards: encounter attachment `56143` (MC56 p. 20 FAQ "Cap's Shield (#143)") and the
  player card Hero Cap's Shield (Linked; code unchecked). Match by code.

---

## 8. What is already in the repo

### 8.1 Raw caches (MarvelCDB, fetched 2026-09-13)

- `packages/content/raw/marvelcdb/cw.json` (234 records) and `wonder_man.json` (35): `pack_wave` 10 (checked).
  `hercules.json` (46; `pack_wave` unchecked).
- `packages/content/raw/marvelcdb/synthezoid.json`: present, not emitted, not in this wave. Its 57xxx codes appear
  in `docs/cards_reference.md` (for example line 51852).

### 8.2 Emitted data

- `packages/content/src/data/wonder_man/`: seven generated files (`cards.ts`, `encounterSets.ts`, `index.ts`,
  `packs.ts`, `provenance.ts`, `scenarios.ts`, `starterDecks.ts`). Regenerate with `pnpm --filter @mc/content ingest
  -- --pack wonder_man [--offline]`. `provenance.ts` records corrections for `58002` (lines 20–22) and `58031`
  (lines 88–90), and two duplicate-of-core mappings (`58017`, `58023`; lines 38–56).
- **No `src/data/cw`, `src/data/hercules` or `src/data/synthezoid`** (checked by glob). Those three are raw-only.
- The raw `58002` still has the arrow (checked). Whether the emitted `wonder_man` data carries the errata is
  unchecked.

### 8.3 Scripting notes (raw text, checked)

- `56098` Energy Channel: arrow before "Captain Marvel attacks that character" becomes "and" (§6.3).
- `56143` Cap's Shield: "Attach to Captain America"; retaliate 1 and piercing removed; Forced Response on a hero's
  or the leader's ATK attack that damages the attached character.
- `56092` Captain Marvel: Setup finds Energy Channel. `56137` Captain America: Setup finds Cap's Shield.
- `56174` Finesse: "Max 3 skill counters"; Forced Interrupt on a revealed treachery.
- `56029a` Hulkling: Chosen Shape reacts to a Shapeshift upgrade entering play.
- `58002` Ionic Physiology: "Permanent. Max 3 cards tucked here." Response arrow becomes "Then" (§6.3).
- `59021` Teamwork (Hercules event): Hero Interrupt on a basic thwart or attack; exhaust an ally to add its matching
  power.
- `59001a` Hercules: Atonement, a response after a Labor card enters the victory display; limit once per phase.
- `58031` Cameo: Setup support, dash cost.

### 8.4 Hero-pack sets (raw)

- **Wonder Man:** nemesis set `wonder_man_nemesis`, 58026–58029 (Grim Reaper; Brother vs. Brother; Scythe Strike;
  Death Cannot Die). Obligation Pacifism `58025`. **No modular encounter set** appears in the raw (set codes seen:
  `wonder_man`, `wonder_man_nemesis`). The handoff (line 85) says there is one; the data survey should settle it.
- **Hercules:** nemesis `hercules_nemesis` (five records); modular `all_versus_all` 59041–59045 (side scheme All
  Versus All, Hecate, Kyknos, Bewitched Officer, Roving Mobs); Labor deck `hercules_labor_deck` 59002–59004; Gift
  deck `hercules_gift_deck` 59005–59007.

### 8.5 Art and music

- `art/heroes/_pending/`: `56001a-tigra/`, `56029a-hulkling/`, `59001a-hercules/`, each with only `.gitkeep`
  (checked). No Wonder Man pending folder.
- `assets/card-art/bundles/cards/`: about 550 images for the 56xxx, 58xxx and 59xxx codes (`.jpg` and `.png`). Git
  tracking unchecked. `docs/phase7-wave2-data.md` line 1077 says Civil War has "34 artwork gaps (none locally
  available)"; that looks out of date.
- Music: `docs/music-prompts-ready.md` line 13 onward (twelve Civil War prompts). No `music/scenarios/_pending/`.

### 8.6 Earlier notes to carry forward

- `docs/phase7-wave2.md` lines 980–1024 (section 6): the leader shape. A leader is a `VillainCard` with
  `printedType: "leader"` (line 1016); the leader attachment host (1017); competitive-only basic cards and the
  Standard PvP set (1018).
- `PLAN.md` line 320 (PR #109, wave 9): the Unique Icon reveal branch is unbuilt and "becomes reachable with ... a
  hero as an encounter card (Civil War)".
- `PLAN.md` lines 1107, 1207–1209, 1243–1246: `leader` as an unknown type in the first data pass; no campaign in
  Civil War.
- `docs/campaign-mode-design.md` lines 108, 1538–1543 (no campaign); `docs/campaign-client-per-box.md` line 89 (no
  campaign client).
- `docs/phase7-wave9-sources.md` lines 3 and 20: Trickster Takeover was out of wave 9's RRG list but in its scope.

---

## 9. Competitive mode: what the scaffolding needs

Owner decision (`docs/phase7-wave10-handoff.md` lines 75–83): not shipped this wave. The game says "Competitive mode
coming soon", and the scaffolding is built now (plan doc, PvP set and sixteen leader basic cards, a game-mode field
that refuses `competitive`, team-count-aware "enemy team" resolution, tests). Every "In competitive mode" clause must
also read correctly in co-op.

Rulebook-only rules to model (RRG 1.8 has none):

- Setup (p. 14, lines 716–732): teams build their own decks and pick different sides; no identity shares a title with
  its side's leader; PvP set replaces standard; basic cards set aside; scenarios traded.
- Turn order (p. 16, lines 825–833): registration takes its full hero phase, then resistance; then the villain
  phases in the same order. 2v2 gives each team a first-player token.
- Words (p. 16, lines 817–823): "enemy leader" is the leader you fight; "enemy team" is the other team's players;
  "enemy" is that leader plus your side's minions. Unique rule: your own side only (lines 839–841; p. 20 line 997).
- Enemy-leader attack on your leader (p. 16, lines 855–865): no guard, no defender; boost card from the enemy
  leader's deck; damage equals total ATK.
- Winning (p. 17, lines 881–907): three ways; equal phases; five tie-breakers.

---

## 10. Open points and questions for the owner

Each question has a recommended default. Answers go into the spec's §4.1 table and the PR.

1. **Synthezoid Smackdown (MC57 by code, unchecked; scenario pack; December 2025).** _Update 2026-10-19: the owner moved it into the wave 11 PR (#251), placed chronologically after Civil War and before Wonder Man; see `docs/phase7-synthezoid.md`._ (a) Include it in wave 10, as
   Trickster Takeover was in wave 9; or (b) give it its own slot after wave 10. Recommended: (b). The RRG wave list
   and the handoff scope name only the three products. The rulebook (p. 17, line 911) continues the story into this
   pack, so confirm the MC57 code before recording the answer.
2. **Labor card with no valid target (§7.2).** (a) Bottom of the Labor deck, as in the ruling and the RRG's second
   sentence; or (b) discard, as in the RRG's first sentence. Recommended: (a).
3. **Hero Shield after a player takes it (§7.2).** (a) The owner's discard pile (RRG p. 27; August 13 ruling); or (b)
   the taking player's discard pile (June 25 ruling). Recommended: (a). This is the one ruling that conflicts with
   the RRG text. Ask FFG to confirm if the owner wants it pinned.
4. **Co-op title match between a hero and an enemy leader** (for example Captain Marvel hero with the Captain Marvel
   leader). The rulebook restricts it only in competitive setup (p. 14, line 720; p. 16, line 843). RRG 1.8 exempts
   villain-type cards from the unique rule (p. 46), and leaders follow the villain type (p. 26). Recommended: (a)
   co-op unrestricted; or (b) co-op restricted.
5. **Wonder Man modular set (§8.4).** Not a decision. Raise it only if the data survey finds an encounter set beyond
   the nemesis set.

For `game-rules-architect` (no owner decision yet): where the Gift and Labor decks sit in setup; whether Shapeshift is
a trait or a keyword in the schema; the competitive "team up" wording (§5).

---

## Sources

Hall of Heroes (pointers; fetched this session unless marked):

- Civil War: https://hallofheroeslcg.com/civil-war/ (fetched)
- Wonder Man: https://hallofheroeslcg.com/simon-williams-wonder-man/ (fetched)
- Hercules: https://hallofheroeslcg.com/hercules/ (fetched)
- Keyword list: https://hallofheroeslcg.com/marvel-champions-lcg-keyword-list/ (WebFetch summary only)
- Wonder Man insert (JPG, read visually): https://hallofheroeslcg.com/wp-content/uploads/2026/02/wonder-man-pdf.jpg
- Hercules insert (JPG, read visually): https://hallofheroeslcg.com/wp-content/uploads/2026/02/hercules-pdf.jpg
- `hallofheroes-llms.txt` index lines 28, 30, 32, 41, 49, 57, 119, 120, 136.

Primary and internal:

- `mc_rulesreference_v18_compressed.md` (RRG 1.8, July 2026), by line and footer page.
- `docs/campaign-modes/markdown/mc56_civil_war.md` (transcription of `docs/campaign-modes/mc56_rulebook-web_1.pdf`;
  PDF not rendered).
- `marvel-champions-rulings-post-rrg-1-7.md`.
- `packages/content/raw/marvelcdb/{cw,wonder_man,hercules,synthezoid}.json`;
  `packages/content/src/data/wonder_man/`; `art/heroes/_pending/`; `assets/card-art/bundles/cards/`;
  `docs/cards_reference.md`.
- `PLAN.md`, `docs/phase7-wave2.md`, `docs/phase7-wave2-data.md`, `docs/phase7-wave9-sources.md`,
  `docs/phase7-wave10-handoff.md`, `docs/campaign-mode-design.md`, `docs/campaign-client-per-box.md`,
  `docs/music-prompts-ready.md`, `docs/campaign-modes/markdown/index.md`,
  `docs/campaign-modes/mc55-reference-cards/`.
