# Elektra (MC63) and Iron Fist (MC64): status of two not-ready hero packs

Tracking issue: #699. Both packs are in the card pool as built-in packs (`packages/cards/src/wave11/elektra/pack.ts`,
`packages/cards/src/wave11/iron_fist/pack.ts`) with `status: "not-ready"` in their manifests, which puts their set codes
in `NOT_READY_PACK_CODES` (`packages/cards/src/builtin-packs/index.ts`). A not-ready pack's hero is left out of hero
select, the deck builder's identity list and the precons, and a deck it leads shows "Not ready yet" and can't be seated.
Every other card of a not-ready pack is also kept out of the deck builder's pool and deck import (owner, 2026-11-14;
`packages/client/src/view/not-ready-cards.ts`).
**To release a pack, delete `status` from its manifest** once every card has text and the scripts are done.

This file lists what we have for each card, where it came from, and what is still missing. Update it as cards arrive.

## 1. Sources

| Source                                                                                     | What it gave                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Hall of Heroes `https://hallofheroeslcg.com/elektra-natchios/`                             | 20 card images (identity, Ninja deck, most of the kit, some aspect)    |
| Hall of Heroes `https://hallofheroeslcg.com/iron-fist-danny-rand/`                         | 18 card images (identity, most of the kit, some Protection and basic)  |
| FFG article `https://www.fantasyflightgames.com/en/news/2026/8/13/killer-instinct/`        | the same Elektra cards at higher resolution; Ninja deck and Villainous |
| FFG article `https://www.fantasyflightgames.com/en/news/2026/8/27/way-of-the-iron-fist/`   | the same Iron Fist cards; chi and Technique (Temporary) rules          |
| Gameplay video `https://youtu.be/6wR6kfxPmio` (Web-Warrior Fanatic, 2026-11-13), 4K stills | the obligations and the first nemesis card of each hero (section 3)    |
| MarvelCDB `/api/public/packs/`                                                             | neither pack yet (checked 2026-11-14; newest is `luke_cage`)           |
| Rules insert                                                                               | not published; the Elektra alter-ego says "(See insert.)"              |

The card data is hand-transcribed (`packages/content/scripts/marvelcdb/curation/elektra.ts`, `iron-fist.ts`), the
Shadowland way: `scanOnly`, every record an added record with its evidence. Every inferred value carries a
"Data decision:" correction and every video-only card a "PLACEHOLDER:" correction in the pack's `provenance.ts`.

## 2. Player cards (from card images)

The Hall of Heroes pages carry two sets of images: small previews (about 300 px, the same as FFG's articles) and
full-size spoiler images (about 1400 x 2000) under "Content Creator Spoiler Overviews".

**Elektra (`elektra`, 63xxx), 39 player cards seen.** 63001a/b Elektra / Elektra Natchios; Ninja deck 63002 Ninja
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

Kit quantities come from the printed set positions (each footer prints the first position of the card's copies); the
Iron Fist footers for Deep Breathing, Fists of Fury and The Way of Things are too small to read the range, so their
counts are inferred from the gaps. Aspect and basic cards are x1 because no source gives their count. The Ninja cards
print positions 2, 3 and 5 of 6, which fits 2/2/2 only loosely.

## 3. Obligations and nemesis sets (placeholder codes, provisional text, no art)

Neither hero's obligation or nemesis set is on Hall of Heroes. Their text comes from two places:

- **The gameplay video** `https://youtu.be/6wR6kfxPmio` (Web-Warrior Fanatic, 2026-11-13), read from 4K stills of the
  real cards. Where it is legible, it wins.
- **An unofficial fan-made preview** the owner found (2026-11-14; every image is marked "Unofficial preview, not an
  official card"). Only its text is used, never its images. It fills in what the video doesn't show (stats, boost
  icons, set positions, three cards of each set).

Collector numbers are not readable in either source, so the codes are provisional and follow the set positions after the
obligation. Every card here is art-unavailable and carries a "PLACEHOLDER:" correction in its pack's `provenance.ts`.

| Code    | Card                                        | Source                        | Notes                                                                                                                                                                                                            |
| ------- | ------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 63040   | Conditioned by the Hand (obligation 1/1)    | video 48:13; fan (boost 2)    | video "Forced Response (Hero)" / "Exhaust your identity"; fan "Hero Forced Response" / "Exhaust Elektra Natchios"                                                                                                |
| 63041   | Aka (nemesis minion 1/5)                    | video 48:11; fan              | video traits Hand. Ninja. (fan: Hand.); SCH 2 ATK 2 HP 4; Quickstrike; boost ability                                                                                                                             |
| 63042   | The Fist Fits in the Hand (side scheme 2/5) | fan only                      | 3 per player threat, 3 boost icons, a hazard icon                                                                                                                                                                |
| (63043) | Elektra nemesis 3/5                         | none                          | missing; the fan source skips it, so Hand Blademaster may be 2 copies (3-4/5)                                                                                                                                    |
| 63044   | Hand Blademaster (minion 4/5)               | fan only                      | SCH 1 ATK 1 HP 3, 1 boost icon                                                                                                                                                                                   |
| 63045   | Hand Archer (minion 5/5)                    | fan only                      | SCH 1 ATK 1 HP 3, Quickstrike, Ranged, 1 boost icon                                                                                                                                                              |
| 64034   | Lack of Chi (obligation 1/1)                | video ~1:00, ~45:01; fan      | 2 boost icons; "Then," from the fan text                                                                                                                                                                         |
| 64035   | Davos (nemesis minion 1/5)                  | video 1:14; fan               | video "Find and tuck the 3 Crane Daughter minions under here" (assembled from two frames); fan "Put each copy of Crane Daughter from the encounter deck and discard pile facedown under Davos"; SCH 1 ATK 2 HP 5 |
| 64036   | Steel Serpent (side scheme 2/5)             | fan only                      | 4 per player threat, 2 boost icons, a hazard icon                                                                                                                                                                |
| 64037   | Crane Daughter x3 (minion 3-5/5)            | fan only; title seen in video | **least certain**: the owner couldn't confirm it. Mystic. SCH 2 ATK 2 HP 3, boost ability                                                                                                                        |

## 4. Missing

- **Elektra nemesis 3/5** (section 3), and official text for every card in section 3.
- **Collector numbers not seen:** Elektra 24, 25, 26 and 28 to 33; Iron Fist 26 to 29. The Iron Fist nemesis set is
  complete (Davos 1/5, Steel Serpent 2/5, Crane Daughter 3-5/5).
- **Precon decklists** for both packs (Elektra ships an Aggression deck, Iron Fist a Protection deck).
- **The rules insert** (Ninja deck setup).
- **Art:** 38 cards have only the small previews (FFG watermark), 23 have full-size spoiler images, and the 10
  obligation and nemesis cards have none.

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
