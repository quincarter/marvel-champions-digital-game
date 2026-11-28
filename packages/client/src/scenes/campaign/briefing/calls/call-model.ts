/**
 * "Your call" as the `CallModel` the Briefing page shows: which question the engine asked (`call-kind.ts`) and, for each kind, the words,
 * pictures and options its element takes. What is legal is read from `pending.options` (the engine own offer), never recomputed here.
 * A call answers through the page (`answer`); its own progress lives in its element.
 */
import { CAMPAIGN_ACCEPT, type CampaignPendingChoice } from "@mc/engine";
import { artLanguageNow } from "../../../../art/art-source.js";
import { setupCallCopyIn } from "../../../../campaign/briefing-text.js";
import { issueTitleIn } from "../../../../campaign/campaign-text.js";
import { issueStoryFor, setupCallCopyFor } from "../../../../campaign/story.js";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import { packNameOf } from "../../../../content/pool.js";
import type { CallModel } from "../../../../components/briefing/mc-briefing-call/mc-briefing-call.types.js";
import type { OptionsModel } from "../../../../components/briefing/mc-briefing-options/mc-briefing-options.types.js";
import type { OptionTileModel } from "../../../../components/briefing/mc-briefing-option-tile/mc-briefing-option-tile.types.js";
import type { RoleConfirmModel } from "../../../../components/briefing/mc-briefing-role-confirm/mc-briefing-role-confirm.types.js";
import type { SeatHeaderModel } from "../../../../components/briefing/mc-briefing-seat-header/mc-briefing-seat-header.types.js";
import type { PictureLeases } from "../../../../dom/picture-leases.js";
import { t } from "../../../../i18n/translate.js";
import { aspectStampOf } from "../../../../view/aspect-stamp.js";
import { optionLabelsOf, sideSchemeOptionLabels } from "../../../../view/campaign-option-labels.js";
import { roleCallOf, seatHeaderOf, type SeatHeaderView } from "../../../../view/campaign-role-call-model.js";
import type { CoreAspect } from "@mc/content";
import type { BriefingHints } from "../hints.js";
import type { BriefingState } from "../context.js";
import { openHintIn } from "../copy.js";
import { heroNameOf, cardNameOf } from "../names.js";
import { cardPicture, heroFace } from "../pictures.js";
import { schemeCardsOf } from "../sections/sections-model.js";
import { callKindFor } from "./call-kind.js";
import { optionLabelIn, roleExplainerIn, roleRelationIn, roleSummaryIn } from "./call-text.js";
import type { CallKind } from "./calls.types.js";
import { modularViewIn } from "./modular-text.js";

type Aspects = readonly CoreAspect[];

/** How the pending call shapes the page: a per-seat call takes a phone column top; role-building scrolls itself. */
export function callShapeOf(
  state: BriefingState,
  pending: CampaignPendingChoice,
  phone: boolean,
): { readonly seatCall: boolean; readonly ownsScroll: boolean } {
  return {
    seatCall: pending.seatNumber !== null && phone,
    ownsScroll: callKindFor(state, pending).kind === "roleBuild",
  };
}

/** True when `pending` is the modular-set (genre-set) pick, which the waiting notes name. */
export const isGenreSetPick = (state: BriefingState, pending: CampaignPendingChoice): boolean =>
  callKindFor(state, pending).kind === "modular";

/** The labels the options wear: a card name (plus what tells two apart), a scenario title, the villain-method words. */
export function optionLabelsFor(state: BriefingState, options: readonly string[]): ReadonlyMap<string, string> {
  const record = state.record;
  const base = optionLabelsOf(
    options,
    (id) => campaignCardsById().get(id),
    packNameOf,
    (id) => {
      // A scenario a choice graph offers (Fear No Evil) is billed by its issue title, in the player language.
      const title = record ? issueStoryFor(record.campaignId as string, id)?.title : undefined;
      return title === undefined ? undefined : issueTitleIn(record!.campaignId as string, id, title);
    },
  );
  return new Map(options.map((id) => [id, optionLabelIn(id, base.get(id) ?? cardNameOf(id))]));
}

function seatHeaderModelOf(header: SeatHeaderView, leases: PictureLeases): SeatHeaderModel {
  const lang = artLanguageNow();
  return {
    title: t("briefing.call.seatTitle", { number: header.seatNumber, hero: header.heroName }).toLocaleUpperCase(),
    picture: heroFace(leases, header.identityCardId as string),
    stamps: header.deckAspects.map((stamp) => {
      const made = aspectStampOf(stamp.aspect, lang);
      return { aspect: made.aspect, label: made.label };
    }),
  };
}

const stampsOf = (aspects: readonly { readonly aspect: CoreAspect }[]) => {
  const lang = artLanguageNow();
  return aspects.map((stamp) => {
    const made = aspectStampOf(stamp.aspect, lang);
    return { aspect: made.aspect, label: made.label };
  });
};

