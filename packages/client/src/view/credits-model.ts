/**
 * The Art & Credits screen (`scenes/credits.ts`) as plain data: the fan-project notice, then one section per group of
 * `content/credits.ts`, each entry a row, worded in the player's language. The screen's own words, the notices and the
 * group titles are translated (`i18n/`); an entry's title and credit line are names, works and sources, and stay as
 * the repo records them. Rows are read-only text, so a phone swipe that lifts over one fires nothing (CLAUDE.md, no
 * tap on finger lift).
 */
import {
  ARTIST_NOT_RECORDED,
  CREDITS,
  CREDIT_GROUPS,
  CREDITS_INTRO,
  FAN_PROJECT_NOTICE,
  FFG_MARVEL,
  MARVEL,
  type CreditEntry,
  type CreditGroup,
} from "../content/credits.js";
import { t, type MessageKey } from "../i18n/translate.js";

export type CreditsRow =
  | { readonly kind: "notice"; readonly text: string }
  | { readonly kind: "section"; readonly id: CreditGroup; readonly title: string; readonly count: string }
  | {
      readonly kind: "entry";
      readonly entry: CreditEntry;
      readonly title: string;
      readonly lines: readonly { readonly text: string; readonly tone: "body" | "small" }[];
    };

const GROUP_TITLES: Readonly<Record<CreditGroup, MessageKey>> = {
  game: "credits.group.game",
  "card-art": "credits.group.cardArt",
  "hero-villain-art": "credits.group.heroVillainArt",
  story: "credits.group.story",
  music: "credits.group.music",
  tools: "credits.group.tools",
};

/** The notices several entries share, and the intro lines, by their English text. */
const SHARED_TEXT: ReadonlyMap<string, MessageKey> = new Map<string, MessageKey>([
  [FAN_PROJECT_NOTICE, "credits.intro.fanProject"],
  [CREDITS_INTRO[1]!, "credits.intro.terms"],
  [FFG_MARVEL, "credits.notice.ffgMarvel"],
  [MARVEL, "credits.notice.marvel"],
  [ARTIST_NOT_RECORDED, "credits.notice.artistNotRecorded"],
]);

/** `text` in the player's language when it is one of the shared lines, else as written. */
const translated = (text: string): string => {
  const key = SHARED_TEXT.get(text);
  return key ? t(key) : text;
};

export const shownInLabelOf = (entry: CreditEntry): string => t("credits.shownIn", { where: entry.shownIn });

export function creditsRowsOf(): readonly CreditsRow[] {
  const rows: CreditsRow[] = CREDITS_INTRO.map((text) => ({ kind: "notice", text: translated(text) }));
  for (const group of CREDIT_GROUPS) {
    const entries = CREDITS.filter((entry) => entry.group === group.id);
    if (entries.length === 0) continue;
    rows.push({ kind: "section", id: group.id, title: t(GROUP_TITLES[group.id]), count: String(entries.length) });
    for (const entry of entries)
      rows.push({
        kind: "entry",
        entry,
        title: entry.title,
        lines: [
          { text: shownInLabelOf(entry), tone: "small" },
          { text: translated(entry.credit), tone: "body" },
          { text: translated(entry.notice), tone: "small" },
          ...(entry.url ? [{ text: entry.url, tone: "small" as const }] : []),
        ],
      });
  }
  return rows;
}
