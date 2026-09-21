/**
 * MarvelCDB records → `@mc/content` schema records.
 *
 * Pure function of (raw records, pack curation). Every inconsistency it can
 * detect is collected and thrown together at the end — ingestion never emits
 * a partially-trusted pack.
 *
 * Mapping decisions (verified against printed cards, see curation/core.ts):
 * - Scaling: `health_per_hero`, and a *false* `*_fixed` flag on
 *   base_threat/threat/escalation_threat, mean "per player"
 *   (The Break-In! 1B: threat 7 / escalation 1, both unfixed → 7 and 1 per
 *   player; Breakin' & Takin': base 2 fixed → flat 2). No Core card mixes a
 *   flat and a per-player part, so `base` and `perPlayer` are never both set.
 * - MarvelCDB aggregate records (a bare code like `01097` or `01144` whose
 *   suffixed variants `01097a`/`01144a…` also exist) are dropped: they
 *   duplicate the real cards and would double-count copies.
 * - `real_text` (not `text`) is the text source; both are *current* wording.
 *   Printed wording only differs where curated errata says so.
 * - A null cost on an event/upgrade/support means 0 (MarvelCDB sends 0; null
 *   would be an error). Resources have no cost.
 *
 * The steps live in `normalize/`, one module each, and run in the order below. The order is part of the output:
 * ability ids are assigned, and errors reported, in call order.
 */
import type {
  AnyCard,
  Cycle,
  EncounterSet,
  KeywordInstance,
  Pack,
  Scenario,
  StarterDeck,
} from "../../src/schema/index.ts";
import type { CardProvenance, DroppedSourceRecord } from "../../src/data/types.ts";
import type { PackCuration } from "./curation/types.ts";
import type { RawCard } from "./raw-types.ts";
import { checkCoverage, checkStaleCuration } from "./normalize/checks.ts";
import { createContext } from "./normalize/context.ts";
import { normalizeEncounterSets } from "./normalize/encounter-sets.ts";
import { normalizeHeroes } from "./normalize/heroes.ts";
import { normalizeMainSchemes } from "./normalize/main-schemes.ts";
import { normalizeScenarios } from "./normalize/scenarios.ts";
import { collectSeparateDecks } from "./normalize/separate-decks.ts";
import { normalizeSingleCards } from "./normalize/single-cards.ts";
import { normalizeStarterDecks } from "./normalize/starter-decks.ts";
import { normalizeVillains } from "./normalize/villains.ts";

export interface NormalizedPack {
  readonly cycle: Cycle;
  readonly pack: Pack;
  readonly cards: AnyCard[];
  readonly encounterSets: EncounterSet[];
  readonly scenarios: Scenario[];
  readonly starterDecks: StarterDeck[];
  readonly provenance: CardProvenance[];
  readonly dropped: DroppedSourceRecord[];
}

export function normalizePack(raw: readonly RawCard[], curation: PackCuration): NormalizedPack {
  // 1. Index records, drop MarvelCDB aggregates.
  const ctx = createContext(raw, curation);
  // 2–6. Cards: multi-record cards first, so the one-card-per-record step can skip what they claimed.
  const separateDecks = collectSeparateDecks(ctx);
  normalizeHeroes(ctx, separateDecks.byIdentity);
  const villainIdBySet = normalizeVillains(ctx);
  const mainSchemeIdBySet = normalizeMainSchemes(ctx);
  normalizeSingleCards(ctx, separateDecks.ofCode);
  // 7. Curation that matched nothing is stale.
  checkStaleCuration(ctx);
  // 8–10. Records built on top of the cards.
  const { encounterSets, setNames } = normalizeEncounterSets(ctx);
  const scenarios = normalizeScenarios(ctx, { setNames, villainIdBySet, mainSchemeIdBySet });
  const starterDecks = normalizeStarterDecks(ctx);
  // 11. Nothing left uncovered.
  checkCoverage(ctx);

  if (ctx.errors.length > 0) {
    throw new Error(`Normalization of pack "${curation.packCode}" failed:\n  - ${ctx.errors.join("\n  - ")}`);
  }

  const order = (a: { id: string } | { cardId: string }, b: { id: string } | { cardId: string }) => {
    const ka = "id" in a ? a.id : a.cardId;
    const kb = "id" in b ? b.id : b.cardId;
    return ka.localeCompare(kb);
  };
  return {
    cycle: { id: ctx.cycleId, name: curation.cycle.name, order: curation.cycle.order },
    pack: { code: ctx.setCode, name: curation.pack.name, cycleId: ctx.cycleId, releaseDate: curation.pack.releaseDate },
    cards: ctx.cards.sort(order),
    encounterSets,
    scenarios,
    starterDecks,
    provenance: ctx.provenance.sort(order),
    dropped: [...ctx.dropped].sort((a, b) => a.marvelcdbCode.localeCompare(b.marvelcdbCode)),
  };
}

/** Keywords helper for tests/diagnostics. */
export type { KeywordInstance };
