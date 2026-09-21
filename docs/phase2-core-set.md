# Phase 2 working spec — Core Set vertical slice

Shared brief for every agent working Phase 2 (`card-data-pipeline`, `game-rules-architect`, `ability-scripting-engineer`, `rules-qa-engineer`). It turns the PLAN.md Phase 2 bullets into concrete decisions and a card-by-card gap list, so nobody has to re-derive them from scratch. If you change a decision here, update this file in the same change.

Source of the card list below: MarvelCDB public API `https://marvelcdb.com/api/public/cards/core` (205 records incl. linked back faces, fetched 2026-09-10). MarvelCDB is a _pointer_, not an authority (CLAUDE.md): card text should match the physical card / current errata, and rules questions go to the RRG/FAQ.

---

## 0. Package layout decision

Ability scripts need both `@mc/engine` types (`AbilityDefinition`, `EffectSpec`) and `@mc/content` ids. They go in a **new package `@mc/cards`** (`packages/cards`):

```
client → cards → engine → content
```

- `@mc/content` — schema + normalized card _data_ (JSON/TS records). No behavior. Ingestion tooling lives in `packages/content/scripts/`.
- `@mc/engine` — rules engine + effect vocabulary. Knows nothing about specific cards (the `testing/` stubs excepted).
- `@mc/cards` — the ability DSL (builder layer that compiles to `AbilityDefinition`), one module per hero kit / aspect / encounter set, the assembled `AbilityRegistry`, and scenario/deck builders (`coreScenario("rhino", {...}) → GameSetupConfig`). The engine gets the registry through `EngineDeps`, exactly as Phase 1 designed.

## 1. Schema follow-ups (owner: `game-rules-architect`, lands first — ingestion builds against these shapes)

