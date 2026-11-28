/**
 * The pool and the issue sections, as the models their elements take: what each reads comes from the engine and the view models
 * (`BriefingView`'s pool, side scheme, mission and case file; the easier start and the modes from the game the composed issue would
 * launch), the client decides none of it. A record that cannot be launched shows neither the easier start nor the modes. Pictures are
 * leased here and handed in.
 */
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import type {
  PoolModel,
  PoolRowModel,
} from "../../../../components/briefing/mc-briefing-pool/mc-briefing-pool.types.js";
import type { SchemeSectionModel } from "../../../../components/briefing/mc-briefing-scheme/mc-briefing-scheme.types.js";
import type { ShieldSectionModel } from "../../../../components/briefing/mc-briefing-shield/mc-briefing-shield.types.js";
import { boardCaptionIn, evidenceKindIn } from "../../../../components/briefing/mc-briefing-shield/shield-text.js";
import type { KeyedPickCard } from "../../../../components/briefing/mc-briefing-pick-card/mc-briefing-pick-card.types.js";
import type { PictureLeases } from "../../../../dom/picture-leases.js";
import type { CampaignRecord } from "../../../../engine/campaign-storage.js";
import { t } from "../../../../i18n/translate.js";
import { campaignService } from "../../../../session.js";
import { sideSchemePickCards, type BriefingView, type PickCard } from "../../../../view/campaign-briefing-model.js";
import type { BriefingPoolView } from "../../../../view/campaign-pool-model.js";
import { easierStartBriefingOf } from "../../../../view/campaign-easier-start-model.js";
import { issueModeRowsOf } from "../../../../view/campaign-modes-model.js";
import type { SideSchemeBriefing, SideSchemeRow } from "../../../../view/campaign-side-scheme-model.js";
import { cardPicture } from "../pictures.js";
import type { BriefingSectionsModel } from "../../../../views/briefing/mc-briefing-page/mc-briefing-page.types.js";
import type { BriefingState } from "../context.js";
import { ENCOUNTER_SET_NAMES, cardOfName } from "../names.js";

/** What a pick card is to its option, in the player language ("Scheme", "Earns", "Brings"); any other caption as given. */
export function pickCaptionIn(card: Pick<PickCard, "key" | "caption">): string {
  if (card.key === "scheme") return t("briefing.call.scheme.scheme");
  if (card.key === "environment") return t("briefing.call.scheme.earns");
  if (card.key === "encounter") return t("briefing.call.scheme.brings");
  return card.caption;
}

/** A side-scheme row cards as the pick cards the elements take. */
export function schemeCardsOf(row: SideSchemeRow, leases: PictureLeases): readonly KeyedPickCard[] {
  return sideSchemePickCards(row, (id) => campaignCardsById().get(id)?.type).map((card) => ({
    key: card.key,
    caption: pickCaptionIn(card),
    earned: card.key === "environment",
    cardId: card.cardId as string,
    name: card.name,
    shape: card.shape,
    picture: cardPicture(leases, card.cardId as string, card.name),
  }));
}

/** The settled section shows when a scheme is chosen or the node fixes sets. */
export const hasSideScheme = (scheme: SideSchemeBriefing): boolean =>
  scheme.chosen !== null || scheme.requiredSetIds.length > 0;

function schemeModelOf(scheme: SideSchemeBriefing, leases: PictureLeases, phone: boolean): SchemeSectionModel {
  const row = scheme.chosen;
  return {
    chosen: row
      ? {
          heading: (row.environment ? `${row.name} → ${row.environment.name}` : row.name).toLocaleUpperCase(),
          repeated: scheme.repeated,
          cards: schemeCardsOf(row, leases),
        }
      : null,
    carryIns: scheme.carryIns,
    fixedSets:
      scheme.requiredSetIds.length > 0
        ? scheme.requiredSetIds.map((id) => ENCOUNTER_SET_NAMES.get(id) ?? id).join(", ")
        : null,
    phone,
  };
}

function shieldModelOf(
  shield: NonNullable<BriefingView["shield"]>,
  leases: PictureLeases,
  phone: boolean,
): ShieldSectionModel {
  const picture = (cardId: unknown, name: string) => cardPicture(leases, cardId as string, name);
  return {
    shield,
    evidence: shield.evidence.map((card) => ({
      ...card,
      caption: evidenceKindIn(card.kind),
      picture: picture(card.cardId, card.name),
    })),
    board: shield.board.map((member) => ({
      cardId: member.cardId,
      name: member.name,
      caption: boardCaptionIn(member),
      picture: picture(member.cardId, member.name),
    })),
    phone,
  };
}

/** "From the pool": each row with the card it names (by its printed name) and its scan. */
export function poolModelOf(pool: BriefingPoolView, leases: PictureLeases): PoolModel {
  const rowOf = (row: BriefingPoolView["rows"][number]): PoolRowModel => {
    const card = cardOfName(row.name);
    return {
      fieldId: row.fieldId,
      name: row.name,
      destination: row.destination,
      destinationKind: row.destinationKind,
      helps: row.helps,
      card: card ? { cardId: card.id as string, name: row.name } : null,
      picture: card ? cardPicture(leases, card.id as string, t("briefing.pool.noScan")) : { src: null },
    };
  };
  return {
    rows: pool.rows.map(rowOf),
    groups: pool.groups ? pool.groups.map((group) => ({ kind: group.kind, rows: group.rows.map(rowOf) })) : null,
  };
}

function launchedOf(record: CampaignRecord): {
  easier: BriefingSectionsModel["easier"];
  modes: BriefingSectionsModel["modes"];
} {
  try {
    const config = campaignService().launchConfig(record);
    const easier = easierStartBriefingOf(record, config);
    return {
      easier: easier ? { on: easier.on } : null,
      modes: issueModeRowsOf(config.scenarioId, record.issueModes ?? {}, config.villainSetId),
    };
  } catch {
    return { easier: null, modes: [] };
  }
}

export const NO_SECTIONS: BriefingSectionsModel = {
  scheme: null,
  mission: null,
  shield: null,
  easier: null,
  modes: [],
};

/** The sections of the composed issue; every one null or empty before an issue is composed. */
export function sectionsModelOf(
  state: BriefingState,
  view: BriefingView | null,
  leases: PictureLeases,
  phone: boolean,
): BriefingSectionsModel {
  const record = state.record;
  if (!record || !view) return NO_SECTIONS;
  const launched = record.attempt ? launchedOf(record) : { easier: null, modes: [] };
  const scheme = view.sideScheme;
  return {
    scheme: scheme && hasSideScheme(scheme) ? schemeModelOf(scheme, leases, phone) : null,
    mission: view.missions,
    shield: view.shield ? shieldModelOf(view.shield, leases, phone) : null,
    easier: launched.easier,
    // Chosen before the issue opens: a game already on the table keeps the modes it was composed under.
    modes: state.inProgress ? [] : launched.modes,
  };
}
