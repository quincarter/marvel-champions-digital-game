# Phase 7, Wave 9: Cycle 9 – Agents of S.H.I.E.L.D. – Sources

> **Status:** Source survey for Phase 7 wave 9 (campaign box MC50, four hero packs, Trickster Takeover). Scope is in
> [phase7-wave9-handoff.md](phase7-wave9-handoff.md).
> **Check marks:** a claim is "checked" only if the main text was read in this session from the primary file or an
> extracted PDF text layer. Everything else is "unchecked (from markdown/raw data)". The RRG PDF could not be rendered
> in this session (`pdftoppm` is missing), so every RRG page number below is read from the footer markers in
> `mc_rulesreference_v18_compressed.md` (unchecked against the PDF). Community pages are pointers, never authorities.

---

## 1. Pack list and release order

RRG 1.8 Appendix VI, "Limited Environment" item 9 (printed p. 71; the line is in the markdown at line 5280, the page
number is carried over from the wave 8 sources page, which checked it against the PDF):

> **9.** The _Agents of S.H.I.E.L.D._ campaign expansion, the _Black Panther Hero Pack_, the _Silk Hero Pack_, the
> _Falcon Hero Pack_, and the _Winter Soldier Hero Pack_.

Trickster Takeover is not in that list (it is a scenario pack, like MojoMania). Release dates are Hall of Heroes' as
indexed in `hallofheroes-llms.txt` (pointers, not authorities); the dates were not re-fetched.

- **March 7, 2025**; Agents of S.H.I.E.L.D. (`aos`); Campaign box; Maria Hill, Nick Fury; 5 scenarios; 9 evidence
- **May 2, 2025**; Black Panther/Shuri (`bp`); Hero pack; Black Panther (Shuri on the alter-ego side)
- **May 2, 2025**; Silk (`silk`); Hero pack; Cindy Moon / Silk
- **June 20, 2025**; Falcon (`falcon`); Hero pack; Sam Wilson / Falcon
- **June 20, 2025**; Winter Soldier (`winter`); Hero pack; Bucky Barnes / Winter Soldier
- **August 15, 2025**; Trickster Takeover (`tt`); Scenario pack; Enchantress, Loki God of Lies, Trickster Magic

- **Order:** the box first, then the packs in the RRG's order (`bp`, `silk`, `falcon`, `winter`); two pairs share a
  date on the index, so the RRG order is the tiebreak. `tt` last.
- The "Black Panther/Shuri" pairing in the list above is from the Hall of Heroes page title; the RRG calls it the Black
  Panther Hero Pack. Unchecked.

---

## 2. The MC50 rulebook

**Files:** `docs/campaign-modes/mc50_rulebook-web.pdf` (24 pages) and
`docs/campaign-modes/markdown/mc50_agents_of_shield.md`. **Status: unchecked (from markdown).** The PDF was not
rendered. The markdown's page numbers follow the PDF page index, which matches the rulebook's own cross-references
("see page 7", "page 19", "pages 5-6"). Pages 8, 10, 12, 14, 16, 17, 20 and 21 are full-page art with no text. Some
text on the scenario pages is out of order in the conversion (noted where it matters).

### 2.1 Components and new rules

- **p. 2:** 273 cards (95 player, 8 villain, 161 encounter, 9 evidence), 2 card envelopes. The raw cache has 195
  top-level records because copies are not counted separately. Villain cards are listed with the identity cards.
- **p. 3, Featured terms:** "Find" (excludes victory display, removed cards and facedown dealt encounter cards),
  Piercing, Ranged, Setup, Stalwart, "Tuck". **Featured keywords:** Form (marked new in the rulebook; the star is lost
  in the conversion), Hinder X, Incite X, Steady, Team-Up, Victory X, Villainous, Patrol, Permanent and
  **Vulnerable** (marked new). Victory display is defined here.
- **p. 3, Vulnerable:** a character that becomes stunned or confused is immediately discarded and is not defeated,
  even if it is simultaneously dealt lethal damage. RRG p. 48 adds the Forced Interrupt equivalence, the order rule
  (discarded before the damage is applied) and the Steady interplay (see 5.1); the RRG is fuller, not in conflict.
