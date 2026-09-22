# Campaign mode: the one-time foundation

Design for PLAN.md "Campaign mode (decided 2026-09-20)" §C1. The decisions in that section are settled and are not
re-litigated here.

**The requirement this document is answerable to:** adding a new campaign box, or a new campaign card, later must be
**content-only work** — a module in `@mc/cards` plus data in `@mc/content`, with no change to engine types and no
change to the client. Everything below is shaped by surveying all ten rulebooks _first_, so the foundation is not
secretly shaped like The Rise of Red Skull (MC10), which is merely the first box we build.

Sources: the ten rulebook conversions in `docs/campaign-modes/markdown/` (primary, cited as box code + page), RRG 1.8
`mc_rulesreference_v18_compressed.pdf` pp. 11, 29, and `marvel-champions-rulings-post-rrg-1-7.md` (cited by date).

---

## 1. Mechanism inventory

One row per distinct thing a campaign does. "Boxes" lists every box that uses the mechanism; the citation is the
clearest printed statement of it (usually the first box that prints it).

| #   | Mechanism                                                                                                        | Boxes                                   | Citation               |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------- |
| 1   | Fixed linear scenario order; win all N in numerical order                                                        | MC10 MC16 MC21 MC27 MC32 MC40 MC45 MC50 | MC10 p. 3              |
| 2   | **Non-linear order: players choose the next scenario**                                                           | MC60                                    | MC60 p. 8              |
| 3   | **Unplayed scenarios "progress" at random between games; 3 progressions = permanent Fail**                       | MC60                                    | MC60 p. 9 step 3       |
| 4   | **The scenario is a main scheme paired with a separately chosen villain, recorded in the log**                   | MC60                                    | MC60 p. 5, p. 9 step 5 |
| 5   | Identity locked for the whole campaign; aspects/deck free to change between scenarios                            | all 9                                   | MC10 p. 3              |
| 6   | Per-scenario setup instructions, resolved in printed order after normal setup                                    | all 9                                   | MC10 p. 3              |
| 7   | **Setup instructions placed explicitly "before players draw their starting hands"**                              | MC50                                    | MC50 p. 4              |
| 8   | **A second setup window "after resolving mulligans"**                                                            | MC50                                    | MC50 p. 11             |
| 9   | **Campaign setup that runs _before_ scenario setup, and a step between scenario and player setup**               | MC60                                    | MC60 p. 9 steps 1–9    |
| 10  | Victory instructions, resolved in printed order on a win                                                         | all 9                                   | MC10 p. 3              |
| 11  | Loss = "reset the scenario and try again with no penalty"                                                        | MC10 MC16 MC21 MC27 MC32 MC40 MC45      | MC10 p. 3              |
| 12  | **Per-scenario DEFEAT instruction blocks with real penalties**                                                   | MC50 MC60                               | MC60 p. 13; MC50 p. 19 |
| 13  | **A standard-mode loss that re-randomises hidden campaign state and re-grants evidence**                         | MC50                                    | MC50 p. 19             |
| 14  | **Expert-campaign-only loss = progress the scenario toward Fail**                                                | MC60                                    | MC60 p. 13             |
| 15  | Expert-campaign-only: losing the last scenario loses the campaign                                                | MC10 MC16 MC21 MC27 MC32 MC40 MC60      | MC10 p. 15             |
| 16  | **Winning the last scenario but losing the campaign (objective not met)**                                        | MC45                                    | MC45 p. 20             |
| 17  | `Expert Campaign Only` prefix on individual setup/victory instructions                                           | all 9                                   | MC10 p. 3              |
| 18  | Persistent damage: record remaining HP on a win, capped at base HP; it is next scenario's starting HP            | all 9                                   | MC10 p. 17             |
| 19  | **Persistent damage recorded after _each_ game, win or loss**                                                    | MC60                                    | MC60 p. 9              |
| 20  | Optional heal-to-full at setup, paid with a box-specific cost                                                    | all 9                                   | MC10 p. 7              |
| 21  | **Heal to REC rather than to full**                                                                              | MC50 MC60                               | MC50 p. 11; MC60 p. 9  |
| 22  | Elimination: a defeated player skips victory steps, rejoins next scenario by paying the heal cost                | all 9                                   | MC10 p. 17             |
| 23  | Cards added to a player's deck permanently; exempt from min/max deck size                                        | MC10 MC16 MC21 MC27 MC32 MC45           | MC10 p. 3              |
| 24  | Choose 1 of N campaign upgrades to add (free)                                                                    | MC10 MC45                               | MC10 p. 5              |
| 25  | **Purchase with a campaign currency; per-player balance carried in the log**                                     | MC16                                    | MC16 p. 5              |
| 26  | **Group-wide uniqueness over purchased cards ("only one copy per campaign for the players as a group")**         | MC16                                    | MC16 p. 5              |
| 27  | **Choose 1 of 3 randomly dealt campaign upgrades; return the rest**                                              | MC27                                    | MC27 p. 22             |
| 28  | **Add max copies of any aspect card from your collection (not from the campaign set)**                           | MC27 MC32 MC45                          | MC27 p. 22             |
| 29  | **Per-game, non-permanent deck additions ("role-building": 1 event and/or 1 upgrade)**                           | MC32                                    | MC32 p. 5              |
| 30  | Cards added to the encounter deck from a log field                                                               | MC10 MC16 MC21 MC27 MC32 MC40 MC45 MC50 | MC10 p. 7              |
| 31  | **An escalating encounter-card ladder keyed to a counted log field**                                             | MC16                                    | MC16 p. 12, p. 18      |
| 32  | Cards permanently removed from the campaign; survive a retry                                                     | MC10 MC32 MC40 MC45 MC60                | RRG p. 29; MC10 p. 12  |
| 33  | **"Use it or lose it": cards put into play at setup are removed from the campaign at end of game**               | MC32                                    | MC32 p. 5              |
| 34  | **Removal driven by what left the _game_ ("each unique ally and support removed from the game")**                | MC60                                    | MC60 p. 13             |
| 35  | Numeric shared log field (delay counters, evasion counters, Waking Nightmare, progress marks)                    | MC10 MC16 MC27 MC40 MC50 MC60           | MC10 p. 7              |
| 36  | Numeric per-seat log field (remaining HP; units)                                                                 | all 9                                   | MC10 p. 17             |
| 37  | Card-title list log field, shared (Experimental attachments, Community Service, Future Past, Last Ones Standing) | MC10 MC16 MC27 MC32 MC40 MC50           | MC10 p. 5              |
| 38  | Card-title list log field, per-seat (rescued allies, Market cards, S.H.I.E.L.D. Tech, obligations)               | MC10 MC16 MC27                          | MC10 p. 10             |
| 39  | Boolean/checkbox log field (campaign pool membership, "Defeated", "Earned?", Completed/Failed)                   | MC21 MC32 MC40 MC60                     | MC21 p. 28             |
| 40  | **Strike-through log field: a named option stays "available" until struck**                                      | MC45 MC40                               | MC45 p. 5              |
| 41  | **A named "campaign pool" of carried-forward cards put into play or shuffled in at setup**                       | MC21 MC40                               | MC21 p. 7              |
| 42  | **A campaign-wide track whose nodes add _new setup instructions_ to every later scenario**                       | MC27                                    | MC27 p. 5, p. 22       |
| 43  | **A per-seat role chosen once, granting off-aspect deckbuilding access for the campaign**                        | MC32                                    | MC32 p. 5              |
| 44  | **Hidden campaign state chosen at random and never revealed (evidence envelopes)**                               | MC50                                    | MC50 p. 5              |
| 45  | **A deduction grid in the log (combinations crossed out as evidence is gained)**                                 | MC50                                    | MC50 p. 24             |
| 46  | **Counters _and card face_ persisting on a specific card across scenarios; the flip is permanent**               | MC50                                    | MC50 p. 6              |
| 47  | Starting threat on a scheme set from a log field (flat or per-player)                                            | MC10 MC16 MC27 MC40 MC60                | MC10 p. 15             |
| 48  | Counters placed on a scenario card from a log field (lock, momentum, stamina, secret)                            | MC16 MC40 MC50 MC60                     | MC50 p. 13             |
| 49  | Enemies/allies put into play at setup from a log field                                                           | MC21 MC32 MC45 MC50 MC60                | MC21 p. 17             |
| 50  | Status cards / boost cards granted at setup from a log field                                                     | MC27 MC40 MC60                          | MC60 p. 15             |
| 51  | Campaign-specific obligations with player-card backs, added to a player deck                                     | MC10                                    | MC10 p. 17             |
| 52  | **A per-seat player number 1–4 selecting which numbered copy of a set a seat draws from**                        | MC10                                    | MC10 p. 17             |
| 53  | Campaign-specific player cards; illegal outside the campaign, added only by instruction                          | MC10 MC16 MC21 MC27 MC32 MC40 MC45      | RRG p. 11; MC10 p. 3   |
| 54  | **Prohibited cards _inside_ the campaign (player cards and modular sets)**                                       | MC27 MC40                               | MC27 p. 4; MC40 p. 6   |
| 55  | **Deck customization frozen after scenario 1 in expert campaign** (mandatory / optional)                         | MC16 MC27                               | MC16 p. 5; MC27 p. 6   |
| 56  | **In-game card text that writes the log ("remove it from the campaign log → …")**                                | MC10                                    | MC10 p. 3 card text    |
| 57  | **A log entry naming a card _and a face_ ("replace Basic with Improved"; "flip to Enhanced")**                   | MC10 MC27                               | MC10 p. 12; MC27 p. 22 |
| 58  | **Retry must re-make the same choice and re-earn the reward, even if earned in the lost game**                   | MC40                                    | MC40 p. 7              |
| 59  | **Choose which of several outcomes to pay ("place damage on Hope, or place that threat on X")**                  | MC40                                    | MC40 p. 16             |
| 60  | **A campaign environment put into play each game with a Completed / Failed side and Setup ability**              | MC40 MC60                               | MC60 p. 8              |

### 1.1 What MC10 does _not_ exercise

MC10 uses rows 1, 5, 6, 10, 11, 15, 17, 18, 20, 22, 23, 24, 30, 32, 35–38, 47, 51–53, 56, 57. Everything else is
**unproven by the first build**. The ones that would force an engine or client change if the foundation ignored them:

- **Non-linear scenario graphs and scenario progression/failure** (rows 2–4, 14) — MC60.
- **A campaign currency with purchase and group-wide uniqueness** (rows 25–26) — MC16.
- **A track whose nodes append setup instructions to later scenarios** (row 42) — MC27. The only box where the
  _instruction list itself is log-derived_.
- **Hidden campaign state and a deduction grid** (rows 44–45) — MC50.
- **A card's counters and face persisting across scenarios** (row 46) — MC50.
- **Prohibited-card lists and a deck-customization freeze inside a campaign** (rows 54–55) — MC16, MC27, MC40.
- **Non-trivial defeat blocks, including standard mode** (rows 12–13, 19) — MC50, MC60.
- **Winning the last scenario and losing the campaign** (row 16) — MC45.
- **Random selection from an "available until struck" pool** (row 40) — MC45, MC40.
- **Per-game non-permanent grants and "use it or lose it"** (rows 29, 33) — MC32.
- **Between-games choices that search the player's whole collection** (row 28) — MC27, MC32, MC45.
- **Setup windows other than "after scenario setup"** (rows 7–9) — MC50, MC60.

