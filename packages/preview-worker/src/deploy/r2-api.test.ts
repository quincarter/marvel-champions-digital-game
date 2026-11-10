import { ApiError, encodeKey, R2Api, RateLimiter, type FetchLike } from "./r2-api.ts";

const BASE = "https://api.test/accounts/acct/r2/buckets/mc-previews/objects";

function api(fetch: FetchLike, sleeps: number[] = []): R2Api {
  return new R2Api({
    accountId: "acct",
    token: "tok",
    bucket: "mc-previews",
    baseUrl: "https://api.test",
    fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    limiter: new RateLimiter(1000, 1000, () => 0),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("R2Api", () => {
  it("lists every page with the token, unquoting etags", async () => {
    const urls: string[] = [];
    const auth: string[] = [];
    const client = api(async (url, init) => {
      urls.push(url);
      auth.push(new Headers(init?.headers).get("Authorization") ?? "");
      return url.includes("cursor=c1")
        ? jsonResponse({ result: [{ key: "pr-5/b", etag: "BB", size: 2 }], result_info: { is_truncated: false } })
        : jsonResponse({
            result: [{ key: "pr-5/a", etag: '"aa"', size: 1, last_modified: "2026-11-10T00:00:00Z" }],
            result_info: { is_truncated: true, cursor: "c1" },
          });
    });
    const objects = await client.list("pr-5/");
    expect(objects).toEqual([
      { key: "pr-5/a", etag: "aa", size: 1, lastModified: Date.parse("2026-11-10T00:00:00Z") },
      { key: "pr-5/b", etag: "bb", size: 2, lastModified: 0 },
    ]);
    expect(urls[0]).toBe(`${BASE}?prefix=pr-5%2F&per_page=1000`);
    expect(auth).toEqual(["Bearer tok", "Bearer tok"]);
    expect(client.calls).toBe(2);
  });

  it("lists folders with a delimiter", async () => {
    const client = api(async () => jsonResponse({ result: [], result_info: { delimited: ["pr-1/", "pr-2/"] } }));
    expect(await client.folders("pr-")).toEqual(["pr-1/", "pr-2/"]);
  });

  it("puts with the content type and an encoded key", async () => {
    const seen: { url: string; method: string | undefined; type: string | null }[] = [];
    const client = api(async (url, init) => {
      seen.push({ url, method: init?.method, type: new Headers(init?.headers).get("Content-Type") });
      return jsonResponse({ success: true });
    });
    await client.put("shared/card-art/en/a b#.png", new Uint8Array([1]), "image/webp");
    expect(seen).toEqual([{ url: `${BASE}/shared/card-art/en/a%20b%23.png`, method: "PUT", type: "image/webp" }]);
  });

  it("retries a 429 after Retry-After, then succeeds", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const client = api(async () => {
      calls++;
      return calls === 1
        ? new Response("slow down", { status: 429, headers: { "Retry-After": "3" } })
        : jsonResponse({});
    }, sleeps);
    await client.delete("pr-5/a");
    expect(calls).toBe(2);
    expect(sleeps).toEqual([3000]);
  });

  it("reads a missing object as null and a missing bucket as an error", async () => {
    const missingObject = api(async () => jsonResponse({ errors: [{ code: 10007 }] }, 404));
    expect(await missingObject.getText("pr-5/files.json")).toBeNull();
    const missingBucket = api(async () => jsonResponse({ errors: [{ code: 10006, message: "bucket" }] }, 404));
    const error = await missingBucket.getText("pr-5/files.json").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isMissingBucket).toBe(true);
  });

  it("reports a token without R2 permission", async () => {
    const client = api(async () => jsonResponse({ errors: [{ code: 10000, message: "Authentication error" }] }, 403));
    const error = (await client.list("pr-").catch((caught: unknown) => caught)) as ApiError;
    expect(error.isPermission).toBe(true);
  });

  it("encodes each segment and keeps the slashes", () => {
    expect(encodeKey("pr-5/releases/v0.43.2/index.html")).toBe("pr-5/releases/v0.43.2/index.html");
    expect(encodeKey("a?/b")).toBe("a%3F/b");
  });
});

describe("RateLimiter", () => {
  it("waits for the window once the limit is reached", async () => {
    let now = 0;
    const sleeps: number[] = [];
    const limiter = new RateLimiter(
      2,
      1000,
      () => now,
      async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    );
    await limiter.take();
    await limiter.take();
    await limiter.take();
    expect(sleeps).toEqual([1050]);
  });
});