- **p. 4, All-purpose counters:** a counter placed or moved by a card effect loses its previous type and takes the
  type the new card defines; with no defined type it is a plain all-purpose counter. Same as RRG p. 6 (5.1).
- **p. 4, Amplify icon:** when a boost card is turned faceup during an enemy activation, add one boost icon for each
  amplify icon in play. Same text as the MC45 rulebook (the engine has `amplify.test.ts`).
- **p. 4, Attacks against allies:** undefended damage goes on the attacked ally; "you" boost text refers to the ally's
  controller; "attacks you" triggers do not fire; overkill past a defeated ally goes to that player's identity.
- **p. 4, Non-scaling villain HP:** Batroc (86), M.O.D.O.K. (103) and Baron Zemo (165A-166A) have fixed hit points.
  Each has a Forced Interrupt at 0 hit points that gives a benefit and resets the hit points; this replaces the
  defeat, so the villain is not defeated for other card effects (p. 4 note, repeated in the FAQ on p. 22).
- **p. 4, Campaign mode rules:** play the five scenarios in order, one identity per player for the whole campaign,
  aspects and decks may change between scenarios. Set up as normal, then **before drawing starting hands** follow the
  scenario's Setup instructions in listed order. A loss may be replayed with no penalty. Campaign log on p. 24.
- **New card kinds and tokens:** three evidence types (means, motive, opportunity; raw `type_code` `evidence_means`,
  `evidence_motive`, `evidence_opportunity`, three each); secret counters (Board Members), lock counters (Holding
  Cells), the Preparation ability (Black Widow set). The engine already has `evidence: null` in
  `packages/engine/src/card-types.ts` and campaign hooks in `packages/engine/src/campaign.ts`.

### 2.2 The Executive Board and evidence (pp. 5-6)

- **p. 5:** one of three board members is a mole. At campaign start, split the nine evidence cards by card back into
  three sets of three, shuffle each and put one from each into the A.I.M. envelope unseen; the other six go into the
  S.H.I.E.L.D. envelope. The campaign log lists every means / motive / opportunity combination, each implicating one
  board member; evidence gained crosses combinations out.
- **p. 6, Gathering evidence:** each board member is an environment with secret counters. If at least one board member
  has no secret counters when a scenario ends, the players gain one evidence card from the S.H.I.E.L.D. envelope.
  Evidence is not added to a deck; its **Setup** ability runs in later scenarios' campaign setup.
- **p. 6, Betrayal:** A.I.M. Interference (three copies) adds secrets. A board member with 4 secrets (3 in expert) flips
  to its attachment side and stays that way for the campaign; secrets carry over between scenarios.
- **p. 6, Modular use:** outside the campaign, put 2 secret counters on each Board Member during setup; the set does
  not count toward the modular set requirement.
- **p. 6, Expert campaign:** "Expert Campaign Only" steps apply. Persistent damage: record remaining hit points after
  a win (capped at base), and each scenario's Setup offers a heal at a scenario-specific cost. A defeated player skips
  that scenario's Victory steps and may rejoin at the next Setup by taking its heal option.

### 2.3 Precon decklists (p. 7)

- **Nick Fury / Justice:** Nick Fury cards (Assault / Stealth, Maria Hill ally, Concentrated Fire x2, Covert
  Surveillance
  x3, Spray Fire x2, Fury's Flying Car, Safe House #221, EM Shield, Eyepatch Camera, Fury's Watch, Intelligence
  Analysis,
  Secret Agent), Justice cards, basic cards, nemesis set Orion, obligation Discovered.
- **Maria Hill / Leadership:** Maria Hill cards (Nick Fury ally, All-Points Bulletin x2, On the Double x2,
  Reinforcements
  x3, The Hard Call, Special Funding x2, Support Staff, The Iliad, Life Model Decoy, S.H.I.E.L.D. Director), Leadership
  cards, one each of Aggression / Justice / Protection helicarriers (Bellerophon, Douglass, Pericles), basic cards,
  nemesis set Controller, obligation Press Conference.
- The full lists are in the markdown at lines 411-447; verify counts against the PDF and `aos.json` when the data survey
  builds the decks.

### 2.4 Scenarios

- **1**; 9; Black Widow; Preparation abilities; prepare the evidence; Board Members with 2 secrets; A.I.M. Interference
  shuffled in