Each of these is why the corresponding shape below (`kind: "choice"` graphs, `CampaignOp`, `CampaignWindow`,
`LossPolicy`, `hidden`, seeded campaign RNG, `DeckContext`) is in the foundation even though MC10 never touches it.

### 1.2 Things that did not fit a category — the design risks

- **MC56 Civil War has no campaign mode at all.** MC56 p. 3: "_the Civil War expansion does not include five
  interconnected scenarios and a campaign mode_." It is a custom-scenario + competitive (PvP) expansion. PLAN.md §C3
  lists it as a campaign box with "2 scenarios"; that row is wrong. See Open question Q2.
- **MC45 "Not Defeated" instructions are rewards, not penalties.** MC45 p. 24: failing a mission lets each player add a
  free upgrade/support/ally from any aspect for the rest of the campaign; _defeating_ it removes cards from the
  campaign. The log's Setup/Defeated/Not-Defeated columns are three parallel instruction lists per option, not a
  success/failure pair.
- **MC50's Board Members are game objects whose state is campaign state.** Secret counters carry over; at 4 (3 in
  expert) the environment flips to an attachment "_for the rest of the campaign_" (MC50 p. 6). This is a card instance
  whose face and counters are log state — not a number the log stores about a card.
- **MC16 "The Collection" removals are scenario-scoped, not campaign-scoped.** MC16 p. 12: cards recorded in the log are
  removed _from the game_ during scenario 3's setup only. Recorded in the log, but not a campaign removal (RRG p. 29).
  Ruling June 2, 2026 (3) answer 4 confirms the count, not the identity, is what carries.
- **MC45's Apocalypse scenario reuses the _other side_ of struck Overseer minions.** Ruling April 30, 2026 (4): "Prelate
  versions of minions remain available … even if their Overseer counterparts were crossed out." A campaign removal is
  by _card face_, not by physical card.
- **MC27's reputation track can be exceeded and can score negative.** MC27 p. 5 and ruling August 3, 2026 (4) answer 2:
  negative victory points mark no nodes. The track is a monotone counter with a clamp at zero per marking event.
- **MC10's Expert Campaign Sets are four _identical_ sets numbered 1–4**, selected by a per-seat player number
  (MC10 p. 17). The log's "player number" is a seat attribute with rules consequences, not cosmetic ordering.
- **Linked cards can never be granted.** Ruling August 3, 2026 (4) answer 3: "Linked cards cannot be included in decks",
  explicitly in the campaign-reward context. The existing `linked_card` refusal must stay absolute in campaign context.

---

## 2. Mode set

