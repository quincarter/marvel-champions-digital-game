# Phase 7 working spec: wave 11, the scenarios-and-campaign pass (Fear No Evil)

Pass 1b of `docs/phase7-wave11.md` (its §6.1 placeholder). Section numbers carry an **S** prefix so they never collide
with `docs/phase7-wave11.md` (pass 1a) or `docs/phase7-wave11-hero-packs.md` (pass 2, `H` prefix). The model is
`docs/phase7-wave10.md` (scenario records, primitives, build order) and the MC50 campaign sections of
`docs/phase7-wave9.md` (§2.9, §3.73–§3.78). Wave 1–10 §3 primitives and pass 1a's §3 are assumed. Agents do not edit
statuses or open questions; they report, and the main session flips them.

**Scope.** Fear No Evil's encounter half, 60065–60210, now transcribed from the Hall of Heroes scans into
`packages/content/scripts/marvelcdb/curation/fne-encounter/*.ts` (`villains-a.ts`, `villains-b.ts`, `kingpin.ts`,
`scenarios.ts`, `modular-campaign.ts`) and joined to `curation/fne.ts` as `addedRecords`; card text pointer
`docs/cards/by_pack/fne.md`. Six villain sets, five interchangeable scenario sets, the Kingpin scenario, six modular sets,
five campaign environments and the Typhoid Mary campaign ally. **Data state (2026-10-18):** records transcribed, not yet
emitted (another agent is emitting `fne` now); `fne.ts` has `scenarios: []`.

## S0. Sources read

- **RRG 1.8** (`mc_rulesreference_v18_compressed.md`, pages from the footer markers): Amplify Icon p. 7, "Cannot" p. 11,
  Crisis Icon and Damage p. 14, Excess Damage p. 19, Flip p. 20, Main Scheme p. 27, Modes of Play p. 28–29, Overkill
  p. 31, Patrol p. 32, Play Area p. 33, Player Elimination p. 34, Set Aside p. 39, Setup p. 40, Steady p. 41, Teamwork
  p. 43, Toughness and Tuck p. 45, Unique Icon pp. 45–46, Uses p. 46, Villainous p. 47, Vulnerable p. 48, Appendix II
  p. 51.
- **Errata:** none for this box (sources §6).
- **FFG rulings** (`marvel-champions-rulings-post-rrg-1-7.md`): January 26, 2026 R4 (2), April 30, 2026 R3 (2, 3),
  June 25, 2026 R4 (3) — environments flip, they are not revealed; a toughness ally entering play during campaign setup
  gains its tough card. February 28, 2026 R6 (a villainous minion's boost does not activate the villain). January 26,
  2026 R3 and March 6, 2026 R1 (excess damage dealt vs. overkill taken). None names an FNE encounter card.
- **MC60 rulebook** (`docs/campaign-modes/mc60_rulebook-web.pdf`): pages 3–5, 8–9, 13, 15, 17, 19, 21, 23, 26 and 28
  **rendered this session** (`docs/extract_pages.py`, 110 dpi) and read from the images; every "MC60 p." below is checked
  against the PDF. The markdown transcription loses the p. 26 Typhoid Mary / Getaway / Protection Racket / Raft FAQ
  layout and turns the p. 5 energy icon into `[wild]`; the images govern.
- **Repo, by name:** `packages/engine/src/campaign.ts` and `campaign/{ops,runner,result}.ts`; `spec.ts`, `abilities.ts`,
  `trigger-events.ts` kind unions; `keywords.ts`, `effects.ts` (`giveStatus`, `flipVillain`), `resolve/reveal.ts`;
  `packages/cards/src/campaigns/{index,composed-sets,aos,aoa}.ts`; `packages/cards/src/dsl`; the content `Scenario`,
  `Campaign` and `ScenarioCuration` types.

## S1. Schema and data needs (owner: `game-rules-architect`; data by `card-data-pipeline`)

### S1.1 Scenario records: one per main scheme, the underling villain a setup option

MC60 p. 5: "five of this expansion's scenarios combine one of five interchangeable main schemes with one of the five
interchangeable villains". The rulebook names a scenario by its main scheme ("the Protection Racket scenario", the log's
Scenario column), and step 5 of p. 9 picks the villain _for_ a scenario. So, as wave 10 made the leader the scenario and
the stages options (wave 10 §1.4), **the main scheme is the scenario and the villain is an option**: five records plus
Kingpin, not 25.

| Id                  | Main scheme (set)                   | Villain default | Encounter sets            | Modular (recommended, 2)       | Notes                                         |
| ------------------- | ----------------------------------- | --------------- | ------------------------- | ------------------------------ | --------------------------------------------- |
| `art-museum-heist`  | 60121 (`art_museum_heist`)          | option (§S1.2)  | villain set, scenario set | `cops`, `the_owl`              |                                               |
| `the-getaway`       | 60128 (`the_getaway`)               | option          | villain set, scenario set | `cops`, `drive`                |                                               |
| `protection-racket` | 60134–60138, one per player (§S3.1) | option          | villain set, scenario set | `disasters`, `tracksuit_mafia` | five main scheme cards, one shared printed 1A |
| `the-raft-breakout` | 60142 (`the_raft_breakout`)         | option          | villain set, scenario set | `the_owl`, `tombstone`         |                                               |
| `stop-the-presses`  | 60151 (`stop_the_presses`)          | option          | villain set, scenario set | `tombstone`, `tracksuit_mafia` |                                               |
| `kingpin`           | 60161 → 60162 (`kingpin`)           | 60159 (A1/A2)   | `kingpin`                 | `tombstone`, `tracksuit_mafia` | expert villain 60160 (B1/B2); no Standard set |

Every record: `modularSetCount: 2`; `standardSetCodes: ["standard"]` (core) except Kingpin (`[]`, MC60 p. 23:
"does **not** use the Standard encounter set, but still uses the Expert encounter set in Expert Mode");
`expertSetCodes: ["expert"]`. Kingpin: `villainStages` is the Collector shape (one double-sided card per mode, A1/A2
standard, B1/B2 expert; wave 3 §1.1), `victory: "finalVillainStage"` (defeating the "2" side). Main scheme stages from
the cards: Art Museum Heist 1B base 1[per_hero], target 9[per_hero], escalation X[per_hero] (star, X = 1 + Art
attachments on the villain); The Getaway 2/9/+2 per hero; Protection Racket 0/10/+1 fixed (each); The Raft Breakout
2/11/+1 per hero; Stop the Presses! 1/9/+1 per hero; The King's Gambit 3/11/+1 per hero; Endgame 0/7/+1 per hero.

### S1.2 The underling villain options (new field)

