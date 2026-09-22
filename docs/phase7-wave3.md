# Phase 7 working spec: wave 3 (cycle 2)

This is the shared brief for every agent working Phase 7's third content wave:

- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer` and `rules-qa-engineer`.
- It turns wave 3's scope into schema decisions (§1), per-pack setup needs (§2), and a prioritized list of engine primitives (§3), each with a status.
- The models are `docs/phase7-wave1.md` and `docs/phase7-wave2.md`, whose §3 primitives are assumed. If you change a decision here, update this file in the same change.

**Wave 3** is cycle 2, The Galaxy's Most Wanted, in release order:

- The Galaxy's Most Wanted (`gmw`): Groot, Rocket Raccoon, and five scenarios (Brotherhood of Badoon, Infiltrate the Museum, Escape the Museum, Nebula, Ronan the Accuser);
- the Star-Lord (`stld`), Gamora (`gam`), Drax (`drax`) and Venom (`vnm`) hero packs;
- `ron`, **which is not a scenario pack.** Its five cards (90001–90005) are one modular encounter set, "Kree Fanatic": a Ronan the Accuser _minion_, a side scheme, an attachment and two treacheries (§2.3).

RRG 1.8 Appendix VI (p. 71) lists The Galaxy's Most Wanted and the four hero packs as wave 3. `stld`, `gam`, `drax`, `vnm` and `ron` are already emitted as data-only packs; `gmw` is not (§1.1).

**Campaign mode is a later, per-box step** (PLAN.md "Campaign mode", C2). Every scenario must play standalone first. The Galaxy's Most Wanted's campaign cards (The Market 16150–16177, the Campaign Challenge and Badoon Headhunter sets 16178–16187) are ingested as data now and scripted with the box's C2 work.

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules Reference; FFG rulings clarify both):

1. **Card text and product rules.** The Galaxy's Most Wanted rulebook (MC16) is in the repo: `docs/campaign-modes/mc16_galaxys_most_wanted_rules_website-compressed.pdf`, with a page-by-page conversion in `docs/campaign-modes/markdown/mc16_galaxys_most_wanted.md`. Cited as "MC16 p. N". The Mad Titan's Shadow rulebook (MC21) is cited for Hela, whose card shape §1.1 must also fit.
   - **Not read:** the Star-Lord, Gamora, Drax and Venom inserts (linked from their Hall of Heroes pages). Read them before scripting those packs; §4 names what each is needed for.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading. Those that bear on cycle 2: Jan 11, 2026 (1) (an amplify icon on a defeated side scheme); Jan 26, 2026 (3) (Rocket Raccoon, Into the Fray: excess damage _dealt_); Feb 28, 2026 (7) #2 and (8) (Mister Knife; the Collector's discard interrupt catches Infinity Stones); Mar 30, 2026 (1) ("(to a maximum of X)" is local); Jun 2, 2026 (3) (The Galaxy's Most Wanted expert campaign); Aug 3, 2026 (4) #4 (Drax above three vengeance counters).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page. Cycle 2's FAQ entries are on pp. 61–62 and its errata on pp. 66–67.

`packages/content/raw/marvelcdb/{gmw,stld,gam,drax,vnm,ron}.json` point to card text and stats. They are not an authority.

---

## 1. Schema decisions (owner: `game-rules-architect`; landed 2026-09-22)

> Status: landed in `packages/content/src/schema/**`, with fixtures in `packages/content/src/schema/wave3.test.ts` (9 tests).
>
> - No emitted card data changed; every Core, wave 1, wave 2 and data-only card still validates.
> - The one removal, `VillainStage.hpNotPrinted`, was used by no emitted card (only its own wave 2 test, now pointing here).

### 1.1 A villain face printed with ∞ hit points: `VillainStage.infiniteHp`

The ask was "`VillainStage.flipSide`, or whatever shape the rules call for". The rules call for **no new flip mechanism** and **a different hit point field**.

**The card shape is the existing `VillainCard.sides`.** The Collector of Escape the Museum (`gmw` 16080, 16081) and Hela (`mts` 21136, 21137) are each one double-sided villain card per mode, exactly the shape Risky Business's Norman Osborn / Green Goblin already uses:

| MarvelCDB code  | `stage`     | Face                         | HP (raw)          | ATK/SCH   | Traits                             |
| --------------- | ----------- | ---------------------------- | ----------------- | --------- | ---------------------------------- |
| 16080a / 16080b | `A1` / `A2` | Collector front / back, std. | 8 per player / 0  | 1/1 / 0/0 | Elder. / Elder. Wounded.           |
| 16081a / 16081b | `B1` / `B2` | the same, expert             | 10 per player / 0 | 2/2 / 2/2 | Elder. / Elder. Wounded.           |
| 21136a / 21136b | `A1` / `A2` | Hela front / back, standard  | 8 per player / 0  | 1/1 / 0/0 | Asgard. Mystic. / Asgard. Wounded. |
| 21137a / 21137b | `B1` / `B2` | the same, expert             | 9 per player / 0  | 2/2 / 1/1 | Asgard. Mystic. / Asgard. Wounded. |

- MC16 p. 12: "**Villain Deck**: Collector (A1). Remove Collector (A1) and add Collector (B1) for expert mode." MC21 p. 20: "**Villain Deck**: Hela (A). Remove Hela (A) and add Hela (B) for expert mode", and "she is represented by a single double-sided villain card. She begins the game on her **Mystic** side."
- So **the letter is the mode and the digit is the face**, as docs/phase7-wave2.md §15.2 already found. Each mode is one single-stage `VillainCard` with `sides: [{ side: "A", stages: [face 1] }, { side: "B", stages: [face 2] }]`, both `stageNumber: 1`, and the scenario names the standard card as `villainCardId` and the expert card in `expertVillains` (the Kang pattern), with `villainStages: { standard: [1, 1], expert: [1, 1] }`. `wave3.test.ts` validates Escape the Museum's `Scenario` this way.
- A second flip mechanism beside `sides` (the proposed `VillainStage.flipSide`) would model the same physical thing twice. It was already rejected once (docs/phase7-wave2.md §11.2) and nothing in cycle 2 changes that.

**The back face prints ∞ hit points, not "no hit points".** MarvelCDB's `health: 0` is its encoding of ∞:

- MC16 p. 12, Escape the Museum, "Infinite Hit Points (New)": "In this scenario, the villain has inifite hit points (∞). A character with infinite hit points cannot be defeated by taking damage. However, damage may still be dealt to that character through attacks and card abilities." MC21 p. 20 prints the same paragraph for Hela.
- RRG 1.8 "Hit Points" (p. 22): "Some characters may have an infinite number of hit points. A character with infinite hit points cannot be defeated by taking damage, as the amount of damage that character takes will never cause its remaining hit points to reach zero."

**New: `VillainStage.infiniteHp?: boolean`,** replacing wave 2's `hpNotPrinted`.

- `hp` holds `{ base: 0, perPlayer: 0 }` on such a face, as `dashedStats` holds 0 for a dashed stat; the validator refuses any other value. Any side may set it: the RRG entry is about characters, not back faces.
- **Why `hpNotPrinted` had to go.** It encoded two readings the rules contradict. It said the face prints no hit points (it prints ∞), and it carried the front's hit point dial across the flip (`hp` had to repeat the front's value). MC21 p. 20 says the opposite of the carry-over: "Flipping Hela from her Mystic side to her Wounded side and vice versa is resolved just like advancing to the next villain stage: her hit points are reset and any status cards attached to Hela remain attached." What the flip does to the dial is now an engine rule (§3.1).
- **The text "Collector cannot be defeated." / "Hela cannot be defeated." is an ability**, scripted as `RuleSpec cannotBeDefeated` (§3.1). It is redundant with ∞ against damage, and exact against anything else that defeats.

**Parser mapping (pipeline; not done).** `stageOrder` (`scripts/marvelcdb/normalize/villains.ts`) reads only a roman numeral or a single letter, so `"A1"`/`"A2"` still fail with "villain stage label is not a roman numeral" (the survey's 4 `gmw` and 4 `mts` lines). When it learns them it must compare the **letters** for the mode and the **digits** for the face; comparing whole labels would misfile the Collector as MaGog's A/B versions (docs/phase7-wave2.md §15.2). Emit `stageLabel: "A1"` / `"A2"` (`"B1"` / `"B2"` for expert), `infiniteHp: true` and `hp: flat(0)` on face 2, face 2's own raw ATK/SCH, and `startingSide` absent (both start on the A face).

### 1.2 Amplify icons: `BaseCard.amplifyIcons` and `CardFlipSide.amplifyIcons`

- RRG 1.8 "Amplify Icon" (p. 7): "When a boost card is turned faceup during an enemy activation, add one additional boost icon to that card for each amplify icon in play", and "Each amplify icon is equivalent to the following constant ability: 'Each boost card gains [boost].'"
- **Why on `BaseCard` and not in `SchemeIcon`.** The icon is printed on many card types and the rule counts it wherever it is in play. MarvelCDB's `scheme_amplify` field is set on side schemes (Vendetta 16054, Spatial Positioning 16069, Philosopher's Stone 16129, Cannonade 16144), an attachment (The Beyonder's Blazer 16124), a minion (`bp` 51034), allies (`deadpool` 44014, 44016), an upgrade (`fne` 60031), a player side scheme (`deadpool` 44024), an environment (`mojo` 39041) and an obligation (`synthezoid` 57072).
- **A double-sided card counts per face.** `CardFlipSide.amplifyIcons` carries the other face's count: There Is No Escape and Kree Supremacy print one only on their expert (B) face (16180b, 16182b).
- A positive whole number when present; absent means none.
- **Data bug to fix (pipeline): the normalizer drops `scheme_amplify` for every pack**, including ones already emitted. `schemeIcons` (`normalize/values.ts`) maps only crisis, acceleration and hazard. 49 printed cards in the pool carry the icon; the already-emitted ones are `bp` 51033, 51034; `cyclops` 33029; `deadpool` 44014, 44016, 44024, 44039; `jubilee` 47032; `magneto` 49029, 49041; `mojo` 39041; `phoenix` 34030; `storm` 36032; `synthezoid` 57026, 57064, 57072; `wonder_man` 58027. Each needs `amplifyIcons` emitted (none is scripted yet, so no behaviour changes today).

### 1.3 Hinder X and Uses printed with the per player icon

- **`KeywordInstance` `hinder` gains `perPlayer?: number`.** RRG 1.8 "Hinder X" (p. 22): "A card with the hinder X keyword enters play with X threat on it", "in addition to any threat it normally enters play with". X is `value + perPlayer × players` (RRG 1.8 "Per Player Icon", p. 32: it "multiplies that value by the number of players who started the scenario"). `Hinder 2[per_hero].` → `{ value: 0, perPlayer: 2 }`; `Hinder 4.` → `{ value: 4 }`. **88 printed cards** scale it; every one of cycle 2's does (Blockade, Oppressive Armada, Pincer Maneuver, the Galactic Artifacts side schemes, Cannonade, the standard Campaign Challenge faces, Fugitive Recovery, Budding Crime Syndicate).
- **`uses` gains `countPerPlayer?: number`,** entering play with `count + countPerPlayer × players` counters, and `count` may then be 0. `Uses (1 fury counter, plus 1[per_hero] additional fury counters).` (Fanaticism 16110) → `{ count: 1, countPerPlayer: 1 }`; `Uses (2[per_hero] ammo counters).` (Crossbones' Machine Gun 04064) → `{ count: 0, countPerPlayer: 2 }`. Also `sm` 27174a.
- **Data to fix (pipeline).** `parseKeywordSentence` (`parse-text.ts`) matches `Hinder N` only without the icon, so every `Hinder N[per_hero]` sentence became an ability ref instead: `stld` 17025 is emitted with `keywords: []` and `17025.budding-crime-syndicate-constant`. Re-emit it with the keyword and no ref.
- **A live wave 2 bug found on the way: Crossbones' Machine Gun (04064) has no uses keyword.** It is scripted and playable, but its emitted `keywords` is `[]` (the `Uses (2[per_hero] …)` sentence failed to parse the same way), and `04064.crossbones-machine-gun-constant` is `coveredByEngineRule()`. So it enters play with no ammo counters and is never discarded; the printed card is discarded after 2 per player attacks. Fix: the pipeline emits `{ name: "uses", count: 0, countPerPlayer: 2, counterType: "ammo" }` (the engine reads it, §3.3), then `rules-qa-engineer` pins it with a Crossbones scenario test.

### 1.4 Double-sided side schemes are not representable: emit one card per face

`SideSchemeCard` has no `flipSide` (only `EncounterCardCommon` does). The five Campaign Challenge side schemes print a standard face and an expert face with different threat, keywords and text (16178a/b–16182a/b: "Standard Mode Only." / "Expert Mode Only."), and MC16's campaign setup says "Reveal the Badoon Blitz (178A) side scheme (use the reverse side for expert mode)".

- **Decision: emit each face as its own `SideSchemeCard`** (`16178a`, `16178b`, …). Nothing flips them during a game; the campaign instruction picks the face. This needs no schema change.
- **Consequence, recorded rather than guessed:** as two cards, the engine does not know they are two faces of one card, so RRG 1.8 "Double-Sided Card" (p. 17), "When a double-sided card would enter an out-of-play area other than the victory display or set-aside area, it is removed from the game", does not apply to them. Each has Victory 1, so a defeated one goes to the victory display either way; only a discarded one differs. Revisit if a card ever discards one.

### 1.5 Gamora's deckbuilding: "up to 6 attack and/or thwart events" (not done; `gam`)

Gamora (18001b), Skilled Tactician: "You may include up to 6 attack and/or thwart events in your deck from aspects other than your chosen aspect."

- `IdentityDeckbuilding.offAspectPackages` cannot express it: `OffAspectPackage` is Maria Hill's all-or-nothing "exactly three titles at maximum copies" (FAQ "Maria Hill (#1B)", RRG 1.8 p. 64).
- **Proposed shape:** `IdentityDeckbuilding.offAspectAllowance?: { cardType: "event"; anyTrait: [ATTACK, THWART]; maxCards: 6 }` — any number of titles, at most 6 cards in total, each an event with either trait, from any other aspect. `validateDeck` counts the matching off-aspect cards against it instead of reporting `aspect_restriction`.
- Until it lands, the pipeline should emit `deckbuilding: { unmodeled: ["Skilled Tactician …"] }` on 18001a so `validateDeck` refuses to seat a deck that relies on it rather than silently judging it by the default rules. Today 18001a carries no `deckbuilding` at all.
- **Status: open**, and it only blocks `gam`.

### 1.6 Keywords

Cycle 2 prints Hinder X, Patrol, Stalwart and Victory X for the first time, plus Guard, Incite, Peril, Permanent, Quickstrike, Restricted, Retaliate, Setup, Surge, Team-Up, Toughness, Uses and Villainous. Each already had a `KeywordInstance` shape; §1.3 adds the per player values. The engine now enforces all of them (§3.3–§3.7).

| Keyword         | Printed forms                                                                    | Cards                                                                               |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Hinder          | `Hinder N[per_hero].` (with its reminder text); `Hinder 4.` on the expert faces  | 16066, 16068, 16112, 16127–16130, 16144, 16178a–16182a, 16187, 17025; 16178b–16182b |
| Victory         | `Victory N.` (0, 1, 2)                                                           | 16127–16130, 16178a/b–16182a/b, 16183                                               |
| Patrol          | `Patrol.` (with reminder text; with Guard on one line on 16136, 20025)           | 16119, 16132, 16136, 16186, 20025                                                   |
| Stalwart        | `Stalwart.` printed once; granted "gains stalwart" on 16064, 16095, 16096, 16109 | 16133                                                                               |
| Villainous      | `Villainous.`                                                                    | 16055, 16075, 16183                                                                 |
| Uses            | `Uses (N charge/energy/mental/physical counters).`; Fanaticism's per player form | 16046, 17031, 18032, 19033, 20015, 20022; 16110                                     |
| Permanent/Setup | `Permanent. Setup.` (Milano); `Setup. Attach to the villain. / Permanent.`       | 16142, 16149                                                                        |
| Team-Up         | `Team-Up (Groot and Rocket Raccoon).`                                            | 16020, 16048                                                                        |
| Peril           | `Peril.`                                                                         | 16145–16147                                                                         |

- "Setup:" as an ability is on every main scheme 1A and on Peter Quill (17001b) and Flash Thompson (20001b). Identity Setup abilities already resolve at RRG 1.8 Appendix II step 16.
- **Not keywords, however they read:** "Unit Cost X." on The Market's cards is campaign data (C2); "Standard Mode Only." / "Expert Mode Only." is text the campaign instruction reads.

### 1.7 Other data notes for the pipeline

- **Badoon Headhunter is modular and campaign-specific at once.** RRG 1.8 FAQ "Modular Encounter Sets" (p. 61) lists it among the eight modular sets; MC16 p. 4 says "Cards #178–187 are campaign-specific encounter cards … and belong to the 'Campaign – Challenge' and 'Badoon Headhunter' modular encounter sets". Mark the set `campaignSpecific` (it is only added by campaign setup) and keep it out of `recommendedModularSetIds`; flagged in §4.
- **Errata to apply** (RRG 1.8 pp. 66–67): Obedience Potion (#123), The Poison (#125), Cosmo (#20: "a player deck or the encounter deck"). The rulebook errata (setup bullet 5 of Infiltrate the Museum; "(Optional)" on Kree Supremacy) are campaign data.
- **Raw-data typos** seen in passing, for curation to check against the card image: 16068's reminder text lacks its opening parenthesis; 16125 reads "the take 1 damage"; 16159 ends "…encounter deck?"; 18027 ends "(except for [[traits]]))".

---

## 2. Per-pack setup needs, standalone

RRG 1.8 Appendix II (p. 51) with the wave 1 and wave 2 engine. Step 13, "Campaign Setup", is skipped.

### 2.1 Hero packs

| Pack   | Identity                           | Obligation                       | Nemesis set (nemesis minion in bold)                                                         | Other setup and legality                                                                                             |
| ------ | ---------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `gmw`  | Groot (16001a/b)                   | Wilt (16025)                     | Blazing Inferno, **Furnax** (16027), Fan the Flames ×3                                       | Precon: Protection (MC16 p. 20).                                                                                     |
| `gmw`  | Rocket Raccoon (16029a/b)          | Crisis on Halfworld (16053)      | Vendetta (amplify), **Blackjack O'Hare** (16055), Blackjack's Bazooka, Planetary Invasion ×2 | Precon: Aggression (MC16 p. 20). Charge counters without Uses (MC16 FAQ p. 21: not discarded at 0).                  |
| `stld` | Star-Lord / Peter Quill (17001a/b) | Banishment (17024)               | Budding Crime Syndicate, **Mister Knife** (17026), Spartoi Cunning ×3                        | Peter Quill's Setup: search deck and discard for Element Gun.                                                        |
| `gam`  | Gamora (18001a/b)                  | Unfulfilled Destiny (18024)      | Sibling Rivalry, **Nebula** (18026), In a Bind, Waylay ×2                                    | Skilled Tactician deckbuilding (§1.5, open).                                                                         |
| `drax` | Drax (19001a/b)                    | Memories of Another Life (19025) | Cull the Weak, **Yotat the Destroyer** (19027), Challenge Accepted, "I Will Destroy You!" ×2 | none.                                                                                                                |
| `vnm`  | Venom / Flash Thompson (20001a/b)  | Struggle for Control (20023)     | Klyntar Frenzy, **Enraged Symbiote** ×4 (20025)                                              | Flash Thompson's Setup: discard until a Weapon upgrade. One extra restricted card (§3.22). Set-aside Symbiotes (§4). |

- **Same title, different cards.** Nebula the ally (18002, `gam`), Nebula the nemesis minion (18026) and Nebula the villain (16088–16090) are three cards; the nemesis minion prints "When this minion would enter play, discard the Nebula ally from play". Gamora the ally (19020) and Gamora the identity likewise; MC16 FAQ p. 21 confirms "the players as a group are permitted to have only one copy of each unique card (by title) in play" (the Groot ally with the Groot hero). Drax the ally (18019) vs Drax the identity, Star-Lord the ally (20016) vs Star-Lord the identity, Rocket Raccoon and Groot allies vs their identities: all one-per-title.
- **Precons.** Groot and Rocket Raccoon are printed in MC16 p. 20; the other four come from their inserts (not read, §0).

### 2.2 The Galaxy's Most Wanted scenarios

Each villain deck is I–II standard and II–III expert, except Escape the Museum's, which is one card per mode (§1.1). "Contents" and "Setup" are each 1A's printed text.

| Scenario              | Main scheme deck                                                                | Encounter sets (required)                                     | Modular (1)      | 1A Setup                                                                                                                                                                       | Needs (§3)                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Brotherhood of Badoon | Terrestrial Invasion → Protect the Planet (2B loses)                            | Brotherhood of Badoon, Ship Command, Standard                 | Band of Badoon   | "Put the Badoon Ship environment and the Milano support into play."                                                                                                            | §3.2 (after step one), §3.3, §3.5, §3.7, §3.13 (Milano, First Player Action), Special (existing `resolveSpecials`) |
| Infiltrate the Museum | The Grand Collection (single stage; 1B loses at 5+ cards in The Collection)     | Infiltrate the Museum, Galactic Artifacts, Standard           | Menagerie Medley | "Create 'The Collection' game area … Put the top card of each player's deck faceup into The Collection."                                                                       | §3.14 (The Collection), §3.3, §3.4, §3.16 (Starshark)                                                              |
| Escape the Museum     | The Missing Milano → Lost in the Museum → The Great Escape (3B: no threat wins) | Escape the Museum, Galactic Artifacts, Ship Command, Standard | Menagerie Medley | "Put the Library Labyrinth environment into play. Set aside the Ship Command modular encounter set."                                                                           | §1.1, §3.1 (∞ face, "would be defeated … instead"), §3.2 (round ends), §3.13, set-aside sets (§3.26)               |
| Nebula                | The Art of Evasion → Warp Drive Initiated                                       | Nebula, Power Stone, Ship Command, Standard                   | Space Pirates    | "Put the Nebula's Ship environment and the Milano support into play. Attach the Power Stone to Nebula. Discard the top 2[per_hero] cards … attach each Technique … to Nebula." | §3.2 (villain phase begins), §3.8, §3.15 (damage caps), §3.7, §3.19 (Power Stone), §3.13                           |
| Ronan the Accuser     | Interception Imminent → "Take What Is Mine"                                     | Ronan the Accuser, Power Stone, Ship Command, Standard        | Kree Militants   | "Put the Kree Command Ship environment and the Milano support into play. Attach the Universal Weapon to Ronan the Accuser. Attach the Power Stone to the first player."        | §3.19 (Power Stone to a player), §3.13 (First Player Interrupt), §3.5, §3.7, §3.15                                 |

- **Modular sets** (RRG 1.8 FAQ p. 61): "Badoon Headhunter, Band of Badoon, Galactic Artifacts, Kree Militants, Menagerie Medley, Power Stone, Space Pirates, and Ship Command." Each scenario's 1A "Contents" names the rest.
- **Ship Command in Escape the Museum starts set aside** and its Milano enters at 2A; 3A shuffles "the remaining cards from the set-aside Ship Command encounter set into the encounter deck". Setting aside a whole encounter set at setup is a scripted 1A `Setup:` over existing primitives (`moveCards` to `encounterSetAside`), not a scenario field.
- **Setup timing** (ruling, Jun 2, 2026 (3) #2): "Campaign setup finishes before resolving Collector II's When Revealed damage." Standalone play has no campaign setup, so this only matters to C2.
- **The Collection's owner-return** ("discard 1 card from The Collection (to its owner's discard pile)") and its loss condition ("If there are at least 5 cards in The Collection … the players lose the game") are §3.14.

### 2.3 The Kree Fanatic modular set (`ron`)

Five cards: Ronan the Accuser (90001, a minion with Toughness, "Ronan the Accuser cannot be stunned", "Forced Interrupt: When the villain phase begins, Ronan the Accuser engages the hero with the fewest remaining hit points"), Judge, Jury, Executioner (90002), The Accused (90003), Bring the Hammer Down ×2 (90004), You Dare Oppose Me? ×2 (90005).

- **Needs:** §3.7 (`cannotHaveStatus`, landed), §3.2 (villain phase begins, landed), and three vocabulary questions for the scripter, each believed expressible with what exists but not yet proven: "engages the hero with the fewest remaining hit points" (`engage` with a `PlayerRef ownerOf` a `superlative` identity by `remainingHp`), "Ronan the Accuser activates against the player he is engaged with" (§3.27), and "Each time a card belonging to the Kree Fanatic set is discarded this way, deal that card to yourself" (`discardEncounterCards` with a bind, then `moveCards` of the bound cards filtered by `encounterSetOf`).
- The minion shares the title "Ronan the Accuser" with the `gmw` villain. The unique rule keeps them from being in play together.

---

## 3. Engine primitives for cycle 2 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is needed.

**Priority order.** The list is longer than eight sections, so, as the brief asked, the primitives the `gmw` box and `stld` need were implemented first (§3.1–§3.13 so far), then the rest are specified with status "open". Within that: first the rules the whole cycle leans on (defeat, timing points, keywords), then single-mechanic primitives, then the vocabulary tail. **A pack whose cards need an unbuilt primitive stays data only.**

Every landed section has its own test file under `packages/engine/src/`, driven through real commands and replayed deep-equal where it touches the log. Shared scaffolding for them is `packages/engine/src/testing/wave3.ts`.

### 3.1 A villain's defeat as an interruptible event; `cannotBeDefeated`; ∞ hit points and the flip

> **Status: landed (2026-09-22),** tested in `packages/engine/src/villain-defeat.test.ts` (11 tests: the Collector's
> replaced defeat, MaGog's reset, a listened-to defeat that still applies, Green Goblin's flip unchanged, replay
> deep-equal). Commit `8350ce9`.

**Why it is needed.** Escape the Museum's Collector (16080a/16081a): "Forced Interrupt: When Collector would be defeated, remove 3[per_hero] threat from the main scheme and flip this card instead." The Mad Titan's Shadow's Odin's Torment 1B replaces Hela's defeat the same way, and MaGog (`mojo`) "resets his hit points … instead". The engine's villain defeat (`defeatVillainStage`) ran inline from the defeat sweep with no interrupt window, and there was no villain-level "cannot be defeated" rule (docs/phase7-wave2.md §15.2 named both as blockers).

**What landed:**

- **A villain stage at zero remaining hit points is a `characterDefeated` event when an ability could react to it** (`checkDefeats`, `resolve/defeat.ts`), the same pattern the identity's defeat already used (Captain America's Helmet). With nothing listening it falls inline exactly as before, so no existing log changes. The event frames are pushed after the minions' and allies', so they resolve first, keeping the sweep's villains-first order.
- **`applyDefeat` re-checks the dial**, so a replacement needs no special machinery: "flip this card instead" turns the villain to an ∞ face and "reset his hit points instead" clears the damage, and either makes the defeat not apply. `cancelTriggeringEvent` (the `instead` builder) also works.
- **`RuleSpec cannotBeDefeated { target, while? }`** (RRG 1.8 "'Cannot'", p. 11: absolute). Read by the sweep and by `applyDefeat`, for every character: villains, minions, allies, identities. It stops defeat only; damage is still dealt and taken. Also needed by Citizen V (`aos` 50129: "cannot be defeated unless …", a `while`).
- **A face with `VillainStage.infiniteHp` has infinite maximum hit points** (`characterProfile`, RRG 1.8 "Hit Points", p. 22), so `damage >= maxHp` never holds. Infinity is never stored: only `damage` is, and the profile is recomputed on each read.
- **A flip into or out of an ∞ face sets the dial to the new face's hit points** (`flipVillain`, damage to 0; the log's `villainFlipped` gains `hitPointsReset: true`). RRG 1.8 "Flip" (p. 20) is silent on the dial, and the two products that print ∞ both reset it: MC21 p. 20 ("her hit points are reset", both directions) and the Collector's own text ("flip this card, then set Collector's hit point dial to his printed hit points"). Resetting on the flip makes that second clause a no-op rather than leaving a window between the two effects in which the sweep would see the old damage against the front's hit points. **A flip between two finite faces keeps the damage**, exactly as Risky Business requires.
- `setRemainingHitPoints` leaves a character with ∞ hit points alone: it has no dial to set.

**Behaviour to know:**

- **Villain stage defeats now reach `characterDefeated` listeners.** Before, a villain's stage never produced the trigger event. RRG 1.8 "Defeat" (p. 15) makes a villain stage defeated like any character, so this is the correct reading. No scripted ref listens to one today: the three `when.defeated("host")` scripts attach to minions (Spider-Tracer, Biomechanical Upgrades) or the identity (Captain America's Helmet).
- **The client will see `Infinity`** in `maxHitPoints` / `remainingHitPoints` previews for an ∞ face (`preview.ts`). It survives structured clone; it should render as "∞" (`game-client-engineer`).
- **Open (§4 Q1):** when a villain's defeat is deferred to an event (only when something listens) and the same sweep eliminates the last player, the elimination happens first. Inline (nothing listening) the villain still falls first, as before.

**What `ability-scripting-engineer` needs:** the Collector front is `forcedInterrupt(when.defeated("self"), removeThreat(3 per player, main scheme), flipCard(self))`; the back is `constant(rule({ kind: "cannotBeDefeated", target: { self: true } }))` plus a forced interrupt on `phaseEnding { phase: "villain" }` (§3.2) that flips it and sets the dial. The `rule` builder passes a `RuleSpec` straight through.

### 3.2 The round structure's timing points: `phaseBeginning`, `phaseEnding`, `villainStepResolved`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/round-timing.test.ts` (5 tests: every listener
> through one round in RRG order, step one's threat seen only after step one, none of them pushed with nothing listening,
> replay deep-equal). Commit `6ebb61f`.

**Why it is needed.** 71 printed cards use these timing points; cycle 2 alone has Museum Ship and Nebula's Ship ("When the villain phase begins"), Blazing Inferno and Sibling Rivalry ("After the villain phase begins"), Terrestrial Invasion 1B, Protect the Planet 2B and Bombardment ("After resolving step one of the villain phase"), Rogue Vessel ("When the villain phase ends"), the Collector's ∞ face and Regroup ("When the round ends"), and the Kree Fanatic's Ronan ("When the villain phase begins"). The engine had only `playerPhaseEnded` / `villainPhaseEnded` announcements (responses only, the second fired after the next round had already begun) and the delayed `atEndOfPhase` / `atEndOfRound`.

**Three new `TriggerEvent`s**, each pushed only when an ability listens (`heard`), so a game without one logs exactly as before:

- **`phaseBeginning { phase: "player" | "villain" }`** — interrupt and response windows. RRG 1.8 "Round Overview" (p. 4), steps 1 and 4. The villain phase's resolves after everything the player phase's end queues and before step one; the player phase's before the first turn's `turnStarted`.
- **`phaseEnding { phase: "player" | "villain" }`** — interrupt and response windows. RRG 1.8 "End of Player Phase" (p. 18) step 5, and "Villain Phase" (p. 47) step 6b: "Resolve any 'when/after the [villain] phase ends' or 'when/after the round ends' effects." **So the villain phase's end is the round's end**: "When the round ends" is `phaseEnding { phase: "villain" }`. It comes after "until the end of the phase/round" lasting effects end (steps 4 and 6a). **Its apply step resolves the "at the end of the phase/round" delayed effects**, which RRG 1.8 "Delayed Effect" (p. 15) places "immediately after their specified timing point … and before responses": so interrupts, then delayed effects, then responses.
- **`villainStepResolved { step: "placeThreat" }`** — response window only. Announced once step one's threat and its own windows have resolved, before step two.

Pattern with `eventIs`: `{ on: "phaseEnding", eventIs: { phase: "villain" } }`.

**Wave 2 bug found on the way (`ability-scripting-engineer`): three `trors` main schemes script "After resolving step one of the villain phase" as `on.threatPlaced(query("mainScheme"))`** — None Shall Pass 1B (`04079b.none-shall-pass-forced-response`), Hunting Down Heroes (`04096b.hunting-down-heroes-forced-response`) and The Mad Doctor 2B (`04113b.the-mad-doctor-forced-response`). That fires on _every_ threat placed on the main scheme (a minion's scheme, Incite, a card's effect), not once per villain phase; None Shall Pass's delay counters and The Mad Doctor's test counters accumulate far too fast. Hunting Down Heroes is worse: its own "Place 1 threat here" option places threat on the main scheme, so the response retriggers itself for as long as that option is chosen. Re-script all three on `villainStepResolved { step: "placeThreat" }` and pin each with a test that places threat outside step one.

**Existing scripts that can move** (not wrong today): Magical Enhancements (`drs` 09010) and the temporary keyword use a scheduled `atEndOfRound` as their "When the round ends"; that is exact for a card that can reach only one round end, but `phaseEnding` is the general form.

### 3.3 Hinder X, and Uses with a per player count

> **Status: landed (2026-09-22),** tested in `packages/engine/src/per-player-keywords.test.ts` (7 tests). Commit
> `b9998d2`.

- **Hinder:** a side scheme enters play with `startingThreat + X` in one placement (`enterPlayOnReveal`, the one path every side scheme enters by, revealed or put into play), with X from `keywordTotal`, which now adds `perPlayer × players` for hinder. RRG 1.8 "Hinder X" (p. 22): "enters play", so a put-into-play scheme gets it too.
- **Uses:** `applyEnterPlayKeywords` places `count + countPerPlayer × players` counters.
- The pipeline changes that make these reach cards are §1.3.

### 3.4 Victory X and the victory display

> **Status: landed (2026-09-22)** for characters, side schemes, attachments and uses, tested in
> `packages/engine/src/victory-keyword.test.ts` (7 tests). Commit `b9998d2`. **Open:** a villain stage with Victory X
> (below).

RRG 1.8 "Victory X" (p. 46). **`defeatFromPlay`** (`effects.ts`) is the one place a defeated card leaves play:

- a defeated character or side scheme (or player side scheme) with Victory X goes to the victory display instead of its discard pile — `applyDefeat` and the side-scheme defeat (`discardFromPlay { defeated: true }`) both call it;
- a Victory X attachment on a defeated host goes there first ("The card the attachment or upgrade was attached to is discarded as normal");
- a card with uses and Victory X goes there when its last counter is removed.

A card _discarded_ rather than defeated ("discard this side scheme") still goes to its discard pile. When Defeated abilities resolve first, then the card moves (the test pins the order).

**Behaviour to know:** the ruling of Jan 11, 2026 (1), "When Fearless Determination is defeated, it is considered in play until its When Defeated ability resolves", is about the same moment. The engine moves a defeated _minion_ before its When Defeated frames resolve (`applyDefeat`), and a defeated side scheme after. Nothing in cycle 2 depends on the minion order; flagged in §4 Q4.

**Open: a villain stage with Victory X** (Loki I ×5, `mts` 21160–21164; the Brotherhood of Mutants villains, `mut_gen` 32121–32124). A defeated stage is removed from the game (RRG 1.8 "Villain Defeat", p. 47) and the villain is one instance across its stages, so "the stage goes to the victory display" needs the stage card as its own out-of-play record. Not needed before `mts`.

### 3.5 Patrol

> **Status: landed (2026-09-22),** tested in `packages/engine/src/patrol.test.ts` (7 tests). Commit `b9998d2`.

RRG 1.8 "Patrol" (p. 32): "that player cannot use cards they control to thwart the main scheme". `patrolledBy(state, deps, player)` (`rules.ts`) is the check, read in two places, the same two the crisis icon uses:

- **a basic thwart** against the main scheme is refused (`actions.ts`), per share of a divided thwart (FAQ "Wasp (#1C)", RRG 1.8 p. 61, names patrol beside crisis);
- **a "(thwart)" ability's** removal from the main scheme is blocked (`threatRemovalBlocked`, reason `"patrol"`, logged).

Other threat removal ("remove 2 threat from the main scheme") is not a thwart (RRG 1.8 "Thwart", p. 44) and still works, and so does thwarting a side scheme. Only the engaged player is restricted, their allies included.

**Behaviour to know:** as with crisis, a "(thwart)" event's target choice still offers the main scheme; the removal is what is blocked. The client shows reason `"patrol"` as "a rule" until it learns the word (`log-lines.ts` distinguishes only `"crisis"`).

### 3.6 The amplify icon

> **Status: landed (2026-09-22),** tested in `packages/engine/src/amplify.test.ts` (5 tests). Commit `b9998d2`.

`amplifyIconsInPlay` (`modifiers.ts`) sums the icons on every face-up card in play (a flipped card's other face; nothing for a card facedown as something else). A boost card turned faceup during an enemy activation gets that many extra icons, both on the `boostCardFlipped` log and at the count. It is read again at the count, not carried from the flip, because the icon is a constant (RRG 1.8 p. 7) that applies while its card is in play (the ruling of Jan 11, 2026 (1): Fearless Determination's icon "remains in effect when Captain America activates"). A cancelled boost count (Close Call) is 0, icons and all.

**Behaviour to know:** every game area's icons count, since the rule says "in play" and no printed card puts one in a separate game area yet.

### 3.7 A character that cannot have a status sheds it: stalwart, and `cannotHaveStatus`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/stalwart.test.ts` (4 tests). Commit `b9998d2`.

- RRG 1.8 "Stalwart" (p. 40): "If a character gains the stalwart keyword while they have a stunned and/or confused status card, each stunned and/or confused status card is removed from that character." Cycle 2 grants stalwart with attachments (Drang's Spear, Evasive Maneuvering, Unyielding Persistence, Universal Weapon). The engine already refused to _give_ a stalwart character either status (`statusCapacity`); now `checkStateTriggers` trims any status a character holds beyond what it may have, the moment that becomes true (log: `statusRemoved`, reason `"cannotHave"`). It only looks at characters already holding a status.
- **`RuleSpec cannotHaveStatus { target, statuses, while? }`**: "Ronan the Accuser cannot be stunned." (Kree Fanatic 90001). `statusCapacity` reads it for every status, so the same trim applies.

### 3.8 "The first … revealed each round/phase gains surge": `firstRevealGainsSurge`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/first-reveal-surge.test.ts` (7 tests, including the
> Mister Knife FAQ case). Commit `68c0acb`.

Nebula I–III: "The first [Technique] attachment revealed each round gains surge." Mister Knife: "The first treachery the engaged player reveals each villain phase gains surge."

- **`GameState.revealedThisRound`** records every reveal (card, revealer, phase), emptied when the round ends. "The first" counts cards revealed before the rule's card arrived, so it is written whatever is in play. It is absent until a game's first reveal, so a freshly set-up game serializes as before.
- **`RuleSpec firstRevealGainsSurge { cards, each: "round" | "phase", revealer?, while? }`** is read once, as a card is revealed (the reveal's faceup step): only a rule already in play applies. FAQ "Mister Knife (#26)" (RRG 1.8 p. 62): "Mister Knife was not in play when Shadow of the Past was revealed, so his ability does not cause Shadow of the Past to gain surge." `revealer` is resolved with "you" as the rule's speaker, which for an engaged minion is the engaged player. The log gains `surgeGranted`.
- A boost card turned faceup is not revealed and never counts.

### 3.9 Defeat by effect: `EffectSpec defeat`

> **Status: landed (2026-09-22),** tested in `packages/engine/src/defeat-effect.test.ts` (6 tests). Commit `d8706bc`.

Nova Prime (`stld` 17002): "Response: After you play Nova Prime from your hand, defeat a non-[Elite] minion." `EffectSpec defeat { target }` pushes a `characterDefeated` event marked `byEffect`, which `applyDefeat` applies without the dial check. Everything that sees a defeat sees it (interrupts, When Defeated, Victory X, responses), and `cannotBeDefeated` and the permanent keyword still stop it. A villain's stage falls (RRG 1.8 "Villain Defeat", p. 47); an identity's player is eliminated. Characters only.

### 3.10 Counter maximums and three values

> **Status: landed (2026-09-22),** tested in `packages/engine/src/counters-values.test.ts` (5 tests). Commit
> `d8706bc`.

- **`addCounters.upTo`**: "(to a maximum of 10)" places at most as many as bring the card to 10, and none when it already holds that many or more. Ruling, Mar 30, 2026 (1): "'(to a maximum of X)' applies **locally** to that specific ability" — Captain Americat can put an 11th growth counter on Groot or a 4th vengeance counter on Drax, and this removes nothing (Aug 3, 2026 (4) #4: "Drax retains counters above 3"). Groot: Fruition, Root Stomp, Growth Spurt, Fertile Ground, Flora and Fauna; Drax.
- **`addCounters.bind`** reports `<bind>.amount` placed: Drax's "If you cannot, draw 1 card."
- **`ValueSpec min` / `max`**: Star-Lord's Helmet's "(to a maximum of +3 hand size)" is `min(count, 3)`, the cap on its own bonus (same ruling).
- **`ValueSpec dealtEncounterCount { player }`**: "for each facedown encounter card in front of you" (Gutsy Move, Sliding Shot, Jet Boots, Star-Lord's Helmet).

### 3.11 An event that leaves resolution is not discarded; "the first card you have played this round"

> **Status: landed (2026-09-22),** tested in `packages/engine/src/event-destination.test.ts` (4 tests). Commit
> `d8706bc`.

- **The event-discard stage now discards an event only if it is still being resolved.** Before, "return this card to your hand" (Clobber, Impede, `gam`) and "remove this card from the game" (The Market's Grand Strategy, Power Unleashed, Tried and True, Triple Threat, `gmw`) were undone by the discard that followed. RRG 1.8 "Event" (p. 19).
- **`Predicate playedThisRound.cardType` is optional**: absent counts every card type, so "If this is the first card you have played this round" is `{ player: you, atMost: 1 }` while the card resolves (a card counts as played from the moment it is played).

### 3.12 Status-card timing priority: a tough status resolves before "would take damage" interrupts

> **Status: landed (2026-09-22),** tested in `packages/engine/src/status-priority.test.ts` (4 tests).

**Why it is needed.** MC16 FAQ p. 21 (Groot): "If Groot has a tough status card and takes damage, will growth counters be removed from him? A. No. As status card abilities have timing priority over all other conflicting card abilities, the tough status card will prevent the damage before Groot's Flora Colossus ability is able to trigger." Groot's hero ability is a "Forced Interrupt: When Groot would take any amount of damage".

**The rule.** RRG 1.8 Appendix III "Simultaneous Timing Priority": status card forced interrupts come before every other interrupt; RRG 1.8 "Status Cards" (p. 42): "Status card abilities have timing priority over all conflicting triggered abilities"; General FAQ (RRG 1.8 p. 58): "the tough status card must be discarded to prevent all of the damage before any other abilities could trigger", with two exceptions — "A constant effect reduces the damage the hero takes to zero" and "The hero makes a basic defense and their DEF reduces the damage dealt … to zero".

**Before this change** the engine applied tough in `applyDamage`, after the damage event's interrupt window, so any "would take damage" interrupt (Groot's, Booster Boots, Armor Plating, Jet Boots, In Defiance, Deflection, Parry, Crosscounter) resolved first and could keep the tough card. That contradicted the FAQ in every wave, not only this one.

**What landed.** At a `dealDamage` event's interrupt stage, `toughResolvesFirst` asks whether a tough status card is what will stop this damage, in the same order `applyDamage` uses: not when "cannot take damage" applies (a constant, which outranks status cards), not when the attack's damage is already prevented, not for piercing (which discards the card before damage), and not when constant reductions (§3.15) bring the damage to 0 (the FAQ's first exception; a basic defense's DEF, the second, already reduced the amount before the event). When it is, the interrupt window is skipped: tough is a replacement ("remove a tough status card from it instead"), and RRG 1.8 "Would" (p. 48) closes further interrupts to a trigger a replacement changed. The log gains `interruptsPreempted { reason: "tough" }`, only when some interrupt was waiting, so every other log is unchanged. No existing test depended on the old order.

**Behaviour to know:** a constant reduction that brings the damage to 0 keeps the tough card but does not suppress the "would take damage" window; an interrupt there sees a damage event whose taken amount will be 0.

### 3.13 A card the first player controls, and "First Player" abilities (the Milano)

> **Status: open.**

**Cards.** The Milano (16142, Ship Command; in four of the five scenarios): "Permanent. Setup. / The first player controls the Milano. / Piloting — Resource: Exhaust the Milano → generate a [wild] resource for any player." "First Player Action: Exhaust the Milano → remove 3 threat from this scheme." on Terrestrial Invasion 1B, Protect the Planet 2B, The Great Escape 3B, Interception Imminent 1B, Blockade, Bombardment, Oppressive Armada, Spatial Positioning, Pincer Maneuver, Cannonade, Rogue Vessel, Nebula's Ship. "First Player Interrupt: When a treachery card is revealed from the encounter deck …" (Kree Command Ship). MC16 FAQ p. 21: a player who does not control the Milano may still choose "Exhaust the Milano" when a card offers it.

**Needs:**

- a **controller that follows the first player token**: when the token passes (RRG 1.8 "First Player", p. 19), control of the card moves with it;
- an action/interrupt **label restricting who may trigger it to the first player**, on encounter cards (which any player may otherwise trigger actions on, RRG 1.8 "Action", p. 6);
- a **resource ability usable while another player pays** ("generate a [wild] resource for any player").

### 3.14 The Collection: a scenario out-of-play area, and a discard-from-play redirect

> **Status: open.**

**Cards.** Infiltrate the Museum: The Grand Collection 1A "Create 'The Collection' game area", 1B's loss at 5 cards and its "discard 1 card from The Collection (to its owner's discard pile)"; Collector I–III: "Forced Interrupt: When a card (player or encounter) would be placed into a discard pile from play, put it faceup into The Collection instead" (III: "then place 1 threat on the main scheme"); Biogram Image, Inconspicuous Box, View the Cosmos, Stay Awhile, Gallery of Splendor. MC16 p. 10: "The Collection is an out-of-play game area shared by all players and specific to this scenario."

**Rulings to honour:** MC16 FAQ p. 21 — the redirect applies to attachments, environments, minions, obligations, side schemes, allies, supports and upgrades; only a card in play placed specifically into a discard pile, not one set aside, removed from the game, shuffled into a deck, returned to hand, or discarded from an out-of-play area. Ruling, Feb 28, 2026 (8): it catches Infinity Stones too. RRG 1.8 FAQ "Rocket Raccoon (#29A)" (p. 61): "Discarding is the act of attempting to place a card into a discard pile", so a cost to "discard" is paid even when the card lands in The Collection.

### 3.15 A damage cap and a damage reduction per attack

> **Status: landed (2026-09-22),** tested in `packages/engine/src/damage-limits.test.ts` (5 tests).

Cutthroat Ambition: "Nebula cannot take more than 5 damage from a single attack." Wide Stance: "Reduce the amount of damage Nebula takes from each attack by 1." Kree Combat Armor: "Reduce the amount of damage attached character takes from each attack by 1." These are constants; the General FAQ (RRG 1.8 p. 58) puts constants ahead of a tough status, so a reduction to 0 keeps the tough card.

- **`RuleSpec reduceDamageTaken { target, amount, fromAttack?, while? }`** and **`RuleSpec maxDamageTakenPerAttack { target, amount, while? }`**, read by `damageTakenAfterConstants` (`rules.ts`) in `applyDamage` after "cannot take damage", a prevented attack and piercing, and before the tough status.
- They limit the damage **taken**. The damage dealt, and so excess damage (ruling, Jan 26, 2026 (3)) and overkill, is measured first and is unchanged. A reduced event logs `damagePrevented { reason: "reduced" }` for the difference.
- **Reductions first, then the lowest cap** (§4 Q9). The cap is per damage event of one attack, which is one event per target for every attack the engine makes.

### 3.16 An attack that deals indirect damage

> **Status: open.**

Starshark (Menagerie Medley): "[star] Starshark's attacks deal indirect damage." RRG 1.8 "Indirect Damage" (p. 24).

### 3.17 A triggered ability that lasts ("until the end of the turn, each time …")

> **Status: open.**

Schadenfreude (Rocket Raccoon): "Hero Action: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal any amount of damage to an enemy." `LastingEffectBody` has stat modifiers, rule and trait grants, cost reductions and delayed effects, but no response that lives for a duration.

### 3.18 Increasing an amount of excess damage

> **Status: open.**

Follow Through (Aggression): "Hero Interrupt: When your hero's attack deals any amount of excess damage, increase that amount by 1." Ruling, Jan 26, 2026 (3): excess damage is measured as _dealt_, which the engine already records (`excessDealt`).

### 3.19 The Power Stone: an attachment that moves between enemies and identities

> **Status: open.**

Power Stone (16149, Power Stone modular set): "Setup. Attach to the villain. / Permanent. / Forced Response: After a hero or villain deals 3 or more damage to attached character with a single attack, attach Power Stone to the attacking hero or villain." Ronan I–III ("if you control the Power Stone"), "Take What Is Mine" 2A/2B, Superior Tactics ("The Power Stone cannot be unattached from Ronan the Accuser"), Single-Minded Fury, Ronan's 1A ("Attach the Power Stone to the first player"). RRG 1.8 FAQ "Power Stone (#149)" (p. 62): a permanent attachment in an eliminated player's area resolves its "attach to" text; damage prevention does not stop the move, a basic defense's DEF does. The `attach` effect already moves an in-play attachment; what is missing is **control of an encounter attachment attached to an identity**, the **"cannot be unattached"** rule, and the **permanent-attachment-on-elimination** step.

### 3.20 Reducing the cost of the card being played, from an interrupt

> **Status: open.**

Star-Lord (17001a), "What could go wrong?": "Interrupt: When you play a card from your hand, deal yourself 1 facedown encounter card → reduce the cost to play that card by 3. (Limit once per round.)" The engine's `cardBeingPlayed` window opens after the cost is paid (RRG 1.8 "Initiating Abilities", p. 24, step 6), and its cost reductions are constants or lasting effects set up before the play. The reduction has to apply at step 4 ("Apply any modifiers to the cost(s)"). **Open rules question (§4 Q6):** RRG 1.8 has no ruling on when "when you play a card" is true relative to steps 3–5; the printed card only works if it is before step 5.

### 3.21 Naming a card type

> **Status: open.**

Cosmo (17020, errata RRG 1.8 p. 67): "Interrupt: When Cosmo attacks or thwarts, name a card type, then discard the top card of a player deck or the encounter deck. If that card is of the named type, Cosmo does not take consequential damage for this use." Brainstorm (The Market) names a card type too. `chooseOne` can offer the types, but no predicate compares a card's type with a chosen one, and "does not take consequential damage for this use" needs a one-use modifier.

### 3.22 A higher restricted limit

> **Status: open** (`vnm` only).

Venom / Flash Thompson (20001a/b): "You can control 1 additional upgrade that has the restricted keyword." Side Holster (20021): "You can control 1 additional [Weapon] upgrade that has the restricted keyword." RRG 1.8 "Restricted" (p. 38) fixes the limit at two. Needs a rule that raises it, optionally for matching cards only; `checkRestricted` and the play check read it.

### 3.23 An enemy attacking another enemy

> **Status: open** (`drax` only).

Moondragon (19013): "Action: Exhaust and discard Moondragon → choose a minion. That minion attacks another enemy of your choice." Enemy attacks target identities and allies only.

### 3.24 "If you have played a [trait] event this turn"

> **Status: open** (`gam` only). Specified in docs/phase7-wave2.md §13.4 and still unbuilt.

Decisive Blow and Forward Momentum (`gam`). `playedByPlayerThisRound` is keyed by card type, per round.

### 3.25 A variable resource cost of any type, with a maximum

> **Status: open.**

Nebula's Ship (16093): "First Player Action: Exhaust the Milano and spend up to 2 resources of any type → remove 1 evasion counter from here for each resource spent this way." `AbilityCost.resourcesX` takes a typed resource and a minimum only.

### 3.26 Reusable as is (checked against `pnpm dsl` and the engine)

Each of these looked like a gap in the survey and is not:

| Printed wording                                                                                         | Cards                                                         | Existing vocabulary                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "resolve the Badoon Ship's 'Charge Up' ability" / "resolve the 'Special' ability on each Technique"     | Drang, Badoon Engineer, Nebula I–III, Combat Ready            | `resolveSpecials { cards }` / `{ of }` (RRG 1.8 "Special", p. 40)                                                                                                              |
| "X is equal to the number of evasion counters on Nebula's Ship" (a main scheme's printed X)             | The Art of Evasion, Warp Drive Initiated                      | `MainSchemeStage.printedX` plus a `setBase` stat modifier from the stage's constant                                                                                            |
| "When the last threat is removed from this scheme, advance to stage 2A"                                 | The Missing Milano, Lost in the Museum                        | a forced response to `removeThreat` on self with a `threat` predicate of 0, then `advanceMainScheme { to }`                                                                    |
| "If there is no threat here, the players win the game"                                                  | The Great Escape 3B                                           | `stateCheck` + `endGame`                                                                                                                                                       |
| "Set aside the Ship Command modular encounter set" / "Shuffle the remaining cards from the set-aside …" | Escape the Museum 1A, 3A                                      | `moveCards` to and from `encounterSetAside` with an `encounterSets` filter                                                                                                     |
| "When Nebula initiates an activation against you, give him 1 additional boost card"                     | Nebula I–III, Ronan I–III                                     | an interrupt on `enemyAttack` / `enemyScheme` and `adjustBoostCount`                                                                                                           |
| "Ronan the Accuser activates against the player he is engaged with"                                     | Bring the Hammer Down (`ron`)                                 | `if (form hero) enemyAttack else enemyScheme` against `engagedWith self`                                                                                                       |
| "Enters play with 2 charge counters on it" (no Uses)                                                    | Rocket's upgrades; MC16 FAQ p. 21: not discarded at 0         | a forced response to `cardEntersPlay` self with `addCounters`                                                                                                                  |
| "If you paid for this card using only [mental] resources"                                               | Behind Enemy Lines, Grasping Tendrils, Savage Attack (`vnm`)  | `Predicate paidWithOnly`                                                                                                                                                       |
| "+1 to that power for this use"                                                                         | Venom's Pistol (`vnm`)                                        | docs/phase7-wave2.md §17.4                                                                                                                                                     |
| "Treat Gamora's printed text box as if it were blank (except for traits)"                               | In a Bind (`gam`)                                             | `blankTextBox` (docs/phase7-wave2.md §8)                                                                                                                                       |
| "When this minion would enter play, discard the Nebula ally from play"                                  | Nebula nemesis (`gam`)                                        | an interrupt on `cardEntersPlay` (docs/phase7-wave2.md §3.13.10)                                                                                                               |
| "Players other than Gamora cannot remove threat from Sibling Rivalry"                                   | Sibling Rivalry (`gam`)                                       | `threatCannotBeRemoved` with a `while` on the remover — **unproven**; if `while` cannot see the remover, add a `player` field as `cannotAttack` has (docs/phase7-wave2.md §25) |
| "Discard 1 card at random from your hand. If that card's printed resource has [physical] …"             | Adam Warlock (`stld`)                                         | docs/phase7-wave2.md §3.13.6                                                                                                                                                   |
| "Deal yourself 1 facedown encounter card →" as a cost                                                   | Star-Lord, Daring Escape, Library Labyrinth, Universal Weapon | the effect before the arrow; the ability's cost is otherwise free — **unproven as a cost**; the scripter should confirm the "→" split holds when the effect is a deal          |

---

## 4. Open questions (for the user or FFG)

Each is implemented the way stated, or not at all, and named here rather than decided silently.

1. **A deferred villain defeat and a simultaneous last elimination (§3.1).** When a villain's defeat goes on the stack (because an ability listens to it) and the same defeat sweep eliminates the last player, the elimination happens first and the game is lost. Inline (nothing listening) the villain still falls first. RRG 1.8 "Winning the Game" (p. 48) has no rule for a simultaneous win and loss.
2. **A flip into or out of an ∞ face resets the dial (§3.1).** Implemented as the engine rule, from the only two products that print ∞ (MC21 p. 20 for Hela; the Collector's own text). RRG 1.8 "Flip" (p. 20) is silent on the dial. Confident, but it is a reading.
3. **Badoon Headhunter is both modular and campaign-specific (§1.7).** RRG 1.8 FAQ p. 61 lists it as one of eight modular sets; MC16 p. 4 calls its cards campaign-specific. Proposed: campaign-specific, never a recommended modular.
4. **A defeated minion leaves play before its When Defeated resolves.** The ruling of Jan 11, 2026 (1) keeps a defeated side scheme in play until its When Defeated resolves; `applyDefeat` moves a minion first. No cycle 2 card reads the difference; recorded for `rules-qa-engineer` (§3.4).
5. **Patrol and target validity (§3.5).** RRG 1.8 "Initiating Abilities" (p. 24) step 2 requires a valid target. Should a "(thwart)" ability whose only possible target is the main scheme be unplayable while patrolled? The engine lets it be played and blocks the removal, as it already does for crisis.
6. **When is Star-Lord's "When you play a card from your hand" true (§3.20)?** RRG 1.8 step 6 says the card "commences being played" after the cost is paid (step 5), yet the ability reduces "the cost to play that card by 3". The printed card works only if the reduction applies at step 4. Proposed: treat it as a cost modifier offered while paying, like a resource ability.
7. **The Collector's back faces print ATK/SCH 0/0 (standard) in the raw data.** Whether they print "0" or "—" decides whether the Wounded Collector can attack or scheme at all (RRG 1.8 "Dash (Value)", p. 15). Curation must check the card images.
8. **Venom's set-aside Symbiotes.** Struggle for Control (20023): "Put 1 set-aside copy of Enraged Symbiote into play". How many copies start set aside, rather than in the nemesis set, is in the Venom insert, which is not in the repo.
9. **A reduction and a cap on the same character (§3.15).** Wide Stance and Cutthroat Ambition can both be on Nebula. Implemented as reductions first, then the cap (10 → 9 → 5). The other order gives the same result whenever the damage is at least cap + reduction; it differs only in between (6 damage: 6 → 5 → 5, or 6 → 5 → 4 the other way). RRG 1.8 has no rule for ordering two constants.

## 5. What this asks of the other agents

- **`card-data-pipeline`:**
  - the A1/A2 villain stage labels, per mode, with `infiniteHp` on face 2 (§1.1), then emit `gmw`;
  - `amplifyIcons` on every card whose raw record has `scheme_amplify`, including the 17 already-emitted cards in §1.2;
  - `Hinder N[per_hero]` and `Uses (N[per_hero] …)` / `Uses (N …, plus N[per_hero] additional …)` parsed as keywords (§1.3), re-emitting `stld` 17025 and `trors` 04064;
  - the Campaign Challenge side schemes one card per face (§1.4); Gamora's `deckbuilding.unmodeled` (§1.5); the errata and typos in §1.7; §4 Q3 and Q7.
- **`ability-scripting-engineer`:** re-script the three `trors` "after resolving step one" main schemes on `villainStepResolved` (§3.2); script Crossbones' Machine Gun's counters away from `coveredByEngineRule` once its data carries the keyword (§1.3). `gmw` and `stld` can start on everything §3.1–§3.11 covers; the refs that need §3.12–§3.25 stay in `KNOWN_SKIPPED` with the section named.
- **`game-client-engineer`:** render ∞ for an ∞ face's hit points (§3.1); name `threatRemovalBlocked` reason `"patrol"` (§3.5); log lines for `surgeGranted` (§3.8) and `villainFlipped.hitPointsReset` (§3.1).
- **`rules-qa-engineer`:** pin Crossbones' Machine Gun (§1.3) and the three `trors` step-one schemes (§3.2) with scenario tests; §4 Q1 and Q4.
