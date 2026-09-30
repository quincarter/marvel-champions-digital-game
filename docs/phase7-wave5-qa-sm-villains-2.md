# Phase 7 wave 5 rules-QA pass — The Sinister Six, Venom Goblin, and the modular sets (villains, main schemes, modulars)

`rules-qa-engineer` independent QA pass over the two remaining Sinister Motives scenarios — `sm/sinister-six`
(multi-villain, including its own Guerrilla Tactics modular) and `sm/venom-goblin` (lettered main-scheme stages with
environment faces) — plus the five modular sets in `sm/modulars/`: Down to Earth, Whispers of Paranoia, Goblin
Gear, Osborn Tech, Sinister Assault. Mirrors `docs/phase7-wave5-qa-sm-villains.md`'s format and depth. Out of scope,
per the task's boundary: `campaigns/`, engine files, client files, `spdr/sinister-syndicate.*`.

## 1. Card-by-card audit

Scope read: `packages/cards/src/wave5/sm/sinister-six/{villains,main-scheme,scenario-cards,treacheries,
encounter-attachments,guerrilla-tactics}.ts`, `packages/cards/src/wave5/sm/venom-goblin/{villain,main-scheme,
encounter-set}.ts`, `packages/cards/src/wave5/sm/modulars/{down-to-earth,whispers-of-paranoia,goblin-gear,
osborn-tech,sinister-assault}.ts`, the matching slice of `packages/content/src/data/sm/cards.ts`, the card scans
under `assets/card-art/bundles/cards/`, RRG 1.8, `docs/campaign-modes/markdown/mc27_sinister_motives.md`, and
`marvel-champions-rulings-post-rrg-1-7.md` (grepped for "Sinister Six", "Venom Goblin", "Doctor Octopus", "Electro",
"Hobgoblin", "Kraven", "Scorpion", "Vulture", "glider", "activation order" — no ruling specific to these cards
beyond what `docs/phase7-wave5.md` §4.1 already cites, notably Q71's "All first" villain-phase step-one ordering,
which this scenario pair is the _only_ place in the box that can observe the difference).

**Every ability's own script carries a docblock that ties its reading line-by-line to the printed text and cites the
exact RRG page or spec question for every non-obvious call** — the same standard `-villains.md` and the other wave 5
QA passes found. Spot-checked against the card scans (not just `text.printed`) for the highest-risk cards in scope,
all matching word for word:

- Sinister Synchronization/Beatdown 27100a/27100b/27101a/27101b (multi-villain setup, Ambush!, and the Forced
  Interrupt at zero villains in play) — every scan matches the script's docblock exactly, including the parenthetical
  "(even if another villain has the counter)" on 2A and the expert-only "place 2 threat on Light at the End" on both
  B faces.
- The six Sinister Six villains' own Forced Response/When Defeated text (27094–27099) — scans confirm the shared
  `sinisterSixVillain` builder's reading of "a side scheme" (the first player's choice among several, a no-op with
  none) and "no other villain is in play" (read at When Defeated, excluding the defeated villain itself).
- The four encounter attachments' "If you cannot, resolve the 'Ambush!' ability on the main scheme, then attach this
  card to the active villain" fallback (27103–27106) and Take One for the Team's "cannot attack villains without an
  attached copy" restriction (27106) — scans match; `cannotAttach` is the right engine primitive for the "If you
  cannot" branch (RRG 1.8 "Attach To", p. 8, normally a discard, but this card's own text overrides that default).
- Venom Goblin (I)–(III) 27113–27115 and Skies Over New York's four lettered faces (27116a/b–27119a/b) — scans match
  the script's reading of "move the glider counter to the main scheme with the least threat" (a tie broken by the
  first player, MC27 p. 21 FAQ) and the p. 67 erratum's "When a main scheme is completed, flip it to its environment
  side" (data, `onCompletion: "flipToOtherFace"`).

No wording drift found between any scanned card and its `text.printed` in this scope.

### 1.1 The Sinister Six (`sinister-six/villains.ts`, `main-scheme.ts`, `scenario-cards.ts`, `treacheries.ts`,