`Scenario.villainOptions?: { readonly options: readonly VillainOption[]; readonly defaultSetId: EncounterSetId }`,
`VillainOption = { villainSetId, villainCardId, villainStages, victory?, expertVillainCardId? }`. The four interchangeable
records carry the same five options (MC60 p. 5); `villainCardId` holds the default's card so every existing reader of
the field still works. Curated as `ScenarioCuration.villainOptionSetCodes` beside `villainSetCode` (the default).

| Set            | Cards       | Standard / expert     | Setup (MC60 p. 5; the cards)                                                                                     |
| -------------- | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `bullseye`     | 60065–60075 | I, II / II, III       | I sets aside Adamantium-Laced Spine (68A); II finds it and attaches it; III finds and reveals Deranged Bloodlust |
| `electro`      | 60076–60085 | I, II / II, III       | I and II find Electric Charge, attach it, 2[per_hero] charge counters; III adds 3[per_hero]                      |
| `hammerhead`   | 60086–60096 | I, II / II, III       | none                                                                                                             |
| `purple_man`   | 60097–60109 | I, II / II, III       | none                                                                                                             |
| `typhoid_mary` | 60110–60120 | 60110 (A) / 60111 (B) | Disturbed Psyche 60112 and Establish Trust 60113a (both Setup); the villain on a random side (§S3.4)             |