> Status: landed 2026-09-10 (`pnpm typecheck && pnpm test` green). Items 1–10 are implemented as specified below, with these **deviations / additions** (the final shapes are what's in `packages/content/src/schema/**`):
>
> - **Item 1**: `AbilityReference = { id; label?; notesForScripting? }`. `validateCard()` _rejects_ any ref that still has a `trigger` key, and rejects duplicate ids on one card.
> - **Item 3**: `HeroFace.keywords` / `AlterEgoFace.keywords` are required arrays (use `[]`). `validateHeroIdentityCard` rejects a card-level `keywords` field.
> - **Item 4**: `AttachmentHost` lives in `schema/cards/attachment-host.ts` (exported with `AttachmentHostKind` and `ATTACHMENT_HOST_KINDS`); `AttachmentTarget` is removed. Semantics: `hero` = a hero-form identity; `anyCharacter` = _any_ character in play (identities, allies, minions, villain); `namedCard` matches the exact printed `name`; `minionWithHighestPrintedHp` ties are chosen by the revealing player.
> - **Item 5**: the type is named `PrintedStatModifiers` (`{ atk?, sch?, thw?, hp? }`, non-stat keys rejected).
> - **Item 6**: the restrictions type is exported as `PlayRestrictions`. `deckLimit` is required on _every_ player card, resources included (positive integer).
> - **Item 7**: the A side type is `MainSchemeASide { text: CardText; abilities: AbilityReference[] }` (A-side text must be non-empty). "Advance to stage NB" needs no ability — the engine always continues onto the B side. Engine order: at setup, 1A `setup` abilities → 1B `whenRevealed` abilities (e.g. Underground Distribution / Crimson Cowl 1B) → villain setup. On advance: NA `whenRevealed` → NB `whenRevealed` → B-side starting threat.
> - **Item 9**: stage ranges are typed `VillainStageRange = readonly [first, last]` (printed numerals, e.g. `[1, 2]`). `expertEncounterSetIds` are added _in addition to_ `standardEncounterSetIds` (Core expert = standard + expert). New `validateScenario()`.
> - **Item 10 (changed)**: `StarterDeck { id: StarterDeckId; name; packCode: SetCode; identityCardId; aspects: CoreAspect[]; cards: { cardId; quantity }[]; provenance: { verified: boolean; sources: string[]; note? } }`. `aspects` is a list (later precons have 2+ aspects); `provenance` is where "couldn't verify this list" goes — `verified: true` requires at least one source. New `StarterDeckId` brand + `starterDeckId()` helper, and `validateStarterDeck()`.
> - Also new: `validateAttachmentCard()`, `validateAttachmentHost()`; event/support/resource/player-side-scheme cards now get full player-card checks in `validateCard()`.
>
> **Schema change 2026-09-10 (after ingestion finished; emitter updated and Core data re-emitted with `ingest --offline`):**
>
> - `PrintedStat = number | "X" | null` (in `common.ts`) for `AllyCard.atk/thw` and `MinionCard.atk/sch`. `null` is a printed "—": the character cannot use that power at all. The engine refuses basic _and_ ability attacks/thwarts by a character with a "—" stat, and an enemy with a "—" ATK/SCH skips that activation. `"X"` is defined by the card's own ability, with a base of 0 before modifiers. Core: Hulk THW `null`, Titania ATK `"X"`. The emitter maps an absent ally stat to `null` and MarvelCDB `-1` to `"X"`.
> - `MainSchemeStage.name?: string`: the stage's own title when it differs from the card's name (Secret Rendezvous, Assault on NORAD, Countdown to Oblivion).
> - Blank text (`{ printed: "", current: "" }`) is now valid on **resource cards, villain stages, and side schemes** only (Energy Absorption, Vibranium, Rhino I, Usurp the Throne). Every other card type still requires non-empty text.
> - Obligations keep `encounterSetIds: []` and reach the encounter deck only through `HeroIdentityCard.obligationCardId` (§3.7 setup uses that field).

1. **`AbilityReference.trigger` is dropped.** The engine registry is authoritative for timing. New shape:
   `{ id: AbilityId; label?: string /* printed ability name, e.g. "Spider-Sense" */; notesForScripting?: string }`.
   Remove `AbilityTrigger` from `@mc/content`; update `packages/engine/src/testing/abilities.ts` accordingly.
2. **`scaling(base, perPlayer)`** helper beside `flat` / `perPlayerOnly` in `common.ts`.
3. **Keywords move to faces.** `HeroFace` and `AlterEgoFace` each get `keywords: KeywordInstance[]`; `HeroIdentityCard.keywords` is removed. (Black Panther's Retaliate 1 is hero-face only.) Engine `keywordsOf` picks the face from `IdentityState.form`.
4. **Attachment host rules become structured**, shared by encounter attachments and player upgrades:
   ```ts
   type AttachmentHost =
     | { kind: "villain" }
     | { kind: "mainScheme" }
     | { kind: "sideScheme" }
     | { kind: "hero" }
     | { kind: "ally" }
     | { kind: "minion" }
     | { kind: "enemy" }
     | { kind: "anyCharacter" }
     | { kind: "namedCard"; name: string } // "Attach to the Ultron Drones environment"
     | { kind: "minionWithHighestPrintedHp"; withoutAttachmentNamed?: string }; // Genetically Enhanced, Biomechanical Upgrades
   ```
   `AttachmentCard.attachesTo: AttachmentHost`. `UpgradeCard.attachesTo?: AttachmentHost` (absent = your own identity). "Attach to Rhino/Klaw/Ultron" is `{ kind: "villain" }`.
5. **Printed stat modifiers on attachments**: `AttachmentCard.statModifiers?: { atk?: number; sch?: number; thw?: number; hp?: number }` (Charge +3 ATK, Enhanced Ivory Horn +1 ATK, Sonic Converter +1 ATK, Program Transmitter +1 SCH). The engine applies these as constant modifiers to the host.
6. **Play/deck restrictions as data** on `PlayerCardCommon`:
   `deckLimit: number` (MarvelCDB `deck_limit`; "Max 1 per deck" / "Max 2 per deck") and
   `playRestrictions?: { maxPerPlayer?: number; maxPerHost?: number; form?: "hero" | "alterEgo"; anyPlayerControl?: boolean }` ("Max 1 per player", "Max 1 per enemy/ally", "Hero form only", "Play under any player's control").
7. **Main scheme stages carry their A side.** Each `MainSchemeStage` gets `aSide: { text: CardText; abilities: AbilityReference[] }` — the 1A setup text / 2A "When Revealed" text. The existing stage fields describe the B side (threat values). Engine resolves stage-1 A-side `setup` abilities at setup and later stages' A-side `whenRevealed` abilities on advance.
8. **Identity ↔ obligation/nemesis links**: `HeroIdentityCard.obligationCardId: CardId` and `HeroIdentityCard.nemesisEncounterSetId: EncounterSetId`.
9. **Scenario difficulty sets**: `Scenario.standardEncounterSetIds` (Core: `standard`) and `Scenario.expertEncounterSetIds` (Core: `expert`), plus `villainStages: { standard: [stageNumber, stageNumber]; expert: [...] }` (Core: I–II / II–III).
10. **Starter decks**: `StarterDeck { id; name; identityCardId; aspect; cards: { cardId; quantity }[] }` records, one per Core hero precon. Ingestion verifies the lists against a published source (Core Set rulebook / FFG product page / Hall of Heroes Core Set page); if a list can't be verified, say so in the data rather than guessing.
11. **Typed costs on encounter-card abilities** ("Hero Action: Spend [E][M][P] → discard this card") are _engine_ `AbilityCost` data, not content fields — resolves the "Minion/Attachment has no ResourceIconCounts" follow-up without a content change.

## 2. Ingestion (owner: `card-data-pipeline`)

- `packages/content/scripts/ingest-marvelcdb.ts` (run with `node --experimental-strip-types` or `tsx`; no new heavy deps). Fetches a pack's JSON, **caches the raw response** in `packages/content/raw/marvelcdb/<pack>.json` with art fields (`imagesrc`, `backimagesrc`, `meta`, `octgn_id`, `url`) stripped before writing, and emits normalized records to `packages/content/src/data/<cycle>/<pack>/…`.
- Normalization must handle: HTML → plain text with `[energy]/[mental]/[physical]/[wild]/[per_hero]/[star]` tokens; `text` vs `real_text` vs `errata` → `CardText { printed, current }`; `*_per_hero`/`*_fixed` flags → `ScalingValue`; linked A/B faces (hero/alter-ego, main scheme 1A/1B); villain stage cards (3 records → one `VillainCard` with I/II/III stages); keyword extraction (Guard, Toughness, Surge, Retaliate X, Quickstrike, Uses (X type), Setup, Overkill…) into `KeywordInstance` from the text _and_ stripped from ability text only if the keyword line is reminder text; boost icon counts and boost-star; scheme icons (`scheme_crisis/acceleration/hazard`); `quantity`; `deck_limit`; card variants that are distinct physical cards (Wakanda Forever! a/b/c/d, Android Efficiency a/b/c) as separate `CardId`s.
- Every printed ability gets an `AbilityReference` with a **stable, human-readable id**: `<cardCode>.<slug>` e.g. `01001a.spider-sense`, `01099.boost`, `01097a.setup`. The scripting stage keys off these; do not renumber them later.
- Also emit `EncounterSet`, `Scenario` (Rhino / Klaw / Ultron), `Pack`, `Cycle`, and `StarterDeck` records.
- Tests: every record passes `validateCard()`; per-set counts match MarvelCDB; spot-check fixtures for a sample of cards across every card type (Spider-Man identity, Rhino villain, The Break-In! stages, Charge, Web-Shooter uses, Hawkeye counters, Wakanda Forever! variants, Titania's X ATK, Ultron Drones environment).

## 3. Engine primitive gaps for the Core Set (owner: `game-rules-architect`)

The Phase 1 `EffectSpec` vocabulary can't express most Core Set cards yet. Grouped by mechanism, each with the cards that force it. **Build the mechanism, not the card** — no card names in engine code.

### ✅ 3.1 Typed resources and payment

> Landed: `packages/engine/src/resources.ts` (`ResourcePool`, `ResourceRequirement`, `satisfies`, `paidWith`), pricing/cost planning in `actions.ts` (`planCost`/`payCost`/`pricePlay`), cost reductions as lasting effects (`lasting.ts`, `effects.ts`), tests in `resources.test.ts`. Vocabulary: `AbilityCost.resources` (number = generic, or `{ physical?, mental?, energy?, generic? }`), `resourcesX`, `discardFromHand { min, max, bind }`, `payPrintedCostOf { slot, from }`, `discardSelf` (snapshots counters to vars `self.counters.<type>`), `exhaustIdentity`, `healIdentity`, `damageSelf` (identity), `damageThisCard`; `AbilityDefinition.generates` (number = wild, typed pool, or `{ kind: "topCardOfDiscard" }`); `{ kind: "resource", form? }`; constant `resourceMultiplier { factor, whilePayingFor }`; `Predicate` `paidWith` / `varAtLeast`; `ValueSpec` `var` (`paid.<type>`, `paid.total`, cost binds); `EffectSpec` `reduceNextCardCost`; commands take `costChoices` (keyed by cost slot, `discard` for hand discards). Optional in-play interrupts/responses now pay their costs (a `payForAbility` choice when resources are involved; skipped when the cost can't be paid). Rulings applied: wild counts for "paid using [X]" (FFG ruling Jan 2026); RRG "Cost": "up to N" needs at least one, so Legal Practice is `{ min: 1, max: 5 }`; Power of X doubling keys off the card whose cost is being paid (the ally for Make the Call, per FFG ruling); Pepper Potts reads the discard top as it stands mid-payment.

- `Payment` / pricing currently counts resources as a number. Needs resource **types** (physical/mental/energy/wild; wild substitutes for any type). Resource cards: printed icons. Resource abilities: `generates` becomes typed.
- `AbilityCost.resources` becomes typed: "Spend a [energy] resource" (Captain Marvel Rechannel, Vision, Superhuman Law Division, Rocket Boots, Tenacity, Black Widow), "Spend [E][M][P]" (Sonic Converter, Solid-Sound Body, Upgraded Drones), "Spend [P][P][P]" (Enhanced Ivory Horn), "Spend [M][M]" / "[P][P]" / "[E][E]" (Program Transmitter, Vibranium Armor, Concussion Blasters), variable "Spend X [energy]" → X is bound for effects (Energy Channel).
- Predicate "you paid for this card using a [X] resource" (Photonic Blast, Relentless Assault, For Justice!). Check the RRG "Resources" entry for whether a wild resource counts — it counts as one type of the payer's choice.
- Conditional generation: "Double the resources this card generates while paying for an [aspect] card" (The Power of Aggression/Justice/Leadership/Protection).
- "Generate the resources of the top card in your discard pile" (Pepper Potts).
- Cost reduction as a lasting effect: "Reduce the resource cost of the next card that player plays this phase by 1" (Helicarrier).
- Non-resource cost components: discard N cards from hand as a cost (Alpha Flight Station; "up to 5", binding the count, for Legal Practice), take damage (Focused Rage, War Machine — `damageSelf` exists), heal self as cost (Rechannel), discard this card (Cosmic Flight, Tenacity, Indomitable, Energy Channel, Webbed Up), exhaust your hero (Program Transmitter, Vibranium Armor, Concussion Blasters), exhaust a specific other card (obligations: exhaust your alter-ego).
- "Pay the printed cost of an ally in any player's discard pile" (Make the Call).

### ✅ 3.2 Lasting effects and delayed effects

> Landed: `lasting.ts` (state shapes), `modifiers.ts` / `select.ts` (read path), `resolve.ts` + `flow.ts` (creation/expiry), tests in `lasting.test.ts`. Vocabulary: `EffectSpec` `modifyStatUntil { stat, amount: ValueSpec, target? | affects?, until: "endOfPhase" | "endOfRound" | "endOfAttack" }` (`target` is fixed at creation, `affects` is a live query that also catches cards entering later, per RRG "Lasting Effects"; `amount` is re-evaluated on every read), `grantTraitUntil { trait, target? | affects?, until }`, `atEndOfRound { effects }` (a delayed effect that fires after "until the end of the round" effects expire; Nick Fury). `atEndOfAttack` (§3.5) covers "at the end of this attack". Lasting effects are plain data in `GameState.lastingEffects` (kinds `costReduction`, `statModifier`, `traitGrant`, `delayedEffects`) and are logged as `lastingEffectAdded` / `lastingEffectEnded`.

- "Until the end of the phase": stat changes (Vision +2 chosen stat, Lead from the Front +1 THW/+1 ATK to each character a player controls), trait grant (Rocket Boots: gain Aerial). Must be state data with an expiry, feeding the modifier layer (`modifiers.ts` currently only reads printed constant abilities).
- "Until the end of his attack" (Ultron II +1 ATK per Drone).
- "At the end of the round, if X is still in play, discard it" (Nick Fury).
- "At the end of this attack, discard Charge".

### ✅ 3.3 Constant abilities beyond fixed stat bumps

> Landed: `modifiers.ts`, `keywords.ts`, `rules.ts`, `select.ts`, tests in `lasting.test.ts`. Vocabulary: constant trigger `{ kind: "constant", modifiers?, keywordGrants?, traitGrants?, rules?, resourceMultiplier? }`; `StatModifierSpec.amount: number | ValueSpec` with new `ValueSpec` `count { query }`, `remainingHp { of }` (reads max HP only, so Titania's ATK can't recurse), `conditional { if, then, else }` plus `scaled` for caps (Iron Man: `scaled(count Tech upgrades, max 6)` over a printed 1); `KeywordGrantSpec` / `TraitGrantSpec { keyword|trait, target, while? }` (Solid-Sound Body, Concussion Blasters, Cosmic Flight); `RuleSpec` `cannotTakeDamage { target, while?, fromSource? }` (Ultron III, Madame Hydra, Killmonger; damage events now carry `viaInstanceId` = the card whose ability dealt it), `threatCannotBeRemoved { target }` (Countdown to Oblivion), `allyLimit { amount }` (The Triskelion), `mustDefendWithAlly { attacker }` (Melter); `Predicate` `hasTrait { of, trait }` (sees granted traits). "Controller-relative" is `controller: "you"` on the target query, evaluated from the granting card's controller. The Immortal Klaw's "+10 hit points" is a constant modifier on the side scheme, so the HP disappear when it leaves play. **The ally limit (RRG "Ally Limit", discard down to 3 + modifiers before enters-play abilities) was never implemented in Phase 1; it lands here** (`discardOverAllyLimit` choice).

- Stat modifier amount as a `ValueSpec`, not a number: Iron Man (+1 hand size per Tech upgrade, max 7), Jessica Jones (+1 THW per side scheme), Titania (ATK = remaining HP), Ultron III (+1 ATK/+1 HP to each Drone).
- Keyword / trait grants: Solid-Sound Body and Concussion Blasters (host/villain gains Retaliate 1), Cosmic Flight (gains Aerial), Combat Training/Heroic Intuition/Armored Vest ("your hero gets +1 ATK/THW/DEF" — controller-relative), Inspired (attached ally +1/+1), Mark V Armor / Rocket Boots (+HP to your identity), Captain Marvel's Helmet (+1, or +2 with Aerial), The "Immortal" Klaw (villain +10 HP while the side scheme is in play; HP lost when it leaves).
- Rule restrictions: "cannot take damage" with a condition or source filter (Ultron III while a Drone is in play, Madame Hydra while Legions of Hydra is in play, Killmonger from Black Panther upgrades), "threat cannot be removed from this scheme" (Countdown to Oblivion), ally limit +1 (The Triskelion), Crisis icon (exists?), Melter ("must defend with an ally if able").

### ✅ 3.4 Replacement, prevention, and cancellation (interrupt-window effects that change the pending event)

> Landed: `resolve.ts` (prevention/replacement/cancel effects, interruptible defeats, reveal cancellation), tests in `replacement.test.ts`. Vocabulary: `EffectSpec` `preventDamage { amount? }` (absent = all) and `preventThreat { amount? }` for interrupts to `dealDamage` / `placeThreat`; `replaceTriggeringEvent { with }` (RRG "Replacement Effect": the event doesn't happen, `with` runs with the original event as context, and the window stops offering interrupts to it); `cancelWhenRevealed` (cancels only the card's When Revealed effects, incite and surge included, per RRG "Surge" and the Aug 2026 FFG ruling) and `cancelRevealedCard` (Black Widow: the card is still revealed and discarded, nothing else happens), both interrupts to the new trigger event `encounterCardRevealing { instanceId, playerId }`, which fires after the flip and before any effects; `placeDamage { target, amount }` (damage tokens that aren't dealt); `bindTargets { slot, target }` (remember "that enemy" before this card leaves play); `modifyAttack.threatBonus` (Emergency). **`characterDefeated` is now an interruptible event**: the ally/minion leaves play (attachments included) when it applies, so "when attached minion would be defeated … instead" and "when attached minion is defeated" both work; overkill excess and "defeated" results are dealt/reported only if the defeat happens. New `TargetCategory` values: `treachery`, `obligation`, `environment`. Cancel an enemy attack and do something else (Webbed Up) is `cancelTriggeringEvent` + effects, with `sourceIs: { hostOfSelf: true }`.

- Prevent all / N of pending damage (Backflip, Cosmic Flight), prevent N of pending threat (Jennifer Walters), reduce threat from a scheme activation (Emergency).
- Redirect: "take it as damage instead" (Great Responsibility), "place it here instead" (Armored Rhino Suit: damage to the villain becomes counters on the attachment, then conditional discard).
- Replace defeat: "heal all damage from it instead, then discard this card" (Biomechanical Upgrades).
- Cancel an enemy attack and do something else (Webbed Up: discard itself instead, then stun).
- Cancel **only** a treachery's When Revealed effects (Enhanced Spider-Sense, Get Behind Me! + "the villain attacks you instead") vs cancel **all** of a revealed encounter card's effects and discard it, then reveal another (Black Widow).
- `cancelTriggeringEvent` exists; add `modifyTriggeringEventAmount` / redirect / replace equivalents on the event frame.

### ✅ 3.5 Player attacks/thwarts from card abilities

> Landed: `resolve.ts` (attack/thwart events with amounts, result reporting, labels, `modifyAttack`, `atEndOfAttack`, one-at-a-time boost flips, `defended` announcements), tests in `attacks.test.ts`. Vocabulary: `AbilityDefinition.label: ("attack"|"thwart"|"defense")[]` (RRG "Labeled Ability": a stunned/confused identity cancels the whole ability except costs; a defense label makes the identity the defender with no DEF reduction); `EffectSpec` `attack { target, amount, attacker?, overkill?, moveDamageFrom?, bind? }`, `thwart { target, amount, thwarter?, bind? }`, `modifyAttack { overkill?, extraBoostCards?, atkBonus? }`, `atEndOfAttack { effects }`; `bind` on `dealDamage`/`heal`/`placeThreat`/`removeThreat` reports `<bind>.amount` / `<bind>.made` (attacks also `.damage`, `.defeated`, `.undefended`; thwarts `.threatRemoved`); `EventPattern.sourceIs`, `requireResults` (`{ damage: 1 }` = "attacks and damages", `{ defeated: 1 }` = "attacks and defeats", `{ undefended: 1 }`), `attackKind: "basic" | "ability"`; new trigger event `defended { defenderInstanceId, enemyInstanceId, playerId, basic }` ("after your hero defends"); `ValueSpec` `eventResult`, `scaled { value, times?, plus?, max? }`; `Predicate` `eventResultAtLeast`, `currentAttack { key, atLeast }` ("if the villain is making an undefended attack"); `TargetRef` `host`, `TargetQuery.hostOfSelf` ("attached minion/enemy"). `ValueSpec` `stat` now reads the _modified_ stat. Crisis now blocks any player-side removal of main-scheme threat, not just basic thwarts.

- `(attack)` / `(thwart)` / `(defense)` labels: an event or ability with the label is an attack/thwart by your hero (or the ally using it). Needs an effect that resolves as an **attack event** (fires `attack`/`characterAttacked`, respects Guard, stunned cancels it, Retaliate triggers, "after your hero attacks and defeats an enemy" fires, overkill when granted) rather than raw `dealDamage`. Same for thwart (confused cancels it, Crisis applies, Daredevil "after Daredevil thwarts" fires). Check the RRG entries on ability labels for exactly what a labeled ability counts as.
- Grant overkill to a specific attack (Relentless Assault if paid with physical; Charge on Rhino's attack — overkill spill to the defending ally's controller).
- Attack results bound for follow-up: "if this attack deals damage…" (Klaw's Vengeance, Stampede "if a character is damaged by this attack, stun it", Rage of Ultron "for each damage dealt by this attack", Sonic Boom boost "if this activation deals damage to you", Sweeping Swoop boost, Electric Whip Attack boost "undefended attack", Kree Manipulator boost "undefended attack").
- "Deal damage equal to your hero's ATK" (Counter-Punch) — `ValueSpec.stat` exists; confirm it reads the _modified_ ATK.
- "Move N damage from your hero to an enemy" (Vibranium Suit).

### ✅ 3.6 Enemy actions as effects

> Landed: `resolve.ts`, tests in `enemy-actions.test.ts`. Vocabulary: `EffectSpec` `enemyAttack { enemies: TargetRef, against?: PlayerRef, bind?, additionalResolution? }` ("Rhino attacks you", Gang-Up, "each Masters of Evil minion attacks the hero it is engaged with" (no `against` = the engaged player), Swarm Attack, "Titania attacks your hero") and `enemyScheme { enemies, against?, bind? }` ("The villain schemes", Rage of Ultron). Both run the full Phase 1 activation procedures (boost cards, defense, …). A stunned/confused enemy discards the status instead and doesn't attack/scheme (RRG "Stun"/"Confuse"), and a "—" stat skips. `bind` gives `<bind>.made` ("if no attack was made this way"), `.damage`, `.undefended`, `.threatPlaced`, plus slots `<bind>.damaged` / `<bind>.target` ("if a character is damaged by this attack, that character is stunned"). `gainSurge` ("this card gains surge"). `PlayerRef` `others { of }` ("each other hero"). Whirlwind is `atEndOfAttack` + `enemyAttack { enemies: self, against: others(controller), additionalResolution: true }`. Extra boost cards (Klaw, Titania's Fury boost) are `modifyAttack.extraBoostCards` (§3.5). "Rhino heals N; if no damage was healed this way, this card gains surge" is `heal { bind }` + `if` + `gainSurge`. **"You" on encounter/scenario cards**: their abilities now resolve for the revealing / attacked / engaged player (first player for scheme- and villain-level abilities), so `controller` / `engagedWith: "you"` work in encounter scripts. Triggered encounter abilities with `playerIs: "controller"` match the event's player.

- "Rhino/Klaw/Ultron/the villain attacks you", "The villain schemes", "Titania attacks your hero", "Each Masters of Evil minion attacks the hero it is engaged with", "The villain and each minion engaged with you attacks you" (Gang-Up), "Each Drone minion engaged with your hero attacks" — reusing the Phase 1 `enemyAttack`/`enemyScheme` frames, with "if no attack was made this way" results.
- Klaw: "give him 1 additional boost card for this activation"; Titania's Fury boost "give the villain 1 additional boost card".
- Whirlwind: "also resolve his attack against each other hero".
- "Rhino heals N; if no damage was healed this way, this card gains surge".

### ✅ 3.7 Encounter deck and scenario flow

> Landed: `setup.ts`, `resolve.ts`, `effects.ts`, tests in `scenario-flow.test.ts`.
>
> - **Setup completeness.** Each identity's obligation (`obligationCardId`) is shuffled into the encounter deck. Each nemesis set (`nemesisEncounterSetId`, `quantityInSet` copies) is set aside in the new per-player `setAside` zone. Missing cards are skipped unless `GameSetupConfig.requireIdentitySets` is set; `includeIdentitySets: false` turns it off. `GameSetupConfig.villainLastStageIndex` gives standard I–II / expert II–III (defeating that stage wins). The starting villain stage's Toughness and When Revealed apply at setup (RRG Appendix II "Resolve Scenario Setup and When Revealed Abilities": expert Rhino II reveals Breakin' & Takin'). Identity `Setup:` abilities are covered in §3.9.
> - **Stage advance.** A new villain stage is revealed (RRG "Villain Defeat"): its Toughness and When Revealed apply, and statuses/attachments carry over (same title in Core). A main scheme advance resolves NA then NB When Revealed (§1).
> - **Obligations.** An obligation is given to its hero's player, who is then the revealing player (RRG "Reveal"/"Obligation"). If that hero isn't in the game, it is removed from the game and another card is revealed. "Exhaust your alter-ego → remove from the game" vs the alternative is a `chooseOne` with conditions. Obligations use `moveCards { to: "removedFromGame" | "discard" }` on `self`.
> - **Vocabulary.** `CardSelector` `{ kind: "encounter", zones: ["deck","discard"], filter?, top? }`, `{ kind: "setAside", player, filter? }`, `{ kind: "tucked", under }`, and zone `random` ("1 card at random"). `CardDestination` `encounterDeckShuffle`. `EffectSpec`: `selectCards { slot, cards }`, `revealCard { cards, player }` (the full reveal procedure from any zone), `putIntoPlay` (encounter cards now enter where their type goes), `shuffleEncounterDeck`, `discardEncounterUntil { filter, bind }`, `tuckCards { cards, under, facedown? }`, `assignDamage { amount, among, chooser }`, `gainSurge` (§3.6). `ValueSpec` `resourceTypes { cards }`. `Predicate` `and` / `or`.
> - **Card patterns covered.** Rhino II/Klaw II/Ultron III, Legions of Hydra, The Doomsday Chair, Masters of Mayhem, Underground Distribution, Secret Rendezvous, The Masters of Evil, Masterplan, Shadow of the Past, Highway Robbery, Explosion, The Vulture's Plans.
> - **Side scheme defeat.** A defeated side scheme now resolves its When Defeated _before_ leaving play. Leaving play discards tucked cards (RRG "Tuck"), and this order lets Highway Robbery return them first.
> - **Scheme icons.** Hazard / Acceleration / Crisis were confirmed from Phase 1 (`countSchemeIcons`, deal step, place-threat step). Crisis now covers every player-side removal (§3.5).

- **Setup completeness** (currently deferred in `setup.ts`): shuffle each hero's obligation into the encounter deck; set aside each nemesis encounter set (new zone, e.g. `setAside`); standard vs expert sets; main scheme 1A `Setup:` abilities (Break-In: advance to 1B; Underground Distribution: search for Defense Network and reveal it; Crimson Cowl: put Ultron Drones into play); T'Challa's hero-kit `Setup:` ability.
- "This card gains surge" as an effect; surge already exists as a keyword.
- Search the encounter deck **and discard pile** for a named card and reveal it / put it into play engaged with you, then shuffle (Rhino II, Klaw II, Ultron III, Legions of Hydra, The Doomsday Chair, Masters of Mayhem).
- Discard from the encounter deck until a card matching a filter is discarded; put it into play engaged with the first player / reveal it (Underground Distribution, Secret Rendezvous, The Masters of Evil, Masterplan).
- Shadow of the Past: reveal your set-aside nemesis minion and side scheme, shuffle the rest of the nemesis set into the encounter deck, surge if no minion entered.
- Obligations: dealt/revealed like treachery; offer "exhaust your alter-ego → remove from game" vs the alternative, with "you may flip to alter-ego form" first (check the current Core errata text for obligations).
- Villain stage advance resolves the new stage's `When Revealed` (Rhino II/III, Klaw II, Ultron III) and gives it its stage keywords (Toughness on III).
- Main scheme advance resolves the next stage's A-side `When Revealed`.
- Hazard / Acceleration / Crisis icons (Breakin' & Takin', Bomb Scare, Crowd Control) — confirm the Phase 1 handling covers them.
- Highway Robbery: cards placed facedown _under_ a scheme and returned on `When Defeated` (side schemes need `whenDefeated`).
- "Assign X damage among heroes and allies" (Explosion) — a distribution choice.
- "Discard 1 card at random from each player's hand; count distinct resource types discarded" (The Vulture's Plans).

### ✅ 3.8 Drones (Ultron)

> Landed: `state.ts` (`CardInstance.facedownAs: FacedownRole | null`), `query.ts` (`isMinion`), `select.ts` / `keywords.ts` / `modifiers.ts`, `resolve.ts`, tests in `drones.test.ts`. General mechanism, not Ultron-specific:
>
> - `EffectSpec` `putIntoPlayFacedown { player, count?, as: { kind: "minion", traits } }` puts the top card of each player's deck into play facedown. An empty deck resets first (FFG ruling).
> - A facedown card in play is a minion engaged with that player. It has only the given traits, no name, no keywords, no active abilities, and printed base stats of 0.
> - It leaves play to its **owner's** zones and turns faceup again. The Ultron Drones "place it in its owner's discard" response is therefore already the engine's behavior.
> - Base stats come from `StatModifierSpec.setBase: true` ("has a base SCH/ATK/HP of 1") with `TargetQuery.facedown: true`. Upgraded Drones and Ultron III are ordinary additive modifiers (`{ categories: ["minion"], trait: DRONE }` also matches printed Drone minions such as Advanced Ultron Drone).
> - Activation, guard, attacks, "each minion engaged with you" and overkill all treat facedown minions as minions (`isMinion`).

- Put the top card of a player's deck into play **facedown as a Drone minion** engaged with that player. Its stats come from the Ultron Drones environment (base ATK 1 / SCH 1 / HP 1), modified by Upgraded Drones and Ultron III. When defeated it goes to its **owner's discard pile** (not the encounter discard). Drones are minions for every other purpose (Guard doesn't apply — they don't have it; they count for "each enemy", "each minion engaged with you", etc.).

### ✅ 3.9 Player-card mechanics

> Landed: `resolve.ts` (card selection/movement, choices, sequences), `actions.ts` (play restrictions, hosts, "any player's control"), `setup.ts` (identity Setup abilities), tests in `player-cards.test.ts`. Vocabulary:
>
> - Cards outside play: `CardSelector` = `{ kind: "ref", ref, filter? }` or `{ kind: "zone", zone: "hand" | "deck" | "discard", player, filter?, top?: ValueSpec, topmostOnly? }`. `EffectSpec` `moveCards { cards, to: "hand" | "discard" | "deckTop" | "deckBottom" | "deckShuffle" | "removedFromGame", bind? }`. `bind` records slot `<bind>`, var `<bind>.count` and printed icon counts `<bind>.physical|mental|energy|wild`, which covers Black Cat, Repulsor Blast, Electromagnetic Backlash, and Hulk. Cards in play that move leave play cleanly (Hellcat). Also `chooseCards { slot, from, chooser, min, max, distinctNames? }` (Tony Stark, Shuri, Ancestral Knowledge) and `shuffleDeck { player }` (RRG "Search"). New `TargetQuery` filters: `printedResource`, `owner: "you"`.
> - Form: `changeForm { player, to? }` doesn't use the round's voluntary flip (RRG "Form, Change Form"). New trigger event `formChanged { playerId, to }` fires for both the command and the effect; "after you change to this form" is a `formChanged` response with `form: "hero"`. `drawUpTo { player, amount }`, with `ValueSpec` `handSize { player, printed? }` / `handCount`.
> - Choices: `chooseOne { chooser, options: { label, condition?, effects }[] }` (only options whose condition holds are offered, and a single remaining option resolves without asking), `choosePlayer { slot, chooser }` + `PlayerRef` `slot`, `forEachPlayer { players, effects }` + `PlayerRef` `scoped`, `PlayerRef` `ownerOf`.
> - Targets and values: `TargetRef` `each { query }` ("each enemy", "each friendly character") and `named { name }`; `ValueSpec` `damage`, `threat`, `boostIcons` (combine with `scaled`).
> - Wakanda Forever!: trigger `{ kind: "special" }` (never usable directly) and `resolveSpecials { cards }`. The controller orders the steps, and each step gets vars `sequence.step` / `sequence.final`.
> - Identity `Setup:` abilities (T'Challa) resolve at game setup after the villain's.
> - `PlayRestrictions` is enforced when a card is played: `form`, `maxPerPlayer` (same title under that controller), `maxPerHost`, and `anyPlayerControl` (the `playCard` command's new `controllerId`). Upgrade hosts come from `attachesTo`; without one, an upgrade attaches to the controller's identity.
> - Played events now sit in a per-player `resolving` zone (out of play) until discarded (RRG "Event").
> - "Enters play with N counters" (Hawkeye) is scripted as a forced response to its own `cardEntersPlay` → `addCounters`. A dedicated "enters play with" primitive wasn't needed.

- Deck manipulation: discard the top N cards of your deck and inspect their **printed resources** (Black Cat, Repulsor Blast, Hulk, Electromagnetic Backlash); look at the top 3, add 1 to hand, discard the rest (Tony Stark); search your deck for a card matching a filter, add to hand, shuffle (Shuri, T'Challa setup); return the topmost Tech upgrade from a discard pile to hand (Stark Tower); choose up to 3 different cards in your discard and shuffle them into your deck (Ancestral Knowledge); return this ally to hand (Hellcat); put an ally from a discard pile into play under your control (Make the Call).
- Form: "change your form" as an effect (Split Personality; does it count toward the once-per-round limit? check the RRG), "after you change to this form" trigger (She-Hulk), "draw up to your printed hand size".
- Choose one of N options (Nick Fury, Vision, obligations, Hydra Bomber, Under Attack, Sonic Boom, Ritual Combat, Electric Whip Attack, Android Efficiency boost) — offer only options that can change game state.
- "Choose a player" (Carol Danvers, Avengers Mansion, Helicarrier, Stark Tower, Lead from the Front, Energy Daggers).
- Variable X from game state: damage sustained (Gamma Slam, max 15), cards discarded (Legal Practice), counters × 2 capped at 10 (Energy Channel), threat on a named scheme (Explosion), count of Hydra enemies / Drones (Legions of Hydra, Drone Factory, Repair Sequence), boost icons on a discarded card + 1 (Ritual Combat).
- "Enters play with N counters" without the Uses keyword (Hawkeye's arrows).
- Player upgrades attached to enemies (Spider-Tracer on a minion, Webbed Up on an enemy) and to allies (Inspired), with `maxPerHost`.
- "Deal 1 damage to each character" including friendly ones (Hulk energy result).
- Wakanda Forever!: resolve the `Special` ability on each Black Panther upgrade you control in any order, each as a step in a sequence, with a "final step of this sequence" flag the special abilities read. `Special` is a trigger kind that only the event can invoke.
- Once-per-round limits on identity abilities (existing `AbilityLimit`), "Limit once per round".

### 3.10 Already covered by Phase 1 (verify, don't rebuild)

Guard, Toughness, Surge (keyword), Retaliate, Quickstrike, Overkill (keyword), Uses X, Setup keyword, Peril (none in Core), Restricted (none in Core), statuses, deck-out reshuffle + encounter card (`effects.ts`), ally limit 3, consequential damage, boost card dealing/flipping.

### ✅ 3.11 Added during scripting (small, general; tests in `packages/engine/src/scripting-primitives.test.ts`)

- `TargetQuery.excludeSlots` — "remove 2 threat from a _different_ scheme" (Crisis Interdiction).
- `TargetQuery.controlledBy: PlayerRef` / `TargetQuery.engagedWithPlayer: PlayerRef` — "each character _that player_ controls" (Lead from the Front, which keeps working inside the lasting effect because lasting scopes keep bindings), "each enemy engaged with _that player_" (Energy Daggers).
- `PlayerRef { kind: "engagedWith", of }` — "the engaged player" on a minion's own triggered ability (Advanced Ultron Drone; `actingPlayerOf` has no player for `characterDefeated`).
- `Predicate { kind: "refMatches", ref, query }` — the ref names an in-play card matching the query: "if this activation deals damage _to you_" (Sonic Boom boost) and the in-play guard for "stun that character" after it may have been defeated (Stampede, Sonic Converter, Superhuman Strength, Sweeping Swoop). `giveStatus` itself has no in-play check.
- `Predicate { kind: "gameStep", phase, step? }` — "during step one of the villain phase" (Assault on NORAD). To make it truthful, `flow.ts` now keeps the `placeThreat` step current (`placed: true`) until step one's threat and its interrupts/responses have resolved; previously the step marker had already advanced to `enemyActivations` while they resolved.
- `EventPattern.on` accepts a list of kinds — "after Madame Hydra schemes or attacks".
- `characterDefeated.defeatedByPlayerId` (set from the controller of the defeating damage's source, and the event's player subject) — "after _you_ defeat a minion" (Interrogation Room), including non-attack damage.
- `EffectSpec { kind: "spendResources", player, resources, bind }` + `ChoicePrompt { kind: "spendResources", requirement }` — "either spend [E][M][P] resources or …" (Sonic Boom, Android Efficiency boosts). Paying ≥ the requirement spends it and sets `<bind>.made`; paying nothing/too little declines.

## 4. Ability DSL (owner: `ability-scripting-engineer`, after §1 and most of §3 land)

> Status: landed. `packages/cards` (`@mc/cards`): the DSL in `src/dsl/` (values/refs/predicates, effects, ability/cost/pattern/constant builders, `defineAbilities` + `validateDefinition`), one module per hero kit / aspect / scenario / modular set in `src/core/`, `CORE_ABILITIES` / `CORE_DEPS`, and `coreScenario()` / `starterDeckSetup()`. All 233 Core ability refs are registered (`src/core/coverage.test.ts`, `PENDING` empty). Per-card tests run on real Core data (`src/core/**/*.test.ts`); `src/e2e.test.ts` plays Rhino (standard solo, expert solo), Klaw (2 players) and Ultron (4 players) to an outcome with the greedy driver in `src/testing/driver.ts` and replays each log to a deep-equal state.
>
> **§4 primitive requests:** none open. Data follow-up for `card-data-pipeline`: Hulk's four result lines were ingested as separate refs `01050.hulk-constant`, `-2`, `-3`, `-4` (registered as `partOf("01050.hulk-forced-response")` no-ops), and `01163.genetically-enhanced-constant` is the reveal-time surge clause (registered as a When Revealed). Both work, but the slugs misdescribe the text.

- A TypeScript builder layer in `@mc/cards` that reads close to the printed card and compiles to plain-data `AbilityDefinition`s, e.g. `heroInterrupt(when.villainAttacks(you), draw(1))`. The engine vocabulary stays plain JSON; the DSL is authoring sugar plus validation, not an interpreter of its own.
- Every `AbilityReference` id emitted by ingestion must have a registry entry; a test enforces 100% coverage for the Core pack (and lists the missing ids when it fails).
- Per-card tests for any card whose behavior isn't a straight composition of already-tested effects.
- Pilot: the Spider-Man kit + the Rhino scenario (+ Bomb Scare + Standard). Then fan out by hero kit / aspect / encounter set.

## 5. Exit criteria (from PLAN.md)

- 100% of Core Set `AbilityReference`s have registry entries; 100% of Core records validate.
- `@mc/cards` e2e test: each Core scenario (Rhino/Klaw/Ultron) set up from real data with starter decks and played headlessly to an outcome by a scripted/greedy driver, then replayed from its log to an identical final state.
