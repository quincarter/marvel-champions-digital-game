/**
 * S3 (docs/phase4-screen-gaps.md §2): the encounter deck a table setup would
 * build — broken down by set and by card type — plus the nemesis sets held
 * back and the obligations shuffled in. Used by W2's Table setup screen
 * ("The encounter deck you're building").
 *
 * **This calls the same builder the game uses, not a re-derivation of the
 * list.** `coreScenario`/`wave1Scenario` (`@mc/cards`) already build the
 * exact `GameSetupConfig` — `encounterDeck`/`villains[].encounterDeck` — a
 * real game starts from (`session-core.ts`'s `scenarioFor`), and doing so is
 * side-effect-free: it's plain data assembly from static content (no RNG, no
 * `GameState`, no player interaction), so a preview can call it directly.
 * `encounterDeckPreviewOf` takes that config as input rather than importing
 * `@mc/cards` itself, so a caller (or a test) builds it with `coreScenario`/
 * `wave1Scenario` exactly as `session-core.ts` does, and this module only
 * ever reads the result.
 *
 * **What `coreScenario`/`wave1Scenario` *don't* cover:** each hero's
 * obligation card and nemesis set. RRG 1.8 Appendix II shuffles those in
 * during `createGame`'s own setup (`packages/engine/src/setup.ts`), which is
 * a real `GameState` build (instances, RNG-seeded shuffling) — not something
 * a preview should run just to read two fields. Both facts are printed data
 * on the identity itself (`HeroIdentityCard.obligationCardId`,
 * `nemesisEncounterSetId`), the same two fields W2's own hero detail panel
 * reads directly (docs/phase4-screen-gaps.md §3 W2). So this module reads
 * them straight off each seat's identity card rather than re-running setup —
 * no engine change needed, and no rule is restated: "which card is the
 * obligation" and "which set is the nemesis set" are the identity's own
 * printed values, not a computed rule.
 *
 * **A card in more than one of the sets used here would count in more than
 * one bucket of `bySet`.** No Core or wave 1 encounter card actually does
 * this (`encounterSetIds` is single-membership throughout today's pool), so
 * `bySet`'s counts already sum to `totalCards` in every scenario this module
 * is tested against — but the shape doesn't assume it stays that way.
 */
import type { AnyCard, CardId, CardType, EncounterSet, HeroIdentityCard } from "@mc/content";
import type { CardPool, GameSetupConfig } from "@mc/engine";

export interface EncounterSetBreakdown {
  readonly setId: string;
  readonly setName: string;
  readonly cardCount: number;
}

export interface CardTypeBreakdown {
  readonly type: CardType;
  readonly count: number;
}

/** One villain's own encounter deck — the whole deck for a single-villain scenario, or one of several for Breakout. */
export interface VillainDeckPreview {
  readonly villainCardId: CardId;
  readonly villainName: string;
  readonly totalCards: number;
  readonly bySet: readonly EncounterSetBreakdown[];
  readonly byType: readonly CardTypeBreakdown[];
  /** Cards carrying the `surge` keyword — cross-cutting with `byType` (a treachery or a minion can both carry it), so it's its own count rather than a `CardType` bucket. */
  readonly surgeCount: number;
}

export interface NemesisHeldBack {
  readonly identityCardId: CardId;
  readonly heroName: string;
  readonly setId: string;
  readonly setName: string;
  readonly cardCount: number;
}

export interface ObligationShuffledIn {
  readonly identityCardId: CardId;
  readonly heroName: string;
  readonly obligationCardId: CardId;
  readonly obligationName: string;
}

export interface EncounterDeckPreview {
  /** One entry for a single-villain scenario; one per villain for a multi-villain scenario (Breakout), in `config.villains` order. */
  readonly decks: readonly VillainDeckPreview[];
  readonly nemesisSetsHeldBack: readonly NemesisHeldBack[];
  readonly obligationsShuffledIn: readonly ObligationShuffledIn[];
}

const cardsOf = (pool: CardPool): readonly AnyCard[] => (Array.isArray(pool) ? pool : Object.values(pool));