`ScenarioDifficulty` ("standard" | "expert") is today declared in `packages/content/src/schema/sets.ts:49` and is used
_by value_ in `packages/cards/src/{core,wave1,wave2}/setup.ts` and `packages/engine/src/setup.ts`
(`villainsForDifficulty`), and as a string union in `packages/client/src/engine/host.ts` (`SessionConfig.difficulty`,
which additionally carries wave 1's non-RRG `"extreme"`).

RRG 1.8 p. 29 defines four modifications of standard mode — expert, heroic, skirmish, campaign — and says each composes
with the others, per scenario. Expert _campaign_ is a modification of campaign mode, listed separately from expert
_mode_. So the axes are: expert, heroic level, skirmish version, campaign, expert campaign.

```ts
// @mc/content — packages/content/src/schema/modes.ts (new)

/** RRG 1.8 "Modes of Play" (p. 29). Every field is absent by default; absent everything is standard mode. */
export interface PlayModes {
  /** Expert mode: Expert encounter set, villain starts one stage later. */
  readonly expert?: true;
  /** Heroic level X: X extra encounter cards per player at villain phase step 3. Not built; typed now. */
  readonly heroic?: number;
  /** Skirmish (a.k.a. Rookie): one chosen villain version, the rest removed. Not built; typed now. */
  readonly skirmish?: { readonly villainVersion: string };
  /** Campaign mode: which campaign this scenario is being played as part of. */
  readonly campaign?: CampaignModeRef;
}

export interface CampaignModeRef {
  readonly campaignId: CampaignId;
  /** Expert *campaign* — orthogonal to `expert` (RRG 1.8 p. 29). Gates `Expert Campaign Only` instructions. */
  readonly expertCampaign?: true;
}

/** A mode gate on an instruction or a log field. All listed conditions must hold. */
export interface ModePredicate {
  readonly expert?: boolean;
  readonly expertCampaign?: boolean;
  readonly heroicAtLeast?: number;
}

export const STANDARD_MODES: PlayModes = {};
export const matchesModes = (modes: PlayModes, gate?: ModePredicate): boolean => {
  /* … */
};
```

**Migration, without breaking existing callers.** `ScenarioDifficulty` stays exactly as it is, re-expressed as a
projection:

```ts
/** The two-value projection the villain-stage tables and Standard/Expert set selection read. Unchanged shape. */
export type ScenarioDifficulty = "standard" | "expert";
export const difficultyOf = (modes: PlayModes): ScenarioDifficulty => (modes.expert ? "expert" : "standard");
export const modesOf = (difficulty: ScenarioDifficulty): PlayModes => (difficulty === "expert" ? { expert: true } : {});
```

| Call site                                           | Change                                                                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Scenario.villainStages: { standard, expert }`      | none — it is keyed by the projection, not by the mode set                                                                                       |
| `Scenario.expertEncounterSetIds` / `expertVillains` | none — selected via `difficultyOf(modes)`                                                                                                       |
| `engine/setup.ts villainsForDifficulty`             | none — keeps its `"standard" \| "expert"` parameter                                                                                             |
| `cards/{core,wave1,wave2}/setup.ts` options         | add `modes?: PlayModes`; keep `difficulty?`; `modes` wins if both given, and giving both a `difficulty` and `modes.expert` that disagree throws |
| `client/engine/host.ts SessionConfig`               | add `modes?: PlayModes`; keep `difficulty` ("standard"\|"expert"\|"extreme") as-is                                                              |
| wave 1 `"extreme"`                                  | **stays out of `PlayModes`.** It is The Wrecking Crew's per-villain version choice (`villainVersions`), not an RRG mode.                        |

Nothing in `PlayModes` reaches `GameState`. What reaches the engine is the _resolved consequence_ of the modes: the
villain stage range, the encounter sets, and — new — `GameSetupConfig.campaign` (§5).

---

## 3. Where the campaign types and data live

Dependency direction is strictly `client → cards → engine → content`. Campaign setup/victory instructions read like card
text and must therefore be `EffectSpec`s, which are **engine** types. `@mc/content` cannot import `@mc/engine`.

**Decision:**

| Thing                                                                                                                | Package                                 | Why                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CampaignDefinition`, `CampaignLog`, `CampaignInstruction`, `CampaignOp`, `CampaignGameInput/Result` — the **types** | `@mc/engine` (`src/campaign.ts`)        | They reference `EffectSpec`/`Predicate`/`ValueSpec`. A type is not a campaign; the engine still never names one.      |
| The **runner** (`resolveBetweenGames`, `startGameFromLog`, `applyCampaignResult`)                                    | `@mc/engine` (`src/campaign/`)          | Pure, headless, deterministic — the same properties `applyCommand` already has.                                       |
| Each box's **`CampaignDefinition` object**                                                                           | `@mc/cards` (`src/campaigns/<code>.ts`) | It is authored with the ability DSL, exactly as card text is. `@mc/cards` already owns "printed words → engine data". |
| The `CampaignRegistry` handed to the runner                                                                          | `@mc/cards` (`src/campaigns/index.ts`)  | Mirrors `AbilityRegistry`/`EngineDeps`.                                                                               |
| `Campaign` record: id, name, packCode, scenarioIds, campaign set ids                                                 | `@mc/content`                           | Card-database facts. Needed by `validateDeck`, which lives in the engine and may only import content.                 |

`@mc/content`'s existing `Campaign` (`schema/sets.ts:241`) gains the fields legality needs:

```ts
export interface Campaign {
  readonly id: CampaignId;
  readonly name: string;
  readonly packCode: SetCode; // RRG p. 11: "from the same product (set icon)"
  readonly scenarioIds: readonly ScenarioId[];
  /** Encounter sets whose cards are campaign-specific to this campaign (MC10: `hydra_camp`). */
  readonly campaignSetIds: readonly EncounterSetId[];
  /** Per-seat numbered variants of one set (MC10 p. 17's four Expert Campaign Sets), seat 1..4 in order. */
  readonly perSeatSetIds?: readonly EncounterSetId[];
  /** Player cards and modular sets a box forbids *inside* its campaign (MC27 p. 4; MC40 p. 6). */
  readonly prohibited?: { readonly cardIds?: readonly CardId[]; readonly encounterSetIds?: readonly EncounterSetId[] };
}
```

---

## 4. `CampaignDefinition` — plain data, in `@mc/engine`

> **Built in `packages/engine/src/campaign.ts`.** The sketches below are the as-built shapes. Where the built type
> differs from the original sketch the difference is called out inline; the two structural ones are that every id with
> a `@mc/content` brand (`CampaignId`, `ScenarioId`, `CardId`, `EncounterSetId`) is typed as that brand rather than as
> `string`, and that the types this document referenced without declaring — `LogWriteSpec`, `LogWrite`,
> `CollectionFilter`, `CampaignLogSnapshot`, `CampaignStepTrace`, `ResolvedInstruction` — are declared below.

```ts
// @mc/engine — packages/engine/src/campaign.ts. No campaign or card is ever named in this file.

export interface CampaignDefinition {
  /** Matches a `@mc/content` `Campaign.id`. Opaque to the engine, which never compares it to a literal. */
  readonly campaignId: CampaignId;
  /** Bumped whenever an instruction id, log field id or node id changes. Stamped into every log. */
  readonly version: string;
  readonly logFields: readonly LogFieldDef[];
  readonly graph: CampaignGraph;
  readonly loss: LossPolicy;
  /** Instructions appended to *every* node's setup, in order, before the node's own (MC50's board prep, MC45's set). */
  readonly everyNodeSetup?: readonly CampaignInstruction[];
  readonly everyNodeVictory?: readonly CampaignInstruction[];
  /**
   * Instructions the log itself can switch on, keyed by id. A log field of type `instructionList` names entries here.
   * MC27 p. 22: each marked reputation node adds a `Setup:` instruction to every remaining scenario. Without this the
   * instruction list is not a function of the definition alone, and MC27 forces an engine change.
   */
  readonly conditionalInstructions?: Readonly<Record<string, CampaignInstruction>>;
}
```

### 4.1 Scenario graph

Not a list: MC60 branches (p. 8), and its "next" step mutates the log (p. 9 steps 1–3) before the choice is offered.

```ts
export type CampaignGraph =
  /** MC10, MC16, MC21, MC27, MC32, MC40, MC45, MC50: nodes played in order. */
  | { readonly kind: "linear"; readonly nodes: readonly CampaignNode[] }
  /** MC60: the players choose. `beforeChoice` runs first (progression), `available` gates each node. */
  | {
      readonly kind: "choice";
      readonly nodes: readonly CampaignNode[];
      readonly beforeChoice: readonly CampaignInstruction[];
      readonly available: CampaignPredicate;
      /** A node that becomes mandatory once `when` holds and nothing else is available (MC60's Kingpin). */
      readonly finale?: { readonly nodeId: string; readonly when: CampaignPredicate };
      /**
       * **Added in step 4.** How many `progressNode` marks fail a node. MC60 p. 9 step 3 says "If a scenario has
       * three Xs to its right, it has Failed" — three *printed boxes on that box's sheet*, so the threshold is the
       * box's number, not the engine's. Without it `progressNode` would either be uninterpretable or would hard-code
       * MC60's 3 in `@mc/engine`.
       */
      readonly progressToFail?: number;
    };

export interface CampaignNode {
  /** Stable id. Distinct from `scenarioId`: MC60 plays the same scenario id against a chosen villain. */
  readonly id: string;
  readonly label: string;
  /** Fixed scenario, or one composed between games (MC60 p. 9 step 5–6 picks the villain and its sets). */
  readonly scenario: CampaignScenarioRef;
  /** Between-games steps that decide what game to build: villain, extra encounter sets, set-aside cards. */
  readonly composition?: readonly CampaignInstruction[];
  readonly setup: readonly CampaignInstruction[];
  readonly victory: readonly CampaignInstruction[];
  /** MC50 p. 19 and MC60 p. 13. Empty for the seven boxes whose loss is "no penalty". */
  readonly defeat?: readonly CampaignInstruction[];
}

/** Named rather than inlined, so a client can switch on it without restating the union. */
export type CampaignScenarioRef =
  { readonly kind: "fixed"; readonly scenarioId: ScenarioId } | { readonly kind: "composed" };
```

### 4.2 Log field schema, declared by the box

```ts
export type LogFieldType =
  | { readonly kind: "number"; readonly min?: number; readonly max?: number; readonly clampAtZero?: true }
  | { readonly kind: "flag" }
  /** An ordered list of card ids. Duplicates allowed (ruling June 2, 2026 (3) answer 3). */
  | { readonly kind: "cardList" }
  /** One card, optionally with which face is recorded (MC10 p. 12 Basic→Improved; MC27 p. 22 →Enhanced). */
  | { readonly kind: "cardRef"; readonly withFace?: true }
  /** A fixed option set: a role (MC32 p. 5), a villain (MC60 p. 9), a scenario outcome. */
  | { readonly kind: "choice"; readonly options: readonly string[] }
  /** Named options that stay "available" until struck (MC45 p. 5; MC40 p. 7). */
  | { readonly kind: "strikeList"; readonly options: readonly string[] }
  /** Counters that ride a named card across scenarios, with the face it is on (MC50 p. 6). */
  | { readonly kind: "cardState"; readonly cardIds: readonly CardId[] }
  /** Ids into `conditionalInstructions` (MC27 p. 22's reputation nodes). */
  | { readonly kind: "instructionList" }
  /** Freeform. Never read by an instruction; shown on the sheet only ("Notes"). */
  | { readonly kind: "text" };

export interface LogFieldDef {
  readonly id: string;
  /** As the printed sheet names it, so the rendered log matches the paper one. */
  readonly label: string;
  readonly scope: "shared" | "perSeat";
  readonly type: LogFieldType;
  /** Only tracked when these modes are on: persistent damage is `{ expertCampaign: true }`. */
  readonly whenModes?: ModePredicate;
  /** Never shown to the player (MC50 p. 5's A.I.M. envelope). Excluded from every view model. */
  readonly hidden?: true;
  /** "MC10 p. 7". Enforced format by the coverage test. */
  readonly citation: string;
}
```

### 4.3 Instructions

```ts
export interface CampaignInstruction {
  /** Stable, unique within the box: `"mc10.s2.victory.delay-counters"`. The coverage test resolves it. */
  readonly id: string;
  /** The printed sentence, verbatim. Shown in the between-games step list and in the log's history. */
  readonly text: string;
  readonly citation: string;
  /** `{ expertCampaign: true }` is the printed `Expert Campaign Only` prefix. */
  readonly whenModes?: ModePredicate;
  /** A log-state gate: "If Security Breach is in the campaign pool", "If Frightened Police Defeated is checked". */
  readonly when?: CampaignPredicate;
  readonly step: CampaignStep;
}

export type CampaignStep =
  /** Resolved by the engine inside the game, at a named window, as ordinary effects. */
  | { readonly kind: "inGame"; readonly window: CampaignWindow; readonly effects: readonly EffectSpec[] }
  /** Resolved by the campaign runner. No `GameState` exists. */
  | { readonly kind: "betweenGames"; readonly ops: readonly CampaignOp[] }
  /** Read the finished game and write the log. Victory/defeat instructions are mostly these. */
  | { readonly kind: "record"; readonly writes: readonly LogWriteSpec[] };
```

**The boundary between "in game" and "between games"** is exactly this: an instruction is `inGame` **iff it needs a
`GameState`** — putting a card into play, shuffling into the encounter deck, placing threat/counters/status, dealing an
encounter card, setting hit points. An instruction is `betweenGames` iff it only touches decks, the log, and player
choices — adding a card to a deck, spending currency, striking an option, choosing a role, choosing the next scenario.
A `record` instruction is the read half of the same boundary: it reads the _finished_ game's state and writes the log.

`CampaignWindow` — five values, all printed in some rulebook:

| #   | Window                | Meaning                                                                                      | Citation              |
| --- | --------------------- | -------------------------------------------------------------------------------------------- | --------------------- |
| 1   | `beforeScenarioSetup` | before RRG Appendix II's scenario setup begins                                               | MC60 p. 9 steps 1–7   |
| 2   | `afterScenarioSetup`  | **the default.** After Appendix II step 12 (scenario setup abilities), before step 14 (draw) | MC10 p. 3 + MC50 p. 4 |
| 3   | `beforeStartingHands` | explicit synonym of the default, kept because MC50 prints it                                 | MC50 p. 4             |
| 4   | `beforePlayerSetup`   | the last thing before player setup (deck surgery)                                            | MC60 p. 9 step 8      |
| 5   | `afterMulligans`      | after Appendix II step 15                                                                    | MC50 p. 11            |

The `#` column is the order the engine resolves them in, exported as `CAMPAIGN_WINDOW_ORDER`. **As built:** windows
2–4 all name the same printed gap — after Appendix II step 12 and before step 14 — so their order relative to each
other is an engine convention (latest-sounding last), not a rule. No rulebook prints two of them for one scenario.
The draw is Appendix II **step 14**, not 13 (the original sketch miscounted); steps 15 and 16 are the mulligan and
the player setup abilities, as `flow.ts` has always had them.

The default's placement is a _reading_: MC10 p. 3 says only "set up the scenario as per the normal rules of the game.
Then, follow that scenario's setup instructions". MC50 p. 4 pins the same sentence to "before players draw their
starting hands", and MC10 p. 7's own "_Each player searches their deck for all cards with the setup keyword and puts
them into play_" is only coherent before the draw. Documented in the code comment, and exported as
`DEFAULT_CAMPAIGN_WINDOW` so no caller has to restate the reading; see Open question Q7.

**`LogWriteSpec` / `LogWrite` / `CampaignGameQuery`** — the `record` step's half, referenced above and declared here.
`CampaignGameQuery` is the plain-data form of the `fromGame.*` DSL builders (§7.2); it reuses `TargetQuery` so a
campaign instruction describes cards with exactly the vocabulary a card ability does.

```ts
export type CampaignGameQuery =
  | { readonly kind: "cardsThatEnteredPlay"; readonly query: TargetQuery } // MC10 p. 5
  | { readonly kind: "cardsRemovedFromGame"; readonly query: TargetQuery } // MC60 p. 13
  | { readonly kind: "cardsInPlay"; readonly query: TargetQuery } // MC50 p. 11
  | { readonly kind: "cardsInVictoryDisplay"; readonly query: TargetQuery } // MC60 p. 13
  | { readonly kind: "countersOn"; readonly query: TargetQuery; readonly counter: string } // MC10 p. 7, MC50 p. 11
  | { readonly kind: "threatOn"; readonly query: TargetQuery } // MC60 p. 13
  | { readonly kind: "remainingHitPointsCappedAtBase" } // MC10 p. 17 — the cap is part of the query
  | { readonly kind: "isEngagedWithEnemy" } // MC10 p. 12
  | { readonly kind: "const"; readonly value: number | string | boolean } // MC60 p. 13's "check the box"
  | { readonly kind: "count"; readonly of: CampaignGameQuery }
  | { readonly kind: "atLeast"; readonly of: CampaignGameQuery; readonly amount: number };

export type LogWriteMode = "set" | "add" | "append" | "strike";

export interface LogWriteSpec {
  readonly field: string;
  readonly seat?: "self" | "each";
  readonly mode: LogWriteMode;
  readonly value: CampaignGameQuery;
}

/** The resolved form: what actually went into the log, for the log and for the history trace. */
export interface LogWrite {
  readonly field: string;
  /** By `CampaignSeat.seatNumber`; null for a shared or hidden field. */
  readonly seatNumber: number | null;
  readonly mode: LogWriteMode;
  readonly value: LogValue;
}
```

### 4.4 Values and predicates over the log

The in-game half reuses the engine's existing vocabulary, extended by exactly two members (built in `spec.ts`;
`seat` absent is the shared field, and several players resolve to the first, as every singular `PlayerRef` does):

```ts
// ValueSpec gains:
| { readonly kind: "campaignLog"; readonly field: string; readonly seat?: PlayerRef; readonly of?: "count" }
// Predicate gains (`of` added as built, so `atLeast` can count a list the same way the value does; `has` is
// `string` because the engine never names a card — a `CardId` is one):
| { readonly kind: "campaignLog"; readonly field: string; readonly seat?: PlayerRef; readonly has?: string;
    readonly atLeast?: number; readonly of?: "count"; readonly isSet?: boolean }
```

**As built**, `of: "count"` is what makes a list readable as a number; without it only a `number` field (its value)
and a `flag` field (1/0) read as anything but 0, so a misspelled field cannot read as a plausible number. Every
condition on the predicate is ANDed; with none given it asks whether the field is present at all, and a field the
frozen view does not carry satisfies `isSet: false` and nothing else. `campaign-state.ts` holds the readers, as
total functions: no campaign, no field, wrong kind and an unseated player all read as "nothing recorded".

The between-games half has its own tiny value language (no `GameState` to read):

