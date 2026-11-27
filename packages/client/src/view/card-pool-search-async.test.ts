import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyCard } from "@mc/content";
import type { CardLanguage } from "../art/card-language.js";

// The card-name table is the asynchronous part: a test decides when (and whether) a language's names arrive.
const names = vi.hoisted(() => ({
  ready: new Set<string>(["en"]),
  table: new Map<string, string>(),
  loads: [] as { lang: string; settle: (loaded: boolean) => void }[],
}));
vi.mock("./card-names.js", () => ({
  cardNamesReady: (lang: string) => names.ready.has(lang),
  loadCardNames: (lang: string) =>
    new Promise<boolean>((resolve) => {
      names.loads.push({
        lang,
        settle: (loaded) => {
          if (loaded) names.ready.add(lang);
          resolve(loaded);
        },
      });
    }),
  localizedNameOf: (id: string, lang: string) =>
    names.ready.has(lang) ? (names.table.get(`${lang}:${id}`) ?? null) : null,
}));

const { CardPoolSearch, createPoolDocumentCache, poolSearchDocuments } = await import("./card-pool-search.js");
import type { PoolSearchClient } from "./card-pool-search.js";
import type { RankedDocument, SearchDocument } from "./deck-search.js";
import { DeckSearchClient } from "./deck-search-client.js";
import { es } from "../i18n/es.js";

const card = (id: string, name: string, text = ""): AnyCard =>
  ({ id, name, type: "event", setCode: "core", ...(text ? { text } : {}) }) as unknown as AnyCard;

beforeEach(() => {
  names.ready = new Set(["en"]);
  names.table = new Map([["es:web", "Telaraña"]]);
  names.loads = [];
});
afterEach(() => vi.restoreAllMocks());

/** A worker that answers only when the test says, so an older answer can arrive after a newer ask. */
function fakeClient() {
  const asked: { text: string; answer: (ranked: readonly RankedDocument[]) => void }[] = [];
  const sent: string[] = [];
  let cancelled = 0;
  const client: PoolSearchClient = {
    setDocuments: (_docs, version) => void sent.push(version),
    search: (text, answer) => void asked.push({ text, answer }),
    cancel: () => void cancelled++,
    destroy: () => undefined,
  };
  return { client, asked, sent, cancelled: () => cancelled };
}

function host(language: () => CardLanguage = () => "en") {
  const changes: string[] = [];
  const docs: SearchDocument[] = [{ id: "web", primary: ["Web-Swing"] }];
  return {
    changes,
    host: {
      alive: () => true,
      language,
      documents: () => ({ docs, version: "pool-1" }),
      onChange: () => void changes.push("change"),
    },
  };
}

const ranked = (id: string): RankedDocument[] => [{ id, score: 1 }] as unknown as RankedDocument[];

