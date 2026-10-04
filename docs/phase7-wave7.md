# Phase 7 working spec: wave 7 (cycle 7, NeXt Evolution)

This is the shared brief for every agent working Phase 7's seventh content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3) and open questions with proposed defaults (§4). The model is
`docs/phase7-wave6.md`; wave 1–6 §3 primitives are assumed. The definition of done is
`docs/wave-definition-of-done.md`: **the box's campaign ships in this wave.** If you change a decision here, update this
file in the same change. Agents do not edit statuses or open questions; they report, and the main session flips them.

**Wave 7** is our `cycleId("cycle7")`. RRG 1.8 Appendix VI (p. 71), item 7: "The _NeXt Evolution_ campaign expansion,
the _Psylocke Hero Pack_, the _Angel Hero Pack_, the _X-23 Hero Pack_, and the _Deadpool Hero Pack_." Packs: `next_evol`
(MC40, with Cable and Domino), `psylocke`, `angel`, `x23`, `deadpool`. The spec is written in passes so each stays small:

| Pass   | Scope                                                                                                         | State             |
| ------ | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| **1a** | **The cycle's cross-cutting rules; Morlock Siege and On the Run; Military Grade, Mutant Slayers, Nasty Boys** | **this document** |
| 1b     | Juggernaut, Mister Sinister, Stryfe and their modular sets                                                    | not written       |
| 1c     | The MC40 campaign and campaign cards 190–203, Hope Summers set                                                | not written       |
| 2a     | Cable, Domino and the box's player cards                                                                      | not written       |
| 2b     | Psylocke, Angel                                                                                               | not written       |
| 2c     | X-23, Deadpool and the 'Pool aspect                                                                           | not written       |
| 3      | Ordered engine build queue                                                                                    | not written       |

- **Pass 1a's content.** Player side schemes, the assault keyword, the per player icon on player cards and alliance
  (the rules every pack of the cycle leans on); scenario 1 Morlock Siege (main schemes 40077/40078, the seven Marauders
  villains 40070–40076, set `morlock_siege` 40079–40089) and scenario 2 On the Run (40103/40104, set `on_the_run`
  40105–40111); modular sets Military Grade (40090–40093), Mutant Slayers (40094–40102), Nasty Boys (40112–40117).
- **Not in this pass:** anything a later pass owns, even where a card is named here to show a primitive composes.
  Placeholders are marked **(pass N)**.
- **Data state (2026-10-04):** `psylocke`, `angel`, `x23` and `deadpool` are already emitted as data-only packs under
  `packages/content/src/data/` (`data-only.test.ts` pins them to `cycle7`); `next_evol` is raw only
  (`packages/content/raw/marvelcdb/next_evol.json`, 216 records). The data survey is
  `docs/phase7-wave7-data-survey.md` (another agent).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The NeXt Evolution rulebook, `docs/campaign-modes/mc40_next_evolution_rulebook-web.pdf` (24 pages), converted in
     `docs/campaign-modes/markdown/mc40_next_evolution.md`, cited as "MC40 p. N" (PDF page = printed page). Pages read
     for this pass: 2–7, 9, 11, 21, 24. Pages 8, 10, 12 and 13 are full-page art.
   - Card text: `packages/content/raw/marvelcdb/next_evol.json`, every record of the sets named above read for this
     pass, plus every `player_side_scheme` record of the five packs. Not an authority on its own. Scan read:
     `assets/card-art/bundles/cards/40092.png` (Inhibitor Collar; gitignored, never committed). Scans exist for
     40070a/b–40076a/b, 40077–40079, 40081a/b and 40053; the data agent should read 40081a/b and 40105a/b against the
     raw text before emitting them.
