/**
 * Rules Reference (docs/phase4-screen-gaps.md §3 "W4"): the glossary filtered to
 * the keywords and statuses actually on the table, with search, the villain
 * phase order, and the scenario's card list.
 *
 * **Filtered to the table, not the whole card pool.** "On the table" means every
 * card instance sitting somewhere a player can see its live keywords right now:
 * every identity, every player's play area, the villain area (villain(s), minions,
 * side schemes, environments) and the main scheme, plus whatever is attached to or
 * boosted onto any of those. A card asleep in a deck or discard pile doesn't widen
 * the glossary just because it's in the pool — RRG p. 12 "Choose (Game Element)"
 * and the client's own `view/visibility.ts` already draw that line for hidden
 * information; this reuses the same idea for "what's relevant right now" rather
 * than a rules-visibility rule.
 *
 * **The three entries `@mc/content`'s glossary leaves out** — "exhausted",
 * "ready", "facedown boost card" — are added here, from the client side, exactly
 * as `schema/glossary.ts`'s own file header calls for: they're genuine RRG 1.8
 * glossary terms (pp. 19, 36, 11 respectively — see `TABLE_STATE_ENTRIES`'s own
 * comment on why the third page differs from the number docs/phase4-screen-gaps.md
 * guessed), but they're runtime instance state (`CardInstance.exhausted`,
 * `CardInstance.boostCards`) that only `@mc/engine` models, not a `@mc/content`
 * schema enum — so `@mc/content` can't own them without depending on the engine,
 * which the dependency direction forbids. These three are always shown (they're
 * true of essentially every game state, not conditional on what's in play), and
 * search filters them exactly like every other entry.
 */
import type { KeywordName } from "@mc/content";
import { GLOSSARY_ENTRIES, glossaryEntry, type GlossaryEntry, type GlossarySource } from "@mc/content";
import {
  getInstance,
  keywordsOf,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type StatusCounts,
} from "@mc/engine";

export interface RulesEntry {
  readonly id: string;
  readonly displayName: string;
  readonly definition: string;
  /** e.g. "RRG 1.8 p. 21", "February 28, 2026 - Ruling 4", joined by " · " when there is more than one. */
  readonly citeLabel: string;
  readonly unverified: boolean;
  readonly conflict?: string;
}

/**
 * The three RRG glossary terms `@mc/content`'s glossary leaves out (see this
 * module's own header). Original paraphrases, not FFG's wording, matching
 * `schema/glossary.ts`'s own convention.
 *
 * Page check: this repo's copy of `mc_rulesreference_v18_compressed.pdf`, cross-checked
 * against its own two-page glossary INDEX (pp. 2-3) — "Exhausted" p. 19, "Ready" p. 36,
 * "Boost, Boost Icon" p. 11. docs/phase4-screen-gaps.md's W4 entry guessed "pp. 19, 36, 47"
 * for the three; 47 is where "Villainous" is cited (a keyword that *uses* a facedown boost
 * card), not where "Boost, Boost Icon" itself is defined — corrected here to p. 11.
 */
const TABLE_STATE_ENTRIES: readonly RulesEntry[] = [
  {
    id: "exhausted",
    displayName: "Exhausted",
    definition: "A card rotated sideways to show it's been used or committed this way can't be exhausted again until something readies it.",
    citeLabel: "RRG 1.8 p. 19",
    unverified: false,
  },
  {
    id: "ready",
    displayName: "Ready",
    definition: "A card's normal, upright state. Readying an exhausted card returns it to this state — unless readying it has its own cost the controller declines to pay, in which case it stays exhausted.",
    citeLabel: "RRG 1.8 p. 36",
    unverified: false,
  },
  {
    id: "facedownBoostCard",
    displayName: "Facedown boost card",
    definition: "Dealt to an enemy from its encounter deck the moment it attacks or schemes (or, for a villainous minion, whenever it uses a basic power), then turned face up one at a time to add its icons to that activation's total.",
    citeLabel: "RRG 1.8 p. 11",
    unverified: false,
  },
];

function citeLabelOf(sources: readonly [GlossarySource, ...GlossarySource[]]): string {
  return sources
    .map((source) => {
      switch (source.kind) {
        case "rrg":
          return `RRG 1.8 p. ${source.page}`;
        case "ruling":
          return source.date;
        case "insert-not-in-repo":
          return `${source.product} (not in this repo)`;
      }
    })
    .join(" · ");
}

function toRulesEntry(entry: GlossaryEntry): RulesEntry {
  return {
    id: entry.id,
    displayName: entry.displayName,
    definition: entry.definition,
    citeLabel: citeLabelOf(entry.sources),
    unverified: entry.unverified ?? false,
    ...(entry.conflict ? { conflict: entry.conflict } : {}),
  };
}

