# Phase 7, Wave 4: Cycle 3 – The Mad Titan's Shadow – Sources & Implementation

> **Unverified draft (content-release-tracker, 2026-09-24).** Spot checks found "p. NNNN" citations that are line
> numbers in `mc_rulesreference_v18_compressed.md`, not printed RRG pages, and keyword claims to check: Amplify is
> printed on 25 `gmw` cards (cycle 2), so it is not new here. Steady _is_ first printed in cycle 3 (`hood`), though the engine
> already implements it from the RRG. `game-rules-architect` verifies each entry against the RRG PDF and the rulings file before
> `docs/phase7-wave4.md` relies on it; treat anything here as a pointer until then.

> **Status:** Cycle 3 implementation tracking for phase 7, wave 4.  
> **Source:** RRG v1.8 (July 2026), [mc_rulesreference_v18_compressed.pdf](../mc_rulesreference_v18_compressed.pdf), official rulings post-RRG 1.7 & 1.8, Hall of Heroes.  
> **As of:** September 24, 2026

---

## 1. Confirmed Pack List & Release Order

Cycle 3 consists of **six hero/ally kits and one campaign box** (October 2021 – January 2022), plus **one scenario pack** (November 2021):

| Release Date  | Product                          | Type                   | Heroes/Villains                                                                    | Card Count | Lead Designer                              |
| ------------- | -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| Sept 17, 2021 | **Nebula**                       | Hero Pack              | Nebula                                                                             | —          | Michael Boggs                              |
| Oct 29, 2021  | **The Mad Titan's Shadow (MTS)** | Campaign Box (Cycle 3) | Spectrum, Adam Warlock (5 scenarios: Ebony Maw, Tower Defense, Thanos, Hela, Loki) | 268        | Caleb Grace + Michael Boggs + Aaron Haltom |
| Nov 12, 2021  | **War Machine**                  | Hero Pack              | James Rhodes                                                                       | —          | Caleb Grace + Aaron Haltom                 |
| Nov 26, 2021  | **The Hood**                     | Scenario Pack          | The Hood villain (+ minions)                                                       | —          | Michael Boggs                              |
| Jan 14, 2022  | **Vision**                       | Hero Pack              | Vision                                                                             | —          | Caleb Grace                                |
| Jan 21, 2022  | **Valkyrie**                     | Hero Pack              | Brunnhilde/Valkyrie                                                                | —          | Caleb Grace                                |

**Sources:**

- Hall of Heroes (each pack page): https://hallofheroeslcg.com/ (Nebula, War Machine, Valkyrie, Vision, The Hood, MTS)
- RRG 1.8, Appendix VI, Legacy Environment, Wave 4 (p. 5270): confirms campaign box + 4 hero packs (Nebula, War Machine, Valkyrie, Vision)

**Note on The Hood:** Listed as "scenario pack" (not hero pack); introduces new keyword **Steady** (see §2).

---

## 2. Per-Pack Rules Additions, Keywords, Setup

### 2.1 The Mad Titan's Shadow Campaign Box (Oct 29, 2021)

**Location:** `docs/campaign-modes/markdown/mc21_the_mad_titans_shadow.md`

#### New Keywords Introduced

