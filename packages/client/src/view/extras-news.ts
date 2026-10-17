/**
 * What just opened in Extras, for the "New song earned" notice (#191): every open entry and every open picture inside
 * an open gallery, by a stable id, so the notice can tell what is new since it last looked.
 *
 * Pure: `scenes/music-button.ts` keeps the ids it has seen and draws the notice.
 */
import { EXTRAS_ENTRIES, type Extras, type ExtrasEntry, type ExtrasTab } from "../progression/extras.js";

export interface ExtrasNewsItem {
  readonly id: string;
  readonly tab: ExtrasTab;
  readonly title: string;
}

/** Everything open, by id: each entry, and each picture of a gallery past its first (a villain's defeat scene). */
export function openExtrasOf(
  extras: Pick<Extras, "isOpen" | "openSlides">,
  entries: readonly ExtrasEntry[] = Object.values(EXTRAS_ENTRIES).flat(),
): Map<string, ExtrasNewsItem> {
  const open = new Map<string, ExtrasNewsItem>();
  for (const entry of entries) {
    if (!extras.isOpen(entry.unlock)) continue;
    open.set(entry.id, { id: entry.id, tab: entry.tab, title: entry.title });
    extras.openSlides(entry.content).forEach((slide, index) => {
      if (index === 0) return;
      const id = `${entry.id}#${slide.caption}#${index}`;
      open.set(id, { id, tab: entry.tab, title: slide.caption });
    });
  }
  return open;
}

/** What is open now that `known` hadn't seen, in Extras' own order. */
export function newExtrasOf(known: ReadonlySet<string>, open: ReadonlyMap<string, ExtrasNewsItem>): ExtrasNewsItem[] {
  return [...open.values()].filter((item) => !known.has(item.id));
}

const ONE: Record<ExtrasTab, string> = {
  music: "New song earned",
  stories: "New story unlocked",
  heroes: "New hero file",
  villains: "New villain file",
  art: "New artwork",
  books: "New rulebook",
};

const MANY: Record<ExtrasTab, string> = {
  music: "new songs earned",
  stories: "new stories unlocked",
  heroes: "new hero files",
  villains: "new villain files",
  art: "new artworks",
  books: "new rulebooks",
};

/**
 * The notice's two lines: what kind of thing, then which. One item names itself ("New song earned" / "The Rhino Has
 * Fallen"); several of a kind are counted ("3 new songs earned"); a mix is "4 new extras unlocked". The second line
 * names the first and counts the rest. Songs lead, since they are what the player hears next.
 */
export function extrasNewsHeadline(items: readonly ExtrasNewsItem[]): {
  readonly label: string;
  readonly title: string;
} {
  if (items.length === 0) return { label: "", title: "" };
  const sorted = [...items].sort((a, b) => Number(b.tab === "music") - Number(a.tab === "music"));
  const first = sorted[0]!;
  if (items.length === 1) return { label: ONE[first.tab], title: first.title };
  const sameTab = items.every((item) => item.tab === first.tab);
  return {
    label: sameTab ? `${items.length} ${MANY[first.tab]}` : `${items.length} new extras unlocked`,
    title: `${first.title} and ${items.length - 1} more`,
  };
}
