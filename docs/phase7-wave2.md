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

- **Team-Up's play half.** RRG 1.8 "Team-Up" (p. 43): "You cannot play this card unless there is a friendly character in play whose title or subtitle matches name 1 and a friendly character in play whose title or subtitle matches name 2." The Ant-Man insert says the same: "(hero or ally)".
  - Cards: Swarm Tactics ×2, Order and Chaos ×2.
  - Check it in `playRestrictionFault`, reading the identity's current face title.
- **`maxPerPhase`** is counted like `maxPerRound` (docs/phase7-wave1.md §3.10) and reset at each phase end. Card: Maximum Velocity.
- **An ally that doesn't count against the ally limit** (Stinger: "Stinger does not count against your ally limit.").
  - RRG 1.8 "Ally Limit" (p. 7): the check "occurs before abilities that resolve upon entering play".
  - Model: a constant `RuleSpec excludedFromAllyLimit { target: self }` read by `checkAllyLimits`.

### 3.6 Counting boost icons as an event (Scarlet Witch and many encounter cards)

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

- **The timing problem.** Ant-Man and Wasp allies enter with 0 hit points, and their counters come from "Interrupt: When [this ally] enters play". The defeat check must run after that interrupt window, not at the moment the ally arrives.
  - RRG 1.8 "Damage" (p. 14): "If a character has zero or fewer remaining hit points, it is defeated."
- **A counter-based hit point modifier** ("+1 hit point for each pym counter") reads its counter.
- **Open (§4.9):** with 0 counters the ally is defeated at once. That is the proposed reading, and it needs confirming.

### 3.10 Cards under and on other cards; ownership of scenario cards

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

- **"Look at the top card of any deck"** (Jessica Drew).
- **Each player searching for a different card.** Past Machinations: "Each player searches the encounter deck and discard pile for a different obligation and reveals it".
- **Random cards.** "1 random set-aside Captive ally"; "Discard 1 card at random from your hand".
- **Counting what was discarded.** "the number of printed resources on that card" (the Hawkeye ally); "each different type of resource icon discarded this way" (Mass Chaos).
- **A superlative over controlled cards.** "the highest-cost card you control" (Time-Travel Hijinks), using wave 1's `superlative`.
- **"For each side scheme in play, choose and exhaust a character you control."** Bitter Rival's errata (RRG 1.8 p. 66), under the updated "For Each" rule (RRG 1.8 p. 20).
- **"Place a status card on a character"** with a choice of status (Hex Bolt, 3+).
- **"the villain's stage number"** (Muster Courage, Running Interference, United We Stand, Browbeat): wave 1's `villainStageNumber`.

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
