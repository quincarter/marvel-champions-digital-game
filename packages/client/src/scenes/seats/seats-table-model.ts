/**
 * The seats, the Team-Up pairs, the narrow summary strip, the detail panel, the header and the footer of Take your seats, as
 * the plain models the page's sections take (`components/seats/seats.types.ts`). Words are translated here; nothing here
 * draws or decides what may be seated.
 */
import type { PackLeases } from "../../art/pack-art.js";
import { artFor } from "../../art/art-source.js";
import { TEAM_UP_ART, teamUpArtFor } from "../../art/team-up-art.js";
import { POOL_ENCOUNTER_SETS, currentCardsById } from "../../content/pool.js";
import type {
  PictureSource,
  SeatModel,
  SeatPairModel,
  SeatsDetailModel,
  SeatsFooterModel,
  SeatSummaryModel,
} from "../../components/seats/seats.types.js";
import { sheetColor } from "../../dom/sheet-builder.js";
import { listAnd, t, tPlural } from "../../i18n/translate.js";
import { surface } from "../../tokens.js";
import { testedSubtitleOf } from "../../view/community-decks-model.js";
import type { DeckOption } from "../../view/deck-list-model.js";
import type { SeatInsights } from "../../view/seat-recommendations.js";
import { heroCandidateDetailOf, seatSlotsOf } from "../../view/seat-slots.js";
import { testedCatalog } from "../../view/seatable-decks.js";
import { MAX_SEATS } from "../../view/seats-layout.js";
import { seatFrameOf, seatLabelOf } from "../../view/seats-panel-model.js";
import { seatDetailSubject, seatIsSelectable, type SetupDraft } from "../../view/setup-draft.js";

const PARCHMENT = (): string => sheetColor(surface.parchment.hex, "fill");

/** The four seats: the card's words and the chip's shorter ones. `slotWidth` decides where " · YOU" still fits. */
export function seatModelsOf(
  draft: SetupDraft,
  deckOptions: readonly DeckOption[],
  leases: PackLeases,
  slotWidth: number,
): readonly SeatModel[] {
  const byId = new Map(deckOptions.map((o) => [o.deck.id as string, o]));
  const slots = seatSlotsOf(draft.seats, deckOptions, currentCardsById(), MAX_SEATS, draft.activeSeatIndex);
  return slots.map((slot, index) => {
    const selectable = seatIsSelectable(draft, index);
    const frame = seatFrameOf({ active: slot.active, filled: slot.deckId !== null }, selectable);
    const words = {
      seat: t("seats.seatLabel", { seat: index + 1 }),
      picking: t("seats.seatPicking", { seat: index + 1 }),
      you: t("seats.youSuffix"),
    };
    const option = slot.deckId ? byId.get(slot.deckId) : undefined;
    const identity = option ? currentCardsById().get(option.deck.identityCardId as string) : undefined;
    const held = identity ? leases.image(artFor(identity, { kind: "hero" })) : null;
    const chipRoomy = slotWidth >= 120;
    return {
      index,
      deckId: slot.deckId,
      frame,
      // " · YOU" only where the card is wide enough to keep the name beside the clear button whole.
      label: seatLabelOf(words, frame, index, slotWidth >= 260),
      name: slot.identityName,
      meta: slot.deckId
        ? t("seats.slotMeta", { aspect: slot.aspectLabel ?? "", hp: slot.hp ?? "—", hand: slot.handSize ?? "—" })
        : null,
      empty: slot.deckId
        ? null
        : selectable
          ? t("seats.emptyPick")
          : t("seats.fillFirst", { seat: draft.seats.length + 1 }),
      picture: held
        ? {
            src: held.src,
            fill: PARCHMENT(),
            cover: { x: 0.5, y: 0.3 },
            ...(held.retry !== undefined ? { retry: held.retry } : {}),
          }
        : null,
      clearLabel: slot.deckId ? t("seats.clearSeat") : null,
      chip: {
        label: seatLabelOf(words, frame === "activeEmpty" ? "empty" : frame, index, chipRoomy),
        meta:
          slot.deckId && chipRoomy
            ? t("seats.slotMetaShort", { aspect: slot.aspectLabel ?? "", hp: slot.hp ?? "—" })
            : null,
        empty: slot.deckId ? null : frame === "activeEmpty" ? t("seats.picking") : t("seats.empty"),
      },
    };
  });
}

/** The pairs seated at the table, each with its badge picture where there is art. */
export function pairModelsOf(insights: SeatInsights): readonly SeatPairModel[] {
  return insights.pairs.map((pair) => {
    const art = teamUpArtFor(TEAM_UP_ART, pair.pair.names)?.badge ?? null;
    const picture: PictureSource | null = art ? { src: art.url, cover: { x: 0.5, y: 0.5 } } : null;
    return { seats: pair.seats, label: pair.label, picture };
  });
}