- **2**; 11; Batroc; Win by advancing the three main scheme stages, not by defeating Batroc; Rescued Captive allies;
  Alert Level
- **3**; 13; M.O.D.O.K.; Holding Cell deck (four double-sided cards), lock counters at 2 per hero; Adaptoids
- **4**; 15; Citizen V; Thunderbolt Backup environment; 1 per hero plus one modular sets containing an Elite Thunderbolt
  minion
- **5**; 18; Baron Zemo; The Accusation (p. 19); Executive Board and Evidence sets; Adaptoids and surviving Thunderbolts
  return

- **Scenario 1 (p. 9):** Victory records minions and side schemes in play, secrets per board member, gains evidence if a
  board member is at 0. Preparation cards do nothing as boost cards; they resolve only via Black Widow's Forced
  Interrupt when a hero or ally attacks her (attack-labeled abilities included): remove 1 threat from the main scheme
  (ignoring crisis); if none is removed the rest does not resolve; otherwise discard the top encounter card and resolve
  its Preparation. Non-attack damage does not trigger it. Expert: remove Black Widow (I), add (III).
- **Scenario 2 (p. 11):** Setup places threat on Alert Level equal to scenario 1's recorded minions and side schemes.
  Stage 2 reset to 3 per hero to free another captive. Victory records Rescued Captive allies in play. Expert heal
  option: place a secret on a Board Member to heal the identity by REC. Same expert lines on pp. 13, 15, 19.
- **Scenario 3 (p. 13):** Setup adds 3 per hero lock counters to the top Holding Cell, then removes X per hero where X
  is
  the recorded Rescued Captives. Victory marks each Adaptoid environment (109-112) in play in the log. FAQ on p. 22:
  overkill on an Adaptoid that defeats M.O.D.O.K. resolves M.O.D.O.K.'s Forced Interrupt ("would") first; an Inhuman
  ally
  leaving play with an empty Holding Cell deck flips to become the deck.
- **Scenario 4 (p. 15):** Thunderbolt Backup is the reverse of Justice, Like Lightning; the attached minion is in play,
  does
  not activate, and engages a player who attacks it. Its Forced Interrupt attaches the most damaged Thunderbolt and
  heals
  it; ties are chosen by the first player (p. 22). Victory records surviving Thunderbolts by name.
- **Scenario 5 (p. 18-19):** campaign Setup puts recorded Adaptoid environments into play, shuffles Adaptoid minions in,
  shuffles surviving Thunderbolts (except Jolt, 133) and their sets in, and sets the envelopes aside. Stage 1B Response
  at the end of each player phase lets players place 2 secrets on a secretless board member to gain evidence, or advance
  to the Accusation. All board members joining Zemo is a loss. Wrong guesses place secrets (pp. 19). Defeat in an expert
  campaign loses the campaign; in standard, replay with the evidence rebuilt (one card per scenario that had a
  secretless
  board member). Reluctant Foe (171) FAQ on p. 22 (a non-game hero identity becomes a villainous minion).
- **Possible card/rulebook mismatch (unchecked):** p. 4 says each non-scaling villain has a Forced Interrupt, but p. 18
  says reducing Baron Zemo to 0 hit points triggers his "Forced Response". Check the printed Zemo card text in
  `aos.json` before scripting.
- **FAQ, p. 22:** All-Points Bulletin may pick a different target per S.H.I.E.L.D. support; Stealth's threat goes only
  on
  the upgrade, not the main scheme first; a stunned villain removes the status instead of activating (status cards take
  priority); Stealth's Forced Interrupt does not trigger when Nick defends for another player; attacking Black Widow to
  remove a stunned status does not trigger her. In the markdown the Batroc / M.O.D.O.K. / Zemo question and its answer
  ("No", the defeat is replaced) are separated at the foot of the page.
- **Campaign log (p. 24):** identities and remaining hit points per player, scenario 1 minions and side schemes,
  scenario 2
  Rescued Captives, scenario 3 Adaptoid environments (Flying, Psionic, Sarah Garza, Strong upgrades), scenario 4
  surviving Thunderbolts, secrets per board member by scenario, and the means / motive / opportunity grid per board
  member.

---

## 3. Trickster Takeover (`tt`)