```ts
export type CampaignValue =
  | { readonly kind: "const"; readonly value: number | string | boolean }
  | { readonly kind: "field"; readonly field: string; readonly seat?: "self" | "each" }
  | { readonly kind: "count"; readonly field: string }
  | { readonly kind: "sum" | "difference" | "min" | "max"; readonly of: readonly CampaignValue[] }
  | { readonly kind: "clampAtZero"; readonly of: CampaignValue }
  /** A choice the player made earlier in this same step list. */
  | { readonly kind: "choice"; readonly slot: string };

export type CampaignPredicate =
  | { readonly kind: "fieldAtLeast"; readonly field: string; readonly amount: number; readonly seat?: "self" }
  | { readonly kind: "fieldIsSet"; readonly field: string; readonly seat?: "self" }
  | { readonly kind: "fieldContains"; readonly field: string; readonly value: string; readonly seat?: "self" }
  | { readonly kind: "notStruck"; readonly field: string; readonly option: string }
  | { readonly kind: "nodeResolved"; readonly nodeId: string; readonly as?: "won" | "failed" }
  | { readonly kind: "modes"; readonly of: ModePredicate }
  | { readonly kind: "not"; readonly of: CampaignPredicate }
  | { readonly kind: "and" | "or"; readonly of: readonly CampaignPredicate[] };
```

### 4.5 `CampaignOp` — the between-games vocabulary

Every op is derived from a printed sentence in one of the ten rulebooks. This list is the foundation's real surface
area; adding a box must not require adding to it.

```ts
export type CampaignOp =
  // --- log writes ------------------------------------------------------------------------
  | { readonly kind: "setField"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  | { readonly kind: "addToField"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  | { readonly kind: "appendToList"; readonly field: string; readonly seat?: "self"; readonly value: CampaignValue }
  // `seat` added as built: the field schema permits a per-seat `strikeList`, and an op that could not address one
  // would be a latent engine change.
  | { readonly kind: "strike"; readonly field: string; readonly seat?: "self"; readonly option: CampaignValue } // MC45 p. 5
  | { readonly kind: "clearField"; readonly field: string; readonly seat?: "self" }
  // --- decks -----------------------------------------------------------------------------
  /** MC10 p. 3: added cards stay for the rest of the campaign and are exempt from deck size. */
  | {
      readonly kind: "grantCard";
      readonly seat: "self" | "each";
      readonly card: CampaignValue;
      readonly permanence: "campaign" | "thisGame";
    } // `thisGame` = MC32 p. 5
  | { readonly kind: "revokeCard"; readonly seat: "self" | "each"; readonly card: CampaignValue }
  /** RRG p. 29. Applies to every seat and to the encounter side; survives a retry. Resolved to a `CampaignCardFace`. */
  | { readonly kind: "removeFromCampaign"; readonly cards: readonly CampaignValue[] }
  | { readonly kind: "setGrantFace"; readonly card: CampaignValue; readonly face: string } // MC10 p. 12, MC27 p. 22
  // --- choices and randomness -------------------------------------------------------------
  /** "Each player chooses one of the TECH upgrades" / "choose an aspect card in their collection". */
  | {
      readonly kind: "choose";
      readonly slot: string;
      readonly chooser: "eachSeat" | "group" | "firstPlayer";
      readonly from: CampaignChoiceSource;
      readonly count?: number;
      readonly optional?: true;
    }
  /** Seeded from the log's own RNG, so a campaign is replayable and a client cannot reroll. */
  | { readonly kind: "random"; readonly slot: string; readonly from: CampaignChoiceSource; readonly count?: number }
  // --- currency ---------------------------------------------------------------------------
  /** MC16 p. 5. A numeric per-seat field plus a per-card price read from card data. */
  | { readonly kind: "spend"; readonly field: string; readonly seat: "self"; readonly amount: CampaignValue }
  // --- graph ------------------------------------------------------------------------------
  | { readonly kind: "progressNode"; readonly node: CampaignValue } // MC60 p. 9 step 3
  | { readonly kind: "markNode"; readonly node: CampaignValue; readonly as: "completed" | "failed" }
  | { readonly kind: "endCampaign"; readonly result: "won" | "lost" } // MC45 p. 20
  // --- composition (feeds `CampaignGameInput`, not the log) --------------------------------
  | { readonly kind: "composeVillain"; readonly villain: CampaignValue } // MC60 p. 9 step 5
  | { readonly kind: "composeEncounterSets"; readonly sets: readonly CampaignValue[] }
  | { readonly kind: "forEachSeat"; readonly ops: readonly CampaignOp[] }
  | {
      readonly kind: "if";
      readonly when: CampaignPredicate;
      readonly then: readonly CampaignOp[];
      readonly else?: readonly CampaignOp[];
    };

export type CampaignChoiceSource =
  | { readonly kind: "cards"; readonly cardIds: readonly CardId[] }
  /** Cards of a campaign set not already granted / not removed from the campaign. */
  | { readonly kind: "campaignSet"; readonly encounterSetId: EncounterSetId; readonly excludeGranted?: true }
  /** MC10 p. 17: the seat's own numbered copy of `Campaign.perSeatSetIds`. */
  | { readonly kind: "perSeatSet"; readonly excludeGranted?: true }
  /** MC27 p. 22 / MC32 p. 5 / MC45 p. 24: the player's whole collection, filtered. */
  | { readonly kind: "collection"; readonly filter: CollectionFilter }
  /** Options of a `choice`/`strikeList` field that have not been struck. */
  | { readonly kind: "fieldOptions"; readonly field: string; readonly unstruckOnly?: true }
  | { readonly kind: "nodes"; readonly filter: "unresolved" | "available" }
  /** A card in the seat's own current deck (MC27 p. 22 "Planning Ahead"). */
  | { readonly kind: "ownDeck"; readonly filter?: CollectionFilter };

/**
 * Declared as built. It filters *card data*, not cards in play — there is no `GameState` between games — so it is
 * its own type rather than a `TargetQuery`, while mirroring that vocabulary where the two overlap. `aspects` is
 * `string[]` for the same reason `TargetQuery.aspect` is: imported data is untrusted.
 */
export interface CollectionFilter {
  readonly categories?: readonly TargetCategory[]; // MC32 p. 5 "an event and/or an upgrade"; MC45 p. 24
  readonly aspects?: readonly string[]; // MC32 p. 5 "their role's associated aspects"
  readonly traits?: readonly Trait[];
  readonly sharesTraitWithIdentity?: true; // MC45 p. 20 "must share a trait with your hero"
  readonly maxPrintedCost?: number;
  readonly excludeCardIds?: readonly CardId[];
}
```

### 4.6 Loss policy — no engine default

```ts
export interface LossPolicy {
  /**
   * `"free"`: MC10 p. 3 / MC16 p. 4 / MC21 p. 4 / MC27 p. 4 / MC32 p. 4 / MC40 p. 6 / MC45 p. 4 — "they may reset
   * the scenario and try again with no penalty."
   * `"byInstruction"`: MC50 p. 19, MC60 p. 13 — the node's own `defeat` instructions run first.
   */
  readonly retry: "free" | "byInstruction";
  /** Campaign-wide defeat instructions, appended to every node's own (MC60 p. 9's expert progression). */
  readonly everyNodeDefeat?: readonly CampaignInstruction[];
  /**
   * What a retry restores. `"nodeStart"` replays the node against the log exactly as it stood when the node began,
   * *minus* anything the lost game removed from the campaign (RRG p. 29) and minus whatever `defeat` wrote.
   * MC40 p. 7 depends on this: a reward earned in a lost game is not kept, and the same side scheme must be re-chosen.
   */
  readonly retryBaseline: "nodeStart";
}
```

There is **no default**. A box's definition must state its policy; the coverage test fails a definition that omits it.

---

## 5. `CampaignLog` — state, plain serializable, versioned

