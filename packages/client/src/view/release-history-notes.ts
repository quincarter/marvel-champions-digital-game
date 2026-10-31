/**
 * Turns the changelog into what the release history page reads (`public/releases/index.html`, issue #588). Every
 * tagged release has a `.changes/<version>.md`; a headline comes from its `release-notes-header.md` when the release
 * has one, else from `docs/releases/history.json`, which holds the headlines written after the fact for the older
 * releases. Pure strings in, plain data out: `vite-release-history.ts` does the file work at build time, so a new
 * release shows up with no step of its own.
 */

export const REPO_URL = "https://github.com/quincarter/marvel-champions-digital-game";

/** The order a release's sections read in. A kind not listed here goes after these. */
const KIND_ORDER = ["Added", "Changed", "Fixed", "Content", "Engine", "Docs"];
/** The sections open when the page arrives; the rest are folded, because some run to hundreds of lines. */
const OPEN_KINDS: ReadonlySet<string> = new Set(["Added", "Changed", "Fixed"]);

export interface ReleaseImage {
  readonly src: string;
  readonly alt: string;
}

/** One `docs/releases/history.json` entry, or what a `release-notes-header.md` says. */
export interface ReleaseHighlight {
  readonly title: string;
  readonly summary: string;
  readonly images?: readonly ReleaseImage[];
  /** The tag has no GitHub release page (v0.5.1, and v0.16.0, whose builds failed). */
  readonly noGithubRelease?: boolean;
}

export interface ChangelogSection {
  readonly kind: string;
  readonly items: readonly string[];
}

export interface ParsedChangelog {
  readonly version: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly sections: readonly ChangelogSection[];
}

/** One line of the page's list. */
export interface ReleaseEntry {
  readonly version: string;
  readonly date: string;
  readonly title: string;
  /** Has a full report at `<version>/index.html`. */
  readonly report: boolean;
}

/** What the page draws for one release. Strings ending in `Html` are already escaped. */
export interface ReleaseNotes extends ReleaseEntry {
  readonly summaryHtml: string;
  readonly images: readonly ReleaseImage[];
  readonly counts: readonly { readonly kind: string; readonly count: number }[];
  readonly sections: readonly {
    readonly kind: string;
    readonly open: boolean;
    readonly itemsHtml: readonly string[];
  }[];
  readonly linkUrl: string;
  readonly linkLabel: string;
}

export interface ReleaseHistory {
  /** Newest first. */
  readonly manifest: readonly ReleaseEntry[];
  readonly notes: readonly ReleaseNotes[];
}

const parts = (version: string): number[] => version.slice(1).split(".").map(Number);

/** Newest first. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  return y[0]! - x[0]! || y[1]! - x[1]! || y[2]! - x[2]!;
}

/** One `.changes/<version>.md`. */
export function parseChangelog(text: string): ParsedChangelog {
  const head = /^## \[(v[\d.]+)\] - (\d{4}-\d{2}-\d{2})/m.exec(text);
  if (!head) throw new Error(`no version heading in: ${text.slice(0, 60)}`);
  const sections: { kind: string; items: string[] }[] = [];
  for (const raw of text.slice(head.index + head[0].length).split(/\r?\n/)) {
    const line = raw.trimEnd();
    const kind = /^### (.+)$/.exec(line);
    const section = sections.at(-1);
    if (kind) sections.push({ kind: kind[1]!, items: [] });
    else if (/^[*-] /.test(line)) section?.items.push(line.slice(2).trim());
    else if (line.trim() && section?.items.length) section.items.push(`${section.items.pop()} ${line.trim()}`);
  }
  return { version: head[1]!, date: head[2]!, sections: sections.filter((s) => s.items.length > 0) };
}

