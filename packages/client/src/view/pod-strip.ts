/**
 * The pod strip (Trickster Takeover Epic Multiplayer, issue #882, docs/epic-multiplayer-plan.md section 4 item 6): the
 * rows added to the foot of the board's title bar in an Epic game, as plain data. Loki's hit points and flip, Worlds
 * Collide's threat and target, each table's name, round and status in words, the time-limit clock, what this table may
 * reach in its pod, and a "waiting for the pod" or "stopped" line taken from the group's own state.
 *
 * Nothing here is computed from rules: the numbers are the coordinator's last broadcast (`RoomState.epic.pod`), the
 * table statuses are the room's, and the waiting and stopped lines read `GameState.pod`. Every state is words first (a
 * glyph or colour only backs it up). Lines are wrapped to a character budget so the strip fits the narrowest screen.
 */
import type { GameState } from "@mc/engine";
import type { MessageKey } from "../i18n/translate.js";
import { t } from "../i18n/translate.js";
import type { EpicState, EpicTable } from "../live/room-state.js";
import { minutesText, statusKey } from "./epic-lobby-model.js";

export type StripTone = "plain" | "alert" | "mine";

export interface PodStripLine {
  readonly kind: "shared" | "tables" | "time" | "targets" | "wait" | "banner" | "outcome";
  readonly text: string;
  readonly tone: StripTone;
}

export interface PodStrip {
  readonly lines: readonly PodStripLine[];
  /** How many cards of other tables of my pod I may attack or thwart now. */
  readonly targets: number;
  /** Loki has flipped (the shared record's word). */
  readonly flipped: boolean;
}

/** Just what the strip reads of the group's own game. */
export type StripGame = Pick<GameState, "pod"> | null;

export interface PodStripInput {
  readonly epic: EpicState;
  readonly game: StripGame;
  /** The clock now, ms since the epoch (the time limit counts from the organizer's start). */
  readonly now: number;
  /** Show the flip banner (the scene keeps it up for a few seconds after the flip). */
  readonly flipBanner: boolean;
  /** A card's printed name, for the targets line. */
  readonly nameOf: (cardId: string) => string;
}

/** The pod strip, or null when the game has not started (the lobby shows the tables itself). */
export function podStripOf(input: PodStripInput, maxChars: number): PodStrip | null {
  const { epic } = input;
  if (!epic.start && !epic.pod) return null;
  const lines: PodStripLine[] = [];
  const shared = epic.pod?.shared ?? null;
  const outcome = epic.pod?.outcome ?? "playing";
  const flipped = shared?.villainFlipped === true;

  if (shared) {
    const left = Math.max(0, shared.villainHp - shared.villainDamage);
    const parts: string[] = [
      t(maxChars >= 48 ? "epic.strip.loki" : "epic.strip.lokiShort", { left, total: shared.villainHp }),
    ];
    if (flipped) parts.push(t("epic.strip.flipped"));
    parts.push(t("epic.strip.scheme", { threat: shared.schemeThreat, target: shared.schemeTarget }));
    if (shared.status === "schemeCompleted") parts.push(t("epic.strip.schemeDone"));
    lines.push({ kind: "shared", text: parts.join(" · "), tone: "plain" });
  } else {
    lines.push({ kind: "shared", text: t("epic.strip.noRecord"), tone: "plain" });
  }

  if (outcome !== "playing") {
    lines.push({ kind: "outcome", text: t(outcome === "won" ? "epic.strip.won" : "epic.strip.lost"), tone: "alert" });
  }
  if (input.flipBanner) lines.push({ kind: "banner", text: t("epic.strip.flipBanner"), tone: "alert" });

  const pod = input.game?.pod;
  if (pod?.halted) lines.push({ kind: "wait", text: t("epic.strip.halted"), tone: "alert" });
  else if (pod?.awaiting !== undefined) lines.push({ kind: "wait", text: t("epic.strip.waitingPod"), tone: "alert" });

  const clock = timeLine(epic, input.now);
  const sharedLine = lines[0];
  if (clock && sharedLine && sharedLine.kind === "shared" && sharedLine.text.length + clock.length + 3 <= maxChars) {
    // Room for it: the clock rides on the first line, saving a row of the board.
    lines[0] = { ...sharedLine, text: `${sharedLine.text} · ${clock}` };
  } else if (clock) {
    lines.push({ kind: "time", text: clock, tone: clock === t("epic.strip.timeUp") ? "alert" : "plain" });
  }

  for (const text of tableLines(epic.tables, epic.myTable, maxChars)) {
    lines.push({ kind: "tables", text, tone: "plain" });
  }

  const targets = epic.remoteTargets;
  if (targets.length > 0) {
    const named = targets.map((target) => {
      const card = target.card;
      const left = card.remainingHitPoints !== undefined ? card.remainingHitPoints : card.threat;
      return t("epic.strip.target", { name: input.nameOf(card.cardId), table: target.tableName, left: left ?? 0 });
    });
    lines.push({ kind: "targets", text: t("epic.strip.reach", { cards: named.join(" · ") }), tone: "mine" });
  }
  return { lines: lines.flatMap((line) => wrapLine(line, maxChars)), targets: targets.length, flipped };
}

