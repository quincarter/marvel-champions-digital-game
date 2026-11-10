import type { Env, R2BucketLike, R2GetOptionsLike, R2ObjectLike } from "./env.ts";
import { clearInfoCache, handleRequest, INFO_TTL_MS, type Upstream } from "./handler.ts";

/** An in-memory bucket with the slice of R2's `get` semantics the handler relies on: onlyIf (If-None-Match) and range. */
class FakeBucket implements R2BucketLike {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  reads = 0;

  put(key: string, text: string, contentType?: string): void {
    this.objects.set(key, { bytes: new TextEncoder().encode(text), ...(contentType ? { contentType } : {}) });
  }

  async head(key: string): Promise<R2ObjectLike | null> {
    this.reads++;
    const found = this.objects.get(key);
    return found ? this.#meta(key, found) : null;
  }

  async get(key: string, options?: R2GetOptionsLike): Promise<R2ObjectLike | null> {
    this.reads++;
    const found = this.objects.get(key);
    if (!found) return null;
    const meta = this.#meta(key, found);
    if (options?.onlyIf?.get("If-None-Match") === meta.httpEtag) return meta;
    const range = parseRange(options?.range?.get("Range") ?? null, found.bytes.length);
    const bytes = range ? found.bytes.slice(range.offset, range.offset + range.length) : found.bytes;
    return {
      ...meta,
      ...(range ? { range } : {}),
      body: new Response(bytes as BodyInit).body!,
    };
  }

  #meta(key: string, found: { bytes: Uint8Array; contentType?: string }): R2ObjectLike {
    return {
      key,
      size: found.bytes.length,
      httpEtag: `"etag-${key}"`,
      uploaded: new Date("2026-11-10T00:00:00Z"),
      ...(found.contentType ? { httpMetadata: { contentType: found.contentType } } : {}),
    };
  }
}

function parseRange(header: string | null, size: number): { offset: number; length: number } | null {
  const match = header && /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return null;
  if (match[1] === "") return { offset: size - Number(match[2]), length: Number(match[2]) };
  const offset = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Number(match[2]);
  return { offset, length: end - offset + 1 };
}

const HOST = "https://pr-42.champions-digital-game.com";
let bucket: FakeBucket;
let env: Env;
const noUpstream: Upstream = async () => {
  throw new Error("no upstream call expected");
};

function get(path: string, init?: RequestInit, upstream: Upstream = noUpstream, now = 0): Promise<Response> {
  return handleRequest(new Request(`${HOST}${path}`, init), env, upstream, () => now);
}

beforeEach(() => {
  clearInfoCache();
  bucket = new FakeBucket();
  env = { PREVIEWS: bucket, PREVIEWS_ENABLED: "true" };
  bucket.put("pr-42/preview.json", JSON.stringify({ pr: 42, sha: "abc", lang: "en", deployedAt: "x" }));
  bucket.put("pr-42/index.html", "<html>app</html>", "text/html; charset=utf-8");
  bucket.put("pr-42/releases/index.html", "<html>releases</html>", "text/html; charset=utf-8");
  bucket.put("shared/assets/index-B4qWg0Py.js", "console.log(1)", "text/javascript; charset=utf-8");
  bucket.put("shared/card-art/en/bundles/cards/01001a.png", "en-scan", "image/webp");
  bucket.put("shared/card-art/es/bundles/cards/01001a.png", "es-scan", "image/webp");
  bucket.put("shared/assets/theme-u1WnHvUN.mp3", "0123456789", "audio/mpeg");
});

