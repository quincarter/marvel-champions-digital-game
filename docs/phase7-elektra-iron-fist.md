# Elektra (MC63) and Iron Fist (MC64): hero pack status

Tracking issue: #699. Both packs are built-in packs (`packages/cards/src/wave11/elektra/pack.ts`,
`packages/cards/src/wave11/iron_fist/pack.ts`). They were `status: "not-ready"` (left out of hero select, the deck
builder and the precons; `NOT_READY_PACK_CODES` in `packages/cards/src/builtin-packs/index.ts`) until 2026-11-25, when
their card data moved to MarvelCDB, bluefireF5ran contributed English and Spanish scans of every card, and the
status was removed. The not-ready gate stays in the code for the next pack that lands early.

This file lists what we have for each card, where it came from, and what is still missing. Update it as cards arrive.

## 1. Sources

| Source                                                                                                  | What it gave                                                                                |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Hall of Heroes `https://hallofheroeslcg.com/elektra-natchios/`                                          | 20 card images (identity, Ninja deck, most of the kit, some aspect)                         |
| MarvelCDB `https://marvelcdb.com/api/public/cards/iron_fist` (fetched 2026-11-25)                       | Iron Fist (MC64): all 33 records, now the card data source (`raw/marvelcdb/iron_fist.json`) |
| Official Iron Fist card images (`Iron_Fist_EN/`, 1500 x 2150), card images contributed by bluefireF5ran | read against MarvelCDB: both identity faces, 64013, 64014, 64021, 64026 to 64029, 64032     |
| FFG article `https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/`                     | the same Elektra cards at higher resolution; Ninja deck and Villainous                      |
| Gameplay video `https://youtu.be/6wR6kfxPmio` (Web-Warrior Fanatic, 2026-11-13), 4K stills              | the obligations and the first nemesis card of each hero (section 3)                         |
| MarvelCDB `/api/public/packs/`                                                                          | neither pack yet (checked 2026-11-14; newest is `luke_cage`)                                |
| Rules insert                                                                                            | not published; the Elektra alter-ego says "(See insert.)"                                   |

The card data is hand-transcribed (`packages/content/scripts/marvelcdb/curation/elektra.ts`, `iron-fist.ts`), the
Shadowland way: `scanOnly`, every record an added record with its evidence. Every inferred value carries a
"Data decision:" correction and every video-only card a "PLACEHOLDER:" correction in the pack's `provenance.ts`.

Iron Fist is now ingested from MarvelCDB too (2026-11-25; `curation/iron_fist.ts`, like `luke_cage.ts`); the
hand-transcription described above no longer applies to it. Corrections kept: the printed consequential-damage icon
in 64014, 64021 and 64032, and Helpful Bystander's dash THW and ATK without MarvelCDB's star flags.

### Elektra: now ingested from MarvelCDB (2026-11-25)

MarvelCDB now carries Elektra (`https://marvelcdb.com/api/public/cards/elektra`, 39 records, cached in
`packages/content/raw/marvelcdb/elektra.json`), so `curation/elektra.ts` is a normal MarvelCDB-sourced curation like
`luke_cage.ts` (no `scanOnly`, no added records) and the old hand transcription, the Hall of Heroes previews, the gameplay
video and the fan preview are no longer sources for her. The official card images (1500 x 2150, `Elektra_EN`, card images
contributed by bluefireF5ran) were read for the identity faces, 63011, 63013, 63027 to 63033, 63038 and 63039; they
matched MarvelCDB except two corrections: Moondragon's consequential damage icon (63038) and the amplify icon on the
Dance with the Devil reprint (63027). Bundled art exists for every code but the three basic resource reprints
(63024 to 63026), which take their original's art. Quantities come from MarvelCDB. Starter deck: MarvelCDB decklists
69860 and 70085 (identical, 40 cards), recorded as a stand-in (`verified: false`), not a printed list. The old placeholder
codes 63040 to 63045 are gone: obligation 63028, Aka 63029, The Fist Fits in the Hand 63030, Hand Katana 63031, Hand
Blademaster 63032, Hand Archer 63033.

## 2. Player cards (from card images)