```ts
export type LogValue =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "flag"; readonly value: boolean }
  | { readonly kind: "cardList"; readonly cardIds: readonly CardId[] }
  | { readonly kind: "cardRef"; readonly cardId: CardId; readonly face?: string }
  | { readonly kind: "choice"; readonly option: string }
  | { readonly kind: "strikeList"; readonly struck: readonly string[] }
  /**
   * As built: counters **by name** (`CardInstance.counters` is `Record<string, number>`, and MC16/MC40/MC60 ride
   * lock/momentum/stamina counters, not just MC50's secrets), and `face` optional — a card can carry counters
   * across scenarios without ever flipping.
   */
  | {
      readonly kind: "cardState";
      readonly cards: Readonly<
        Record<string, { readonly counters: Readonly<Record<string, number>>; readonly face?: string }>
      >;
    }
  | { readonly kind: "instructionList"; readonly ids: readonly string[] }
  | { readonly kind: "text"; readonly value: string };

export type GrantPermanence = "campaign" | "thisGame";

export interface CampaignGrant {
  readonly cardId: CardId;
  /** `"campaign"` stays for the rest of the campaign; `"thisGame"` is removed at the end of the game (MC32 p. 5). */
  readonly permanence: GrantPermanence;
  /** Which face the grant is on (MC10 p. 12's Improved side; MC27 p. 22's Enhanced side). */
  readonly face?: string;
  /** The node that granted it, for the sheet and for `retryBaseline`. */
  readonly grantedAtNodeId: string;
}

export interface CampaignSeat {
  /** 1-based. MC10 p. 17's "player number", which selects a numbered Expert Campaign Set. */
  readonly seatNumber: number;
  /** Locked for the campaign (MC10 p. 3). */
  readonly identityCardId: CardId;
  /** The campaign's own copy of this seat's deck (see Open question Q5). */
  readonly deck: DeckContents;
  readonly grants: readonly CampaignGrant[];
  readonly fields: Readonly<Record<string, LogValue>>;
}

/**
 * Declared as built: the mutable half of a `CampaignLog`, and the unit `CampaignHistoryEntry.logBefore` stores.
 * The identity fields (`id`, `campaignId`, `schema`, `status`, `history`) are absent because a retry never
 * changes them. It is **not** the same type as `CampaignGameInput.log` — see §7.1.
 */
export interface CampaignLogSnapshot {
  readonly definitionVersion: string;
  readonly shared: Readonly<Record<string, LogValue>>;
  readonly hidden: Readonly<Record<string, LogValue>>;
  readonly seats: readonly CampaignSeat[];
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly position: CampaignPosition;
  readonly rng: RngState;
}

/**
 * **As built, replacing `CardId` everywhere a removal is recorded.** RRG p. 29's removal is by card *face*: ruling
 * April 30, 2026 (4) answer 2, "Prelate versions of minions remain available for the Apocalypse scenario even if
 * their Overseer counterparts were crossed out of the campaign log" — two faces of one double-sided card, which
 * `@mc/content` models as one `CardId` plus a `flipSide`. `face` is the other face's printed name; absent is the
 * front face, i.e. every single-sided card. Flagged in §1.2 from the start; the sketch's `CardId[]` could not say it.
 */
export interface CampaignCardFace {
  readonly cardId: CardId;
  readonly face?: string;
}

/** Storage shape, exported so storage and the log agree on one number. */
export const CAMPAIGN_LOG_SCHEMA = 1;

export interface CampaignLog {
  /** Storage shape. Bumped like `SAVE_SCHEMA`; old logs are retired, not silently misread. */
  readonly schema: number;
  readonly id: string;
  readonly campaignId: CampaignId;
  /** `CampaignDefinition.version` the log was created against. A mismatch marks the log `incompatible`. */
  readonly definitionVersion: string;
  /** `@mc/content` pool version at creation, so a pool update under a saved campaign is *detected*. */
  readonly poolVersion: string;
  /** Campaign-level modes (`expertCampaign`). Per-scenario modes live on each history entry (RRG p. 29). */
  readonly modes: PlayModes;
  readonly seats: readonly CampaignSeat[];
  readonly shared: Readonly<Record<string, LogValue>>;
  /** Fields declared `hidden` (MC50 p. 5). Never crosses into a view model. */
  readonly hidden: Readonly<Record<string, LogValue>>;
  /** RRG p. 29: "that card can no longer be used during the rest of the campaign, even if players retry". */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly position: CampaignPosition;
  /** As built: the seed the RNG was created from, kept beside the advancing state so a campaign can be re-derived. */
  readonly seed: number;
  /** Seeded RNG for every `random` op. Advancing it is part of the log's state. */
  readonly rng: RngState;
  /** One entry per game *attempted*, won or lost, in order. The campaign's replay trace. */
  readonly history: readonly CampaignHistoryEntry[];
  readonly status: CampaignStatus;
  /**
   * **Added in step 4.** The game the runner has composed and that has not reported a result yet; absent between
   * games. The original sketch had nowhere to keep it: `LossPolicy.retryBaseline` needs the log as it stood when
   * the node began, and `CampaignHistoryEntry` cannot exist before the outcome is known. Keeping it inside the log
   * is also what lets a campaign be saved *mid-scenario* and resumed — `resolveBetweenGames` then
   * `applyCampaignResult` survive a JSON round trip in between.
   */
  readonly attempt?: CampaignAttempt;
}

export interface CampaignAttempt {
  readonly nodeId: string;
  readonly modes: PlayModes;
  /** The `retryBaseline: "nodeStart"` baseline: the log before *anything* in this between-games block ran. */
  readonly logBefore: CampaignLogSnapshot;
  /** The composition and setup steps that already resolved, for the history entry this becomes. */
  readonly steps: readonly CampaignStepTrace[];
  readonly input: CampaignGameInput;
  /** `composeVillain` (MC60 p. 9 step 5); null for a node whose scenario is `fixed`. */
  readonly composedVillain: string | null;
  /** `composeEncounterSets` (MC60 p. 9 step 6), in the order the ops named them. */
  readonly composedEncounterSetIds: readonly string[];
}

export type CampaignStatus = "active" | "won" | "lost" | "abandoned" | "incompatible";
export type CampaignAttemptOutcome = "won" | "lost" | "abandoned";

export interface CampaignPosition {
  /** `linear`: the index of the next node. `choice`: the set still playable, plus per-node progress. */
  readonly nextNodeId: string | null;
  readonly resolved: Readonly<Record<string, "completed" | "failed">>;
  /** MC60 p. 9 step 3: progression marks per node; 3 means Failed. */
  readonly progress: Readonly<Record<string, number>>;
}

export interface CampaignHistoryEntry {
  readonly nodeId: string;
  /** The per-scenario modes chosen for this attempt (RRG p. 29: modes are chosen per scenario). */
  readonly modes: PlayModes;
  readonly outcome: CampaignAttemptOutcome;
  /** The `mc-saves` game id, so the played game can be replayed from the campaign browser. */
  readonly gameId: string | null;
  /** The log exactly as it stood before this node's instructions ran — `LossPolicy.retryBaseline`. */
  readonly logBefore: CampaignLogSnapshot;
  /** Every step that ran, in order: instruction id, printed text, and what it did. */
  readonly steps: readonly CampaignStepTrace[];
  /** Epoch milliseconds, supplied by the caller. Never read from a clock here, so the engine stays pure. */
  readonly at: number;
}

/** Declared as built. One resolved — or deliberately skipped — instruction, the campaign's equivalent of a game event. */
export interface CampaignStepTrace {
  readonly instructionId: string;
  /** Copied from the instruction so the trace reads without the definition to hand. */
  readonly text: string;
  readonly citation: string;
  readonly kind: CampaignStep["kind"];
  /** Set when the instruction did not run: its `whenModes` gate or its `when` predicate failed. */
  readonly skipped?: "modes" | "condition";
  readonly writes: readonly LogWrite[];
  readonly choices: readonly CampaignChoiceRecord[];
  readonly removedFromCampaign: readonly CampaignCardFace[];
  readonly grants: readonly CampaignGrant[];
}

export interface CampaignChoiceRecord {
  readonly slot: string;
  /** The seat that chose, by `CampaignSeat.seatNumber`; null for a group or first-player choice. */
  readonly seatNumber: number | null;
  readonly picked: readonly string[];
  /** True when the pick came from `CampaignLog.rng` rather than from a human. */
  readonly random?: true;
}
```

**Versioning and migration.** Three independent version stamps, each with a different failure mode:

| Stamp               | Changes when                                                     | On mismatch                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema`            | the `CampaignLog` shape changes                                  | retire (mark `incompatible`, readable, not continuable) — the policy `game-storage.ts` already uses                                                              |
| `definitionVersion` | a box renames/removes an instruction id, log field id or node id | retire, unless the box ships a migration function keyed `from → to`                                                                                              |
| `poolVersion`       | `@mc/content` errata/new cards land under a running campaign     | **not** retired: re-validate each seat's deck on the next scenario and surface the problems, never rewrite the deck (the discipline `deck-storage.ts` documents) |

---

## 6. Campaign instructions as DSL

`@mc/cards` gets a `campaign` builder namespace beside the existing ability builders. It compiles to the plain data
above; it interprets nothing.

```ts
// packages/cards/src/campaigns/trors.ts  (sketch — MC10, the first box)

export const TRORS_CAMPAIGN = defineCampaign({
  campaignId: "trors",
  version: "1",
  logFields: [
    field.perSeat("identity", "Player's Identity", { kind: "cardRef" }, "MC10 p. 5"),
    field.perSeat("remainingHp", "Remaining hit points", { kind: "number", min: 0 }, "MC10 p. 17", {
      whenModes: { expertCampaign: true },
    }),
    field.perSeat("obligations", "Obligations", { kind: "cardList" }, "MC10 p. 17"),
    field.perSeat("techUpgrade", "Tech Upgrade", { kind: "cardRef" }, "MC10 p. 5"),
    field.perSeat("basicUpgrade", "Basic Upgrade", { kind: "cardRef", withFace: true }, "MC10 p. 7"),
    field.perSeat("rescuedAllies", "Rescued Allies", { kind: "cardList" }, "MC10 p. 10"),
    field.shared("experimental", "Experimental Weapons added to encounter deck", { kind: "cardList" }, "MC10 p. 5"),
    field.shared("delayCounters", "Number of delay counters on main scheme", { kind: "number" }, "MC10 p. 7"),
    field.shared("engagedWithEnemy", "Players engaged with minions", { kind: "cardList" }, "MC10 p. 12"),
  ],
  loss: { retry: "free", retryBaseline: "nodeStart" },
  graph: linear([
    node(
      "crossbones",
      "Scenario #1 – Crossbones",
      { scenarioId: "crossbones" },
      {
        setup: [],
        victory: [
          record(
            "mc10.s1.v.experimental",
            "Record the name of each EXPERIMENTAL attachment that entered the game in the campaign log.",
            "MC10 p. 5",
            writes.cardList("experimental", fromGame.cardsThatEnteredPlay({ traits: ["experimental"] })),
          ),
          between(
            "mc10.s1.v.tech",
            "Each player chooses one of the TECH upgrades from the Hydra Campaign set and " + "adds it to their deck.",
            "MC10 p. 5",
            [
              op.choose({ slot: "tech", chooser: "eachSeat", from: campaignSet("hydra_camp", { traits: ["tech"] }) }),
              op.grantCard({ seat: "self", card: choice("tech"), permanence: "campaign" }),
              op.setField({ field: "techUpgrade", seat: "self", value: choice("tech") }),
            ],
          ),
          expertCampaignOnly(
            record(
              "mc10.s1.v.hp",
              "Record each identity's remaining hit points in the campaign log.",
              "MC10 p. 5",
              writes.perSeatNumber("remainingHp", fromGame.remainingHitPointsCappedAtBase()),
            ),
          ),
        ],
      },
    ),
    node(
      "absorbing-man",
      "Scenario #2 – Absorbing Man",
      { scenarioId: "absorbing-man" },
      {
        setup: [
          inGame(
            "mc10.s2.s.setup-keyword",
            "Each player searches their deck for all cards with the setup keyword and puts them into play.",
            "MC10 p. 7",
            "afterScenarioSetup",
            [/* EffectSpec[] */],
          ),
          inGame(
            "mc10.s2.s.experimental",
            "Shuffle each EXPERIMENTAL attachment recorded in the campaign log into the encounter deck.",
            "MC10 p. 7",
            "afterScenarioSetup",
            [fx.moveCards({ cards: cards.fromCampaignLog("experimental"), to: "encounterDeckShuffle" })],
          ),
          expertCampaignOnly(
            inGame(
              "mc10.s2.s.hp",
              "Set each player's hit points to their remaining hit point value recorded in the campaign log.",
              "MC10 p. 7",
              "afterScenarioSetup",
              [
                fx.forEachPlayer(
                  fx.setRemainingHitPoints({ target: t.identity, amount: v.campaignLog("remainingHp") }),
                ),
              ],
            ),
          ),
          /* … "may add 1 random obligation from their expert campaign set to heal to full" … */
        ],
        victory: [/* delay counters; Basic Condition upgrade choice; expert HP */],
      },
    ),
    /* taskmaster, zola, red-skull … */
  ]),
});
```

### 6.1 New engine primitives

| Primitive                                | Shape                                                                                            | Needed by                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Read a log field in-game                 | `ValueSpec { kind: "campaignLog" }`                                                              | MC10 p. 15 (delay counters → threat), MC16 p. 18, MC27 p. 15, MC40 p. 16, MC60 p. 17 |
| Test a log field in-game                 | `Predicate { kind: "campaignLog" }`                                                              | MC21 p. 17 ("If Cosmo is in the campaign pool"), MC32 p. 10, MC60 p. 9               |
| Select the cards a log field names       | `CardSelector { kind: "campaignLog"; field; seat?; filter? }` + `TargetQuery.inCampaignLogField` | MC10 p. 7, MC27 p. 22, MC32 p. 10, MC50 p. 19                                        |
| Write a log field from in-game card text | `EffectSpec { kind: "recordInCampaignLog"; field; seat?; mode; value }`                          | MC10 Hydra Campaign upgrades ("remove it from the campaign log → …")                 |
| Remove from the campaign from in-game    | `EffectSpec { kind: "removeFromCampaign"; cards: CardSelector }`                                 | MC10 upgrades, MC32 p. 5, MC60 p. 13                                                 |
| Per-seat scoping of a log read           | `PlayerRef` already suffices (`seat?: PlayerRef`)                                                | MC10 p. 7 (per-seat HP)                                                              |
| Campaign setup windows                   | `GameStep` gains `campaignWindow` (carrying the window) and `scenarioSetup`; `flow.ts` runs them | MC50 p. 4/p. 11, MC60 p. 9                                                           |
| Campaign input on a game                 | `GameSetupConfig.campaign?: CampaignGameInput`, stored in `GameState.campaign`                   | determinism (§7)                                                                     |
| What a game writes back                  | `GameState.campaignWrites?: CampaignInGameWrites` — plain data the runner folds in               | §6.2, §7.2                                                                           |
| Campaign trace events                    | `campaignInstructionResolved`, `campaignLogRead`, `campaignLogWritten`, `campaignCardRemoved`    | rules-qa replay                                                                      |

That is **five effect/value/selector members, two setup-step kinds, two state fields, four events.** Nothing else in
the engine changes shape. Crucially, the engine reads the campaign log only from the frozen `GameState.campaign.log`
snapshot; it never reaches out to storage, so `applyCommand` stays pure and `replay()` stays deterministic.

**As built (step 3), where the sketch above did not survive contact with the interpreter:**

- **Two step kinds, not four.** `{ kind: "campaignWindow"; window }` covers all five windows — five near-identical
  `GameStep` kinds would be five copies of one branch in every switch — and `scenarioSetup` is new: Appendix II
  steps 6–12 had to become a step of its own so `beforeScenarioSetup` can resolve _before_ it and stop for a choice.
  Both exist **only in a campaign game**: `createGame` still runs steps 6–12 inline (`resolveScenarioSetup`, shared
  code, one call site each) when there is no campaign, so a standalone game's state and event stream are unchanged.
  `stepAfterCampaignWindow` switches exhaustively on `CampaignWindow`, so a new window cannot be added without
  being given a place in the flow.
- **`GameState.campaign` and `GameState.campaignWrites` are absent, not null,** outside a campaign, so a standalone
  game's serialized state is byte for byte what it was before campaign mode existed and every save still replays.
- **In-game writes accumulate in `GameState.campaignWrites`** (`CampaignInGameWrites`: the `LogWrite`s and the
  removed `CampaignCardFace`s) rather than being reduced out of the event stream. A game never touches anything
  outside `GameState`; the runner folds them in whatever the outcome, which is what keeps a lost game's writes
  distinguishable from the between-games writes `retryBaseline` rolls back (§6.2, Q6).
- **`campaignLogRead` is emitted for the `CardSelector` read only.** `ValueSpec`/`Predicate` reads happen inside
  `resolveValue`/`evaluate`, which are pure and re-entrant and which legality checks, `preview()` and `why-not.ts`
  call speculatively; emitting there would log reads that never happened and make the event stream depend on which
  questions a client asked. Those reads stay reconstructible instead — the log is frozen in state.
- **The write's value is its own small union**, `CampaignLogValueSpec` (`number` / `flag` / `cardList` / `cardRef` /
  `choice` / `text`), in the engine's _in-game_ vocabulary (`ValueSpec`, `Predicate`, `CardSelector`) rather than
  the between-games `CampaignGameQuery`. A strike is `mode: "strike"` with a `choice` value, exactly as
  `LogWriteSpec` spells it; `strikeList`/`instructionList`/`cardState` are never written in one in-game sentence.
- **`createGame` refuses a campaign whose `seats` do not line up with `players`**, because seat-by-seat alignment is
  what makes a per-seat read addressable (the seat _numbers_ are the log's own — MC10 p. 17).

### 6.2 In-game card text that touches the log

MC10's Hydra Campaign TECH upgrades print "_Setup. Hero Action: Discard this card and remove it from the campaign log →
deal 5 damage …_" (MC10 p. 5 card text). These are ordinary card abilities scripted in `@mc/cards/src/wave2/trors/` —
the 30 refs currently parked in `KNOWN_SKIPPED.trors` (04155–04166). They use the same `removeFromCampaign` primitive a
between-games instruction uses; there is no second path. MC10 p. 12's Q&A defines the semantics: "_cross it out of the
campaign log. That card is no longer part of the campaign and cannot be included in any deck for the remainder of the
campaign_", and RRG p. 29 adds that it survives a retry.

Because a removal made in a _lost_ game still sticks, `removeFromCampaign` effects are folded into the log
**regardless of the game's outcome** (§7). This is the one place where a lost game writes the log in MC10.

As built, the effect is a **log operation only**: it records the face (`CampaignCardFace`, ruling April 30, 2026 (4))
in `GameState.campaignWrites` and does nothing to the card in this game — what happens to the card is whatever the
printed sentence beside it says ("Discard this card **and** remove it from the campaign log"), scripted as its own
effect. Recording the same face twice records it once; a second _face_ of the same card is a separate removal, which
is the point of the ruling.

---

## 7. Game ↔ campaign boundary

```
CampaignLog ──resolveBetweenGames(defn, log, node, modes, choices)──▶ CampaignGameInput  (frozen, plain data)
                                                                        │
                                            createGame({ …, campaign })─┘   ← recorded in GameState + in the save
                                                                        │
                                                    play / save / resume by replaying commands
                                                                        │
                       CampaignGameResult ◀──campaignResultOf(defn, node, finalState, events)──┘
                                                                        │
