/**
 * The Galaxy's Most Wanted, Balanced (issue #609): an opt-in house rule that rebalances the campaign. It is not an
 * RRG or rulebook mode, so every citation here is "Balanced house rule, issue #609, Gideon's Gaming".
 *
 * **Normal play is untouched.** Every change is gated on the hidden shared log flag `balanced` (and the toggles on
 * their own flags), set only when the run starts (`gmwBalancedHiddenFields` -> `CampaignLogSetup.hiddenFields`), and
 * the campaign's `ModePredicate.balanced` (`CampaignModeRef.balanced`) for the between-games instructions. With both
 * off no flag is ever written, and each gate reads false.
 *
 * **Where a hidden field is read.** `logViewFor` hands a hidden field to the game only when the node's own
 * instructions or `scenarioRuleSpecs` read it; a card script's read is not scanned. Each node whose card scripts read
 * a flag therefore also names it in a rule of its own (`readsFlags`), and `gmw-balanced.test.ts` proves each read
 * works in a real game, since a miss would silently read false.
 */

import { abilityId, cardId, encounterSetId } from "@mc/content";
import {
  DEFAULT_CAMPAIGN_WINDOW,
  type CampaignInstruction,
  type CampaignOp,
  type CampaignPredicate,
  type LogFieldDef,
  type LogValue,
  type Predicate,
  type RuleSpec,
} from "@mc/engine";
import {
  allOf,
  campaignLogIsSet,
  exists,
  named,
  perHero,
  query,
  valueEquals,
  encounterSetAside,
  moveCards,
  encounterCards,
  campaignLogCards,
  putIntoPlay,
  firstPlayer,
  attachCard,
  chosen,
  selectCards,
} from "../dsl/index.js";

const CITATION = "Balanced house rule, issue #609, Gideon's Gaming";

// --- the log fields ------------------------------------------------------------------------------------------
export const GMW_BALANCED_FIELD = "balanced";
export const BALANCED_MODS_FIELD = "balancedMods";

export type GmwBalancedToggleId = "spacePirates" | "expertGallery" | "trimStandard" | "milanoExhausted";

export interface GmwBalancedToggle {
  readonly id: GmwBalancedToggleId;
  /** The hidden shared flag log field this toggle sets. */
  readonly field: string;
  /** Short name for the run-start prompt. */
  readonly label: string;
  /** One sentence for the prompt. */
  readonly description: string;
  /** The scenario (campaign node id) the toggle changes. */
  readonly nodeId: string;
}

/** The four optional toggles, each off by default and only meaningful with `balanced`. For the client's run-start prompt. */
export const GMW_BALANCED_TOGGLES: readonly GmwBalancedToggle[] = [
  {
    id: "spacePirates",
    field: "balancedSpacePirates",
    label: "Space Pirates in the Museum",
    description: "Their removals go to The Collection instead.",
    nodeId: "infiltrate-the-museum",
  },
  {
    id: "expertGallery",
    field: "balancedExpertGallery",
    label: "Expert Gallery of Splendor in the Museum deck",
    description: "For 3 or more players in standard mode: the harder Gallery of Splendor goes into the deck.",
    nodeId: "infiltrate-the-museum",
  },
  {
    id: "trimStandard",
    field: "balancedTrimStandard",
    label: "Trim the Museum's Standard set",
    description: "Only Shadow of the Past stays, for a leaner deck.",
    nodeId: "infiltrate-the-museum",
  },
  {
    id: "milanoExhausted",
    field: "balancedMilanoExhausted",
    label: "Milano Mods can't be used while the Milano is exhausted",
    description: "You have to keep the ship ready to use its upgrades.",
    nodeId: "ronan-the-accuser",
  },
];

/**
 * `CampaignLogSetup.hiddenFields` for a run: nothing when Balanced is off (so the log is byte for byte the one a
 * Normal run makes), otherwise the `balanced` flag and each chosen toggle's flag set to true. A toggle without
 * `enabled` is ignored: every toggle needs Balanced.
 */
export function gmwBalancedHiddenFields(choice: {
  readonly enabled: boolean;
  readonly toggles?: readonly GmwBalancedToggleId[];
}): Readonly<Record<string, LogValue>> {
  if (!choice.enabled) return {};
  const on: LogValue = { kind: "flag", value: true };
  const out: Record<string, LogValue> = { [GMW_BALANCED_FIELD]: on };
  for (const toggle of GMW_BALANCED_TOGGLES) if (choice.toggles?.includes(toggle.id)) out[toggle.field] = on;
  return out;
}

const hiddenFlag = (id: string, label: string): LogFieldDef => ({
  id,
  label,
  scope: "shared",
  type: { kind: "flag" },
  hidden: true,
  citation: CITATION,
});