/** The clock line, or null with no limit. Display only: nothing ends when it runs out (plan Q-D). */
export function timeLine(epic: Pick<EpicState, "timeLimitMinutes" | "start">, now: number): string | null {
  const limit = epic.timeLimitMinutes;
  if (limit === null) return null;
  const at = epic.start?.at;
  if (at === undefined) return t("epic.strip.timeLimit", { time: minutesText(limit) });
  const leftMs = limit * 60_000 - (now - at);
  if (leftMs <= 0) return t("epic.strip.timeUp");
  const minutes = Math.ceil(leftMs / 60_000);
  return t("epic.strip.timeLeft", { time: minutesText(minutes) });
}

/** One table as a short phrase: "North · R3 · player" (mine is marked in words too). */
export function tablePhrase(table: EpicTable, mineId: string | null): string {
  const status = t(statusKey(table.status) as MessageKey);
  const round = table.round > 0 && table.status !== "dropped" && table.status !== "lobby" ? ` · R${table.round}` : "";
  const mark = table.id === mineId ? `${t("epic.strip.you")} ` : "";
  return `${mark}${table.name}${round} · ${status}`;
}

/** The tables' phrases wrapped into lines of at most `maxChars` (a phrase is never split). */
export function tableLines(tables: readonly EpicTable[], mineId: string | null, maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const table of tables) {
    const phrase = tablePhrase(table, mineId);
    const joined = line === "" ? phrase : `${line}   ${phrase}`;
    if (line !== "" && joined.length > maxChars) {
      lines.push(line);
      line = phrase;
    } else line = joined;
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** Loki flipped between two looks at the record (the scene shows the banner for a few seconds after). */
export const justFlipped = (before: boolean | null, now: boolean): boolean => before === false && now;

/** The strip's height: its lines (the first as tall as its button) and a little air. Zero for no strip. */
export const podStripHeight = (strip: PodStrip | null, lineHeight: number, buttonHeight = 0): number =>
  strip ? Math.max(lineHeight, buttonHeight) + (strip.lines.length - 1) * lineHeight + 10 : 0;

/** A line split at spaces into lines of at most `maxChars` (a word longer than that stays whole), each keeping its kind and tone. */
export function wrapLine(line: PodStripLine, maxChars: number): PodStripLine[] {
  if (line.kind === "tables" || line.text.length <= maxChars) return [line];
  const out: string[] = [];
  let current = "";
  for (const word of line.text.split(" ")) {
    const joined = current === "" ? word : `${current} ${word}`;
    if (current !== "" && joined.length > maxChars) {
      out.push(current);
      current = word;
    } else current = joined;
  }
  if (current !== "") out.push(current);
  return out.map((text) => ({ ...line, text }));
}