**Insert:** none in the repo (`docs/campaign-modes/` has MC10 to MC60 but no MC55). **Fetched this session:** the Hall
of Heroes page (https://hallofheroeslcg.com/trickster-takeover/) links the insert at
https://hallofheroeslcg.com/wp-content/uploads/2025/08/mc55_rulebook-web.pdf. The WebFetch summarizer could not read it,
but the PDF's text layer extracts cleanly (24 pages, read in full this session, so the claims below are "checked"
against
that file). Recommend the owner add the PDF to `docs/campaign-modes/` as `mc55_rulebook-web.pdf` (it was not saved to
the
repo here). The rulings link on the page points at the generic "latest rulings" post, not a separate page.

### 3.1 What the raw data shows (`packages/content/raw/marvelcdb/tt.json`, 66 records)

- Sets: `enchantress_villain` 26, `god_of_lies` 29, `trickster_magic` 11. No hero, no obligation.
- Enchantress villain 55001-55003 (I-III); main schemes 55004a Prime Real Estate (Contents: Enchantress, Standard, one
  modular set Trickster Magic; Setup: set Future of Despair aside, attach a random Hypnotic Gaze to each identity, set
  the
  rest aside) and 55005a Sovereign Sorceress. Enchantress II and III are Steady and Toughness; Future of Despair gets 3
  /
  4 per-hero extra threat in standard / expert.
- God of Lies: villain 55027a Loki, God of Lies (flips at 10 per-hero remaining hit points), main schemes 55028a Worlds
  Collide (Setup: a separate game area per player group, "see page 9 of rules insert") and 55033a Mischief and Mayhem
  (Setup: random Avatar of Loki villain into play, set the rest and Shatter the Illusion aside, Synergy environments in
  play, Intense Focus attached in expert or set aside in standard). Four Avatars: Rascal, Miscreant, Knave, Wretch, each
  with a Forced Interrupt "would be defeated: place 5 per-hero shatter counters and flip".

### 3.2 Insert content (MC55, checked this session)

- **p. 2-3, Featured:** Find, Hinder X, Incite X, **Linked (Card Title)**, Patrol, Permanent, Stalwart, Steady, Victory
  X.
  Linked is new to this cycle's text (the engine already treats it as a cycle 7 term).
- **p. 4, Per-group icon:** in God of Lies, each player joins a group of 1-4 and each group sits in a pod; the icon
  multiplies by the groups in that pod, or by all groups when the card is not in a group's area (Worlds Collide).
  Modular
  set Trickster Magic: four Enthralled elite minions (Absorbing Man, Titania, Whirlwind, Zzzax); the defeater puts the
  linked ally into play under their control (Victory 0, does not count against ally limit).
- **p. 7, New for Enchantress:** the **Forced Action** attachment ability (an action the player may take any time during
  the
  player phase; the phase cannot end until every possible Forced Action is performed; impossible if the card is
  discarded or
  the cost cannot be paid), and Enchantment attachments (Hypnotic Gaze front, "Trance" back unseen until flipped; When
  Revealed triggers on flip).
