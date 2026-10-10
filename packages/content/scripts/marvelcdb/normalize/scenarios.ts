/** Step 9: scenarios from curation, resolved against the villains, main schemes and encounter sets just emitted. */
import type { MultipleVillains, Scenario, ScenarioVillain } from "../../../src/schema/index.ts";
import { brand } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";
import { CORE_ENCOUNTER_SET_CODES } from "./core-raw.ts";

export interface ScenarioLookups {
  /** This pack's encounter set names, by set code. */
  readonly setNames: ReadonlyMap<string, string>;
  readonly villainIdBySet: ReadonlyMap<string, string>;
  readonly mainSchemeIdBySet: ReadonlyMap<string, string>;
}

export function normalizeScenarios(
  ctx: NormalizeContext,
  { setNames, villainIdBySet, mainSchemeIdBySet }: ScenarioLookups,
): Scenario[] {
  const { errors } = ctx;
  const emittedCardIds = new Set(ctx.cards.map((c) => c.id as string));
  const resolveCardCode = (code: string, label: string): string | undefined => {
    if (!emittedCardIds.has(code)) {
      errors.push(`scenario: ${label} names unknown card ${code}`);
      return undefined;
    }
    return code;
  };
  return ctx.curation.scenarios.map((s) => {
    const schemeSetCode = s.mainSchemeSetCode ?? s.villainSetCode;
    for (const code of [
      s.villainSetCode,
      schemeSetCode,
      ...s.recommendedModularSetCodes,
      ...s.standardSetCodes,
      ...s.expertSetCodes,
      ...(s.additionalEncounterSetCodes ?? []),
      ...(s.multipleVillains?.villainSetCodes ?? []),
      ...(s.separateDecks?.flatMap((d) => d.contents.encounterSetCodes ?? []) ?? []),
    ]) {
      if (!setNames.has(code) && !CORE_ENCOUNTER_SET_CODES.has(code))
        errors.push(`scenario ${s.id}: unknown encounter set ${code}`);
    }
    // A restricted pool may name sets of other packs (wave 9: the Thunderbolts pool holds the four hero packs' sets
    // beside the box's six), so its codes are not checked against this pack's own sets; a content test pins them to
    // the sets that exist (`AOS_THUNDERBOLT_POOL_SET_IDS`).
    // Wave 2 (docs/phase7-wave2.md §1.8): Kang's villain set has no single villainIdBySet entry (several
    // single-stage villains collide on one card_set_code — normalize/villains.ts leaves the map unset for that
    // shape), so a scenario that hits it must name its villain card directly instead.
    const villainId = s.villainCardCode
      ? resolveCardCode(s.villainCardCode, `scenario ${s.id} villainCardCode`)
      : villainIdBySet.get(s.villainSetCode);
    const schemeId = mainSchemeIdBySet.get(schemeSetCode);
    if (!villainId) errors.push(`scenario ${s.id}: no villain in set ${s.villainSetCode}`);
    if (!schemeId) errors.push(`scenario ${s.id}: no main scheme in set ${schemeSetCode}`);

    const setAsideVillainCardIds = (s.setAsideVillainCardCodes ?? [])
      .map((c) => resolveCardCode(c, `scenario ${s.id} setAsideVillainCardCodes`))
      .filter((id): id is string => id !== undefined)
      .map((id) => brand("card", id));

    const setAsideCardIds = (s.setAsideCardCodes ?? [])
      .map((c) => resolveCardCode(c, `scenario ${s.id} setAsideCardCodes`))
      .filter((id): id is string => id !== undefined)
      .map((id) => brand("card", id));

    const neutralCards = s.neutralCardCodes
      ? {
          villainCardId: brand(
            "card",
            resolveCardCode(s.neutralCardCodes.villainCardCode, `scenario ${s.id} neutralCardCodes.villainCardCode`) ??
              "",
          ),
          mainSchemeCardId: brand(
            "card",
            resolveCardCode(
              s.neutralCardCodes.mainSchemeCardCode,
              `scenario ${s.id} neutralCardCodes.mainSchemeCardCode`,
            ) ?? "",
          ),
        }
      : undefined;

    const expertVillains = s.expertVillains
      ? {
          villainCardId: brand(
            "card",
            resolveCardCode(s.expertVillains.villainCardCode, `scenario ${s.id} expertVillains.villainCardCode`) ?? "",
          ),
          setAsideVillainCardIds: s.expertVillains.setAsideVillainCardCodes
            .map((c) => resolveCardCode(c, `scenario ${s.id} expertVillains.setAsideVillainCardCodes`))
            .filter((id): id is string => id !== undefined)
            .map((id) => brand("card", id)),
        }
      : undefined;

    const separateDecks = s.separateDecks?.map((d) => ({
      name: d.name,
      contents: {
        ...(d.contents.encounterSetCodes
          ? { encounterSetIds: d.contents.encounterSetCodes.map((c) => brand("encounterSet", c)) }
          : {}),
        ...(d.contents.cardType ? { cardType: d.contents.cardType } : {}),
        ...(d.contents.trait ? { trait: d.contents.trait } : {}),
        ...(d.contents.cardCodes
          ? {
              cardIds: d.contents.cardCodes
                .map((c) => resolveCardCode(c, `scenario ${s.id} separate deck ${d.name} contents.cardCodes`))
                .filter((id): id is string => id !== undefined)
                .map((id) => brand("card", id)),
            }
          : {}),
      },
      discardPile: d.discardPile,
      whenEmpty: d.whenEmpty,
      ...(d.closedToPlayerCards ? { closedToPlayerCards: true as const } : {}),
      ...(d.topCardInPlay ? { topCardInPlay: true as const } : {}),
    }));

    // Several villains at once (docs/phase7-wave1.md §1.1 — The Wrecking Crew; docs/phase7-wave4.md §1.6 — Tower
    // Defense's shared-deck shape, where the villains share one `card_set_code` and are told apart by
    // `villainCardCodes` instead of `villainSetCodes`).
    let multipleVillains: MultipleVillains | undefined;
    const mv = s.multipleVillains;
    const shared = mv?.encounterDecks === "shared";
    if (mv) {
      if (mv.villainSetCodes[0] !== s.villainSetCode) {
        errors.push(`scenario ${s.id}: multipleVillains.villainSetCodes[0] must equal villainSetCode`);
      }
      if (mv.signatureSideSchemeCodes && mv.villainSetCodes.length !== mv.signatureSideSchemeCodes.length) {
        errors.push(`scenario ${s.id}: multipleVillains villainSetCodes/signatureSideSchemeCodes length mismatch`);
      }
      if (mv.villainCardCodes && mv.villainCardCodes.length !== mv.villainSetCodes.length) {
        errors.push(`scenario ${s.id}: multipleVillains villainSetCodes/villainCardCodes length mismatch`);
      }
      if (mv.sideBCardCodes && mv.sideBCardCodes.length !== mv.villainSetCodes.length) {
        errors.push(`scenario ${s.id}: multipleVillains villainSetCodes/sideBCardCodes length mismatch`);
      }
      const villains: ScenarioVillain[] = mv.villainSetCodes.map((set, i) => {
        const vid = mv.villainCardCodes
          ? resolveCardCode(mv.villainCardCodes[i] ?? "", `scenario ${s.id} multipleVillains.villainCardCodes[${i}]`)
          : villainIdBySet.get(set);
        if (!vid) errors.push(`scenario ${s.id}: no villain in set ${set}`);
        const sideB = mv.sideBCardCodes?.[i];
        const sideBId =
          sideB !== undefined
            ? resolveCardCode(sideB, `scenario ${s.id} multipleVillains.sideBCardCodes[${i}]`)
            : undefined;
        const sig = mv.signatureSideSchemeCodes?.[i];
        if (sig !== undefined && !emittedCardIds.has(sig))
          errors.push(`scenario ${s.id}: unknown signature side scheme ${sig}`);
        return {
          villainCardId: brand("card", vid ?? ""),
          // A shared deck is built from the scenario's own encounter sets (below), not per villain — each
          // villain's own encounterSetIds stays empty (docs/phase7-wave4.md §1.6).
          encounterSetIds: shared ? [] : [brand("encounterSet", set)],
          ...(sig !== undefined ? { signatureSideSchemeCardId: brand("card", sig) } : {}),
          ...(sideBId !== undefined ? { sideBCardId: brand("card", sideBId) } : {}),
        };
      });
      const [firstV, secondV, ...restV] = villains;
      if (villains.length < 2) errors.push(`scenario ${s.id}: multipleVillains needs at least two villains`);
      if (firstV && secondV) {
        multipleVillains = {
          villains: [firstV, secondV, ...restV],
          encounterDecks: mv.encounterDecks ?? "perVillain",
          activation: "activeVillainOnly",
          winCondition: mv.winCondition ?? "allVillainsDefeated",
          ...(mv.atSetup ? { atSetup: mv.atSetup } : {}),
        };
      }
    }

    return {
      id: brand("scenario", s.id),
      name: s.name,
      packCode: ctx.setCode,
      villainCardId: brand("card", villainId ?? ""),
      mainSchemeCardId: brand("card", schemeId ?? ""),
      // A `perVillain` multi-villain scenario has no single flat encounter deck (each villain has its own — see
      // `multipleVillains`); the insert also uses no modular/standard/expert sets (The Wrecking Crew). A `shared`
      // one (Tower Defense, docs/phase7-wave4.md §1.6) builds its one deck from the scenario's own sets, same as
      // an ordinary single-villain scenario.
      encounterSetIds:
        multipleVillains && !shared
          ? []
          : [
              brand("encounterSet", s.villainSetCode),
              ...(s.additionalEncounterSetCodes ?? []).map((c) => brand("encounterSet", c)),
            ],
      recommendedModularSetIds: s.recommendedModularSetCodes.map((c) => brand("encounterSet", c)),
      standardEncounterSetIds: s.standardSetCodes.map((c) => brand("encounterSet", c)),
      expertEncounterSetIds: s.expertSetCodes.map((c) => brand("encounterSet", c)),
      villainStages: { standard: s.villainStages.standard, expert: s.villainStages.expert },
      ...(multipleVillains ? { multipleVillains } : {}),
      ...(s.usesIdentityEncounterSets === false ? { usesIdentityEncounterSets: false as const } : {}),
      ...(s.nemesisSetsSetAside ? { nemesisSetsSetAside: true as const } : {}),
      ...(s.modularSetCount !== undefined ? { modularSetCount: s.modularSetCount } : {}),
      ...(s.setAsideModularSetCount !== undefined ? { setAsideModularSetCount: s.setAsideModularSetCount } : {}),
      ...(s.modularSetPool
        ? {
            modularSetPool: {
              setIds: s.modularSetPool.setCodes.map((c) => brand("encounterSet", c)),
              restricted: s.modularSetPool.restricted,
            },
          }
        : {}),
      ...(setAsideVillainCardIds.length > 0 ? { setAsideVillainCardIds } : {}),
      ...(setAsideCardIds.length > 0 ? { setAsideCardIds } : {}),
      ...(neutralCards ? { neutralCards } : {}),
      ...(s.referenceCards
        ? { referenceCards: s.referenceCards.map((r) => ({ ...r, image: brand("image", r.image) })) }
        : {}),
      ...(expertVillains ? { expertVillains } : {}),
      ...(s.victory ? { victory: s.victory } : {}),
      ...(s.separateGameAreas ? { separateGameAreas: s.separateGameAreas } : {}),
      ...(separateDecks ? { separateDecks } : {}),
      ...(s.startingVillain ? { startingVillain: s.startingVillain } : {}),
      ...(s.victoryCondition ? { victoryCondition: s.victoryCondition } : {}),
    };
  });
}