describe("a search while the names load", () => {
  it("filters by the new terms at once, drops the old answer, and ranks the newest words when the names arrive", async () => {
    const { client, asked } = fakeClient();
    const { host: h, changes } = host(() => "es");
    const s = new CardPoolSearch(h, client);
    s.request("web");
    // The names are pending: terms redraw now, the worker has not been asked.
    s.request("web o:2");
    expect(asked).toHaveLength(0);
    expect(changes.length).toBe(2);
    expect(s.filterFor({}).clauses?.length).toBe(1);
    // One load serves both requests.
    expect(names.loads).toHaveLength(1);
    s.request("spider o:2");
    expect(names.loads).toHaveLength(1);
    names.loads[0]!.settle(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(asked.map((a) => a.text)).toEqual(["spider"]);
  });

  it("searches without the names (English only) when the load fails, and asks the table again after a refresh", async () => {
    const { client, asked } = fakeClient();
    const { host: h } = host(() => "es");
    const s = new CardPoolSearch(h, client);
    s.request("web");
    names.loads[0]!.settle(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(asked.map((a) => a.text)).toEqual(["web"]);
    // Not asked forever: a second request goes straight to the worker.
    s.request("webs");
    expect(names.loads).toHaveLength(1);
    expect(asked).toHaveLength(2);
    // A new pool (a refresh) tries the names again, and the open text is searched with them once they are in.
    s.refresh();
    await Promise.resolve();
    expect(names.loads).toHaveLength(2);
    names.loads[1]!.settle(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(asked.at(-1)!.text).toBe("webs");
  });
});

describe("answers are tagged with the request that asked", () => {
  it("drops an older answer that arrives after a newer ask, and keeps the newest", () => {
    const { client, asked } = fakeClient();
    const { host: h } = host();
    const s = new CardPoolSearch(h, client);
    s.request("alpha");
    s.request("beta");
    asked[0]!.answer(ranked("old"));
    expect(s.ranking).toBeNull();
    asked[1]!.answer(ranked("new"));
    expect(s.ranking?.has("new")).toBe(true);
    expect(s.ranking?.has("old")).toBe(false);
  });

  it("drops an answer for a language the screen has since left, and one that arrives after destroy", () => {
    const { client, asked } = fakeClient();
    let lang: CardLanguage = "en";
    const { host: h } = host(() => lang);
    const s = new CardPoolSearch(h, client);
    s.request("alpha");
    lang = "es";
    names.ready.add("es");
    asked[0]!.answer(ranked("stale"));
    expect(s.ranking).toBeNull();
    s.request("beta");
    s.destroy();
    asked[1]!.answer(ranked("late"));
    expect(s.ranking).toBeNull();
  });

  it("cancels what was on its way the moment a new text is asked", () => {
    const { client, cancelled } = fakeClient();
    const { host: h } = host();
    const s = new CardPoolSearch(h, client);
    s.request("a");
    s.request("b");
    expect(cancelled()).toBe(2);
  });

  it("sends the documents again when the names table arrives, since the documents then say more", async () => {
    const { client, sent } = fakeClient();
    let lang: CardLanguage = "es";
    const { host: h } = host(() => lang);
    const s = new CardPoolSearch(h, client);
    s.request("tela");
    names.loads[0]!.settle(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(sent).toEqual(["pool-1:names"]);
    lang = "en";
    s.request("tela");
    expect(sent).toEqual(["pool-1:names", "pool-1:names"].slice(0, 1));
  });
});

describe("the search documents", () => {
  it("do not keep an English-only document after a failed name load: the names arriving make new ones across visits", () => {
    const cache = createPoolDocumentCache();
    const web = card("web", "Web-Swing");
    const pack = (): undefined => undefined;
    const bare = poolSearchDocuments([web], "es", pack, cache);
    expect(bare[0]!.primary).toEqual(["Web-Swing"]);
    // Another visit: the names load, the same card gets a new document with its Spanish name.
    names.ready.add("es");
    const named = poolSearchDocuments([web], "es", pack, cache);
    expect(named[0]!.primary).toContain("Telaraña");
    // And the cache still serves what it made for each state.
    expect(poolSearchDocuments([web], "es", pack, cache)[0]).toBe(named[0]);
  });

  it("are made again for a same-id card whose text changed (an updated mod), not kept from the old one", () => {
    const cache = createPoolDocumentCache();
    const pack = (): undefined => undefined;
    const before = poolSearchDocuments([card("x.mod.01", "Zap", "Deal 1 damage.")], "en", pack, cache);
    const after = poolSearchDocuments([card("x.mod.01", "Zap", "Deal 3 damage.")], "en", pack, cache);
    expect(JSON.stringify(before[0])).toContain("Deal 1 damage");
    expect(JSON.stringify(after[0])).toContain("Deal 3 damage");
  });

  it("find a card by its Spanish name, accent-free, through the real search once the names are in", async () => {
    const cache = createPoolDocumentCache();
    const cards = [card("web", "Web-Swing"), card("shield", "Energy Shield")];
    names.ready.add("es");
    const changes: string[] = [];
    const s = new CardPoolSearch(
      {
        alive: () => true,
        language: () => "es",
        documents: () => ({ docs: poolSearchDocuments(cards, "es", () => undefined, cache), version: "pool" }),
        onChange: () => void changes.push("change"),
      },
      new DeckSearchClient(),
    );
    s.request("telarana");
    expect(s.ranking?.has("web")).toBe(true);
    expect(s.ranking?.has("shield")).toBe(false);
  });
});

describe("what the Spanish search matches", () => {
  /** Names in Spanish once loaded; traits and rules text only in English (the Spanish card data does not index them). */
  const pool = (): AnyCard[] => [
    { ...card("web", "Web-Swing"), traits: ["Avenger"] } as unknown as AnyCard,
    card("shield", "Energy Shield", "Prevent all damage."),
  ];
  const searchIn = (text: string): ReadonlySet<string> | null => {
    const cache = createPoolDocumentCache();
    const s = new CardPoolSearch(
      {
        alive: () => true,
        language: () => "es",
        documents: () => ({ docs: poolSearchDocuments(pool(), "es", () => undefined, cache), version: "pool" }),
        onChange: () => undefined,
      },
      new DeckSearchClient(),
    );
    s.request(text);
    const ranking = s.ranking;
    return ranking === null ? null : new Set(ranking.keys());
  };

  it("finds a card by its Spanish name, accents or not, once the names are in", () => {
    names.ready.add("es");
    expect(searchIn("telaraña")?.has("web")).toBe(true);
    expect(searchIn("telarana")?.has("web")).toBe(true);
    expect(searchIn("telarana")?.has("shield")).toBe(false);
  });

  it("finds a card by its English trait and rules text, and not by the Spanish word for them", () => {
    names.ready.add("es");
    expect(searchIn("avenger")?.has("web")).toBe(true);
    expect(searchIn("prevent")?.has("shield")).toBe(true);
    // The Spanish trait and text are not indexed: the placeholder says so (Nombre (ES/EN), rasgos y texto (EN)).
    expect(searchIn("vengador")?.has("web") ?? false).toBe(false);
    expect(searchIn("prevenir")?.has("shield") ?? false).toBe(false);
  });

  it("says so at the field: the Spanish placeholders name the Spanish names and the English traits and text", () => {
    expect(es["decks.poolSearch"]).toBe("Nombre (ES/EN), rasgos y texto (EN)");
    expect(es["deckBuilder.searchPlaceholder"]).toMatch(/^Nombre \(ES\/EN\), rasgos \(EN\)/);
  });
});