/** Declared on `GMW_CAMPAIGN_DEFINITION.logFields`. All hidden: a fresh Normal log never carries one. */
export const GMW_BALANCED_LOG_FIELDS: readonly LogFieldDef[] = [
  hiddenFlag(GMW_BALANCED_FIELD, "Balanced house rule"),
  ...GMW_BALANCED_TOGGLES.map((toggle) => hiddenFlag(toggle.field, `Balanced toggle: ${toggle.label}`)),
  {
    id: BALANCED_MODS_FIELD,
    label: "Balanced: free Milano Mods",
    scope: "shared",
    type: { kind: "cardList" },
    hidden: true,
    citation: CITATION,
  },
];

// --- in-game predicates and rules -----------------------------------------------------------------------------
export const isBalanced: Predicate = campaignLogIsSet(GMW_BALANCED_FIELD);
export const toggleIsOn = (id: GmwBalancedToggleId): Predicate =>
  allOf(isBalanced, campaignLogIsSet(toggleOf(id).field));
const toggleOf = (id: GmwBalancedToggleId): GmwBalancedToggle => {
  const found = GMW_BALANCED_TOGGLES.find((toggle) => toggle.id === id);
  if (!found) throw new Error(`no Balanced toggle ${id}`);
  return found;
};

/**
 * An inert rule whose only job is to name log fields in its `while`, so `logViewFor` hands them to the game for the
 * card scripts that read them. It adds 0 to a main scheme's acceleration while all the flags are set.
 */
export const readsFlags = (schemeCardId: string, fields: readonly string[]): RuleSpec => ({
  kind: "mainSchemeValue",
  field: "acceleration",
  stage: { cardId: cardId(schemeCardId) },
  amount: 0,
  while: allOf(...fields.map((field) => campaignLogIsSet(field))),
});

/** Infiltrate the Museum's main scheme, The Grand Collection (16073a), and what its card scripts read. */
export const MUSEUM_BALANCED_RULES: readonly RuleSpec[] = [
  readsFlags("16073a", [GMW_BALANCED_FIELD, toggleOf("spacePirates").field]),
];

/** Nebula's Ship's added Forced Response (registry-only, `nebula.ts`). */
export const NEBULAS_SHIP_GUARD_ABILITY = "16093.balanced-evasion-guard";

/** Nebula: the ship's added ability, a lower solo target, and the flags the Space Pirates scripts read. */
export const NEBULA_BALANCED_RULES: readonly RuleSpec[] = [
  {
    kind: "gainsAbility",
    abilityId: abilityId(NEBULAS_SHIP_GUARD_ABILITY),
    to: query("environment", { name: "Nebula's Ship" }),
    while: isBalanced,
  },
  {
    kind: "mainSchemeValue",
    field: "targetThreat",
    stage: { cardId: cardId("16091a"), stageNumber: 1 },
    amount: 6,
    while: allOf(isBalanced, valueEquals(perHero(1), 1)),
  },
  // Space Pirates is not part of this scenario's changes, but its scripts read the toggle here as well, and the
  // Collection check keeps Nebula's printed text (`nebula.ts`'s `PIRATES_TO_COLLECTION`).
  readsFlags("16091a", [GMW_BALANCED_FIELD, toggleOf("spacePirates").field]),
];

/** Ronan: acceleration down 1 per hero and starting threat 0 on both stages, and the Milano toggle. */
export const RONAN_BALANCED_RULES: readonly RuleSpec[] = [
  {
    kind: "mainSchemeValue",
    field: "acceleration",
    stage: { cardId: cardId("16106a") },
    amount: perHero(-1),
    while: isBalanced,
  },
  {
    kind: "mainSchemeValue",
    field: "startingThreat",
    stage: { cardId: cardId("16106a") },
    amount: 0,
    setBase: true,
    while: isBalanced,
  },
  {
    kind: "blankTextBox",
    target: query("upgrade", { host: named("Milano") }),
    while: allOf(toggleIsOn("milanoExhausted"), exists(query("support", { name: "Milano", exhausted: true }))),
  },
  readsFlags("16106a", [GMW_BALANCED_FIELD, toggleOf("milanoExhausted").field]),
];

// --- between-games and setup instructions ---------------------------------------------------------------------
const fieldOn = (field: string): CampaignPredicate => ({ kind: "fieldIsSet", field });

const THE_MARKET = encounterSetId("the_market");
const SPACE_PIRATES = encounterSetId("space_pirates");
const GALLERY_OF_SPLENDOR_EXPERT = cardId("16179b");
/** Core's Standard set (01186-01190) less Shadow of the Past (01190), which Infiltrate the Museum keeps. */
const STANDARD_SET_TRIMMED = ["01186", "01187", "01188", "01189"].map(cardId);

/** Museum composition: Space Pirates into the encounter deck (default `into: "deck"`), on top of the printed modular. */
export const spacePiratesComposition: CampaignInstruction = {
  id: "mc16.s2.composition.balanced-space-pirates",
  text: "(Balanced house rule: add the Space Pirates encounter set to the encounter deck.)",
  citation: CITATION,
  whenModes: { balanced: true },
  when: fieldOn(toggleOf("spacePirates").field),
  step: {
    kind: "betweenGames",
    ops: [{ kind: "composeEncounterSets", sets: [{ kind: "const", value: SPACE_PIRATES }] }],
  },
};