describe("serving a preview", () => {
  it("serves index.html at the root, revalidated on every load", async () => {
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>app</html>");
    expect(response.headers.get("Content-Type")).toMatch(/^text\/html/);
    expect(response.headers.get("Cache-Control")).toContain("max-age=0");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("serves hashed assets from the shared prefix, cached for a year", async () => {
    const response = await get("/assets/index-B4qWg0Py.js");
    expect(await response.text()).toBe("console.log(1)");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });

  it("serves card scans in the build language and the other carried languages", async () => {
    expect(await (await get("/card-art/bundles/cards/01001a.png")).text()).toBe("en-scan");
    expect(await (await get("/card-art-es/bundles/cards/01001a.png")).text()).toBe("es-scan");
    const scan = await get("/card-art/bundles/cards/01001a.png");
    expect(scan.headers.get("Content-Type")).toBe("image/webp");
  });

  it("serves a Spanish preview's /card-art/ in Spanish", async () => {
    bucket.put("pr-42/preview.json", JSON.stringify({ pr: 42, sha: "abc", lang: "es", deployedAt: "x" }));
    expect(await (await get("/card-art/bundles/cards/01001a.png")).text()).toBe("es-scan");
    expect(await (await get("/card-art-en/bundles/cards/01001a.png")).text()).toBe("en-scan");
  });

  it("answers 304 to a matching If-None-Match", async () => {
    const response = await get("/", { headers: { "If-None-Match": '"etag-pr-42/index.html"' } });
    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it("answers a byte range with 206, as audio seeking needs", async () => {
    const response = await get("/assets/theme-u1WnHvUN.mp3", { headers: { Range: "bytes=2-5" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(await response.text()).toBe("2345");
  });

  it("answers HEAD without a body", async () => {
    const response = await get("/", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get("Content-Length")).toBe("16");
  });

  it("refuses other methods", async () => {
    expect((await get("/", { method: "POST" })).status).toBe(405);
  });
});

describe("fallbacks", () => {
  it("serves the app for an unknown page path", async () => {
    const response = await get("/decks/some-deck");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>app</html>");
  });

  it("answers a missing script or scan with a real 404, not the app", async () => {
    expect((await get("/assets/missing-AAAAAAAA.js")).status).toBe(404);
    expect((await get("/card-art/bundles/cards/99999a.png")).status).toBe(404);
  });

  it("redirects a folder named without its slash", async () => {
    const response = await get("/releases");
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("/releases/");
  });

  it("sends a release with no report to its line in the history", async () => {
    const response = await get("/releases/v0.12.0");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/releases/#v0.12.0");
  });

  it("redirects the retired Shadowland page", async () => {
    const response = await get("/shadowland-info.html");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/releases/v0.43.2/index.html");
  });

  it("refuses a path that climbs into another PR", async () => {
    bucket.put("pr-7/secret.txt", "other");
    expect((await get("/a/%2E%2E/%2E%2E/pr-7/secret.txt")).status).toBe(404);
  });
});

describe("previews that don't exist", () => {
  it("answers 404 for a PR with no preview.json", async () => {
    const response = await handleRequest(
      new Request("https://pr-43.champions-digital-game.com/"),
      env,
      noUpstream,
      () => 0,
    );
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("#43");
  });

  it("re-reads preview.json once the cached answer is stale", async () => {
    bucket.objects.delete("pr-42/preview.json");
    expect((await get("/", undefined, noUpstream, 0)).status).toBe(404);
    bucket.put("pr-42/preview.json", JSON.stringify({ pr: 42, sha: "abc", lang: "en", deployedAt: "x" }));
    expect((await get("/", undefined, noUpstream, INFO_TTL_MS - 1)).status).toBe(404);
    expect((await get("/", undefined, noUpstream, INFO_TTL_MS)).status).toBe(200);
  });

  it("caches preview.json between requests", async () => {
    await get("/");
    const before = bucket.reads;
    await get("/");
    expect(bucket.reads - before).toBe(1);
  });

  it("answers 503 with the kill switch off", async () => {
    env = { ...env, PREVIEWS_ENABLED: "false" };
    expect((await get("/")).status).toBe(503);
  });
});

describe("other hosts", () => {
  it("hands a request for a non-preview host on untouched", async () => {
    const seen: string[] = [];
    const upstream: Upstream = async (input) => {
      seen.push(typeof input === "string" ? input : input.url);
      return new Response("packs");
    };
    const response = await handleRequest(
      new Request("https://packs.champions-digital-game.com/index.json"),
      env,
      upstream,
    );
    expect(await response.text()).toBe("packs");
    expect(seen).toEqual(["https://packs.champions-digital-game.com/index.json"]);
  });
});

describe("the MarvelCDB deck proxy", () => {
  it("proxies a public decklist", async () => {
    const seen: string[] = [];
    const upstream: Upstream = async (input) => {
      seen.push(String(input));
      return new Response('{"id":1}', { headers: { "Content-Type": "application/json" } });
    };
    const response = await get("/api/marvelcdb-import/decklist/12345", undefined, upstream);
    expect(seen).toEqual(["https://marvelcdb.com/api/public/decklist/12345.json"]);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"id":1}');
  });

  it("answers a deck MarvelCDB serves as HTML with a 404 and an error", async () => {
    const upstream: Upstream = async () => new Response("<html>", { headers: { "Content-Type": "text/html" } });
    const response = await get("/api/marvelcdb-import/deck/9", undefined, upstream);
    expect(response.status).toBe(404);
    expect(JSON.parse(await response.text())).toHaveProperty("error");
  });

  it("answers an unreachable MarvelCDB with 502", async () => {
    const upstream: Upstream = async () => {
      throw new Error("down");
    };
    expect((await get("/api/marvelcdb-import/deck/9", undefined, upstream)).status).toBe(502);
  });

  it("doesn't proxy anything but a numeric deck id", async () => {
    // The decoded path climbs (`..`), so it is refused before any fetch; noUpstream would throw if one were made.
    expect((await get("/api/marvelcdb-import/deck/..%2F..%2Fuser")).status).toBe(404);
    expect((await get("/api/marvelcdb-import/deck/abc")).status).toBe(200); // the SPA fallback, never MarvelCDB
  });
});
