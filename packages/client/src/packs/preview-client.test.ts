import { beforeEach, describe, expect, it } from "vitest";
import { CORE_CARDS } from "@mc/content";
import { PREVIEW_CACHE_KEY, previewInMemory, requestPreview, resetPreviews } from "./preview-client.js";

const event = { ...CORE_CARDS.find((card) => card.type === "event")!, id: "x.demo.02" };
const body = JSON.stringify({ schema: 1, packId: "demo", version: "1.0.0", images: [], cards: [event], decks: [] });

const memoryStorage = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

beforeEach(() => resetPreviews());

describe("requestPreview", () => {
  it("fetches once, keeps it in memory and saves a copy for offline", async () => {
    const storage = memoryStorage();
    let calls = 0;
    const fetch = async (): Promise<Response> => (calls++, new Response(body));
    const first = await requestPreview("https://h/p.json", "demo", { fetch, storage });
    expect(first?.cards).toHaveLength(1);
    expect(previewInMemory("https://h/p.json")?.packId).toBe("demo");
    await requestPreview("https://h/p.json", "demo", { fetch, storage });
    expect(calls).toBe(1);
    expect(storage.data.get(PREVIEW_CACHE_KEY)).toContain("https://h/p.json");
  });

  it("falls back to the saved copy when the network fails, and to nothing when there is none", async () => {
    const storage = memoryStorage();
    storage.setItem(PREVIEW_CACHE_KEY, JSON.stringify([{ url: "https://h/p.json", packId: "demo", text: body }]));
    const down = async (): Promise<Response> => {
      throw new Error("offline");
    };
    expect((await requestPreview("https://h/p.json", "demo", { fetch: down, storage }))?.cards).toHaveLength(1);
    expect(await requestPreview("https://h/other.json", "demo", { fetch: down, storage })).toBeUndefined();
    expect(previewInMemory("https://h/other.json")).toBeNull();
  });

  it("refuses an oversized or malformed file", async () => {
    const big = async (): Promise<Response> => new Response("x", { headers: { "content-length": "99999999" } });
    expect(await requestPreview("https://h/big.json", "demo", { fetch: big, storage: null })).toBeUndefined();
    const junk = async (): Promise<Response> => new Response("not json");
    expect(await requestPreview("https://h/junk.json", "demo", { fetch: junk, storage: null })).toBeUndefined();
    const missing = async (): Promise<Response> => new Response("", { status: 404 });
    expect(await requestPreview("https://h/404.json", "demo", { fetch: missing, storage: null })).toBeUndefined();
  });
});