Default `hammerhead` (first of MC60 p. 8's recommended order). Typhoid Mary's option carries `victory: "cardAbility"`
(Disturbed Psyche: "If there are 3 or more tokens here, the players win the game!"); the others the default.

### S1.3 The campaign record

`Campaign { id: "fne", boxCode: "MC60", packCode: "fne", scenarioIds: [the six, in log order: AMH, Getaway, PR, Raft,
STP, Kingpin], campaignSetIds: ["fne_campaign"], logSheetReference: "docs/campaign-modes/log-sheets/mc60_campaign_log.pdf" }`.
`fne_campaign` holds 60205–60209 (environments, faction encounter, `a` Completed / `b` Failed, flipped by no card) and
60210 (ally, faction campaign, `a` Typhoid Mary / `b` Bloody Mary).

### S1.4 Shapes the normalizer must get right (verify while emitting)

1. Typhoid Mary 60110a/b and 60111a/b: each card's two faces print the **same** stage letter (A, or B) with different
   names. One villain card, two faces of one stage, flipped by Disturbed Psyche; not the MaGog A/B stage pair and not two
   versions.
2. Kingpin 60159 (A1/A2) and 60160 (B1/B2): the Collector mode+face shape (`MODE_LABEL_RE`).
3. Protection Racket 60134–60138: five main scheme cards, each a one-stage card (1A shared text, distinct 1B), quantity
   one each.
4. Two-type double-sided cards: Establish Trust 60113a (side scheme) / Mary Walker 60113b (attachment); Out Front 60129a /
   Alongside 60129b (attachments); Public Support 60163a/b (environment, traits Low / High).
5. Printed icons on non-schemes (wave 10 §1.7): crisis on Mystic Incursion, Sinking Ferry, Towering Inferno 60177–60179;
   acceleration on Wanted 60184; amplify on 60073, 60078, 60082, 60095, 60108; hazard on 60180; crisis on 60131, 60189.
6. Keywords: Vulnerable (Purple Man civilians 60101–60104, Cops 60182–60183, Tracksuit 60202–60203), Teamwork (Tracksuit)
   60200–60203, Permanent (60068a/b, 60079, 60113a/b, 60129a/b, 60143), Steady (60159b, 60160b), Stalwart (60159a,
   60160a), Hinder X (60108, 60131, 60180, 60185, 60189), Uses (60080, 60105–60107, 60153–60156, 60164, 60177–60179),
   Victory -1 (60210a/b), Setup (60112, 60113a, 60210a), Peril (60181), Surge, Guard, Patrol, Quickstrike,
   Toughness, Retaliate X, Villainous as printed.

## S2. Setup per scenario (MC60 pp. 5, 13–23; stage 1A Setup text)

Order: RRG 1.8 Appendix II (p. 51) with MC60 p. 9's campaign wrapper (§S5.3). "Check marks" are the scenario's
progress marks on the log (MC60 p. 9 step 3; the sheet's "1" and "2" boxes).

| Scenario          | Stage 1A Setup                                                                                                                                                                  | Campaign SETUP (MC60)                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Art Museum Heist  | Find the four Art attachments (60122–60125), attach one at random to the villain, shuffle the other three into the encounter deck                                               | p. 17: 1[per_hero] threat (2[per_hero] expert) on the main scheme per check mark                                                       |
| The Getaway       | 1 speed counter on the main scheme (2 in expert); attach Out Front (129A) to the villain                                                                                        | p. 19: one check: find and reveal Jackknifed Tanker Truck; two: 1[per_hero] (2[per_hero] expert) more threat on it                     |
| Protection Racket | Each player chooses one of the five main schemes (at random in expert), places it in their play area, flips it to 1B; the rest set aside out of play (§S3.1)                    | p. 13: 1 threat (2 expert) on **each** main scheme per check mark                                                                      |
| The Raft Breakout | Attach Master Key to the villain; each player discards from the encounter deck until a Prisoner minion and reveals it                                                           | p. 15: one check: a tough status card to each Prisoner minion in play; two: also a facedown boost card each                            |
| Stop the Presses! | Daily Bugle environment into play; each player puts a random Daily Bugle support (60153–60156) into play under their control; the rest removed from the game                    | p. 21: remove 1 stamina counter from each Daily Bugle support per check mark                                                           |
| Kingpin           | Each player reveals their set-aside nemesis minion; one sharing a title with a character in play is removed from the game and that player finds and reveals an Underling minion | p. 23: at least 3 Completed environments in play: a tough status card to each minion in play; at least 4: find and reveal James Wesley |

## S3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Statuses as in wave 10 (**new**, **extend**, **exists (verify)**,
**exists (compose)**), from a search by name (2026-10-18) of the `spec.ts` / `abilities.ts` / `trigger-events.ts`
unions, `campaign.ts` and `campaign/*`, and the `@mc/cards` DSL. Searches that found nothing are named in the
subsections.

| §     | Primitive                                                                                     | Needed by                                            | Status           |
| ----- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------- |
| S3.1  | A main scheme per player, in their play area; "the main scheme" read by play area             | Protection Racket                                    | new              |
| S3.2  | Swap a main scheme with a random set-aside one, carrying its threat                           | Change of Venue 60141                                | extend           |
| S3.3  | The underling villain as a scenario option (content field, builder, campaign hand-off)        | the five interchangeable scenarios                   | new              |
| S3.4  | A villain that starts on a random side; a flipped villain face's toughness                    | Typhoid Mary 60110/60111, 60112                      | extend           |
| S3.5  | "Cannot be dealt damage" (no damage is dealt, so no "would be dealt" window)                  | Kingpin 60159a/60160a, Jackknifed Tanker Truck 60131 | extend           |
| S3.6  | Boost cards gaining a Boost ability by encounter set                                          | Purple Man 60097–60099                               | extend           |
| S3.7  | Villainous on a player-controlled character                                                   | Black Cat 60169 as an ally (MC60 p. 26 FAQ)          | extend           |
| S3.8  | A minion treated as an ally while a condition holds; threat on a minion; taking control of it | Black Cat 60169                                      | extend           |
| S3.9  | Every ally matching a query treated as a minion (not only an attachment's host)               | Baron Zemo 60145                                     | extend           |
| S3.10 | Encounter minions tucked under a side scheme and revealed from there                          | Tracksuit Mafia 60200–60204                          | extend           |
| S3.11 | Choice graph: the finale node is never "available"                                            | campaign step 4                                      | extend           |
| S3.12 | A node's progress marks readable between games                                                | the five campaign SETUP blocks                       | extend           |
| S3.13 | A choice among the Completed nodes                                                            | Kingpin expert DEFEAT                                | extend           |
| S3.14 | Removal from the campaign by recorded title                                                   | campaign step 8                                      | extend           |
| S3.15 | Resolve the Setup ability of a card a campaign instruction put into play                      | 60205–60209, 60210                                   | extend           |
| S3.16 | Settled conflicts and readings (Vulnerable, Amplify, Steady, flips, unique nemesis minions)   | §S4.0                                                | exists (verify)  |
| S3.17 | Reusable as is                                                                                | the rest of §S6                                      | exists (compose) |

### S3.1 A main scheme per player (Protection Racket)

- **Text.** 60134a–60138a Setup: "Each player chooses a single Protection Racket main scheme (at random in expert mode),
  places it in their play area, and flips it to its 1B side. Set each unused main scheme aside, out of play." 1B: "If
  any main scheme is completed or any player is eliminated, the players lose the game."
- **Rules.** MC60 p. 13 "Separate Main Schemes": an event played or treachery revealed by a player, and any card in a
  player's play area, that says "the main scheme" means the one in that play area; a card in no player's play area (the
  villain, side schemes, environments) means **all** of them (a crisis icon guards each; an acceleration icon adds to
  each in step 1); "a scheme" (basic thwarts included) is any of them; an acceleration token goes near the villain and
  adds 1 to each. RRG "Play Area" (p. 33): engaged minions and controlled cards are in a player's play area.
- **Exists.** `GameState.extraMainSchemes` (Tower Defense, wave 4 §3.2: each gains threat, feels icons, can be
  completed); `RuleSpec focusedMainScheme { encounterCards: "focused" }` (wave 5 §3.3, one scheme for every card);
  `RuleSpec accelerationTokenDestination`. Separate game areas (Kang) isolate everything and do not fit. Searches that
  found nothing: `perPlayerMainScheme`, `playerMainScheme`, a play area field on `MainSchemeState`.
- **Shape.** `Scenario.mainSchemeChoice?: { kind: "perPlayer"; cardIds; expert: "random" }`; `GameSetupConfig.
  mainSchemeChoice?: { kind: "perPlayer"; cardIds; picks?: Record<PlayerId, CardId> }`; each pick becomes a `MainSchemeState` with `playArea: PlayerId` (the first
  as `mainScheme`, the rest in `extraMainSchemes`), the unpicked cards set aside. One resolver, `mainSchemesFor(state,
  speaker)`, used wherever "the main scheme" is read: a speaker in a player's play area (that player's cards, events and
  treacheries resolved by them, engaged minions) gets that area's scheme; any other gets all. Acceleration tokens go to
  the villain (`accelerationTokenDestination`) and add to each. Completion of any stage is the printed loss; elimination
  is a `stateCheck` → `endGame lost` on the main scheme card.
- **Tests.** Two players, Battle in the Bodega and Hung Out to Dry: an engaged minion's "place 1 threat on the main
  scheme" lands on its player's; a side scheme's acceleration icon adds to both; a basic thwart may target either; one
  completes → loss; one player eliminated → loss. Expert: picks drawn from the seed.

### S3.2 Swap a main scheme with a set-aside one

- **Text.** 60141 "Swap your main scheme with a random set-aside main scheme. Place the threat from the previous scheme
  on the new scheme." FAQ MC60 p. 26: "All cards attached to the previous main scheme are discarded."
- **Exists.** `EffectSpec swapCards` (in-play card ↔ out-of-play card). It does not know `MainSchemeState`.
- **Shape.** `swapCards` gains the main scheme case: the new card takes the old one's `MainSchemeState` slot and
  `playArea`, stage 1B faceup (no 1A Setup, no When Revealed: the text says swap, not reveal), its threat equal to the
  old one's; the old one goes set aside; attachments discarded (the FAQ). Logged `mainSchemeSwapped`.

### S3.3 The underling villain as a scenario option

- **Exists.** `CampaignOp composeVillain` and `CampaignGameStart.villain` (MC60 p. 9 step 5; `runner.ts`), not used by
  any box yet; `CampaignScenarioRef { kind: "composed" }`. The wave 10 builder pattern (`wave10Scenario`).
- **Shape.** §S1.2's field; `wave11Scenario(scenarioId, { villainSetId?, modularSetIds?, mode, ... })` in
  `packages/cards/src/wave11/setup.ts` swaps in the option's villain card, set, stages and victory; `playableScenarioOffer`
  lists the five villains. **Campaign nodes are `fixed`** to the five records, and `composition` runs `composeVillain`;
  the caller passes `start.villain` as `villainSetId`. `composed` stays unused (its doc comment is corrected to say so):
  a fixed record already names the main scheme and sets, and the villain set follows from the option.
- **Tests.** Each of the five villains against Art Museum Heist builds, standard and expert; a sixth set id is refused;
  Typhoid Mary's game is won by three tokens, not by the villain deck.

### S3.4 A villain starting on a random side; toughness on a flipped face

- **Text.** 60112 "Setup: Put the villain into play on a random side (and reveal it)." "Forced Interrupt: When the
  villain phase ends, flip the villain." FAQ MC60 p. 26: when Typhoid Mary (B) flips, "the ability or keyword on her new
  faceup side resolves" (Toughness on 60111a; When Revealed on 60111b).
- **Exists.** `flipVillain` keeps damage (same type, RRG "Flip" p. 20) and `flipCard` reveals the new face (Mojo FAQ,
  wave 6 §3.65). Toughness resolves only on entering play (`applyToughness` from `reveal.ts`).
- **Shape.** (a) Engine interpretation, marked in code: the villain enters at Appendix II step 8 as usual; Disturbed
  Psyche's Setup (step 11) draws a side from the game seed and flips to it **without** a reveal, so step 12c reveals the
  chosen face once (no double When Revealed). (b) A villain face revealed by a flip resolves the toughness keyword like
  an entering character (MC60 p. 26 FAQ; product text where RRG "Toughness" p. 45 is silent on flips).

### S3.5 "Cannot be dealt damage"

- **Text.** 60159a/60160a "Kingpin cannot be dealt damage or have upgrades attached"; 60131 "The villain cannot be dealt
  damage." Out Front 60129a: "When the villain would be dealt any amount of damage, remove that amount of threat …
  instead."
- **Rules.** RRG "'Cannot'" (p. 11) is absolute; RRG and the rulings separate damage dealt from damage taken (January
  26, 2026 R3; March 6, 2026 R1). Damage that cannot be dealt is never dealt, so no "would be dealt" interrupt fires:
  while Jackknifed Tanker Truck is in play Out Front removes no threat.
- **Exists.** `RuleSpec cannotTakeDamage` (taken). Searches that found nothing: `cannotBeDealtDamage`.
- **Shape.** `cannotTakeDamage.stage?: "dealt"`: the damage is dropped before the `dealDamage` interrupt window and
  logged `damageNotDealt`; retaliate and "after … attacked" still fire (an attack was made). `cannotHaveAttachments
  { from: "upgrade" }` covers the second clause.

### S3.6 Boost cards gaining a Boost ability by set

- **Text.** 60097–60099: "Each boost card from the Purple Man encounter set gains: '[star] Boost: After this activation,
  deal this card to yourself as a facedown encounter card.'"
- **Exists.** `RuleSpec gainsAbility { to }` reads cards **in play** only. `dealAsEncounterCard`, `atEndOfActivation`.
- **Shape.** `gainsAbility.to` may name boost cards (`zone: boost`, `fromEncounterSet`), read when a boost card is turned
  faceup; the gained ability is a `boost` ability like a printed one, cancellable by Betty Brant 60154 like any.

### S3.7 Villainous on a player-controlled character

- **Text and rules.** RRG "Villainous" (p. 47): "When a character with the villainous keyword uses a basic power, give
  it a facedown boost card". FAQ MC60 p. 26: Black Cat keeps villainous as an ally.
- **Exists.** `resolve/enemy-activation.ts` gives the card only to a minion's activation (`isMinion` gate).
- **Shape.** A `basicPowerUsing` interrupt for a friendly character with the keyword: a boost card from the encounter
  deck, turned faceup as the power resolves, its icons added to the stat used (THW for a thwart), its Boost ability
  resolved with the controller as "you", discarded after. Amplify does not add to it (§S4.0).

### S3.8 Black Cat: threat on a minion, an ally while it holds 4

- **Text.** 60169: "While there is 4 threat here, treat Black Cat as an ally that takes 2 consequential damage after she
  attacks or thwarts. Hero Action: Spend a [mental] resource → place 1 threat here. If there is 4 threat here, take
  control of Black Cat as an ally."
- **Exists.** `EffectSpec treatAsAlly` (Karma, a lasting effect with a source card), `placeThreat` on schemes, the
  ally limit.
- **Shape.** `placeThreat` accepts a minion target (the threat is a counter on a card, not a scheme's); `treatAsAlly`
  as a constant with `while` on the card itself; the take-control clause is the existing effect. Control returns to no
  one if the threat drops below 4 (the constant lapses); the threat stays.

### S3.9 Treat allies matching a query as minions

- **Text.** 60145 "Treat each ally with threat on it as a [Deceived] minion with a blank text box. Its SCH is equal to
  its base THW and it does not take consequential damage." FAQ MC60 p. 26: when Zemo leaves play they are allies again,
  under their owner's control, and keep the threat.
- **Exists.** `RuleSpec treatHostAsMinion` (on an attachment, its host). Converted 60100 uses it as is.
- **Shape.** `treatAsMinion { cards: TargetQuery, traits, schFromThw: "base" }` on any card, read live; the host form
  becomes `treatAsMinion { cards: host }`. Placing threat on an ally (60145's When Revealed) as in §S3.8.

### S3.10 Encounter minions tucked under a side scheme

- **Text.** 60204 "When Revealed: Discard cards from the top of the encounter deck until a [Tracksuit] minion is
  discarded and tuck that minion here. Forced Response: After a player reveals a [Tracksuit] minion from the encounter
  deck, that player reveals 1 minion tucked here." 60202/60203 When Defeated: "Tuck this card under the Tracksuit Mafia
  side scheme. Otherwise, …".
- **Exists.** `tuckCards` (player cards, villain stages), `discardEncounterUntil`, `revealCard`; RRG "Tuck" (p. 45).
- **Shape.** `tuckCards` from the encounter discard pile and from a defeat (in place of the discard) under an encounter
  card; `revealCard` from `tuckedUnder` (the revealing player chooses which). The side scheme leaving play discards them
  to the encounter discard pile (RRG p. 45).

### S3.11–S3.15 Campaign runner extensions

- **S3.11 Finale not available.** `availableNodeIds` evaluates `available` without the node (`filter(() => …)`), so
  Kingpin would be offered from the first choice. The `finale` node is left out of `available` and reached only through
  `finale.when` (MC60 p. 9 step 4: "If each scenario is either Completed or Failed, the players must choose the Kingpin
  scenario").
- **S3.12 Progress readable.** `CampaignPosition.progress` is not in `CampaignLogView` and no `CampaignValue` reads it.
  Add `CampaignValue { kind: "nodeProgress"; node: string }`; a node's composition copies it into a `working` number
  field the in-game SETUP reads through `ValueSpec campaignLog` (traced like any write).
- **S3.13 Completed nodes as a choice.** `CampaignChoiceSource nodes.filter` gains `"completed"` (MC60 p. 23 expert
  DEFEAT: "choose and flip one to its Failed side"); `markNode as: "failed"` already exists.
- **S3.14 Removal by title.** MC60 p. 9 step 8: "searches their deck for each card whose title is recorded … and removes
  those cards". `withoutRemovedCards` matches by card id; add `removeFromCampaign { byTitle: true }` so every printing
  of a recorded title leaves every deck. A deck left below minimum is the campaign deck editor's existing check.
- **S3.15 Setup ability of a campaign-placed card.** An `inGame` instruction puts 60205a/b–60209a/b (and 60210a) into
  play from `setAsideCards`; their "Setup:" abilities then resolve (MC60 p. 9 step 12). `gameAbilityFrames(…, ["setup"])`
  exists for setup-keyword cards at step 11; add `putIntoPlay.resolveSetup: true`. Not a reveal (environments are put
  into play, and flipping or placing one is not revealing: January 26, 2026 R4 (2), April 30, 2026 R3 (3)).

### S3.17 Reusable as is (checked by name; the scripting agent proves each "(verify)" in its module test)

| Printed text (cards)                                                                                                        | Existing vocabulary                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Charge, speed, civilian, stamina, support, spot, stilt, grip, drain, barrage, command counters                              | named `CardInstance.counters`, `addCounters`/`removeCounters`, `counterAtLeast`                                               |
| "Uses (2 civilian counters)" on an environment; last counter removed discards it (60177–60179)                              | `uses` keyword (RRG p. 46: any card) (verify on an environment)                                                               |
| Crisis / acceleration / hazard / amplify icons on environments, obligations, schemes                                        | `BaseCard.schemeIcons`, `amplifyIcons`, `iconsInPlay` (wave 10 §1.7)                                                          |
| "When X would take damage, place it here instead … if N or more damage here, discard" (60068a, 60117, 60167, 60186–60188)   | `replaceTriggeringEvent` + `placeDamage` on self + `stateCheck` (verify)                                                      |
| "Prevent all but 3 of that damage" (60068a)                                                                                 | `maxDamageTakenPerAttack`-style amount, `preventDamage` (verify)                                                              |
| "Each of his boost cards gains [boost]" (Bullseye); Lady Bullseye's extra card                                              | `boostIconsCounting`, `giveBoostCard`, `adjustBoostCount` (verify)                                                            |
| "remove 1 charge counter → give Electro an additional boost card; this attack gains overkill" (60079)                       | forced interrupt with a counter cost, `giveBoostCard`, `attackKeywords`                                                       |
| "When an upgrade you control would ready … Otherwise, that upgrade does not ready" (60080)                                  | `cardReadying` interrupt, `cancelTriggeringEvent` (verify)                                                                    |
| "Deal 1 damage … for each boost icon on the discarded card" (60081)                                                         | `countBoostIcons`                                                                                                             |
| Hammerhead's "attacks and damages … stun; if already stunned, deal 1"                                                       | `attack` response, `hasStatus`, `giveStatus`                                                                                  |
| "Hammerhead attacks that character again" (60089); "Bullseye activates against you" (60074)                                 | `attack`, `enemyActivation`                                                                                                   |
| "+X SCH, X the highest THW among characters in play" (60091); "SCH equal to the number of Maggia enemies" (60092)           | `superlative`, `count` (H3.10 covers the "other characters" variant)                                                          |
| "After a minion is defeated, give it to the villain as a facedown boost card" (60094)                                       | wave 10 §3.10                                                                                                                 |
| Influenced minions gain guard / villainous / patrol; "Each minion gains the [Influenced] trait" (60108)                     | `grantKeywordUntil`-style constants, `grantTraitUntil`, trait query                                                           |
| Converted 60100: ally as an Influenced minion, SCH = base THW                                                               | `treatHostAsMinion { schFromThw }` (verify "base")                                                                            |
| "Fight." / "Protect." / "Serve." Forced Action with Uses (60105–60107)                                                      | Forced Action (`actions.ts` `forcedActions`, MC60 p. 4) (verify)                                                              |
| Vulnerable minions (civilians, Cops, Tracksuit)                                                                             | `vulnerableTo`, `statusAheadOfDamage` (wave 9 §3.1)                                                                           |
| Typhoid Mary "would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit points"                 | `defeat` interrupt, `replaceTriggeringEvent`, `placeDamage` on an environment, `setRemainingHitPoints` (verify)               |
| Disturbed Psyche "3 or more tokens here, the players win"                                                                   | `stateCheck`, `threat` + `damage` values, `endGame won`; `Scenario.victory: "cardAbility"`                                    |
| Establish Trust ↔ Mary Walker (side scheme ↔ attachment, tokens discarded, RRG Flip p. 20); Out Front ↔ Alongside           | `flipCard` / `flipToOtherFace`, `reveal: true` for Alongside (MC60 p. 19) (verify)                                            |
| "Attached villain cannot activate" (60113b); Telekinesis' Hero Action discard                                               | `cannotActivate`, Hero Action with a resource cost                                                                            |
| Art pieces: attached to the villain or a hero, "attach this card to your hero" (60122–60125); stat box on any host          | `attach` / `replaceAttachHost`, attachment stat modifiers (verify on a hero)                                                  |
| "After an enemy makes an undefended attack against an identity, attach 1 Art attachment on that identity to the villain"    | `attack` response with `undefended`, `attach`                                                                                 |
| Out Front "remove that amount of threat from the main scheme instead (ignoring crisis)"; FAQ p. 26: patrol too              | `replaceTriggeringEvent` → `removeThreat`, encounter source unaffected by crisis (RRG p. 14)                                  |
| Escort Vehicle keywords by speed counters (60130)                                                                           | constants with `while counterAtLeast`                                                                                         |
| Traffic Jam threat added/removed "here instead" (60189)                                                                     | `schemeThreatDestination` (verify the removal half; else an extend appended to §S7)                                           |
| Bull in a China Shop: excess damage to an ally as threat (60135b)                                                           | `excessDamageAsThreat` (RRG p. 19 "dealt")                                                                                    |
| "(Limit once per phase in standard mode.)" (60134b)                                                                         | ability limit with a mode `while`                                                                                             |
| Shop Proprietor 60139, Daily Bugle supports 60153–60156: encounter cards in play under a player's control                   | `putIntoPlay { controller }`, `entersRevealersPlayArea` (verify)                                                              |
| "If a [Daily Bugle] support leaves play … the players lose" (60151b)                                                        | `RuleSpec leavingPlayLoses`                                                                                                   |
| Betty Brant cancels a boost card's icons and Boost; Robbie Robertson looks at a dealt card                                  | `cancelBoostIcons`, `cancelBoostAbility`, `lookAt`, `dealEncounterCard`                                                       |
| Master Key / Mysterio: deal that activation's minion / treachery boost cards to yourself facedown                           | `boostCardOf`, `dealAsEncounterCard` (verify before the boost discard)                                                        |
| Absorbing Man: tuck the top card of your deck; +1 ATK per resource type tucked                                              | `tuckCards` from a deck, `resourceTypes`                                                                                      |
| Imprisoned: "cannot thwart, attack, or change to alter-ego"; cost "exhaust characters with total THW 3 or more"             | `cannotThwart`, `cannotAttack`, `cannotChangeForm`; the cost (verify)                                                         |
| Cop "When Cop would scheme, it attacks the villain instead" (60182)                                                         | `enemyAttacksEnemy` (wave 10 §3.20)                                                                                           |
| Vehicle attachments to "the enemy with the highest ATK without a [Vehicle] attachment"                                      | `AttachmentHost superlative`; `HostQualifiers.withoutAttachmentTrait` is read by `attachment-hosts.ts` (E17, done 2026-10-18) |
| Mister Fish engages the player with the fewest remaining hit points                                                         | `engage`, `superlative remainingHp`                                                                                           |
| Kingpin "When Kingpin would attack you, he schemes instead"                                                                 | `replaceTriggeringEvent` (as 60061, pass 1a)                                                                                  |
| Public Support: counters at 2[per_hero]+2 flip Kingpin and advance to 2A; High: "Interrupt: … instead"                      | `villainPhaseBegins`, `flipCard`, `advanceMainScheme`, a player interrupt on an encounter card                                |
| King's Gambit "Hero Action: Remove 5 threat from here …"                                                                    | an encounter card's action any player takes (crisis: RRG p. 14)                                                               |
| Nemesis access: reveal a random card of your set-aside nemesis set; your nemesis minion activates; your nemesis side scheme | `encounterSetAside`, `signatureSideSchemeOf`, `enemyActivation`, `find` (verify)                                              |
| Kingpin setup: a nemesis minion "shares a title with a character in play"                                                   | `named` title predicate (title only, not RRG unique matching)                                                                 |
| Teamwork (Tracksuit)                                                                                                        | `resolveTeamwork` (RRG p. 43)                                                                                                 |
| Hit List, Swoop Down, Cold as Ice, Hard as Marble, Beetle, Flight Serum                                                     | indirect damage to the first player, per-enemy activations, `AttachmentHost superlative`                                      |

## S4. Rulings and open questions

### S4.0 Conflicts and readings settled by the authority order

| Topic                                    | Decision and source                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vulnerable** (sources §7.1)            | RRG 1.8 p. 48: a vulnerable character that would be defeated by damage and become stunned or confused at once "is discarded before the damage is applied and is not considered defeated". MC60 p. 3's "the first player chooses" yields. Already built (`statusAheadOfDamage`); add the comment below at `wouldDiscardAsVulnerable`.                          |
| **Amplify** (sources §7.2)               | RRG 1.8 p. 7: amplify adds only to boost cards turned faceup "during an enemy activation". MC60 p. 4's "while using a basic power" yields. The one box card where they differ is Black Cat as an ally (§S3.7): her boost card gets no amplify icon. Comment at the amplify count in `modifiers.ts`.                                                           |
| **Steady** (sources §7.3)                | No conflict in effect. MC60 p. 3's extra sentence ("remove all status cards of the corresponding type") is what RRG 1.8 already does: a stunned status card resolves as "remove **each** stunned status card from it instead" (Stun, p. 41), a confused one likewise (Confuse, p. 13). Kingpin 60159b/60160b (steady) use the existing keyword. Comment only. |
| Flips are not reveals                    | Public Support's flip and the campaign environments placed on a side resolve no When Revealed (January 26, 2026 R4 (2); April 30, 2026 R3 (3); June 25, 2026 R4 (3)). A villain's flip reveals the new face (MC60 p. 26 FAQ, as the Mojo FAQ); Alongside's When Revealed resolves on the flip because MC60 p. 19 says so; Psionic Slash says "reveal".        |
| Toughness at campaign setup              | A toughness character entering play during campaign setup gains its tough card (April 30, 2026 R3 (2)).                                                                                                                                                                                                                                                       |
| Nemesis minion vs. the underling villain | Daredevil's Bullseye 60033 against the Bullseye villain, Jessica Jones's Purple Man 61031 against Purple Man: RRG 1.8 "Unique Icon" (pp. 45–46), already built (wave 10 §3.8: discarded, a facedown card dealt). Only the Kingpin scenario's own text removes the minion from the game instead (60161a, MC60 p. 23).                                          |
| Main schemes in play areas               | "Cards in this play area" includes engaged minions (RRG "Play Area", p. 33); an upgrade "played into this play area" (60137b) is one its controller plays (the same entry).                                                                                                                                                                                   |
| Expert player defeated in a won game     | MC60 p. 9: rejoins "by following the Campaign Setup instructions for healing their identity". The owner's MC45/MC50 decision (2026-10-08/09, wave 9 §4.1 Q14 = A) applies: recorded at 0, step 11 heals REC, or the seat sits the scenario out (`defeatedSeatRecordsZero`, `sitOutScenario`).                                                                 |
| "Trust Established?"                     | Victory blocks: "at least 2 threat" on Disturbed Psyche; p. 5: "more threat than damage". The game ends at three tokens, so the two agree in every reachable state; the definition uses the victory text.                                                                                                                                                     |

Code comment for the three conflicts (one each, at the reader named above):
`// MC60 p. 3 (p. 4 for amplify) words <keyword> differently; RRG 1.8 p. <n> governs (CLAUDE.md authority order: the RRG over product text). No FFG ruling reconciles them (rulings file through August 13, 2026).`

### S4.1 Rules questions for the owner

Only what the order does not settle. Until a question is answered, A is built.

| Q   | Question                                                                                                                                          | A (default)                                                                                                                                                                                                           | B                                                                                                | Decision                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| 201 | Allies and Persona supports removed from the game in a **lost** scenario: recorded on the log?                                                    | No. Only the VICTORY blocks print "Record the title of each unique ally and support that was removed"; a retry restores them                                                                                          | Yes, after every game: p. 5's tip says such cards "are gone for the rest of the campaign"        | **A** (owner, 2026-10-18) |
| 202 | MC60 p. 9 steps 10–14 (hit points, heal, environments' Setup, the Typhoid Mary ally, the scenario's SETUP) come after "Proceed with player setup" | After mulligans (`afterMulligans`): the box's own order; 60207b's "discards 1 card from their hand" only bites after the draw                                                                                         | RRG 1.8 Appendix II step 13 (p. 51): campaign setup before step 14's draw                        | **A** (owner, 2026-10-18) |
| 203 | Stop the Presses! Setup removes the unused Daily Bugle supports from the game: are their titles recorded at Victory?                              | No: record only cards that were in play when removed (the Bullseye cards' targets); the setup removal is housekeeping                                                                                                 | Yes, as printed ("each unique … support that was removed from the game"), emptying 60209a's pool | **B** (owner, 2026-10-18) |
| 204 | Protection Racket: when the **villain** schemes, where does the threat go?                                                                        | Only on the main scheme of the player it is activating against, as for minions (FFG Fear No Evil preview, 2026-04-16: enemies "including both the villain and their minions" add threat only to that player's scheme) | On every main scheme: MC60 p. 13 reads "the villain" as in no play area, so all schemes          | open                      |

Question 202 is not settled by the order because RRG step 13 hands the content of campaign setup to "its associated
rulebook", and this rulebook's sequence places player setup inside it; only this box words it so (searched the other
nine transcriptions for "player setup"). The engine's `beforePlayerSetup` window (step 8) is unaffected either way.

## S5. The campaign definition (`FNE_CAMPAIGN_DEFINITION`, `packages/cards/src/campaigns/fne.ts`)

> **Status: not started (compose, after §S3.11–§S3.15).** A `choice` graph, `progressNode`, `markNode`,
> `composeVillain`, `setAsideCards`, `LossPolicy.retry: "byInstruction"`, `everyNodeDefeat`, the `afterMulligans`
> window, `remainingHitPointsCappedAtBase`, `cardsRemovedFromGame`, `cardsInVictoryDisplay` and `threatOn` all exist and
> name MC60 in their doc comments.

### S5.1 Log fields (MC60 p. 28)

| Field                              | Label (sheet)                                         | Scope   | Type                              | Notes                                                  |
| ---------------------------------- | ----------------------------------------------------- | ------- | --------------------------------- | ------------------------------------------------------ |
| `remainingHp`                      | Remaining hit points                                  | perSeat | `number`, min 0                   | `whenModes: { expertCampaign: true }`; p. 9            |
| `villain.<node>` ×5                | Villain (one per scenario row)                        | shared  | `choice` over the five underlings | step 5                                                 |
| `completed.<node>` ×5              | Completed                                             | shared  | `flag`                            | mirrors `position.resolved`; the sheet's left column   |
| `unrecordedVillains`               | List of Villains                                      | shared  | `strikeList` (the five)           | struck as each is recorded; step 5c draws the rest     |
| `removedTitles`                    | Allies and Persona Supports Removed from the Campaign | shared  | `cardList`                        | step 8, by title (§S3.14)                              |
| `trustEstablished`, `maryDefeated` | Trust Established? / Mary Defeated?                   | shared  | `flag`                            | pp. 13–21 VICTORY                                      |
| `firstPlaythrough`                 | (working)                                             | shared  | `flag`, `working`                 | asked once, at the first `beforeChoice` (p. 9 step 5b) |
| `checks`                           | (working)                                             | shared  | `number`, `working`               | the chosen node's progress marks (§S3.12)              |

The progress boxes "1", "2" and "Failed" are `position.progress` and `position.resolved` (`progressToFail: 3`); the
Dossier draws them from there.

### S5.2 Graph

`{ kind: "choice", nodes: [amh, getaway, protection, raft, presses, kingpin], progressToFail: 3, finale: { nodeId:
"kingpin", when: and(nodeResolved(each of the five)) }, available: const true }` (with §S3.11). `beforeChoice`, ids
`mc60.choice.<name>`, MC60 p. 9:

1. `playthrough` — once (`when: not(fieldIsSet(firstPlaythrough))`): group choice, "first time through" or not.
2. `drawA` — `random` 1 from `excludingTitles(nodes unresolved, const "kingpin")` (steps 1–2).
3. `drawB` — `random` 1 from the same source less `choice(drawA)`.
4. `progress` — `progressNode(choice(drawA))`, `progressNode(choice(drawB))`; `if not(choiceMade(drawB))` a second
   `progressNode(choice(drawA))` (step 3: "If there was only one environment drawn, mark two boxes instead").

Each node's `composition` (step 5): `if fieldIsSet(villain.<node>)` → `composeVillain(field)`; else `if
firstPlaythrough` → the first unstruck of Hammerhead, Bullseye, Electro, then a group `choose` between Purple Man and
Typhoid Mary while both are unstruck (p. 8 item 4); else `random` from `fieldOptions(unrecordedVillains, unstruckOnly)`;
then `setField villain.<node>`, `strike unrecordedVillains`, `setField checks = nodeProgress(<node>)`. Kingpin's
composition is only the environment and ally set-asides below.

### S5.3 Instructions

| Instruction                    | Step                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| every `surgery` (step 8)       | `betweenGames`: `removeFromCampaign { byTitle }` of `removedTitles` (§S3.14)                                                                                                                                                                            |
| every `environments` (step 12) | composition: for each of the five, `if nodeResolved(n, completed)` → `setAsideCards(<code>a)`, `if failed` → `<code>b`; `inGame`, `afterMulligans` (Q202): put each into play, resolve its Setup (§S3.15), in log order                                 |
| every `hp` (step 10)           | `inGame`, `afterMulligans`, `expertCampaign`: `setRemainingHitPoints` from `remainingHp`                                                                                                                                                                |
| every `heal` (step 11)         | `inGame`, `afterMulligans`, `expertCampaign`: each player may deal themself 1 facedown encounter card and heal REC; a seat at 0 must, or sits out (§S4.0)                                                                                               |
| every `mary` (step 13)         | composition `if and(fieldIsSet(trustEstablished), not(fieldIsSet(maryDefeated)))` → `setAsideCards(60210a)`; `inGame`: put it into play under a chosen player's control                                                                                 |
| amh / presses / … `setup`      | `inGame`, `afterMulligans`: the §S2 campaign SETUP bullet, `checks` from `campaignLog`; expert amounts by `{ expert: true }`                                                                                                                            |
| kingpin `setup`                | `inGame`: count Completed environments in play (`hasTrait Completed`); ≥3 tough to each minion; ≥4 find and reveal 60165                                                                                                                                |
| every underling VICTORY (×4)   | `record`: `trustEstablished` ← `atLeast(threatOn(60112), 2)`; `maryDefeated` ← `atLeast(cardsInVictoryDisplay(60210), 1)`; `removedTitles` append `cardsRemovedFromGame(unique ally or support)` (Q201, Q203); `markNode completed`, `completed.<node>` |
| every underling DEFEAT         | `loss.everyNodeDefeat`, `expertCampaign`: `progressNode(<node>)`                                                                                                                                                                                        |
| every game                     | `remainingHp` ← `remainingHitPointsCappedAtBase`, victory and defeat, `expertCampaign`; `defeatedSeatRecordsZero`                                                                                                                                       |
| kingpin VICTORY                | `endCampaign won`                                                                                                                                                                                                                                       |
| kingpin DEFEAT                 | standard: none (retry). `expertCampaign`: `if` any node completed → group `choose` from `nodes completed` (§S3.13) → `markNode failed`; else `endCampaign lost`                                                                                         |

`loss: { retry: "byInstruction", retryBaseline: "nodeStart", citation: "MC60 pp. 9, 13, 23" }`; `elimination: { id:
"mc60.elimination", citation: "MC60 p. 9", whenModes: { expertCampaign: true } }`. Version `"1"`.

**Tests** (`packages/cards/src/campaigns/fne.test.ts`, `fne.qa.test.ts`): a seeded five-node run where a draw fails a
scenario (three marks) and its Failed environment enters the next game; the one-environment double mark; first
playthrough villain order with the Purple Man / Typhoid Mary choice; a lost standard game progresses nothing, an
expert loss progresses; Kingpin offered only last; expert Kingpin loss flips a Completed node and replays, with none
left the campaign is lost; Typhoid Mary ally enters after "Trust Established?" and stops after "Mary Defeated?"; a
removed Daredevil ally (60039) leaves every deck by title; persistent hit points across two games.

## S6. Card coverage (module paths under `packages/cards/src/wave11/fne/`)

"§" names the primitive each module waits on; "—" means §S3.17 only.

| Module                           | Cards                                                         | Needs                    |
| -------------------------------- | ------------------------------------------------------------- | ------------------------ |
| `villains/bullseye.ts`           | 60065–60075                                                   | —                        |
| `villains/electro.ts`            | 60076–60085                                                   | —                        |
| `villains/hammerhead.ts`         | 60086–60096                                                   | —                        |
| `villains/purple-man.ts`         | 60097–60109                                                   | §S3.6, §S3.9 (Converted) |
| `villains/typhoid-mary.ts`       | 60110–60120                                                   | §S3.4                    |
| `scenarios/kingpin.ts`           | 60159–60176                                                   | §S3.5, §S3.7, §S3.8      |
| `scenarios/art-museum-heist.ts`  | 60121–60127                                                   | —                        |
| `scenarios/the-getaway.ts`       | 60128–60133                                                   | §S3.5                    |
| `scenarios/protection-racket.ts` | 60134–60141                                                   | §S3.1, §S3.2             |
| `scenarios/the-raft-breakout.ts` | 60142–60150                                                   | §S3.9 (Zemo)             |
| `scenarios/stop-the-presses.ts`  | 60151–60158                                                   | —                        |
| `modular/disasters.ts`           | 60177–60181                                                   | —                        |
| `modular/cops.ts`                | 60182–60185                                                   | —                        |
| `modular/drive.ts`               | 60186–60190                                                   | —                        |
| `modular/the-owl.ts`             | 60191–60194                                                   | —                        |
| `modular/tombstone.ts`           | 60195–60199                                                   | —                        |
| `modular/tracksuit-mafia.ts`     | 60200–60204                                                   | §S3.10                   |
| `campaign/environments.ts`       | 60205a/b–60209a/b (Setup abilities, 60206b's expert constant) | §S3.15                   |
| `campaign/typhoid-mary-ally.ts`  | 60210a/b                                                      | §S3.15                   |

## S7. Task queue (one primitive, one villain, one scenario or one set per task)

At most three agents at once, file sets disjoint. "After N" is a dependency. Each task reports files touched and a
handoff note; the main session verifies and pushes.

**Data (`card-data-pipeline`)**

1. D1 — Emit `fne`'s encounter half and check §S1.4 items 1–6 against the emitted records (in progress elsewhere).
2. D2 — §S1.2 schema field `Scenario.villainOptions` + `ScenarioCuration.villainOptionSetCodes`, validation. After E3's
   shape is agreed (same commit as E3 if one agent).
3. D3 — The six scenario records (§S1.1) and the `fne` campaign record (§S1.3) in `fne.ts`. After D1, D2, E1.

**Engine (`game-rules-architect`), one primitive each**

4. E1 — §S3.1 per-player main schemes (schema `mainSchemeChoice`, setup, `mainSchemesFor`, loss rules).
5. E2 — §S3.2 main scheme swap. After E1.
6. E3 — §S3.3 `wave11Scenario` builder and offer; `CampaignScenarioRef` comment fix. After D2.
7. E4 — §S3.4 random starting side; toughness on a flipped villain face.
8. E5 — §S3.5 `cannotTakeDamage.stage: "dealt"`.
9. E6 — §S3.6 `gainsAbility` to boost cards.
10. E7 — §S3.7 villainous for player-controlled characters.
11. E8 — §S3.8 threat on a minion; `treatAsAlly` as a constant.
12. E9 — §S3.9 `treatAsMinion { cards }`. After E8 (threat on an ally).
13. E10 — §S3.10 encounter minions tucked under a side scheme and revealed from there.
14. E11 — §S3.11 finale excluded from `available`.
15. E12 — §S3.12 `CampaignValue nodeProgress`.
16. E13 — §S3.13 `nodes { filter: "completed" }`.
17. E14 — §S3.14 removal from the campaign by title.
18. E15 — §S3.15 `putIntoPlay.resolveSetup`.
19. E16 — The three §S4.0 code comments (Vulnerable, Amplify, Steady); no behavior change.
20. E17 — Read `HostQualifiers.withoutAttachmentTrait` in `packages/engine/src/attachment-hosts.ts` (`passesQualifiers` and the superlative filter), beside `withoutAttachmentNamed`, with a test (Sports Car skips an enemy that already has a Motorcycle). Found in review 2026-10-18.
21. E18 — Not needed (checked 2026-10-18): an attack that defeats its defending ally already names that ally with `defeated` set; `defenderLeftPlay` is only for a defender gone before damage (RRG 1.8 p. 9 step 5, FAQ #17 p. 63). The failing Hammerhead test stacked a second boost card that was dealt as an Assault instead.
22. E19 — An `attacker` scope on `attacksLoseKeywords` (today `rules.ts` reads only `target`), so Deadly Sai 60070 can say "Bullseye's attacks lose ranged" itself and beat any grant, Out Front 60129a included (RRG 1.8 "Lose", p. 27). Then drop the workaround in `fne/villains/bullseye.ts`. Found in review 2026-10-18.

**Scripting (`ability-scripting-engineer`), one module each (§S6)**

20. S1 — Scaffold `wave11/fne/` encounter registry, coverage guard entries, `card-groups.ts` rows. After D1.
21. S2 — Hammerhead. After S1.
22. S3 — Bullseye. After S1.
23. S4 — Electro. After S1.
24. S5 — Purple Man. After S1, E6, E9.
25. S6 — Typhoid Mary. After S1, E4.
26. S7 — Art Museum Heist (scenario set + a Hammerhead game to a win and a loss). After S2, E3.
27. S8 — The Getaway. After S7, E5.
28. S9 — Protection Racket. After S7, E1, E2.
29. S10 — The Raft Breakout. After S7, E9.
30. S11 — Stop the Presses!. After S7.
31. S12 — Kingpin (villain, schemes, set; Echo's Kingpin nemesis removed at setup). After S1, E5, E7, E8.
32. S13 — Disasters. After S1.
33. S14 — Cops. After S1.
34. S15 — Drive. After S1.
35. S16 — The Owl. After S1.
36. S17 — Tombstone. After S1.
37. S18 — Tracksuit Mafia. After S1, E10.
38. S19 — Campaign environments and the Typhoid Mary ally (`campaign/*.ts`). After E15.

**Campaign and QA**

39. C1 — `FNE_CAMPAIGN_DEFINITION` (§S5) and its unit tests. After E11–E14, S19, D3.
40. C2 — Campaign e2e in `fne.qa.test.ts`: five games and Kingpin, standard and expert, seeded. After C1 and every S task.
41. Q1 — `rules-qa-engineer`: one test per §S4.0 row and per MC60 p. 26 FAQ (Typhoid flip, Out Front vs. crisis and
    patrol, Change of Venue attachments, Baron Zemo leaving play, Black Cat villainous), colocated or in a dated `qa-`
    file. After the modules they test.

Client and Guided mode (the choice board with the progress boxes, the villain picker, the per-player main schemes, the
Daily Bugle supports, cards tucked under Tracksuit Mafia; `docs/campaign-client-per-box.md` line 83) are a separate
`game-client-engineer` brief once C1 lands.