- **pp. 9-17, God of Lies modes:** Single Group Mode (setup resolves Worlds Collide (A) then Mischief and Mayhem (1A);
  Loki,
  his dial and Worlds Collide live in a separate area that only title-naming cards affect) and Epic Multiplayer Mode
  (groups with their own areas, encounter decks and 4 Avatars sharing one dial; Loki set to 20 per-player hit points
  across
  all groups; an event organizer tracks Loki's hit points and Worlds Collide threat; default 180-minute limit; pods).
  Mangog and Door Between Worlds can be hit by any player in the pod (p. 16). Synergy environments (p. 17).
- **pp. 18-21, both modes:** shatter counters, shattering the illusion (Shatter the Illusion card steps resolve before
  the
  Fading Figment's second sentence), **swapping Avatars** (replace without leave/enter/reveal; damage, attachments,
  status
  cards, counters and tokens transfer), tracking damage on Loki (5 per-hero shatter counters to Fading Figment, which
  deals
  that much to Loki), Worlds Collide target threat of 2 per group (if Loki is not defeated when all player phases end,
  all
  lose).
- **p. 22-23 FAQ:** Future of Despair threat totals 5 / 6; Temptation Forced Actions are mandatory even with no benefit;
  attacks on an alter-ego-form identity from Spell Blast or Stories and Lies resolve as normal; the first player
  resolves a
  Fading Figment's text.
- **Scope note for the owner:** Epic Multiplayer Mode is a multi-group, simultaneous-play, event-organizer mode. The
  handoff lists "single-table and epic multiplayer"; whether to build Epic mode is a scope question for the owner and
  for
  the netcode agent, not decided here.

---

## 4. New keywords and mechanics per pack

Method: bold ability labels and keyword text in the raw JSON were counted by script, then compared with
`packages/engine/src` and `packages/content/src/schema` by grep. File-level grep only, so "known" means the term appears
in the engine or schema, not that it is fully implemented (unchecked).

- **Vulnerable:** 8 `aos` cards. In `schema/keywords.ts` and `glossary.ts` (box "later") but **no engine source mentions
  it**
  (grep of `packages/engine/src` finds nothing). The engine rule is new work (RRG p. 48, see 5.1).
- **Evidence cards:** `evidence` is a `null` rules type in `card-types.ts`; campaign setup hooks mention evidence in
  `campaign.ts`. Needs the schema card type and the envelope/log model.
- **Preparation** (26 `aos` cards, 1-4 in each hero pack): an ability label that replaces Boost on Black Widow set
  cards;
  appears in `engine/src` four times (unchecked). Hero cards from Black Widow's pack also use it (RRG errata p. 65).
- **Secret / lock counters** (25 and 6 `aos` cards), **Alert Level**, **Holding Cell deck**, **Thunderbolt Backup**
  attach-a-minion environment, **Rescued Captive** allies: scenario-specific; no generic engine concept yet.
- **Known keywords, heavy use:** Villainous (`aos` 10), Hinder (7), Incite (3), Patrol, Victory, Permanent, Guard,
  Retaliate,
  Quickstrike, Toughness, Surge, Team-Up (`aos` 1, `bp` 1, `silk` 1, `winter` 2), Restricted (`bp`, `silk`, `falcon`,
  `winter`), Steady, Piercing, Ranged, Stalwart. Each has engine or schema hits (Hinder 23, Incite and Patrol and
  Team-Up in
  the engine tree). Per-keyword depth not checked.
- **Form keyword:** Nick Fury's suit forms (Assault, Stealth). Engine has `additional-forms.test.ts`; confirm it covers
  a
  Forced Interrupt that changes form on attack and the Stealth redirect to a scheme activation.
- **Tuck** (`silk` 17 cards, `aos` 7, `falcon` 2): engine handles tucked cards in several files. Silk also has a
  growth-counter
  lose condition (Atlas with 10 or more growth counters).
- **Wakanda trait** (`bp` 11, `falcon` 1) and Black Panther's "Special" abilities resolved by an identity action.
- **`tt`:** Forced Action (no engine match), per-group icon (`perGroup` and `per_group`: 0 hits), shatter and synergy
  counters
  (0 hits), charm counters (6 hits, unrelated?), Enthralled, Linked allies, Avatar of Loki villain swap (engine has
  `villain-swap.test.ts`), Epic Multiplayer pods and separate game areas.
- **Amplify:** engine has `amplify.test.ts`; the MC50 rule is the same as MC45.

---

## 5. RRG 1.8 entries that name these products

Page numbers come from the footer markers in the markdown ("Rules Reference / NN" at the end of each page); the PDF
could not
be rendered here, so all are unchecked against the PDF. Card numbers are RRG collector numbers.

### 5.1 Rules text

- **All-purpose counter**; 6; Moved counters lose their old type and take the new card's type (markdown line 454)
- **Form, Change Form**; 21; "[type] form" keyword grants unique forms; changing one does not use the once-per-turn flip
  (line 1618)
- **Hinder X, Incite X**; 22, 24; Index entries; text at lines 1712 and 1882
- **Vulnerable**; 48; Confused or stunned: discarded, not defeated; equals Forced Interrupt; discarded before damage;
  Steady

Vulnerable detail (RRG p. 48): with both Steady and Vulnerable, Vulnerable does not take effect until two confused or
two stunned
status cards.

### 5.2 FAQ (Appendix IV)

- **Agents of S.H.I.E.L.D. Expansion, p. 64:** Maria Hill (#1B), only one question: her deck rule is all or nothing;
  include the max
  copies of exactly three S.H.I.E.L.D. supports from other aspects, or none.
- **p. 65 (the rest of the entries after the footer 64):** Stealth (#35): when Stealth changes the villain activation to
  a scheme and
  the villain is confused, the confused status cancels the reinitiated scheme and Nick places no threat on his suit
  form.
- **Black Panther Hero Pack, p. 65:** The Elephant's Trunk (#7), exhausting itself pays its own cost (it is a Wakanda
  support); Target Spotter
  (#38), the minion engages the player using Target Spotter, not the revealer.
- **Falcon Hero Pack, p. 65:** Redwing (#2), cannot trigger when the visible top encounter card has no boost icons.
- No FAQ entries name Silk or Winter Soldier (checked by grep of the markdown). Black Panther's own Retaliate FAQ at
  markdown lines
  4236-4242 belongs to the Core-era Black Panther card, not this pack.

### 5.3 Errata (Appendix V)

- **Radiation Exposure (`aos`)**; #171A; 69; The "SCH" modifier should be a "THW" modifier
- **Mach-IV (`aos`)**; #156; 69; "Each character without Aerial cannot defend against Mach-IV's attacks" (was "make
  basic defenses")
- **Eidetic Memory (`silk`)**; #8; 70; "Silk" becomes "your identity" in the Interrupt text
- **S.H.I.E.L.D. Deputy (`winter`)**; #33; 70; Gains "Max 1 per character."
- **Swapping Avatars of Loki (`tt` rulebook p. 19, paragraph 1)**; none; 70; Swap rule rewritten to cover a Fading
  Figment swapping with a set-aside Avatar of Loki

- **Parsing caution:** in the markdown the Agents errata block (lines 5124-5137) interleaves headings: a "Your identity
  gets +4 hit
  points" correction sits under the X-23 heading with no card name. Do not take the Mach-IV or +4 hit point rows as
  final until read from the
  PDF p. 69. The `tt` rulebook p. 19 errata matches the insert's p. 19 "Swapping Avatars of Loki" section (checked
  against the insert).
- No errata name Black Panther or Falcon cards in this cycle (grep of the markdown).

---

## 6. FFG rulings that touch these packs

Source: `marvel-champions-rulings-post-rrg-1-7.md` (transcribed by Hall of Heroes; author of each ruling Alex Werner).
Found by
matching every card and villain name in the six raw caches against the file. Cite by date heading and number. Each entry
was read.

- **December 17, 2025 - Ruling 1 (Q2):** Aerial Evacuation (Falcon) reduces damage taken, like other prevention.
- **December 17, 2025 - Ruling 3:** "After [enemy] attacks you" is the one exception where "you" is the player (allies
  count). Nick Fury's Stealth
  triggers on "when" an enemy would attack, so only when Nick himself is attacked. Consistent with MC50 p. 22.
- **January 17, 2026 - Ruling 2:** Winter Soldier's Arm Block against Black Widow: her interrupt reveals A.I.M. Grunt,
  which takes Arm Block's
  attack; Arm Block still prevents damage from her original attack.
- **January 17, 2026 - Ruling 3:** Piercing removes Tough before Falcon's Aerial Evacuation can prevent damage taken
  ("keywords have timing
  priority over triggered abilities"). Prevent effects reduce damage taken, not dealt.
- **January 26, 2026 - Ruling 2:** an all-purpose counter takes the counter type of the card it is placed on (example is
  Captain Americat on
  Drax). Matches RRG p. 6 and MC50 p. 4.
- **January 26, 2026 - Ruling 4 (Q2):** flipping Alert Level (or Wheel of Genres) is not a reveal, so the Black Widow
  protection ally cannot
  cancel it.
- **January 26, 2026 - Ruling 6:** Redwing cannot trigger when the top encounter card has no boost icons (visible);
  consistent with the RRG FAQ
  on p. 65.
- **February 28, 2026 - Ruling 3:** God of Lies, Shatter the Illusion: Intense Focus / Total Focus (permanent) do not
  leave play; they attach to
  the swapped-in Avatar. **Flag:** this is a statement that "scenario intent takes precedence". Policy (owner,
  2026-10-07): build the intent. It
  agrees with the insert's p. 19 transfer rule and the RRG errata for swapping Avatars.
- **February 28, 2026 - Ruling 5:** Spell Blast: choose an option sentence by sentence before resolving it; Enchantress
  may choose to scheme
  while confused, which removes her confused status.
- **March 6, 2026 - Ruling 1:** Arm Block prevents damage taken, not dealt, so Sonic Boom still exhausts Winter Soldier.
  Aerial Evacuation on an
  ally means no excess Overkill damage reaches Sam Wilson (treated like Tough).
- **March 6, 2026 - Ruling 2:** Quick Quip (Silk-related card in the data) may place Confused on only one of its "up to
  2" enemies.
- **March 19, 2026 - Ruling 2:** a character cannot basic attack Enchantress while Future of Despair makes her unable to
  take damage.
- **March 19, 2026 - Ruling 5:** Redwing visible with 0 icons cannot trigger; facedown and unknown it can (incomplete
  information allowed).
- **April 30, 2026 - Ruling 3 (Q3):** flipping Wheel of Genres or Alert Level does not trigger Silk's Eidetic Memory
  (not a reveal). Also Q2:
  Toughness triggers when an ally enters play during campaign setup.
- **June 25, 2026 - Ruling 1:** Falcon with the Captain America title upgrade takes Steve's Shield into hand; if
  discarded it returns to Steve's discard.
- **June 25, 2026 - Ruling 4 (Q3, Q4):** environments flip and are not revealed; Incite resolves even if Twisted Reality
  fails to attach.
- **June 25, 2026 - Ruling 5:** God of Lies, Total Focus: finding and revealing Dark Scepter when it is already in play
  still triggers its
  When Revealed and keywords.
- **July 9, 2026 - Ruling 2:** reduce and prevent are synonyms for cost purposes; Aerial Evacuation prevents damage
  taken, damage is still dealt.

**Conflicts and intent flags:** none contradicts the RRG as read. Three rulings state intent or interpretation to build:
February 28 Ruling 3
(intent), January 17 Ruling 3 (keyword timing priority; check against RRG 1.8 timing text when scripting Piercing vs
prevention), and
December 17 Ruling 3 (Stealth is "when"-triggered). Rulings on non-wave cards that also name Silk, Falcon or Winter
Soldier cards in passing
(Captain America shield rulings of December 17 and January 11, 2026; June 2 Ruling 2 on Spectrum; July 9 Ruling 1 on
Spider-Sense) were not
read in full and are not listed.

---

## 7. Open points for the spec

1. Add `mc55_rulebook-web.pdf` to the repo (owner), then spec Trickster Takeover from it; decide whether Epic
   Multiplayer Mode is built.
2. Verify the Zemo Forced Interrupt / Forced Response mismatch (2.4) from the card data.
3. Read RRG pp. 64-65, 69-70 and 48 from the PDF in a session where PDF rendering works (poppler), and resolve the
   interleaved Agents errata.
4. Vulnerable is new engine work; evidence cards are a new schema type; secret / lock / shatter / synergy counters,
   Forced Action and the
   per-group icon have no engine hits.

## Sources

- [Agents of SHIELD](https://hallofheroeslcg.com/agents-of-shield/) (pointer; not re-fetched)
- [Trickster Takeover](https://hallofheroeslcg.com/trickster-takeover/) (fetched; insert PDF link above)
- [Black Panther/Shuri](https://hallofheroeslcg.com/black-panther-shuri/), [Silk/Cindy
  Moon](https://hallofheroeslcg.com/silk-cindy-moon/),
  [Falcon/Sam Wilson](https://hallofheroeslcg.com/falcon-sam-wilson/),
  [Winter Soldier/Bucky Barnes](https://hallofheroeslcg.com/winter-soldier-bucky-barnes/) (pointers, from
  `hallofheroes-llms.txt`)

## Internal sources

- `mc_rulesreference_v18_compressed.md` (July 2026) and `.pdf` (not rendered this session)
- `docs/campaign-modes/mc50_rulebook-web.pdf` and `markdown/mc50_agents_of_shield.md`
- `marvel-champions-rulings-post-rrg-1-7.md`
- `packages/content/raw/marvelcdb/{aos,bp,silk,falcon,winter,tt}.json` (fetched 2026-09-13)