2. **FFG rulings, Dec 17, 2025 to Aug 13, 2026**, in `marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading.
   The ones this pass leans on:
   - Aug 3, 2026 (5): Team Investigation's "printed cost scales with player count: In a 2-player game, printed cost is
     **4**" (§1.3, §3.4).
   - Aug 3, 2026 (1): a player side scheme's defeat is a Forced Interrupt that follows interrupts to the last threat
     being removed (Acute Tactility on Focus the Senses); the engine's `schemeDefeated` order already matches (§3.1).
   - Feb 28, 2026 (4) #2: quickstrike resolves before When Revealed (Mutant Slayers grants quickstrike; teamwork follows
     wave 6 §4.1 Q2).
   - Jun 25, 2026 (4) #5: characters not under a player's control are not friendly (not needed for Morlock allies,
     which players control).
   - Aug 3, 2026 (4): negative victory values (Morlock's Victory -1 only matters to a campaign score; none in MC40).
3. **RRG 1.8 (Jul 2026)**, `mc_rulesreference_v18_compressed.pdf`, cited by printed page (every cite below checked
   against the PDF with pypdf: printed page = 1-based PDF page). Entries this pass leans on: "Alliance" (p. 6), "Ally
   Limit" (p. 7), "Assault" (p. 8), "Attacks Against Allies" and "Basic Power" (p. 10), "Card Types" and "Choose
   (Option)" (p. 12), "Cost" (p. 13), "Hinder X" and "Hit Points" (p. 22), "'Instead'" (p. 25), "Per Player Icon" and
   "Permanent" (p. 32), "Player Card" (p. 33), "Player Side Scheme", "Player Side Scheme Limit" and "Player Turn"
   (p. 34), "Printed" (p. 35), "Quickstrike" (p. 36), "Replacement Effect" (p. 37), "Scheme (Card Type)" (p. 39),
   "Steady" (p. 41), "Teamwork (Trait)" (p. 43), "Unique Icon" (pp. 45–46), "Victory X" (p. 46), "Villain Defeat"
   (p. 47), Appendix I's identity-extension list (p. 49: "Player Side Schemes — Triggered abilities that resolve from
   player side schemes in play under a player's control are **not** considered to be performed by that player's
   identity"). Cycle 7's FAQ is on p. 64 and its errata on p. 69; the one entry in this pass is Inhibitor Collar (#92).
4. **`docs/phase7-wave7-sources.md`**, checked by the main session. Where it differs, this file is the architect's
   reading; the differences are reported to the main session rather than edited:
   - Its §3.1 says "The RRG FAQ also has an entry for the campaign card Assault (#197)". That entry is on p. 58 under
     the **Core Set** heading and is about the Standard set's treachery Assault. `next_evol` 40197 is Safehouse. It has
     nothing to do with the assault keyword.
   - Its §2 lists "Pages 5–6: Campaign Mode Rules". MC40 p. 5 is Hope Summers, Attacks Against Allies, Per Player
     Costs, Victory Display and Amplify Icon; campaign mode rules are p. 6; campaign player side schemes and the
     expert campaign are p. 7.
   - Its §2 "Notable mechanics" calls player side schemes a "campaign-specific mechanic". The card type is general
     (13 in the box, 7 of them ordinary deck cards, and 6 more across the four hero packs); only 40190a–40195a are
     campaign cards. Its "environment adds threat to scenarios" is not what MC40 p. 11 prints for scenario 2 ("put that
     environment into play and give each enemy a tough status card"); scenarios 3–5 are pass 1c's to check.
   - Its §6 item 5 says "cost × playerCount in setup". RRG p. 32: "the number of players who **started** the scenario",
     read whenever the cost is read, not fixed at setup.

**Rulebook versus RRG, found in this pass** (each is an open question in §4.2, not decided here):

| Topic                                            | MC40                                                             | RRG 1.8                                                                        | §4.2 |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- |
| "Attacks you" abilities when an ally is attacked | p. 5: "do **not** trigger"                                       | p. 10: "resolve against the attacked player"                                   | Q5   |
| A revealed minion matching the villain's title   | p. 21: discarded, "must reveal an additional encounter card"     | p. 46: discarded, "the player revealing it is dealt a facedown encounter card" | Q4   |
| Teamwork: who activates                          | p. 4: "each minion that shares the teamwork keyword … activates" | p. 43: "the minion that just entered play activates"                           | —    |

Teamwork is the same disagreement as MC32 p. 3, already decided by the user (wave 6 §4.1 Q1: RRG 1.8; Q2: before When
Revealed). It is not asked again; the Nasty Boys use the built keyword.

---

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-04), nothing landed.** Every keyword this pass's cards print (alliance, assault, guard,
> hinder, patrol, permanent, quickstrike, retaliate, steady, stalwart, surge, teamwork, toughness, victory) is already
> a `KeywordInstance` in `packages/content/src/schema/keywords.ts`.

### 1.1 Player side scheme: the card type exists; three additions

`PlayerSideSchemeCard` (`packages/content/src/schema/cards/player-cards.ts`: `type: "player_side_scheme"`,
`CostedCard`, `resourceIcons`, `startingThreat: ScalingValue`) and its normalizer
(`packages/content/scripts/marvelcdb/normalize/player-cards.ts`) have existed since wave 1; the four hero packs' six
player side schemes are emitted with it. RRG 1.8 "Player Side Scheme" (p. 34), "Card Types" (p. 12: seven player card
types), MC40 p. 3 (anatomy: title, type, ability, cost, resources, starting threat, classification).

- **Starting threat.** Raw `base_threat` with `base_threat_fixed: false` is per player (Call for Backup 40018 prints
  "3[per_hero]", MC40 p. 3) → `perPlayerOnly(3)`; `base_threat_fixed: true` is flat (Technovirus Purge 40006, 5).
  The data agent confirms the emitted hero-pack cards follow this.
- **Addition 1, scheme icons.** `showingIconsOn` (`packages/engine/src/rules.ts`) returns `[]` for a player side
  scheme. `BaseCard.schemeIcons` already exists for non-scheme cards (wave 3 §1, the amplify icon); a player side scheme reads
  it too.
  Needed by Live Dangerously (`deadpool` 44024, amplify; pass 2c). No schema change, one engine line (§3.1).
- **Addition 2, a campaign player side scheme has no cost and an environment on its other face** (40190a–40195a:
  cost "–", "4[per_hero]", `linked_card` an environment). `cost: 0, specialCost: "dash"` and a `flipSide` of a
  different card type. Wave 2 §1 noted "a back face of a different card type is still not modeled"; wave 6 §1.8
  modeled side scheme → ally/environment for the MC32 campaign cards. **(pass 1c)** decides whether that shape covers
  a player card front.
- **Addition 3, the limit exemption** is card text ("This scheme does not count against the player side scheme
  limit", 40190a–40195a), so it is an ability rule (§3.2), not a data field.
- **No new field for control.** The player who played it controls it (RRG p. 49 above); it sits in the villain's play
  area (`Zone villainArea`), as `play-card.ts` already does.

### 1.2 Assault: no schema change

`{ name: "assault" }` is in `KeywordInstance` and the glossary (`schema/glossary.ts` id `assault`). Printed in this
cycle on Territorial Control (40087, an encounter side scheme) and Keep Them Busy (`x23` 43018, a player side scheme).

### 1.3 Per player icon on a printed cost: `CostedCard.costPerPlayer`

RRG 1.8 "Per Player Icon" (p. 32): "The [per player] icon next to a value multiplies that value by the number of
players who **started** the scenario. If a player is eliminated, this value does not change." MC40 p. 5: "The cost of
these cards is the numeric value multiplied by the number of players who started the scenario" (example: 2[per_hero],
three players, six resources). Ruling Aug 3, 2026 (5): the **printed** cost scales too.

- **Cards.** Team Investigation (40053, 2[per_hero]) and Break Time (`deadpool` 44046, 3[per_hero]). Raw
  `cost_per_hero: true` (`raw-types.ts` declares it; the normalizer drops it: 44046 is emitted today as `cost: 3`).
- **Decision: `CostedCard.costPerPlayer?: true`**, with `cost` holding the printed numeral. Not a `ScalingValue`:
  every existing reader of `cost` takes a number, the icon never comes with a flat part, and a boolean keeps the
  generated data diff to two cards. Validation: not with `specialCost`. The engine reads cost through one function
  (§3.4), so the multiplied number is what "printed cost" means everywhere.
- **Data fix for the data agent:** re-emit 44046 with the flag once the field lands.
- Per player icons inside ability text ("Remove 3[per_hero] threat") are values in the script (`perPlayer`/`scaled`
  `ValueSpec`, existing). Hinder already has `perPlayer` (`hinder` keyword; The Senator's Support 40093, "Hinder
  1[per_hero]").

### 1.4 Alliance: no schema change

`{ name: "alliance" }` exists (wave 4 §3.17). Team Investigation (40053), Flying Formation (`angel` 42031), Break Time
(44046) carry it in raw text; the survey confirms the emitted keyword.

### 1.5 The Marauders: seven villains, two mode faces each, one stage each

MC40 p. 9: "Morlock Siege has seven different villains. Only one villain will be in play at a time, but the order is
randomized … the players must defeat three of these villains." "Flip each villain (A) to its villain (B) side for
expert mode." 40077a Setup: "Shuffle the villains together (without looking) to create the villain deck. The top card
of this deck is in play."

- **The Mansion Attack shape, unchanged** (wave 6 §1.4): each physical card is two one-stage `VillainCard`s, 40070a
  (standard) and 40070b (expert) … 40076a/b; hit points per player (`health_per_hero`). `villainCardId`,
  `setAsideVillainCardIds` (the other six), `expertVillains`, `startingVillain: "random"`, `victory: "cardAbility"`.
  No `multipleVillains`.
- **Not `victoryCondition`:** the count is 3 in every mode and is printed on the main scheme ("If there are 3 villains
  under Routed, the players win the game"), so it is the stage's own state check.
- **Dashed stats:** Blockbuster A and Harpoon A print no SCH in raw (`scheme` absent), Vertigo A no ATK. The data
  agent checks the scans (40071a, 40074a, 40076a) for a printed 0 versus "—"; the Marauders set shows "SCH 0" for
  Blockbuster A in MC40 p. 2's callout, so these are expected to be 0, not dashes.
- **On the Run** uses the same fourteen records: one villain at random, the rest removed from the game (§3.13).

### 1.6 Routed: one environment, two mode-only faces

40081a "Standard Mode Only." / 40081b "Expert Mode Only." One `EnvironmentCard` with a `flipSide`, each face's
`modeOnly` set (`schema/cards/encounter-cards.ts`, wave 4 §3.18, the Standard II / Public Outcry precedent). No change.

### 1.7 Morlock allies: encounter-set allies under a player's control

Morlock (40079, ×4): an ally printed in an encounter set (`morlock_siege`), "Victory -1. Does not count against your
ally limit. Card abilities cannot remove this ally from play." The Captive-ally shape (wave 4 §3.8, wave 6 §3.20 and
§3.71: an `AllyCard` with `cardFamily: "encounter"`, set aside at setup, put into play under a player's control). The
four copies and Hide! (40080) are in `Scenario.setAsideCardIds`. `{ name: "victory", value: -1 }` is valid
(`keywords.ts`: "negative on Snitches Get Stitches").

### 1.8 Hope's Captor: a double-sided permanent attachment

40105a (CONFIDENT) / 40105b (DESPERATE, +1 SCH +1 ATK): one `AttachmentCard` with a `flipSide`, `{ name: "permanent" }`
on both faces, traits per face, no "Attach to" line (the 1A Setup attaches it): `Correction.impliedAttachHost` → the
villain (wave 5 §1.9). The b face's stat box applies only while that face shows (per-face stats, as wave 5 §1.3's
per-face `schemeIcons`; the data agent checks the attachment face type carries `atk`/`sch`).

### 1.9 Conditional attach hosts

| Card                                                    | Printed                                                                                         | Data                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Bolstered by Wrath 40082, Pushed to the Limit 40083     | "Attach to the villain."                                                                        | `{ kind: "villain" }`, existing.                                                                                              |
| Heavy Armament 40090                                    | "Attach to the enemy with the highest ATK."                                                     | A superlative host. Existing if `minionWithHighestPrintedHp`'s sibling covers "enemy" and ATK; else a small addition (§3.16). |
| Titanium Exoskeleton 40091, Hidden in the Clutter 40106 | "Attach to the enemy with the fewest remaining hit points."                                     | As above, measure remaining hit points.                                                                                       |
| Inhibitor Collar 40092                                  | "Attach to your identity."                                                                      | `{ kind: "yourIdentity" }`, existing. Stat box ATK −1 (scan read).                                                            |
| Favored Weapon 40107                                    | "Attach to Greycrow or Harpoon. Otherwise, attach to the [MARAUDER] enemy with the lowest ATK." | A named host with a fallback host: §3.16.                                                                                     |

### 1.10 Placeholders

- **(pass 1b)** Juggernaut, Mister Sinister, Stryfe; Black Tom Cassidy, Flight, Super Strength, Telepathy, Extreme
  Measures, Mutant Insurrection.
- **(pass 1c)** `NEXT_EVOL_CAMPAIGN`, campaign cards 40190–40203, the Hope Summers set (40130–40131), the prohibited
  card (40204).
- **(pass 2a–2c)** Hero kits, the box's aspect and basic cards, the 'Pool aspect.

---

## 2. Per-scenario setup needs

RRG 1.8 Appendix II (p. 51) with the wave 1–6 engine. Campaign setup and victory steps are **(pass 1c)**.

### 2.1 The two scenarios

| Scenario      | Main scheme deck                    | Encounter sets (required) + modulars                                            | 1A Setup / scenario rules                                                                                                                                                                                                 | Needs (§3)                        |
| ------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Morlock Siege | Knock, Knock → Mutant Massacre      | Morlock Siege, Standard; Military Grade and Mutant Slayers (both removable)     | "Put the Routed environment into play. Set the Hide! treachery and each Morlock ally aside. Shuffle the villains together (without looking) to create the villain deck. The top card of this deck is in play."            | 3.6–3.12, 3.15                    |
| On the Run    | Gotta Get Away → Escaping with Hope | On the Run, Mutant Slayers, Standard; Military Grade and Nasty Boys (removable) | "Put 1 random [MARAUDER] villain into play. Remove the minion with the same title as the villain, along with each other villain, from the game. Attach the Hope's Captor attachment to the villain, [CONFIDENT] side up." | 3.7, 3.13, 3.14, 3.15, 3.17, 3.18 |

- **Modular sets** (MC40 pp. 9, 11): Military Grade and Mutant Slayers are removable in Morlock Siege; in On the Run
  "the Mutant Slayers set may be used in other scenarios, but it is required" and Military Grade and Nasty Boys are
  removable. `recommendedModularSetIds`: `[military_grade, mutant_slayers]` and `[military_grade, nasty_boys]`.
- **Villain stages.** One stage each; standard is the A face, expert the B face (§1.5). There is no I/II/III.

### 2.2 Morlock Siege (MC40 p. 9)

- **Knock, Knock 1B** (40077b; raw: 1 starting threat, 6 target, +1 per round, none flagged fixed, so per player; the
  data agent reads the scan): "[star] Forced Response: After resolving step one of the villain phase, place 1 knock counter
  here. If there are at least 3 knock counters here, advance to stage 2A. If there are 3 villains under Routed, the
  players win the game."
- **Mutant Massacre 2A** (40078a): "When Revealed: Each player puts 1 set-aside Morlock ally into play under their
  control (2 set-aside Morlock allies instead if this is a single-player game). Shuffle the Hide! treachery into the
  encounter deck. If the previous stage was advanced by knock counters, give each Morlock ally a tough status card."
  Four copies exist, so every player count fits (1 player: 2; 4 players: 4).
- **Mutant Massacre 2B** (40078b; target 8 fixed): "Action: Exhaust a [MORLOCK] ally → shuffle Hide! from the encounter
  discard pile into the encounter deck. If there are 3 villains under Routed, the players win the game. If this stage
  is completed or there are no Morlock allies in play, the players lose the game." Two state checks and the usual
  final-stage loss. The "no Morlock allies" check is on 2B only, so it cannot fire during stage 1.
- **Routed** (40081a/b): "Cards under here are not in play. Forced Response: After the villain is defeated, put it
  under here. Discard each minion that shares a title with the top villain of the villain deck. (That villain is in
  play.) The villain activates against each player in player order." Expert: "The villain gains retaliate 1 for each
  card under here."
  - Order of one defeat, as read: the defeated villain goes under Routed; the win check (3 under Routed) is a state
    check and ends the game there; otherwise the next random villain is in play with its own full hit points, its
    same-title minion is discarded from wherever it is engaged, and it activates against each player in player order
    (attack against a hero, scheme against an alter-ego, a boost card each).
  - MC40 p. 9: "Unlike other scenarios, when one of these villains is defeated, all tokens, status cards, and
    attachments on the just-defeated villain are discarded instead of carrying over." That is RRG 1.8 "Villain Defeat"
    (p. 47) for a new stage of a different title, and what `removeDefeatedVillain` does. An activation the defeated
    villain was making ends (p. 47).
  - A Marauder **minion** cannot enter play while the villain of its title is in play (RRG "Unique Icon", p. 46; all
    fourteen are unique). MC40 p. 21 words the consequence differently: §4.2 Q4.
- **Morlock** (40079): "Forced Interrupt: When an enemy attacks you, it attacks a Morlock you control instead." §3.9,
  §4.2 Q6. The players lose with none in play; a defeated one goes to the victory display (Victory -1).
- **The seven villains** each print "[star] Forced Interrupt: When [name] attacks you or an ally you control, choose:"
  two options; the B faces sharpen one option. §3.11, §4.2 Q8.
- **Side schemes** By Any Means (hazard), In the Midst of Chaos (acceleration), Maraudin' Ain't Easy (amplify),
  Territorial Control (crisis, **assault**): "When Revealed: Place 1[per_hero] additional threat here for each villain
  under Routed."

### 2.3 On the Run (MC40 p. 11)

- **Gotta Get Away 1B** (40103b): "Each [MARAUDER] minion gains steady. When Revealed: Each player searches the
  encounter deck for a [MARAUDER] minion and puts it into play engaged with them. (Shuffle.) If this stage is
  completed, the players lose the game." The printed loss on stage 1 of 2 is literal: completing stage 1 loses; stage
  2 is reached only through Hope's Captor (§3.14). The scenario's main scheme deck therefore needs "completion loses"
  on a non-final stage (§3.15).
- **Escaping with Hope 2A/2B** (40104): "When Revealed: Each player searches the encounter deck and discard pile for a
  [MARAUDER] minion and puts that minion into play engaged with them. (Shuffle.) Give each [MARAUDER] enemy a tough
  status card." 2B: "Each [MARAUDER] minion gains guard and steady. In expert mode, the villain gains steady. If the
  villain is defeated, the players win the game. If this stage is completed, the players lose the game."
- **Hope's Captor** (40105a): "Permanent. [star] Forced Interrupt: When the villain would attack you, if a [MARAUDER]
  minion is engaged with you, the villain schemes instead. Forced Interrupt: When the villain would be defeated, reset
  attached villain's hit points to its printed hit point value instead. Flip this card and reveal it." 40105b: "The
  villain gets +6[per_hero] hit points. When Revealed: Advance the main scheme to stage 2A. This effect cannot be
  canceled." plus the same scheme-instead interrupt. MC40 p. 11: "requires the players to defeat the attached villain
  twice".
- **Winning.** On stage 1 a defeat is replaced (the villain is never defeated), so `victory: "cardAbility"` and the
  2B text wins. If stage 2 were reached with the a face still showing it could not happen: only the flip advances.

### 2.4 The modular sets

| Set            | Cards                                                                                      | Notes                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Military Grade | Heavy Armament, Titanium Exoskeleton, Inhibitor Collar ×2, The Senator's Support           | Inhibitor Collar's Action is the erratum's text (RRG p. 69): "Any player can do this." is rules text. §3.16, §3.19.  |
| Mutant Slayers | Arclight … Vertigo minions (40094–40100), Mutant Slayers side scheme, Bound by Business ×2 | Each minion repeats its villain's choice interrupt. "Each [MARAUDER] minion gains quickstrike." §3.11, §3.8.         |
| Nasty Boys     | Gorgeous George, Hairbag, Ramrod, Ruckus, Slab, Get Nasty                                  | Teamwork (NASTY BOY) on all five (wave 6 §3.1). Slab's growth counters; Hairbag's boost shuffles itself back. §3.20. |

---

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-04) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`trigger-events.ts`, `actions.ts`, `rules.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl` and the wave 1–6
specs. **"exists (verify)"** means the primitive was found by name and doc comment and its behavior for this card was
not run: the scripting agent proves it in a test before relying on it, and a failure becomes a partial here. Each
section is one agent, one commit.

| §    | Primitive                                                               | Needed by                                                      | Status           |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------- |
| 3.1  | A player side scheme in play                                            | 40006, 40018–40020, 40027, 40054, 40059; 41016, 42017, 43018 … | partial          |
| 3.2  | The player side scheme limit                                            | every player side scheme; 40190a–40195a's exemption            | missing          |
| 3.3  | Assault                                                                 | Territorial Control 40087, Keep Them Busy 43018                | partial          |
| 3.4  | A per player printed cost                                               | Team Investigation 40053, Break Time 44046                     | missing          |
| 3.5  | Alliance                                                                | 40053, 42031, 44046                                            | exists           |
| 3.6  | A villain deck of different titles, one in play                         | Morlock Siege                                                  | exists (verify)  |
| 3.7  | A defeated villain placed under a card, and counted there               | Routed 40081; 40077b, 40078b, 40082–40089                      | partial          |
| 3.8  | "Shares a title with" as a query                                        | Routed, Bound by Business 40102, Gotta Get Away 1A             | partial          |
| 3.9  | An enemy attack redirected to an ally its target controls               | Morlock 40079                                                  | exists (verify)  |
| 3.10 | "Card abilities cannot remove this ally from play"                      | Morlock 40079                                                  | partial          |
| 3.11 | An encounter card's "choose" between two effects on an attack           | 40070–40076 a/b, 40094–40100                                   | exists (compose) |
| 3.12 | What advanced the main scheme                                           | Mutant Massacre 2A                                             | partial          |
| 3.13 | Setup: one random villain, the rest removed from the game               | Gotta Get Away 1A                                              | partial          |
| 3.14 | An enemy activation replaced by the other kind; a defeat replaced       | Hope's Captor 40105a/b                                         | exists (verify)  |
| 3.15 | A non-final main scheme stage whose completion loses                    | Gotta Get Away 1B                                              | exists (verify)  |
| 3.16 | Superlative and fallback attach hosts for enemies                       | 40090, 40091, 40106, 40107                                     | partial          |
| 3.17 | Damage placed on an attachment instead; who dealt it                    | Hidden in the Clutter 40106                                    | exists (verify)  |
| 3.18 | "After your hero defends … and takes no damage"                         | Favored Weapon 40107                                           | exists (verify)  |
| 3.19 | An identity's text box blanked except traits; an enemy attack as a cost | Inhibitor Collar 40092; Pushed to the Limit 40083              | partial          |
| 3.20 | A boost card that shuffles itself into the encounter deck               | Hairbag 40113                                                  | exists (verify)  |
| 3.21 | Reusable as is                                                          | —                                                              | checked          |

### 3.1 A player side scheme in play

> **Status: partial.** Built since wave 1 and never exercised by a scripted card: `executePlayCardFrame`
> (`packages/engine/src/resolve/play-card.ts`) moves a played `player_side_scheme` to `villainArea`, sets the playing
> player as controller and places `scale(startingThreat, startingPlayerCount)`; `select.ts` gives it the categories
> `sideScheme` and `scheme`; `resolve/event.ts` defeats it at 0 threat through `schemeDefeated` (interrupts first, then
> When Defeated, then leaving play); Victory X sends it to the victory display (`docs/phase7-wave3.md` line 305, `discardFromPlay
{ defeated: true }`); `unique.ts` treats it as entering play; `reveal.ts` refuses to reveal one; `legal.ts` and
> `actions.ts` accept it as a basic thwart target. Gaps below.

**Cards.** `next_evol` 40006, 40018, 40019, 40020, 40027, 40054, 40059; `psylocke` 41016; `angel` 42017; `x23` 43018,
43021, 43039; `deadpool` 44024; campaign 40190a–40195a (pass 1c).

**Rules.** RRG 1.8 "Player Side Scheme" (p. 34), "Scheme (Card Type)" (p. 39: "three different card types: main
schemes, player side schemes, and side schemes"), "Player Turn" (p. 34: "**Play** an ally, upgrade, support, or
player side scheme card from hand"), p. 49 (not an extension of the identity). MC40 p. 3: "A player can only play a
player side scheme during their turn."

**Gaps, each small.**

1. **Scheme icons** on a player side scheme: `showingIconsOn` returns `[]`; read `BaseCard.schemeIcons` (§1.1).
2. **Discard destination** when it leaves play undefeated (the limit, §3.2): its owner's discard pile, no When
   Defeated, no victory display. `discardFromPlay` without `defeated` should already do this; a test pins it.
3. **"The player who defeated this scheme"** (41016, 43018): `defeatingPlayer` exists and is handed to When Defeated
   (`event.ts`, "Crossbones' Assault"); when an encounter effect or no player removed the last threat, the When
   Defeated has no such player: resolve with the scheme's controller (§4.2 Q2).
4. **Encounter text that names side schemes** counts player side schemes (p. 34: "Any rules or card effects that refer
   to 'schemes' or 'side schemes' also refer to player side schemes"): Riptide's "1 threat on each side scheme" places
   threat on them; "for each side scheme in play" counts them; crisis and hazard icons do not exist on them unless
   printed. Already so through the shared `sideScheme` category; one test per direction.
5. **An eliminated player's player side scheme** leaves play with the rest of their cards (RRG "Player Elimination").
   Verify the elimination sweep covers `villainArea` cards by owner.

**Plan.** No new vocabulary: fix gap 1, add `player-side-scheme.test.ts` covering play on your turn only, per-player
starting threat, thwart by hero and ally, removal by "a side scheme" events, defeat order (ruling Aug 3, 2026 (1)),
Victory 0 to the victory display, gaps 2–5. Log events are the existing `cardPlayed`, `threatPlaced`,
`schemeDefeated`.

**Composes with:** every later player side scheme (`bp`, `jubilee`, `magneto`, `iceman`, `ncrawler`, `silk`, `jj`
61029), which the data already carries.

### 3.2 The player side scheme limit

> **Status: missing.** No reference to a scheme limit anywhere in `packages/engine/src` or `packages/cards/src`
> (searched "schemeLimit", "side scheme limit"). The ally limit is the model: `checkAllyLimit`
> (`resolve/enter-play.ts`) and `RuleSpec allyLimit` / `excludedFromAllyLimit` (`abilities.ts`).

**Rules.** RRG 1.8 "Player Side Scheme Limit" (p. 34): "If one or two players started the game, the player side
scheme limit is one. If three or four players started the game, the limit is two. If there are ever more player side
schemes in play than the limit, the first player chooses and discards player side schemes until there are no longer
more in play than the limit. A player may play a player side scheme even while at the player side scheme limit. If
they do, they must choose a player side scheme to discard. (The player side scheme discarded this way is not
considered defeated.)" MC40 p. 21 (Technovirus Resurgence puts Technovirus Purge into play at the limit): "The first
player chooses one player side scheme in play to discard, which could include Technovirus Purge."

**Plan.**

- `playerSideSchemeLimit(state)`: 1 for a `startingPlayerCount` of 1–2, 2 for 3–4. A game-wide limit, not per player.
- **`checkPlayerSideSchemeLimit(ctx, chooser)`** in `enterPlay`, beside `checkAllyLimit`, before "enters play"
  abilities: counts player side schemes in play that no `excludedFromPlayerSideSchemeLimit` rule covers; over the
  limit, the chooser picks one to discard (a `choice` frame), repeated until at the limit. Chooser: the playing player
  when the scheme was **played**; the first player when an effect put it into play or the limit dropped (§4.2 Q1 on
  whether the new scheme may be chosen).
- **`RuleSpec excludedFromPlayerSideSchemeLimit { target }`**, the sibling of `excludedFromAllyLimit`, for
  40190a–40195a.
- The discard is `discardFromPlay` without `defeated`: owner's discard pile, `cardLeavesPlay`, no When Defeated. Log
  `playerSideSchemeLimitDiscard { instanceId, chosenBy }`.
- `legalActions` offers the play at the limit; `why-not.ts` needs no entry.

**Composes with:** every pack's player side schemes; Professor (40008) only searches for one.

### 3.3 Assault

> **Status: partial.** `basicThwart` (`packages/engine/src/actions.ts` ~line 3729) uses ATK when the scheme has the
> keyword (`hasKeyword(…, "assault")`, so a granted assault counts) and refuses a character with a printed "—" ATK;
> `select.ts` ~line 1732 picks the consequential-damage stat from the thwart event's `useAtk`. Test:
> `primitives-wave2.test.ts` "the Assault keyword thwarts with ATK". Two things are not covered.

**Cards.** Territorial Control (40087), Keep Them Busy (`x23` 43018).

**Rules.** RRG 1.8 "Assault" (p. 8): "When a character makes a basic thwart against a scheme with the assault
keyword, that character uses its ATK instead of its THW", equivalent to "While a character is making a basic thwart
against this scheme, that character uses its ATK instead of its THW." "If the thwarting character is an ally, it
takes the consequential damage listed under its ATK instead of its THW after the thwart." "Abilities that increase a
character's 'basic power' can be used to increase that character's ATK when that character thwarts a scheme with
assault." MC40 p. 4 agrees.

**Gaps.**

1. **A divided basic thwart** (`command.divide`, `RuleSpec divideBasicPower`): the code sets `assault = !command.divide
&& …`, so a divided thwart that includes an assault scheme uses THW. The RRG has no carve-out. §4.2 Q3.
2. **Untested:** an ally's consequential damage under assault (the ATK number), "+N to your next basic thwart"
   bonuses (`nextBasicPower`, wave 6 §3.39) applying to the ATK used, THW-only modifiers not applying, a confused
   thwarter (the status card still replaces it), "after you use a basic power"/`basicPowerUsed` reporting a thwart.
   It is still a thwart, not an attack: no retaliate, no "after you attack".

**Plan.** Tests for gap 2 in `assault.test.ts`; gap 1 per the answer to Q3.

### 3.4 A per player printed cost

> **Status: missing.** `CostedCard.cost` is a number and the normalizer drops raw `cost_per_hero`. The engine has
> `scale(value, startingPlayerCount)` for `ScalingValue`s (threat, hit points) and `ValueSpec perPlayer`/`scaled` for
> ability text; nothing scales a card's own cost.

**Cards.** Team Investigation (40053), Break Time (`deadpool` 44046).

**Rules.** RRG 1.8 "Per Player Icon" (p. 32); MC40 p. 5; ruling Aug 3, 2026 (5): "Printed cost scales with player
count: In a 2-player game, printed cost is **4**, dealing 4 damage with Echo's Katana"; RRG "Printed" (p. 35).

**Plan.** `CostedCard.costPerPlayer` (§1.3) and **one reader**, `printedCostOf(state, card)` = `cost ×
startingPlayerCount` when the flag is set. Every existing reader of `card.cost` goes through it: the price of a play
(`actions.ts` pricing), cost reducers' floors, `ValueSpec printedCost` and `totalPrintedCost`, queries that filter by
cost ("with a printed cost of 3 or less"), superlatives ("highest-cost card you control", Greycrow), "ignoring its
resource cost". The audit of readers is the work; grep `\.cost\b` in `packages/engine/src`. Eliminated players do not
change it. Out of a game (deck building, the client's card inspector) the card shows "2 per player".

**Composes with:** alliance (§3.5): the group pays the multiplied cost.

### 3.5 Alliance

> **Status: exists.** Wave 4 §3.17: `paidAsGroup` and the group payment paths in `packages/engine/src/actions.ts`
> (hand cards and resource abilities of any player, `resourcesSpent` per spender in `trigger-events.ts`), tests in
> `alliance.test.ts`, whose header already names Team Investigation as a plain resource cost.

RRG 1.8 "Alliance" (p. 6): "any player(s) may help pay the costs for that card … Only the player playing the card
with the alliance keyword is considered to be resolving that card." Nothing to build. One new test once §3.4 lands:
a 2[per_hero] alliance card in a three-player game is paid by three hands.

### 3.6 A villain deck of different titles, one in play

> **Status: exists (verify).** Wave 6 §3.21 (Mansion Attack): `Scenario.startingVillain: "random"`,
> `setAsideVillainCardIds`, `expertVillains`, `victory: "cardAbility"`; `defeatVillainStage` and
> `removeDefeatedVillain` (`resolve/defeat.ts`) take a defeated last stage out of play with its attachments, boost
> cards and tucked cards discarded; `addVillain` with `reveal`; `encounterSetAside { random }` on the seeded RNG; zero
> villains in play is legal (`set-aside-villains.test.ts`).

Differences from Mansion Attack to verify in a scenario test: seven villains; no Victory X on the villain (so it does
not go to the victory display: §3.7 says where it goes); the next villain activates against **each** player
(`forEachPlayer` around `enemyActivation`); expert Routed's "retaliate 1 for each card under here" as a constant with a
`refCount` value.

### 3.7 A defeated villain placed under a card, and counted there

> **Status: partial.** `tuckCards`, `TargetRef tuckedUnder`, the `tucked` selector and `ValueSpec refCount`/`countInRef`
> exist (Kang's Dominion, Operation Zero Tolerance, Med Lab), and tucked cards are out of play. But a defeated villain
> without Victory X is only flagged `defeated: true` and removed (`defeatVillainStage`); nothing lets card text send it
> somewhere. `RuleSpec defeatDestination` / `EffectSpec setDefeatDestination` cover a side scheme, an ally or a minion.

**Cards.** Routed (40081a/b): "After the villain is defeated, put it under here." Counted by 40077b, 40078b, 40082,
40083, 40084–40087, 40088, 40089, 40081b.

**Plan.** Extend the defeat-destination vocabulary to a villain's last stage: `defeatDestination { to: { tuckedUnder:
TargetRef } }` (or `tuckCards` accepting the just-defeated villain from a response to `characterDefeated`), so the
villain's instance ends in the host's `tucked` list, faceup, out of play. Then "villains under Routed" is
`refCount(tuckedUnder(self), { categories: ["villain"] })`, and the win is a `stateCheck`. Prefer the response form:
Routed prints a Forced Response, and the same response then discards the title-sharing minion and activates the new
villain, in printed order. Log `cardTucked { instanceId, underInstanceId }` (existing).

**Composes with:** the campaign's "Record the title of each villain under Routed" (pass 1c) reads the same list.

### 3.8 "Shares a title with" as a query

> **Status: partial.** Titles are compared by the uniqueness rule (`unique.ts` `matchingCardInPlay`, `titles.ts`) and a
> fixed name is `TargetQuery named`. Mansion Attack's script enumerates its four titles
> (`packages/cards/src/wave6/mut_gen/mansion-attack.ts`, `TITLES.map(sameTitleMinionDealtWith)`). No query compares a
> candidate's title with another card's.

**Cards.** Routed ("each minion that shares a title with the top villain"), Bound by Business (40102: "a [MARAUDER]
minion that does not share a title with a card in play"), Gotta Get Away 1A ("the minion with the same title as the
villain").

**Plan.** `TargetQuery sharesTitleWith: TargetRef` (true when the candidate's title equals the title of any card the
ref names), usable under `not`. Seven-title enumeration in the script would work today; the query is the reusable
form and removes a per-scenario list. Titles only (RRG "Unique Icon" p. 45 matching also reads subtitles; these cards
say "title").

**Composes with:** Mansion Attack (re-point), the Sinister Six namesakes (`campaign-primitives.test.ts`).

### 3.9 An enemy attack redirected to an ally its target controls

> **Status: exists (verify).** `EffectSpec retargetAttack { character }` (wave 4 §3.21, Crossfire): from an interrupt
> to the innermost `enemyAttack`, before a defender is declared; the new target's controller is the attacked player;
> "when it attacks" does not trigger again.

**Card.** Morlock (40079): "Forced Interrupt: When an enemy attacks you, it attacks a Morlock you control instead."

Script: `interrupt(on.enemyAttack(you), retargetAttack(chosen Morlock you control))`, forced. To verify: several
Morlocks (the controller chooses); the attack still may be defended by the hero or another ally (RRG p. 10); overkill
from a defeated Morlock goes to the controller's identity (p. 10); the Marauder's own "attacks you or an ally you
control" interrupt triggers once, whichever resolves first. §4.2 Q5, Q6.

### 3.10 "Card abilities cannot remove this ally from play"

> **Status: partial.** `RuleSpec cannotLeavePlay` is absolute (RRG "'Cannot'", p. 11, "like the permanent keyword") and
> would also stop a defeat by damage, which the scenario needs ("no Morlock allies in play, the players lose").

**Plan.** `cannotLeavePlay` gains `by?: "cardAbilities"`: discards, returns to hand or deck, removals and "defeat"
effects resolved from a card ability do nothing to the card; reaching 0 hit points still defeats it, whatever dealt
the damage. Player elimination still removes it. §4.2 Q7 on where damage from an ability falls.

### 3.11 An encounter card's "choose" between two effects on an attack

> **Status: exists (compose).** `chooseOne`, `on.enemyAttack` interrupts keyed on the attacked player (RRG p. 10: an
> attack on an ally you control attacks you), and each option's effect: `giveStatus` confused/stunned/tough,
> `modifyAttack` (+2 ATK for this attack), `spendResources`, `discardFromPlay` with `superlative` over `printedCost`,
> `dealIndirectDamage`, `placeThreat` on the main scheme and each side scheme, `grantKeywordUntil`/`attackKeywords`
> (overkill, ranged, piercing), and an additional boost card for the activation in progress (`spec.ts` ~lines 484,
> 1317, 1353: "give him an additional boost card for this activation").

**Cards.** Villains 40070a/b–40076a/b; minions 40094–40100 (Harpoon the minion: "+2 ATK … gains piercing" instead of a
boost card).

**To verify while scripting:** the B faces' forced targets ("the character you control with the highest THW/ATK":
`superlative`, ties to the player); Greycrow B "discard each card you control with the highest cost" (`ties: "all"`);
X read after the choice; a stalwart or already-confused target. Which options may be chosen when one cannot be
carried out: §4.2 Q8.

### 3.12 What advanced the main scheme

> **Status: partial.** `TriggerEvent mainSchemeAdvanced { stageIndex, schemeInstanceId? }` carries no cause, and
> `advanceMainScheme` records none.

**Card.** Mutant Massacre 2A: "If the previous stage was advanced by knock counters, give each Morlock ally a tough
status card."

**Plan.** `advanceMainScheme` and the completion path stamp `MainSchemeState.advancedBy: { cause: "completed" |
"cardEffect"; sourceInstanceId: InstanceId | null }`, copied onto `mainSchemeAdvanced` and the log event. A predicate
`mainSchemeAdvancedBy { cause, source?: TargetRef }` reads it; 2A asks for `cardEffect` from the scheme itself. Until
it lands the script could set a `setVar` before advancing, but the cause belongs in the log either way.

**Composes with:** Hope's Captor's advance (§3.14) and any later "if this stage was advanced by" text.

### 3.13 Setup: one random villain, the rest removed from the game

> **Status: partial.** `startingVillain: "random"` picks one and sets the others aside; `removeVillain` and
> `GameState.removedFromGame` exist; a `setup` ability can move cards. Removing the set-aside villains and one minion
> from a built encounter deck at setup has no test.

**Card.** Gotta Get Away 1A. Campaign: "**Before** resolving the 'Setup' text … remove each villain card recorded in
the campaign log under 'Marauders Defeated' from the game" (MC40 p. 11; pass 1c narrows the random pool).

**Plan.** Script on 1A's `setup`: remove from the game every set-aside villain and the minion that
`sharesTitleWith(theVillain)` (§3.8), wherever it is (the encounter deck; Mutant Slayers is required, so it is
present), then attach the set-aside Hope's Captor a face. If a removal effect over set-aside villains does not exist
as an effect, add `removeFromGame { target }` taking out-of-play refs (the `removedFromGame` selector already reads
the area).

### 3.14 An enemy activation replaced by the other kind; a defeat replaced

> **Status: exists (verify).** `TriggerEvent enemyActivating`/`enemyAttack` interrupts with `replaceTriggeringEvent`
> (RRG "Replacement Effect", p. 37; "'Instead'", p. 25) and `enemyScheme`/`enemyActivation`; a `defeat` interrupt with
> `replaceTriggeringEvent` + `setRemainingHitPoints` (Captain America's Helmet, wave 1 §3.13) which announces
> `hitPointsReset` at maximum (wave 6 §3.67); `flipCard` with the full reveal of the new face (`flipToOtherFace`,
> wave 6 §4.1 Q36 for villains; attachments reveal as encounter cards); `RuleSpec cannotBeCanceled`;
> `advanceMainScheme { to }`; a hit point modifier on a dial character (RRG "Hit Points", p. 22: "increase that
> character's hit point dial by X").

**Card.** Hope's Captor (40105a/b).

**To verify.** (a) The replaced attack becomes a scheme against the same player with one boost card, and "after the
villain attacks" does not fire. (b) The defeat replacement works for a **villain's** defeat (the Helmet's is an
identity's): the stage is not removed, attachments and status cards stay, excess damage is lost, `characterDefeated`
is not announced. (c) Order on the flip: hit points reset to the printed value, flip, the b face's +6 per player
raises the dial, then its When Revealed advances the scheme. (d) Permanent keeps both faces attached (RRG p. 32).
§4.2 Q9, Q10.

### 3.15 A non-final main scheme stage whose completion loses

> **Status: exists (verify).** `whenCompleted` abilities and `endGame("lose")` exist, and `final-stage-when-completed
.test.ts` covers a final stage. Stage 1 of 2 printing "If this stage is completed, the players lose the game" is new.

Script: `whenCompleted(endGame("lose"))` on 40103b. Verify the engine does not advance to stage 2 after the loss and
that `advanceMainScheme { to: 2 }` from Hope's Captor is not a completion.

### 3.16 Superlative and fallback attach hosts for enemies

> **Status: partial.** The attach-host union has `villain`, `minion`, `yourIdentity`, `qualified` and
> `minionWithHighestPrintedHp` (wave 6 §1.3); `TargetRef superlative` measures anything at resolution. A host of "the
> enemy with the highest ATK / fewest remaining hit points / lowest ATK" and "X or Y, otherwise Z" are not host kinds.

**Plan.** One host kind, `{ kind: "superlativeEnemy"; measure: "atk" | "remainingHp"; pick: "highest" | "lowest";
trait?: Trait }`, ties chosen by the first player (RRG "First Player"), and a wrapper `{ kind: "firstOf"; hosts:
AttachHost[] }` for Favored Weapon (`named` Greycrow or Harpoon, villain or minion, then the Marauder with the lowest
ATK). Alternatively leave `attachesTo` open and attach from the When Revealed with `superlative` + `attach` (the
`impliedAttachHost` precedent); the data survey says which the validator prefers.

### 3.17 Damage placed on an attachment instead; who dealt it

> **Status: exists (verify).** `replaceTriggeringEvent` on a `dealDamage` interrupt with `placeDamage` on another card
> ("place it here instead"; `damage-on-environment.test.ts`, `damage-to-counters.test.ts`), `eventSource` and
> `controllerOf` for the dealing player, `enemyAttack` against a chosen player, `then`.

**Card.** Hidden in the Clutter (40106): "When any amount of damage would be dealt to attached enemy, place it here
instead. If there is at least 3 damage here, attached enemy attacks the player who dealt the damage just placed here.
Then, discard this card." Verify: tough on the host is not spent (the damage is never dealt to it); damage with no
dealing player triggers no attack (§4.2 Q11).

### 3.18 "After your hero defends … and takes no damage"

> **Status: exists (verify).** `TriggerEvent defended` and `eventDamageTakenAtLeast` exist (Unflappable's shape, core
> Protection).

Favored Weapon (40107): response with a `→` cost-free discard, hero defender only, attacker is the host. Its "[star]
Attached enemy's attacks gain overkill, piercing, and ranged" is `attackKeywords`.

### 3.19 An identity's text box blanked except traits; an enemy attack as a cost

> **Status: partial.** `RuleSpec blankTextBox` (constant, a class of cards; `blank-text-box.test.ts`) with
> `exceptKeywords`, and `keepPrintedTraits` on treat-as rules (`spec.ts` ~line 1234). Blanking an **identity** (both
> faces, its form-specific abilities, keywords such as a hero's printed retaliate) is untested. `triggerableBy` (wave 6
> §3.11) and either-costs (`either-cost.test.ts`) exist. No cost kind makes an enemy attack.

**Cards.** Inhibitor Collar (40092; erratum RRG p. 69): "Treat your identity's printed text box as if it were blank
(except for traits). Action: Choose to either exhaust a character you control or take 3 damage → discard this card.
Any player can do this." Pushed to the Limit (40083): "Hero Action: Attached villain attacks you → discard this card."

**Plan.** (a) `blankTextBox { target: host identity }` from the attachment, traits kept (they are outside what the
rule removes; confirm), covering whichever face is up; hand size, hit points and the stat line are not text box.
Setup-time and "limit once per game" memory is untouched. §4.2 Q12. (b) **`AbilityCost enemyAttack { enemy, against:
"you" }`**: the cost is paid by the attack being initiated and resolved in full (boost card, defense, damage); the
effect resolves after it, if the ability's card is still in play. A cost, so it cannot be canceled into a free
effect: if the attack cannot be initiated (the villain is stunned: the stun is discarded and no attack is made), the
cost is not paid (§4.2 Q13).

### 3.20 A boost card that shuffles itself into the encounter deck

> **Status: exists (verify).** `atEndOfActivation` (wave 2), `moveCards` to the encounter deck with shuffle, and `self`
> for the boost card being resolved.

Hairbag (40113): "[star] Boost: After this activation, shuffle Hairbag into the encounter deck." Verify the boost
card is not also discarded at the activation's end, and that a boost card dealt to a minion (villainous) behaves alike.

### 3.21 Reusable as is (checked against the engine unions)

| Card text                                                                                                                    | Existing vocabulary                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "After resolving step one of the villain phase, place 1 knock counter here" (40077b)                                         | `villainStepResolved { step: "placeThreat" }` (wave 3 §3.2), `addCounters`, `counterAtLeast`, `advanceMainScheme { to }` |
| "Each player puts 1 set-aside Morlock ally into play under their control (2 … single-player)"                                | `forEachPlayer`, `encounterSetAside`, `putIntoPlay` (wave 6 §3.20/§3.71), `excludedFromAllyLimit`                        |
| "If … there are no Morlock allies in play, the players lose" / "3 villains under Routed … win"                               | `stateCheck`, `endGame`, §3.7's count                                                                                    |
| "Exhaust a [MORLOCK] ally → shuffle Hide! from the encounter discard pile into the encounter deck"                           | exhaust cost, `moveCards`, `shuffleEncounterDeck`                                                                        |
| Hide! (40080): tough to a Morlock; boost: tough and "1 additional boost card for this activation"                            | `giveStatus`, the additional boost card effect (`spec.ts` ~line 1317)                                                    |
| "Standard Mode Only." / "Expert Mode Only." (40081a/b)                                                                       | `modeOnly` (wave 4 §3.18); verify on an environment                                                                      |
| "The villain gains retaliate 1 for each card under here" / "gains steady" / "gains stalwart" (40081b, 40083)                 | constant keyword grants with a `while` and a value (the Master Mold "gains guard" shape)                                 |
| "This card gets +X boost icons" (40082)                                                                                      | `boostIconsCounting` + `adjustBoostCount` (wave 2 §3.6)                                                                  |
| "Exhaust a character you control and spend X resources of any type" (40082)                                                  | combined costs with a `ValueSpec` amount                                                                                 |
| "Place 1[per_hero] additional threat here for each villain under Routed" (40084–40087)                                       | `placeThreat` with `product(perPlayer, refCount)`                                                                        |
| "When Revealed (Alter-Ego) … / (Hero): The villain attacks you … gains overkill" (40089)                                     | form-split When Revealed (core Assault), `enemyAttack` with granted keywords (`enemy-attack-granted-overkill.test.ts`)   |
| "Each [MARAUDER] minion gains steady / guard / quickstrike"; "In expert mode, the villain gains steady"                      | constant keyword grants; `inMode` (wave 5 §3.11)                                                                         |
| "Each player searches the encounter deck (and discard pile) for a [MARAUDER] minion and puts it into play engaged with them" | `forEachPlayer`, `find`/search, `putIntoPlay` engaged, shuffle                                                           |
| "Give each [MARAUDER] enemy a tough status card" (40104a)                                                                    | `giveStatus` over a query                                                                                                |
| "While Blockbuster is in play, this scheme gains the crisis icon" (40109)                                                    | `gainsIcon` with `while exists(named)`                                                                                   |
| Bushwhack (40108): "The player who defeated this scheme searches …"                                                          | `defeatingPlayer`                                                                                                        |
| Tag Team (40111): engaged Marauder minions activate; discard 7, topmost Marauder minion into play                            | `enemyActivation` over a query; `discardEncounterCards`, topmost selector (`encounter-topmost-only.test.ts`)             |
| Heavy Armament (40090): retaliate 2; "After you attack the attached enemy, spend 2 resources of the same type → discard"     | keyword grant; same-type resource cost (wave 3 §3.43)                                                                    |
| Titanium Exoskeleton (40091): "cannot take more than 2 damage from a single attack"; either spend 3 or remove a status card  | `maxDamageTakenPerAttack` (wave 3 §3.15); either-cost; status removal as a cost (wave 6 §3.6; verify on an enemy)        |
| The Senator's Support (40093): "Hinder 1[per_hero]"; discard until an attachment, reveal it                                  | `hinder.perPlayer`; `discardEncounterUntil` + `revealCard`                                                               |
| Mutant Slayers (40101): 1 threat per character with any of four traits                                                       | `count` with an `or` of `hasTrait`                                                                                       |
| Nasty Boys: Teamwork (NASTY BOY)                                                                                             | wave 6 §3.1 (`teamworkFrame`, `resolve/enter-play.ts`); decisions Q1, Q2                                                 |
| Slab (40116): growth counters, "+1 ATK for each … for this attack"                                                           | `addCounters`, `modifyAttack` with `counters`                                                                            |
| Ruckus (40115): "Stun each character you control"; boost "You are stunned"                                                   | `giveStatus` over a query                                                                                                |
| Get Nasty (40117): "Each minion gets +1 ATK"; threat per minion; search and reveal                                           | constant modifier; `placeThreat` with a sum; search + `revealCard`                                                       |
| Dizzying Deeds (40110): exhaust; extra effects per named enemy in play                                                       | `conditional` on `exists(named)`                                                                                         |

---

## 4. Open questions (for the user or FFG)

### 4.1 Decided by the user

None yet.

| Q   | Decision |
| --- | -------- |
|     |          |

Carried from wave 6 §4.1 and applied here without asking again: Q1 (teamwork: only the entering minion activates),
Q2 (teamwork before When Revealed), Q36 (a new villain face goes through the reveal pipeline).

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently. **A is the proposed
default in every question; none is implemented yet.**

1. **Playing a player side scheme at the limit: which one may be discarded?** (§3.2; RRG p. 34 "they must choose a
   player side scheme to discard"; MC40 p. 21 for one put into play: the first player's choice "could include" the new
   one.)
   - **A (default):** the new scheme enters play, then the playing player chooses any player side scheme in play,
     the new one included (the ally-limit handling); put into play by an effect, the first player chooses.
   - B: the playing player must choose one that was already in play.
2. **"The player who defeated this scheme" when no player did** (§3.1; an encounter effect removes the last threat
   from Lay the Trap or Keep Them Busy).
   - **A (default):** the scheme's controller resolves the When Defeated as that player.
   - B: the first player. C: that part of the When Defeated does nothing.
3. **Assault and a divided basic thwart** (§3.3). The engine today uses THW for any divided thwart.
   - **A (default):** RRG p. 8 as written: if any scheme of the divided thwart has assault, the character uses ATK
     for that thwart (and an ally takes ATK consequential damage). This changes current behavior.
   - B: keep THW for divided thwarts. C: a divided thwart cannot mix assault and non-assault schemes.
4. **A Marauder minion revealed while the villain of its title is in play.** MC40 p. 21: "the minion is discarded and
   the player who revealed it must reveal an additional encounter card." RRG 1.8 p. 46: "the player revealing it is
   dealt a facedown encounter card." The documents disagree; the engine follows the RRG (`unique.ts`).
   - **A (default):** RRG 1.8, the later document: dealt facedown, revealed in that player's turn of step 4.
   - B: MC40 for these minions: reveal another card at once.
5. **"Attacks you" abilities when the attack is against an ally you control.** MC40 p. 5: they "do **not** trigger".
   RRG 1.8 p. 10: they "resolve against the attacked player". The engine follows the RRG (`retargetAttack`'s doc).
   Matters for Gorgeous George, Hope's Captor and Morlock.
   - **A (default):** RRG 1.8 for every card.
   - B: MC40's rule while playing MC40 scenarios.
6. **Morlock's redirect: which attacks, and who picks the Morlock?** (§3.9)
   - **A (default):** every enemy attack whose attacked player is you, including one aimed at another ally you
     control (with Q5 = A); you choose among your Morlocks; forced, so you cannot decline while you control one.
   - B: only attacks aimed at your identity.
7. **"Card abilities cannot remove this ally from play"** (§3.10): does damage from a card ability count?
   - **A (default):** no. Only effects that move the card (discard, return to hand, shuffle, remove) or "defeat" it
     outright are blocked; damage from any source can still defeat a Morlock.
   - B: a Morlock cannot be defeated by damage from card abilities either, only by attacks.
8. **Choosing an encounter option you cannot carry out** (§3.11; RRG "Choose (Option)", p. 12, bars only an encounter
   option "that requires one or more targets if there are no valid targets"). Chimera with no [mental] resource to
   spend; Greycrow with no card to discard; Blockbuster already tough; Arclight with every character confused.
   - **A (default):** an option is offered only if the player can carry it out in full; otherwise the other option
     is forced (FFG's evident intent: the choice is a price).
   - B: p. 12 as written: only target-less options are barred, so "spend a [mental] resource" may be chosen with
     none and does nothing.
9. **Hope's Captor: "the villain schemes instead"** (§3.14).
   - **A (default):** the attack activation is replaced before its boost card is dealt; the villain schemes against
     that player with a normal boost card; it applies to attacks card effects cause ("The villain attacks you");
     abilities keyed on that attack do not trigger, those keyed on the scheme do.
   - B: only villain-phase step 2 activations are replaced.
10. **Hope's Captor: the replaced defeat** (§3.14).
    - **A (default):** the villain is not defeated (no "after you defeat" responses, nothing leaves it); hit points
      go to the printed value, the card flips, +6 per player raises the dial (RRG p. 22), then the When Revealed
      advances the scheme; excess damage is lost.
    - B: the +6 per player raises only the maximum, leaving the dial at the printed value.
11. **Hidden in the Clutter with no dealing player** (§3.17; retaliate-style or encounter-sourced damage).
    - **A (default):** the damage is placed; at 3 the attack is skipped for lack of a player, and the card is still
      discarded.
    - B: the first player is attacked.
12. **Inhibitor Collar: how much of the identity is blank?** (§3.19)
    - **A (default):** both faces' text boxes, keywords included, while the Collar is attached (the face showing is
      the one read); traits, stats, hand size and hit points stay; the Collar's printed ATK −1 applies in hero form.
    - B: only the face showing when the Collar attached.
13. **"Attached villain attacks you → discard this card" when the villain is stunned** (§3.19).
    - **A (default):** the ability may be triggered; the stun replaces the attack and is discarded, the cost is not
      paid, and Pushed to the Limit stays (the reading of RRG "Cost", p. 13, that an effect needs its cost paid).
    - B: the ability cannot be triggered while the villain could not attack.

---

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** `CostedCard.costPerPlayer` (§1.3) and re-emit 44046; `next_evol`'s sets for this pass with
  §1.5–§1.9; read scans 40071a, 40074a, 40076a (0 or "—"), 40081a/b, 40105a/b; confirm player side scheme starting
  threat scaling (§1.1).
- **`ability-scripting-engineer`:** nothing until §3.2, §3.4, §3.7 land; then one agent per set (Marauders villains;
  `morlock_siege`; `on_the_run`; each modular set).
- **`encounter-ai-designer`:** the Routed sequence (§2.2) and Hope's Captor (§2.3) as scenario tests.
- **`rules-qa-engineer`:** fixtures for §3.1–§3.3 (limit at 2 and 3 players, defeat versus limit discard, assault with
  an ally) and the three rulebook-versus-RRG rows in §0.
- **`game-client-engineer`:** a player side scheme sits beside the main scheme; a per player cost shows multiplied in
  a game and "N per player" outside one; cards under Routed are inspectable.

## 6. Later passes (placeholders)

- **(pass 1b)** §2 and §3 rows for Juggernaut, Mister Sinister, Stryfe and their sets.
- **(pass 1c)** The campaign record, campaign player side schemes and environments, the Hope Summers set.
- **(pass 2a–2c)** Hero packs and the 'Pool aspect.
- **(pass 3)** Build order across all passes.