CampaignLog' ◀──applyCampaignResult(defn, log, node, result, choices)───┘
```

### 7.1 Inputs

```ts
export interface CampaignGameInput {
  readonly campaignId: CampaignId;
  readonly nodeId: string;
  readonly definitionVersion: string;
  readonly modes: PlayModes;
  /** Every log value this game may read, flattened and frozen. Hidden fields are excluded unless read by one. */
  readonly log: CampaignLogView;
  /** Already filtered by mode and by `when`, already in printed order, grouped by window. */
  readonly instructions: readonly ResolvedInstruction[];
  /** Cards removed from the campaign, so nothing can re-enter through a search. By face (`CampaignCardFace`). */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  /** Per seat: the deck list as the campaign composed it, and which of those cards are campaign grants. */
  readonly seats: readonly CampaignSeatInput[];
  /** Seed for anything the *in-game* instructions randomise; drawn from the log's RNG. */
  readonly seed: number;
}

/**
 * As built, this is **not** `CampaignLogSnapshot`. The original sketch used one name for two jobs: restoring a
 * retry (which needs the decks, the RNG and the graph position) and being read in-game (which needs none of them,
 * and which lands in `GameState` and every save). The in-game half is its own, narrower type.
 */
export interface CampaignLogView {
  readonly shared: Readonly<Record<string, LogValue>>;
  readonly perSeat: readonly { readonly seatNumber: number; readonly fields: Readonly<Record<string, LogValue>> }[];
}

/** Declared as built, in the shape `PlayerSetup` consumes — hence the identity and the aspects, which it requires. */
export interface CampaignSeatInput {
  readonly seatNumber: number;
  readonly identityCardId: CardId;
  /** The expanded deck list, grants included. */
  readonly deck: readonly CardId[];
  readonly aspects: readonly CoreAspect[];
  readonly grantedCardIds: readonly CardId[];
}

/** Declared as built: an instruction the runner has already gated and ordered, ready to resolve at its window. */
export interface ResolvedInstruction {
  readonly instructionId: string;
  readonly text: string;
  readonly citation: string;
  readonly window: CampaignWindow;
  readonly effects: readonly EffectSpec[];
}
```

Because `CampaignGameInput` is part of `GameSetupConfig`, it lands in `GameState` and therefore in
`StoredGame.initialState` — the replay baseline. **A saved campaign game replays without consulting the campaign log at
all.** That is the property that keeps replay deterministic while the log keeps evolving underneath.

### 7.2 Outputs

```ts
export interface CampaignGameResult {
  readonly nodeId: string;
  /** As built: `"won" | "lost"`, the same words `CampaignHistoryEntry.outcome` uses — one vocabulary, not two. */
  readonly outcome: "won" | "lost";
  /** Each `record` instruction's computed value, in printed order, with the instruction id that produced it. */
  readonly records: readonly { readonly instructionId: string; readonly write: LogWrite }[];
  /** `removeFromCampaign` effects that resolved in-game. Applied even on a loss (RRG p. 29). By face. */
  readonly removedFromCampaign: readonly CampaignCardFace[];
  /** `recordInCampaignLog` effects that resolved in-game. Applied even on a loss. */
  readonly logWrites: readonly LogWrite[];
  /** Grants with `permanence: "thisGame"`, expiring now (MC32 p. 5's role upgrades). */
  readonly expiringGrants: readonly CardId[];
}
```

`campaignResultOf` is a **derived reducer over the finished state and the event stream**, exactly like
`client/src/engine/game-record.ts` is today — never something the client accumulates and hands back. `fromGame.*` in
the DSL compiles to queries this reducer answers (cards that entered play matching a query, counters on a named card,
remaining hit points capped at base, whether a named scheme is in the victory display, which players are engaged with
an enemy, how many cards of a title are across all player decks).

### 7.3 The runner, as built (step 4)

`packages/engine/src/campaign/` — `log.ts` (the working log and the one place a write happens), `ops.ts` (every
`CampaignValue`, `CampaignPredicate`, `CampaignChoiceSource` and `CampaignOp`, exhaustively, with no `default:`),
`result.ts` (`campaignResultOf`), `runner.ts` (the public API). All of it re-exported from `@mc/engine`.

```ts
createCampaignLog(definition, { id, seats, modes, poolVersion, seed }): CampaignLog
resolveBetweenGames(definition, log, deps, modes?, answers?): CampaignRunnerResult<CampaignLog>
startGameFromLog(definition, log): CampaignGameStart
campaignResultOf(definition, log, finalState, events, engineDeps?): CampaignGameResult
applyCampaignResult(definition, log, result, { at, gameId }, deps, answers?): CampaignRunnerResult<CampaignLog>

