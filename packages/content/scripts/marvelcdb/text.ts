/**
 * Text normalization for MarvelCDB card text.
 *
 * MarvelCDB ships two text fields per card: `text` (HTML: `<b>`, `<i>`,
 * `<span class="icon-mental">`) and `real_text` (the same wording with
 * `[mental]`-style icon tokens, `[[Trait]]` trait markup and some leftover
 * `<b>`/`<i>` tags). Neither is "the printed card" — both are the *current*
 * (errata-applied) wording. Ingestion normalizes `real_text` to plain text with
 * icon tokens and falls back to `text` only if `real_text` is missing.
 *
 * Output conventions (what the rest of the pipeline and the engine can rely on):
 * - Icons are bracket tokens: `[energy] [mental] [physical] [wild] [per_hero] [star]`.
 * - Trait markup is removed (`[[Aerial]]` → `Aerial`); traits referenced in rules
 *   text are just words, the card's own traits live in `traits`.
 * - One printed paragraph per line (`\n`), whitespace collapsed within a line.
 */

const ICON_CLASS_TO_TOKEN: Readonly<Record<string, string>> = {
  energy: "[energy]",
  mental: "[mental]",
  physical: "[physical]",
  wild: "[wild]",
  per_hero: "[per_hero]",
  "per-hero": "[per_hero]",
  star: "[star]",
  // Seen across post-Core packs (survey 2026-09-13): a reminder-text reference
  // to the printed boost icon (e.g. "for each boost icon"), the Crisis scheme
  // icon (e.g. "ignoring any crisis icon"), and the Per-Group icon used by
  // some multiplayer scaling text distinct from Per-Hero. None of these carry
  // ability semantics by themselves — they are reminder-text icon references,
  // same as [star] — so a bracket token is enough for round-tripping the text.
  boost: "[boost]",
  crisis: "[crisis]",
  per_group: "[per_group]",
  "per-group": "[per_group]",
};

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#039;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
};

export function toPlainText(html: string | null | undefined): string {
  if (html === null || html === undefined) return "";
  let s = html.replace(/\r\n?/g, "\n");
  s = s.replace(/<span class="icon-([\w-]+)"[^>]*>\s*<\/span>/g, (_m, icon: string) => {
    const token = ICON_CLASS_TO_TOKEN[icon];
    if (token === undefined) throw new Error(`Unknown MarvelCDB icon class "${icon}" — add it to ICON_CLASS_TO_TOKEN`);
    return token;
  });
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Every `[token]` left in normalized text must be one of these. Most arrive already bracketed in MarvelCDB's
 * `real_text` (never as an HTML `<span class="icon-…">`, per a full-corpus check across all 63 packs at the wave 2
 * survey, 2026-09-18) — they are reminder-text references to a printed icon, same as `[star]`, with no ability
 * semantics of their own:
 * - `[amplify]` / `[hazard]` / `[acceleration]` — modular-set scheme/card icons introduced post-wave 1 (same
 *   family as `[crisis]`/`[per_group]`), referenced in text like "for each [crisis], [acceleration], [amplify],
 *   and [hazard] in play".
 * - `[unique]` — the printed unique-card icon, referenced in "a unique enemy ([unique])".
 * - `[cost]` — the consequential-damage icon, referenced in "takes -1 consequential damage ([cost])".
 * - `[physics]` — seen once (Marvel Boy, `mts` 21041: "spend a [physics] resource"). No `ResourceIconType` named
 *   "physics" exists; this is very likely a MarvelCDB source typo for `[physical]`, but it is left as its own
 *   literal token rather than silently rewritten, since nothing here can cross-check it against a card scan.
 *   Flagged in `docs/phase7-wave2-data.md` for verification before any curation depends on its meaning.
 */
export const KNOWN_TEXT_TOKENS = [
  "[energy]",
  "[mental]",
  "[physical]",
  "[wild]",
  "[per_hero]",
  "[star]",
  "[boost]",
  "[crisis]",
  "[per_group]",
  "[amplify]",
  "[hazard]",
  "[acceleration]",
  "[unique]",
  "[cost]",
  "[physics]",
] as const;

export function unknownTokens(text: string): string[] {
  const known = new Set<string>(KNOWN_TEXT_TOKENS);
  return (text.match(/\[[a-z_]+\]/g) ?? []).filter((t) => !known.has(t));
}

/**
 * "Avenger. S.H.I.E.L.D. Soldier." → ["AVENGER", "S.H.I.E.L.D.", "SOLDIER"].
 * A period only ends a trait when it doesn't follow a single capital letter,
 * so dotted acronyms (S.H.I.E.L.D.) survive intact.
 */
export function parseTraits(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] as string;
    if (ch === ".") {
      const prev = raw[i - 1] ?? "";
      const prevPrev = raw[i - 2] ?? "";
      const isAcronymDot = /[A-Z]/.test(prev) && (prevPrev === "" || prevPrev === "." || prevPrev === " ");
      if (isAcronymDot) {
        current += ch;
        continue;
      }
      if (current.trim()) out.push(current.trim().toUpperCase());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim().toUpperCase());
  return out;
}

/** "Do You Even Lift?" → "do-you-even-lift"; "Web-Shooter" → "web-shooter". */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’"“”!?.,]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