/** A `release-notes-header.md`: its first heading, first paragraph and its images. */
export function parseHeader(text: string): ReleaseHighlight | null {
  const title = /^## (.+)$/m.exec(text)?.[1]?.trim();
  const summary = text
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("!["));
  if (!title || !summary) return null;
  const images = [...text.matchAll(/!\[([^\]]*)\]\((https:[^)\s]+)\)/g)].map((m) => ({ alt: m[1]!, src: m[2]! }));
  return { title, summary, images };
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Brackets the HTML `inlineHtml` has finished with, while later passes run: a private-use character no text has. */
const MARK = String.fromCharCode(0xe000);
const HELD = new RegExp(`${MARK}(\\d+)${MARK}`, "g");

const anchor = (href: string, label: string): string => `<a href="${href}">${label}</a>`;

/** Changelog Markdown to safe HTML: code, bold, links, `#123` and `@handle`. Scoped names like `@mc/engine` stay text. */
export function inlineHtml(markdown: string): string {
  const held: string[] = [];
  const hold = (html: string): string => `${MARK}${held.push(html) - 1}${MARK}`;
  const text = escapeHtml(markdown)
    .replace(/`([^`]+)`/g, (_, code: string) => hold(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\((https:[^)\s]+)\)/g, (_, label: string, href: string) => hold(anchor(href, label)))
    .replace(/https:\/\/[^\s)]+/g, (url) => hold(anchor(url, url)))
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(?<![\w/&])#(\d+)\b/g, (_, id: string) => hold(anchor(`${REPO_URL}/issues/${id}`, `#${id}`)))
    .replace(/(?<![\w/.])@([A-Za-z0-9][A-Za-z0-9-]*)(?![\w/-])/g, (_, name: string) =>
      hold(anchor(`https://github.com/${name}`, `@${name}`)),
    );
  return text.replace(HELD, (_, index: string) => held[Number(index)]!);
}

const kindRank = (kind: string): number => {
  const rank = KIND_ORDER.indexOf(kind);
  return rank === -1 ? KIND_ORDER.length : rank;
};

/** A release nobody has written a headline for yet still gets a page. */
function fallbackHighlight(changelog: ParsedChangelog): ReleaseHighlight {
  return { title: `Release ${changelog.version}`, summary: changelog.sections[0]?.items[0] ?? "" };
}

function notesOf(changelog: ParsedChangelog, highlight: ReleaseHighlight | undefined, report: boolean): ReleaseNotes {
  const { version, date } = changelog;
  const { title, summary, images, noGithubRelease } = highlight ?? fallbackHighlight(changelog);
  const sections = [...changelog.sections].sort((a, b) => kindRank(a.kind) - kindRank(b.kind));
  return {
    version,
    date,
    title,
    report,
    summaryHtml: inlineHtml(summary),
    images: images ?? [],
    counts: sections.map((section) => ({ kind: section.kind, count: section.items.length })),
    sections: sections.map((section) => ({
      kind: section.kind,
      open: OPEN_KINDS.has(section.kind),
      itemsHtml: section.items.map(inlineHtml),
    })),
    linkUrl: noGithubRelease ? `${REPO_URL}/tree/${version}` : `${REPO_URL}/releases/tag/${version}`,
    linkLabel: noGithubRelease ? "Source at this tag ↗" : "Downloads ↗",
  };
}

export interface ReleaseSources {
  /** The text of each `.changes/<version>.md`. */
  readonly changelogs: readonly string[];
  /** `docs/releases/history.json`. */
  readonly backfill: Readonly<Record<string, ReleaseHighlight>>;
  /** Each release's `release-notes-header.md`, by version. */
  readonly headers: Readonly<Record<string, string>>;
  /** The versions with a report page. */
  readonly reports: ReadonlySet<string>;
}

export function buildReleaseHistory({ changelogs, backfill, headers, reports }: ReleaseSources): ReleaseHistory {
  const notes = changelogs
    .map(parseChangelog)
    .sort((a, b) => compareVersions(a.version, b.version))
    .map((changelog) => {
      const { version } = changelog;
      const header = headers[version];
      const highlight = (header ? parseHeader(header) : null) ?? backfill[version];
      return notesOf(changelog, highlight, reports.has(version));
    });
  return {
    manifest: notes.map(({ version, date, title, report }) => ({ version, date, title, report })),
    notes,
  };
}
