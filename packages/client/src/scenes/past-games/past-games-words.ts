/** The words of a finished game: what the row and the details say, from `view/past-games-model.ts`'s data. */
import { artLanguageNow } from "../../art/art-source.js";
import type {
  PastGameSummaryModel,
  PastGameTone,
} from "../../components/past-games/mc-past-game-summary/mc-past-game-summary.types.js";
import type { PastGameSeatModel } from "../../components/past-games/mc-past-game-seat/mc-past-game-seat.types.js";
import { t, type MessageKey } from "../../i18n/translate.js";
import {
  aspectsNotInName,
  playedMinutesOf,
  seatFatesOf,
  type PastGameRow,
  type PastGameSeat,
} from "../../view/past-games-model.js";

/** Won reads green and a loss red, but only ever with the word beside it. */
export const toneOf = (row: PastGameRow): PastGameTone =>
  row.result === "won" ? "won" : row.result === "lost" || row.result === "conceded" ? "lost" : "neutral";

/** Why it ended, when and how long, and which heroes fell and which stood. */
function summaryLines(row: PastGameRow): {
  readonly reason: string;
  readonly when: string;
  readonly fates: string | null;
} {
  const minutes = playedMinutesOf(row.playedMs);
  const date = new Intl.DateTimeFormat(artLanguageNow(), { dateStyle: "medium", timeStyle: "short" }).format(
    row.endedAt,
  );
  const fates = seatFatesOf(row.seats);
  let fatesText: string | null = null;
  // A loss to every hero falling already says so in its reason.
  if (fates.wiped && row.reason === "heroesDefeated") fatesText = null;
  else if (fates.wiped) fatesText = t(row.seats.length === 1 ? "pastGames.fates.heroFell" : "pastGames.fates.wiped");
  else if (fates.fell.length > 0 || fates.stood.length > 0) {
    fatesText = [
      ...(fates.fell.length > 0 ? [t("pastGames.fates.fell", { names: fates.fell.join(", ") })] : []),
      ...(fates.stood.length > 0 ? [t("pastGames.fates.stood", { names: fates.stood.join(", ") })] : []),
    ].join(" · ");
  }
  return {
    reason: t(`pastGames.reason.${row.reason}` as MessageKey),
    when: [
      t(row.round === 1 ? "pastGames.oneRound" : "pastGames.rounds", { rounds: row.round }),
      ...(minutes === null ? [] : [t("pastGames.minutes", { minutes })]),
      date,
    ].join(" · "),
    fates: fatesText,
  };
}

/** The result word in capitals, the reason, the title, when and the fates; the campaign line only in the details. */
export function summaryOf(row: PastGameRow, detail: boolean): PastGameSummaryModel {
  const lines = summaryLines(row);
  return {
    result: t(`pastGames.result.${row.result}` as MessageKey).toUpperCase(),
    tone: toneOf(row),
    reason: lines.reason,
    title: row.title,
    when: lines.when,
    fates: detail ? null : lines.fates,
    campaign: detail && row.campaign ? t("pastGames.campaign", { name: row.campaign }) : null,
  };
}

/** One seat in the details: its stats, aspects and deck, and the cards it played most (#756). */
export function seatModelOf(seat: PastGameSeat): PastGameSeatModel {
  const fate = seat.fell === null ? "" : ` · ${t(seat.fell ? "pastGames.seat.fell" : "pastGames.seat.stood")}`;
  // A deck named after its aspect (a precon) does not say it twice.
  const deckParts = [...(seat.deckName ? [seat.deckName] : []), ...aspectsNotInName(seat.deckName, seat.aspects)];
  return {
    heading: `${seat.name}${fate}`,
    lines: [
      ...(seat.damage !== null && seat.thwart !== null
        ? [t("pastGames.seat.stats", { damage: seat.damage, thwart: seat.thwart })]
        : []),
      ...(deckParts.length > 0 ? [t("pastGames.seat.deck", { deck: deckParts.join(" · ") })] : []),
      ...(seat.topCards.length > 0
        ? [t("pastGames.seat.top", { cards: seat.topCards.map((card) => `${card.name} ${card.count}×`).join(", ") })]
        : []),
    ],
  };
}