function roleBody(
  state: BriefingState,
  pending: CampaignPendingChoice,
  kind: Extract<CallKind, { kind: "role" }>,
  hints: BriefingHints,
  phone: boolean,
): Extract<CallModel["body"], { kind: "role" }> {
  const record = state.record!;
  const lang = artLanguageNow();
  const view = roleCallOf(pending, kind.roles, state.answers, record.seats, heroNameOf);
  const seat = record.seats.find((candidate) => candidate.seatNumber === pending.seatNumber);
  const deck = (seat?.deck?.aspects ?? []) as Aspects;
  const words = roleExplainerIn();
  const confirms = new Map<string, RoleConfirmModel>();
  const tiles = view.tiles.map((tile): OptionTileModel => {
    const roleAspects = kind.roles.find((role) => role.id === tile.id)?.aspects as Aspects;
    const taken = tile.takenBySeat !== null && !tile.available;
    if (tile.available) {
      confirms.set(tile.id, {
        roleId: tile.id,
        title: t("briefing.call.role.confirm", { hero: kind.header.heroName, role: tile.name }).toLocaleUpperCase(),
        chips: stampsOf(tile.aspects),
        summary: roleSummaryIn(tile.id, tile.summary, lang),
        relation: roleRelationIn(roleAspects, deck, tile.relation, lang),
        notes: [words.upgrades, words.building, t("briefing.call.role.recorded")],
        bar: { stops: { back: "role-back", confirm: "role-confirm" }, glyph: hints.glyph("confirm") },
        phone,
      });
    }
    return {
      stop: `role:${tile.id}`,
      action: { type: "role", id: tile.id },
      title: tile.name,
      chips: stampsOf(tile.aspects),
      body: taken
        ? (tile.takenByName
            ? t("briefing.call.takenBy", { number: tile.takenBySeat!, hero: tile.takenByName })
            : t("briefing.call.taken", { number: tile.takenBySeat! })
          ).toLocaleUpperCase()
        : roleSummaryIn(tile.id, tile.summary, lang),
      ...(taken ? { bodyWarn: true } : { footer: roleRelationIn(roleAspects, deck, tile.relation, lang) }),
      available: tile.available,
    };
  });
  return {
    kind: "role",
    tiles: { tiles, note: { heading: words.heading, lines: [words.upgrades, words.building, words.rule] } },
    confirms,
  };
}

function optionsBody(
  state: BriefingState,
  pending: CampaignPendingChoice,
  kind: Extract<CallKind, { kind: "options" | "random" }>,
  leases: PictureLeases,
  hints: BriefingHints,
): OptionsModel {
  const random = kind.kind === "random";
  const labels = random ? new Map<string, string>() : optionLabelsFor(state, pending.options);
  const cards = kind.kind === "options" ? kind.cards : null;
  return {
    random,
    acceptValue: CAMPAIGN_ACCEPT,
    count: pending.count,
    optional: pending.optional,
    confirmGlyph: hints.glyph("confirm"),
    options: random
      ? []
      : pending.options.map((id) => {
          const card = cards?.get(id);
          return {
            id,
            label: labels.get(id) ?? id,
            card: card
              ? {
                  cardId: card.cardId as string,
                  name: card.name,
                  shape: card.shape,
                  picture: cardPicture(leases, card.cardId as string, card.name),
                }
              : null,
          };
        }),
  };
}

/** "Your call" for the pending question. */
export function callModelOf(input: {
  readonly state: BriefingState;
  readonly pending: CampaignPendingChoice;
  readonly leases: PictureLeases;
  readonly hints: BriefingHints;
  readonly phone: boolean;
}): CallModel {
  const { state, pending, leases, hints, phone } = input;
  const kind = callKindFor(state, pending);
  const record = state.record;
  const header = record ? seatHeaderOf(pending, record.seats, heroNameOf) : null;
  const head = {
    hint:
      openHintIn({
        issueNumber: state.issueNumber,
        pending: true,
        composing: false,
        starting: false,
        deckBlocked: false,
      })?.call ?? null,
    seat: header ? seatHeaderModelOf(header, leases) : null,
    phone,
  };
  const base = {
    key: `${pending.instructionId}|${pending.slot}|${pending.seatNumber ?? "all"}|${state.answers.length}`,
    head,
    glyph: hints.glyph("confirm"),
    ownsScroll: kind.kind === "roleBuild",
  };
  // Who is deciding, the box own plain words and the printed rule, for the kinds that do not word their own question.
  const prompt = (): NonNullable<CallModel["prompt"]> => ({
    who: header
      ? null
      : pending.seatNumber !== null
        ? t("briefing.call.seat", { number: pending.seatNumber })
        : t("briefing.call.together"),
    explain: setupCallCopyIn(pending.instructionId, setupCallCopyFor(pending.instructionId))?.explain ?? null,
    rule: pending.text,
  });
  switch (kind.kind) {
    case "roleBuild":
      return {
        ...base,
        prompt: null,
        body: {
          kind: "roleBuild",
          model: {
            build: kind.build,
            pictures: new Map(
              kind.build.cards.map((card) => [card.id, cardPicture(leases, card.id, card.name)] as const),
            ),
            confirmGlyph: hints.glyph("confirm"),
            phone,
          },
        },
      };
    case "sideScheme": {
      const labels = sideSchemeOptionLabels(kind.scheme.offered);
      return {
        ...base,
        prompt: null,
        body: {
          kind: "sideScheme",
          model: {
            rows: kind.scheme.offered.map((row) => ({
              name: row.name,
              label: labels.get(row.name) ?? row.name,
              cards: schemeCardsOf(row, leases),
            })),
          },
        },
      };
    }
    case "modular":
      return { ...base, prompt: null, body: { kind: "modular", view: modularViewIn(kind.view) } };
    case "role":
      return { ...base, prompt: prompt(), body: roleBody(state, pending, kind, hints, phone) };
    case "random":
    case "options":
      return {
        ...base,
        prompt: prompt(),
        body: { kind: "options", model: optionsBody(state, pending, kind, leases, hints) },
      };
  }
}