/** Museum setup: at 3+ players in standard mode, shuffle the expert Gallery of Splendor face into the deck. */
export const expertGallerySetup: CampaignInstruction = {
  id: "mc16.s2.setup.balanced-expert-gallery",
  text: "(Balanced house rule: with 3 or more players in standard mode, shuffle the expert face of Gallery of Splendor into the encounter deck.)",
  citation: CITATION,
  // Expert mode already reveals this face, so the rule is a no-op there.
  whenModes: { balanced: true, expert: false },
  when: {
    kind: "and",
    of: [
      fieldOn(toggleOf("expertGallery").field),
      { kind: "valueAtLeast", value: { kind: "seatCount" }, amount: { kind: "const", value: 3 } },
    ],
  },
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      moveCards(encounterSetAside(query([], { printedId: GALLERY_OF_SPLENDOR_EXPERT })), "encounterDeckShuffle"),
    ],
  },
};

/** Museum setup: take the Standard set's cards out of the encounter deck, but Shadow of the Past. */
export const trimStandardSetup: CampaignInstruction = {
  id: "mc16.s2.setup.balanced-trim-standard",
  text: "(Balanced house rule: remove the Standard encounter set from the encounter deck, except Shadow of the Past.)",
  citation: CITATION,
  whenModes: { balanced: true },
  when: fieldOn(toggleOf("trimStandard").field),
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: STANDARD_SET_TRIMMED.map((printedId) =>
      moveCards(encounterCards(["deck"], query([], { printedId })), "removedFromGame"),
    ),
  },
};

/** Ronan: the Free Milano Mods, one unit cost 6 and two different unit cost 4, from what no player has bought. */
export const MILANO_MOD_PICKS = [
  { slot: "balanced-mod-6", unitCost: 6, notSlot: undefined },
  { slot: "balanced-mod-4a", unitCost: 4, notSlot: undefined },
  { slot: "balanced-mod-4b", unitCost: 4, notSlot: "balanced-mod-4a" },
] as const;

const modsPickOps = (): CampaignOp[] => [
  // A retry of the node re-offers the pick cleanly.
  { kind: "clearField", field: BALANCED_MODS_FIELD },
  ...MILANO_MOD_PICKS.flatMap<CampaignOp>(({ slot, unitCost, notSlot }) => {
    const set = {
      kind: "campaignSet" as const,
      encounterSetId: THE_MARKET,
      // MC16 p. 5: only one copy of each Market card is used in a campaign, so what a player bought is out.
      excludeGranted: true as const,
      filter: { unitCostExactly: unitCost },
    };
    return [
      {
        kind: "choose",
        slot,
        chooser: "group",
        // Optional so a slot with no card left, every card of its cost bought, can be passed rather than stall the run.
        optional: true,
        // The two unit cost 4 picks differ.
        from: notSlot ? { kind: "excludingTitles", from: set, titlesIn: { kind: "choice", slot: notSlot } } : set,
      },
      {
        kind: "if",
        when: { kind: "choiceMade", slot },
        then: [{ kind: "appendToList", field: BALANCED_MODS_FIELD, value: { kind: "choice", slot } }],
      },
    ];
  }),
  // Bring exactly the picked cards into the game, set aside and ownerless (`CampaignOp setAsideCards`): composing the
  // whole Market into the set aside area would park 28 instances for 3 cards.
  { kind: "setAsideCards", cards: [{ kind: "field", field: BALANCED_MODS_FIELD }] },
];

/** Ronan setup, straight after the Market: pick the mods. No unit is spent and no card is granted to a deck. */
export const milanoModsPick: CampaignInstruction = {
  id: "mc16.s5.setup.balanced-mods-pick",
  text: "(Balanced house rule: the first player chooses 1 unit cost 6 and 2 different unit cost 4 Milano Mods from The Market, free, from those no player has bought.)",
  citation: CITATION,
  whenModes: { balanced: true },
  step: { kind: "betweenGames", ops: modsPickOps() },
};

/** Ronan setup: attach each picked mod to the Milano under the first player's control, at no cost. */
export const milanoModsAttach: CampaignInstruction = {
  id: "mc16.s5.setup.balanced-mods-attach",
  text: "(Balanced house rule: attach each Free Milano Mod to the Milano, under the first player's control.)",
  citation: CITATION,
  whenModes: { balanced: true },
  step: {
    kind: "inGame",
    window: DEFAULT_CAMPAIGN_WINDOW,
    effects: [
      selectCards("mods", campaignLogCards(BALANCED_MODS_FIELD)),
      putIntoPlay(chosen("mods"), firstPlayer),
      attachCard(chosen("mods"), named("Milano")),
    ],
  },
};