type CampaignRunnerResult<T> = { kind: "done"; value: T } | { kind: "pending"; choice: CampaignPendingChoice };
interface CampaignDeps { pool: CardPool; perSeatSetIds?: readonly EncounterSetId[] }
```

**Pending-choice re-entry is re-running.** A step list that reaches a `choose` with no recorded answer returns that
one choice (`{ instructionId, slot, seatNumber, text, citation, chooser, options, count, optional }`) and changes
_nothing_; the caller answers it and calls the same function again with the enlarged answer list, and the list runs
from the top. Nothing partial is ever persisted, so `(log, answers)` is the complete input. One choice at a time,
not all of them, because a later choice's options can depend on an earlier one. The runner's own "which scenario
next?" prompt (MC60 p. 9 step 4) uses the same shape under the reserved instruction id `campaign.nextNode`.

`campaignResultOf` takes the **log** rather than the node the sketch passed: the log's `attempt` is what says which
node was played and under which modes, and `expiringGrants` is a fact about the log's grants that no game state can
tell you. It computes every `record` of the matching branch whose `whenModes` pass, and leaves the `when` predicate
(which reads the _log_) to `applyCampaignResult`.

`applyCampaignResult` is pure `(defn, log, result, meta, deps, answers) → { log } | { pendingChoice }`:

1. On a **loss**, restore the log to `attempt.logBefore` first (`retryBaseline: "nodeStart"`), carrying the current
   `removedFromCampaign` across unrestored.
2. Expire `thisGame` grants — the grants the _finished game_ carried, not ones a victory step is about to make.
3. Apply the game's own `logWrites` and `removedFromCampaign`. They stick whatever the outcome (RRG p. 29; §6.2).
4. On a **win**: run `everyNodeVictory` then the node's `victory`; then mark the node `completed` if no op did, and
   advance `position`. With every node resolved and no `endCampaign` op fired, the campaign ends `won` if every node
   is `completed` and `lost` otherwise.
5. On a **loss**: run the node's `defeat` then `loss.everyNodeDefeat`, but only when `loss.retry === "byInstruction"`;
   then `position.nextNodeId` becomes the node again unless a defeat op resolved it.
6. Append the history entry (`attempt.steps` ++ this run's steps) and clear `attempt`.

### 7.4 Readings the runner had to make, flagged rather than silently chosen

| Question                                                                 | What step 4 does                                                                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does `logBefore` sit for a `choice` graph?                         | Before `beforeChoice`, so a retry re-runs the progression draw from the restored RNG and reproduces it exactly. The alternative (after it) double-counts a progression.    |
| `seat: "self"` on an op with no `forEachSeat` around it                  | Runs once per seat, each with its own slot values — "Each player chooses … and adds it to their deck" (MC10 p. 5) is one instruction, not a loop.                          |
| `seat: "self"` on a _predicate_, with no seat scope                      | "any seat satisfies it", because the gates printed that way read "If a player has …".                                                                                      |
| `CampaignChoiceSource.excludeGranted`                                    | **Group-wide**: the physical card is taken. MC16 p. 5 prints exactly that for its Market. No box prints the per-seat reading.                                              |
| `fieldAtLeast` on a list field (the between-games predicate has no `of`) | Counts the entries; a `number`/`flag` field reads its value. The in-game `Predicate` keeps its explicit `of: "count"`.                                                     |
| Where `conditionalInstructions` land in a node's setup                   | After `everyNodeSetup`, before the node's own, shared fields then seat fields, **each id once**. MC27 p. 22 does not say, and resolving one twice would double it.         |
| A `hidden` field declared `perSeat`                                      | Reads and writes as shared, because `CampaignLog.hidden` is one flat map. No rulebook prints a per-seat secret.                                                            |
| `LogFieldType` `cardState`                                               | **Cannot be written.** Neither `CampaignGameQuery` nor `CampaignValue` can compose counters-plus-face, so a write to one throws instead of guessing. A real gap — see Q11. |

---

## 8. Deck rules in campaign context

`validateDeck(deck, pool)` gains an optional third argument. Its existing behaviour with no context is unchanged, so no
current caller moves. **Built in step 5** (`packages/engine/src/deck.ts`); the sketch's single `forbiddenCardIds` is
split, because the design's own table below wants two different problem codes for the two different rules, and
because a removal is by _face_:

```ts
export interface DeckContext {
  readonly campaign?: CampaignDeckContext;
}

export interface CampaignDeckContext {
  readonly campaignId: string;
  /** `Campaign.campaignSetIds` + `perSeatSetIds` — which campaign-specific cards are legal here (RRG p. 11). */
  readonly campaignSetIds: readonly string[];
  /** MC10 p. 3: identity locked for the campaign. */
  readonly identityCardId: string;
  /** One entry per granted *copy*: legal here, and exempt from min/max deck size (MC10 p. 3). */
  readonly grantedCardIds: readonly string[];
  /** RRG p. 29 removals, **by face** (ruling April 30, 2026 (4)): only a front-face removal refuses a deck line. */
  readonly removedFromCampaign?: readonly CampaignCardFace[];
  /** The box's own prohibitions *inside* its campaign (MC27 p. 4; MC40 p. 6) — a different rule, a different code. */
  readonly prohibitedCardIds?: readonly string[];
  readonly prohibitedEncounterSetIds?: readonly string[];
  /** MC16 p. 5 (mandatory) / MC27 p. 6 (optional): aspect and basic cards frozen after scenario 1. */
  readonly frozenNonCampaignCards?: readonly DeckCardEntry[];
}
```

Changes to the existing checks in `packages/engine/src/deck.ts`:

| Today                                                                           | In campaign context                                                                                                                                                                       |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaign_card` (line ~416) refuses every `specificTo.kind === "campaign"` card | refuses only if there is no campaign context, or the card's set is not in `campaignSetIds`, or its id is not in `grantedCardIds`. New code `campaign_card_not_granted` for the last case. |
| granted cards `continue` before `counted += …`                                  | unchanged — this is already the RRG-correct exemption (MC10 p. 3)                                                                                                                         |
| `linked_card`                                                                   | **unchanged and absolute**, in campaign context too (ruling August 3, 2026 (4) answer 3)                                                                                                  |
| `scenario_card`, `competitive_card`                                             | unchanged                                                                                                                                                                                 |
| identity choice                                                                 | new `campaign_identity_locked` when `deck.identityCardId !== context.identityCardId`                                                                                                      |
| —                                                                               | new `campaign_removed_card` (RRG p. 29) and `campaign_prohibited_card` (MC27 p. 4 / MC40 p. 6)                                                                                            |
| —                                                                               | new `campaign_deck_frozen` when a non-granted line differs from `frozenNonCampaignCards`                                                                                                  |
| copy limit                                                                      | granted cards are excluded from the by-title copy count, consistent with the deck-size exemption. **Flagged** — see Open question Q8.                                                     |

**The Q8 decision point** is the exported constant `CAMPAIGN_GRANTS_COUNT_TOWARD_COPY_LIMIT` in
`packages/engine/src/deck.ts`, set to `false` (the recommendation above), with the open question in its doc comment.
Flipping that one constant is the whole change. MC10 never reaches it: its grants are campaign-specific cards, which
never get as far as the copy-limit check.

Two further notes from building it. A **legal** campaign-specific card short-circuits the rest of the line checks
exactly as the refused one always did, so it is not counted toward deck size and the copy limit does not reach it —
the change is only _whether a problem is reported_. And the **freeze** compares only the copies the player chose:
granted copies are subtracted from both sides, so a frozen deck still lets the campaign keep adding its own cards.