function breakdownOf(cardIds: readonly CardId[], byId: ReadonlyMap<string, AnyCard>, setNames: ReadonlyMap<string, string>): Pick<VillainDeckPreview, "totalCards" | "bySet" | "byType" | "surgeCount"> {
  const typeCounts = new Map<CardType, number>();
  const setCounts = new Map<string, number>();
  let surgeCount = 0;
  for (const id of cardIds) {
    const card = byId.get(id as string);
    if (!card) continue; // defensive: every id here came from the same pool the caller built the config against.
    typeCounts.set(card.type, (typeCounts.get(card.type) ?? 0) + 1);
    if ("encounterSetIds" in card) {
      for (const setId of card.encounterSetIds as readonly string[]) {
        setCounts.set(setId, (setCounts.get(setId) ?? 0) + 1);
      }
    }
    if ("keywords" in card && (card.keywords as readonly { readonly name: string }[]).some((k) => k.name === "surge")) surgeCount += 1;
  }
  const byType = [...typeCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  const bySet = [...setCounts.entries()]
    .map(([setId, cardCount]) => ({ setId, setName: setNames.get(setId) ?? setId, cardCount }))
    .sort((a, b) => b.cardCount - a.cardCount);
  return { totalCards: cardIds.length, byType, bySet, surgeCount };
}

/**
 * `config` is a `GameSetupConfig` built by `coreScenario`/`wave1Scenario` for
 * the draft's current scenario/difficulty/modular-sets/seats — the same
 * config `EngineSessionCore.start` would hand to `createGame`. `pool` is the
 * card pool it was built against (`CORE_CARDS`/`WAVE1_CARDS`, or the app's
 * `POOL_CARDS`); `encounterSets` supplies display names for `bySet`
 * (`CORE_ENCOUNTER_SETS`/`WAVE1_ENCOUNTER_SETS`).
 */
export function encounterDeckPreviewOf(config: GameSetupConfig, pool: CardPool, encounterSets: readonly EncounterSet[]): EncounterDeckPreview {
  const byId = new Map(cardsOf(pool).map((card) => [card.id as string, card]));
  const setNames = new Map(encounterSets.map((set) => [set.id as string, set.name]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? id;

  const decks: VillainDeckPreview[] =
    config.villains && config.villains.length > 0
      ? config.villains.map((villain) => ({
          villainCardId: villain.villainCardId,
          villainName: nameOf(villain.villainCardId as string),
          ...breakdownOf(villain.encounterDeck, byId, setNames),
        }))
      : [
          {
            villainCardId: config.villainCardId,
            villainName: nameOf(config.villainCardId as string),
            ...breakdownOf(config.encounterDeck, byId, setNames),
          },
        ];

  const nemesisSetsHeldBack: NemesisHeldBack[] = [];
  const obligationsShuffledIn: ObligationShuffledIn[] = [];
  // RRG 1.8 Appendix II, steps 4–5 — off entirely for a scenario that says so (The Wrecking Crew insert: "Nemesis
  // cards and obligations are not used when playing this scenario"). Default true, matching `Scenario.usesIdentityEncounterSets`'s own doc comment.
  if (config.includeIdentitySets !== false) {
    for (const player of config.players) {
      const identity = byId.get(player.identityCardId as string);
      if (!identity || identity.type !== "hero_identity") continue;
      const heroIdentity: HeroIdentityCard = identity;

      const obligation = byId.get(heroIdentity.obligationCardId as string);
      if (obligation) {
        obligationsShuffledIn.push({
          identityCardId: heroIdentity.id,
          heroName: heroIdentity.name,
          obligationCardId: obligation.id,
          obligationName: obligation.name,
        });
      }

      const nemesisSetId = heroIdentity.nemesisEncounterSetId as string;
      const nemesisCards = cardsOf(pool).filter((card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(nemesisSetId));
      const cardCount = nemesisCards.reduce((sum, card) => sum + card.quantityInSet, 0);
      if (cardCount > 0) {
        nemesisSetsHeldBack.push({
          identityCardId: heroIdentity.id,
          heroName: heroIdentity.name,
          setId: nemesisSetId,
          setName: setNames.get(nemesisSetId) ?? nemesisSetId,
          cardCount,
        });
      }
    }
  }

  return { decks, nemesisSetsHeldBack, obligationsShuffledIn };
}