### `encounter-attachments.ts`, `guerrilla-tactics.ts`)

- **The six villains (27094–27099)**: `sinisterSixVillain` correctly wraps `moveActiveCounterToNextVillain` as the
  _last_ effect in the Forced Response, matching the printed sentence order ("…, [EFFECT]. Move the active counter
  to the next villain in the activation order.") on all six cards. Confirmed independently against RRG 1.8
  "Activation Order" (the engine's own wrap-to-lowest / lone-villain-keeps-it behavior lives in
  `moveActiveCounterToNextVillain` itself, tested in `packages/engine/src/set-aside-villains.test.ts`, not
  re-derived here) and the p. 21 FAQ's "no other villains in play" reading for the 4-vs-7-threat When Defeated
  branch. `villains-2.test.ts` exercises every one of the five non-Doctor-Octopus villains' own Forced Response and
  When Defeated individually (Electro's exact-7-cards discard order, Hobgoblin's indirect-damage-to-an-ally split,
  Kraven's empty-choice no-op, Scorpion's ally-vs-hero stun choice, Vulture's counter-wraparound back to Scorpion) —
  a genuinely thorough per-card pass, not a shared-builder smoke test.
- **Sinister Synchronization/Beatdown (27100a/b, 27101a/b)**: 1A's Setup reads "Choose X villains at random, where X
  is 1 more than the number of players" as `perHero(1, 1)` (1 base + 1 per hero) — confirmed against
  `sinister-six/scenario.test.ts`'s own 1/2/3/4-player assertions (2/3/4/5 villains in play respectively), matching
  the printed formula exactly. 2A's When Revealed correctly reads "If no villain was put into play this way **or**
  this is expert mode, deal the first player 1 facedown encounter card" as an _or_, not an _and_ (`anyOf`) — checked
  against the scan (27101a.png): the printed sentence is unambiguous, and the script's `anyOf(not(varAtLeast(...)),
inMode("expert"))` reads it correctly.
- **Light at the End (27102a/27102b)**: the Trap!/Chase! pair correctly uses `on.schemeDefeated("self")` rather than
  the ordinary side-scheme-completion path, because RRG 1.8 "Permanent" (p. 32) means the card cannot actually leave
  play via the normal defeat pipeline — `applySchemeDefeated`'s leave step no-ops for it, but the event that opens
  the Forced Interrupt window still fires first. This is exactly the kind of "keyword vs. keyword" interaction
  (Permanent vs. defeat-triggered abilities) this project's instructions call out as the highest-risk category, and
  it is independently re-derivable from the RRG page cited, not just asserted.
- **The four attachments + Brute Force Barricade (27103–27107)**: `attachesTo` (a `superlative` host by activation
  order, remaining HP, or ATK) is data, confirmed against `packages/content/src/data/sm/cards.ts` line-by-line
  against each card's own scan (§1 above); the "If you cannot" fallback is the one non-obvious engine choice
  (`cannotAttach`, not a discard) and is correctly built and cited. Take One for the Team's restriction reads "an
  attached copy" by name-matching rather than instance-matching (`hasAttachment: query(["attachment"], { name: … })`)
  — correct, since with `quantityInSet: 1` there is only ever one copy in this deck, but the by-name reading is also
  the right general answer if a scenario ever ran two copies (RRG 1.8 doesn't distinguish "a copy of this card" from
  "this specific card" for a named-card restriction).
- **The five treacheries (27108–27112)**: Frequent Flyers/High Fashion/Robotic Enhancements' "put the set-aside
  [name] into play; if already in play, [penalty]" shape correctly treats `addVillain` as a no-op when the villain is
  already in play (so "if already in play" and "put into play" are mutually exclusive per card, matching the printed
  `ifThen` structure exactly) rather than double-resolving. Partnership of Pain's alter-ego/hero split (lowest
  activation order schemes with pooled SCH / highest activation order attacks with pooled ATK) correctly binds the
  acting villain _before_ summing every _other_ villain's stat, so the acting villain's own stat is never
  double-counted — confirmed against the card's own math by hand for a 3-villain board (2+3 SCH villains + the
  actor: the actor's own printed SCH plus the other two's, not all three's).
- **Guerrilla Tactics (27142–27146)**: correctly scopes "each enemy"/"the engaged player" to the generic
  `query("enemy")` category (villain + minion), so these five cards behave identically whether one villain or up to
  six Sinister Six villains happen to be in play — no scenario-specific special-casing, matching this project's
  "engine code never names a card" convention even inside a scenario-specific modular set.

### 1.2 Venom Goblin (`venom-goblin/villain.ts`, `main-scheme.ts`, `encounter-set.ts`)

- **Venom Goblin (I)–(III) 27113–27115**: each stage's own Forced Response correctly layers on top of the shared
  `moveToLeastThreatScheme` helper — (I) offers a choice (2 threat or resolve Special), (II) always resolves Special,
  (III) always places 1 threat _and_ resolves Special — matching each scan's own escalating text exactly. The
  `SCHEME_WITH_GLIDER` read-after-move ordering (the villain's text always names the counter's _destination_, never
  where it started) is correctly sequenced: `moveToLeastThreatScheme`'s `moveCounters` runs before the later effects
  read "that scheme" again.
- **Skies Over New York / Lower / Midtown / Upper Manhattan (27116a/b–27119a/b)**: the glider counter starts on
  Midtown Manhattan at setup (confirmed against `venom-goblin/scenario.test.ts`'s own assertion and the scan) and
  each lettered stage's own Special (place 1 threat on each scheme / take 2 indirect damage / discard 1 hand card)
  plus its "if a [Symbiote] environment is in play, [escalated version]" clause both match. The p. 67 erratum's own
  "When a main scheme is completed, flip it to its environment side" and the loss condition ("at least 2 [Symbiote]
  environments in play") are correctly split: the flip is `onCompletion` data (engine-driven), the loss check is a
  `stateCheck` (not folded into the When Revealed) specifically so it also catches a second [Symbiote] environment
  entering play by any _other_ route later — independently verified as the right call against RRG 1.8 "Uses" (p. 46)'s
  edge-triggered state-check pattern this project already uses elsewhere.
- **§4.1 Q71 ("All first") is this scenario's own reason for existing**: `venom-goblin/scenario.test.ts`'s "a tie for
  the least threat is broken by the first player" test explicitly checks that Midtown's own completion reads Lower's
  and Upper's threat _after_ every main scheme's own step-one acceleration has already applied, not just Midtown's —
  the exact scenario Q71 was decided for. Re-derived independently against MC27 p. 15 "Villain Phase" step one and
  confirm the test's own math (0 threat + 1 each = a genuine tie, not a false one from reading Lower/Upper before
  their own acceleration).

### 1.3 The modular sets (`modulars/*.ts`)

- **Down to Earth (27131–27135)**: Common Criminal's Alter-Ego Action, Volunteer Work's un-thwartable side scheme
  plus REC-scaled Alter-Ego Action, and both treacheries (form-pressure, obligation search-and-reveal) all match
  their scans. Loose Ends' own docblock is explicit about what it does _not_ model exactly (the mid-reveal
  hero→alter-ego→hero round trip) rather than silently approximating — the right call per this project's "a passing
  suite is a claim, not a guarantee" standard, and low-risk since no card in the current pool actually changes form
  twice inside one reveal window.
- **Whispers of Paranoia (27170–27173)**: Manipulated Mind's post-errata "Attached ally engages its controller"
  clause (RRG 1.8 p. 67) is correctly built in even though the bundled scan (27171.png) is the pre-errata print — the
  docblock calls this out explicitly rather than silently trusting the older scan, the right precedence per
  CLAUDE.md's own "where a ruling and the RRG disagree, the ruling is the later clarification" rule (here it's an RRG
  errata directly, not a separate ruling, so there's no real conflict — just a scan that predates the errata). Old
  Grudge and Analysis Paralysis's nemesis-search pools both correctly include the scenario's own set-aside area
  alongside the encounter deck/discard and the player's own set-aside area — verified against Old Grudge's scan.
- **Goblin Gear (27136–27141)**: Advanced Glider's repeat-activation Forced Response is correctly capped
  `oncePerRoundPerPlayer` (matching the printed "(Max 1 per round per player)" clause on the scan) and queues the
  repeat _behind_ the activation that triggered it (`afterCurrentActivation: true`) rather than resolving
  concurrently — correctly avoiding a re-entrant activation mid-resolution. Concussive/Incendiary/Smoke Bombs' shared
  "Uses (2 bomb counters.)" printed-punctuation quirk (a period _inside_ the parenthesis, unlike every other "Uses"
  card in the corpus) is documented as a real curation-pipeline artifact, cross-checked against the card's own scan
  rather than assumed to be a MarvelCDB transcription slip — the right level of skepticism for a printed-text
  anomaly.
- **Osborn Tech (27147–27152)**: every card's Hero Action correctly models its own cost (discard-highest-cost,
  take-3-indirect-damage, give-a-tough-status-card-plus-a-boost-card, exhaust-plus-discard-random) as a real
  `AbilityCost` rather than an effect, so each action is only offered while payable in full — Neocarbon Scales'
  give-tough-status cost correctly becomes unpayable once Venom Goblin already holds one (his own Toughness keyword
  already gave him one), matching RRG 1.8 "Status Cards" (p. 41)'s one-per-character-per-type reading. Spiked
  Gauntlet's own "after that attack ends, if your identity took no damage, discard this card" correctly reads the
  bound attack's damage _after_ the whole attack (including its own response window) has resolved, not mid-attack —
  the docblock's own reasoning for why `atEndOfAttack` would be the wrong primitive here is independently sound:
  that primitive is for responding to an attack still in progress, and this card's own attack was already fully
  initiated and resolved by the time the next effect in the same ability's list runs.
- **Sinister Assault (27158–27163)**: correctly splits "activates against you" (Doctor Octopus, Electro, Vulture —
  `on.enemyActivates`/`after.enemyActivates` per §4.1 Q67) from "attacks you"/"attacks and damages a character"
  (Hobgoblin, Kraven, Scorpion — `on.enemyAttacks`, following the box's own Q67 survey's "stays an attack" list).
  Electro's "engages you **or** activates against you" correctly listens on three separate event kinds
  (`minionEngaged`, `enemyAttack`, `enemyScheme`) rather than trying to force "engages" through the activation
  primitive, since RRG 1.8 distinguishes "Engage" (p. 18) from "Activation" (p. 6) as genuinely separate events.

## 2. Ability-ref coverage

Every ability id named in a card record's own `abilities` array in this scope is exercised by at least one test in
the matching `*.test.ts` file. Confirmed by running the full scoped suite
(`pnpm exec vitest run packages/cards/src/wave5/sm/{sinister-six,venom-goblin,modulars}`, 17 files / 206 tests, all
passing) rather than re-deriving ref lists by hand — the same approach `-villains.md` took, and equally reliable
here since the suite already asserts printed effects, not just "something changed."

## 3. Gaps and things not independently re-verified in this pass

- Guerrilla Tactics, Osborn Tech, and Sinister Assault's stat-only cards (printed ATK/SCH/HP, keywords with no
  ability text — e.g. each Sinister Assault minion's own Incite/Retaliate/Patrol/Steady/Toughness/Quickstrike line)
  were confirmed as data by their own docblocks and spot-checked on the two scans read in §1.3, not individually
  scan-checked for every one of the eleven minions/attachments in that pair of sets.
- Down to Earth's Loose Ends already documents its own known-approximate edge case (§1.3); not re-litigated here.
- This pass did not re-audit Sandman, Venom, or Mysterio (covered by `-villains.md`/`-scenarios-1.md`) or
  `spdr/sinister-syndicate.*` (another agent's own scope, per the task boundary).
- No `it.fails`/`KNOWN_SKIPPED` was added by this pass — no gap was found in this scope's own scripts that needed
  one; the only gap found (missing expert-mode playthrough tests) was fixable directly and is recorded in
  `docs/phase7-wave5-qa-sm-scenarios-2.md` §2, not pinned as a skip.