The Hall of Heroes pages carry two sets of images: small previews (about 300 px, the same as FFG's articles) and
full-size spoiler images (about 1400 x 2000) under "Content Creator Spoiler Overviews".

**Elektra (`elektra`, 63xxx), 39 cards (63001 to 63039, all on MarvelCDB).** 63001a/b Elektra / Elektra Natchios; Ninja deck 63002 Ninja
Stars, 63003 Ninja Strike, 63004 Ninja Vanish (2 each, 6 cards); kit 63005 Daredevil, 63006 Acrobatic Prowess x2, 63007
Killer Blow x2, 63008 Move Unseen x2, 63009 Sai Strike x2, 63010 Resurrection Altar, 63011 White Tiger, 63012 Elektra's
Sai x2, 63013 History with the Hand, 63014 Stealth Mastery (15 of 15 placed); Aggression 63015 Shang-Chi, 63016 Black
Cat, 63017 Combo Move, 63018 Chain Reaction, 63019 Nerve Strike, 63020 Flow of Battle, 63021 Shuriken; basic 63022
Stone, 63023 Hunting Shadows, 63027 Dance with the Devil (reprint of Fear No Evil 60031); Justice 63034 Double-Cross
(player side scheme) with its Linked treacheries 63035 Backstab, 63036 Misdirect, 63037 Sabotage; Leadership 63038
Moondragon; Protection 63039 Moon Knight.

**Iron Fist (`iron_fist`, 64xxx), 33 player cards seen.** 64001a/b Iron Fist / Danny Rand; kit 64002 Deep Breathing
x3, 64003 Dragon Punch, 64004 Fists of Fury x2, 64005 The Way of Things x2, 64006 Lei Kung, 64007 Book of the Iron Fist,
Techniques 64008 Channel the Iron Fist, 64009 Embody the Dragon, 64010 Feel the Flow, 64011 Keep 'Em Coming, 64012
Redirect Chi; Protection 64013 Helpful Bystander, 64014 Iron Fist (ally), 64015 Defiance (reprint of 26018), 64016
Demoralize, 64017 The Night Nurse (reprint of 09019), 64018 Redirection Mastery, 64019 No Time to Bleed, 64020 Tonfa;
basic 64021 Colleen Wing, 64022 Luke Cage, 64023 Punch, Reverse Punch, 64024 Power Man and Iron Fist (reprint of
62023), 64025 Thunder Dojo, 64033 The Defenders; Aggression 64030 Death by a Thousand Cuts; Leadership 64031 Zen-Like
Calm, 64032 Sensei.

**Update 2026-11-25:** Iron Fist's quantities are MarvelCDB's (three of each aspect card and The Defenders, kit
counts unchanged); the inferred counts in the next paragraph are superseded.

Kit quantities come from the printed set positions (each footer prints the first position of the card's copies); the
Iron Fist footers for Deep Breathing, Fists of Fury and The Way of Things are too small to read the range, so their
counts are inferred from the gaps. Iron Fist aspect and basic cards are x1 because no source gives their count.
(Elektra's quantities, the aspect cards x3 among them, now come from MarvelCDB; her Ninja cards are 2/2/2.)

## 3. Obligations and nemesis sets (Elektra official, Iron Fist official since 2026-11-25)

Elektra's obligation and nemesis set are official now (63028 to 63033, MarvelCDB plus the card images; section above).
Iron Fist's are official too (MarvelCDB plus the card images): 64026 Lack of Chi, 64027 Davos, 64028 Crane Daughter
x3, 64029 Steel Serpent; the placeholder codes 64034 to 64037 are gone. Where the sources text below
mentions Iron Fist, it describes the superseded video and fan-preview readings.

Neither hero's obligation or nemesis set is on Hall of Heroes. Their text comes from two places:

- **The gameplay video** `https://youtu.be/6wR6kfxPmio` (Web-Warrior Fanatic, 2026-11-13), read from 4K stills of the
  real cards. Where it is legible, it wins.
- **An unofficial fan-made preview** the owner found (2026-11-14; every image is marked "Unofficial preview, not an
  official card"). Only its text is used, never its images. It fills in what the video doesn't show (stats, boost
  icons, set positions, three cards of each set).

Collector numbers are not readable in either source, so the codes are provisional and follow the set positions after the
obligation. Every card here is art-unavailable and carries a "PLACEHOLDER:" correction in its pack's `provenance.ts`.

| Code | Card | Source | Notes |
| ---- | ---- | ------ | ----- |

## 4. Missing

- **Collector numbers not seen:** none for Iron Fist (33 of 33).
- **Precon decklists:** Elektra's is a MarvelCDB stand-in (decklists 69860 and 70085), not the printed list; Iron Fist's Protection deck is the MarvelCDB decklist 69859 stand-in (`verified: false`).
- **The rules insert** (Elektra's Ninja deck setup).
- **Art:** Elektra and Iron Fist both have bundled art for every code.

## 5. Rules readings

Settled by the authority order (rules expert, 2026-11-14):

| Question                                                          | Reading                                                                                                                                                                                                                                                                                                                            | Source                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Villainous on a hero (Elektra, Black Cat)                         | facedown boost card from the encounter deck on each basic power (defense when declared defender; an ally's defense is not a basic power); resolve its Boost ability, +1 per icon, then encounter discard                                                                                                                           | RRG 1.8 "Villainous" p. 47; ruling Sep 10, 2026 R3                           |
| Killer Instinct                                                   | optional; only on a card with a Boost ability; gains 1 boost icon only if the cancel resolved                                                                                                                                                                                                                                      | RRG 1.8 "Interrupt" p. 25, "Then" p. 44                                      |
| Ninja cards                                                       | encounter treacheries (scenario owns them in the encounter deck); empty Ninja deck: shuffle nothing                                                                                                                                                                                                                                | card text; RRG "Ownership" p. 31; ruling Sep 10, 2026 R1                     |
| Chi                                                               | "put into play" is not "play"; spent resources are not played; no chi in alter-ego form; counters stay on a flip; "from your identity" works in both forms, "from Iron Fist" only in hero form                                                                                                                                     | RRG 1.8 pp. 21, 23, 32                                                       |
| Iron Fist's heal                                                  | heals only himself                                                                                                                                                                                                                                                                                                                 | ruling Sep 1, 2026 R1                                                        |
| Temporary                                                         | discarded when the round ends (villain phase step 6); Danny Rand's "lose temporary" counts if his face is up then                                                                                                                                                                                                                  | RRG 1.8 "Temporary" p. 44, p. 47                                             |
| Exactly defeat / exactly defend                                   | no excess damage dealt / modified DEF equals modified ATK, no prevention or reduction                                                                                                                                                                                                                                              | rulings Aug 3, 2026 R6; Sep 10, 2026 R4                                      |
| Helpful Bystander                                                 | Vulnerable discard; redirect is the same attack, with overkill                                                                                                                                                                                                                                                                     | RRG 1.8 pp. 10, 31, 48                                                       |
| Exactly defend needs a basic defense                              | a hero must make a basic defense (exhaust, or declared defender by an ability); an event alone doesn't count                                                                                                                                                                                                                       | ruling Oct 12, 2026 (Hall of Heroes)                                         |
| Double-Cross with two decks                                       | one Backstab, Misdirect and Sabotage per defeat; the "not already a copy in the victory display" clause stops a second Double-Cross from adding the second deck's set (card-text reading, no ruling)                                                                                                                               | card text; RRG 1.8 "Linked" p. 27                                            |
| Boost cards on a friendly villainous character's attack or thwart | "would" interrupts to the power resolve first (a "would" cancel means no card is given); then Villainous gives its card as a forced interrupt to "uses a basic power", ahead of optional interrupts to the same condition (Stick 60029, Moondragon 63038); then non-forced interrupts; the cards turn faceup as the power resolves | RRG 1.8 "Villainous" p. 47, "Would" p. 48, "Forced" p. 20, "Interrupt" p. 25 |
| Stealth Mastery "reduce by 3" on a multi-instance attack          | every instance not worded "additional" is reduced, each floored at 0                                                                                                                                                                                                                                                               | RRG 1.8 "Event" p. 18-19, "Modifiers" p. 28-29; owner Q53 (wave 8 §4.1)      |

Owner decisions (§4.1, 2026-11-14):

| #   | Question                                               | Answer                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A Ninja card for Elektra while she's in alter-ego form | **A**: "Elektra" and "Elektra Natchios" are different names, so it can't go to her and is discarded to the encounter discard pile. Confirmed by FFG ruling Oct 12, 2026 R2 (`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`).                                                                                                                                                   |
| 2   | Ninja deck setup (no insert yet)                       | **A, provisional**: at setup the 6 Ninja cards are shuffled into a separate facedown Ninja deck outside the encounter deck; none enter the encounter deck until Elektra's abilities put them there. Revisit when the insert is published.                                                                                                                                               |
| 3   | Amplify on boost cards a character resolves            | **B**: the Fear No Evil rulebook's updated Amplify text wins over RRG 1.8 p. 7 as a shared correction (wave 11 scenarios §S4.0 reversed): "When a character resolves a boost card while using a basic power, add one additional boost icon to that card for each amplify icon in play." Elektra's basic attack, thwart and defense and Black Cat's basic attack and thwart get amplify. |

| 4 | A boost card's own Boost ability gives it back to Elektra facedown: do its icons count for this use? | **A**: yes, the printed icons and amplify count for the current resolution; the card counts again when turned faceup on a later use (FFG ruling Jan 11, 2024, Homo Superior: a boost card's icons count even when its Boost moves it). |
| 5 | Elektra's basic power ends before her boost cards are turned faceup | **A, provisional**: every unflipped boost card stays facedown on her, including one given for that use, and resolves on a later basic power (RRG 1.8 Boost p. 11; ruling Sep 10, 2026 R3 A). |
| 6 | Venom's main scheme 1B ("move each facedown boost card from your identity to Venom") and Elektra's own held cards | **B, provisional until FFG rules on it**: every facedown boost card moves, hers included. Provenance decides which cards Elektra can resolve (ruling Sep 10, 2026 R3 C), never which cards Venom moves. |
| 7 | Moon Knight 63039's [mental] "Discard 1 boost card from the attacker" when the attacker has several facedown boost cards | **A**: Moon Knight's controller picks any one; when nothing is known about the cards it is the first one dealt (RRG 1.8 "Choose" p. 12, nearest rule). |
| 8 | Redirection Mastery 64018 when the hero defends with The Best Defense… (ATK instead of DEF) | **A**: the ATK used stands in for DEF for the whole attack, including the exactly-defend comparison and the damage dealt (FFG ruling Sep 10, 2026 R4 on exact defense; no direct ruling). |
| 9 | Colleen Wing 64021: when is the other attacker's Martial Artist trait checked? | **A**: as it was when that character attacked (no direct ruling). |

## 6. Scripting status

See each module's `_SKIPPED` map under `packages/cards/src/wave11/elektra/` and `packages/cards/src/wave11/iron_fist/`
for the exact list of unscripted refs and why.