/** The narrow strip: a disclosure line and, open, the active seat's facts with Clear seat (the last hero stays). */
export function summaryModelOf(draft: SetupDraft, option: DeckOption | undefined, open: boolean): SeatSummaryModel {
  const seat = draft.activeSeatIndex + 1;
  const mark = open ? "▾" : "▸";
  if (!option) {
    return {
      hint: t("seats.tapHeroForSeat", { seat }),
      lines: [],
      clearLabel: t("seats.clearSeat"),
      clearBlocked: null,
      toggle: { label: `${t("seats.summaryEmpty", { seat })} ${mark}`, open },
    };
  }
  const detail = heroCandidateDetailOf(option, currentCardsById(), POOL_ENCOUNTER_SETS);
  return {
    hint: null,
    lines: [
      {
        text: t("seats.detailHpHand", {
          aspect: detail.aspectLabel,
          hp: detail.hp ?? "—",
          hand: detail.handSize ?? "—",
        }),
        strong: true,
      },
      {
        text: t("seats.detailStats", { thw: detail.thw ?? "—", atk: detail.atk ?? "—", def: detail.def ?? "—" }),
        strong: true,
      },
      {
        text: t("seats.obligationLine", { name: detail.obligationName ?? t("seats.obligationNoneLower") }),
        strong: false,
      },
      { text: t("seats.nemesisLine", { name: detail.nemesisSetName ?? t("seats.nemesisNoneLower") }), strong: false },
    ],
    clearLabel: t("seats.clearSeat"),
    // `clearSeat` itself refuses to empty the last seat (a game needs one hero), so the control says so.
    clearBlocked: draft.seats.length > 1 ? null : t("seats.needOneHero"),
    toggle: {
      label: `${t("seats.summary", { seat, aspect: detail.aspectLabel, hp: detail.hp ?? "—" })} ${mark}`,
      open,
    },
  };
}

/** The wide ink panel: the active seat's own hero (or the one just seated), and the insights under its facts. */
export function detailModelOf(
  draft: SetupDraft,
  deckOptions: readonly DeckOption[],
  insights: SeatInsights,
  focusDeckId: string | null,
): SeatsDetailModel {
  const subject = seatDetailSubject(draft);
  const option =
    subject.deckId === null ? undefined : deckOptions.find((o) => (o.deck.id as string) === subject.deckId);
  const seatNote =
    option && subject.seatIndex !== null && subject.pickingSeatIndex !== null
      ? t("seats.seatSetPickNext", { seat: subject.seatIndex + 1, next: subject.pickingSeatIndex + 1 })
      : null;
  const detail = option ? heroCandidateDetailOf(option, currentCardsById(), POOL_ENCOUNTER_SETS) : null;
  const credit = option ? testedSubtitleOf(option.deck, testedCatalog()) : null;
  const lines: { text: string; tone: "meta" | "caution" }[] = [];
  for (const pair of insights.pairs) {
    lines.push({ text: t("seats.pairSeats", { label: pair.label, a: pair.seats[0], b: pair.seats[1] }), tone: "meta" });
    const held = pair.inDecks.map((d) => t("seats.deckHas", { hero: d.heroName, copies: d.copies }));
    lines.push({
      text: `${listAnd(pair.cardNames)}: ${held.length > 0 ? held.join("; ") : t("seats.inNeitherDeck")}.`,
      tone: "meta",
    });
  }
  const rec = focusDeckId ? insights.analysis.get(focusDeckId) : undefined;
  const why = focusDeckId ? deckOptions.find((o) => (o.deck.id as string) === focusDeckId) : undefined;
  if (rec && rec.lines.length > 0 && why) {
    lines.push({ text: t("seats.why", { name: why.identityName ?? why.deck.name }), tone: "meta" });
    for (const line of rec.lines) lines.push({ text: line, tone: "meta" });
  }
  return {
    hero:
      option && detail
        ? {
            name: detail.identityName,
            credit: credit ? `${option.deck.name} · ${credit}` : null,
            stats: t("seats.detailFull", {
              aspect: detail.aspectLabel,
              hp: detail.hp ?? "—",
              hand: detail.handSize ?? "—",
              thw: detail.thw ?? "—",
              atk: detail.atk ?? "—",
              def: detail.def ?? "—",
            }),
            obligationLabel: t("seats.obligation"),
            obligation: detail.obligationName ?? t("seats.obligationNone"),
            nemesisLabel: t("seats.nemesisSet"),
            nemesis: detail.nemesisSetName ?? t("seats.nemesisNone"),
          }
        : null,
    seatNote,
    emptyText: t("seats.selectHeroBelow"),
    insights: lines,
  };
}

/** Play N heroes, or why it is off (no hero, a hero locked again), and Deck check (needs a hero). */
export function footerModelOf(draft: SetupDraft, tableLock: string | null): SeatsFooterModel {
  const noHeroes = draft.seats.length === 0;
  return {
    deckCheckLabel: t("seats.deckCheck"),
    playLabel: tableLock
      ? t("seats.heroLocked")
      : noHeroes
        ? t("seats.pickHeroCta")
        : tPlural("seats.playHeroes", draft.seats.length),
    playBlocked: tableLock ?? (noHeroes ? t("seats.pickHeroFirst") : null),
    deckCheckBlocked: noHeroes ? t("seats.pickHeroFirst") : null,
  };
}