1. **Form** (pages 2, 185):
   - Hero identities may have additional forms (e.g., Spectrum's energy forms) beyond hero/alter-ego.
   - "Form" keyword grant unique forms with conditions for changing into them.
   - Changing additional forms does **not** count against the once-per-turn limit on hero/alter-ego flip.
   - **Does count** as "changing form" for trigger cards like Moxie (MTS #17).

2. **Amplify Icon** (page 2, 194):
   - Icon that increases boost icons on boost cards during enemy activation.
   - When a boost card is turned faceup, add **+1 additional boost icon per amplify icon in play**.

3. **Steady** (page 13 keywords section; actually from The Hood pack):
   - Character with stalwart keyword cannot be stunned or confused.
   - When flipping a Loki villain with stalwart, **discard any stunned/confused status cards** (not transferred; see §2 page 822).

4. **Villainous** (page 13 keywords section):
   - When minion with villainous keyword activates, give it a facedown boost card from encounter deck.
   - Turn boost card faceup during resolution, apply boost icons to stats.
   - Discard boost card after activation.

5. **Piercing** (page 13):
   - Attack with piercing discards tough status cards from target **before dealing damage**.
   - Keyword timing has priority over triggered abilities (e.g., before Aerial Evacuation prevents damage; ruling Jan 17, 2026).

6. **Ranged** (page 13):
   - Attack with ranged ignores retaliate keyword.

7. **Victory X** (page 13):
   - Card with victory X defeated → placed in victory display instead of discard.
   - Victory display is shared, out-of-play area.

8. **Hinder X** (page 13):
   - Card with hinder X revealed → place X threat on that card.

9. **Incite X** (page 13):
   - Card with incite X revealed → place X threat on **main scheme** (not the card).

10. **Permanent** (page 13):
    - Card cannot leave play.

#### Campaign Setup & Special Rules

- **Two Main Schemes (Tower Defense scenario, page 10):** Both active each round; both gain threat. Encounter cards referring to "the main scheme" refer to both.
  - When player plays card referring to main scheme, controller **must choose** which scheme (if using thwart/threat removal).
  - Constant effect on player card always refers to scheme with "Focused Defense" attachment.

- **Two Villains (Tower Defense, page 11):** Proxima Midnight & Corvus Glaive. Only one is "active villain" at a time, determined by "Focused Defense" attachment.
  - Active villain is the only one who activates in villain phase (step 2).
  - Encounter cards referring to "the villain" refer **only** to active villain.
  - Player cards referring to "the villain" (dynamic) chosen by player; constant effects refer to active villain.

- **Infinity Gauntlet Encounter Set (Thanos scenario, page 16):**
  - Attach Infinity Gauntlet to villain during setup (requires single villain, not used with multiple/no villains).
  - Six Infinity Stone environment cards set aside as "Infinity Stone deck" (separate discard pile, reshuffle if empty).
  - Each Stone has unique **Special** effect triggered by Gauntlet when villain activates.
  - If no Infinity Stone in play when villain activates, Gauntlet places top card of Infinity Stone deck into play.

- **Infinite Hit Points (Hela scenario, page 18):** Hela has ∞ HP, cannot be defeated by damage alone.
  - **Journey Through Hel:** Odin attached to main scheme as **Captive**. When Hela would be defeated with Odin attached, Forced Interrupt: discard attachments from Hela & flip to **Wounded** side instead (double-sided card).
  - **Win condition:** Defeat Hela **while controlling Odin ally** (must rescue Odin first).

- **Loki (God of Mischief) (page 24):** Not ordinary villain stages.
  - Five different stage-I Loki villain cards; choose one at random at start, set aside remaining 4.
  - When Loki defeated, reveal **random** set-aside Loki instead (not next stage).
  - Transfer all attachments, status cards, counters, tokens to new Loki.
  - **Win condition:** Defeat **X number of Lokis** (Rookie 1, Standard 2, Expert 3, Heroic 4); each Loki has Victory 1.

- **Expert Campaign Mode (page 25):** Persistent damage across scenarios.
  - Record remaining hero HP after each scenario; becomes starting HP for next.
  - Setup allows healing via acceleration token placement.
  - If player defeated in scenario but team wins, defeated player sits out victory steps but can rejoin next scenario.

- **Campaign-Only Cards (page 4):** Cards 180–193 cannot be included in any deck unless directed by Campaign Instructions.

#### Two Hero Identities (Starter Decks, page 3)

1. **Spectrum (Monica Rambeau)** — Leadership aspect
   - Hero form: 1 THW / 1 ATK / 1 DEF / 11 HP / hand size 5
   - Alter-ego form: 3 REC / 11 HP / hand size 6
   - **Setup:** Put all 3 energy form upgrades into play, facedown.
   - **Energy Transformation (Forced Response):** After change to hero form, flip a facedown energy form upgrade to change to that form.
   - Traits: Aerial, Avenger

2. **Adam Warlock** — All four aspects (unique deckbuilding)
   - Hero form: 1 THW / 1 ATK / 2 DEF / 11 HP / hand size 5
   - Alter-ego form: 3 REC / 11 HP
   - **Battle Mage (Action, limit once per phase):** Discard 1 card from hand; if Aggression → deal 2 damage; Justice → remove 2 threat; Protection → heal 1 damage; Leadership → give hero +1 THW / +1 ATK / +1 DEF this round.
   - Traits: Guardian, Mystic
   - **Unique restriction:** Can include at most 1 copy of any aspect card (across all four aspects).

---

### 2.2 Nebula Hero Pack (Sept 17, 2021)

**Location:** `docs/cards/by_pack/nebu.md`

**Lead Designer:** Michael Boggs

**New Keywords/Mechanics:**

- None novel; uses existing keywords (Quickstrike, Retaliate, etc.)

**Notable Mechanics:**

- **Old Rivals (encounter card #31):** Gamora ally/hero attacks player without exhausting (referential ability).

---

### 2.3 War Machine Hero Pack (Nov 12, 2021)

**Location:** `docs/cards/by_pack/warm.md`

**Lead Designer:** Caleb Grace + Aaron Haltom

**New Keywords/Mechanics:**

- **Alliance** (first introduced in War Machine hero pack) — Per RRG keyword list.
  - Allows coordination between heroes or allies.

**Notable Mechanics:**

- **Gauntlet Guns (Upgrade):** Resource ability tied to paying for War Machine events (cost arrow context).
- **Repulsor Beam (Event, #28):** Two-sentence attack; second sentence triggers if first defeats Guard minion.

---

### 2.4 The Hood Scenario Pack (Nov 26, 2021)

**Location:** Hall of Heroes: https://hallofheroeslcg.com/the-hood/

**Lead Designer:** Michael Boggs

**New Keywords/Mechanics:**

- **Steady** — Official keyword introduced (see §2.1, Amplify Icon section, page 13 keywords).
  - Character with stalwart keyword cannot be stunned or confused.

**Content:**

- 5 scenarios: The Hood, Beasty Boys, Brothers Grimm, Mister Hyde, Wrecking Crew encounter sets.
- Standard II/Expert II difficulty modular sets.

---

### 2.5 Vision Hero Pack (Jan 14, 2022)

**Location:** `docs/cards/by_pack/vision.md`

**Lead Designer:** Caleb Grace

**New Keywords/Mechanics:**

- None; uses existing mechanics.

---

### 2.6 Valkyrie Hero Pack (Jan 21, 2022)

**Location:** `docs/cards/by_pack/valk.md`

**Lead Designer:** Caleb Grace

**New Keywords/Mechanics:**

- None; uses existing mechanics.

---

## 3. RRG 1.8 Errata & FAQ (Pages ~61–67)

All errata/FAQ entries below apply to Cycle 3 cards. Source: RRG 1.8, Appendix V (Errata), pp. ~4896–4934.

### Mad Titan's Shadow Campaign Box

**RULEBOOK PAGE 10, SCENARIO 2 – TWO MAIN SCHEMES, PARAGRAPH 1** (p. 4882)

- Clarifies: When minion schemes, threat placed **only** on main scheme with "Focused Defense" attachment.

**SANCTUARY (#116) — Thanos encounter card** (p. 4887)

- **Errata:** Should read "Thanos cannot take damage **from player cards**." (Added phrase.)
- **Implication:** Damage from encounter cards (e.g., treacheries) bypasses this restriction.

**INFINITY GAUNTLET (#129) — Permanent attachment** (p. 4890)

- **Errata:** Should read "Permanent. Setup. Attach to the villain. **Forced Response:** After attached villain activates against you, resolve Special ability of each Infinity Stone in play. Otherwise, put top card of Infinity Stone deck into play."
- **Changes:** Added "Attach to the villain" and "against you" for clarity; cost arrow → Forced Response.

### Nebula Hero Pack

**EROS (#11)** (p. 4898)

- **Errata:** Should read "**Response:** After you play Eros from your hand, for each [resource] you used to pay for him, choose a minion and confuse it."
- **Change:** "for each" rules update (RRG 1.8 clarification).

**COSMO (#20)** (p. 4902)

- **Errata:** Should read "**Interrupt:** When Cosmo attacks or thwarts, name a card type, then discard top card of **a player deck or the encounter deck**. If that card is of named type, Cosmo does not take consequential damage for this use."
- **Change:** Clarified deck options; removed reminder text.

**OLD RIVALS (#31) — Treachery** (p. 4906)

- **Errata:** Should read "**When Revealed:** Gamora attacks you. If Gamora hero or ally in play, she attacks you _(resolve her ATK against you without exhausting her)_. If no attack made this way, this card gains surge."
- **Change:** Converted reminder text to rules text (referential abilities update in RRG 1.8).

### War Machine Hero Pack

**JAMES RHODES (#1B) — Alter-ego identity** (p. 4912)

- **Errata:** Should read "**Action:** Choose War Machine card in discard pile & shuffle into deck. (Limit once per phase.)"
- **Change:** Added phase limit.

### Valkyrie Hero Pack

**ARAGORN (#7) — Upgrade** (p. 4918)

- **Errata:** Should read "You get +4 hit points and gain the Aerial trait." (Changed "Valkyrie" to "You".)

**SHIELDMAIDEN (#11) — Upgrade** (p. 4922)

- **Errata:** Should have Defense trait and read "**Hero Interrupt** _(defense)_: When enemy with Death-Glow attached attacks, declare Valkyrie defender without exhausting her. She gets +2 DEF for this attack."
- **Change:** Added Defense trait and (defense) label.

**BEGUILED (#31) — Attachment/Enchantress scenario card** (p. 4926)

- **Errata:** Should have Condition trait and read "**When Revealed:** Attach to ally with highest cost without Beguiled attached. Attached ally engages its controller. Otherwise, this card gains surge."
- **Change:** Added Condition trait; clarified ally engagement.

### Vision Hero Pack

**MACHINE MAN (#22) — Upgrade** (p. 4932)

- **Errata:** Should read "**Interrupt:** When Machine Man attacks or thwarts, spend up to 3 resources of any type → Machine Man gets +1 THW and +1 ATK **for this use** for each resource spent this way."
- **Change:** Added "for this use" (scope clarification).

---

## 4. FFG Rulings Post-RRG 1.7 & 1.8 (Dec 17, 2025 – Aug 13, 2026)

**Source:** [marvel-champions-rulings-post-rrg-1-7.md](../marvel-champions-rulings-post-rrg-1-7.md) (transcribed from Hall of Heroes)

### Rulings Touching Cycle 3 Cards or Mechanics

1. **January 11, 2026 – Ruling 2:** Overkill with "Attacks and Defeats" (Cap's Shield, Captain Marvel, Jigsaw)
   - Cap's Shield attachment triggers when attacker uses ATK and deals overkill damage.
   - Captain Marvel leader gains energy counter from overkill defeating ally or identity.
   - Directly relevant: **Thanos, Infinity Stones** (overkill interactions).
   - _Line in file: ~224_

2. **January 17, 2026 – Ruling 2:** Winter Soldier vs Black Widow villain; A.I.M. Grunt boost reveal
   - Clarifies attack/defense event resolution when threat card is revealed mid-ability.
   - Relevant to **Cycle 3 encounter cards** with complex reveal timing.
   - _Line: ~273_

3. **January 17, 2026 – Ruling 3:** Piercing vs "Prevent All Damage" (Bulletproof Belle, Aerial Evacuation)
   - **Piercing discards Tough before damage dealt; keywords have timing priority over triggered abilities.**
   - Piercing removes Tough before Aerial Evacuation prevents damage.
   - Relevant: **Hela scenarios** (Piercing keyword on minions), damage prevention interactions.
   - _Line: ~293_

4. **February 28, 2026 – Ruling 1:** Cost Arrow (→) vs Quickstrike; Activation Queuing & Retaliate
   - Abilities triggered by paying cost resolve **before** effect following arrow.
   - Quickstrike minion attacks before hero heals/gains toughness.
   - Relevant: **War Machine Repulsor Beam** (#28), cost-driven activation order.
   - _Line: ~481_

5. **March 6, 2026 – Ruling 3:** Wonder Man's Ionic Physiology when at full HP
   - **Errata incoming:** Cost arrow replaced with "Then" (allows tucking at full HP).
   - Relevant: **Adam Warlock/Cosmic Entity mechanics** (similar card design patterns).
   - _Line: ~619_

6. **March 19, 2026 – Ruling 4:** Valkyrie Aggression Ally under RRG 1.7 Unique Rules
   - **Valkyrie Aggression ally (no subtitle) CAN be in Valkyrie hero deck** (titles don't match after RRG 1.7 update).
   - Directly relevant: **Valkyrie hero pack** deckbuilding.
   - _Line: ~685_

7. **June 2, 2026 – Ruling 3:** Galaxy's Most Wanted Expert Mode HP & The Collection
   - Heal identity to printed HP at no cost (setup healing).
   - Campaign setup finishes **before** resolving encounter card When Revealed damage.
   - Relevant: **MTS Campaign setup** (similar structure); compare campaign healing rules.
   - _Line: ~844_

8. **June 25, 2026 – Ruling 4:** Referential Abilities; Nemesis Sets & Identity Sets
   - Nemesis sets belong to that identity set.
   - Relevant: **Spectrum/Adam Warlock nemesis interactions** (if nemesis cards in Cycle 3).
   - _Line: ~950_

9. **August 3, 2026 – Ruling 3:** RRG 1.8 Surge Definition Cancelled by Spider-Man's Enhanced Spider-Sense
   - **Surge is treated as When Revealed ability and can be cancelled.**
   - Relevant: **MTS encounter decks** (Surge on many treacheries/minions); scheme defeat timing.
   - _Line: ~1066_

10. **August 3, 2026 – Ruling 4:** Odin Attached to Main Scheme; Negative Campaign Scores; Drax Counters
    - **Odin cannot have attachments while attached to main scheme.**
    - **Drax retains vengeance counters above 3; ability does not discard down.**
    - Directly relevant: **Hela scenario, Odin attachment** mechanics.
    - _Line: ~1078_

### Summary for Scripting

- **Piercing priority** (keyword timing before triggers) — affects Hela minions.
- **Cost arrow activation order** — affects War Machine card resolution.
- **Surge as When Revealed** — affects encounter card cancellation options.
- **Odin attachment rules** — affects Hela scenario campaign logic.
- **Form/identity switching** (Spectrum energy forms) — custom form-change logic required.

---

## 5. Taboo List (Hall of Heroes Unofficial)

**Source:** https://hallofheroeslcg.com/marvel-champions-lcg-unofficial-taboo-list/

**Status:** Hall of Heroes clarifies the taboo list is **community-maintained, not official FFG**.

**Cycle 3 Entries:** None listed as of August 2026 in official Hall of Heroes taboo page.

**Recommendation:** Do **not** apply taboo restrictions in implementation unless explicitly endorsed by FFG or adopted in formal organized play rules.

---

## 6. Watch-Outs for Scripting

### 6.1 Form Switching (Spectrum)

- **Not a hero/alter-ego flip.** Spectrum's energy forms (Gamma, Photon, Pulsar) are **additional forms** with separate conditions.
- Form change (e.g., Energy Transformation forced response) does **not** count against once-per-turn hero/alter-ego flip limit, **but does count** as "changing form" for trigger cards like Moxie (#17).
- **Implication:** State machine must track (a) hero/alter-ego form, (b) active energy form, and (c) that changing energy form increments a "form change counter" for the round.

### 6.2 Amplify Icon Stacking

- **Amplify icon increases boost icons on boost cards during enemy activation** — happens **when card turned faceup**, not when drawn.
- Multiple amplify icons add together: 2 amplify icons = +2 boost icons.
- **Implication:** Boost card resolution must check all amplify icons in play before calculating villain/minion's final ATK/SCH.

### 6.3 Two Main Schemes (Tower Defense)

- **Both main schemes active simultaneously; both gain threat per round.**
- Player card abilities referring to "the main scheme" (e.g., thwart) require player **choice** of which scheme if removing threat.
- **Constant effects** on player cards (non-choice) always refer to the scheme with "Focused Defense" attachment.
- **Implication:** Thwart/threat removal abilities must prompt player for target scheme; constant bonuses auto-target Focused Defense scheme.

### 6.4 Active Villain (Tower Defense)

- **Only one villain activates per round**, identified by "Focused Defense" attachment.
- Encounter cards saying "The villain schemes/attacks" refer **only** to the active villain.
- **Implication:** Villain activation logic must check Focused Defense attachment to determine active villain; only that villain's activation triggers encounter card abilities.

### 6.5 Infinity Gauntlet & Stone Deck

- **Gauntlet attachment requires single villain at setup; cannot be used with multiple/no villains.**
- Infinity Stones are **environment cards** (not minions/treacheries) with a separate discard pile.
- Stones' **Special abilities** are triggered **by Gauntlet's forced response** during villain activation (not direct card abilities).
- If no Stone in play when villain activates, Gauntlet puts top card of Stone deck into play.
- Stone deck reshuffle has **no built-in penalty** (unlike standard encounter deck shuffle).
- **Implication:** (a) Gauntlet validation at setup; (b) Stone deck as separate discard pile; (c) Gauntlet forced response triggers Stone Special abilities; (d) Stone card removal/discard affects Stone deck, not encounter discard pile.

### 6.6 Hele Double-Sided Flipping (Hela Scenario)

- **Hela is a single double-sided villain card** (Mystic side, Wounded side).
- When defeated with Odin attached to main scheme, **Forced Interrupt** (before normal defeat) flips Hela to Wounded side instead of advancing.
- Hit points **reset on flip**; status cards remain.
- **Win condition:** Defeat Hela while **controlling Odin ally** (must rescue from captive first).
- **Implication:** (a) Hela has two sides in villain card (same deck number, different sides); (b) Forced Interrupt on main scheme catches "Hela would be defeated"; (c) Flip logic resets HP but preserves status; (d) Victory condition checks for Odin in play, not "Odin on table" — Odin might be in hand/discard before play.

### 6.7 Loki Random Swap (Loki Scenario)

- **Not normal villain stage progression.** Loki defeated → Forced Interrupt advances to **random set-aside Loki** (not next stage).
- Five Loki variants chosen at setup; defeated Loki becomes set-aside with others.
- Attachments, status cards, counters, tokens transfer to swapped-in Loki.
- **Win condition:** Defeat **X Lokis** (number chosen pre-game); each Loki has Victory 1 → victory display.
- **Implication:** (a) Pre-game decision on Loki count; (b) Villain swap logic is randomized, not sequential; (c) Transfer logic must move all card states; (d) Victory condition checks victory display count, not remaining Lokis in deck.

### 6.8 Expert Campaign Persistent Damage

- **Each scenario records hero HP at end; becomes starting HP for next** (capped at printed HP if higher).
- Setup allows healing via acceleration token placement (up to full HP).
- **Defeated player** sits out victory steps but can rejoin next scenario with healing.
- **Implication:** Campaign state persists hero HP between scenarios; setup must offer healing option.

### 6.9 Piercing Priority (Hela Minions)

- **Piercing keyword has timing priority over triggered abilities.**
- Piercing **discards Tough before damage dealt** (damage calculation order matters).
- Relevant to Hela minions with Piercing; damage prevention (e.g., Aerial Evacuation) resolves **after** Piercing removes Tough.
- **Implication:** Damage calculation: (1) Remove Tough (if Piercing), (2) Apply DEF/prevention, (3) Apply damage.

### 6.10 Campaign-Only Cards (Setup Visibility)

- Cards #180–193 cannot be included in decks unless Campaign Instructions direct it.
- During campaign setup, some cards may be added to deck via Campaign Instructions (e.g., Cosmo, Shawarma, System Shock).
- **Implication:** Deckbuilding validation must exclude campaign-only cards by default; campaign setup flow grants conditional inclusion.

### 6.11 Steady Keyword (The Hood, Valkyrie, Hela)

- **Character with stalwart keyword cannot be stunned or confused.**
- When flipping a character between forms (e.g., Loki swap, Hela flip), **if new form has stalwart, discard any stunned/confused status cards** (not transferred).
- **Implication:** Form/card swap logic checks new card's keywords; if stalwart present, filter out Stun/Confuse status before transfer.

---

## Summary of Key Findings

1. **Three new keywords debut:** Form (Spectrum), Amplify (MTS mechanics), Steady (The Hood, Hela, Valkyrie).
2. **Two-villain + two-main-scheme mechanics (Tower Defense):** Requires choice logic for threat removal and active villain determination.
3. **Infinity Gauntlet deck system:** Separate Stone discard pile, triggered Special abilities, shuffle-only-if-empty.
4. **Hela double-sided flip:** Forced Interrupt on main scheme catches defeat, preserves status, resets HP.
5. **Loki randomized villain swap:** Not stage progression; victory condition is count, not remaining deck.
6. **Expert campaign persistent HP:** Records end-of-scenario HP as next start; setup healing optional.
7. **Piercing > Triggers:** Keyword timing priority; Tough removed before damage prevention checks.
8. **Spectrum energy forms:** Not hero/alter-ego flip; increments form-change counter for triggers.
9. **Five major errata entries:** Infinity Gauntlet, Sanctuary (damage source), Cosmo (deck options), Old Rivals (referential clarity), Machine Man (cost scope).
10. **RRG 1.8 + post-1.7 rulings align:** Surge cancellation, cost arrow activation order, Piercing priority, Odin captive rules all confirmed post-release.