And in `packages/content/src/schema/validation.ts`, `validateScenarioEncounterSets` gains an optional
`ScenarioModeContext` (`{ campaignId?: CampaignId; campaignSetIds?: readonly EncounterSetId[] }`): a campaign-specific
set is legal iff the scenario is being validated as part of a campaign _and_ the set is one of that campaign's own —
RRG p. 11's set-icon test, expressed as list membership until `Campaign.campaignSetIds` lands in step 6. The
standalone refusal now states the rule ("a campaign-specific set can only be used during a campaign from the same
product") instead of "campaign mode is not built"; the `competitiveOnly` refusal is unchanged, because competitive
mode really is not built.

---

## 9. Registration and extensibility

### 9.1 Adding box N+1 — the complete file list

| #   | File                                            | Owner                        | Change                                       |
| --- | ----------------------------------------------- | ---------------------------- | -------------------------------------------- |
| 1   | `packages/content/src/data/<pack>/campaign.ts`  | `card-data-pipeline`         | the `Campaign` record; any missing card data |
| 2   | `packages/content/src/data/index.ts`            | `card-data-pipeline`         | one export line                              |
| 3   | `packages/cards/src/campaigns/<code>.ts`        | `ability-scripting-engineer` | the `CampaignDefinition`                     |
| 4   | `packages/cards/src/campaigns/index.ts`         | `ability-scripting-engineer` | one entry in `CAMPAIGNS`                     |
| 5   | `packages/cards/src/campaigns/coverage.test.ts` | `ability-scripting-engineer` | one row in `CAMPAIGN_STATUS`                 |
| 6   | `packages/cards/src/campaigns/<code>.test.ts`   | `rules-qa-engineer`          | the box's ruling-tied scenarios              |

**No engine file. No client file.** Files 2, 4 and 5 are the only shared ones, one line each.

### 9.2 Adding one new campaign card

1. `packages/content/src/data/<pack>/cards.ts` — the record, with `specificTo: { kind: "campaign", encounterSetId }`.
2. `packages/cards/src/<pack>/campaign-cards.ts` — its ability script (an ordinary card script).
3. If a `choose` op must offer it: it is already offered, because `campaignSet(setId)` enumerates the set. Only an
   explicit `cards([...])` source would need the id added.

### 9.3 Coverage test

`packages/cards/src/campaigns/coverage.test.ts`, in the style of `wave2/coverage.test.ts` (exact-match pinning, no
passing by omission). It fails when a box's definition references something that does not resolve:

- `CAMPAIGN_STATUS` covers exactly the campaigns `@mc/content` exports (a new box cannot be silently unchecked).
- Every `CampaignNode.scenario.scenarioId` resolves in `@mc/content`'s scenarios and belongs to the box's pack.
- Every `CampaignOp`/`CampaignValue`/`CampaignPredicate` `field` is declared in `logFields`, with the right
  `LogFieldType` for the op (`strike` needs a `strikeList`, `spend` needs a `number`, …).
- Every `LogFieldDef` is read or written by at least one instruction — dead fields are a bug. `KNOWN_UNUSED` escape for
  `{ kind: "text" }` fields only.
- Every card id named by an instruction is in `POOL`, and if `specificTo.kind === "campaign"` its set is in the box's
  `campaignSetIds`.
- Every `inGame` instruction's `EffectSpec[]` passes the DSL validator, and every ability id it references resolves in
  `PLAYABLE_ABILITIES`.
- Every `instructionList` field's option ids resolve in `conditionalInstructions`.
- Every `citation` matches `/^MC\d{2} p\. \d+$/`; every instruction id is unique within the box and prefixed with it.
- `LossPolicy` is present.
- The graph is well-formed: node ids unique, `finale.nodeId` exists, a `linear` graph is fully connected.

---

## 10. Persistence and client surface

### 10.1 Storage

A **third IndexedDB database, `mc-campaigns`**, separate from `mc-saves` and `mc-decks` for the reason
`deck-storage.ts` already documents: a campaign write must never be able to break a game resume, and the cheapest
guarantee is never opening the same database.

```ts
export interface CampaignStorage {
  create(log: CampaignLog): Promise<void>;
  /** Whole-log write. A campaign step is small and must be atomic; there is no append-log equivalent here. */
  put(log: CampaignLog): Promise<void>;
  load(id: string): Promise<CampaignLog | null>;
  list(): Promise<readonly CampaignSummary[]>;
  setStatus(id: string, status: CampaignLog["status"]): Promise<void>;
}
```

Two implementations sharing one contract test (`MemoryCampaignStorage`, `IdbCampaignStorage`), exactly as
`game-storage.test.ts` does today.

`SaveMeta` (`client/src/engine/game-storage.ts`) gains `campaignId: string | null` and `campaignNodeId: string | null`,
so the campaign browser can link to the played game and the game-over screen knows it must return to the campaign.
`SessionConfig` gains `campaign?: CampaignGameInput`. `SAVE_SCHEMA` bumps to 4.

### 10.2 View models (plain TS, Vitest; no scene design here)

| Model                               | Shows                                                                                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `campaign-list-model.ts`            | one row per campaign: box name, modes, position ("Scenario 3 of 5" / "2 of 5 completed"), seats, status, last played; the Continue / Abandon affordances                                            |
| `campaign-log-model.ts`             | the printed sheet: shared boxes and per-seat columns, each field with its `label`, `citation` and rendered value. `hidden` fields render as "not yet known" and the value is never in the model.    |
| `campaign-step-model.ts`            | the between-games step list: each resolved instruction's printed `text` + `citation` + what it did, and the pending `choose` prompts with their option lists                                        |
| `campaign-deck-edit-model.ts`       | wraps `validateDeck(deck, pool, { campaign })`; grants render as locked rows marked "added by the campaign — does not count toward deck size"; frozen decks disable editing with the printed reason |
| `campaign-scenario-choice-model.ts` | `kind: "choice"` graphs only (MC60): the available nodes, each node's progress marks, the villain choice, and the Completed/Failed environments already in play                                     |

---

## 11. Implementation plan

Ordered, each step independently verifiable. C1 and MC10's C2 are built together, as PLAN.md's sequencing says.

| #   | Step                                                                                                                                                                                                                                                                                                                                                              | Owner                        | Verified by                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `PlayModes`, `ModePredicate`, `difficultyOf`/`modesOf`; migrate `cards/*/setup.ts` and `SessionConfig`                                                                                                                                                                                                                                                            | `game-rules-architect`       | full suite green; unit tests on the projection and on the "difficulty and modes disagree" throw                                                                |
| 2   | `packages/engine/src/campaign.ts`: every type in §4–§5 and §7. **No behaviour.**                                                                                                                                                                                                                                                                                  | `game-rules-architect`       | `pnpm typecheck`; a synthetic two-node fixture campaign in `engine/src/testing/`                                                                               |
| 3   | **Landed.** Engine primitives: the `campaignLog` value/predicate/selector, `TargetQuery.inCampaignLogField`, `recordInCampaignLog`, `removeFromCampaign`, `GameSetupConfig.campaign` frozen into `GameState`, the five setup windows, the four trace events                                                                                                       | `game-rules-architect`       | `campaign-primitives.test.ts` against the synthetic campaign — no real box named                                                                               |
| 4   | **Landed.** The runner (§7.3): `resolveBetweenGames`, `startGameFromLog`, `campaignResultOf`, `applyCampaignResult`, `createCampaignLog`, seeded campaign RNG, pending-choice re-entry                                                                                                                                                                            | `game-rules-architect`       | `campaign/runner.test.ts`: the synthetic campaign played end to end, a loss, a retry, a `removeFromCampaign` surviving it, seed determinism, a JSON round trip |
| 5   | **Landed.** `validateDeck` `DeckContext`, five new problem codes, the campaign-specific refusals made conditional                                                                                                                                                                                                                                                 | `game-rules-architect`       | `deck.test.ts`: campaign card legal inside its campaign and illegal outside; removed card refused; identity lock; frozen deck; granted cards exempt from size  |
| 6   | Content: `Campaign` record fields; emit records for all ten boxes; confirm MC50/MC56/MC60 campaign-card counts against their rulebooks (PLAN.md §C2 open item); correct the MC56 row                                                                                                                                                                              | `card-data-pipeline`         | `validateCampaign`; a test that every box's campaign sets are `campaignSpecific`                                                                               |
| 7   | `packages/cards/src/campaigns/trors.ts` — MC10's five nodes, every instruction cited `MC10 p. N`                                                                                                                                                                                                                                                                  | `ability-scripting-engineer` | the §9.3 coverage test                                                                                                                                         |
| 8   | MC10's 30 parked refs (04155–04166): the four TECH upgrades, the four Condition upgrades (both faces), the four Expert Campaign obligations; `KNOWN_SKIPPED.trors` → `[]`                                                                                                                                                                                         | `ability-scripting-engineer` | `wave2/coverage.test.ts`                                                                                                                                       |
| 9   | QA scenarios: full standard campaign; full expert campaign (persistent damage MC10 p. 17, obligations in decks, engaged-with-enemy record p. 12, delay counters → starting threat p. 15); a lost-and-retried scenario proving the log survives; Hydra Prison allies proving removal sticks across the retry; a Vibranium Arrow in-game log write surviving a loss | `rules-qa-engineer`          | named per-page tests                                                                                                                                           |
| 10  | `CampaignStorage` + `IdbCampaignStorage` + shared contract test; `SaveMeta.campaignId`; `SAVE_SCHEMA` → 4                                                                                                                                                                                                                                                         | `game-client-engineer`       | the contract test, both implementations                                                                                                                        |
| 11  | The five view models in §10.2                                                                                                                                                                                                                                                                                                                                     | `game-client-engineer`       | Vitest unit tests; scenes are a separate brief                                                                                                                 |
| 12  | **Acceptance gate for "content-only": write MC21's definition against the frozen foundation.** MC21 is the cheapest second box (campaign pool of flags, no currency, no track). If it needs _any_ change in `packages/engine` or `packages/client`, the foundation is wrong and steps 2–4 are revised before more boxes land.                                     | `ability-scripting-engineer` | a `git diff --stat` touching only `packages/content` and `packages/cards`                                                                                      |

---

## 12. Open questions

Each needs the user's decision. My recommendation is stated; none is resolved silently.

**Q1. Is expert campaign independent of expert mode?**
RRG 1.8 p. 29 lists them separately and says campaign mode "_can also be combined with expert mode_". Every rulebook
prints `Expert Campaign Only` instructions separately from "_Remove X (I) and add X (III) for expert mode_". But MC16
p. 8's campaign setup instruction says "_Reveal the Badoon Blitz side scheme (use the reverse side for expert mode)_" —
a _campaign_ instruction reading the _expert mode_ flag. So both flags exist and instructions read either.
**Recommendation:** model them as two independent flags (`modes.expert`, `modes.campaign.expertCampaign`), let
`ModePredicate` gate on either, and have the client default to setting both together with a one-line note. Flag to FFG.

**Q2. PLAN.md §C3 lists Civil War (MC56) as a campaign box with 2 scenarios; it has no campaign mode.**
MC56 p. 3: "_the Civil War expansion does not include five interconnected scenarios and a campaign mode_". It is a
custom-scenario + competitive expansion, and its "2 scenarios" are four preconstructed scenarios plus a builder.
**Recommendation:** remove MC56 from the campaign table; its competitive mode is a separate capability with its own
`competitiveOnly` refusal already in the code. Needs sign-off because it edits the roadmap.

**Q3. Do we build MC60's `kind: "choice"` graph and the `beforeScenarioSetup` / `beforePlayerSetup` windows now?**
MC10 uses neither. Retrofitting them later means changing `CampaignGraph` (a type every box's definition is written
against) and `GameStep` (which `flow.ts` switches on) — precisely the engine change the requirement forbids.
**Recommendation: yes, build both in steps 2–3.** The cost is two union members and two step kinds; the cost of not
doing it is a foundation rewrite when MC60 lands.

**Q4. MC50's hidden evidence in local storage.**
Three cards are drawn at random and never revealed (MC50 p. 5). Single-player local IndexedDB means a determined player
can read them — as they can peek in the paper envelope. **Recommendation:** store the value in `CampaignLog.hidden`,
exclude it from every view model, and accept the same honour system the paper game uses. The alternative (derive it
from a hash of the campaign seed, storing nothing) breaks when the card pool changes under the campaign and would
silently change the mole. Confirm which.

**Q5. Where does a campaign seat's deck live?**
If a seat points at a `DeckId` in `mc-decks`, editing that deck outside the campaign silently changes the campaign's
next scenario. **Recommendation:** the campaign owns a _copy_ (`CampaignSeat.deck: DeckContents`), and the between-
scenario deck-edit step edits the campaign's copy; `history[n].logBefore` keeps the copy as it stood, so a retry
replays the deck the lost game used. The standalone deck in `mc-decks` is the _starting point_ only.

**Q6. Retry baseline.**
MC40 p. 7 is the sharpest case: on a retry "_they must choose the same player side scheme … and defeat it in order to
earn its reward, even if they defeated it during a game they lost_". MC16 p. 5's spent units are not refunded, because
they were spent between scenarios (before the node), not during it. **Recommendation:** `retryBaseline: "nodeStart"` —
restore the log to its state when the node's instructions began, keeping only `removeFromCampaign`, in-game
`recordInCampaignLog` writes, and `defeat` instruction writes. Confirm this reading of MC40 p. 7.

**Q7. Where exactly does "after normal setup" sit in RRG Appendix II?** _(Still open; built as recommended.)_
MC10 p. 3 says only "_set up the scenario as per the normal rules of the game. Then, follow that scenario's setup
instructions_". MC50 p. 4 pins the same sentence to "_before players draw their starting hands_". MC10 p. 7's own
setup-keyword instruction is incoherent after the draw. Ruling June 2, 2026 (3) answer 2 says "_Campaign setup finishes
before resolving Collector II's When Revealed damage_", which would put campaign setup _before_ Appendix II step 12 for
MC16 — **this conflicts with MC10 p. 3's "then"**. **Recommendation:** default `afterScenarioSetup` = after Appendix II
step 12, before step **14** (the draw; the sketch said 13, miscounting), and let MC16's definition override the two
affected instructions to `beforeScenarioSetup` with the ruling cited in a comment. Flagged, not silently resolved —
and the reason `beforeScenarioSetup` is built now rather than when MC16 lands: the override has to be available to a
definition without an engine change.

**Q11. A `cardState` log field has no way to be written.** _(Found building step 4.)_
MC50 p. 6's Board Members carry counters **and a face** across scenarios, and `LogValue` has the storage shape for
it — but neither `CampaignGameQuery` (the `record` half) nor `CampaignValue` (the between-games half) can compose
"these counters on this card, on this face". Step 4 **throws** on a write to a `cardState` field rather than guess.
**Recommendation:** add one `CampaignGameQuery` member, `{ kind: "cardStateOf"; cards: readonly CardId[] }`, reading
each named card's counters and current face out of the finished game, when MC50 is scheduled. Not needed for MC10.

**Q8. Do campaign grants count toward the three-copy limit?**
MC27 p. 22's Aspect Advantage adds "_the maximum number of copies of that card, by title_" and says they do not count
toward deck size — but says nothing about the copy limit if the deck already holds copies. RRG Appendix I is silent.
**Recommendation:** exclude grants from the by-title copy count, consistent with the deck-size exemption, and flag to
FFG. Not needed for MC10; needed before MC27.

**Q9. Skirmish mode and `VillainStageRange`.**
RRG p. 29's skirmish mode picks "_any one version of the villain_" and removes the rest. `Scenario.villainStages`
(keyed `standard`/`expert`) cannot express it. Out of scope now. **Recommendation:** `PlayModes.skirmish` carries the
chosen version so that when skirmish is built the change lands in the setup builder, not in the scenario record. No
action needed in C1 beyond keeping the field typed.

**Q10 (informational, not a decision).** Three keyword definitions drifted across these rulebooks and the foundation
does not touch them, but `rules-qa-engineer` should track them: **Permanent** (MC10 p. 2 "cannot leave play" → MC32
p. 3 / MC45 p. 3 "cannot be defeated, leave play, or have any part of its text box blanked, except by card abilities in
the same set"), **Villainous** (MC60 p. 3 rewritten around "uses a basic power", so allies and heroes can have it), and
**Vulnerable** (MC50 p. 3 → MC60 p. 3 adds a first-player tie-break for simultaneous defeat). MC45 p. 3 also relaxes
**Teamwork** from "each minion that shares the keyword activates" (MC32 p. 3) to "the minion that just entered play
activates" — a genuine behavioural change to an implemented keyword.