/** Every keyword name currently live on some instance "on the table" — see the module header for what that means. */
function keywordNamesOnTable(state: GameState, deps: EngineDeps): ReadonlySet<KeywordName> {
  const names = new Set<KeywordName>();
  for (const id of tableInstanceIds(state)) {
    for (const keyword of keywordsOf(state, id, deps)) names.add(keyword.name);
  }
  return names;
}

/** Every status name currently held by some instance "on the table". */
function statusNamesOnTable(state: GameState): ReadonlySet<keyof StatusCounts> {
  const names = new Set<keyof StatusCounts>();
  for (const id of tableInstanceIds(state)) {
    const instance = getInstance(state, id);
    if (!instance) continue;
    for (const status of ["stunned", "confused", "tough"] as const) {
      if (instance.statuses[status] > 0) names.add(status);
    }
  }
  return names;
}

/** Every instance id "on the table" right now: identities, play areas, the villain area, the main scheme, and whatever is attached to or boosted onto any of those. */
function tableInstanceIds(state: GameState): readonly InstanceId[] {
  const seats = state.players.flatMap((player) => [player.identity.instanceId, ...player.playArea]);
  const base = [...seats, ...state.villainArea, state.mainScheme.instanceId];
  const withHosted = new Set<InstanceId>(base);
  for (const id of base) {
    const instance = getInstance(state, id);
    if (!instance) continue;
    for (const attached of instance.attachments) withHosted.add(attached);
    for (const boost of instance.boostCards) withHosted.add(boost);
  }
  return [...withHosted];
}

const normalize = (text: string): string => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * The glossary panel's own model: every entry relevant to the current table,
 * filtered by `query` (case- and accent-insensitive substring match over the
 * term and its definition — empty matches everything).
 */
export function rulesGlossaryOf(state: GameState, deps: EngineDeps, query = ""): readonly RulesEntry[] {
  const keywordIds = keywordNamesOnTable(state, deps);
  const statusIds = statusNamesOnTable(state);
  const entries: RulesEntry[] = [];
  for (const name of keywordIds) {
    const entry = glossaryEntry(name);
    if (entry) entries.push(toRulesEntry(entry));
  }
  for (const status of statusIds) {
    const entry = glossaryEntry(status);
    if (entry) entries.push(toRulesEntry(entry));
  }
  entries.push(...TABLE_STATE_ENTRIES);
  entries.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const needle = normalize(query.trim());
  if (!needle) return entries;
  return entries.filter((entry) => normalize(entry.displayName).includes(needle) || normalize(entry.definition).includes(needle));
}

/** Every glossary entry `@mc/content` and this module know about, for a Rules screen search that isn't scoped to "on the table" (e.g. a general reference search). Not currently used by Pause's own filtered view, but kept small and exported for the day a "search everything" mode is wanted. */
export function everyGlossaryEntry(): readonly RulesEntry[] {
  return [...GLOSSARY_ENTRIES.map(toRulesEntry), ...TABLE_STATE_ENTRIES].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface VillainPhaseStep {
  readonly id: "placeThreat" | "enemyActivations" | "dealEncounterCards" | "revealEncounterCards" | "passFirstPlayer" | "endOfRound";
  readonly label: string;
  readonly detail: string;
  /** True for the step the live game is on right now, so the reference doubles as "where are we". */
  readonly current: boolean;
}

/**
 * The villain phase's own six steps (RRG 1.8 "Villain Phase", p. 47), worded as an
 * original paraphrase rather than the RRG's own text. `state` is optional so a
 * caller without a live game (or reading this list outside of Pause) can still
 * get the reference; when given, exactly the step `state.step` is on is marked
 * `current` — and only when the game is actually in the villain phase, since the
 * order is still worth reading during the player phase or setup.
 */
export function villainPhaseOrder(state?: GameState): readonly VillainPhaseStep[] {
  const currentKind = state && state.step.phase === "villain" ? state.step.kind : null;
  const steps: readonly Omit<VillainPhaseStep, "current">[] = [
    { id: "placeThreat", label: "1. Place threat", detail: "The main scheme's acceleration value, plus one per acceleration icon/token in play, is placed on it." },
    { id: "enemyActivations", label: "2. Enemies activate", detail: "In player order: the villain activates against that player, then each minion engaged with them, in that player's choice of order." },
    { id: "dealEncounterCards", label: "3. Deal encounter cards", detail: "Each player is dealt one encounter card facedown, plus one more per hazard icon in play." },
    { id: "revealEncounterCards", label: "4. Reveal encounter cards", detail: "The first player reveals and resolves their dealt cards one at a time, then each other player does the same in turn order." },
    { id: "passFirstPlayer", label: "5. Pass first player", detail: "The first player token passes to the next player clockwise." },
    { id: "endOfRound", label: "6. End of round", detail: "\"Until end of round\" effects expire, delayed effects resolve, and a new round begins." },
  ];
  return steps.map((step) => ({ ...step, current: step.id === currentKind }));
}
