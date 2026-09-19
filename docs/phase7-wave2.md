# Phase 7 working spec: wave 2 (cycle 1)

This is the shared brief for every agent working Phase 7's second content wave:
- `card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer` and `rules-qa-engineer`.
- It turns PLAN.md Phase 7's "Wave 2 scope decided (2026-09-18)" into schema decisions, per-pack setup needs, and a prioritized list of engine primitives.
- The model is `docs/phase7-wave1.md`, and its §3 primitives are assumed. If you change a decision here, update this file in the same change.

**Wave 2** is cycle 1, in release order:
- The Rise of Red Skull (`trors`): Hawkeye, Spider-Woman, and five scenarios (Crossbones, Absorbing Man, Taskmaster, Zola, Red Skull);
- The Once and Future Kang scenario pack (`toafk`);
- the Ant-Man (`ant`), Wasp (`wsp`), Quicksilver (`qsv`) and Scarlet Witch (`scw`) hero packs.

RRG 1.8 Appendix VI (p. 71) lists The Rise of Red Skull and the four hero packs as "wave" 2. The Once and Future Kang, a scenario pack, is not on that list, but it released inside the cycle.

**Campaign mode is deferred.** Every scenario must play standalone. Campaign cards are data only (§1.4).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules Reference; FFG rulings clarify both):

1. **Card text and product rules inserts.** None is in the repo. Fetched 2026-09-18 from the links on Hall of Heroes' product pages. They are scans, so they were read as page images, and quotes here are transcribed from those images.
   - The Rise of Red Skull rulebook (spoiler-free): `https://hallofheroeslcg.com/wp-content/uploads/2020/09/redskullrulebooknospoilers.pdf`. Cited as "Red Skull rulebook, p. N" (its printed page numbers).
   - The Once and Future Kang insert: `https://hallofheroeslcg.com/wp-content/uploads/2020/09/kanginsert.pdf`. Cited as "Kang insert".
   - Ant-Man Hero Pack insert: `https://hallofheroeslcg.com/wp-content/uploads/2020/11/antmaninsert.jpg`.
   - Not read: the Wasp, Quicksilver and Scarlet Witch inserts, which are linked from their Hall of Heroes pages. Read them before scripting those packs.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading. Hall of Heroes is the transcriber, not the authority.
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (the same as the PDF page).
   - Cycle 1's FAQ entries are on pp. 60–61, and its errata on p. 66.

`packages/content/raw/marvelcdb/{trors,toafk,ant,wsp,qsv,scw}.json` point to card text and stats. They are not an authority.

---

## 1. Schema decisions (owner: `game-rules-architect`; landed 2026-09-18)

> Status: landed in `packages/content/src/schema/**`, with fixtures in `packages/content/src/schema/wave2.test.ts` (20 tests).
>
> - The engine changes that legality and setup need are in `packages/engine`, tested in `packages/engine/src/wave2.test.ts` (12 tests): §1.2, §1.4, §1.5, §1.7 and §1.10.
> - Every Core and wave 1 card still validates, and every existing test passes unchanged.
> - No card data was populated; curation is `card-data-pipeline`'s.
> - **Data only until the engine lands:** a card whose data uses a field marked "data only" must not be marked playable.

### 1.1 Three-sided identities (Ant-Man, Wasp)

- **`HeroIdentityCard.additionalHeroForms?: (HeroFace & { traits })[]`**, the inside face of a foldable card.
  - `hero` stays the outside hero face (MarvelCDB `12001a`, the Tiny face linked to Scott Lang `12001b`).
  - Each entry is an inside face (`12001c`, Giant), which MarvelCDB publishes as a separate, unlinked `hero` record.
  - Hit points stay on the identity.
- **Validation.**
  - Each extra face is checked like the hero face (face name, text, hand size, stats, traits, keywords, abilities).
  - **Ability ids must be unique across every face.** That was always the intent, but it wasn't checked across faces until now.
- **Sources:**
  - Ant-Man insert, "Foldable Cards": "Scott Lang/Ant-Man's identity card is a foldable, 'three-sided' card. One side is his alter-ego form, one side is his TINY hero form, and the inside of the card is his GIANT hero form. Changing form with a three-sided card follows the standard rules for changing form found in the Rules Reference."
  - Ant-Man insert, "Rules Clarifications": "Scott Lang/Ant-Man can change from alter-ego form to either hero form, from either hero form to alter-ego form, or from one hero form to the other hero form." and "If a card ability causes a player to change form, it does not count against the one voluntary form change".
  - RRG 1.8 "Flip" (p. 20): "A foldable, 'three-sided' card is considered to have flipped any time the faceup side of the card changes."
  - RRG 1.8 "Form, Change Form" (p. 21): damage, statuses, attachments and the rest are retained.
- **Neither hero face is the default.** A player changing out of alter-ego form chooses which hero form to take.
- **Not the RRG "Form" keyword.** "[type] form" (RRG 1.8 "Form, Change Form", p. 21; "Keywords", p. 25) grants forms beyond the alter-ego and hero forms. Ant-Man's Giant is a hero form, not a keyword form, and no cycle 1 card prints the keyword.
- **"Play only if you are in [Giant] hero form."** (Giant Stomp, Hive Mind) needs no new field. It is `playRestrictions: { form: "hero", requiresIdentityTrait: GIANT }`, because the trait is printed only on that face (Scott Lang is Civilian).
- **Engine: data only** until §3.2. Engine changes landed so far:
  - `abilityRefsOf` and `unscriptedCards` include the extra faces' abilities, so an unscripted Giant ability keeps the identity unplayable;
  - `validateDeck`'s Team-Up check accepts any face's title.

### 1.2 Spider-Woman: two aspects, and signature cards that print an aspect

- **Two aspects already had a schema hook:** `IdentityDeckbuilding.aspectCount` and `equalCardsPerAspect`, from FAQ "Jessica Drew (#31B)" (RRG 1.8 p. 60): "Does Jessica Drew's Double Agent ability require her deck to be built with two aspects? A: Yes. An equal number of cards from two different aspects must be included in her deck."
  - Curation sets `deckbuilding: { aspectCount: 2, equalCardsPerAspect: true }` on `04031a`, from MarvelCDB `deck_requirements: [{ aspects: 2 }]` and her printed text.
  - `Deck.aspects` and `StarterDeck.aspects` are already lists; her precon is `["aggression", "justice"]`.
- **New: `PlayerCardCommon.printedAspect?: CoreAspect`.**
  - Her set holds Venom Blast (Aggression), Pheromones (Leadership), Contaminant Immunity (Protection) and Inconspicuous (Justice).
  - MarvelCDB gives each one the aspect's `faction_code` with `card_set_code: spider_woman`.
  - **`aspect` stays `hero:04031a`,** because deckbuilding treats these cards as identity-specific. RRG 1.8 "Identity-Specific Card" (p. 23): "A player's deck must include each identity-specific card associated with their chosen identity card."
  - The printed precon (Red Skull rulebook, p. 18) lists all four under "Spider-Woman cards", apart from its 11 Aggression and 11 Justice cards.
  - `printedAspect` is what card effects read: "When you play an aspect card" (Superhuman Agility), "generate a [wild] resource for an aspect card" (Finesse), and "while paying for a Leadership card" (The Power of Leadership).
  - Validation: `printedAspect` must be Aggression, Justice, Leadership, Protection or 'Pool, and only on a card whose `aspect` is `hero:…`.
- **Engine, landed:**
  - `TargetQuery.aspect` now matches `printedAspect` as well as `aspect` (`select.ts`).
  - `validateDeck` classifies these cards by `aspect`. So they are required at their set quantities, are never `aspect_restriction`, and **are not counted in the equal split**.
  - Counting them could never change a verdict for her real set: it prints 2 copies in each of the four aspects, so whichever two aspects are chosen each gain 2. The question stays in §4 in case a later identity prints an unbalanced set.
  - Tests: `packages/engine/src/wave2.test.ts`, "Spider-Woman's Double Agent".
- **Parser need (pipeline):** a `hero`-set card with an aspect `faction_code` becomes `aspect: "hero:<identity>"` plus `printedAspect: <faction>`. Today it would become a plain aspect card, and her deck would then fail `identity_set_mismatch`.

### 1.3 Costs printed as X or a dash; allies printed with 0 hit points

- **`CostedCard.specialCost?: "X" | "dash"`** on allies, events, supports, upgrades and player side schemes, with `cost` held at 0 (as `dashedStats` and `printedX` do).
  - **`"X"`:** Speed Cyclone (14006), "Hero Action: Stun X Enemies." MarvelCDB encodes it as `cost: -1`.
    - RRG 1.8 "Non-Numerical Variable" (p. 30): "For costs involving the letter X, the value of X is defined by card ability or player choice, after which the amount paid may be modified by effects without changing the value of X."
  - **`"dash"`:** RRG 1.8 "Dash (Value)" (p. 15): "If a card has a dash (–) as its cost value, that card cannot be played and can only enter play through other means."
    - The Hydra Campaign "Basic" Condition upgrades (04159a–04162a) have no cost in MarvelCDB and enter play through Setup.
    - Curation must confirm the printed dash from the card image.
- **Ally `hp` may be 0.** Ant-Man (12011) and Wasp (13012) print 0 and get "+1 hit point for each pym counter". The validator now accepts any whole number of at least 0.
- **Engine: data only** (§3.8, §3.9).

### 1.4 Scenario-specific and campaign-specific player cards

- **`PlayerCardCommon.specificTo?: { kind: "scenario" | "campaign"; encounterSetId }`**, beside `aspect`.
  - RRG 1.8 "Classifications" (p. 12) and "Campaign-Specific Card" (p. 11): campaign cards "can only be used during a campaign from the same product (determined by that product's set icon)".
  - **Scenario:** Taskmaster's Captive allies (04097–04100: Moon Knight, Shang-Chi, White Tiger, Elektra) are ally cards in the Taskmaster encounter set.
  - **Campaign:** the Hydra Campaign upgrades (04155–04162), printed "Campaign / Basic". Red Skull rulebook, p. 3, "Campaign-Only Cards": "These cards cannot be included in any player's deck unless they are playing The Rise of Red Skull campaign and the players were directed to add them to their decks".
- **New `Aspect` value `"none"`** for a player card printed with no identity, aspect or basic classification at all. It requires `specificTo`.
  - The Captive allies are expected to be `"none"`. **Curation must check the card image;** if it prints "Basic", use `"basic"`.
- **`EncounterSet.campaignSpecific?: boolean`** for the Hydra Campaign set and the four Expert Campaign Sets (04163–04166: obligations with player-card backs, Red Skull rulebook p. 17).
- **Engine, landed:** `validateDeck` refuses both kinds with new codes, `campaign_card` and `scenario_card`, and doesn't count them toward deck size.
  - The Red Skull rulebook, p. 3: "Cards added to the deck as part of a campaign do not count toward a player's minimum or maximum deck size."
  - Tests: `packages/engine/src/wave2.test.ts`.
- **Ownership (§3.10).** RRG 1.8 "Ownership and Control" (p. 31): "When a player takes control of a campaign-specific or scenario-specific player card [...] with a player card back, that player becomes the owner of that card until the game ends or another player takes control of that card."

### 1.5 Double-sided player cards

- **`PlayerCardCommon.flipSide?: CardFlipSide`**, the same shape as an encounter card's flip side, renamed `CardFlipSide` (`EncounterCardFlipSide` remains as an alias).
  - Cycle 1 users: the campaign "Basic X Upgrade" / "Improved X Upgrade" pairs (04159a/b–04162a/b).
  - Later packs need the same field: Phoenix Force, Psi-Knife / Psi-Katana, Solid / Phased, the Spider-Man campaign's gadgets.
  - A back face of a different card type is still not modeled (NeXt Evolution's player side schemes flip to environments).
- **Engine, landed:** `abilityRefsOf` includes `flipSide` abilities for every card type, encounter cards included, where it used to miss them.
- **Care point:** the engine already treats any card with `flipSide` as double-sided. `effects.ts` removes it from the game when it leaves play (RRG 1.8 "Double-Sided Card", p. 17), and `query.ts` reads the face. This is right for these cards, but it must be verified before one is made playable.

### 1.6 Main scheme stages: alternatives and dashed values (Kang)

- **Alternative stages.** Stages that share a `stageNumber` are alternatives, not a sequence, and each must be told apart by `stageLetter` or `name` (new validator rule).
  - Kang's four stage 3 cards are The Chronopolis, Inexorable Fate, The Realm of Rama-Tut and The Present Future War.
  - The Master of Time 2A: "Each player reveals a random stage 3A in turn order. Remove any unused stage 3 schemes from the game."
  - Kang's main scheme deck is one `MainSchemeCard` with stages 1, 2, 3 ×4 and 4.
  - **The default "advance to the next stage" into a group of alternatives is undefined.** A card ability must say which stage (§3.1).
- **`MainSchemeStage.dashedValues?`**, the main scheme counterpart of `VillainStage.dashedStats`, each value held at `{ base: 0, perPlayer: 0 }`.
  - The Master of Time 2B (11008b) prints no starting threat, target threat or acceleration: "When all the players have joined this game area, advance to stage 4A."
  - MarvelCDB encodes this as the `*_fixed` flags with no values; the survey reports it as "main scheme missing starting/target/acceleration threat".
  - A value may not be both dashed and `printedX`.
  - **Curation must confirm the dashes from the card image.**
- **Engine: data only** (§3.1).

### 1.7 "Attach to X, if able. If you cannot, attach to the villain."

- **`AttachmentHost { kind: "ifAble"; preferred; otherwise }`.** Neither half may itself be `ifAble`.
- **Cards:**
  - Size Increase (12028), Beetle Armor MK IV (13029) and Vibration Resistance (14027): "if able. If you cannot";
  - Crossfire's Rifle (04029): "Attach to Crossfire. Otherwise, attach to the villain."
- **Engine, landed** (`resolve/reveal.ts`): `preferred` is tried first, and `otherwise` only when `preferred` has no legal candidate, both evaluated when the card would be attached (RRG 1.8 "Attach To", p. 8).
  - Without this case, the kind would have fallen through to the default and silently found no host.
  - Tests: `packages/engine/src/wave2.test.ts`.

### 1.8 Scenario data: set-aside villains, expert villains, victory, separate game areas, separate decks

New `Scenario` fields, each validated as enums the way `MultipleVillains` is:

- **`setAsideVillainCardIds?`**
  - Kang insert, "Setup": "stage 1A instructs the players to set each copy of Kang (II) and Kang (III) aside. This means that Kang (I) is the only villain in the villain deck at the beginning of the game. Kang (II) and Kang (III) will enter play through the card effects on main schemes 3A and 4A."
  - **Each Kang card is its own one-stage `VillainCard`.** The four Kang (II) cards have different titles and are not a sequence, and Kang (I) and Kang (III) share a title but are not consecutive either.
  - This resolves the survey's "villain set kang: stage names differ".
- **`expertVillains?: { villainCardId; setAsideVillainCardIds }`.** Kang insert, "Adjustable Difficulty": "To play the scenario in expert mode, replace all six villains in the Kang encounter set with the six villains from the Expert Kang set and add the Expert encounter set to the encounter deck."
- **`victory?: "finalVillainStage" | "cardAbility"`**, where absent means `finalVillainStage`.
  - RRG 1.8 "Villain Defeat" (p. 47): "If the final stage of the villain deck is defeated, the players win the game."
  - Kang insert: "The players must defeat Kang (I), Kang (II), and Kang (III) in order to win the game."
  - Kang (I) is alone in the villain deck ("When Defeated: Advance the main scheme to stage 2 at the end of the phase."), and Kang (III) says "When Defeated: The players win the game."
  - Scenario rules override the RRG (Golden Rules, p. 4). Flagged in §4.
- **`separateGameAreas?: SeparateGameAreas`**, whose fields quote the Kang insert, "Playing With Separate Game Areas" and "Rules Clarifications", and FAQ "The Once and Future Kang Scenario Pack" (RRG 1.8 p. 60). See §3.1 for what each means.
- **`separateDecks?: ScenarioSeparateDeck[]`**: `{ name, contents: { encounterSetIds?, cardType? }, discardPile: "own" | "encounter", whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty" }`.
  - **Experimental Weapons** (Crossbones), Red Skull rulebook p. 5: "take all four cards in the Experimental Weapons encounter set, shuffle them together, and set them facedown next to the main-scheme deck. [...] After a card from the Experimental Weapons deck enters play, it is considered to be part of the encounter deck. When that card is discarded, it is placed in the encounter deck discard pile."
    - This gives `discardPile: "encounter"`, `whenEmpty: "remainsEmpty"`.
  - **The side-scheme deck** (Red Skull), Red Skull rulebook p. 15: "search the encounter deck for each side scheme and shuffle them together into their own deck [...] The side-scheme deck has its own discard pile. [...] If the side-scheme deck is ever empty, shuffle the side-scheme discard pile into the side-scheme deck. There is no penalty for doing this."
    - Errata (RRG 1.8 p. 66, #128A): "Shuffle every other *encounter* side scheme".
    - This gives `contents: { cardType: "side_scheme" }`, `discardPile: "own"`, `whenEmpty: "reshuffleDiscardWithoutPenalty"`.
  - **Built by the main scheme's 1A `Setup:`**, which moves the matching cards out of the encounter deck built at Appendix II step 10. The engine never builds these decks on its own.
  - The Crossbones rulebook page lists "Experimental Weapons set" among the encounter sets, so it belongs in `Scenario.encounterSetIds`.
- **Engine: data only** (§3.1, §3.3, §3.4).

### 1.9 Play restrictions

- **`PlayRestrictions.maxPerPhase`**: "Max 1 per phase." (Maximum Velocity, 14005). RRG 1.8 "Max, Maximum" (p. 28) with the phase as the period. Data only (§3.5).
- **"Max 1 per deck." with `deck_limit` 4** (Always Be Running, Hex Bolt) needs nothing new. Identity-set cards were already exempt from the three-copy rule (the Black Panther precedent, `deck.ts`).

### 1.10 Obligations: every copy (engine only)

- **Every copy of the identity's obligation is now shuffled in.** Scarlet Witch's set holds two copies of Slipping Sanity (15023, `quantity: 2`). FAQ "Slipping Sanity (#23)" (RRG 1.8 p. 61): "Is it intentional that Scarlet Witch has two obligation cards? A: Yes."
  - RRG 1.8 "Obligation" (p. 30): "Each identity is associated with one or more obligation cards. If an identity is being played, all of that identity's associated obligation cards are shuffled into the encounter deck during setup."
  - Before this change, `createGame` created one instance whatever `quantityInSet` said.
- **Core and wave 1 are unchanged:** every obligation there has quantity 1, so instance ids and RNG order are unchanged.
- Appendix II step 4 (p. 51) says "their obligation card", in the singular. The glossary entry is more specific and is followed here.
- Tests: `packages/engine/src/wave2.test.ts`.

### 1.11 Keywords

Cycle 1 prints Incite X, Permanent, Piercing, Ranged, Setup, Villainous and Team-Up, plus Core keywords. Every one has a `KeywordInstance` shape already, and `keywords.ts` records this.

Printed keyword lines, verbatim with HTML removed (the parser must accept each):

| Keyword | Printed forms | Cards |
|---|---|---|
| Incite | `Incite 1.`, `Incite 2.` | 04056, 04069, 04106, 04121, 04135, 04152, 11029, 11046, 11048, 14025, 14028; 14026 |
| Villainous | `Villainous. (When this minion activates, give it a boost card.)` | 11041, 11047 |
| Permanent | `Permanent. Setup.` on one line | 04159a/b–04162a/b |
| Setup (keyword) | `Setup.` | 04155–04158, 04159a/b–04162a/b |
| Team-Up | `Team-Up (Ant-Man and Wasp). Max 1 per deck.` and `Team-Up (Quicksilver and Scarlet Witch). Max 1 per deck.` on one line | 12020, 13020; 14018, 15018 |
| Toughness | `Toughness.`, and bare `Toughness` without a period (11001) | 04020, 04114, 04130, 04131, 11001–11006, 11032, 11034–11039, 11041, 11047 |
| Retaliate | `Retaliate 1.` (with `Toughness.` on the same line on 11003, 11036) | 04014, 04109–04111, 04130, 11003, 11017, 11036, 11042 |
| Guard | `Guard.`, and `Guard.(While …` without a space (04153) | 04130, 04153, 11017, 11042, 13028 |
| Quickstrike | `Quickstrike.` | 04027, 04116, 04146, 11030, 11043 |
| Surge | `Surge.`; `Incite 1. Surge.` on one line (11048) | 04080–04083, 11028, 11048 |
| Uses | `Uses (3 attack counters).`; `Uses (3 counters).` (12028, a suspected data error, §5) | 04042, 12028 |

- **Piercing and Ranged are never printed as keyword lines in cycle 1.** They are always granted: "gains piercing" / "gain piercing" (04009, 04012, 04027, 04044, 04058–04060, 04102, 04148, 11005, 11032, 11038, 11043, 13008, 14029) and "gains ranged" / "gain ranged" (04002, 04020, 04029, 04072, 04149; with piercing: 04101, 04132).
- **Other granted keywords:** "gains retaliate 1" (04073, 04103, 04118, 04133, 13008), "gains guard" (04117), "gains overkill" (11015, 13004), "gains surge" (04085, 04117–04119, 04150, 11026, 11027, 13030).
- **`Setup:` as an ability** appears on every main scheme 1A. Only the campaign cards print the keyword.

---

## 2. Per-pack setup needs, standalone

RRG 1.8 Appendix II (p. 51) with the wave 1 engine. Step 13, "Campaign Setup", is skipped: no scenario is played in campaign mode.

### 2.1 Hero packs

| Pack | Identity | Obligation | Nemesis set (nemesis minion in bold) | Other setup and legality |
|---|---|---|---|---|
| `trors` | Hawkeye / Clint Barton (04001a/b) | Criminal Past (04026) | **Crossfire** (04027), Marked for Death, Crossfire's Rifle, Sniper Shot ×2 | none. Precon: Leadership (Red Skull rulebook p. 18). |
| `trors` | Spider-Woman / Jessica Drew (04031a/b) | Uncertain Loyalties (04053) | **The Viper** (04054), The Viper's Ambition, Hydra Regular ×2, Hail Hydra! | Two aspects, equal split (§1.2). Precon: Aggression + Justice, 15 + 11 + 11 + 3 basic resources (p. 18). |
| `ant` | Ant-Man / Scott Lang (12001a/b/c) | Care for Cassie (12025) | **Yellowjacket** (12027), Tech Theft, Size Increase ×2, Yellowjacket's Plan | Three-sided (§1.1). Precon: Leadership (insert). |
| `wsp` | Wasp / Nadia Van Dyne (13001a/b/c) | Red Dreams (13026) | **Beetle** (13028), Mother's Orders, Beetle Armor MK IV, Beetle Mania ×2 | Three-sided (§1.1). Precon: Aggression. |
| `qsv` | Quicksilver / Pietro Maximoff (14001a/b) | Need for Speed (14024) | **Avalanche** (14026), Extortion of Seismic Proportion, Vibration Resistance, Earthquake ×2 | Precon: Protection. |
| `scw` | Scarlet Witch / Wanda Maximoff (15001a/b) | Slipping Sanity **×2** (15023; §1.10) | **Luminous** (15025), The Next Evolution, Magical Suspension, Chaos Manipulation | Precon: Justice. |

- **Nemesis sets hold other minions too:** Hydra Regular with The Viper, just as wave 1's did (docs/phase7-wave1.md §1.7). Curation sets `nemesisMinion` only on the named minion.
- **Same title, different codes.** Hydra Regular (04056, nemesis; 04152, Hydra Patrol) and Hail Hydra! (04057, nemesis; 04147, Hydra Assault) are each one card by title printed in two sets (RRG 1.8 "Copy", p. 13). The errata for Hail Hydra! applies to both (#57, #147).
- **Unique rule.** The Ant-Man ally (12011) and the Ant-Man identity don't match (RRG 1.8 "Unique Icon", pp. 45–46): the ally is bare, and the identity's alter-ego title is Scott Lang. Ruling, Jan 26, 2026 (ruling 4, answer 7) settles Valkyrie the same way. The same holds for the Wasp ally (13012) and the Wasp identity.
- **Precons** come from the printed decklists: the Red Skull rulebook p. 18 for Hawkeye and Spider-Woman, and each hero pack's insert for the others (Hall of Heroes' "Starter Deck" links). They follow wave 1's provenance discipline.

### 2.2 The Rise of Red Skull scenarios

Each scenario's villain deck is I–II standard and II–III expert. Each rulebook page reads "Remove [villain] (I) and add [villain] (III) for expert mode." The modular sets come from each 1A "Contents", with errata.

| Scenario | Main scheme deck | Encounter sets (required) | Modular (count) | 1A Setup | Needs |
|---|---|---|---|---|---|
| Crossbones | Attack on Mount Athena → The Infinity Stone → The Getaway (3B loses) | Crossbones, Experimental Weapons, Standard | Hydra Assault, Weapon Master, Legions of Hydra (3; errata #61A) | "Create the Experimental Weapons deck" | §1.8 / §3.3 separate deck; Crossbones III "Reveal the top card of the Experimental Weapons deck" |
| Absorbing Man | None Shall Pass (single stage; 1B loses) | Absorbing Man, Standard | Hydra Patrol (1) | "Discard cards from the encounter deck until an environment is discarded. Put that card into play and shuffle the encounter discard pile into the encounter deck." | Environments with Surge enter without surging (Red Skull rulebook p. 7: "Putting a card into play is not the same as revealing a card."); delay counters; "gains the trait of each environment" (§3.11) |
| Taskmaster | Hunting Down Heroes (single stage) | Taskmaster, **Hydra Patrol**, Standard | Weapon Master (1) | "Set each Captive ally aside out of play. Search the encounter deck for Hydra Patrol and put it into play." | Captive allies set aside (§3.10, §4.5). Rulebook p. 10: "The Hydra Patrol set [...] is required when playing Taskmaster." |
| Zola | The Island of Dr. Zola → The Mad Doctor | Zola, Standard | Under Attack (1, Core) | "Search the encounter deck for Hydra Prison and reveal it. Each player searches the encounter deck for a copy of Ultimate Bio-Servant and puts it into play engaged with them." | Hydra Prison tucks player allies facedown (§3.10) |
| Red Skull | The Rise of Red Skull → New World Hydra | Red Skull, Standard | Hydra Assault, Hydra Patrol (2) | "Put the Red House into play. Shuffle every other encounter side scheme into the side-scheme deck [...] Set The Sleeper aside, out of play." (errata #128A) | §1.8 / §3.3 side-scheme deck; 1B/2B "reveal the top card of the side-scheme deck and put it into play" |

- **Rulebook clarification, Taskmaster (p. 10).** When Shadow of the Past would bring in a nemesis minion with the same title as an enemy in play, "Your nemesis minion cannot enter the game [...] However, you still reveal your nemesis' side scheme and shuffle the rest of your nemesis's set into the encounter deck. This will cause Shadow of the Past to gain surge." This follows from the existing unique rule; pin it with a test when Taskmaster is scripted.
- **Campaign instructions on every rulebook page are skipped.** That covers the Experimental attachments shuffled in, persistent damage and the rest.

### 2.3 The Once and Future Kang

- **Villains.** Kang (I) alone in the villain deck. Set aside: Kang (Immortus), Kang (Iron Lad), Kang (Rama-Tut), Kang (Scarlet Centurion) and Kang (III) (§1.8).
  - Expert mode uses the Expert Kang set (11034–11039) instead, plus the Expert encounter set.
  - Kang (II) hit points are flat (18 standard, 22 expert), because each fights one player's game area.
- **Main scheme deck.** Kang's Arrival (1) → The Master of Time (2; dashed values) → one random stage 3 per player (4 alternatives) → Kang's Wrath (4).
- **Encounter sets.** Kang, Standard (plus Expert), and one modular set: Temporal is recommended. Master of Time or Anachronauts can replace it (insert, "Modular Encounter Sets").
- **1A Setup.** "Set each Kang (II), Kang (III), and Kang's Dominion side scheme aside. remove each player's obligation cards from the game. Shuffle the encounter deck."
  - **The identities' obligations are removed; their nemesis sets are not.** Kang's Wrath 4B searches for each player's nemesis minion. `usesIdentityEncounterSets` stays true, and the removal is the 1A script's.
  - The Kang set has its own Temporal obligations (11018–11021), which are ordinary encounter cards.
- **The whole scenario depends on §3.1 (separate game areas).** It cannot be played until that lands.
- **FAQ (RRG 1.8 p. 60):** "While the players are split into separate game areas, whose game area are environment cards considered to be in? A: Environment cards are considered to be in all players' game areas."

---

## 3. Engine primitive gaps for cycle 1 (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names below say where each primitive is needed.

**Priority order:**
- **First, state-shape changes** that would force scripts to be rewritten if they came later: §3.1–§3.4.
- **Then primitives many cards share:** §3.5–§3.10.
- **Last, the vocabulary tail:** §3.11–§3.12.

A pack whose cards need an unbuilt primitive stays data only.

### 3.1 Separate game areas (The Once and Future Kang)

> **Status: landed (2026-09-18),** tested in `packages/engine/src/game-areas.test.ts` with a synthetic Kang-shaped scenario driven through the real flow and replayed deep-equal.
>
> - **State.** `GameState.gameAreas: GameAreaState[]` (empty while unsplit): each area has `playerIds`, its own `mainScheme` (an instance of the main scheme card at one alternative stage, null once removed), `villainIds` with `activeVillainId`, `sideSchemeIds` and `formerSchemeIds`. `GameState.mainScheme` stays the central (or only) stage. Also `spentMainSchemeStages`, `revealedMainSchemes`, `nextGameAreaSeq`, and `scenarioRules { victory, separateGameAreas }`.
> - **Where a card is.** `areaOfCard` / `areaOfPlayer` (`query.ts`): a player's cards and engaged minions are in that player's area, attachments follow their host, an area's scheme, villains and side schemes are in it. Everything else (environments, the central stage, decks, set-aside cards) is in every area.
> - **Isolation in one place.** `contextArea` / `inContextArea` (`select.ts`): `explainQuery` rejects a card in another area (`otherGameArea`), so targeting, `count` values, constant modifiers and keyword or trait grants all respect it. "The villain", "the main scheme" (`{ of: "central" }` for the central one) and "each player" resolve in the context's area. Basic attacks and thwarts are refused across areas. Crisis and acceleration icons count per area. The unique rule is per area (`matchingCardInPlay` takes the entering player).
> - **Villain phase.** Step 1 places threat on each area's own stage. The central stage's acceleration tokens add to every area's step 1, per §4.3's proposed reading. Each player's activation uses their area's villain, and a villain with no successor doesn't activate.
> - **New effects:** `revealMainSchemeStage` (random unspent alternative per player, in player order, `removeUnused`), `createGameArea`, `joinGameArea` (merge into another area, chosen by the joining players' first when there are several, or dissolve into the centre when none remain; duplicate unique cards are then discarded, the first player choosing), `removeMainSchemeStage`, `completeMainScheme`, `atEndOfPhase`. **New predicates:** `gameAreasSplit`, `areaPlayersDefeated`. **New trigger event:** `mainSchemeCompleted` (an area's stage, or a stage whose next is a group of alternatives, completes without advancing or losing).
> - **Not done:** hazard icons still deal from the whole table's count; the client shows only the central scheme (`board-model.ts` reads `state.mainScheme`); the Kang cards themselves are unscripted (`ability-scripting-engineer`).

**Rules** (Kang insert; each is a `SeparateGameAreas` field, §1.8):
- "Cards and components in one game area cannot affect another game area (with the exception of the text on stage 2B). Players cannot attack or defend enemies in other game areas, and they cannot target any game elements in the other game areas."
- "they continue to use the same encounter deck and encounter discard pile. Play still proceeds in turn order, and the first player token is still passed to the next player at the end of the villain phase."
- "'Each player' refers to each player in the same game area."
- "a unique card in one game area places no limitations on the others. When players combine game areas, they must discard copies of unique cards until only one of each remains in that game area. If the players cannot agree which one to discard, the first player decides."
- Joining: "choose a game area [...] Any side schemes that were in play in your previous game area become part of the game area that you join. Any minions that were engaged with you remain engaged with you."
- Stage 2B "remains in play in a central location and its text remains active for all players, though it is not part of any other game area."
- Status cards and attachments on a defeated Kang don't transfer, because there is no next villain in the villain deck (insert, "Rules Clarifications").

**State:**
- `GameState.gameAreas: { areaId, playerIds, villainIds, mainScheme: MainSchemeState, sideSchemeIds, villainArea }[]`, or a single implicit area when the scenario has none.
- `areaOf(instance)` for every in-play card.
- The central stage is a main scheme instance outside every area.
- **Several main scheme instances at once** (one stage 3 per area, plus 2B centrally). `GameState.mainScheme` becomes per-area. That is the largest reader change since `state.villains` in wave 1.

**Resolution:**
- **Area-relative lookups.** "The villain", "the main scheme", "each player", "first player choices" and targeting all resolve inside the resolving card's area. Environments are in every area (FAQ p. 60), and so is the central stage.
- **Villain phase.** Each area runs step 1 (threat on its own stage 3) and its villain's activations.
- **Stage-scoped effects:**
  - "When all the players have joined this game area, advance to stage 4A";
  - "If all the players at this stage are defeated, this stage is complete";
  - "At the end of the phase, join another game area";
  - "remove Kang (…) and this stage from the game and combine your game area with another".
- **Acceleration tokens and 2B's redirect:** see §4.
- **Villain defeat.** Defeating a Kang (II) doesn't win (`victory: "cardAbility"`), and there is no next stage.

**Also needed:**
- **Tuck facedown under a main scheme stage not yet in play.** "place 1 set-aside Kang's Dominion facedown under stage 4A", then 4A: "Reveal each face down Kang's Dominion under this stage."
- **"Add Kang (Immortus) to the game area"** from the set-aside villains (§3.4).

**Tests:**
- 4 players each reveal a random stage 3 in turn order, and unused ones are removed from the game;
- area isolation for targeting, attacks and defense;
- "each player" is per area;
- the unique rule is per area, and combining discards duplicates with the first player deciding;
- environments affect every area;
- the shared encounter deck and discard pile;
- 2B redirects acceleration tokens;
- joining moves side schemes and engaged minions;
- advancing to 4A when every player has joined;
- winning only on Kang (III);
- replay deep-equal.

### 3.2 Three-sided identities

> **Status: landed (2026-09-18),** tested in `packages/engine/src/three-sided.test.ts`.
>
> - `IdentityState.heroFormIndex: number | null` (null in alter-ego); `identityFace` (`query.ts`) is the one reader of the face that is up, for stats, traits, keywords, abilities and hand size.
> - Command: `changeForm { to?: "alterEgo" | { heroForm } }`. From alter-ego a three-sided identity must name the face, and `legalActions` offers one action per reachable form. A hero-to-hero change uses the voluntary change (§4.6, proposed).
> - Effect: `changeForm { heroForm?: { withTrait } | "other" }`. Going to hero form with several faces and none named asks the player (`chooseOption`); an effect never uses the voluntary change.
> - `formChanged` carries `fromHeroFormIndex` / `heroFormIndex` (trigger event: `fromHeroForm` / `toHeroForm`) only for a three-sided identity, so every other identity logs as before. "After you change to this form" needs nothing new: only the face that is up is live.
> - **Not done:** a `cardFlipped` announcement for an identity (RRG 1.8 "Flip" counts a form change as a flip); no cycle 1 card needs it.

**Rules:** see §1.1.

**State:** `IdentityState.heroFormIndex: number | null`, where `null` is alter-ego form, 0 is `hero`, and `n` is `additionalHeroForms[n-1]`. Keep `form: "hero" | "alterEgo"` so existing readers work.

**Resolution:**
- **Reading the face.** `characterProfile`, traits, keywords, hand size and `activeAbilityRefs` read the face that is up.
- **The command.** `changeForm` gains `to?: { heroForm: number } | "alterEgo"`, and `legalActions` offers each reachable face.
  - **Reading:** a voluntary hero-to-hero change uses the once-per-round change, since the insert applies "the standard rules for changing form". See §4.
  - A change caused by a card doesn't use it (insert, "Rules Clarifications").
- **The event.** `formChanged` gains `fromFace` / `toFace` so that "After you change to this form" fires only for its own face.
  - It is a flip (RRG 1.8 "Flip", p. 20), so abilities that trigger on flipping see it.
- **Effects:**
  - "Change to your other hero form" (Resize, Swarm Tactics);
  - "change to your Giant hero form" (Rapid Growth, as an interrupt to a basic power, with +2 to that power for this use).
- **Limits persist across faces.** Ruling Jan 26, 2026 (ruling 6, answer 2): "Limits apply to cards. An identity never leaves play when flipping."

**Cards:**
- the Ant-Man and Wasp identities; Resize, Swarm Tactics, Rapid Growth;
- Moxie, Lay Down the Law, Surprise Attack, Perseverance ("After you change form");
- Ant-Man's Helmet, Giant Strength, Wrist Gauntlets, Pym Particles, Army of Ants, Red Room Training, Wasp's Helmet, Bio-Synthetic Wings, Giant Help, Pinpoint Strike, Wasp Sting;
- Wasp ally (12002), Ant-Man ally (13002), Yellowjacket (12027) — "While you are in [Giant] hero form".

**Tests:**
- alter-ego to each hero form;
- hero to hero;
- the voluntary limit;
- damage and statuses retained;
- per-face responses;
- per-face hand size at end of phase;
- replay.

### 3.3 Scenario separate decks and set-aside scenario cards

> **Status: landed (2026-09-18),** tested in `packages/engine/src/scenario-decks.test.ts`.
>
> - `GameState.scenarioDecks` (name → deck, discard, and the `ScenarioSeparateDeck` rules), zones `scenarioDeck` / `scenarioDiscard`, `CardHome { kind: "scenarioDeck" }`; `GameSetupConfig.scenarioDecks` (each starts empty) and `GameSetupConfig.setAside` (scenario cards created in `encounterSetAside`; a player card among them has no owner yet).
> - `EffectSpec buildScenarioDeck { name }` moves the matching encounter-deck cards (its sets and/or its card type, both must match when both are given) and shuffles. `CardSelector scenarioDeck { name, zones?, top?, filter? }` for "reveal the top card of …".
> - Discards: a `discardPile: "encounter"` deck's cards keep their encounter home, so they go to the encounter discard; `"own"` rehomes them to the deck's discard. `reshuffleDiscardWithoutPenalty` resets between frames with no acceleration token and logs `scenarioDeckReset`; `remainsEmpty` stays empty. §4.7's proposed reading holds: only cards of the deck (by `home`) go to its discard.

**Rules:** see §1.8 (Experimental Weapons, the side-scheme deck).

**State.** Generalize wave 1's `PlayerState.separateDecks` (docs/phase7-wave1.md §3.5) to a scenario-owned `GameState.scenarioDecks` with the same zone kinds and `CardHome { kind: "scenarioDeck"; name }`.

**Resolution:**
- `EffectSpec buildScenarioDeck { name }`, run by 1A's script, moves the matching cards out of the encounter deck and shuffles them.
- `CardSelector scenarioDeck { name, top? }` serves "Reveal the top card of the …deck".
- Discards follow `discardPile`:
  - `encounter`: the card's home becomes the encounter deck when it enters play ("considered to be part of the encounter deck");
  - `own`: it goes to that deck's discard.
- Reuse the Invocation reshuffle for `reshuffleDiscardWithoutPenalty`.

**Set aside at setup.** A `GameSetupConfig.setAside` list of scenario cards that start out of play: Captive allies, The Sleeper, Kang's Dominion ×4, and the set-aside villains of §3.4.
- RRG 1.8 "Scenario-Specific Card" (p. 38) lists the encounter deck as "attachment, environment, minion, side scheme, and treachery cards", so the Captive allies need never enter it (§4.5).

**Tests:**
- Crossbones III reveals from the Experimental Weapons deck, and a discarded Experimental attachment goes to the encounter discard;
- the side-scheme deck reshuffles its own discard with no acceleration token;
- stage 1B reveals and puts into play from the side-scheme deck;
- an empty Experimental Weapons deck reveals nothing.

### 3.4 Villain decks beyond one sequence

> **Status: landed (2026-09-18),** tested in `packages/engine/src/game-areas.test.ts` (and `wave2-later-packs.test.ts` for `changeVillainForm`).
>
> - Setup: `GameSetupConfig.setAsideVillainCardIds` (villain instances created in `encounterSetAside`), `victory`, `separateGameAreas`; `villainsForDifficulty(scenario, difficulty)` applies `expertVillains` for the scenario builder.
> - `victory: "cardAbility"` turns off the RRG p. 47 win. Effect `endGame { result }` ("The players win the game", or a When Completed "the players lose the game"), logged with the existing reasons `villainDefeated` / `mainSchemeCompleted` so the client's outcome text stays right.
> - **Villain When Defeated now fires** (it never did): `defeatVillainStage` resolves the defeated stage's `whenDefeated` abilities after the defeat's bookkeeping. No Core or wave 1 script used one, and every existing test passes.
> - Effects `addVillain { villain, reveal? }` (a set-aside villain enters play; in an area it becomes that area's villain) and `removeVillain` (removed from the game, not defeated).
> - `advanceMainScheme { to?: { stageNumber, name? }, scheme? }`. The default advance is now "the one stage with the next stage number", and into a group of alternatives it does nothing (§1.6). A completed stage whose next stage is a group of alternatives is marked completed and announces `mainSchemeCompleted` instead of advancing.
> - `dashedValues` read as an unmodifiable 0 (`mainSchemeValue`), and a dashed target threat never completes.

**Resolution:**
- **Setup:**
  - `setAsideVillainCardIds` become set-aside villain instances;
  - `expertVillains` substitutes in expert mode;
  - `victory: "cardAbility"` disables the RRG p. 47 win.
- **Effects:**
  - "Add [villain] to the game area" (3A) and "Reveal Kang (III) and add him" (4A): a set-aside villain enters play as an additional villain, reusing wave 1's `villains` list;
  - "Advance the main scheme to stage N at the end of the phase": a delayed, explicit-target advance, needed because of the alternatives (§1.6);
  - "Remove [stage] from the game".
- **Main scheme values** read `dashedValues` as unmodifiable 0, and a dashed target threat never completes.

**Tests:**
- Kang (I) defeated doesn't win and advances to stage 2 at the end of the phase;
- expert substitution;
- a dashed-value stage never completes by threat;
- Kang (III) defeated wins.

### 3.5 Play restrictions: Team-Up, max per phase, the ally limit

> **Status: landed (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - Team-Up's play half in `playRestrictionFault`: every friendly character's title (an identity's face that is up; an ally's title and subtitle).
> - `GameState.playedThisPhase`, reset when each phase ends; `maxPerPhase` checked like `maxPerRound`.
> - `RuleSpec excludedFromAllyLimit { target }`, read by the ally-limit check.

- **Team-Up's play half.** RRG 1.8 "Team-Up" (p. 43): "You cannot play this card unless there is a friendly character in play whose title or subtitle matches name 1 and a friendly character in play whose title or subtitle matches name 2." The Ant-Man insert says the same: "(hero or ally)".
  - Cards: Swarm Tactics ×2, Order and Chaos ×2.
  - Check it in `playRestrictionFault`, reading the identity's current face title.
- **`maxPerPhase`** is counted like `maxPerRound` (docs/phase7-wave1.md §3.10) and reset at each phase end. Card: Maximum Velocity.
- **An ally that doesn't count against the ally limit** (Stinger: "Stinger does not count against your ally limit.").
  - RRG 1.8 "Ally Limit" (p. 7): the check "occurs before abilities that resolve upon entering play".
  - Model: a constant `RuleSpec excludedFromAllyLimit { target: self }` read by `checkAllyLimits`.

### 3.6 Counting boost icons as an event (Scarlet Witch and many encounter cards)

> **Status: landed for activation counts (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - The boost procedure gains a `count` step. A `boostIconsCounting { enemyInstanceId, cardInstanceId, playerId }` event with an interrupt window is pushed there only when an ability could react, so Core's event order is unchanged.
> - `EffectSpec adjustBoostCount { delta }` (Crest, this count only, floored at 0) and `replaceBoostCount { card }` (Chaos Control, count that card instead).
> - The `boostIcons` value now reads `boostIconsFor` (printed plus modifiers), like every other count. The Next Evolution's constant "+1 on each encounter card" is an existing `boostIcons` stat modifier.
> - **Not done:** counts made by card effects (Hex Bolt, Taskmaster's `discardEncounterCards` totals) have no window; §4.8 is still open. Star icons in the boost area (Slipping Sanity) have no value spec yet.

**Rules and cards:**
- **Counting discarded cards' icons.** "discard the top card of the encounter deck … take damage equal to the number of boost icons on that card", on Taskmaster I–III, Crossbones' Machine Gun, Full Auto, Cornered Staff, Chitauri Soldier, Luminous, Chaos Manipulation, Wiccan, the Scarlet Witch ally, Hex Bolt and Molecular Decay.
- **Replacing a count.** Chaos Control (15001a): "When boost icons on an encounter card would be counted, discard the top card of the encounter deck and count the number of boost icons on that card instead."
- **Modifying one count.** Scarlet Witch's Crest: "increase or decrease the number of boost icons on that card by 1 for this count."
- **A constant modifier.** The Next Evolution: "Increase the number of boost icons on each encounter card by 1."
- **Star icons, not boost icons.** Slipping Sanity: "For each star icon ([star]) in the boost area". RRG 1.8 "Boost" (p. 11): "A star icon is not itself considered a boost icon."
- **Order of Hex Bolt.** FAQ "Hex Bolt (#4)" (RRG 1.8 p. 61): "resolve the first sentence of Hex Bolt entirely, without interruption. Then, determine and resolve the appropriate bulleted abilities based off of what was discarded."

**Model:**
- **One counting function** that every read goes through: the boost step of an activation (`boostIconsFor`, `modifiers.ts`) and `<bind>.boostIcons` on discard effects.
- **An interruptible `boostIconsCounted { cardInstanceId, reason }` event.** It sits before the value is fixed, so a replacement (Chaos Control) or a per-count modifier (Crest) applies.
- **A `boostIcons` modifier** that may target every encounter card (The Next Evolution), not only the boost card's own constant.
- **Open (§4.8):** whether Chaos Control's "would be counted" reaches counts made by card effects, or only a boost card's.

### 3.7 Divided damage and threat removal, and basic powers with several targets

> **Status: landed (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - `EffectSpec divide { what: "damage" | "threat", amount, among, chooser, bind? }` with a `divide` choice (options `<id>#<n>`). Damage resolves as one damage group; threat is removed per scheme in the order chosen. A single candidate takes it all.
> - `RuleSpec divideBasicPower { power, target }` and `basicAttack.divide` / `basicThwart.divide` (`BasicPowerShare[]`): shares total the power, targets are distinct and all checked at declaration (guard, area, crisis), and one attack or thwart event per target in the given order, so each retaliate hits in the attacker's order (FAQ "Wasp (#1C)").
> - `chooseOne { count, allowRepeat }`: one ordered choice; with `allowRepeat` each option is offered `count` times.
> - **Not done:** `legalActions` doesn't enumerate divided basic powers (the command is accepted; a client needs a picker).

**Rules and cards:**
- **Wasp's Giant constants.** "Threat you remove using your basic thwart power (THW) can be divided among schemes as you choose." and the same for damage with ATK.
- **FAQ "Wasp (#1C)" (RRG 1.8 p. 61):**
  - the thwart "simultaneously remove[s] threat from each scheme that Wasp chooses. Wasp cannot choose the main scheme as a target while she is engaged with a minion with the patrol keyword or there is a card with a crisis icon in play [...] this applies even if the card [...] is removed from play during her basic thwart's resolution";
  - Guard is handled the same way;
  - "Wasp is considered to attack each target affected by her divided basic attack. [...] each instance of retaliate will damage Wasp (in the order of her choice)."
- **Divided events:** Inconspicuous ("Remove a total of 3 threat from among schemes in play"), Giant Help, Wasp Sting ("deal a total of 4 damage divided among enemies you choose").
- **Choosing options twice:** Double Time ("Choose two of the following (you may choose the same option twice)").

**Model:**
- **One division choice.** A `divide { amount, among: TargetQuery }` choice, then simultaneous resolution. Reuse wave 1's `damageGroup` frame (§3.7 there) and add a threat-removal group.
- **Legality is fixed when targets are chosen,** per the FAQ.
- **A basic power with several targets** produces one `attack` event per target and one retaliate each, in an order the attacker picks.
- **Choosing an option twice.** `chooseOptions { count, allowRepeat }`. RRG 1.8 "Choose (Option)" (p. 12) forbids repeats "when a card requires a player to choose multiple options", unless the card says otherwise.

### 3.8 Payment: overpaying, X costs, ignoring cost, playing inside an ability

> **Status: landed except the in-ability reduction (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - `playCard.x`: a cost printed X costs the chosen X before modifiers; the play's var `x`. Refused for any other card.
> - A dash cost is refused (`card_type_not_playable`).
> - Overpaying was already accepted. Plays now bind `overpaid.total` and `overpaid.<type>` (the most of that type that can be the excess, a wild counting as any), and `paid.*`, `overpaid.*` and `x` reach the card's own abilities while it is being played, which also fixes the Valkyrie gap PLAN.md records.
> - `EffectSpec playFromHand { player, ignoreCost: true, filter?, optional? }` (Chaos Magic): play restrictions apply; never a Requirement card or a dash cost; `paid.*` all 0.
> - **Landed later (§9):** playing a card inside an ability with a reduction (Team-Building Exercise) — `playFromHand.costReduction`, which also covers an event with a cost of its own and an upgrade with its own host.

**Rules and cards:**
- **Overpaying.** Ant-Man ally (12011): "place 1 pym counter on him (to a maximum of 4) for each resource you overpaid for Ant-Man's cost". Wasp ally (13012) counts [energy] only.
  - RRG 1.8 "Cost" (p. 13): "While paying a cost, a player is permitted to generate resources beyond the specified cost. Resources generated beyond the specified cost are considered to have been overpaid for that cost and were not paid for that cost."
  - Model: `payment.overpaid` (by type) recorded on the `cardPlayed` / `cardBeingPlayed` event, and `legalActions` allowing a payment larger than the cost for such a card.
  - Today's payment model refuses to overpay; if it accepts overpayment anywhere, it must be deliberate.
- **X costs.** Speed Cyclone: the player chooses X, pays X, and `<bind>.x` feeds "Stun X Enemies" (RRG 1.8 "Non-Numerical Variable", p. 30).
- **A dash cost** can't be played (RRG 1.8 "Dash", p. 15).
- **Playing a card ignoring its cost.** Chaos Magic: "Play a card from your hand, ignoring its resource cost."
  - RRG 1.8 "Ignore" (p. 23): "no resources are paid for that card. For the purpose of card effects, that card is considered to have been played with zero resources paid for its cost."
- **Playing a card inside an ability with a reduction.** Team-Building Exercise: "play a card from your hand that shares a trait with your hero, reducing its resource cost by 1".
- **Generating a resource only for an aspect card.** Finesse: "generate a [wild] resource for an aspect card" is `generatesFor` with `TargetQuery.aspect`, reading `printedAspect` (§1.2).
  - FAQ "Finesse (#33)" (RRG 1.8 p. 60): it may pay "its resource cost or a cost within that aspect card's ability".
- **Costs added to basic powers and plays** already exist (wave 1 §3.10):
  - Mother's Orders: "As an additional cost for each hero to make a basic attack, that hero must spend 1 of any resource";
  - Magical Suspension: "Each card you play costs 1 additional resource".

### 3.9 Allies printed with 0 hit points

> **Status: landed (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`. An ally's play ends with a defeat sweep, after its enter-play windows (§4.9's proposed reading). Before this, a character at 0 remaining hit points with no damage event was never swept. The counter-based hit point modifier is an existing `hp` stat modifier reading `counters`.

- **The timing problem.** Ant-Man and Wasp allies enter with 0 hit points, and their counters come from "Interrupt: When [this ally] enters play". The defeat check must run after that interrupt window, not at the moment the ally arrives.
  - RRG 1.8 "Damage" (p. 14): "If a character has zero or fewer remaining hit points, it is defeated."
- **A counter-based hit point modifier** ("+1 hit point for each pym counter") reads its counter.
- **Open (§4.9):** with 0 counters the ally is defeated at once. That is the proposed reading, and it needs confirming.

### 3.10 Cards under and on other cards; ownership of scenario cards

> **Status: landed (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - `tuckCards` takes a card in play out of play properly (`leavePlay`: attachments discarded, a new copy, controller back to its owner). A When Defeated can return it first (`moveCards { tucked } → hand`), because a defeated side scheme's When Defeated resolves before its discard.
> - Constant `playableAttachments: TargetQuery` on a host (Hawkeye's Quiver): its controller may play matching attached cards as if from hand, and `legalActions` offers them. `attach` now turns a card faceup unless it is attached facedown.
> - `EffectSpec takeIntoHand { cards, player }`: an unowned scenario card becomes that player's (owner and home), logged as `ownershipChanged`.
> - `ValueSpec totalPrintedCost { cards }` (Hydra Prison's "the total cost of all allies beneath it").

- **Player cards tucked under encounter cards:**
  - Marked for Death, with the errata "tucks her faceup beneath this card [...] return the tucked Mockingbird to her owner's hand" (RRG 1.8 p. 66). Ruling Feb 28, 2026 (ruling 7, answer 1): only Clint Barton's identity-specific Mockingbird. FAQ "Marked for Death (#28)" (RRG 1.8 p. 60): tucked cards are not in play, so a Mockingbird in play elsewhere doesn't block it.
  - Hydra Prison: each player's hero-specific ally, facedown; "Place X threat [...] where X is the total cost of all allies beneath it"; returned to owner's hand when defeated.
  - Stolen Memories: "Place the top 8 cards of your deck facedown under this card".
  - Time-Travel Hijinks: "Discard the highest-cost card you control, then place it facedown under this card".
  - Captured by Hydra: "Place 1 random set-aside Captive ally facedown beneath this scheme. When this scheme is defeated, the player who defeated it takes that ally into their hand".
  - Wave 1's `tuckCards` covers the encounter side. It needs player-owned cards as the tucked cards, plus "return to owner's hand" on the host leaving play.
- **Events attached to a player card, playable from there.** Hawkeye's Quiver: "search the top 5 cards of your deck for an [Arrow] event and attach it faceup to this card" and "You may play [Arrow] events attached to this card as if they were in your hand".
  - Extend `playableFrom` with `attachedTo: self`.
  - FAQ "Hawkeye's Quiver (#3)" (RRG 1.8 p. 60): the entire deck is shuffled after a search of the top 5.
- **Ownership of a scenario card taken by a player.** RRG 1.8 "Ownership and Control" (p. 31, quoted in §1.4): a Captive ally a player takes into hand becomes theirs.
  - Its `home` switches to that player until the game ends.
  - Its discard pile becomes theirs.

### 3.11 New trigger events and rules

> **Status: landed except the class blank and the per-aspect limit (2026-09-18),** tested in `packages/engine/src/primitives-wave2.test.ts`.
>
> - Trigger event `basicPowerUsed { characterInstanceId, power, playerId }` for basic attack, thwart, defense and recover, announced under the power's own events and only when heard. A stunned attack or confused thwart never announces it.
> - **The Assault keyword** (RRG 1.8 p. 8) was not built: basic thwarts against a scheme with it now use ATK. `RuleSpec thwartWithAtk` with `basicThwart.useAtk` is the Red House's optional version. The thwart event carries `useAtk`.
> - `TraitGrantSpec.traitsOf` (Absorbing Man): the printed traits of matching cards in play; `trait` is now optional.
> - Rules `cannotPlay { player, cards }` (Depowered), `cannotTriggerActions { on, form? }` (Corrupted Timestream) and `defeatedIntoEncounterDeck { target }` (Time Portal).
> - Trigger event `cardReadying`, pushed only when heard, so "When attached character would ready, … instead" can replace a ready (Frozen in Time); `readyOrAnnounce` is used by the end-of-phase ready step and the `ready` effect.
> - `modifyAttack.extraBoostCards` takes a value ("an additional boost card for each side scheme in play").
> - **Already covered, no change:** damage placed on a non-character (`replaceTriggeringEvent` + `placeDamage`), the conditional "cannot take damage" (`cannotTakeDamage.while`), redirecting prevented damage, and hand-size modifiers.
> - **Landed later:** "Treat the printed text box of each [Tech] player card as if it were blank" as a constant is §8; Superhuman Agility's "limit once per round for each aspect" is §3.13.8.

- **`basicPowerUsed { characterInstanceId, power }`.** Quicksilver's Super Speed, Captain Marvel ally (04032), Rapid Growth, the Scarlet Witch ally.
  - FAQ "Quicksilver (#1A)" (RRG 1.8 p. 61): a stunned attack or confused thwart "is not considered to have used a basic power".
- **"When you play an aspect card"** (Superhuman Agility, "limit once per round for each aspect"): the `cardBeingPlayed` interrupt with an aspect query, and a limit keyed per aspect.
- **Damage placed on a non-character.** Crossbones' Armor: "When Crossbones would take any amount of damage, place it here instead. If there is 5 or more damage here, discard Crossbones' Armor."
- **"Cannot take damage" rules:** The Red House, Kang's Dominion, and Kang (Immortus) "while a minion is in play". Verify that the wave 1 vocabulary covers the conditional one.
- **Thwarting with ATK.** The Red House: "When a character thwarts this side scheme, they may use their ATK instead of their THW". This is the Assault keyword's shape (RRG 1.8 "Assault", p. 8) made optional.
- **Gaining traits from other cards.** Absorbing Man "gains the trait of each environment in play"; Super Absorbing Power grants four.
- **"You cannot play hero-specific cards"** (Depowered). FAQ "Depowered (#20)" (RRG 1.8 p. 60): Invocation cards "are merely resolved, not played", so they are still allowed.
- **"Players cannot trigger 'Alter-Ego Action' abilities on obligations"** (Corrupted Timestream).
- **Replacing a ready.** Frozen in Time: "When attached character would ready, discard this card instead".
- **Replacing a defeat's discard.** Time Portal: "When this scheme is defeated, shuffle it into the encounter deck instead of discarding it."
- **Blanking a class of player cards.** Tech Theft, a constant: "Treat the printed text box of each [Tech] player card as if it were blank." Wave 1 has only a lasting `blankTextBox`.
- **Redirecting prevented damage.** Photographic Reflexes: "prevent all damage that would be dealt to Taskmaster and deal an equal amount of damage to that player's identity instead."
- **Extra boost cards.** Master Strategist ("give him an additional boost card for each side scheme in play"); Hydra Exo-Soldier, Apocryphus, Sir Raston and Terminatrix ("give this enemy another boost card").
  - Ruling Feb 28, 2026 (ruling 6): a boost card goes only to an activating villain.
- **Hand size changes.** The Viper ("While the Viper is engaged with you, your hand size is reduced by 1"); Martial Law (campaign only).

### 3.12 Selection and value vocabulary

> **Status (2026-09-18):** the only gap was random selection among set-aside cards: `CardSelector encounterSetAside.random`, tested in `primitives-wave2.test.ts`. Everything else on this list is existing vocabulary (`selectCards`/`chooseCards` over any deck's top, `superlative` with `printedCost`, `chooseTarget.count` as a value, `chooseOne` over statuses, `villainStageNumber`, `<bind>.<resource>` and `resourceTypes`). "Each player searches for a *different* obligation" has no cross-player exclusion yet.

- **"Look at the top card of any deck"** (Jessica Drew).
- **Each player searching for a different card.** Past Machinations: "Each player searches the encounter deck and discard pile for a different obligation and reveals it".
- **Random cards.** "1 random set-aside Captive ally"; "Discard 1 card at random from your hand".
- **Counting what was discarded.** "the number of printed resources on that card" (the Hawkeye ally); "each different type of resource icon discarded this way" (Mass Chaos).
- **A superlative over controlled cards.** "the highest-cost card you control" (Time-Travel Hijinks), using wave 1's `superlative`.
- **"For each side scheme in play, choose and exhaust a character you control."** Bitter Rival's errata (RRG 1.8 p. 66), under the updated "For Each" rule (RRG 1.8 p. 20).
- **"Place a status card on a character"** with a choice of status (Hex Bolt, 3+).
- **"the villain's stage number"** (Muster Courage, Running Interference, United We Stand, Browbeat): wave 1's `villainStageNumber`.

### 3.13 The scripting-blocked primitives (docs/phase7-wave2-scripting.md §6)

> **Progress / next up (2026-09-19, `game-rules-architect`). Done: everything in the table below is either landed
> and tested, or recorded in §3.13.11 with the reason it was not built.** The gaps `ability-scripting-engineer`
> recorded while scripting `trors` (docs/phase7-wave2-scripting.md §6), in the task's priority order. Every shape
> below is additive: no existing `AbilityDefinition` changes, and engine tests are green after each.
>
> | Gap | Shape | Status |
> |---|---|---|
> | §6.1 attack-keyword grant | `attack.keywords`, `modifyAttack.keywords`, `RuleSpec attackKeywords` | **Landed**, §3.13.1 |
> | §6.2 OR of aspects | `TargetQuery.anyAspect` | **Landed**, §3.13.2 |
> | §6.3 wild-resource cost | `ResourceRequirement.wild` | **Landed**, §3.13.3 |
> | §6.6 prevent this attack's damage | `modifyAttack.preventAllDamage` | **Landed**, §3.13.4 |
> | §6.4 crisis-ignoring thwart | `thwart.ignoreCrisis` / `removeThreat.ignoreCrisis` | **Landed**, §3.13.5 |
> | §6.5 a card's printed resource icons | `ValueSpec totalPrintedResources` | **Landed**, §3.13.6 |
> | §6.7 the defeating player | `PlayerRef defeatingPlayer` | **Landed**, §3.13.7 |
> | §6.11 once per round per aspect | `AbilityLimit.per` | **Landed**, §3.13.8 |
> | §6.10 "after a player changes to hero form" | `EventPattern.eventIs` | **Landed**, §3.13.9 |
> | §6.9 Interrupt on a card entering play, and "each other" | `cardEntersPlay` is interruptible; `TargetQuery.excluding` | **Landed**, §3.13.10 |
> | §6.11 blanking a class of cards (Tech Theft) | `RuleSpec blankTextBox` + the blanked-set layer | **Landed later**, §8 |
> | §3.8 play a card inside an ability with a reduction | `playFromHand.costReduction` | **Landed later**, §9 |
> | §3.6 / §4.8 boost counts made by card effects | — | **Not done**, §3.13.11 (open rules question) |
>
> Tests: `packages/engine/src/primitives-wave2b.test.ts` (21 tests, the last three §9's). Nothing below renumbers or
> removes an existing field; the only observable shape change anywhere is §3.13.3's, and it is opt-in.

#### 3.13.1 An attack keyword granted to one attack (§6.1)

RRG 1.8 words piercing (p. 32), ranged (p. 35) and overkill (p. 31) as properties of *an attack* — "An attack with
the … keyword" — not of a character, so a grant can be scoped to a single attack. `AttackKeyword = "piercing" |
"ranged" | "overkill"` (`spec.ts`). Three ways to grant one, all folded together once, when the attack pushes its
damage, by `attackKeywordsOf` (`keywords.ts`), and then stamped on the events it pushes (`dealDamage.piercing`,
`characterAttacked.ranged`, the existing `dealDamage.overkill`):

1. **On the attack effect** — "this attack gains piercing" (Vibranium Arrow 04009, Piercing Strike 04044):
   ```ts
   { kind: "attack", target: theVillain, amount: { kind: "const", value: 6 }, keywords: ["piercing"] }
   ```
2. **On the activation in progress** — "the attack gains piercing" (Crossfire's boost 04027), "when attached enemy
   attacks, the attack gains ranged" (Crossfire's Rifle 04029), from an interrupt/boost ability:
   ```ts
   { kind: "modifyAttack", keywords: ["piercing"] }
   ```
3. **As a constant rule** — "each of your [Arrow] attacks gain ranged" (Hawkeye's Bow 04002). `attacker` matches the
   attacking character, `via` matches the card whose ability is making the attack (the event, for a
   "Hero Action (attack)"); both optional, ANDed, and a basic attack never matches a rule with `via`:
   ```ts
   { kind: "attackKeywords", keywords: ["ranged"], via: { trait: ARROW, owner: "you" } }
   ```

`keywords: ["overkill"]` is the same as the existing `attack.overkill` / `modifyAttack.overkill` boolean (they share
the `overkill` frame var), so both spellings work and compose. The attacker's own printed or granted keyword is
unchanged and still read in `applyDamage` / `applyRetaliate`, which is why a persistent character's grant (Black
Knight 04012, Crossbones' own constant) keeps working with no script change.

Interactions pinned by test: piercing discards the target's tough card and then deals full damage; ranged suppresses
retaliate but **does not** let the attack past a guard minion (RRG 1.8 "Guard", p. 22); "cannot take damage" still
beats piercing, so no tough card is discarded when no damage would be dealt (RRG 1.8 "Piercing", p. 32).

#### 3.13.2 An OR of aspects in a `TargetQuery` (§6.2)

**`TargetQuery.anyAspect?: readonly string[]`** (`spec.ts`, matched in `select.ts` `explainQuery`), the aspect
sibling of `anyTrait`: at least one of the listed aspects, read off `aspect` **or** `printedAspect` exactly as the
single-valued `aspect` field already is (§1.2). ANDed with `aspect` if both are given; an empty list matches nothing.

```ts
// "generate a [wild] resource for an aspect card" (Finesse 04033)
{ trigger: { kind: "resource" }, generates: 1, generatesFor: { anyAspect: ["aggression", "justice", "leadership", "protection"] } }
// "search the top 5 cards of your deck for an aspect card" (Jessica Drew's Apartment 04034)
chooseCards({ ..., filter: { anyAspect: CORE_ASPECTS } })
```

Deliberately **not** `isAspectCard: true`: `anyAspect` covers "an aspect card" and also "an Aggression or Justice
card" with one field, and it costs the caller one constant in `@mc/cards`.

#### 3.13.3 A cost requiring a wild resource specifically (§6.3)

**`ResourceRequirement.wild?: number`** (`resources.ts`), a slot filled only from `pool.wild`. RRG 1.8 "Wild
Resource" (p. 48): "Some card abilities specifically require wild resources to be spent", and a generated wild "may
specify which resource type (energy, mental, physical, or wild) it is being used as" — a wild may be declared wild,
but no typed resource can be declared a wild. `satisfies` pays the wild slots first, then the typed slots, then lets
the wilds *left over* cover a typed shortfall, then the generic part.

```ts
// "Hero Action: Exhaust your hero and spend a [wild] resource → …" (Crossfire's Rifle 04029)
{ trigger: { kind: "action", form: "hero" }, cost: { exhaustIdentity: true, resources: { wild: 1 } }, effects: [ … ] }
```

**Shape change to watch:** `Required<ResourceRequirement>` now has five keys, so `paymentFor(...).requirement` and
the `spendResources` prompt carry `wild: 0` where they used to carry four keys. Two engine tests asserting the exact
object were updated; nothing else in the repo reads the shape key-by-key.

**Client follow-up (`game-client-engineer`):** `packages/client/src/view/payment-model.ts` `outstandingTypes` loops
over the three typed slots only, so an unpaid `wild` slot shows in the "required" total but not in the "outstanding"
list. `required: poolTotal(query.requirement)` is already right.

#### 3.13.4 "Prevent all damage from that attack", from attack initiation (§6.6)

**`modifyAttack.preventAllDamage?: boolean`.** The `preventDamage` effect only adjusts an already-pushed `dealDamage`
frame, so it is a silent no-op for an interrupt that fires at attack *initiation* (docs/phase7-wave2-scripting.md
§4.1). This flag instead rides the **activation's own event frame** — the same place `overkill`, `atkBonus` and
`extraBoost` already live — so it is set before a defender is declared and read when that attack finally deals
damage, whoever ends up defending and whatever the defense arithmetic produces. It expires with the attack, because
the frame does.

```ts
// "Interrupt: When the villain initiates an attack against you, … → prevent all damage from that attack." (Mockingbird 04004)
{ trigger: { kind: "interrupt", on: { on: "enemyAttack", playerIs: "controller" } },
  cost: { resources: 1, returnToHand: { … } },
  effects: [{ kind: "modifyAttack", preventAllDamage: true }] }
```

Semantics, per RRG 1.8 "Prevent" (p. 34), pinned by test:
- the damage is still **dealt** — excess damage is measured before the check, so an `excessDamageAsThreat` rule still
  fires — but the target **takes** none;
- **no tough status card is spent** (the attack never reaches the tough step);
- the attack records no `damage` / `damaged` result, so "after [enemy] attacks and damages you" does not trigger;
- **only the attack's own damage.** Damage a Boost ability (or any other card effect) deals during the same attack
  has no `parentFrameId` pointing at the activation and is untouched.

**Flagged, unconfirmed reading** (also in a code comment at `resolve/event.ts` `applyDamage`): a fully prevented
*piercing* attack discards no tough status cards here. RRG 1.8 "Piercing" (p. 32) exempts an attack that "would deal
no damage", while p. 34 says prevented damage is still dealt, so the two readings disagree. No cycle 1 card reaches
the combination.

**Not built:** "prevent N of this attack's damage" (a value rather than all) — no card in the pool needs it, and the
existing `preventDamage` effect covers the partial case once a `dealDamage` frame exists. The defend-preview
(`defend-preview.ts` `plannedAttackDamage`, which feeds the client's defend prompt) does **not** know about the flag,
so the prompt still shows the unprevented range; the damage actually dealt is correct.

#### 3.13.5 "Ignoring any crisis icons in play" (§6.4)

**`thwart.ignoreCrisis?: boolean`** and **`removeThreat.ignoreCrisis?: boolean`**, carried onto the `removeThreat`
event and read by `threatRemovalBlocked` (`resolve/event.ts`).

```ts
// "Hero Action (thwart): … → remove 3 threat from a scheme, ignoring any crisis icons in play." (Cable Arrow 04008)
{ kind: "thwart", target: theMainScheme, amount: { kind: "const", value: 3 }, ignoreCrisis: true }
```

Scope, deliberately narrow: it steps over **only** the RRG 1.8 "Crisis Icon" (p. 14) check, for that one removal. A
`threatCannotBeRemoved` rule (Countdown to Oblivion, Held Hostage) is a "cannot" — RRG 1.8 "'Cannot'" (p. 11), "an
absolute prohibition" — and still blocks. The command-level refusal of a *basic* thwart against the main scheme
under a crisis icon (`actions.ts`) is untouched; no card grants that.

#### 3.13.6 A referenced card's printed resource icons (§6.5)

**`ValueSpec { kind: "totalPrintedResources"; cards: TargetRef; types?: ("physical"|"mental"|"energy"|"wild")[] }`**,
the sibling of `totalPrintedCost`. Printed icons only (RRG 1.8 "Printed", p. 35), summed over whatever the ref names,
read wherever those cards are — so a card already discarded to pay the ability's own cost still counts. `types`
absent counts all four, a printed wild icon included.

```ts
// "discard 1 card from your hand → deal X damage to an enemy, where X is the number of printed resources on that
// card" (the Hawkeye ally 04011): the cost's own `discard` slot is the ref.
{ kind: "dealDamage", target: anEnemy, amount: { kind: "totalPrintedResources", cards: { kind: "slot", slot: "discard" } } }
```

Use this rather than `<bind>.<type>` when the cards come from a `TargetRef` (a cost slot, a `bindTargets` slot, a
card in play); `<bind>.<type>` stays the way to read a `moveCards` / `discardEncounterCards` pool.

#### 3.13.7 "The player who defeated this scheme" (§6.7)

**`PlayerRef { kind: "defeatingPlayer" }`**, reading the `defeatedByPlayerId` on the `schemeDefeated` or
`characterDefeated` event in context. Where `on.defeated({ byYou: true })` is a yes/no trigger gate, this hands the
player back as a value.

```ts
// "When Defeated: Crossbones activates against the player who defeated this scheme." (Crossbones' Assault 04070)
whenDefeated(enemyAttack(theVillain, { against: { kind: "defeatingPlayer" } }))
```

Two supporting changes, both additive:
- **`schemeDefeated` now carries `defeatedByPlayerId`** — the player whose thwart the removal belonged to, else the
  controller of whatever removed the last threat, else null. It is also the event's player subject, so
  `playerIs: "controller"` now works on a `schemeDefeated` pattern the way it already did on `characterDefeated`
  ("after *you* defeat a side scheme"). No card in the pool used that pattern before, so nothing changes behaviour.
- **A side scheme's When Defeated abilities now resolve with the `schemeDefeated` event in context** (a minion's
  already got its `characterDefeated` event). Checked against every Core, wave 1 and wave 2 `whenDefeated` script:
  none reads an event-scoped ref, so nothing else moves.

#### 3.13.8 A limit counted per aspect (docs/phase7-wave2-scripting.md §6.11, §3.11)

**`AbilityLimit.per?: "aspectOfEventCard"`.** The ability keeps one count per value of the key instead of one shared
count, so "(limit once per round **for each aspect**)" is a `count: 1` limit that resets per aspect.

```ts
// "Interrupt: When you play an aspect card, … (limit once per round for each aspect.)" (Superhuman Agility 04031a)
{ trigger: { kind: "interrupt", on: { on: "cardBeingPlayed", playerIs: "controller", sourceIs: { anyAspect: CORE_ASPECTS } } },
  limit: { count: 1, period: "round", per: "aspectOfEventCard" },
  effects: [ … ] }
```

The key is the triggering event's card's `printedAspect ?? aspect`, so an identity-specific card that prints an
aspect (§1.2) counts under the aspect it prints. Mechanically the `abilityUses` key becomes
`<instance>:<ability>#<aspect>`; `#` never occurs in an ability id, and `clearAbilityUses` strips the qualifier back
off to find the definition. An ability with no triggering event (an "Action" used by command) falls back to the one
shared count, exactly as today — so this is inert for every existing limit.

#### 3.13.9 A string field on the triggering event (docs/phase7-wave2-scripting.md §6.10)

**`EventPattern.eventIs?: Readonly<Record<string, string>>`**, the string counterpart of `eventAtLeast`: fields the
event itself carries must equal these. `formChanged` already recorded `to: "hero" | "alterEgo"`; nothing could read
it.

```ts
// "Forced Response: After a player changes to hero form, they …" (Taskmaster I–III, 04093–04095)
{ trigger: { kind: "response", forced: true, on: { on: "formChanged", eventIs: { to: "hero" } } },
  effects: [ /* "they" is PlayerRef { kind: "eventPlayer" } */ ] }
```

The "any player" half needed nothing new: **omit `playerIs`** and the pattern is "after *a player* …" rather than
"after *you* …" (`on.youChangeForm`'s hardcoded `playerIs: "controller"` is the DSL's, not the engine's).

#### 3.13.10 An Interrupt on a card entering play, and "each other" (docs/phase7-wave2-scripting.md §6.9)

Two changes, both needed by "Forced Interrupt: When an environment enters play, discard each other environment card
in play" (None Shall Pass 1A, 04079b).

**`cardEntersPlay` is no longer announcement-only.** The enter-play keywords — toughness's status card, Uses X's
counters, the Restricted and ally-limit checks (`applyEnterPlayKeywords`) — are now that event's **apply step**
(`resolve/event.ts`), instead of running before it was announced. So the order is: interrupt window → keywords →
response window. That is also what RRG 1.8 "Ally Limit" (p. 7) asks for ("this check occurs before abilities that
resolve upon entering play"), and it makes the interrupt window mean something: previously an "Interrupt: when X
enters play" ability was silently never offered. Every Core, wave 1 and wave 2 test passes unchanged; no existing
script had an interrupt on this event, and responses still see the keywords resolved.

**`TargetQuery.excluding?: TargetRef`**, the ref counterpart of `excludeSlots`: everything the ref names is out of
the query.

```ts
// "discard each other environment card in play", on an ability triggered by one entering
{ kind: "discardFromPlay", target: { kind: "each", query: { categories: ["environment"], excluding: { kind: "eventTarget" } } } }
```

`self: false` already excluded the ability's *own* card; this excludes a card the ability names some other way (the
triggering event's subject, a slot, the host). Useful well beyond this card — any "each other …" text.

#### 3.13.11 Recorded as NOT done in this pass

**Blanking a whole class of cards' text** (Tech Theft 12026) and **playing a card inside an ability with a cost
reduction** (Team-Building Exercise 12024) were both left out of this pass, each because it is a focused refactor
rather than an additive field: the first needs a blanked-set layer over the ability lookup (recursion and a
quadratic cost to avoid), the second a second and third prompt inside one effect step plus three rules judgement
calls. **Both were built in the pass after this one — §8 and §9 below.**

**Boost counts made by card effects** — Hex Bolt (15004), Taskmaster's and Crossbones' "discard the top card of the
encounter deck … boost icons on that card". **Not built, deliberately: it is §4.8's open rules question,** not an
engine gap. The `boostIconsCounting` window exists only inside an activation's boost step; extending it to
`<bind>.boostIcons` reads by card effects *is* choosing the reading that Chaos Control's "when boost icons on an
encounter card would be counted" reaches those counts. The doc's own proposal (§4.8: "every count, since the text
says 'an encounter card', not 'a boost card'") is marked unconfirmed, and there is no FFG ruling in
`marvel-champions-rulings-post-rrg-1-7.md`. **Surfaced for the user rather than picked quietly.** Note that the
cards themselves are only blocked on the *interaction*: Hex Bolt's own counting already works through
`<bind>.boostIcons`, and FAQ "Hex Bolt (#4)" (RRG 1.8 p. 61) settles its internal order. Scripting them is fine
today; what is undecided is whether Chaos Control (`scw`, not started) can replace those counts.

---

## 4. Open questions (for the user or FFG)

1. **Kang's parenthetical: ruling vs insert.**
   - Ruling Jan 26, 2026 (ruling 4, answer 6): "'(The Conqueror)' is part of his title, not a subtitle."
   - The Kang insert, "Rules Clarifications": "The Kang minion has a different subtitle (Master of Time) from each Kang villain".
   - Both conclude that the two Kangs don't match. **Data follows the ruling:** `name` includes the parenthetical, and there is no `subtitle`. **Flagged:** the two sources disagree on what the parenthetical is, and a "subtitle" reading would change `cardsMatch` for other cards.
2. **Kang's victory vs RRG 1.8 "Villain Defeat" (p. 47).** The RRG wins on the final villain stage; the insert requires all three Kangs. Implemented as scenario data (`victory: "cardAbility"`), per the Golden Rules (p. 4). This is not a ruling conflict, but it is an override to keep visible.
3. **The Master of Time 2B and acceleration tokens.**
   - 2B redirects every acceleration token to itself, and prints dashed values (§1.6, if curation confirms them).
   - RRG 1.8 "Acceleration Token" (p. 5): tokens "add X additional threat to the main scheme during step one", including "Acceleration tokens placed on cards other than the main scheme".
   - With four stage 3 schemes in four areas and 2B central, which "main scheme" gets that threat?
   - **Proposed:** each area's stage 3 gets the central tokens' threat in its own step 1. That is unconfirmed.
4. **Spider-Woman's aspect-coloured signature cards and the equal split.** Implemented as not counted (§1.2). This is moot for her real set, but a future identity with an unbalanced set would need a ruling.
5. **Captive allies:**
   - Are they printed with no classification (`"none"`) or as Basic? Curation must check the image.
   - Are they ever in the encounter deck? RRG 1.8 "Scenario-Specific Card" (p. 38) excludes allies from the encounter deck; Hunting Down Heroes 1A still says "Set each Captive ally aside".
   - **Proposed:** set aside at setup, never shuffled in.
   - MarvelCDB's extra record 10098 (a second Shang-Chi, `faction_code: hero`, `deck_limit: 1`) looks like a hook for campaign rewards. It is not a printed card (§5).
6. **A voluntary change between two hero forms** (§3.2). Does it use the player's once-per-round voluntary change?
   - **Proposed: yes.** The insert says the three-sided card "follows the standard rules for changing form" and allows "from one hero form to the other" as a change of form.
7. **The side-scheme deck's discard.** Red Skull rulebook p. 15: "When a side-scheme is defeated or otherwise discarded, place it in the side-scheme discard pile." Does that include side schemes that were never in the side-scheme deck, such as a nemesis side scheme revealed by Shadow of the Past?
   - **Proposed:** only its own cards (by `home`); every other side scheme goes to the encounter discard.
8. **Chaos Control's reach** (§3.6). Does "When boost icons on an encounter card would be counted" apply to counts made by card effects (Hex Bolt, Taskmaster, Crossbones' Machine Gun), or only to a boost card's icons during an activation?
   - **Proposed:** every count, since the text says "an encounter card", not "a boost card". Needs confirming.
9. **Zero-hit-point allies** (§3.9). With no overpayment, are the Ant-Man and Wasp allies defeated as soon as their enter-play interrupt resolves?
   - **Proposed: yes**, per RRG 1.8 "Damage" (p. 14).
10. **First player choices inside a game area** (§3.1). When an encounter card in an area without the first player needs "the first player decides" (a tie on a target), who decides?
    - **Proposed:** the first player, since the token is global and the insert's isolation rule is about cards affecting areas, not about decisions. Needs confirming.
11. **Obligations in the singular.** RRG 1.8 Appendix II step 4 (p. 51) says "set aside their obligation card"; "Obligation" (p. 30) says "one or more". Implemented as every copy (§1.10). A wording gap in the RRG rather than a conflict.

12. **Requirement against a reduced cost** (§6.1). RRG 1.8 "Requirement (Resources)" (p. 37) says the required resources must be "spent while paying for that card's cost", and that the card "cannot be played 'ignoring its resource cost'". It does not say what happens when an effect reduces the cost below the number of required resources.
    - **Implemented:** the card cannot be played (`requirementUnmeetable`, `actions.ts`), because resources beyond a cost "were not paid for that cost" (RRG 1.8 "Cost", p. 13). The other reading is that the required resources are always spent even above the reduced cost. Needs confirming.

13. **What the Prerequisite keyword gates** (§7.5). RRG 1.8 has no entry; the Fear No Evil rulebook (p. 3) is the only source and is not in this repo, and the one printed card that has it (Defend Our City 61029, a **player side scheme**) carries no reminder text.
    - Unclear whether the keyword bars *playing* the card, bars *triggering its abilities*, or both — and, on a card that enters play some other way, whether it keeps checking while the card is in play or only at the moment it is played.
    - **Implemented: data only.** The schema shape is `{ name: "prerequisite", traits?, form? }` and the engine does nothing with it; a card carrying it cannot be marked playable. Nothing is guessed. Read the rulebook page before building the semantics; `PlayRestrictions.form` / `requiresIdentityTrait` is the likely target.

---

## 5. For the data pipeline: parser needs and raw-data errors

### 5.1 Parser and normalizer changes for the schema above

This is `card-data-pipeline`'s code; nothing here was edited.

| Survey category | What to do |
|---|---|
| "hero without a linked alter-ego" / "unhandled type hero" (12001c, 13001c) | Fold the unlinked `…c` hero record into its identity's `additionalHeroForms` (§1.1). Its abilities key as `12001c.<slug>`. |
| Spider-Woman's aspect cards (04035–04038), not yet flagged by the survey | `faction_code` aspect + `card_set_code` of an identity → `aspect: hero:04031a`, `printedAspect: <faction>` (§1.2). |
| "unknown faction encounter" + "deck_limit missing" (04097–04100) | Captive allies: `aspect: "none"` (after the image check), `specificTo: { kind: "scenario", encounterSetId: "taskmaster" }`, `deckLimit: 1` (they are unique; campaign mode may add them to decks). |
| "unknown faction campaign" (04155–04162) | `aspect: "basic"`, `specificTo: { kind: "campaign", encounterSetId: "hydra_camp" }`. |
| "obligation with faction campaign" (04163–04166) | Encounter obligations in `expcamp` sets, marked `EncounterSet.campaignSpecific`. |
| "upgrade without a cost" (04159a–04162a) | `cost: 0, specialCost: "dash"` after the image check; the `…b` records become `flipSide` (§1.5). |
| MarvelCDB `cost: -1` (14006) | `cost: 0, specialCost: "X"` (§1.3). |
| Ally `health: 0` (12011, 13012) | Emit `hp: 0`; the schema now accepts it. |
| "villain set: stage names differ" (kang, exp_kang) | One `VillainCard` per Kang record, each with one stage whose `stageNumber` is its numeral (§1.8). |
| "main scheme missing starting/target/acceleration threat" (11008b) | `dashedValues: ["startingThreat", "targetThreat", "acceleration"]` with zeros, after the image check (§1.6). |
| Kang's four stage 3 records | Four stages with `stageNumber: 3`, each with its `name` (§1.6). |
| "attach rule shape not recognized" | `Attach to the Villain.` (capital V) → `villain`. `Attach to Kang.` → `villain` (one villain per area). `Attach to your identity.` → `yourIdentity`. `Attach to an [Avenger] ally.` → `qualified { category: "ally", trait }`. `Attach to the minion with the most remaining hit points without another copy of X attached.` → `superlative { among: "minion", order: "highest", measure: "remainingHp", withoutAttachmentNamed }`. `Attach to X, if able. If you cannot, attach to the villain.` and `Attach to X. Otherwise, attach to the villain.` → `ifAble` (§1.7). `Attach to Crossbones.` / `Attach to Taskmaster.` / `Attach to Red Skull.` / `Attach to Absorbing Man.` → `villain`. |
| "Max 1 per phase." (14005) | `playRestrictions.maxPerPhase` (§1.9). |
| "Play only if you are in [Giant] / [Tiny] hero form." (12003, 12004) | `form: "hero"`, `requiresIdentityTrait` (§1.1). |
| Scenarios | `setAsideVillainCardIds`, `expertVillains` and `victory` for Kang; `separateDecks` for Crossbones and Red Skull; `modularSetCount` 3 for Crossbones and 2 for Red Skull (§2). |

### 5.2 Raw-data errors curation must fix, each with a source

**Errata missing from MarvelCDB** (RRG 1.8 p. 66; the raw text is the pre-errata wording):
- **Marked for Death (04028).** "places her faceup beneath this card. When this scheme is defeated, return Mockingbird" must read "tucks her faceup beneath this card. When this scheme is defeated, return the tucked Mockingbird to her owner's hand."
- **The Rise of Red Skull 1A (04128a, and the aggregate 04128's `back_text`).** "Shuffle every other side scheme" must read "every other encounter side scheme".
- **Bitter Rival (04136).** "Exhaust a character you control for each side scheme in play." must read "For each side scheme in play, choose and exhaust a character you control."
- **Beetle (13028).** "choose to either spend a [physical] resource" must read "the defeating player chooses to either spend a [physical] resource".

**Errata already in the raw text** (verify, don't re-apply):
- Hail Hydra! (04057, 04147): the shuffle happens only if searched;
- Attack on Mount Athena 1A (04061a): Hydra Assault;
- Twisted Reality (04135): Forced Interrupt;
- Avengers Tower (04021): the Avenger trait.

**A record that is not a printed card:**
- **10098** "Shang-Chi" (`faction_code: hero`, `card_set_code: taskmaster`, `position: 98`, `deck_limit: 1`) duplicates the Captive ally 04098, under a code in Hulk's range. The survey reports it as "hero card in set taskmaster with no identity". Drop it and cite this doc.

**Stats to check against the card image before emitting** (a printed "—" is an absent field in MarvelCDB):
- **Red Skull I (04125)** has no `attack`; stages II and III print 1 and 2.
- **Kang (Scarlet Centurion) (11005)** has no `scheme`; the expert card (11038) prints 1.

**Names:**
- **The Rise of Red Skull aggregate 04128** is named "The Rise of the Red Skull"; the A/B records and the rulebook (p. 15) say "The Rise of Red Skull".
- **The Infinity Stone 2A (04062a)** has a trailing period in its name ("The Infinity Stone."). The Crossbones rulebook page (p. 5) calls the stage "The Infinity Gem", so read the card image before choosing.

**Text:**
- **Size Increase (12028)** reads "Uses (3 counters)." while its ability removes "size counter[s]". Probably "Uses (3 size counters).", so check the image.
- **Crossbones II (04059)**: "Crossbone's Machine Gun" should be "Crossbones' Machine Gun" (04064's title). Uncorrected, this is a named search that finds nothing.
- **Weapon Master (04150)**: "When Reveled" appears twice. The parser's trigger regex won't match it, so it would silently become plain text.
- **The Master of Time (11008)**: "in turn oder"; "advanced to stage 4A". The Chronopolis (11009) says "this stage is complete" where the other three stage 3 cards say "completed". Check the image.
- **Jessica Drew (04031b)**: "<b>Action:</b>:" has a doubled colon.
- **Magical Suspension (15026)**: the text begins ". Each card you play …" with a stray period.
- **Earth's Mightiest Heroes (04022)**: `traits: ""` should be absent traits, not an empty trait.
- **Kang's Arrival 1A (11007a)**: "remove each player's obligation" has a lowercase sentence start. Cosmetic.

**Aggregate records.** The survey reports "aggregate 11008 does not match its B side". Inspect it before dropping, as for Core's swapped A/B. Every other cycle 1 main scheme aggregate has `text` = B and `back_text` = A.

**No artwork reference** (04021, 13025, 15018: Core/wave 1/cycle 1 reprints, which the reprint-art rule resolves; 14001a's alter-ego face; 11007a's stage 1A–3A): the art policy for reprints (pipeline), not schema.

---

## 6. Schema pass for the packs after cycle 1 (owner: `game-rules-architect`; landed 2026-09-18)

The ten schema needs in `docs/phase7-wave2-data.md` §3, each checked against the raw data (`packages/content/raw/marvelcdb/<code>.json`) and a primary source before it was shaped.

> Status: landed in `packages/content/src/schema/**` with fixtures in `packages/content/src/schema/wave2-later-packs.test.ts` (20 tests), and the engine side in `packages/engine/src/wave2-later-packs.test.ts` (20 tests). Core, wave 1 and cycle 1 behaviour is unchanged.

**New sources read** (fetched 2026-09-18 from the Hall of Heroes product pages, not stored in the repo):
- Civil War rulebook, `https://hallofheroeslcg.com/wp-content/uploads/2025/10/civil-war-pdf.pdf` (PDF pages cited).
- Agents of S.H.I.E.L.D. rulebook, `https://hallofheroeslcg.com/wp-content/uploads/2025/03/mc50_rulebook.pdf`.
- Fear No Evil rulebook, `https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc60_rulebook-web.pdf`.
- SP//dr Hero Pack insert, `https://hallofheroeslcg.com/wp-content/uploads/2022/07/z2.jpg` (read as an image).

**Modes that aren't built.** Campaign, competitive (team-vs-team) and the Agents of S.H.I.E.L.D. evidence mechanic all stay data only. Each is marked so it cannot be misused in a standard game:
- `validateDeck` refuses `campaign_card`, `competitive_card`, `scenario_card`, evidence (`not_a_player_card`) and a separated identity (`unsupported_identity`);
- `createGame` refuses an evidence card in any deck and a separated identity at any seat;
- `validateScenarioEncounterSets(scenario, sets)` (new, `validation.ts`) refuses a standalone scenario that names a campaign-specific or competitive-only set, or a set that isn't registered.

### 6.1 Requirement with several icons

- **Shape:** `{ name: "requirement", resources: ResourceIconCounts }`, e.g. `{ mental: 2 }` for `Requirement ([mental][mental])` (R&D Facility 29020, Honed Technique 28017) and `{ energy: 1, mental: 1, physical: 1 }` for the Spider-Man ally (27049 / 52022).
- The single-icon `icon` spelling stays, so the current emitter compiles; exactly one of the two is set. `requirementResources(keyword)` reads either.
- Only physical, mental and energy are accepted. No card prints a wild Requirement, and the engine's typed cost slots have no wild slot.
- **Engine, landed:** the required resources become typed slots inside the card's own cost (`playRequirement`, `actions.ts`); a wild resource can fill one (RRG 1.8 "Wild Resource", p. 48). A cost reduced below the required count refuses the play (§4.12). "Ignoring its resource cost" doesn't exist yet (§3.8); when it lands it must refuse a Requirement card (RRG 1.8 p. 37).

### 6.2 Discount X (trait)

- **Source:** the Fear No Evil rulebook, "Featured Keywords" (p. 3): "When a player plays a card with discount X, its resource cost is reduced by X if that player's identity has the specified trait. If more than one trait is specified and the player's identity has at least one of the specified traits, the cost is reduced by X." FAQ (p. 26): "the cost reduction is applied only once if your identity has any number of matching traits." RRG 1.8 has no entry.
- **Shape:** `{ name: "discount", value: number, traits: Trait[] }`; `value` is now required and positive, and at least one trait is listed (an OR).
- **Engine, landed:** a contribution to the card's own price with the card as its source (`discountFor` in `playCostContributions`), so `playCostOf` shows why it is cheaper. Printed or gained identity traits count.
- The glossary entry now paraphrases the rulebook, and stays `unverified` because the rulebook isn't in the repo. A new glossary source kind was not added: the client's `citeLabelOf` switch has no default and would print "undefined".

### 6.3 Leader cards and competitive mode

- **Rules:** RRG 1.8 "Leader" (p. 26): "The leader card type follows the same rules as the villain card type for all purposes." Civil War rulebook, "Leaders" (PDF p. 3): leaders "function exactly the same as villains"; "Cooperatively" (PDF p. 6): "The leader in play is called 'the enemy leader.'", "Any rule or ability that refers to 'the villain' refers to the enemy leader", "A card ability that refers to 'your leader' cannot be resolved." Ruling, Jul 9, 2026 (3) answer 2: outside Civil War, "enemy leader" is the villain.
- **Shape:** a leader is a `VillainCard` with `printedType: "leader"`. Its stages are I–IV: "Chosen leader I and II (III and IV for expert mode)" (Superhero Registration Act 1A). Cooperative Civil War is ordinary play.
- **Host:** `AttachmentHost { kind: "leader"; of: "enemy" | "yours" }`. In cooperative play, `enemy` is the villain and `yours` has no host, so `ifAble` falls through: "Attach to your leader. Otherwise, attach to your hero." (Tangled Up 56181) → `ifAble { preferred: leader yours, otherwise: yourIdentity form hero }`.
- **Competitive-only cards:** each leader's four basic player cards (The Futurist and friends; "used only when playing in competitive mode", PDF p. 3) get `specificTo: { kind: "competitive", encounterSetId: <leader set> }`. Standard PvP (`standard_pvp`) gets `EncounterSet.competitiveOnly: true` ("replaces the standard encounter set when playing in competitive mode").

### 6.4 Agents of S.H.I.E.L.D. evidence cards

- **Rules:** the Agents of S.H.I.E.L.D. rulebook, pp. 5–6 and 18. The nine evidence cards (50185–50193) are sorted by card back into means, motives and opportunities; one of each is hidden in the A.I.M. envelope. "Evidence cards are not added to any deck once gained." Their `Setup` text is "resolved by the campaign setup instructions"; in the standalone Baron Zemo scenario, "Ignore the text on the lower portion of the evidence card".
- **Shape:** a new card type, `EvidenceCard { type: "evidence"; evidence: "means" | "motive" | "opportunity"; encounterSetIds; traits; text; abilities; evidenceIcon? }`, in `AnyCard`. `evidenceIcon` is the campaign-log icon, which MarvelCDB doesn't record.
- **Engine:** refused in every deck. Preparing the evidence and gaining it during the Baron Zemo scenario are not built, so that scenario stays data only.

### 6.5 A qualifier keyed on a keyword

- "Attach to a non-permanent side scheme." (Containment Strategy 42019, The Direct Approach 43020) → `qualified { category: "sideScheme", withoutKeyword: "permanent" }`. `HostQualifiers` gains `keyword` / `withoutKeyword` (any `KeywordName`), usable on `qualified` and `superlative`. Printed or gained keywords count. **Engine, landed.**

### 6.6 An OR of hosts

- `AttachmentHost { kind: "anyOf"; hosts: [h1, h2, ...] }`: every candidate of every part, each once, in the order listed. Neither `ifAble` nor `anyOf` may be nested inside it; `anyOf` may sit inside an `ifAble`.
- "Attach to an enemy or scheme." (60002, 60003) → `anyOf [enemy, scheme]`. "Attach to Greycrow or Harpoon. Otherwise, attach to the [MARAUDER] enemy with the lowest ATK." (40107) → `ifAble { preferred: anyOf [namedCard Greycrow, namedCard Harpoon], otherwise: superlative enemy lowest atk trait MARAUDER }`. "Attach to an [X-FORCE] or [X-MEN] ally." (45014) → `anyOf` of two `qualified` allies. **Engine, landed.**

### 6.7 More superlative measures

- `HostMeasure` gains `activationOrder` (villains only; a villain with none is no candidate) and `traitCount` (distinct printed and gained traits).
- `VillainCard.activationOrder?: number`, a positive whole number. MarvelCDB prints it in the traits field ("Activation Order 1"); FAQ The Sinister Six (RRG 1.8 p. 62) uses "the lowest activation order value".
- "Attach to the villain with the highest activation order value. If you cannot, resolve the Ambush! ability on the main scheme, then attach this card to the active villain." (27103, 27105): the first sentence is `superlative`. The fallback runs an effect before attaching, so it is the card's script, not a host. **Engine, landed.**

### 6.8 The non-active villain

- "Attach to the villain who is not the active villain." (Direct Assault 21105) → `{ kind: "nonActiveVillain" }`: every undefeated villain except the active one. Several are a first-player choice (RRG 1.8 "First Player", p. 19). **Engine, landed.**

### 6.9 `aoa`'s third villain face

- Not a normalizer quirk: Apocalypse (45184–45186) is a foldable, three-sided villain. Each stage card prints Biomorph (`…a`), Cyberpath (`…b`, the linked card) and Giant (`…c`, published unlinked), told apart by form trait.
- **Shape:** `VillainSideLetter = "A" | "B" | "C"`; a villain has one, two or three sides, a three-sided one has exactly A, B and C, and every side lists the same stage numbers. `startingSide` may be C. En Sabah Nur's Pyramid 1A, "Apocalypse begins the game in [Biomorph] form", is side A.
- **Engine, landed:** `VillainState.side` is widened. `flipCard` does nothing to a three-sided villain, since "flip" doesn't say which face. New `EffectSpec changeVillainForm { villain, toFaceWithTrait }` ("change Apocalypse to [Giant] form") resolves as a flip (RRG 1.8 "Flip", p. 20), with When Revealed and `cardFlipped` as for `flipCard`.

### 6.10 `spdr`'s dangling link

- Not a data error in the linked record: SP//dr is a **separated identity** (SP//dr insert, "New Rule: Separated Identity Card"). The identity is split across two physical cards: the SP//dr Suit (ACTIVE hero side 31001a / INACTIVE support side 31001b) and Peni Parker (alter-ego side / SP//dr upgrade side). They share one hit point dial, and a defeat of either form defeats both.
- MarvelCDB's cache has **no record at all for Peni Parker's card** (no 31002 in `spdr.json`), which is why 31001a links to a support instead of an alter-ego.
- **Shape:** `HeroIdentityCard.separatedIdentity?: { alterEgoCardNumber; heroCardOtherSide: CardFlipSide & { cardType: "support" }; alterEgoCardOtherSide: CardFlipSide & { cardType: "upgrade" } }`. `hero` and `alterEgo` stay the two forms. Ability ids must be unique across every face, and `abilityRefsOf` includes both other sides.
- **Engine:** data only. `createGame` refuses the identity, and `validateDeck` reports `unsupported_identity`.

### 6.11 Found along the way, not in the ten

- The Fear No Evil rulebook (p. 3) defines two more keywords the schema doesn't enumerate: **Prerequisite (form or trait)** (Defend Our City 61029, `jj`) and **Starting** (Innate Reflexes 60038; `jj` 61034, 61036, 61037). Prerequisite matches `playRestrictions.form` / `requiresIdentityTrait` closely. Starting needs a setup step before the opening draw. Neither was added in this pass.
- The same page updates Villainous ("revised to function for allies (and heroes)") and Vulnerable. Both matter only when those packs are scripted.
- **Client follow-up (`game-client-engineer`):** `inspect-model.ts` `keywordLabel` prints `keyword.icon` for Requirement and has no trait for Discount. It needs `requirementResources` and `traits`. No emitted card uses either keyword yet.

### 6.12 Parser mappings the pipeline needs

| Raw data | Emit |
|---|---|
| `Requirement ([mental][mental]).` and every other Requirement line | `{ name: "requirement", resources: { <type>: <count>, ... } }` (count repeated icons; prefer this over `icon` for single icons too) |
| `Discount N (T).` / `Discount N (T1 or T2).` | `{ name: "discount", value: N, traits: [T] }` / `traits: [T1, T2]` |
| `type_code: "leader"` | `VillainCard` with `printedType: "leader"`, stages I–IV by `stage` |
| `faction_code: "basic"` in a `card_set_type_name_code: "leader"` set (56129–56136, 56207–56214, 57032–57033 …) | `specificTo: { kind: "competitive", encounterSetId: <card_set_code> }` |
| set `standard_pvp` | `EncounterSet.competitiveOnly: true` |
| `evidence_means` / `evidence_motive` / `evidence_opportunity` | `EvidenceCard` with `evidence: "means"` / `"motive"` / `"opportunity"` |
| `Attach to the enemy leader.` / `Attach to your leader.` (incl. as an `ifAble` side, and "Attack to Paladin" 56118, a MarvelCDB typo for "Attach") | `{ kind: "leader", of: "enemy" }` / `{ kind: "leader", of: "yours" }` |
| `Attach to a non-permanent side scheme.` | `qualified { category: "sideScheme", withoutKeyword: "permanent" }` |
| `Attach to an X or Y.` / `Attach to A or B.` | `anyOf` of the two parsed hosts |
| `the villain with the highest/lowest activation order value` | `superlative { among: "villain", measure: "activationOrder" }` |
| `the minion with the most traits` | `superlative { among: "minion", order: "highest", measure: "traitCount" }` |
| `Attach to the villain who is not the active villain.` | `{ kind: "nonActiveVillain" }` |
| traits `Activation Order N` (sm 27094–27099) | drop from `traits`; `VillainCard.activationOrder: N` |
| villain records `…a` / linked `…b` / unlinked `…c` of one stage (aoa 45184–45186) | one `VillainCard` with sides A, B, C |
| `spdr` 31001a/31001b | `separatedIdentity` from a second source for Peni Parker (31002), which MarvelCDB lacks |

### 6.13 Two validator fixes the pipeline reported (`docs/phase7-wave2-data.md` Part 1)

- **Main scheme text may be blank,** like a villain stage's: `stage.text` and `stage.aSide.text` use `isCardTextAllowEmpty`. Attack on Mount Athena (04061) prints a blank stage 1B and blank 2A/3A.
- **Boost icons have no upper bound:** a whole number of at least 0. Joystick (51039), Fixer (53038) and Blizzard (54034) print 4. `schema.test.ts`'s old "more than 3 is invalid" test now asserts the opposite, and fractions or negatives are refused.
- The exclusions `KNOWN_SCHEMA_GAP_MAIN_SCHEME_BLANK_TEXT` (`src/data/wave2.test.ts`) and `KNOWN_SCHEMA_GAP_BOOST_ICON_CAP` (`src/data/data-only.test.ts`) are removed; every emitted card validates.

---

## 7. Schema requests from the data pipeline (owner: `game-rules-architect`; landed 2026-09-19)

The confirmed schema gaps `card-data-pipeline` reported in `docs/phase7-wave2-data.md` (Part 1 §6, Part 3 §5), each
with a real card behind it. Landed in `packages/content/src/schema/**`, additively — every existing card still
validates and every existing test passes unchanged. Fixtures: `packages/content/src/schema/wave2-data-requests.test.ts`
(14 tests); the engine side, where there is one, is in `packages/engine/src/attachment-hosts.test.ts` (3 tests).

> **Progress / next up.** §7.1–§7.5 are landed. §7.6 was already closed by the §6.13 pass — the pipeline can drop
> both exclusion constants (they are already gone from `packages/content/src/data/**`; nothing to do). The one
> shape that is **data only** is §7.4's temporal qualifier, and §7.5's two keywords, each for the reason given.

### 7.1 `SuperlativeHostPool` `"ally"` and `HostMeasure` `"printedCost"`

- **Cards:** Beguiled (`valk` 25031), 'Pool-ized (`deadpool` 44041): "Attach to the ally with the highest cost
  without [this] attached."
- **Shape:**
  ```ts
  { kind: "superlative", among: "ally", order: "highest", measure: "printedCost", withoutAttachmentNamed: "Beguiled" }
  ```
- **The measure is named `printedCost`, not `cost`** — deliberately, to match the existing `printedHp`/`printedAtk`
  and the engine's own `ValueSpec printedCost`. RRG 1.8 "Printed" (p. 35): a card in play has no other cost, because
  cost modifiers change what a card costs *to play*, not what it costs once it is in play. **Pipeline: emit
  `measure: "printedCost"` for "the … with the highest/lowest cost".**
- **Validation:** `printedCost` is refused over an encounter-only pool (`minion`, `enemy`, `villain`), since only
  player cards print a cost; `ally` and `friendlyCharacter` are both accepted.
- **Engine, landed:** ranked like every other measure, and a candidate with no printed cost is dropped before ranking
  (`hasMeasure`), so a friendly-character pool ranks its allies and ignores the identity.

### 7.2 `AttachmentHost { kind: "encounterCard" }`

- **Card:** Coordinated Effort (`wonder_man` 58032): "Attach to an encounter card in play. Max 1 per encounter card."
- **Shape:** `{ kind: "encounterCard" }`; the second sentence is the existing `playRestrictions.maxPerHost: 1`.
- Any card in play on the encounter side, whatever its type (RRG 1.8 "Encounter Card", p. 18) — as opposed to
  `enemy`/`sideScheme`/`minion`, which name one category. **Engine, landed:** every in-play card with no controller,
  which is exactly the test `friendlyCharacter` inverts (RRG 1.8 "Friendly", p. 21).

### 7.3 `HostQualifiers.titleContains`

- **Card:** Warrior of the Great Web (`spiderham` 30029): "Attach to a character with 'Spider' in its title."
- **Shape:** `{ kind: "qualified", category: "character", titleContains: "Spider" }`. A case-sensitive substring; an
  empty string is refused (it would match everything). Usable on `superlative` too — both share `HostQualifiers` —
  and it counts as a qualifier for the "a `qualified` host needs at least one" rule.
- **The title only, not the subtitle.** RRG 1.8 "Subtitle" (p. 41) defines a subtitle as a separate line "beneath the
  title", so "Hawkeye (Kate Bishop)" does not match `"Kate"`. **Engine, landed:** matched against `currentName`, the
  face the card is currently showing — the same face `namedCard` compares against, so a flipped identity is matched
  on the face that is up. **Correction (§14.3):** true of encounter cards, not of identities — `currentName` answers an identity's card title in both forms.

### 7.4 `HostQualifiers.attackedThisTurnBy` — **data only**

- **Card:** Puncture Wound (`x23` 43012): "Attach to an enemy that X-23 or Honey Badger attacked this turn."
- **Shape:** `{ kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey Badger"] }` — the card
  titles whose attacks count. An empty list is refused (it could only mean "no host").
- **The only *temporal* qualifier in the set:** every other `HostQualifiers` field reads a static characteristic of
  the candidate, while this one reads history. **The engine records no per-turn attack history**, so the qualifier
  matches nothing and the attachment is discarded (RRG 1.8 "Attach To", p. 8; FAQ "Counterspell (#30)", p. 60) —
  chosen over guessing, and pinned by a test so it cannot drift into a silent half-implementation.
- **What it needs to become real:** a `GameState` record of "which characters attacked which enemies this turn",
  written where the `attack` / `enemyAttack` events resolve and cleared at each turn end (the same lifecycle
  `playedThisPhase` already has). A card using this qualifier must not be marked playable until then
  (docs/phase7-wave1.md §3.1).

### 7.5 The Fear No Evil keywords: Prerequisite and Starting

Both are on the Fear No Evil rulebook's "Featured Keywords" page (p. 3), which is **not in this repo**; RRG 1.8 has
no entry for either. So both glossary entries are `insert-not-in-repo` and `unverified: true`, exactly as `discount`
already is, and both are **data only**.

- **`{ name: "prerequisite", traits?: Trait[], form?: "hero" | "alterEgo" }`.** Printed
  `Prerequisite ([Defender]).` on Defend Our City (`jj` 61029), a player side scheme. `traits` is an OR, spelled like
  `discount`'s; `form` is the other half of the rulebook's "form or trait", which no emitted card prints yet. At
  least one of the two is required. The closest existing shapes are `PlayRestrictions.form` and
  `PlayRestrictions.requiresIdentityTrait`, which is most likely what it compiles to — **but what exactly the keyword
  gates is unconfirmed (§4.13).**
- **`{ name: "starting" }`,** no parameters. Its printed reminder text is the same on every card that has it (Innate
  Reflexes 60038; Innate Aggression/Perception/Inspiration 61034/61036/61037): "You may add this card to your hand
  before drawing your starting hand." It is a **setup** keyword, and the engine has no pre-opening-draw step to hang
  it on (Appendix II step 11 draws the opening hand); a card with it must not be marked playable until there is one.

### 7.6 The two older gaps — already closed

Both were closed in the §6.13 pass, before this one: a main scheme stage's `text`/`aSide.text` use
`isCardTextAllowEmpty` (Attack on Mount Athena 04061a prints a blank 1B and blank 2A/3A), and a minion's boost icons
are a whole number of at least 0 with no cap (Joystick 51039, Fixer 53038, Blizzard 54034 print 4). Both are now also
pinned from the pipeline's side in `wave2-data-requests.test.ts` §7.6. `KNOWN_SCHEMA_GAP_MAIN_SCHEME_BLANK_TEXT` and
`KNOWN_SCHEMA_GAP_BOOST_ICON_CAP` no longer appear anywhere in `packages/content/src`, so there is nothing for the
pipeline to remove.

### 7.7 Parser mappings this adds

| Raw text | Emit |
|---|---|
| `Attach to the ally with the highest cost without X attached.` | `{ kind: "superlative", among: "ally", order: "highest", measure: "printedCost", withoutAttachmentNamed: "X" }` |
| `Attach to an encounter card in play.` | `{ kind: "encounterCard" }` (+ `playRestrictions.maxPerHost` for "Max 1 per encounter card") |
| `Attach to a character with "X" in its title.` | `{ kind: "qualified", category: "character", titleContains: "X" }` |
| `Attach to an enemy that A or B attacked this turn.` | `{ kind: "qualified", category: "enemy", attackedThisTurnBy: ["A", "B"] }` (data only) |
| `Prerequisite (T).` / `Prerequisite (T1 or T2).` | `{ name: "prerequisite", traits: [T] }` / `traits: [T1, T2]` |
| `Starting.` (with or without its reminder text) | `{ name: "starting" }` |

### 7.8 Not requested, and not done

- **`iceman` 46002's "hero card in a set with no identity"** (also `fne`, `hercules`, `storm`). The pipeline asked
  for a decision, not a shape. It is **not** the Ant-Man/Wasp three-sided case (§1.1): 46002 is an ordinary signature
  upgrade that MarvelCDB files under its own `card_set_code`. Nothing in the printed card suggests a new mechanic, so
  the schema needs no change — this is a **curation-level set-code alias** (`iceman_frostbite` → `iceman`), which is
  the pipeline's own `Correction` machinery. Recorded here so it is not re-raised as a schema gap.

---

## 8. Blanking a whole class of cards' text (owner: `game-rules-architect`; landed 2026-09-19)

"Treat the printed text box of each [Tech] player card as if it were blank." (Tech Theft 12026, `ant`, a side
scheme's constant ability.) Recorded as not-done in §3.13.11 and built here as the focused refactor that note
described. Tests: `packages/engine/src/blank-text-box.test.ts` (6 tests). Every existing engine test passes
unchanged.

### 8.1 The shape

**`RuleSpec { kind: "blankTextBox"; target: TargetQuery; while?: Predicate }`** — the *constant* sibling of the
existing lasting `EffectSpec blankTextBox`, which blanks a fixed list of cards for a duration.

```ts
// "Treat the printed text box of each [Tech] player card as if it were blank." (Tech Theft 12026)
{ kind: "blankTextBox", target: { trait: TECH, categories: ["ally", "upgrade", "support"] } }
```

- **"Player card" is the category list, not `controller: "you"`.** The rule sits on an encounter card, which has no
  controller for "you" to resolve to, and the card says "each", not "your". The player card types in play are ally,
  upgrade and support.
- **What goes:** the card's abilities (constant, triggered and action) and its printed keywords — RRG 1.8 "Blank"
  (p. 10): the card "is treated as if it had no printed text in its text box". An attachment's printed stat box is
  outside the text box and still applies (ruling, Apr 30, 2026 (3) answer 4), as it already did for the lasting kind.
- **A rule never blanks its own source** (it would erase itself). Two rules blanking each other both apply, which is
  a stable answer that does not depend on the order cards are visited.
- It stops the instant the blanking card leaves play, like any constant.

### 8.2 The layer, and why it is not a predicate in the leaf

`blankedByConstantRules(state, deps)` / `textBoxBlankFor(state, id, deps)` (`select.ts`) sit between the rule and
`activeAbilityRefs`, `printedKeywordsOf` and `gameAbilityFrames`. §3.13.11 named two problems; both are solved here
rather than worked around:

1. **Recursion.** Finding the rule needs the in-play cards' live abilities, and matching its `{ trait: TECH }` target
   needs `traitsOf`, which needs them too. Cut exactly the way `traitsOf` already cuts trait grants: the scan reads
   each source's refs with the **lasting** blank check only, and evaluates the rule's own `target` and `while` under
   `DEFAULT_DEPS`, so granted traits and keywords are never consulted. **A card that has the trait only as a *grant*
   is therefore not blanked** — pinned by a test. A blanking rule cannot depend on another blanking rule, so one pass
   is a fixed point.
2. **Cost.** `activeAbilityRefs` is the engine's hottest read. Two memos keep the lookup O(1) amortized, both over
   inputs that are immutable for their lifetime and neither over anything the engine reads back as game state:
   - which ability ids carry the rule, per `EngineDeps` (one object for a whole game);
   - which cards are blanked, per `GameState` (replaced on every mutation, never edited in place).

   **A registry with no such rule — Core, wave 1 and all of cycle 1 — short-circuits on the first `WeakMap` hit, so
   nothing that exists today pays anything at all.**

`activeAbilityRefs(state, id, deps?)` and `printedKeywordsOf(state, id, deps?)` gained an optional `deps`; without it
they behave exactly as before (lasting blanks only), which is what the callers with no registry to hand want. It is
threaded through every reader where a blanked card's text must stop working: `activeRules`, `grantedKeywords`,
`traitsOf`, `statModifiers`, `attackForbidden`, the trigger scan, `gameAbilityFrames`, `legalActions`, the state
checks, and the action/resource-ability paths in `actions.ts`.

### 8.3 The perf regression test

`blank-text-box.test.ts` counts reads of `state.instances[...]` — the lookup every card read goes through — during
one full ability scan of the board, at 4 and at 20 filler cards. Measured both ways while writing it:

| build | rule in the pool, not in play | rule in play | overhead at n = 20 |
|---|---|---|---|
| memoized (this one) | 3.29× | 3.31× | 1.70× |
| per-lookup rescan (the cliff) | 9.86× | 9.94× | 2.39× |

Five times the board is five times the reads if the scan is linear and ~25× if it is quadratic, so the test's bound
of 5 sits with about 50% headroom on either side of the two builds.

---

## 9. Playing a card from inside an ability, at a reduced cost (owner: `game-rules-architect`; landed 2026-09-19)

"Hero Action: Exhaust Team-Building Exercise → play a card from your hand that shares a trait with your hero,
reducing its resource cost by 1." (12024 `ant` / 30022 `spiderham` / 46021 `iceman`.) Recorded as not-done in
§3.13.11 and built here. Tests: `packages/engine/src/primitives-wave2b.test.ts` §9 (3 tests).

### 9.1 The shape

**`playFromHand.costReduction?: ValueSpec`**, beside the existing `ignoreCost`. `ignoreCost` is no longer required,
so exactly one of the two modes is set; every existing caller passes `ignoreCost: true` and is unaffected.

```ts
// "play a card from your hand that shares a trait with your hero, reducing its resource cost by 1"
{ kind: "playFromHand", player: { kind: "controller" }, costReduction: { kind: "const", value: 1 }, filter: { trait: AVENGER } }
```

The reduction is carried explicitly down the pricing path (`pricePlay` → `playRequirement` → `ownPlayCost`, each with
a new optional `extraReduction`) rather than by creating a lasting `costReduction` effect and cleaning it up — no
state to add and remove, and `requirementUnmeetable` (§4.12) sees the reduced cost for free. The price is floored at
0 as every other reduction is.

**Resolution is a three-answer state machine on the effect frame's own vars** (`_play.step`), the way `assignDamage`
already works: pick the card → pick a host, if the upgrade names one and several are legal → pick a payment. Nothing
is spent until the last step.

### 9.2 The three judgement calls, and where the rules land

1. **Is a card the player cannot afford offered at all? — Settled by the RRG; followed.** RRG 1.8 "Initiating
   Abilities" (p. 24) step 3 makes "the player's ability to pay [the costs], taking modifiers into account" a
   condition checked *before* the card is played, and step 5 says a play whose costs cannot be paid "abort[s] this
   process without paying any costs". So an unaffordable card is not a legal choice, and a payment that falls short
   plays nothing and spends nothing. Both halves are pinned by test.
   - The affordability test is "does the largest payment the player could legally make for **this** card cover the
     reduced cost" — options that a "you can only spend [physical] resources to pay for this card" restriction
     forbids are dropped first (FAQ "Crushing Blow (#2)", p. 60), and `satisfies` is monotone, so no subset can
     succeed where the union fails. It can still over-offer in one narrow case (two resource abilities whose own
     costs conflict); that direction is safe, since the player then simply cannot complete the payment.
2. **May an event with its own ability cost be chosen? — Settled by the RRG; followed.** Step 3 says "the cost (or
   costs)", plural, so playing such an event means paying both. It is allowed, and both are charged.
   - **Capability limit, not a rules reading:** the ability's cost must be settleable without a further question.
     `planCost` fills in a pick with exactly one legal candidate; anything more ambiguous ("exhaust any number of
     allies") has nowhere to prompt from inside this effect, so the card is not offered. Widening this means a
     fourth prompt step, not a rules decision.
3. **Which host does an upgrade attach to? — Settled by the RRG; followed.** RRG 1.8 "Attach To" (p. 8): the host is
   checked when the card would be attached, and choosing among legal hosts is the playing player's. An upgrade that
   names no host goes on its own identity; one that names a host with a single legal candidate takes it without
   asking; several legal hosts is a prompt. No legal host means the card is not offered.

Nothing here needed an unconfirmed reading, so **no new §4 entry**. The one limit worth knowing is 2's capability
note above.

---

## 10. The Kang primitives (owner: `game-rules-architect`; landed 2026-09-19)

The two gaps `ability-scripting-engineer` recorded while scripting `toafk` (docs/phase7-wave2-scripting.md §6.13,
§6.14), plus the two sub-gaps each bundles. Tests: `packages/engine/src/game-areas.test.ts` (3 new, 14 total) and
`packages/engine/src/primitives-wave2b.test.ts` §10.1.

> **Progress.** All four landed. One of them — §10.4 — turned out to need **no new primitive**: the engine's join
> procedure already enforces the card, and the pass added a test that says so out loud instead of a rule nobody
> would read.

### 10.1 One pool across several zones (§6.14's second half)

**`CardSelector { kind: "anyOf"; of: CardSelector[] }`** — every card any listed selector names, each once, in the
order listed. The `CardSelector` sibling of `AttachmentHost.anyOf`.

```ts
// "Each player searches the encounter deck, discard pile, and set-aside area for their nemesis minion." (Kang's
// Wrath 4B, 11013; the same shape Marked for Death 04028 needs in `trors`.)
{ kind: "anyOf", of: [
  { kind: "encounter", zones: ["deck", "discard"], filter: { nemesisMinionOf: … } },
  { kind: "setAside", player: { kind: "scoped" }, filter: { … } },
] }
```

One pool and one choice over everything found, the way a multi-zone `zone` selector already works inside a player's
own zones. Nesting terminates but says nothing a flat list cannot.

### 10.2 Un-tucking a facedown card into play (§6.14)

**`TargetRef { kind: "tuckedUnder"; of: TargetRef; filter?: TargetQuery }`**, the ref sibling of the `tucked`
`CardSelector`. Tucked cards are **out of play** (RRG 1.8 "Tuck", p. 45), which is exactly why a ref was needed:
nothing that scans cards in play finds them, and `revealCard` takes a `TargetRef`.

```ts
// "Reveal each face down Kang's Dominion under this stage." (Kang's Wrath 4A, 11013a)
{ kind: "revealCard", cards: { kind: "tuckedUnder", of: { kind: "mainScheme", of: "central" }, filter: { name: "Kang's Dominion" } }, player: { kind: "firstPlayer" } }
```

No new effect was needed: `revealCard` already moves a card out of wherever it is (the `tucked` zone included) and
runs the whole reveal procedure on it, so a facedown tucked side scheme turns faceup and enters play the same way
one revealed off the encounter deck does.

### 10.3 Redirecting an acceleration token (§6.13's second half)

Two additive pieces:

- **`EffectSpec addAccelerationToken { target?: TargetRef; count?: ValueSpec }`** — `target` names the main scheme
  stage the token goes on; absent is the central one, which is where the encounter-deck reset puts it (RRG 1.8
  "Acceleration Token", p. 5). `count` is "1 acceleration token here for each side scheme in play".
- **`RuleSpec accelerationTokenDestination { to: TargetRef; while?: Predicate }`** — "Forced Interrupt: When an
  acceleration token would be placed on another scheme, place it here instead." (The Master of Time 2B, 11008b) →
  `{ kind: "accelerationTokenDestination", to: { kind: "self" } }`.

**Modeled as a constant redirect, not an interruptible event** — deliberately, and the same shape
`schemeThreatDestination` already uses for a scheme activation's threat. An event would have to be pushed as a
frame, which would defer the token past the point it is placed today and change the ordering of the encounter-deck
reset that places most of them. A token already headed for the rule's own scheme is left alone, so "another scheme"
cannot loop. Only a main scheme stage holds one in this model, so a redirect anywhere else does nothing.

Logging: `accelerationTokenAdded` gains an optional `schemeInstanceId`, present **only** when the token did not go
to the central stage, so every existing log line is byte-identical; a redirect also emits
`accelerationTokenRedirected { from, to }`.

### 10.4 "Cannot join a game area unless …" (§6.13's first half) — no primitive needed

**"Players cannot join this game area unless there are no other game areas remaining."** (The Master of Time 2B.)
The engine already does exactly this and always has: `executeJoinGameArea` offers the *separate* areas as
destinations and only dissolves into the central area when none is left. That follows from §3.1's own model — The
Once and Future Kang insert has a joining player "choose a game area", and the central stage "remains in play in a
central location … though it is not part of any other game area".

So no `RuleSpec` was added: a rule whose only card restates what the procedure already guarantees would be dead
code that reads like a safety net. What the pass added instead is an explicit test
(`game-areas.test.ts`, "a player joining while another area remains joins that area, never the central one"), so
the claim is asserted rather than assumed and a future change to the join procedure breaks visibly.

**If a later card restricts joining a *separate* area** (nothing in the pool does today), that is when the rule
becomes real; the shape to add is `RuleSpec cannotJoinGameArea { while?: Predicate }` on a card in that area,
filtering `executeJoinGameArea`'s destination list.

---

## 11. The pipeline's remaining schema requests, and the attack history (owner: `game-rules-architect`; landed 2026-09-19)

The three items `docs/phase7-wave2-data.md` Part 4 §5 marks "still open after §7", plus making §7.4's temporal
qualifier real. Tests: `packages/content/src/schema/wave2-data-requests.test.ts` §11 (16 total) and
`packages/engine/src/attachment-hosts.test.ts` (5 in the §7 block).

### 11.1 `HostMeasure "thw"` (request 2b)

Added beside the existing `atk`/`sch`. "Attach to the ally with the lowest THW without Possessed attached."
(Possessed, `storm` 36038) → `{ kind: "superlative", among: "ally", order: "lowest", measure: "thw",
withoutAttachmentNamed: "Possessed" }`.

**Current THW, not printed** — and the request asked for "printed THW". The printed card says "THW" with no
qualifier, and RRG 1.8 "Printed" (p. 35) makes "printed" the *explicit* word for the value on the card; the
existing unqualified `atk`/`sch` are current for the same reason. A `printedThw` can be added beside it the day a
card prints that wording; none does.

### 11.2 A villain face that prints no hit points (request 3)

**No new flip mechanism was needed.** The Collector (`gmw` 16080a/16080b) and Hela (`mts` 21136a/b) are the
existing `VillainCard.sides` A/B shape — one stage card with a front and a back face, same stage number, flipped by
card text — exactly what Green Goblin/Norman Osborn already uses. Confirmed against the raw data: `16080a`
(hp 8, "Forced Interrupt: When Collector would be defeated, … flip this card instead") has `linked_card` `16080b`
("Collector cannot be defeated. Forced Interrupt: When the round ends, flip this card, then set Collector's hit
point dial to his printed hit points."), same title, no `stage` of its own.

The one thing missing was that the back face **prints no hit points at all**, and `VillainStage.hp` is required:

**`VillainStage.hpNotPrinted?: boolean`.** `hp` stays required and holds the value that applies, because the hit
point dial carries across a flip (RRG 1.8 "Flip", p. 20; the Green Goblin insert, Risky Business "New Rules") —
which is also why the back face's own text has to say "set his hit point dial to his printed hit points" when it
flips back. The validator checks the flag is only on a later side **and** that its `hp` repeats the same stage
number's value from the face that does print them, so it is a *verified* carry-over rather than a number the
pipeline invented.

```ts
sides: [
  { side: "A", name: "Collector", stages: [{ stageNumber: 1, hp: flat(8), atk: 2, sch: 1, … }] },
  // "Collector cannot be defeated." — prints no hit points; the dial carries over.
  { side: "B", name: "Collector", stages: [{ stageNumber: 1, hp: flat(8), hpNotPrinted: true, atk: 2, sch: 1, … }] },
]
```

Chosen over the proposed `VillainStage.flipSide?: {…}`: a second flip mechanism next to `sides` would model the same
thing twice, and `hpNotPrinted` is additive — **no existing reader changes**, where making `hp` optional broke
three call sites in `packages/client` (`scenario-detail.ts`, `table-setup-preview.ts`), which this pass does not own.

**Parser mapping:** MarvelCDB's `stage: "A1"`/`"B1"` is standard-vs-expert, so emit **two single-stage
`VillainCard`s** (the way `toafk`'s Kang / Expert Kang split already is), each with sides A and B from its own
`…a`/`…b` pair. Note the labels are not the same thing as The Wrecking Crew's version "A"/"B", which the schema
already documents as consecutive *stages of one deck*.

### 11.3 `HostQualifiers.attackedThisTurnBy` made real (§7.4 was data only)

> **Revised by §14** (the review of this section): the value is now a list of `AttackRecord`s carrying the
> attacker's title at attack time, recording is limited to player turns, and the record is also cleared when a turn
> ends. The bullets below are as first landed; §14 has the current behaviour and the corrected citations. (RRG 1.8
> has no "Turn" entry, and p. 45 is "Tuck".)

**`GameState.attackedThisTurn: Readonly<Record<string, readonly InstanceId[]>>`** — keyed by the attacked
character, listing the attackers, each once, in the order they attacked. Plain serializable data, so it replays and
serializes like everything else.

- **Written** at the `characterAttacked` event (`resolve/event.ts`), which is the one place every attack goes
  through, player-made and enemy-made alike, so no path can forget.
- **Cleared when each turn begins** (`beginTurn`), next to the `"turn"` ability-use counters. ~~RRG 1.8 "Turn"
  (p. 45)~~ RRG 1.8 "Player Phase" (p. 34): each player takes one turn, so "this turn" is the one in progress.
- **Read** by `passesQualifiers` (`resolve/reveal.ts`): an enemy is a legal host when one of its attackers this turn
  shows one of the listed titles — matched by `currentName`, the same face `namedCard` compares against (an
  identity matches on its card title).

```ts
// "Attach to an enemy that X-23 or Honey Badger attacked this turn." (Puncture Wound, x23 43012)
{ kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey Badger"] }
```

**§7.4's "data only" note is superseded:** a card using this qualifier can now be marked playable. The pipeline's
`cardNotes` flag on 43012 can be dropped.

### 11.4 Not done: Hercules' Labor Deck (request 4)

`hercules` 59002–59004 — hero-owned, encounter-shaped cards (`faction_code: "hero"`, typed
`attachment`/`obligation`, printed "Victory 0." with a `When Revealed:` that attaches or plays them, no resource
cost, no deck slot). **Left open deliberately.** The pipeline proposed no shape and said so; neither does this pass,
because the question is not "which field is missing" but *what a hero-owned encounter card is* — whether it is a
player card that happens to be revealed, a scenario-specific card owned by an identity (§1.4's `specificTo` is the
nearest existing idea), or a third thing needing its own setup step like `IdentitySeparateDeck`. Guessing a shape
here would cost more to undo than to wait: it needs the Hercules rulebook, which is not in the repo.

---

## 12. "After you spend this card": the `resourcesSpent` trigger event (owner: `game-rules-architect`; landed 2026-09-19)

"Hero Response: After you spend this card, heal 2 damage from your hero if you are in Giant hero form or draw 1 card
if you are in Tiny hero form." (Pym Particles, `ant` 12006 / `wsp` 13007.) The same trigger is on Audacity (`valk`
25021), Everyday Hero (`nova` 28019), Preservation (`vision` 26021), Innovation (`warm` 23021), Stroke of Genius
(`ironheart` 29009) and Determination (`nebu` 22016). The interrupt form "When you spend this card [to play X]" is on
Effective Leadership (`cyclops` 33018), Molecular Acceleration and Passion for Justice (`gambit` 37010, 37016),
Defensive Energy (`rogue` 38017), Aggressive Energy (`wolv` 35020) and Energy Siphon (`wonder_man` 58006). Tests:
`packages/engine/src/spend-trigger.test.ts` (6 tests).

### 12.1 The shape

**`TriggerEventBody { kind: "resourcesSpent" }`.** One event per payment. It lists every card that payment
discarded from hand:

```ts
{
  kind: "resourcesSpent";
  cardInstanceIds: readonly InstanceId[];   // the cards spent from hand, in payment order — the event's *sources*
  playerId: PlayerId;                       // whose hand they came from: "you"
  forPlayerId: PlayerId;                    // whose cost they paid: "for a player" / "that player" (`eventPlayer`)
  payingForInstanceId: InstanceId | null;   // the card played, or the card whose ability's cost was paid
  purpose: "playCard" | "ability" | "effect";
}
```

**DSL (`@mc/cards`): `on.youSpendThis(opts?)`**, usable as `when.` (interrupt) or `after.` (response):

```ts
// "Hero Response: After you spend this card, deal 1 damage to the villain." (Audacity 25021)
heroResponse(after.youSpendThis(), dealDamage(1, theVillain))
// "Interrupt: When you spend this card to play an ally, that ally gets +1 THW and +1 ATK until the end of the phase."
// (Effective Leadership 33018): the played card is the event's target, so "that ally" is `eventTarget`.
interrupt(when.youSpendThis({ toPlay: { categories: ["ally"] } }), modifyStat("thw", 1, eventTarget, "endOfPhase"), …)
// "Hero Interrupt: When you spend this card to play an [Attack] event, that event deals 1 additional damage."
// (Aggressive Energy 35020; Passion for Justice's THWART version uses `threatRemoved`)
{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, damage: { kind: "const", value: 1 } }
```

`youSpendThis()` compiles to `{ on: "resourcesSpent", selfIs: "source", playerIs: "controller" }`. `toPlay` adds
`targetIs: <query>` and `eventIs: { purpose: "playCard" }`. The target is the played card **only** when
`purpose` is `playCard`, so "to play an ally" cannot match the cost of an ally's own ability. The Aggressive Energy
shape is pinned by a test: the bonus lands on the event before it commences being played, so its damage is 3, not 2.

### 12.2 The two rules calls, both settled by the RRG

1. **When it resolves: between paying and playing. Settled; followed.** RRG 1.8 "Initiating Abilities" (p. 24) pays
   costs in step 5, and "the card commences being played" in step 6. "Cost Arrow Icon" (p. 14): "Responses to the text
   preceding the cost arrow icon resolve before the text following the icon resolves." The ruling of Feb 28, 2026 (1)
   generalizes this to any cost: "Any abilities triggered by paying a cost resolve immediately before the effect
   following the arrow resolves." So every path that spends
   (`playCard`, `useAbility`, basic-power costs, events and abilities paid inside a window, `playFromHand` with
   `costReduction`, the `spendResources` effect) pushes the event **after** the frame it paid for, so the event
   resolves first. `payPayment` now returns the cards it spent, and the caller passes them to
   `announceResourcesSpent` once its own frame is pushed. Nothing is stashed in state. A payment no ability reacts to
   pushes no event (`heard`), so every existing log is byte-identical.
2. **Where the ability lives: the discard pile, for this event only. Settled; followed.** The card is discarded by
   the time anything can respond, and the trigger scan only reads cards in play. RRG 1.8 "Resource Card" (p. 37) says
   "Some resource cards have card text that is active while using the card to generate resources", and a spent
   resource "is also considered to be spent by that player's identity". So while a `resourcesSpent` event resolves,
   `spentCardCandidates` (`resolve/triggers.ts`) offers each spent card's own abilities on that event, and only those.
   The ability must be `selfIs: "source"` on `resourcesSpent`, and the spender controls it. Nothing else on a card in
   the discard pile comes alive.

**One event per payment, not one per card**, so that two spent cards' responses share one window and their controller
picks the order. RRG 1.8 "Response" (p. 38): responses to triggering conditions caused by one effect "can be resolved
in any order". One event per card would have fixed that order by payment order.

### 12.3 What it does not do (recorded, not guessed)

- **The interrupt window runs after the discard.** All costs are paid at once (RRG 1.8 "Cost", p. 13), and the
  event is pushed once they are. Every "When you spend this card" interrupt in the pool (bonus damage/threat on
  that event, stat boosts on that ally, draw a card, place a counter) reads the same either way. **Energy Siphon
  (58006)** is the exception: "take up to 3 damage → this card generates 1 additional [energy] resource for each
  damage taken this way". It changes what the card *generates*, which happens during pricing, before any payment is
  final. The event cannot express that, and **it stays unscriptable**. It needs a pricing-time hook on the card's
  own resource value (a `ResourceGeneration` computed from a cost paid inside the payment), which is a payment-model
  change, not a trigger.
- **`forPlayerId` always equals `playerId` today.** No payment spans players yet: Alliance (RRG 1.8 p. 6, "any player
  may contribute") is not built. Everyday Hero's "this card can be spent for any player" is a **payment permission**
  as well as a trigger, so its response half is scriptable (`eventPlayer` is the right ref) and its permission half is
  not. Keeping the two fields apart means the response is correct on the day cross-player payment lands.
- **A card in play spending itself** through a "Resource:" ability is not a card spent from hand, so it is not listed.
  No card in the pool says "after you spend this card" about such an ability.

---

## 13. "Until the end of this turn": `LastingUntil "endOfTurn"` (owner: `game-rules-architect`; landed 2026-09-19)

"Hero Response: After you change to Giant hero form, you get +1 ATK until the end of this turn." (Giant Strength,
`ant` 12009.) With one player, "this turn" and "this phase" end together. With two or more they don't: RRG 1.8
"Player Phase" (p. 34) has "each player (in player order) take[] one turn", so a turn ends before the phase does.
Tests: `packages/engine/src/turn-duration.test.ts` (3 tests, all with two players).

### 13.1 Sizing: every "this turn" in the emitted pool

A sentence-level scan of every `printed` text in `packages/content/src/data` (skipping the "when/after your turn
begins/ends" triggers, which are events and not durations) finds seven cards:

| Card | Wording | Needs | Status |
|---|---|---|---|
| Giant Strength (`ant` 12009) | "+1 ATK until the end of this turn" | `LastingUntil "endOfTurn"` | **landed** |
| Deft Focus (`magneto` 49023) | "the next superpower card you play this turn" | `reduceNextCardCost` `duration: "turn"` | **landed** |
| Puncture Wound (`x23` 43012) | "an enemy that X-23 or Honey Badger attacked this turn" | per-turn attack history | landed in §11.3 (reviewed in §14) |
| Gamora (`gam` 18006, 18007) | "if you have played a thwart/attack event this turn" | a per-turn **play history** readable by trait | **open** (below) |
| Lockjaw (`msm` 05018), Deadpool 44032 | "during your turn" | a condition on whose turn it is, not a duration | not requested; no change |

### 13.2 The shape

- **`LastingUntil` gains `"endOfTurn"`**, so `modifyStatUntil`, `grantTraitUntil` and `blankTextBox` all take it.
  `LastingDuration` gains `{ kind: "endOfTurn" }`.
  ```ts
  // "you get +1 ATK until the end of this turn" (Giant Strength 12009)
  modifyStat("atk", 1, yourIdentity, "endOfTurn")
  ```
- **`reduceNextCardCost.duration` gains `"turn"`** (DSL `NextCardCostDuration`). It maps onto the same `endOfTurn`
  duration: `reduceNextCardCost(you, 1, "turn", { trait: SUPERPOWER })`.
- **It expires in `finishTurn`**, the one place a turn ends (the `endTurn` command, or an applied `turnEnding`
  event). That is right after `turnEnded` is logged and before the next player's `turnStarted`, or before the
  end-of-phase steps. RRG 1.8 "Lasting Effects" (p. 26): "A lasting effect expires as soon as the timing point
  specified by its duration is reached." Expiry is logged as `lastingEffectEnded { reason: "expired" }`, like every
  other duration.

### 13.3 The one rules call: an "end of this turn" effect outside a turn. Settled by the RRG; followed.

The effect is **not created**. RRG 1.8 "Lasting Effects" (p. 26): "A lasting effect that expires at the end of a
specified time period can only be initiated during that time period." The villain phase and the end-of-player-phase
steps (discard, draw, ready) belong to no player's turn (RRG 1.8 "Player Phase", "Player Turn", p. 34).
`turnInProgress(state)` (`query.ts`) is the test: `step` is a player-phase `turn`. So if something makes Ant-Man change
to Giant form during the villain phase, Giant Strength's response resolves and gives nothing. `endOfAttack` already
does the same thing with no attack in progress. Pinned by a test that also checks an "end of the phase" effect made
at the same moment *is* created.

### 13.4 Open: "if you have played a [trait] event this turn" (Gamora)

This is a *read* of play history, not a duration, so it is not part of this primitive. It needs a per-turn record of
the cards each player played, readable by trait (a thwart *event* is the `Thwart` trait on an event). The existing
`playedByPlayerThisRound` is keyed by card type only, which cannot express it. The natural shape is
`GameState.playedThisTurn: Record<PlayerId, readonly CardId[]>`, cleared in `beginTurn` next to `attackedThisTurn`,
with a `Predicate { kind: "playedThisTurn"; player; filter: { cardType?, trait? } }` reading printed traits from card
data (the played card is in a discard pile by then). Not built this pass because no scripter has asked for it and
Gamora is not in a scheduled pack.

---

## 14. Review of the attack history (§11.3) (owner: `game-rules-architect`; landed 2026-09-19)

A review of §11.3 against the RRG, as item 3 of this batch. The mechanism was right: one write point at
`characterAttacked`, and plain serializable data. Four things were not, and are fixed here. Tests:
`packages/engine/src/attachment-hosts.test.ts` §7 block (3 attack-history tests, 2 of them new).

### 14.1 What changed

1. **The attacker's title is recorded when it attacks, from the faceup side.** RRG 1.8 "Identity" (p. 23): "If a
   card refers to a hero or alter-ego by title, it refers only to the identity with that title, and not to the other
   side of the card." §11.3 matched at *query* time through `currentName`, which answers an identity's **card**
   title whatever its form. So an identity whose card title differs from its hero face matched on the wrong string,
   and an alter-ego matched a qualifier naming the hero. The value is now
   ```ts
   attackedThisTurn: Readonly<Record<string, readonly AttackRecord[]>>
   interface AttackRecord { attackerInstanceId: InstanceId; attackerTitle: string }   // exported from @mc/engine
   ```
   The title comes from `titleShowing(state, id)` (`query.ts`): an identity's faceup face name, anything else's
   `currentName`. "That X-23 attacked" is a fact about the attack, so an X-23 who attacks and then changes to Laura
   Kinney still counts, and nothing is ever recorded under "Laura Kinney", since an alter-ego cannot attack. Both
   are pinned by tests. This replaces the shape §11.3 landed on this same branch; nothing outside the engine reads
   it. **Pipeline: no change.** `attackedThisTurnBy` still lists printed titles, which for an identity means its hero
   face title ("X-23").
2. **Only attacks made during a player's turn are recorded, and the record is also cleared when a turn ends.**
   Before, the villain phase's attacks piled onto the last player's record, and the end-of-phase steps read that
   player's attacks as "this turn". Outside a turn there is no "this turn" (RRG 1.8 "Player Phase" / "Player Turn",
   p. 34), which is the same reading as §13.3's `endOfTurn`. `recordAttackThisTurn` checks `turnInProgress`, and
   `finishTurn` clears the record next to the `endOfTurn` expiry. Pinned by a test that stops between the villain's
   attack and a minion's.
3. **The write moved out of `applyRetaliate`.** It is now its own call in the `characterAttacked` case of
   `applyEvent`. It was never retaliate's business, and a later change that skipped retaliate (for ranged, say)
   could have skipped it too.
4. **Citations.** §11.3 cited RRG 1.8 "Turn" (p. 45). No such entry exists; p. 45 is "Tuck". Corrected in
   `state.ts`, `flow.ts`, `resolve/event.ts`, the test and §11.3.

### 14.2 Behaviour to know

- An attack whose `characterAttacked` event is cancelled by an interrupt is not recorded, because the write is that
  event's apply step. RRG 1.8 "Cancel" (p. 11): cancel abilities "prevent [effects] from resolving".
- The same attacker attacking the same character twice in a turn is recorded once. The qualifier asks *whether*,
  not how often.
- Enemy attacks during a player's turn (quickstrike, "the villain attacks you" effects) are recorded against the
  character they attacked. No current qualifier asks about them, and recording them costs nothing.

### 14.3 Open: `currentName` and an identity's title (flagged, not changed)

The discrepancy in 14.1 point 1 is wider than this qualifier. `currentName` answers an identity's **card** title
in both forms, and it feeds every title-matching reader: `namedCard` refs, `TargetQuery.name`, the `name`
predicate, `titleContains` and `withoutAttachmentNamed`. By RRG 1.8 "Identity" (p. 23), "Spider-Woman" should not
match Jessica Drew, and `titleContains: "Spider"` should not match her in alter-ego form. For most identities the
card title equals the hero face title, so the visible effect is that **an alter-ego matches its hero's name**.
Fixing it means `currentName` returning `titleShowing`, which could change how existing scripts that name an
identity behave in alter-ego form. That needs a sweep of `@mc/cards` for identity names in queries and refs (an
`ability-scripting-engineer` + `rules-qa-engineer` pass), so it is **left for a dedicated change** rather than made
silently here.
